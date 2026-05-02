const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;
const USER_SERVICE_URL = 'http://user-service:3005';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-product-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

app.use(cors());

app.get('/', (req, res) => {
    res.redirect('http://localhost:3004');
});

async function fetchAuthenticatedUser(authHeader) {
    const response = await fetch(`${USER_SERVICE_URL}/api/auth/me`, {
        headers: {
            Authorization: authHeader
        }
    });

    const result = await response.json().catch(() => ({}));

    return {
        ok: response.ok,
        status: response.status,
        user: result.user || null,
        error: result.error || ''
    };
}

async function requireAuthenticatedUser(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Vui long dang nhap de tiep tuc.' });
    }

    try {
        const authResult = await fetchAuthenticatedUser(authHeader);

        if (!authResult.ok || !authResult.user) {
            return res.status(authResult.status || 401).json({
                error: authResult.error || 'Phien dang nhap khong hop le.'
            });
        }

        req.currentUser = authResult.user;
        return next();
    } catch (error) {
        console.error('Loi xac thuc tai khoan:', error);
        return res.status(502).json({ error: 'Khong the xac thuc tai khoan.' });
    }
}

async function requireAdmin(req, res, next) {
    return requireAuthenticatedUser(req, res, () => {
        if (req.currentUser?.role !== 'admin') {
            return res.status(403).json({
                error: 'Chi admin moi duoc thuc hien thao tac nay.'
            });
        }

        return next();
    });
}

function requireAuthenticatedForMutations(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    return requireAuthenticatedUser(req, res, next);
}

function requireAdminForMutations(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    return requireAdmin(req, res, next);
}

function isProductAdminRequest(req) {
    if (!SAFE_METHODS.has(req.method)) {
        return true;
    }

    if (req.path === '/categories/manage' || req.path.startsWith('/categories/manage/')) {
        return true;
    }

    if (String(req.query?.includeDeleted || '') === 'true') {
        return true;
    }

    return false;
}

function requireProductAccess(req, res, next) {
    if (!isProductAdminRequest(req)) {
        return next();
    }

    return requireAdmin(req, res, next);
}

function requireOrderAccess(req, res, next) {
    if (req.path === '/my' || req.path.startsWith('/my/')) {
        return requireAuthenticatedUser(req, res, next);
    }

    if (req.method === 'POST') {
        return requireAuthenticatedUser(req, res, next);
    }

    return requireAdmin(req, res, next);
}

function applyCurrentUserHeaders(proxyReq, req) {
    if (!req.currentUser) {
        return;
    }

    proxyReq.setHeader('x-user-id', req.currentUser.id || '');
    proxyReq.setHeader('x-user-email', req.currentUser.email || '');
    proxyReq.setHeader('x-user-full-name', req.currentUser.fullName || '');
    proxyReq.setHeader('x-user-role', req.currentUser.role || 'customer');
}

function attachCurrentUserHeaders(req, res, next) {
    req.headers['x-user-id'] = req.currentUser?.id || '';
    req.headers['x-user-email'] = req.currentUser?.email || '';
    req.headers['x-user-full-name'] = req.currentUser?.fullName || '';
    req.headers['x-user-role'] = req.currentUser?.role || 'customer';
    return next();
}

function attachProductServiceHeaders(req, res, next) {
    req.headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
    req.headers['x-internal-service'] = 'api-gateway';
    return attachCurrentUserHeaders(req, res, next);
}

function applyProductServiceHeaders(proxyReq, req) {
    proxyReq.setHeader('x-internal-service-token', INTERNAL_SERVICE_TOKEN);
    proxyReq.setHeader('x-internal-service', 'api-gateway');
    proxyReq.setHeader('x-user-id', '');
    proxyReq.setHeader('x-user-email', '');
    proxyReq.setHeader('x-user-full-name', '');
    proxyReq.setHeader('x-user-role', 'customer');
    applyCurrentUserHeaders(proxyReq, req);
}

const uploadsStaticProxy = createProxyMiddleware({
    target: 'http://product-service:3001',
    changeOrigin: true,
    pathRewrite: (path) => `/uploads${path}`
});

const productProxy = createProxyMiddleware({
    target: 'http://product-service:3001',
    changeOrigin: true,
    headers: {
        'x-internal-service-token': INTERNAL_SERVICE_TOKEN,
        'x-internal-service': 'api-gateway'
    },
    pathRewrite: (path) => `/api/products${path}`,
    on: {
        proxyReq(proxyReq, req) {
            applyProductServiceHeaders(proxyReq, req);
        }
    }
});

const orderProxy = createProxyMiddleware({
    target: 'http://order-service:3002',
    changeOrigin: true,
    pathRewrite: (path) => `/api/orders${path}`,
    on: {
        proxyReq(proxyReq, req) {
            applyCurrentUserHeaders(proxyReq, req);
        }
    }
});

const paymentProxy = createProxyMiddleware({
    target: 'http://payment-service:3003',
    changeOrigin: true,
    pathRewrite: (path) => `/api/payments${path}`
});

const authProxy = createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api/auth${path}`
});

const userProxy = createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api/users${path}`
});

app.use('/uploads', uploadsStaticProxy);
app.use('/api/auth', authProxy);
app.use('/api/users', requireAdmin, userProxy);
app.use('/api/products', requireProductAccess, attachProductServiceHeaders, productProxy);
app.use('/api/orders', requireOrderAccess, attachCurrentUserHeaders, orderProxy);
app.use('/api/payments', requireAuthenticatedForMutations, paymentProxy);

app.listen(port, () => {
    console.log(`API Gateway dang chay tai http://localhost:${port}`);
});
