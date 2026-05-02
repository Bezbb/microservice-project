const express = require('express');
const cors = require('cors');
const path = require('path');
const { uploadPath } = require('./utils/uploads');
const { ensureDatabaseReady } = require('./middlewares/database');
const productRoutes = require('./routes/products');
const internalProductRoutes = require('./routes/internalProducts');
const { isDatabaseReady } = require('./db/mongo');

function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, '../public')));
    app.use('/uploads', express.static(uploadPath));
    app.use('/api', ensureDatabaseReady);

    app.use('/api/internal/products/orders', internalProductRoutes);
    app.use('/api/products', productRoutes);

    app.get('/health', (_req, res) => {
        res.status(isDatabaseReady() ? 200 : 503).json({
            status: isDatabaseReady() ? 'ok' : 'degraded',
            service: 'product-service',
            databaseReady: isDatabaseReady()
        });
    });

    app.get('/', (_req, res) => {
        res.send('Product Service dang chay.');
    });

    return app;
}

module.exports = {
    app: createApp()
};
