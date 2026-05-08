const PORT = Number(process.env.PORT || 3000);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3004';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3005';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-product-token';
const CORS_ORIGINS = [
    FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
];

module.exports = {
    PORT,
    FRONTEND_URL,
    USER_SERVICE_URL,
    PRODUCT_SERVICE_URL,
    ORDER_SERVICE_URL,
    PAYMENT_SERVICE_URL,
    INTERNAL_SERVICE_TOKEN,
    CORS_ORIGINS
};
