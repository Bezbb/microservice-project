const mongoose = require('mongoose');
const { USER_ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, default: USER_ROLES.CUSTOMER },
    provider: { type: String, default: 'local' },
    googleId: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    authToken: String,
    resetPasswordTokenHash: String,
    resetPasswordExpiresAt: Date,
    lastLoginAt: Date,
    passwordChangedAt: Date,
    createdAt: { type: Date, default: Date.now }
}, { collection: 'users' });

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
