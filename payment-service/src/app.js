const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./routes/payments');

function createApp() {
    const app = express();

    app.use(cors());
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
