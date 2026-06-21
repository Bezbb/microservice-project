const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./routes/payments');
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

    app.use('/api/payments', paymentRoutes);

    app.get('/', (_req, res) => {
        res.send('Payment Service dang chay');
    });

    app.get('/health', (_req, res) => {
        res.json({ service: 'payment-service', status: 'ok' });
    });

    return app;
}

module.exports = {
    app: createApp()
};
