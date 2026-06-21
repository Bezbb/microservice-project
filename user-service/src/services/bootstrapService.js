const User = require('../models/user');
const {
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_NAME
} = require('../config/env');
const { USER_ROLES } = require('../config/constants');
const { hashPassword } = require('../utils/crypto');
const { normalizeEmail } = require('../utils/users');

async function seedDefaultAdmin() {
    const email = normalizeEmail(DEFAULT_ADMIN_EMAIL);

    if (!email || !DEFAULT_ADMIN_PASSWORD) {
        throw new Error('DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD are required to seed the admin account.');
    }

    const existingAdmin = await User.findOne({ email });
    const credentials = hashPassword(DEFAULT_ADMIN_PASSWORD);

    if (!existingAdmin) {
        await User.create({
            fullName: DEFAULT_ADMIN_NAME,
            email,
            passwordHash: credentials.passwordHash,
            passwordSalt: credentials.passwordSalt,
            role: USER_ROLES.ADMIN
        });

        console.log('Da tao tai khoan admin mac dinh cho User Service');
        return;
    }

    if (existingAdmin.role !== USER_ROLES.ADMIN) {
        existingAdmin.role = USER_ROLES.ADMIN;
        await existingAdmin.save();
    }
}

module.exports = {
    seedDefaultAdmin
};
