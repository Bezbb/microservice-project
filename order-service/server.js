const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://order-db:27017/revo_order_db')
    .then(() => console.log('Order Service da ket noi MongoDB thanh cong'))
    .catch((err) => console.error('Loi ket noi MongoDB cua Order Service:', err));

const Order = mongoose.model('Order', new mongoose.Schema({
    sanPhamId: String,
    tenSanPham: String,
    giaTien: Number,
    soLuong: Number,
    thoiGian: { type: Date, default: Date.now }
}));

app.post('/api/orders', async (req, res) => {
    try {
        const donHangMoi = new Order(req.body);
        const donHangDaLuu = await donHangMoi.save();

        console.log('Da luu don hang vao MongoDB:', donHangDaLuu);
        res.status(201).json({
            thongBao: 'Đặt hàng thành công và đã lưu vào cơ sở dữ liệu.',
            donHang: donHangDaLuu
        });
    } catch (error) {
        res.status(500).json({ loi: 'Không thể lưu đơn hàng.' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const danhSach = await Order.find();
        res.json(danhSach);
    } catch (error) {
        res.status(500).json({ loi: 'Không thể lấy danh sách đơn hàng.' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ loi: 'Không tìm thấy đơn hàng.' });
        }
        res.json(order);
    } catch (error) {
        res.status(400).json({ loi: 'Mã đơn hàng không hợp lệ.' });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({ loi: 'Không tìm thấy đơn hàng để xóa.' });
        }
        res.json({ thongBao: 'Xóa đơn hàng thành công.', order });
    } catch (error) {
        res.status(400).json({ loi: 'Mã đơn hàng không hợp lệ.' });
    }
});

app.get('/', (req, res) => {
    res.send('Order Service đang chạy. Hãy gọi /api/orders để lấy danh sách.');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'order-service' });
});

app.listen(3002, () => {
    console.log('Order Service dang chay tai cong 3002');
});