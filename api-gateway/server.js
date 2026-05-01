const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;
const USER_SERVICE_URL = 'http://user-service:3005';
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
        return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    }

    try {
        const authResult = await fetchAuthenticatedUser(authHeader);

        if (!authResult.ok || !authResult.user) {
            return res.status(authResult.status || 401).json({
                error: authResult.error || 'Phiên đăng nhập không hợp lệ.'
            });
        }

        req.currentUser = authResult.user;
        return next();
    } catch (error) {
        console.error('Loi xac thuc tai khoan:', error);
        return res.status(502).json({ error: 'Không thể xác thực tài khoản.' });
    }
}

async function requireAdmin(req, res, next) {
    try {
        await requireAuthenticatedUser(req, res, () => {
            if (req.currentUser?.role !== 'admin') {
                res.status(403).json({
                    error: 'Chỉ admin mới được thực hiện thao tác này.'
                });
                return;
            }

            next();
        });
    } catch (error) {
        console.error('Loi xac thuc admin:', error);
        res.status(502).json({ error: 'Không thể xác thực tài khoản admin.' });
    }
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

const uploadProxy = createProxyMiddleware({
    target: 'http://product-service:3001',
    changeOrigin: true,
    pathRewrite: (path) => `/api/upload${path}`
});

const uploadsStaticProxy = createProxyMiddleware({
    target: 'http://product-service:3001',
    changeOrigin: true,
    pathRewrite: (path) => `/uploads${path}`
});

const productProxy = createProxyMiddleware({
    target: 'http://product-service:3001',
    changeOrigin: true,
    pathRewrite: (path) => `/api/products${path}`
});

const orderProxy = createProxyMiddleware({
    target: 'http://order-service:3002',
    changeOrigin: true,
    pathRewrite: (path) => `/api/orders${path}`
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

app.use('/uploads', uploadsStaticProxy);
app.use('/api/auth', authProxy);
app.use('/api/products', requireAdminForMutations, productProxy);
app.use('/api/upload', requireAdminForMutations, uploadProxy);
app.use('/api/orders', requireAuthenticatedForMutations, orderProxy);
app.use('/api/payments', requireAuthenticatedForMutations, paymentProxy);

app.listen(port, () => {
    console.log(`API Gateway dang chay tai http://localhost:${port}`);
});
