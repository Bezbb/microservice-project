const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;

app.use(cors());

app.get('/', (req, res) => {
    res.redirect('http://localhost:3004');
});

/* STATIC UPLOADS */
app.use('/uploads',
    createProxyMiddleware({
        target: 'http://product-service:3001',
        changeOrigin: true,
        pathRewrite: (path) => `/uploads${path}`
    })
);

/* PRODUCT SERVICE */
app.use('/api/products',
    createProxyMiddleware({
        target: 'http://product-service:3001',
        changeOrigin: true,
        pathRewrite: (path) => `/api/products${path}`
    })
);

/* UPLOAD IMAGE */
app.use('/api/upload',
    createProxyMiddleware({
        target: 'http://product-service:3001',
        changeOrigin: true,
        pathRewrite: (path) => `/api/upload${path}`
    })
);

/* ORDER SERVICE */
app.use('/api/orders',
    createProxyMiddleware({
        target: 'http://order-service:3002',
        changeOrigin: true,
        pathRewrite: (path) => `/api/orders${path}`
    })
);

/* PAYMENT SERVICE */
app.use('/api/payments',
    createProxyMiddleware({
        target: 'http://payment-service:3003',
        changeOrigin: true,
        pathRewrite: (path) => `/api/payments${path}`
    })
);

app.listen(port, () => {
    console.log(`API Gateway đang chạy tại http://localhost:${port}`);
});