const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-product-token';

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://payment-db:27017/revo_payment_db')
    .then(() => console.log('Payment Service da ket noi MongoDB'))
    .catch((err) => console.error('Loi ket noi MongoDB cua Payment Service:', err));

const Payment = mongoose.model('Payment', new mongoose.Schema({
    orderId: String,
    amount: Number,
    method: String,
    transactionId: String,
    status: String,
    createdAt: { type: Date, default: Date.now }
}));

async function fetchOrder(orderId) {
    const response = await fetch(`${ORDER_SERVICE_URL}/api/orders/${orderId}`, {
        headers: {
            'x-internal-service': 'payment-service',
            'x-internal-service-token': INTERNAL_SERVICE_TOKEN
        }
    });
    const result = await response.json();

    if (!response.ok) {
        const error = new Error(result.loi || result.error || 'Khong tim thay don hang de thanh toan.');
        error.statusCode = response.status === 404 ? 404 : 502;
        throw error;
    }

    return result;
}

async function markOrderAsPaid(orderId, payload) {
    const response = await fetch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-service': 'payment-service',
            'x-internal-service-token': INTERNAL_SERVICE_TOKEN
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        const error = new Error(result.loi || result.error || 'Khong the cap nhat trang thai don hang.');
        error.statusCode = response.status === 404 ? 404 : 502;
        throw error;
    }

    return result;
}

app.get('/', (req, res) => {
    res.send('Payment Service dang chay');
});

app.get('/health', (req, res) => {
    res.json({ service: 'payment-service', status: 'ok' });
});

app.get('/api/payments', async (req, res) => {
    try {
        const list = await Payment.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: 'Khong lay duoc danh sach thanh toan.' });
    }
});

app.post('/api/payments', async (req, res) => {
    try {
        const { orderId, amount, method } = req.body;
        const normalizedAmount = Number(amount);

        if (!orderId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || !method) {
            return res.status(400).json({ error: 'orderId, amount va method la bat buoc.' });
        }

        const existingPayment = await Payment.findOne({ orderId, status: 'paid' });
        if (existingPayment) {
            return res.status(409).json({ error: 'Don hang nay da duoc thanh toan.' });
        }

        const order = await fetchOrder(orderId);

        if (order.status === 'paid') {
            return res.status(409).json({ error: 'Don hang nay da o trang thai da thanh toan.' });
        }

        if (order.status !== 'pending_payment') {
            return res.status(409).json({
                error: `Don hang dang o trang thai ${order.status} va khong the thanh toan tiep.`
            });
        }

        if (Number(order.totalAmount) !== normalizedAmount) {
            return res.status(400).json({ error: 'So tien thanh toan khong khop tong don hang.' });
        }

        const transactionId = `PAY-${Date.now()}`;
        const payment = new Payment({
            orderId,
            amount: normalizedAmount,
            method,
            transactionId,
            status: 'paid'
        });

        const savedPayment = await payment.save();

        try {
            await markOrderAsPaid(orderId, {
                status: 'paid',
                paymentMethod: method,
                paymentId: savedPayment._id.toString(),
                transactionId
            });
        } catch (error) {
            await Payment.findByIdAndDelete(savedPayment._id);
            throw error;
        }

        res.status(201).json({
            message: 'Thanh toan thanh cong.',
            orderId,
            amount: normalizedAmount,
            method,
            transactionId,
            status: 'paid',
            payment: savedPayment
        });
    } catch (error) {
        console.error(error);
        res.status(error.statusCode || 500).json({ error: error.message || 'Khong the tao thanh toan.' });
    }
});

app.listen(3003, () => {
    console.log('Payment Service dang chay tai cong 3003');
});
