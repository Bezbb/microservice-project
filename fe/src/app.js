const express = require('express');
const http = require('http');
const https = require('https');
const { API_BASE_URL, API_PROXY_TARGET, publicDir } = require('./config/env');
const pageRoutes = require('./routes/pages');

function proxyToApiGateway(req, res) {
    if (!API_PROXY_TARGET) {
        res.status(502).json({ error: 'API proxy target is not configured.' });
        return;
    }

    const targetUrl = new URL(req.originalUrl, API_PROXY_TARGET);
    const client = targetUrl.protocol === 'https:' ? https : http;
    const headers = { ...req.headers, host: targetUrl.host };

    const proxyReq = client.request(targetUrl, {
        method: req.method,
        headers
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
        console.error('Frontend API proxy error:', error.message);

        if (!res.headersSent) {
            res.status(502).json({ error: 'API gateway is unavailable.' });
        } else {
            res.end();
        }
    });

    req.pipe(proxyReq);
}

function createApp() {
    const app = express();

    app.get('/js/env.js', (_req, res) => {
        res.type('application/javascript');
        res.set('Cache-Control', 'no-store');
        res.send(`window.AppConfig=${JSON.stringify({ API_BASE_URL })};window.__API_BASE__=window.AppConfig.API_BASE_URL;`);
    });

    app.use(['/api', '/uploads'], proxyToApiGateway);
    app.use(express.static(publicDir));
    app.use('/', pageRoutes);

    return app;
}

module.exports = {
    app: createApp()
};
