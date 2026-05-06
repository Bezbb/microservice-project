const { INTERNAL_SERVICE_TOKEN, PRODUCT_SERVICE_URL } = require('../config/env');
const { createHttpError } = require('../utils/errors');

function getInternalProductHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-internal-service': 'order-service',
        'x-internal-service-token': INTERNAL_SERVICE_TOKEN
    };
}

async function requestProductService(path, payload) {
    const response = await fetch(`${PRODUCT_SERVICE_URL}${path}`, {
        method: 'POST',
        headers: getInternalProductHeaders(),
        body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw createHttpError(
            result.error || result.message || 'Khong the dong bo ton kho voi product-service.',
            response.status === 404 ? 404 : (response.status === 409 ? 409 : 502)
        );
    }

    return result;
}

async function prepareOrderInventory(items) {
    return requestProductService('/api/internal/products/orders/prepare', { items });
}

async function releaseOrderInventory(items, options = {}) {
    return requestProductService('/api/internal/products/orders/release', {
        items,
        decrementSoldCount: options.decrementSoldCount === true
    });
}

async function confirmOrderInventory(items) {
    return requestProductService('/api/internal/products/orders/confirm', { items });
}

module.exports = {
    prepareOrderInventory,
    releaseOrderInventory,
    confirmOrderInventory
};
