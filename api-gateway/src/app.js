const express = require('express');
const cors = require('cors');
const { FRONTEND_URL } = require('./config/env');
const { requireAdmin } = require('./middlewares/auth');
const {
    requireOrderAccess,
    requirePaymentAccess,
    requireProductAccess
} = require('./middlewares/access');
const {
    attachCurrentUserHeaders,
    attachProductServiceHeaders
} = require('./middlewares/headers');
const {
    authProxy,
    orderProxy,
    paymentProxy,
    productProxy,
    uploadsStaticProxy,
    userProxy
} = require('./proxies');

function createApp() {
    const app = express();

    app.use(cors());

    app.get('/', (_req, res) => {
        res.redirect(FRONTEND_URL);
    });

    app.use('/uploads', uploadsStaticProxy);
    app.use('/api/auth', authProxy);
    app.use('/api/users', requireAdmin, userProxy);
    app.use('/api/products', requireProductAccess, attachProductServiceHeaders, productProxy);
    app.use('/api/orders', requireOrderAccess, attachCurrentUserHeaders, orderProxy);
    app.use('/api/payments', requirePaymentAccess, paymentProxy);

    return app;
}

module.exports = {
    app: createApp()
};
