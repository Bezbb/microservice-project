const express = require('express');
const cors = require('cors');
const { CORS_ORIGINS, FRONTEND_URL } = require('./config/env');
const { requireAdmin } = require('./middlewares/auth');
const { createRateLimiter } = require('./middlewares/rateLimit');
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

function createCorsOptions() {
    const allowedOrigins = new Set(CORS_ORIGINS);

    return {
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) {
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

    app.get('/', (_req, res) => {
        res.redirect(FRONTEND_URL);
    });

    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            service: 'api-gateway',
            allowedOrigins: CORS_ORIGINS
        });
    });

    app.use('/api/auth', createRateLimiter({
        name: 'auth',
        windowMs: 15 * 60 * 1000,
        max: 40,
        message: 'Qua nhieu yeu cau dang nhap/dang ky. Vui long thu lai sau.'
    }));
    app.use('/api/payments', createRateLimiter({
        name: 'payments',
        windowMs: 15 * 60 * 1000,
        max: 80,
        message: 'Qua nhieu yeu cau thanh toan. Vui long thu lai sau.'
    }));
    app.use('/api', createRateLimiter({
        name: 'api',
        windowMs: 15 * 60 * 1000,
        max: 900
    }));

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
