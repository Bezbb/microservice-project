const { isDatabaseReady } = require('../db/mongo');

function ensureDatabaseReady(_req, res, next) {
    if (!isDatabaseReady()) {
        return res.status(503).json({ error: 'User service chua ket noi database.' });
    }

    return next();
}

module.exports = {
    ensureDatabaseReady
};
