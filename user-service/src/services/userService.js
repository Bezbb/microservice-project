const User = require('../models/user');
const { ALLOWED_USER_ROLES, USER_ROLES } = require('../config/constants');
const { createHttpError } = require('../utils/errors');
const { escapeRegex } = require('../utils/text');
const { sanitizeUser } = require('../utils/users');

async function listUsers(query) {
    const search = String(query.search || '').trim();
    const role = String(query.role || '').trim().toLowerCase();
    const filters = {};

    if (ALLOWED_USER_ROLES.has(role)) {
        filters.role = role;
    }

    if (search) {
        const searchRegex = new RegExp(escapeRegex(search), 'i');
        filters.$or = [
            { fullName: searchRegex },
            { email: searchRegex }
        ];
    }

    const users = await User.find(filters).sort({ createdAt: -1 });
    return users.map((user) => sanitizeUser(user));
}

function buildUserUpdates(body) {
    const fullName = body.fullName === undefined ? undefined : String(body.fullName || '').trim();
    const role = body.role === undefined ? undefined : String(body.role || '').trim().toLowerCase();
    const updates = {};

    if (fullName !== undefined) {
        if (!fullName) {
            throw createHttpError('Ho ten nguoi dung khong duoc de trong.', 400);
        }

        updates.fullName = fullName;
    }

    if (role !== undefined) {
        if (!ALLOWED_USER_ROLES.has(role)) {
            throw createHttpError('Vai tro nguoi dung khong hop le.', 400);
        }

        updates.role = role;
    }

    if (!Object.keys(updates).length) {
        throw createHttpError('Khong co thay doi hop le de cap nhat.', 400);
    }

    return updates;
}

async function ensureAdminRoleCanChange(user, updates, authUser) {
    const isSelf = String(user._id) === String(authUser._id);
    const isChangingAdminRole = user.role === USER_ROLES.ADMIN
        && updates.role
        && updates.role !== USER_ROLES.ADMIN;

    if (isSelf && updates.role && updates.role !== USER_ROLES.ADMIN) {
        throw createHttpError('Ban khong the tu ha quyen admin cua chinh minh.', 400);
    }

    if (isChangingAdminRole) {
        const adminCount = await User.countDocuments({ role: USER_ROLES.ADMIN });

        if (adminCount <= 1) {
            throw createHttpError('Khong the thay doi vai tro cua admin cuoi cung.', 400);
        }
    }
}

async function updateUser(userId, body, authUser) {
    const updates = buildUserUpdates(body);
    const user = await User.findById(userId);

    if (!user) {
        throw createHttpError('Khong tim thay nguoi dung.', 404);
    }

    await ensureAdminRoleCanChange(user, updates, authUser);

    Object.assign(user, updates);
    await user.save();

    return sanitizeUser(user);
}

async function ensureUserCanBeDeleted(user, authUser) {
    if (String(user._id) === String(authUser._id)) {
        throw createHttpError('Ban khong the xoa chinh tai khoan admin dang dang nhap.', 400);
    }

    if (user.role === USER_ROLES.ADMIN) {
        const adminCount = await User.countDocuments({ role: USER_ROLES.ADMIN });

        if (adminCount <= 1) {
            throw createHttpError('Khong the xoa admin cuoi cung cua he thong.', 400);
        }
    }
}

async function deleteUser(userId, authUser) {
    const user = await User.findById(userId);

    if (!user) {
        throw createHttpError('Khong tim thay nguoi dung.', 404);
    }

    await ensureUserCanBeDeleted(user, authUser);

    const deletedUser = sanitizeUser(user);
    await user.deleteOne();

    return deletedUser;
}

module.exports = {
    listUsers,
    updateUser,
    deleteUser
};
