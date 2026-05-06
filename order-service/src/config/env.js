function getPositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PORT = Number(process.env.PORT || 3002);
const MONGODB_URI = process.env.ORDER_MONGODB_URI || 'mongodb://order-db:27017/revo_order_db';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-product-token';
const ORDER_PAYMENT_TIMEOUT_MINUTES = getPositiveNumber(process.env.ORDER_PAYMENT_TIMEOUT_MINUTES, 15);
const ORDER_EXPIRATION_SWEEP_INTERVAL_MS = Math.max(
    5000,
    getPositiveNumber(process.env.ORDER_EXPIRATION_SWEEP_INTERVAL_MS, 60000)
);
const ORDER_PAYMENT_TIMEOUT_MS = Math.max(1, ORDER_PAYMENT_TIMEOUT_MINUTES) * 60 * 1000;

module.exports = {
    PORT,
    MONGODB_URI,
    PRODUCT_SERVICE_URL,
    INTERNAL_SERVICE_TOKEN,
    ORDER_PAYMENT_TIMEOUT_MINUTES,
    ORDER_EXPIRATION_SWEEP_INTERVAL_MS,
    ORDER_PAYMENT_TIMEOUT_MS
};
