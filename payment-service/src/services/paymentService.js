const Payment = require('../models/payment');
const {
    ORDER_STATUS,
    PAYMENT_METHODS,
    PAYMENT_STATUS,
    SUPPORTED_PAYMENT_METHODS
} = require('../config/constants');
const { MOMO_PARTNER_CODE } = require('../config/env');
const { fetchOrder, updateOrderStatus } = require('../clients/orderClient');
const { createHttpError } = require('../utils/errors');
const {
    assertMomoConfigured,
    callMomoCreatePayment,
    createMomoCreatePayload,
    createMomoOrderId,
    createMomoRequestId,
    verifyMomoResultSignature
} = require('./momoService');

function createCashTransactionId(orderId) {
    return `CASH-${orderId}-${Date.now()}`;
}

async function createMomoPayment({ orderId, amount, order }) {
    assertMomoConfigured();

    const momoOrderId = createMomoOrderId(orderId);
    const requestId = createMomoRequestId(orderId);
    const createPayload = createMomoCreatePayload({
        orderId,
        momoOrderId,
        requestId,
        amount,
        order
    });

    const payment = new Payment({
        orderId,
        momoOrderId,
        requestId,
        amount,
        method: PAYMENT_METHODS.MOMO,
        status: PAYMENT_STATUS.PENDING
    });
    const savedPayment = await payment.save();

    try {
        const momoResult = await callMomoCreatePayment(createPayload);

        savedPayment.momoResponse = momoResult;
        savedPayment.resultCode = Number(momoResult.resultCode);
        savedPayment.message = momoResult.message || '';
        savedPayment.payUrl = momoResult.payUrl || '';
        savedPayment.shortLink = momoResult.shortLink || '';
        savedPayment.updatedAt = new Date();

        if (Number(momoResult.resultCode) !== 0 || !savedPayment.payUrl) {
            savedPayment.status = PAYMENT_STATUS.FAILED;
            savedPayment.failedAt = new Date();
            await savedPayment.save();

            throw createHttpError(momoResult.message || 'MoMo tu choi tao giao dich thanh toan.', 502);
        }

        await savedPayment.save();
        return savedPayment;
    } catch (error) {
        if (savedPayment.status === PAYMENT_STATUS.PENDING) {
            savedPayment.status = PAYMENT_STATUS.FAILED;
            savedPayment.message = error.message;
            savedPayment.failedAt = new Date();
            savedPayment.updatedAt = new Date();
            await savedPayment.save();
        }

        throw error;
    }
}

async function createCashPayment({ orderId, amount }) {
    const transactionId = createCashTransactionId(orderId);
    const payment = new Payment({
        orderId,
        amount,
        method: PAYMENT_METHODS.CASH,
        transactionId,
        status: PAYMENT_STATUS.PAID,
        paidAt: new Date()
    });

    const savedPayment = await payment.save();

    try {
        await updateOrderStatus(orderId, {
            status: ORDER_STATUS.PAID,
            paymentMethod: PAYMENT_METHODS.CASH,
            paymentId: savedPayment._id.toString(),
            transactionId
        });
    } catch (error) {
        await Payment.findByIdAndDelete(savedPayment._id);
        throw error;
    }

    return savedPayment;
}

async function finalizeMomoPayment(payload) {
    assertMomoConfigured();

    if (!verifyMomoResultSignature(payload)) {
        throw createHttpError('Chu ky MoMo khong hop le.', 400);
    }

    if (payload.partnerCode !== MOMO_PARTNER_CODE) {
        throw createHttpError('partnerCode MoMo khong khop.', 400);
    }

    const payment = await Payment.findOne({
        momoOrderId: payload.orderId,
        requestId: payload.requestId,
        method: PAYMENT_METHODS.MOMO
    });

    if (!payment) {
        throw createHttpError('Khong tim thay giao dich MoMo.', 404);
    }

    if (Number(payload.amount) !== Number(payment.amount)) {
        throw createHttpError('So tien MoMo tra ve khong khop.', 400);
    }

    payment.momoNotification = payload;
    payment.resultCode = Number(payload.resultCode);
    payment.message = payload.message || '';
    payment.transactionId = payload.transId ? String(payload.transId) : payment.transactionId;
    payment.updatedAt = new Date();

    if (Number(payload.resultCode) === 0) {
        if (payment.status !== PAYMENT_STATUS.PAID) {
            await updateOrderStatus(payment.orderId, {
                status: ORDER_STATUS.PAID,
                paymentMethod: PAYMENT_METHODS.MOMO,
                paymentId: payment._id.toString(),
                transactionId: payment.transactionId
            });

            payment.status = PAYMENT_STATUS.PAID;
            payment.paidAt = new Date();
            await payment.save();
        }

        return payment;
    }

    if (payment.status !== PAYMENT_STATUS.PAID) {
        payment.status = PAYMENT_STATUS.FAILED;
        payment.failedAt = new Date();
        await payment.save();

        await updateOrderStatus(payment.orderId, {
            status: ORDER_STATUS.PAYMENT_FAILED,
            paymentMethod: PAYMENT_METHODS.MOMO,
            paymentId: payment._id.toString(),
            transactionId: payment.transactionId
        }).catch((error) => {
            console.error('Khong the danh dau don hang thanh toan that bai:', error.message);
        });
    }

    return payment;
}

async function listPayments() {
    return Payment.find().sort({ createdAt: -1 });
}

async function findPaymentByMomoOrderId(momoOrderId) {
    return Payment.findOne({ momoOrderId });
}

async function createPayment(body) {
    const { orderId, amount, method } = body;
    const normalizedAmount = Math.round(Number(amount));

    if (!orderId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || !method) {
        throw createHttpError('orderId, amount va method la bat buoc.', 400);
    }

    if (!SUPPORTED_PAYMENT_METHODS.has(method)) {
        throw createHttpError('Phuong thuc thanh toan khong duoc ho tro.', 400);
    }

    const existingPayment = await Payment.findOne({ orderId, status: PAYMENT_STATUS.PAID });
    if (existingPayment) {
        throw createHttpError('Don hang nay da duoc thanh toan.', 409);
    }

    const order = await fetchOrder(orderId);

    if (order.status === ORDER_STATUS.PAID) {
        throw createHttpError('Don hang nay da o trang thai da thanh toan.', 409);
    }

    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
        throw createHttpError(`Don hang dang o trang thai ${order.status} va khong the thanh toan tiep.`, 409);
    }

    if (Number(order.totalAmount) !== normalizedAmount) {
        throw createHttpError('So tien thanh toan khong khop tong don hang.', 400);
    }

    if (method === PAYMENT_METHODS.CASH) {
        const payment = await createCashPayment({
            orderId,
            amount: normalizedAmount
        });

        return {
            statusCode: 201,
            body: {
                message: 'Da ghi nhan thanh toan tien mat.',
                orderId,
                amount: normalizedAmount,
                method,
                transactionId: payment.transactionId,
                status: PAYMENT_STATUS.PAID,
                payment
            }
        };
    }

    const existingPendingMomoPayment = await Payment
        .findOne({ orderId, method: PAYMENT_METHODS.MOMO, status: PAYMENT_STATUS.PENDING, payUrl: { $ne: '' } })
        .sort({ createdAt: -1 });

    if (existingPendingMomoPayment?.payUrl) {
        return {
            statusCode: 200,
            body: {
                message: 'Giao dich MoMo dang cho thanh toan.',
                orderId,
                amount: normalizedAmount,
                method,
                status: PAYMENT_STATUS.PENDING,
                payment: existingPendingMomoPayment,
                payUrl: existingPendingMomoPayment.payUrl,
                shortLink: existingPendingMomoPayment.shortLink
            }
        };
    }

    const payment = await createMomoPayment({
        orderId,
        amount: normalizedAmount,
        order
    });

    return {
        statusCode: 201,
        body: {
            message: 'Da tao giao dich MoMo. Vui long tiep tuc tren cong thanh toan MoMo.',
            orderId,
            amount: normalizedAmount,
            method,
            status: PAYMENT_STATUS.PENDING,
            payment,
            payUrl: payment.payUrl,
            shortLink: payment.shortLink
        }
    };
}

module.exports = {
    createPayment,
    finalizeMomoPayment,
    findPaymentByMomoOrderId,
    listPayments
};
