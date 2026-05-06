const { INTERNAL_SERVICE_TOKEN } = require('../config/env');

function applyCurrentUserHeaders(proxyReq, req) {
    if (!req.currentUser) {
        return;
    }

    proxyReq.setHeader('x-user-id', req.currentUser.id || '');
    proxyReq.setHeader('x-user-email', req.currentUser.email || '');
    proxyReq.setHeader('x-user-full-name', req.currentUser.fullName || '');
    proxyReq.setHeader('x-user-role', req.currentUser.role || 'customer');
}

function attachCurrentUserHeaders(req, _res, next) {
    req.headers['x-user-id'] = req.currentUser?.id || '';
    req.headers['x-user-email'] = req.currentUser?.email || '';
    req.headers['x-user-full-name'] = req.currentUser?.fullName || '';
    req.headers['x-user-role'] = req.currentUser?.role || 'customer';
    return next();
}

function attachProductServiceHeaders(req, res, next) {
    req.headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
    req.headers['x-internal-service'] = 'api-gateway';
    return attachCurrentUserHeaders(req, res, next);
}

function applyProductServiceHeaders(proxyReq, req) {
    proxyReq.setHeader('x-internal-service-token', INTERNAL_SERVICE_TOKEN);
    proxyReq.setHeader('x-internal-service', 'api-gateway');
    proxyReq.setHeader('x-user-id', '');
    proxyReq.setHeader('x-user-email', '');
    proxyReq.setHeader('x-user-full-name', '');
    proxyReq.setHeader('x-user-role', 'customer');
    applyCurrentUserHeaders(proxyReq, req);
}

module.exports = {
    applyCurrentUserHeaders,
    applyProductServiceHeaders,
    attachCurrentUserHeaders,
    attachProductServiceHeaders
};
