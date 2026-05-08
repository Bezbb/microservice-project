const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { FRONTEND_URL } = require('../config/env');
const {
    getGoogleLoginUrl,
    loginUser,
    loginWithGoogleCallback,
    logoutUser,
    requestPasswordReset,
    registerUser,
    resetPassword,
    updateCurrentUser
} = require('../services/authService');
const { sanitizeUser } = require('../utils/users');

const router = express.Router();

function buildFrontendRedirect(pathname, params = {}, hashParams = {}) {
    const url = new URL(pathname, FRONTEND_URL);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });

    const hash = new URLSearchParams();
    Object.entries(hashParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            hash.set(key, value);
        }
    });

    if ([...hash.keys()].length) {
        url.hash = hash.toString();
    }

    return url.toString();
}

function redirectAuthError(res, message) {
    return res.redirect(buildFrontendRedirect('/login.html', {
        authError: message || 'Không thể đăng nhập bằng Google.'
    }));
}

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

router.get('/google', (req, res) => {
    try {
        return res.redirect(getGoogleLoginUrl(req.query.next));
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return redirectAuthError(res, error.message);
    }
});

router.get('/google/callback', async (req, res) => {
    if (req.query.error) {
        return redirectAuthError(res, String(req.query.error_description || req.query.error));
    }

    try {
        const result = await loginWithGoogleCallback(req.query);

        return res.redirect(buildFrontendRedirect('/auth-callback.html', {}, {
            token: result.token,
            next: result.next
        }));
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return redirectAuthError(res, error.statusCode ? error.message : 'Không thể đăng nhập bằng Google.');
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

router.post('/forgot-password', async (req, res) => {
    try {
        await requestPasswordReset(req.body);

        return res.json({
            message: 'Nếu email tồn tại trong hệ thống, ShopOnline đã gửi liên kết đặt lại mật khẩu.'
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Không thể gửi email đặt lại mật khẩu.'
        });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        await resetPassword(req.body);

        return res.json({
            message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.'
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error(error);
        }

        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Không thể đặt lại mật khẩu.'
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
