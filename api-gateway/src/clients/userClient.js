const { USER_SERVICE_URL } = require('../config/env');

async function fetchAuthenticatedUser(authHeader) {
    const response = await fetch(`${USER_SERVICE_URL}/api/auth/me`, {
        headers: {
            Authorization: authHeader
        }
    });

    const result = await response.json().catch(() => ({}));

    return {
        ok: response.ok,
        status: response.status,
        user: result.user || null,
        error: result.error || ''
    };
}

module.exports = {
    fetchAuthenticatedUser
};
