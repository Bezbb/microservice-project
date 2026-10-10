function decodeHeaderValue(val) {
    if (!val) return '';
    try {
        return decodeURIComponent(val);
    } catch {
        return val;
    }
}

function extractUserContext(req, _res, next) {
    const userId = (req.headers['x-user-id'] || '').trim();
    const email = (req.headers['x-user-email'] || '').trim();
    const rawFullName = (req.headers['x-user-full-name'] || '').trim();
    const fullName = decodeHeaderValue(rawFullName);
    const role = (req.headers['x-user-role'] || 'customer').trim();
    const sessionId = (req.headers['x-session-id'] || req.body?.sessionId || req.query?.sessionId || '').trim();

    req.userContext = {
        userId: userId || null,
        email: email || null,
        fullName: fullName || null,
        role,
        isAuthenticated: Boolean(userId),
        sessionId: sessionId || null
    };

    return next();
}

module.exports = {
    extractUserContext
};
