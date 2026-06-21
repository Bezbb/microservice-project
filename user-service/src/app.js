const express = require('express');
const cors = require('cors');
const { isDatabaseReady } = require('./db/mongo');
const { ensureDatabaseReady } = require('./middlewares/database');
const { requireAdmin, requireAuth } = require('./middlewares/auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { CORS_ORIGINS } = require('./config/env');

function createCorsOptions() {
    const allowedOrigins = new Set(CORS_ORIGINS);

    return {
        origin(origin, callback) {
            if (!origin || allowedOrigins.has('*') || allowedOrigins.has(origin)) {
                callback(null, true);
                return;
            }

            callback(null, false);
        }
    };
}

function createApp() {
    const app = express();

    app.use(cors(createCorsOptions()));
    app.use(express.json());

    app.use('/api/auth', ensureDatabaseReady, authRoutes);
    app.use('/api/users', ensureDatabaseReady, requireAuth, requireAdmin, userRoutes);

    app.get('/health', (_req, res) => {
        res.status(isDatabaseReady() ? 200 : 503).json({
            status: isDatabaseReady() ? 'ok' : 'degraded',
            service: 'user-service',
            databaseReady: isDatabaseReady()
        });
    });

    app.get('/', (_req, res) => {
        res.send('User Service dang chay.');
    });

    return app;
}

module.exports = {
    app: createApp()
};
