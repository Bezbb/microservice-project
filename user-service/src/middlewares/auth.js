const User = require('../models/user');
const { USER_ROLES } = require('../config/constants');

function getBearerToken(req) {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
        return '';
    }

    return authHeader.slice(7).trim();
}

async function requireAuth(req, res, next) {
    try {
        const authToken = getBearerToken(req);

        if (!authToken) {
            return res.status(401).json({ error: 'Bạn chưa đăng nhập.' });
        }

        const user = await User.findOne({ authToken });

        if (!user) {
            return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
        }

        req.authUser = user;
        return next();
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Không thể xác thực người dùng.' });
    }
}

function requireAdmin(req, res, next) {
    if (req.authUser?.role !== USER_ROLES.ADMIN) {
        return res.status(403).json({ error: 'Chi admin moi duoc phep truy cap.' });
    }

    return next();
}

module.exports = {
    getBearerToken,
    requireAuth,
    requireAdmin
};
