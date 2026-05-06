const { SAFE_METHODS } = require('../config/constants');
const {
    requireAdmin,
    requireAuthenticatedForMutations,
    requireAuthenticatedUser
} = require('./auth');

function requireAdminForMutations(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    return requireAdmin(req, res, next);
}

function isProductAdminRequest(req) {
    if (!SAFE_METHODS.has(req.method)) {
        return true;
    }

    if (req.path === '/categories/manage' || req.path.startsWith('/categories/manage/')) {
        return true;
    }

    if (String(req.query?.includeDeleted || '') === 'true') {
        return true;
    }

    return false;
}

function requireProductAccess(req, res, next) {
    if (!isProductAdminRequest(req)) {
        return next();
    }

    return requireAdmin(req, res, next);
}

function requireOrderAccess(req, res, next) {
    if (req.path === '/my' || req.path.startsWith('/my/')) {
        return requireAuthenticatedUser(req, res, next);
    }

    if (req.method === 'POST') {
        return requireAuthenticatedUser(req, res, next);
    }

    return requireAdmin(req, res, next);
}

function requirePaymentAccess(req, res, next) {
    if (
        (req.method === 'GET' && req.path === '/momo/return')
        || (req.method === 'POST' && req.path === '/momo/ipn')
    ) {
        return next();
    }

    if (req.method === 'GET') {
        return requireAdmin(req, res, next);
    }

    return requireAuthenticatedForMutations(req, res, next);
}

module.exports = {
    isProductAdminRequest,
    requireAdminForMutations,
    requireOrderAccess,
    requirePaymentAccess,
    requireProductAccess
};
