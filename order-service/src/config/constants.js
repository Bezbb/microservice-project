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

const INVENTORY_STATE = {
    RESERVED: 'reserved',
    CONFIRMED: 'confirmed',
    RELEASED: 'released'
};

const ALLOWED_ORDER_STATUSES = new Set(Object.values(ORDER_STATUS));
const ORDER_STATUS_TRANSITIONS = new Map([
    [ORDER_STATUS.PENDING_PAYMENT, new Set([
        ORDER_STATUS.PAID,
        ORDER_STATUS.PAYMENT_FAILED,
        ORDER_STATUS.CANCELLED
    ])],
    [ORDER_STATUS.PAID, new Set([
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.CANCELLED
    ])],
    [ORDER_STATUS.CONFIRMED, new Set([
        ORDER_STATUS.SHIPPING,
        ORDER_STATUS.CANCELLED
    ])],
    [ORDER_STATUS.SHIPPING, new Set([
        ORDER_STATUS.DELIVERED
    ])],
    [ORDER_STATUS.DELIVERED, new Set([
        ORDER_STATUS.RETURNED
    ])],
    [ORDER_STATUS.PAYMENT_FAILED, new Set()],
    [ORDER_STATUS.CANCELLED, new Set()],
    [ORDER_STATUS.RETURNED, new Set()]
]);

const CUSTOMER_CANCELLABLE_ORDER_STATUSES = new Set([
    ORDER_STATUS.PENDING_PAYMENT
]);

module.exports = {
    ORDER_STATUS,
    INVENTORY_STATE,
    ALLOWED_ORDER_STATUSES,
    CUSTOMER_CANCELLABLE_ORDER_STATUSES,
    ORDER_STATUS_TRANSITIONS
};
