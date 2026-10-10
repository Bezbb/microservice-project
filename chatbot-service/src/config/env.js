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

const PORT = Number(process.env.PORT || 3006);
const MONGODB_URI = process.env.CHATBOT_MONGODB_URI || 'mongodb://chatbot-db:27017/revo_chatbot_db';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'change-this-long-random-token';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const CORS_ORIGINS = parseCsv(process.env.CORS_ORIGINS);

module.exports = {
    PORT,
    MONGODB_URI,
    PRODUCT_SERVICE_URL,
    INTERNAL_SERVICE_TOKEN,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    CORS_ORIGINS
};
