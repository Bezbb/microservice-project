const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const {
    loginUser,
    logoutUser,
    registerUser,
    updateCurrentUser
} = require('../services/authService');
const { sanitizeUser } = require('../utils/users');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const result = await registerUser(req.body);

        return res.status(201).json({
            message: 'Đăng ký thành công.',
            token: result.token,
            user: result.user
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Không thể đăng ký tài khoản.'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const result = await loginUser(req.body);

        return res.json({
            message: 'Đăng nhập thành công.',
            token: result.token,
            user: result.user
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Không thể đăng nhập.'
        });
    }
});

router.get('/me', requireAuth, async (req, res) => {
    return res.json({
        user: sanitizeUser(req.authUser)
    });
});

router.patch('/me', requireAuth, async (req, res) => {
    try {
        const user = await updateCurrentUser(req.authUser, req.body);

        return res.json({
            message: 'Cập nhật tài khoản thành công.',
            user
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Không thể cập nhật tài khoản.'
        });
    }
});

router.post('/logout', requireAuth, async (req, res) => {
    try {
        await logoutUser(req.authUser);

        return res.json({ message: 'Đăng xuất thành công.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Không thể đăng xuất.' });
    }
});

module.exports = router;
