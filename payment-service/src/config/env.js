function parseCsv(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function requireEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is required`);
    }

    return value;
}

const PORT = Number(process.env.PORT || 3003);
const MONGODB_URI = process.env.PAYMENT_MONGODB_URI
    || process.env.MONGODB_URI
    || requireEnv('PAYMENT_MONGODB_URI');
const ORDER_SERVICE_URL = requireEnv('ORDER_SERVICE_URL');
const INTERNAL_SERVICE_TOKEN = requireEnv('INTERNAL_SERVICE_TOKEN');
const PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL || '';
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const CORS_ORIGINS = parseCsv(process.env.CORS_ORIGINS);
const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT || '';
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
    CORS_ORIGINS,
    MOMO_ENDPOINT,
    MOMO_PARTNER_CODE,
    MOMO_ACCESS_KEY,
    MOMO_SECRET_KEY,
    MOMO_REQUEST_TYPE,
    MOMO_REDIRECT_URL,
    MOMO_IPN_URL
};
