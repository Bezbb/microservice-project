const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://order-db:27017/revo_order_db')
    .then(() => console.log('Order Service da ket noi MongoDB thanh cong'))
    .catch((err) => console.error('Loi ket noi MongoDB cua Order Service:', err));

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

const orderSchema = new mongoose.Schema({
    items: {
        type: [orderItemSchema],
        required: true,
        validate: {
            validator: (items) => Array.isArray(items) && items.length > 0,
            message: 'Don hang phai co it nhat mot san pham.'
        }
    },
    customerInfo: { type: customerInfoSchema, required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, default: 'pending_payment' },
    paymentMethod: String,
    paymentId: String,
    transactionId: String,
    thoiGian: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

function normalizeOrderItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map((item) => ({
            productId: String(item.productId || item.id || '').trim(),
            name: String(item.name || '').trim(),
            price: Number(item.price),
            image: item.image || '',
            quantity: Math.max(1, Number(item.quantity) || 1)
        }))
        .filter((item) => item.productId && item.name && Number.isFinite(item.price) && item.price >= 0);
}

function normalizeCustomerInfo(customerInfo = {}) {
    return {
        fullName: String(customerInfo.fullName || '').trim(),
        phone: String(customerInfo.phone || '').trim(),
        address: String(customerInfo.address || '').trim(),
        note: String(customerInfo.note || '').trim()
    };
}

app.post('/api/orders', async (req, res) => {
    try {
        const items = normalizeOrderItems(req.body.items);
        const customerInfo = normalizeCustomerInfo(req.body.customerInfo);

        if (!items.length) {
            return res.status(400).json({ loi: 'Don hang phai co it nhat mot san pham hop le.' });
        }

        if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.address) {
            return res.status(400).json({ loi: 'Thong tin nguoi nhan hang chua day du.' });
        }

        const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const donHangMoi = new Order({
            items,
            customerInfo,
            totalAmount,
            status: 'pending_payment'
        });

        const donHangDaLuu = await donHangMoi.save();

        res.status(201).json({
            thongBao: 'Tao don hang thanh cong.',
            donHang: donHangDaLuu
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ loi: 'Khong the luu don hang.' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const danhSach = await Order.find().sort({ thoiGian: -1 });
        res.json(danhSach);
    } catch (error) {
        res.status(500).json({ loi: 'Khong the lay danh sach don hang.' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ loi: 'Khong tim thay don hang.' });
        }
        res.json(order);
    } catch (error) {
        res.status(400).json({ loi: 'Ma don hang khong hop le.' });
    }
});

app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const { status, paymentMethod, paymentId, transactionId } = req.body;

        if (!status) {
            return res.status(400).json({ loi: 'Trang thai don hang la bat buoc.' });
        }

        const updateData = { status };

        if (paymentMethod) {
            updateData.paymentMethod = paymentMethod;
        }

        if (paymentId) {
            updateData.paymentId = paymentId;
        }

        if (transactionId) {
            updateData.transactionId = transactionId;
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ loi: 'Khong tim thay don hang de cap nhat.' });
        }

        res.json({
            thongBao: 'Cap nhat trang thai don hang thanh cong.',
            donHang: order
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ loi: 'Khong the cap nhat trang thai don hang.' });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({ loi: 'Khong tim thay don hang de xoa.' });
        }
        res.json({ thongBao: 'Xoa don hang thanh cong.', order });
    } catch (error) {
        res.status(400).json({ loi: 'Ma don hang khong hop le.' });
    }
});

app.get('/', (req, res) => {
    res.send('Order Service dang chay. Hay goi /api/orders de lay danh sach.');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'order-service' });
});

app.listen(3002, () => {
    console.log('Order Service dang chay tai cong 3002');
});
