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

const PORT = Number(process.env.PORT || 3005);
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || '';
const DEFAULT_ADMIN_PASSWORD = requireEnv('DEFAULT_ADMIN_PASSWORD');
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'Shop Admin';
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL || '';
const CORS_ORIGINS = parseCsv(process.env.CORS_ORIGINS);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${PUBLIC_API_BASE_URL}/api/auth/google/callback`;
const GOOGLE_AUTH_URL = process.env.GOOGLE_AUTH_URL || '';
const GOOGLE_TOKEN_URL = process.env.GOOGLE_TOKEN_URL || '';
const GOOGLE_USERINFO_URL = process.env.GOOGLE_USERINFO_URL || '';
const GOOGLE_STATE_SECRET = process.env.GOOGLE_STATE_SECRET || GOOGLE_CLIENT_SECRET;
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || '';
const MONGODB_URIS = [
    process.env.USER_MONGODB_URI,
    process.env.MONGODB_URI
].filter(Boolean);
if (!MONGODB_URIS.length) {
    throw new Error('USER_MONGODB_URI or MONGODB_URI is required');
}
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 3000);
const DB_SERVER_SELECTION_TIMEOUT_MS = Number(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || 5000);

module.exports = {
    PORT,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_NAME,
    FRONTEND_URL,
    PUBLIC_API_BASE_URL,
    CORS_ORIGINS,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_AUTH_URL,
    GOOGLE_TOKEN_URL,
    GOOGLE_USERINFO_URL,
    GOOGLE_STATE_SECRET,
    PASSWORD_RESET_TTL_MINUTES,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    MONGODB_URIS,
    DB_RETRY_DELAY_MS,
    DB_SERVER_SELECTION_TIMEOUT_MS
};
