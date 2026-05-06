const { INTERNAL_SERVICE_TOKEN, ORDER_SERVICE_URL } = require('../config/env');
const { createHttpError } = require('../utils/errors');

function getOrderServiceHeaders() {
    return {
        'x-internal-service': 'payment-service',
        'x-internal-service-token': INTERNAL_SERVICE_TOKEN
    };
}

async function fetchOrder(orderId) {
    const response = await fetch(`${ORDER_SERVICE_URL}/api/orders/${orderId}`, {
        headers: getOrderServiceHeaders()
    });
    const result = await response.json();

    if (!response.ok) {
        throw createHttpError(
            result.loi || result.error || 'Khong tim thay don hang de thanh toan.',
            response.status === 404 ? 404 : 502
        );
    }

    return result;
}

async function updateOrderStatus(orderId, payload) {
    const response = await fetch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
            ...getOrderServiceHeaders(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        throw createHttpError(
            result.loi || result.error || 'Khong the cap nhat trang thai don hang.',
            response.status === 404 ? 404 : 502
        );
    }

    return result;
}

module.exports = {
    fetchOrder,
    updateOrderStatus
};
