const express = require('express');
const { publicDir } = require('./config/env');
const pageRoutes = require('./routes/pages');

function createApp() {
    const app = express();

    app.use(express.static(publicDir));
    app.use('/', pageRoutes);

    return app;
}

module.exports = {
    app: createApp()
};
