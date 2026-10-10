const mongoose = require('mongoose');

const productSummarySchema = new mongoose.Schema({
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    image: { type: String, default: '' },
    category: { type: String, default: '' },
    brand: { type: String, default: '' },
    stockQuantity: { type: Number, default: 0 },
    isFlashSale: { type: Boolean, default: false }
}, { _id: false });

const referencedProductSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    image: { type: String, default: '' },
    category: { type: String, default: '' },
    brand: { type: String, default: '' },
    stockQuantity: { type: Number, default: 0 },
    isFlashSale: { type: Boolean, default: false },
    lastReferencedAt: { type: Date, default: Date.now },
    inquiryCount: { type: Number, default: 1 },
    notes: { type: String, default: '' }
}, { _id: false });

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: { type: String, required: true },
    suggestedProducts: { type: [productSummarySchema], default: [] },
    suggestedQuestions: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const conversationSchema = new mongoose.Schema({
    userId: { type: String, default: null, index: true },
    sessionId: { type: String, required: true, index: true },
    title: { type: String, default: 'Cuộc trò chuyện mới' },
    messages: { type: [messageSchema], default: [] },
    referencedProducts: { type: [referencedProductSchema], default: [] },
    lastActiveAt: { type: Date, default: Date.now }
}, {
    collection: 'conversations',
    timestamps: true
});

conversationSchema.index({ userId: 1, updatedAt: -1 });
conversationSchema.index({ sessionId: 1, updatedAt: -1 });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
