const { INTERNAL_SERVICE_TOKEN } = require('../config/env');

function normalizeRequestUser(req) {
    return {
        userId: String(req.headers['x-user-id'] || '').trim(),
        email: String(req.headers['x-user-email'] || '').trim().toLowerCase(),
        fullName: String(req.headers['x-user-full-name'] || '').trim(),
        role: String(req.headers['x-user-role'] || 'customer').trim() || 'customer'
    };
}

function hasValidRequestUser(user) {
    return Boolean(user.userId && user.email && user.fullName);
}

function isAdminRequest(user) {
    return hasValidRequestUser(user) && user.role === 'admin';
}

function hasValidInternalToken(req) {
    return String(req.headers['x-internal-service-token'] || '').trim() === INTERNAL_SERVICE_TOKEN;
}

function isTrustedInternalRequest(req) {
    return hasValidInternalToken(req) && String(req.headers['x-internal-service'] || '').trim() === 'payment-service';
}

module.exports = {
    normalizeRequestUser,
    hasValidRequestUser,
    isAdminRequest,
    hasValidInternalToken,
    isTrustedInternalRequest
};
