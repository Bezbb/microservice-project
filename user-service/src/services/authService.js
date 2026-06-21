const crypto = require('crypto');
const User = require('../models/user');
const { USER_ROLES } = require('../config/constants');
const {
    FRONTEND_URL,
    GOOGLE_AUTH_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_TOKEN_URL,
    GOOGLE_USERINFO_URL,
    GOOGLE_STATE_SECRET,
    PASSWORD_RESET_TTL_MINUTES
} = require('../config/env');
const {
    createAuthToken,
    createRandomToken,
    hashPassword,
    hashToken,
    verifyPassword
} = require('../utils/crypto');
const { normalizeEmail, sanitizeUser } = require('../utils/users');
const { createHttpError } = require('../utils/errors');
const { sendPasswordResetEmail } = require('./emailService');

function validateEmail(email) {
    return /.+@.+\..+/.test(email);
}

function normalizeNextPath(path) {
    const value = String(path || '/').trim();

    if (!value || /^https?:\/\//i.test(value) || value.startsWith('//')) {
        return '/';
    }

    const normalized = value.startsWith('/')
        ? value
        : `/${value.replace(/^\.?\//, '')}`;

    if (/(^|\/)(login|register|auth-callback|reset-password)\.html/i.test(normalized)) {
        return '/';
    }

    return normalized;
}

function buildFrontendUrl(pathname, params = {}) {
    const url = new URL(pathname, FRONTEND_URL);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
}

function createSignedState(next) {
    const payload = Buffer.from(JSON.stringify({
        next: normalizeNextPath(next),
        issuedAt: Date.now()
    })).toString('base64url');
    const signature = crypto
        .createHmac('sha256', GOOGLE_STATE_SECRET)
        .update(payload)
        .digest('base64url');

    return `${payload}.${signature}`;
}

function safeEqualText(left, right) {
    const leftBuffer = Buffer.from(String(left || ''));
    const rightBuffer = Buffer.from(String(right || ''));

    return leftBuffer.length === rightBuffer.length
        && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function readSignedState(state) {
    const [payload, signature] = String(state || '').split('.');

    if (!payload || !signature) {
        return '/';
    }

    const expectedSignature = crypto
        .createHmac('sha256', GOOGLE_STATE_SECRET)
        .update(payload)
        .digest('base64url');

    if (!safeEqualText(signature, expectedSignature)) {
        return '/';
    }

    try {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        const ageMs = Date.now() - Number(parsed.issuedAt || 0);

        if (ageMs < 0 || ageMs > 15 * 60 * 1000) {
            return '/';
        }

        return normalizeNextPath(parsed.next);
    } catch (error) {
        return '/';
    }
}

function getGoogleLoginUrl(next) {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_AUTH_URL || !GOOGLE_REDIRECT_URI) {
        throw createHttpError('Đăng nhập Google chưa được cấu hình.', 503);
    }

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        state: createSignedState(next)
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function fetchJson(url, options, fallbackMessage) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw createHttpError(payload.error_description || payload.error || fallbackMessage, 502);
    }

    return payload;
}

async function fetchGoogleProfile(code) {
    if (!GOOGLE_TOKEN_URL || !GOOGLE_USERINFO_URL) {
        throw createHttpError('Google OAuth endpoint chua duoc cau hinh.', 503);
    }

    const tokenPayload = await fetchJson(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    }, 'Không thể xác thực với Google.');

    if (!tokenPayload.access_token) {
        throw createHttpError('Google không trả về access token hợp lệ.', 502);
    }

    const profile = await fetchJson(GOOGLE_USERINFO_URL, {
        headers: {
            Authorization: `Bearer ${tokenPayload.access_token}`
        }
    }, 'Không thể lấy thông tin tài khoản Google.');

    const email = normalizeEmail(profile.email);

    if (!profile.sub || !email || !validateEmail(email)) {
        throw createHttpError('Tài khoản Google thiếu email hợp lệ.', 400);
    }

    if (profile.email_verified === false || profile.email_verified === 'false') {
        throw createHttpError('Email Google chưa được xác minh.', 400);
    }

    return {
        googleId: String(profile.sub),
        email,
        fullName: String(profile.name || profile.given_name || email.split('@')[0]).trim(),
        avatarUrl: String(profile.picture || '').trim()
    };
}

async function loginWithGoogleCallback(query = {}) {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        throw createHttpError('Đăng nhập Google chưa được cấu hình.', 503);
    }

    const code = String(query.code || '').trim();
    const next = readSignedState(query.state);

    if (!code) {
        throw createHttpError('Google không trả về mã xác thực.', 400);
    }

    const profile = await fetchGoogleProfile(code);
    let user = await User.findOne({ googleId: profile.googleId });

    if (!user) {
        user = await User.findOne({ email: profile.email });

        if (user?.googleId && user.googleId !== profile.googleId) {
            throw createHttpError('Email này đã liên kết với một tài khoản Google khác.', 409);
        }
    }

    if (!user) {
        const credentials = hashPassword(createRandomToken(32));

        user = await User.create({
            fullName: profile.fullName,
            email: profile.email,
            passwordHash: credentials.passwordHash,
            passwordSalt: credentials.passwordSalt,
            role: USER_ROLES.CUSTOMER,
            provider: 'google',
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl
        });
    } else {
        user.googleId = user.googleId || profile.googleId;
        user.avatarUrl = profile.avatarUrl || user.avatarUrl;
        user.fullName = user.fullName || profile.fullName;

        if (user.provider === 'local') {
            user.provider = 'local_google';
        }
    }

    user.authToken = createAuthToken();
    user.lastLoginAt = new Date();
    await user.save();

    return {
        token: user.authToken,
        user: sanitizeUser(user),
        next
    };
}

async function registerUser(body) {
    const fullName = String(body.fullName || '').trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!fullName || !email || !password) {
        throw createHttpError('Họ tên, email và mật khẩu là bắt buộc.', 400);
    }

    if (!validateEmail(email)) {
        throw createHttpError('Email không hợp lệ.', 400);
    }

    if (password.length < 6) {
        throw createHttpError('Mật khẩu phải có ít nhất 6 ký tự.', 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw createHttpError('Email này đã được đăng ký.', 409);
    }

    const credentials = hashPassword(password);
    const authToken = createAuthToken();
    const user = await User.create({
        fullName,
        email,
        passwordHash: credentials.passwordHash,
        passwordSalt: credentials.passwordSalt,
        role: USER_ROLES.CUSTOMER,
        provider: 'local',
        authToken,
        lastLoginAt: new Date()
    });

    return {
        token: authToken,
        user: sanitizeUser(user)
    };
}

async function loginUser(body) {
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!email || !password) {
        throw createHttpError('Email và mật khẩu là bắt buộc.', 400);
    }

    const user = await User.findOne({ email });

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        throw createHttpError('Email hoặc mật khẩu không đúng.', 401);
    }

    user.authToken = createAuthToken();
    user.lastLoginAt = new Date();
    await user.save();

    return {
        token: user.authToken,
        user: sanitizeUser(user)
    };
}

async function logoutUser(user) {
    user.authToken = null;
    await user.save();
}

async function requestPasswordReset(body = {}) {
    const email = normalizeEmail(body.email);

    if (!email || !validateEmail(email)) {
        throw createHttpError('Vui lòng nhập email hợp lệ.', 400);
    }

    const user = await User.findOne({ email });

    if (!user) {
        return { emailSent: false, delivered: false };
    }

    const rawToken = createRandomToken(32);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

    user.resetPasswordTokenHash = hashToken(rawToken);
    user.resetPasswordExpiresAt = expiresAt;
    await user.save();

    const resetLink = buildFrontendUrl('/reset-password.html', {
        email,
        token: rawToken
    });
    let mailResult;
    try {
        mailResult = await sendPasswordResetEmail({
            to: email,
            fullName: user.fullName,
            resetLink,
            expiresAt
        });
    } catch (error) {
        console.error('[PASSWORD RESET] Khong the gui email dat lai mat khau:', error.message);
        throw createHttpError('Không thể gửi email đặt lại mật khẩu. Vui lòng kiểm tra SMTP_USER và SMTP_PASS.', 502);
    }

    return {
        emailSent: true,
        delivered: Boolean(mailResult.delivered)
    };
}

async function resetPassword(body = {}) {
    const email = normalizeEmail(body.email);
    const token = String(body.token || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !token || !newPassword) {
        throw createHttpError('Email, mã đặt lại và mật khẩu mới là bắt buộc.', 400);
    }

    if (!validateEmail(email)) {
        throw createHttpError('Email không hợp lệ.', 400);
    }

    if (newPassword.length < 6) {
        throw createHttpError('Mật khẩu mới phải có ít nhất 6 ký tự.', 400);
    }

    const user = await User.findOne({
        email,
        resetPasswordTokenHash: hashToken(token),
        resetPasswordExpiresAt: { $gt: new Date() }
    });

    if (!user) {
        throw createHttpError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 400);
    }

    const credentials = hashPassword(newPassword);
    user.passwordHash = credentials.passwordHash;
    user.passwordSalt = credentials.passwordSalt;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    user.authToken = null;
    user.passwordChangedAt = new Date();

    if (user.provider === 'google') {
        user.provider = 'local_google';
    }

    await user.save();

    return sanitizeUser(user);
}

async function updateCurrentUser(user, body = {}) {
    const updates = {};
    const fullName = body.fullName === undefined ? undefined : String(body.fullName || '').trim();
    const email = body.email === undefined ? undefined : normalizeEmail(body.email);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = body.newPassword === undefined ? undefined : String(body.newPassword || '');

    if (fullName !== undefined) {
        if (!fullName) {
            throw createHttpError('Họ tên không được để trống.', 400);
        }

        updates.fullName = fullName;
    }

    if (email !== undefined) {
        if (!email) {
            throw createHttpError('Email không được để trống.', 400);
        }

        if (!validateEmail(email)) {
            throw createHttpError('Email không hợp lệ.', 400);
        }

        if (email !== user.email) {
            const existingUser = await User.findOne({
                email,
                _id: { $ne: user._id }
            });

            if (existingUser) {
                throw createHttpError('Email này đã được tài khoản khác sử dụng.', 409);
            }

            updates.email = email;
        }
    }

    if (newPassword !== undefined) {
        if (!currentPassword) {
            throw createHttpError('Vui lòng nhập mật khẩu hiện tại.', 400);
        }

        if (!verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
            throw createHttpError('Mật khẩu hiện tại không đúng.', 401);
        }

        if (newPassword.length < 6) {
            throw createHttpError('Mật khẩu mới phải có ít nhất 6 ký tự.', 400);
        }

        const credentials = hashPassword(newPassword);
        updates.passwordHash = credentials.passwordHash;
        updates.passwordSalt = credentials.passwordSalt;
    }

    if (!Object.keys(updates).length) {
        throw createHttpError('Không có thay đổi hợp lệ để cập nhật.', 400);
    }

    Object.assign(user, updates);
    await user.save();

    return sanitizeUser(user);
}

module.exports = {
    getGoogleLoginUrl,
    loginWithGoogleCallback,
    registerUser,
    loginUser,
    logoutUser,
    requestPasswordReset,
    resetPassword,
    updateCurrentUser
};
