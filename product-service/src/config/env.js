const PORT = Number(process.env.PORT || 3001);
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-product-token';
const MONGODB_URIS = [
    process.env.PRODUCT_MONGODB_URI,
    process.env.MONGODB_URI,
    'mongodb://product-db:27017/revo_product_db',
    'mongodb://localhost:27018/revo_product_db'
].filter(Boolean);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 3000);
const DB_SERVER_SELECTION_TIMEOUT_MS = Number(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || 5000);

module.exports = {
    PORT,
    INTERNAL_SERVICE_TOKEN,
    MONGODB_URIS,
    DB_RETRY_DELAY_MS,
    DB_SERVER_SELECTION_TIMEOUT_MS
};
