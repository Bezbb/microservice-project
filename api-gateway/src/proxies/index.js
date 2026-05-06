const { createProxyMiddleware } = require('http-proxy-middleware');
const {
    INTERNAL_SERVICE_TOKEN,
    ORDER_SERVICE_URL,
    PAYMENT_SERVICE_URL,
    PRODUCT_SERVICE_URL,
    USER_SERVICE_URL
} = require('../config/env');
const {
    applyCurrentUserHeaders,
    applyProductServiceHeaders
} = require('../middlewares/headers');

const uploadsStaticProxy = createProxyMiddleware({
    target: PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/uploads${path}`
});

const productProxy = createProxyMiddleware({
    target: PRODUCT_SERVICE_URL,
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
    target: ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api/orders${path}`,
    on: {
        proxyReq(proxyReq, req) {
            applyCurrentUserHeaders(proxyReq, req);
        }
    }
});

const paymentProxy = createProxyMiddleware({
    target: PAYMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api/payments${path}`,
    on: {
        proxyReq(proxyReq, req) {
            applyCurrentUserHeaders(proxyReq, req);
        }
    }
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

module.exports = {
    authProxy,
    orderProxy,
    paymentProxy,
    productProxy,
    uploadsStaticProxy,
    userProxy
};
