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

function createRefundTransactionId(orderId) {
    return `REFUND-${orderId}-${Date.now()}`;
}

const PAID_ORDER_STATUSES = new Set([
    ORDER_STATUS.PAID,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.SHIPPING,
    ORDER_STATUS.DELIVERED
]);

const REPAIRABLE_PENDING_ORDER_STATUSES = new Set([
    ORDER_STATUS.PENDING_PAYMENT
]);

function isReturnedOrder(order) {
    return order?.status === ORDER_STATUS.RETURNED;
}

function isRefundablePayment(payment) {
    return payment?.status === PAYMENT_STATUS.PAID;
}

function normalizeRefundAmount(payment, value) {
    if (value === undefined || value === null || value === '') {
        return Number(payment.amount) || 0;
    }

    const amount = Math.round(Number(value));

    if (!Number.isFinite(amount) || amount <= 0) {
        throw createHttpError('So tien hoan khong hop le.', 400);
    }

    if (amount > Number(payment.amount || 0)) {
        throw createHttpError('So tien hoan khong duoc lon hon so tien da thanh toan.', 400);
    }

    return amount;
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

    if (payment.status === PAYMENT_STATUS.REFUNDED) {
        return payment;
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

async function refundPayment(paymentId, body = {}) {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
        throw createHttpError('Khong tim thay giao dich thanh toan.', 404);
    }

    if (payment.status === PAYMENT_STATUS.REFUNDED) {
        throw createHttpError('Giao dich nay da duoc ghi nhan hoan tien.', 409);
    }

    if (!isRefundablePayment(payment)) {
        throw createHttpError('Chi co the hoan tien giao dich da thanh toan.', 409);
    }

    const order = await fetchOrder(payment.orderId);

    if (!isReturnedOrder(order)) {
        throw createHttpError('Chi co the hoan tien sau khi don hang da duoc chuyen sang trang thai hoan tra.', 409);
    }

    const refundAmount = normalizeRefundAmount(payment, body.amount);
    const refundTransactionId = createRefundTransactionId(payment.orderId);

    payment.status = PAYMENT_STATUS.REFUNDED;
    payment.refundAmount = refundAmount;
    payment.refundReason = String(body.reason || '').trim() || 'admin_refund';
    payment.refundTransactionId = refundTransactionId;
    payment.refundHandledBy = String(body.handledBy || '').trim() || 'admin';
    payment.refundNote = String(body.note || '').trim();
    payment.refundedAt = new Date();
    payment.updatedAt = new Date();

    await payment.save();

    return {
        message: 'Da ghi nhan hoan tien cho don hang.',
        payment,
        order,
        refund: {
            amount: refundAmount,
            transactionId: refundTransactionId
        }
    };
}

function createReconciliationIssue(payment, order, code, message, repairable = false) {
    return {
        code,
        message,
        repairable,
        paymentId: payment._id.toString(),
        orderId: payment.orderId,
        paymentStatus: payment.status,
        orderStatus: order?.status || 'missing',
        amount: payment.amount,
        method: payment.method,
        transactionId: payment.transactionId || payment.momoOrderId || '',
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
    };
}

async function repairPaidPaymentOrder(payment) {
    return updateOrderStatus(payment.orderId, {
        status: ORDER_STATUS.PAID,
        paymentMethod: payment.method,
        paymentId: payment._id.toString(),
        transactionId: payment.transactionId || payment.momoOrderId || ''
    });
}

async function repairFailedPaymentOrder(payment) {
    return updateOrderStatus(payment.orderId, {
        status: ORDER_STATUS.PAYMENT_FAILED,
        paymentMethod: payment.method,
        paymentId: payment._id.toString(),
        transactionId: payment.transactionId || payment.momoOrderId || ''
    });
}

async function maybeRepairIssue(issue, payment, repair) {
    if (!repair || !issue.repairable) {
        return false;
    }

    if (issue.code === 'paid_payment_waiting_order') {
        await repairPaidPaymentOrder(payment);
        return true;
    }

    if (issue.code === 'failed_payment_waiting_order') {
        await repairFailedPaymentOrder(payment);
        return true;
    }

    return false;
}

async function reconcilePayments(options = {}) {
    const repair = options.repair === true;
    const pendingThresholdMs = Math.max(
        5 * 60 * 1000,
        Number(options.pendingThresholdMs) || 30 * 60 * 1000
    );
    const payments = await Payment.find().sort({ createdAt: -1 });
    const issues = [];
    const repaired = [];

    for (const payment of payments) {
        let order;

        try {
            order = await fetchOrder(payment.orderId);
        } catch (error) {
            issues.push({
                code: 'order_not_found',
                message: error.message || 'Khong tim thay don hang tuong ung voi thanh toan.',
                repairable: false,
                paymentId: payment._id.toString(),
                orderId: payment.orderId,
                paymentStatus: payment.status,
                orderStatus: 'missing',
                amount: payment.amount,
                method: payment.method,
                transactionId: payment.transactionId || payment.momoOrderId || '',
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt
            });
            continue;
        }

        let issue = null;

        if (payment.status === PAYMENT_STATUS.PAID) {
            if (PAID_ORDER_STATUSES.has(order.status)) {
                continue;
            }

            if (order.status === ORDER_STATUS.RETURNED) {
                issue = createReconciliationIssue(
                    payment,
                    order,
                    'refund_required',
                    'Don hang da hoan tra nhung giao dich chua duoc ghi nhan hoan tien.'
                );
            } else if (REPAIRABLE_PENDING_ORDER_STATUSES.has(order.status)) {
                issue = createReconciliationIssue(
                    payment,
                    order,
                    'paid_payment_waiting_order',
                    'Thanh toan da thanh cong nhung don hang van cho thanh toan.',
                    true
                );
            } else {
                issue = createReconciliationIssue(
                    payment,
                    order,
                    'paid_payment_order_mismatch',
                    'Thanh toan da thanh cong nhung trang thai don hang khong phu hop.'
                );
            }
        } else if (payment.status === PAYMENT_STATUS.FAILED) {
            if (order.status === ORDER_STATUS.PENDING_PAYMENT) {
                issue = createReconciliationIssue(
                    payment,
                    order,
                    'failed_payment_waiting_order',
                    'Thanh toan that bai nhung don hang van cho thanh toan.',
                    true
                );
            } else if (PAID_ORDER_STATUSES.has(order.status)) {
                issue = createReconciliationIssue(
                    payment,
                    order,
                    'failed_payment_paid_order',
                    'Giao dich that bai nhung don hang dang o trang thai da thu tien.'
                );
            }
        } else if (payment.status === PAYMENT_STATUS.REFUNDED) {
            if (order.status !== ORDER_STATUS.RETURNED) {
                issue = createReconciliationIssue(
                    payment,
                    order,
                    'refunded_payment_order_not_returned',
                    'Thanh toan da hoan tien nhung don hang chua o trang thai hoan tra.'
                );
            }
        } else if (payment.status === PAYMENT_STATUS.PENDING) {
            const createdAt = new Date(payment.createdAt);
            const ageMs = Number.isFinite(createdAt.getTime()) ? Date.now() - createdAt.getTime() : 0;

            if (ageMs > pendingThresholdMs) {
                issue = createReconciliationIssue(
                    payment,
                    order,
                    'stale_pending_payment',
                    'Giao dich thanh toan dang cho qua thoi gian doi.'
                );
            } else if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
                issue = createReconciliationIssue(
                    payment,
                    order,
                    'pending_payment_order_mismatch',
                    'Giao dich dang cho nhung trang thai don hang khong con cho thanh toan.'
                );
            }
        }

        if (!issue) {
            continue;
        }

        try {
            if (await maybeRepairIssue(issue, payment, repair)) {
                repaired.push({
                    ...issue,
                    repaired: true
                });
                continue;
            }
        } catch (error) {
            issue.repairError = error.message || 'Khong the sua lech doi soat.';
        }

        issues.push(issue);
    }

    return {
        checked: payments.length,
        repair,
        issueCount: issues.length,
        repairedCount: repaired.length,
        issues,
        repaired
    };
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
    listPayments,
    reconcilePayments,
    refundPayment
};
