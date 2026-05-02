const { INTERNAL_SERVICE_TOKEN } = require('../config/env');
const { normalizeText } = require('../utils/text');

function buildActorFromHeaders(req) {
    return {
        userId: normalizeText(req.headers['x-user-id'], 64),
        email: normalizeText(req.headers['x-user-email'], 160).toLowerCase(),
        fullName: normalizeText(req.headers['x-user-full-name'], 160),
        role: normalizeText(req.headers['x-user-role'], 30).toLowerCase() || 'customer'
    };
}

function getInternalServiceName(req) {
    return normalizeText(req.headers['x-internal-service'], 60).toLowerCase();
}

function buildInternalActor(req) {
    const serviceName = getInternalServiceName(req) || 'internal-service';

    return {
        userId: serviceName,
        email: `${serviceName}@internal.local`,
        fullName: serviceName
    };
}

function hasValidInternalToken(req) {
    return String(req.headers['x-internal-service-token'] || '') === INTERNAL_SERVICE_TOKEN;
}

function isTrustedGatewayRequest(req) {
    return hasValidInternalToken(req) && getInternalServiceName(req) === 'api-gateway';
}

function requireTrustedService(allowedServices) {
    const services = allowedServices instanceof Set
        ? allowedServices
        : new Set(allowedServices || []);

    return (req, res, next) => {
        const serviceName = getInternalServiceName(req);

        if (!hasValidInternalToken(req) || !services.has(serviceName)) {
            return res.status(403).json({ error: 'Yeu cau noi bo khong hop le.' });
        }

        req.internalActor = buildInternalActor(req);
        return next();
    };
}

function isAdminActor(actor) {
    return Boolean(actor.userId && actor.role === 'admin');
}

function requireTrustedAdmin(req, res, next) {
    const actor = buildActorFromHeaders(req);

    if (!isTrustedGatewayRequest(req)) {
        return res.status(403).json({ error: 'Khong duoc phep truy cap truc tiep product-service.' });
    }

    if (!isAdminActor(actor)) {
        return res.status(403).json({ error: 'Chi admin moi duoc phep thuc hien thao tac nay.' });
    }

    req.requestActor = actor;
    return next();
}

function canAdminIncludeDeleted(req) {
    const actor = buildActorFromHeaders(req);
    return isTrustedGatewayRequest(req) && isAdminActor(actor) && String(req.query.includeDeleted || '') === 'true';
}

module.exports = {
    buildActorFromHeaders,
    getInternalServiceName,
    buildInternalActor,
    hasValidInternalToken,
    isTrustedGatewayRequest,
    requireTrustedService,
    isAdminActor,
    requireTrustedAdmin,
    canAdminIncludeDeleted
};
