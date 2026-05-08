const PAYMENT_METHODS = {
    MOMO: 'momo',
    CASH: 'cash'
};

const PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded'
};

const ORDER_STATUS = {
    PENDING_PAYMENT: 'pending_payment',
    PAID: 'paid',
    CONFIRMED: 'confirmed',
    SHIPPING: 'shipping',
    DELIVERED: 'delivered',
    RETURNED: 'returned',
    PAYMENT_FAILED: 'payment_failed',
    CANCELLED: 'cancelled'
};

const SUPPORTED_PAYMENT_METHODS = new Set(Object.values(PAYMENT_METHODS));

module.exports = {
    PAYMENT_METHODS,
    PAYMENT_STATUS,
    ORDER_STATUS,
    SUPPORTED_PAYMENT_METHODS
};
