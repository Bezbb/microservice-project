const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = Number(process.env.PORT || 3002);
const MONGODB_URI = process.env.ORDER_MONGODB_URI || 'mongodb://order-db:27017/revo_order_db';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-product-token';
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

app.use(cors());
app.use(express.json());

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Order Service connected to MongoDB'))
    .catch((error) => console.error('Order Service MongoDB connection error:', error));

const orderItemSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: String,
    quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const customerInfoSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    note: { type: String, default: '' }
}, { _id: false });

const userInfoSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    email: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, default: 'customer' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    user: { type: userInfoSchema, required: true },
    items: {
        type: [orderItemSchema],
        required: true,
        validate: {
            validator: (items) => Array.isArray(items) && items.length > 0,
            message: 'Order must contain at least one item.'
        }
    },
    customerInfo: { type: customerInfoSchema, required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, default: ORDER_STATUS.PENDING_PAYMENT },
    inventoryState: { type: String, default: INVENTORY_STATE.RESERVED },
    inventoryUpdatedAt: { type: Date, default: Date.now },
    paymentMethod: String,
    paymentId: String,
    transactionId: String,
    thoiGian: { type: Date, default: Date.now }
});

orderSchema.index({ 'user.userId': 1, thoiGian: -1 });
orderSchema.index({ status: 1, thoiGian: -1 });

const Order = mongoose.model('Order', orderSchema);

function parsePositiveInteger(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.floor(parsed);
}

function createHttpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
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

function normalizeRequestUser(req) {
    return {
        userId: String(req.headers['x-user-id'] || '').trim(),
        email: String(req.headers['x-user-email'] || '').trim().toLowerCase(),
        fullName: String(req.headers['x-user-full-name'] || '').trim(),
        role: String(req.headers['x-user-role'] || 'customer').trim() || 'customer'
    };
}

function hasValidRequestUser(user) {
    return Boolean(user.userId && user.email && user.fullName);
}

function isAdminRequest(user) {
    return hasValidRequestUser(user) && user.role === 'admin';
}

function hasValidInternalToken(req) {
    return String(req.headers['x-internal-service-token'] || '').trim() === INTERNAL_SERVICE_TOKEN;
}

function isTrustedInternalRequest(req) {
    return hasValidInternalToken(req) && String(req.headers['x-internal-service'] || '').trim() === 'payment-service';
}

function getInternalProductHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-internal-service': 'order-service',
        'x-internal-service-token': INTERNAL_SERVICE_TOKEN
    };
}

async function requestProductService(path, payload) {
    const response = await fetch(`${PRODUCT_SERVICE_URL}${path}`, {
        method: 'POST',
        headers: getInternalProductHeaders(),
        body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw createHttpError(
            result.error || result.message || 'Khong the dong bo ton kho voi product-service.',
            response.status === 404 ? 404 : (response.status === 409 ? 409 : 502)
        );
    }

    return result;
}

async function prepareOrderInventory(items) {
    return requestProductService('/api/internal/products/orders/prepare', { items });
}

async function releaseOrderInventory(items, options = {}) {
    return requestProductService('/api/internal/products/orders/release', {
        items,
        decrementSoldCount: options.decrementSoldCount === true
    });
}

async function confirmOrderInventory(items) {
    return requestProductService('/api/internal/products/orders/confirm', { items });
}

function isReleaseStatus(status) {
    return status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.PAYMENT_FAILED;
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

app.post('/api/orders', async (req, res) => {
    let preparedInventory = null;

    try {
        const user = normalizeRequestUser(req);
        const items = normalizeOrderItems(req.body.items);
        const customerInfo = normalizeCustomerInfo(req.body.customerInfo);

        if (!hasValidRequestUser(user)) {
            return res.status(401).json({ loi: 'Ban can dang nhap de tao don hang.' });
        }

        if (!items.length) {
            return res.status(400).json({ loi: 'Don hang phai co it nhat mot san pham hop le.' });
        }

        if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.address) {
            return res.status(400).json({ loi: 'Thong tin nguoi nhan hang chua day du.' });
        }

        preparedInventory = await prepareOrderInventory(items);

        const newOrder = new Order({
            user,
            items: preparedInventory.items,
            customerInfo,
            totalAmount: Number(preparedInventory.totalAmount) || 0,
            status: ORDER_STATUS.PENDING_PAYMENT,
            inventoryState: INVENTORY_STATE.RESERVED,
            inventoryUpdatedAt: new Date()
        });

        const savedOrder = await newOrder.save();

        return res.status(201).json({
            thongBao: 'Tao don hang thanh cong.',
            donHang: savedOrder
        });
    } catch (error) {
        if (preparedInventory?.items?.length) {
            try {
                await releaseOrderInventory(preparedInventory.items);
            } catch (releaseError) {
                console.error('Rollback ton kho that bai sau khi tao don hang loi:', releaseError);
            }
        }

        console.error(error);
        return res.status(error.statusCode || 500).json({
            loi: error.message || 'Khong the luu don hang.'
        });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);

        if (!isTrustedInternalRequest(req) && !isAdminRequest(user)) {
            return res.status(hasValidRequestUser(user) ? 403 : 401).json({
                loi: 'Ban khong co quyen xem danh sach don hang nay.'
            });
        }

        const filters = {};
        const userId = String(req.query.userId || '').trim();
        const status = String(req.query.status || '').trim();

        if (userId) {
            filters['user.userId'] = userId;
        }

        if (status) {
            filters.status = status;
        }

        const orders = await Order.find(filters).sort({ thoiGian: -1 });
        return res.json(orders);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ loi: 'Khong the lay danh sach don hang.' });
    }
});

app.get('/api/orders/my', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);

        if (!user.userId) {
            return res.status(401).json({ loi: 'Ban can dang nhap de xem don hang.' });
        }

        const orders = await Order.find({ 'user.userId': user.userId }).sort({ thoiGian: -1 });
        return res.json(orders);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ loi: 'Khong the lay danh sach don hang cua ban.' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ loi: 'Khong tim thay don hang.' });
        }

        const user = normalizeRequestUser(req);
        const canAccess = isTrustedInternalRequest(req)
            || isAdminRequest(user)
            || (hasValidRequestUser(user) && order.user?.userId === user.userId);

        if (!canAccess) {
            return res.status(hasValidRequestUser(user) ? 403 : 401).json({
                loi: 'Ban khong co quyen xem don hang nay.'
            });
        }

        return res.json(order);
    } catch (error) {
        console.error(error);
        return res.status(400).json({ loi: 'Ma don hang khong hop le.' });
    }
});

app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);

        if (!isTrustedInternalRequest(req) && !isAdminRequest(user)) {
            return res.status(hasValidRequestUser(user) ? 403 : 401).json({
                loi: 'Ban khong co quyen cap nhat trang thai don hang.'
            });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ loi: 'Khong tim thay don hang de cap nhat.' });
        }

        const status = validateRequestedStatus(req.body.status);
        ensureStatusTransitionAllowed(order, status);

        const nextInventoryState = await syncInventoryForStatus(order, status);

        order.status = status;
        order.inventoryState = nextInventoryState;
        order.inventoryUpdatedAt = new Date();

        if (req.body.paymentMethod) {
            order.paymentMethod = req.body.paymentMethod;
        }

        if (req.body.paymentId) {
            order.paymentId = req.body.paymentId;
        }

        if (req.body.transactionId) {
            order.transactionId = req.body.transactionId;
        }

        await order.save();

        return res.json({
            thongBao: 'Cap nhat trang thai don hang thanh cong.',
            donHang: order
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 400).json({
            loi: error.message || 'Khong the cap nhat trang thai don hang.'
        });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        const user = normalizeRequestUser(req);

        if (!isAdminRequest(user)) {
            return res.status(hasValidRequestUser(user) ? 403 : 401).json({
                loi: 'Chi admin moi duoc xoa don hang.'
            });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ loi: 'Khong tim thay don hang de xoa.' });
        }

        if (order.inventoryState !== INVENTORY_STATE.RELEASED) {
            await releaseOrderInventory(order.items, {
                decrementSoldCount: order.inventoryState === INVENTORY_STATE.CONFIRMED
            });
        }

        const deletedOrder = order.toObject();
        await order.deleteOne();

        return res.json({
            thongBao: 'Xoa don hang thanh cong.',
            order: deletedOrder
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 400).json({
            loi: error.message || 'Ma don hang khong hop le.'
        });
    }
});

app.get('/', (req, res) => {
    res.send('Order Service is running.');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'order-service' });
});

app.listen(PORT, () => {
    console.log(`Order Service listening on port ${PORT}`);
});
