const express = require('express');
const cors = require('cors');
const orderRoutes = require('./routes/orders');
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

    app.use('/api/orders', orderRoutes);

    app.get('/', (_req, res) => {
        res.send('Order Service is running.');
    });

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: 'order-service' });
    });

    return app;
}

module.exports = {
    app: createApp()
};
