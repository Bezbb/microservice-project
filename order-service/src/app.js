const express = require('express');
const cors = require('cors');
const orderRoutes = require('./routes/orders');

function createApp() {
    const app = express();

    app.use(cors());
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
