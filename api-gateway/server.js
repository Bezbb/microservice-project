const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;
const SECRET_KEY = 'mysecretkey';

app.use(cors());
app.use(express.json());

/* =========================
   AUTH MIDDLEWARE
========================= */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'Thiếu token.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
}

function authorizeAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
}

/* =========================
   ROOT
========================= */
app.get('/', (req, res) => {
    res.redirect('http://localhost:3004');
});

/* =========================
   USER SERVICE
========================= */
app.use('/api/login', createProxyMiddleware({
    target: 'http://user-service:3005',
    changeOrigin: true
}));

app.use('/api/profile', authenticate, createProxyMiddleware({
    target: 'http://user-service:3005',
    changeOrigin: true
}));

/* =========================
   PRODUCT SERVICE
========================= */
app.use('/api/products',
    (req, res, next) => {
        // GET: ai cũng xem được
        if (req.method === 'GET') return next();

        // POST / PUT / DELETE: cần admin
        authenticate(req, res, () => {
            authorizeAdmin(req, res, next);
        });
    },
    createProxyMiddleware({
        target: 'http://product-service:3001/api/products',
        changeOrigin: true,
        pathRewrite: {
            '^/api/products': ''
        }
    })
);

/* upload ảnh */
app.use('/api/upload',
    authenticate,
    authorizeAdmin,
    createProxyMiddleware({
        target: 'http://product-service:3001/api/upload',
        changeOrigin: true,
        pathRewrite: {
            '^/api/upload': ''
        }
    })
);

/* =========================
   ORDER SERVICE
========================= */
app.use('/api/orders',
    authenticate,
    createProxyMiddleware({
        target: 'http://order-service:3002/api/orders',
        changeOrigin: true,
        pathRewrite: {
            '^/api/orders': ''
        }
    })
);

/* =========================
   PAYMENT SERVICE
========================= */
app.use('/api/payments',
    authenticate,
    createProxyMiddleware({
        target: 'http://payment-service:3003/api/payments',
        changeOrigin: true,
        pathRewrite: {
            '^/api/payments': ''
        }
    })
);

/* =========================
   START SERVER
========================= */
app.listen(port, () => {
    console.log(`🚀 API Gateway đang chạy tại: http://localhost:${port}`);
});