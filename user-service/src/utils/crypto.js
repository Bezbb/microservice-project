const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { passwordHash, passwordSalt: salt };
}

function verifyPassword(password, salt, passwordHash) {
    const incomingHash = crypto.scryptSync(password, salt, 64);
    const storedHash = Buffer.from(passwordHash, 'hex');

    if (incomingHash.length !== storedHash.length) {
        return false;
    }

    return crypto.timingSafeEqual(incomingHash, storedHash);
}

function createAuthToken() {
    return crypto.randomBytes(48).toString('hex');
}

function createRandomToken(byteLength = 32) {
    return crypto.randomBytes(byteLength).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

module.exports = {
    hashPassword,
    verifyPassword,
    createAuthToken,
    createRandomToken,
    hashToken
};
