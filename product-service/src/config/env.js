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

const PORT = Number(process.env.PORT || 3001);
const INTERNAL_SERVICE_TOKEN = requireEnv('INTERNAL_SERVICE_TOKEN');
const MONGODB_URIS = [
    process.env.PRODUCT_MONGODB_URI,
    process.env.MONGODB_URI
].filter(Boolean);
if (!MONGODB_URIS.length) {
    throw new Error('PRODUCT_MONGODB_URI or MONGODB_URI is required');
}
const CORS_ORIGINS = parseCsv(process.env.CORS_ORIGINS);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 3000);
const DB_SERVER_SELECTION_TIMEOUT_MS = Number(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || 5000);

module.exports = {
    PORT,
    INTERNAL_SERVICE_TOKEN,
    MONGODB_URIS,
    CORS_ORIGINS,
    DB_RETRY_DELAY_MS,
    DB_SERVER_SELECTION_TIMEOUT_MS
};
