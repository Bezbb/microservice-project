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

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const USER_SERVICE_URL = requireEnv('USER_SERVICE_URL');
const PRODUCT_SERVICE_URL = requireEnv('PRODUCT_SERVICE_URL');
const ORDER_SERVICE_URL = requireEnv('ORDER_SERVICE_URL');
const PAYMENT_SERVICE_URL = requireEnv('PAYMENT_SERVICE_URL');
const INTERNAL_SERVICE_TOKEN = requireEnv('INTERNAL_SERVICE_TOKEN');
const CORS_ORIGINS = [...new Set([
    FRONTEND_URL,
    ...parseCsv(process.env.CORS_ORIGINS)
].filter(Boolean))];

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
