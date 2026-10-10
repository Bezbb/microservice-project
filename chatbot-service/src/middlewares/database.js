const { isDatabaseReady } = require('../db/mongo');

function ensureDatabaseReady(_req, res, next) {
    if (!isDatabaseReady()) {
        return res.status(503).json({
            error: 'Chatbot service database chua san sang. Vui long thu lai sau vai giay.'
        });
    }

    return next();
}

module.exports = {
    ensureDatabaseReady
};
