const crypto = require('crypto');
const {
    FRONTEND_URL,
    MOMO_ACCESS_KEY,
    MOMO_ENDPOINT,
    MOMO_IPN_URL,
    MOMO_PARTNER_CODE,
    MOMO_REDIRECT_URL,
    MOMO_REQUEST_TYPE,
    MOMO_SECRET_KEY
} = require('../config/env');
const { createHttpError } = require('../utils/errors');

function assertMomoConfigured() {
    if (!MOMO_ENDPOINT || !MOMO_REDIRECT_URL || !MOMO_IPN_URL || !MOMO_PARTNER_CODE || !MOMO_ACCESS_KEY || !MOMO_SECRET_KEY) {
        throw createHttpError('Chua cau hinh day du bien moi truong MoMo.', 500);
    }
}

function signMomoPayload(rawSignature) {
    return crypto
        .createHmac('sha256', MOMO_SECRET_KEY)
        .update(rawSignature)
        .digest('hex');
}

function buildMomoCreateSignature(payload) {
    return [
        `accessKey=${MOMO_ACCESS_KEY}`,
        `amount=${payload.amount}`,
        `extraData=${payload.extraData}`,
        `ipnUrl=${payload.ipnUrl}`,
        `orderId=${payload.orderId}`,
        `orderInfo=${payload.orderInfo}`,
        `partnerCode=${payload.partnerCode}`,
        `redirectUrl=${payload.redirectUrl}`,
        `requestId=${payload.requestId}`,
        `requestType=${payload.requestType}`
    ].join('&');
}

function buildMomoResultSignature(payload) {
    return [
        `accessKey=${MOMO_ACCESS_KEY}`,
        `amount=${payload.amount || ''}`,
        `extraData=${payload.extraData || ''}`,
        `message=${payload.message || ''}`,
        `orderId=${payload.orderId || ''}`,
        `orderInfo=${payload.orderInfo || ''}`,
        `orderType=${payload.orderType || ''}`,
        `partnerCode=${payload.partnerCode || ''}`,
        `payType=${payload.payType || ''}`,
        `requestId=${payload.requestId || ''}`,
        `responseTime=${payload.responseTime || ''}`,
        `resultCode=${payload.resultCode ?? ''}`,
        `transId=${payload.transId || ''}`
    ].join('&');
}

function verifyMomoResultSignature(payload) {
    if (!payload.signature) {
        return false;
    }

    const expectedSignature = signMomoPayload(buildMomoResultSignature(payload));
    const actualSignature = String(payload.signature);

    if (expectedSignature.length !== actualSignature.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(actualSignature)
    );
}

function createMomoOrderId(orderId) {
    return `${orderId}-${Date.now()}`;
}

function createMomoRequestId(orderId) {
    return `REQ-${orderId}-${Date.now()}`;
}

function createMomoCreatePayload({ orderId, momoOrderId, requestId, amount, order }) {
    const orderInfo = `Thanh toan don hang ${orderId}`;
    const extraData = Buffer.from(JSON.stringify({ orderId })).toString('base64');
    const createPayload = {
        partnerCode: MOMO_PARTNER_CODE,
        requestType: MOMO_REQUEST_TYPE,
        ipnUrl: MOMO_IPN_URL,
        redirectUrl: MOMO_REDIRECT_URL,
        orderId: momoOrderId,
        amount,
        lang: 'vi',
        orderInfo,
        requestId,
        extraData,
        autoCapture: true,
        items: (order.items || []).map((item) => ({
            id: String(item.productId || item.id || ''),
            name: item.name || 'San pham',
            price: Number(item.price) || 0,
            quantity: Math.max(1, Number(item.quantity) || 1),
            totalPrice: (Number(item.price) || 0) * Math.max(1, Number(item.quantity) || 1),
            currency: 'VND'
        })),
        userInfo: {
            name: order.customerInfo?.fullName || '',
            phoneNumber: order.customerInfo?.phone || ''
        }
    };

    createPayload.signature = signMomoPayload(buildMomoCreateSignature(createPayload));
    return createPayload;
}

function createFrontendResultUrl(status, payment, params = {}) {
    const url = new URL('/payment-result.html', FRONTEND_URL);
    url.searchParams.set('status', status);

    if (payment?.orderId) {
        url.searchParams.set('orderId', payment.orderId);
    }

    if (payment?.transactionId || params.transId) {
        url.searchParams.set('transactionId', payment?.transactionId || params.transId);
    }

    if (params.message || payment?.message) {
        url.searchParams.set('message', params.message || payment.message);
    }

    return url.toString();
}

async function callMomoCreatePayment(payload) {
    const response = await fetch(MOMO_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw createHttpError(result.message || 'Khong the ket noi cong thanh toan MoMo.', 502);
    }

    return result;
}

module.exports = {
    assertMomoConfigured,
    callMomoCreatePayment,
    createFrontendResultUrl,
    createMomoCreatePayload,
    createMomoOrderId,
    createMomoRequestId,
    verifyMomoResultSignature
};
