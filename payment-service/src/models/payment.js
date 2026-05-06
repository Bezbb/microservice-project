const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: String,
    momoOrderId: String,
    requestId: String,
    amount: Number,
    method: String,
    transactionId: String,
    status: String,
    payUrl: String,
    shortLink: String,
    resultCode: Number,
    message: String,
    momoResponse: mongoose.Schema.Types.Mixed,
    momoNotification: mongoose.Schema.Types.Mixed,
    paidAt: Date,
    failedAt: Date,
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
