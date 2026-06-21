function getPositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

const PORT = Number(process.env.PORT || 3002);
const MONGODB_URI = process.env.ORDER_MONGODB_URI || process.env.MONGODB_URI || requireEnv('ORDER_MONGODB_URI');
const PRODUCT_SERVICE_URL = requireEnv('PRODUCT_SERVICE_URL');
const INTERNAL_SERVICE_TOKEN = requireEnv('INTERNAL_SERVICE_TOKEN');
const CORS_ORIGINS = parseCsv(process.env.CORS_ORIGINS);
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
    CORS_ORIGINS,
    ORDER_PAYMENT_TIMEOUT_MINUTES,
    ORDER_EXPIRATION_SWEEP_INTERVAL_MS,
    ORDER_PAYMENT_TIMEOUT_MS
};
