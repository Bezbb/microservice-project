const express = require('express');
const cors = require('cors');
const { CORS_ORIGINS } = require('./config/env');
const { ensureDatabaseReady } = require('./middlewares/database');
const { isDatabaseReady } = require('./db/mongo');
const chatRoutes = require('./routes/chatRoutes');

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

    app.set('trust proxy', 1);
    app.use(cors(createCorsOptions()));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.get('/health', (_req, res) => {
        res.status(isDatabaseReady() ? 200 : 503).json({
            status: isDatabaseReady() ? 'ok' : 'degraded',
            service: 'chatbot-service',
            databaseReady: isDatabaseReady()
        });
    });

    app.get('/', (_req, res) => {
        res.send('Chatbot Service dang chay.');
    });

    app.use('/api', ensureDatabaseReady);
    app.use('/api/chat', chatRoutes);

    return app;
}

module.exports = {
    app: createApp()
};
