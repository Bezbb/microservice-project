function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function sanitizeUser(user) {
    return {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        provider: user.provider || 'local',
        avatarUrl: user.avatarUrl || null,
        lastLoginAt: user.lastLoginAt || null,
        createdAt: user.createdAt
    };
}

module.exports = {
    normalizeEmail,
    sanitizeUser
};
