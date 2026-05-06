const Order = require('../models/order');
const {
    ALLOWED_ORDER_STATUSES,
    INVENTORY_STATE,
    ORDER_STATUS
} = require('../config/constants');
const { ORDER_PAYMENT_TIMEOUT_MS } = require('../config/env');
const { createHttpError } = require('../utils/errors');
const {
    confirmOrderInventory,
    prepareOrderInventory,
    releaseOrderInventory
} = require('./productInventoryService');

const DELIVERY_WINDOW_DAYS = 7;
const DELIVERY_WINDOW_MS = DELIVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function parsePositiveInteger(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.floor(parsed);
}

function normalizeOrderItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    const quantitiesByProduct = new Map();

    for (const item of items) {
        const productId = String(item?.productId || item?.id || '').trim();
        const quantity = parsePositiveInteger(item?.quantity);

        if (!productId || quantity === null) {
            continue;
        }

        quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity);
    }

    return [...quantitiesByProduct.entries()].map(([productId, quantity]) => ({
        productId,
        quantity
    }));
}

function normalizeCustomerInfo(customerInfo = {}) {
    return {
        fullName: String(customerInfo.fullName || '').trim(),
        phone: String(customerInfo.phone || '').trim(),
        address: String(customerInfo.address || '').trim(),
        note: String(customerInfo.note || '').trim()
    };
}

function validateRequestedStatus(status) {
    const normalizedStatus = String(status || '').trim();

    if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
        throw createHttpError('Trang thai don hang khong hop le.', 400);
    }

    return normalizedStatus;
}

function ensureStatusTransitionAllowed(order, nextStatus) {
    if (order.status === nextStatus) {
        return;
    }

    if (order.status === ORDER_STATUS.PAID && nextStatus === ORDER_STATUS.PENDING_PAYMENT) {
        throw createHttpError('Khong the dua don hang da thanh toan ve trang thai cho thanh toan.', 409);
    }

    if (
        (order.status === ORDER_STATUS.CANCELLED || order.status === ORDER_STATUS.PAYMENT_FAILED)
        && nextStatus !== order.status
    ) {
        throw createHttpError('Don hang da dong trang thai va khong the thay doi them.', 409);
    }

    if (order.status === ORDER_STATUS.PAID && nextStatus === ORDER_STATUS.PAYMENT_FAILED) {
        throw createHttpError('Don hang da thanh toan khong the danh dau thanh toan that bai.', 409);
    }
}

function isReleaseStatus(status) {
    return status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.PAYMENT_FAILED;
}

async function syncInventoryForStatus(order, nextStatus) {
    if (nextStatus === ORDER_STATUS.PAID) {
        if (order.inventoryState === INVENTORY_STATE.RELEASED) {
            throw createHttpError('Don hang da duoc huy va ton kho da hoan lai.', 409);
        }

        if (order.inventoryState !== INVENTORY_STATE.CONFIRMED) {
            await confirmOrderInventory(order.items);
            return INVENTORY_STATE.CONFIRMED;
        }

        return order.inventoryState;
    }

    if (isReleaseStatus(nextStatus)) {
        if (order.inventoryState !== INVENTORY_STATE.RELEASED) {
            await releaseOrderInventory(order.items, {
                decrementSoldCount: order.inventoryState === INVENTORY_STATE.CONFIRMED
            });

            return INVENTORY_STATE.RELEASED;
        }

        return order.inventoryState;
    }

    return order.inventoryState;
}

function getOrderExpirationDate(baseDate = new Date()) {
    return new Date(baseDate.getTime() + ORDER_PAYMENT_TIMEOUT_MS);
}

function getEstimatedDeliveryDate(orderDate = new Date()) {
    return new Date(orderDate.getTime() + DELIVERY_WINDOW_MS);
}

async function createOrder(body, user) {
    const items = normalizeOrderItems(body.items);
    const customerInfo = normalizeCustomerInfo(body.customerInfo);
    let preparedInventory = null;

    if (!user.userId || !user.email || !user.fullName) {
        throw createHttpError('Ban can dang nhap de tao don hang.', 401);
    }

    if (!items.length) {
        throw createHttpError('Don hang phai co it nhat mot san pham hop le.', 400);
    }

    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.address) {
        throw createHttpError('Thong tin nguoi nhan hang chua day du.', 400);
    }

    try {
        preparedInventory = await prepareOrderInventory(items);
        const orderedAt = new Date();

        const newOrder = new Order({
            user,
            items: preparedInventory.items,
            customerInfo,
            totalAmount: Number(preparedInventory.totalAmount) || 0,
            status: ORDER_STATUS.PENDING_PAYMENT,
            inventoryState: INVENTORY_STATE.RESERVED,
            inventoryUpdatedAt: orderedAt,
            expiresAt: getOrderExpirationDate(orderedAt),
            statusUpdatedAt: orderedAt,
            thoiGian: orderedAt,
            ngayGiaoDuKien: getEstimatedDeliveryDate(orderedAt)
        });

        return newOrder.save();
    } catch (error) {
        if (preparedInventory?.items?.length) {
            try {
                await releaseOrderInventory(preparedInventory.items);
            } catch (releaseError) {
                console.error('Rollback ton kho that bai sau khi tao don hang loi:', releaseError);
            }
        }

        throw error;
    }
}

async function listOrders(query) {
    const filters = {};
    const userId = String(query.userId || '').trim();
    const status = String(query.status || '').trim();

    if (userId) {
        filters['user.userId'] = userId;
    }

    if (status) {
        filters.status = status;
    }

    return Order.find(filters).sort({ thoiGian: -1 });
}

async function listOrdersForUser(userId) {
    return Order.find({ 'user.userId': userId }).sort({ thoiGian: -1 });
}

async function findOrderById(orderId) {
    return Order.findById(orderId);
}

async function updateOrderStatus(orderId, body) {
    const order = await Order.findById(orderId);

    if (!order) {
        throw createHttpError('Khong tim thay don hang de cap nhat.', 404);
    }

    const status = validateRequestedStatus(body.status);
    ensureStatusTransitionAllowed(order, status);

    const nextInventoryState = await syncInventoryForStatus(order, status);

    order.status = status;
    order.inventoryState = nextInventoryState;
    order.inventoryUpdatedAt = new Date();
    order.statusUpdatedAt = new Date();
    order.inventorySyncError = '';

    if (status === ORDER_STATUS.CANCELLED) {
        order.cancelledReason = String(body.cancelledReason || body.reason || '').trim() || 'manual';
    }

    if (body.paymentMethod) {
        order.paymentMethod = body.paymentMethod;
    }

    if (body.paymentId) {
        order.paymentId = body.paymentId;
    }

    if (body.transactionId) {
        order.transactionId = body.transactionId;
    }

    if (status === ORDER_STATUS.PENDING_PAYMENT && body.expiresAt) {
        const requestedExpiresAt = new Date(body.expiresAt);

        if (Number.isFinite(requestedExpiresAt.getTime()) && requestedExpiresAt > new Date()) {
            order.expiresAt = requestedExpiresAt;
        }
    }

    await order.save();
    return order;
}

async function deleteOrder(orderId) {
    const order = await Order.findById(orderId);

    if (!order) {
        throw createHttpError('Khong tim thay don hang de xoa.', 404);
    }

    if (order.inventoryState !== INVENTORY_STATE.RELEASED) {
        await releaseOrderInventory(order.items, {
            decrementSoldCount: order.inventoryState === INVENTORY_STATE.CONFIRMED
        });
    }

    const deletedOrder = order.toObject();
    await order.deleteOne();

    return deletedOrder;
}

module.exports = {
    createOrder,
    deleteOrder,
    findOrderById,
    listOrders,
    listOrdersForUser,
    syncInventoryForStatus,
    updateOrderStatus
};
