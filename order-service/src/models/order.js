const mongoose = require('mongoose');
const { ORDER_PAYMENT_TIMEOUT_MS } = require('../config/env');
const { INVENTORY_STATE, ORDER_STATUS } = require('../config/constants');

const DELIVERY_WINDOW_DAYS = 7;
const DELIVERY_WINDOW_MS = DELIVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + ORDER_PAYMENT_TIMEOUT_MS)
    },
    statusUpdatedAt: { type: Date, default: Date.now },
    cancelledReason: String,
    cancelledBy: String,
    shippingStartedAt: Date,
    deliveredAt: Date,
    returnedAt: Date,
    returnReason: String,
    inventorySyncError: String,
    thoiGian: { type: Date, default: Date.now },
    ngayGiaoDuKien: {
        type: Date,
        default: () => new Date(Date.now() + DELIVERY_WINDOW_MS)
    }
});

orderSchema.index({ 'user.userId': 1, thoiGian: -1 });
orderSchema.index({ status: 1, thoiGian: -1 });
orderSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
