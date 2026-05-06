const User = require('../models/user');
const { USER_ROLES } = require('../config/constants');
const { createAuthToken, hashPassword, verifyPassword } = require('../utils/crypto');
const { normalizeEmail, sanitizeUser } = require('../utils/users');
const { createHttpError } = require('../utils/errors');

function validateEmail(email) {
    return /.+@.+\..+/.test(email);
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
    registerUser,
    loginUser,
    logoutUser,
    updateCurrentUser
};
