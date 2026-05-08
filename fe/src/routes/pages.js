const express = require('express');
const path = require('path');
const { pagesDir } = require('../config/env');

const router = express.Router();

function sendPage(pageName) {
    return (_req, res) => {
        res.sendFile(path.join(pagesDir, pageName));
    };
}

router.get('/', sendPage('index.html'));
router.get('/index.html', sendPage('index.html'));
router.get('/cart.html', sendPage('cart.html'));
router.get('/categories.html', sendPage('categories.html'));
router.get('/payment.html', sendPage('payment.html'));
router.get('/payment-result.html', sendPage('payment-result.html'));
router.get('/login.html', sendPage('login.html'));
router.get('/register.html', sendPage('register.html'));
router.get('/auth-callback.html', sendPage('auth-callback.html'));
router.get('/reset-password.html', sendPage('reset-password.html'));
router.get('/account.html', sendPage('account.html'));
router.get('/admin-products.html', sendPage('admin-products.html'));

module.exports = router;
