const PORT = Number(process.env.PORT || 3003);
const MONGODB_URI = process.env.PAYMENT_MONGODB_URI
    || process.env.MONGODB_URI
    || 'mongodb://payment-db:27017/revo_payment_db';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-product-token';
const PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3004';
const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || '';
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || '';
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || '';
const MOMO_REQUEST_TYPE = process.env.MOMO_REQUEST_TYPE || 'payWithMethod';
const MOMO_REDIRECT_URL = process.env.MOMO_REDIRECT_URL || `${PUBLIC_API_BASE_URL}/api/payments/momo/return`;
const MOMO_IPN_URL = process.env.MOMO_IPN_URL || `${PUBLIC_API_BASE_URL}/api/payments/momo/ipn`;

module.exports = {
    PORT,
    MONGODB_URI,
    ORDER_SERVICE_URL,
    INTERNAL_SERVICE_TOKEN,
    FRONTEND_URL,
    MOMO_ENDPOINT,
    MOMO_PARTNER_CODE,
    MOMO_ACCESS_KEY,
    MOMO_SECRET_KEY,
    MOMO_REQUEST_TYPE,
    MOMO_REDIRECT_URL,
    MOMO_IPN_URL
};
