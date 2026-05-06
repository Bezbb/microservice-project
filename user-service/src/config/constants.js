const USER_ROLES = {
    CUSTOMER: 'customer',
    ADMIN: 'admin'
};

const ALLOWED_USER_ROLES = new Set(Object.values(USER_ROLES));

module.exports = {
    USER_ROLES,
    ALLOWED_USER_ROLES
};
