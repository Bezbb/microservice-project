const express = require('express');
const fs = require('fs');
const path = require('path');
const { pagesDir } = require('../config/env');

const router = express.Router();
const pageFiles = fs.readdirSync(pagesDir)
    .filter((fileName) => fileName.endsWith('.html'))
    .sort();

function sendPage(pageName) {
    return (_req, res) => {
        res.sendFile(path.join(pagesDir, pageName));
    };
}

router.get('/', sendPage('index.html'));

pageFiles.forEach((pageFile) => {
    router.get(`/${pageFile}`, sendPage(pageFile));
});

module.exports = router;
