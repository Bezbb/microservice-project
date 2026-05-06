const { SAFE_METHODS } = require('../config/constants');
const { fetchAuthenticatedUser } = require('../clients/userClient');

async function requireAuthenticatedUser(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Vui long dang nhap de tiep tuc.' });
    }

    try {
        const authResult = await fetchAuthenticatedUser(authHeader);

        if (!authResult.ok || !authResult.user) {
            return res.status(authResult.status || 401).json({
                error: authResult.error || 'Phien dang nhap khong hop le.'
            });
        }

        req.currentUser = authResult.user;
        return next();
    } catch (error) {
        console.error('Loi xac thuc tai khoan:', error);
        return res.status(502).json({ error: 'Khong the xac thuc tai khoan.' });
    }
}

async function requireAdmin(req, res, next) {
    return requireAuthenticatedUser(req, res, () => {
        if (req.currentUser?.role !== 'admin') {
            return res.status(403).json({
                error: 'Chi admin moi duoc thuc hien thao tac nay.'
            });
        }

        return next();
    });
}

function requireAuthenticatedForMutations(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    return requireAuthenticatedUser(req, res, next);
}

module.exports = {
    requireAdmin,
    requireAuthenticatedForMutations,
    requireAuthenticatedUser
};
