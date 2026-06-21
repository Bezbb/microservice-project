const path = require('path');

const PORT = Number(process.env.PORT || 3004);
const API_BASE_URL = String(process.env.API_BASE_URL || '').replace(/\/+$/, '');
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || '';
const publicDir = path.join(__dirname, '../../public');
const pagesDir = path.join(publicDir, 'pages');

module.exports = {
    PORT,
    API_BASE_URL,
    API_PROXY_TARGET,
    publicDir,
    pagesDir
};
