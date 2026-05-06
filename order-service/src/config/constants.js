const ORDER_STATUS = {
    PENDING_PAYMENT: 'pending_payment',
    PAID: 'paid',
    PAYMENT_FAILED: 'payment_failed',
    CANCELLED: 'cancelled'
};

const INVENTORY_STATE = {
    RESERVED: 'reserved',
    CONFIRMED: 'confirmed',
    RELEASED: 'released'
};

const ALLOWED_ORDER_STATUSES = new Set(Object.values(ORDER_STATUS));

module.exports = {
    ORDER_STATUS,
    INVENTORY_STATE,
    ALLOWED_ORDER_STATUSES
};
