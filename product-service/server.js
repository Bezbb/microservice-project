const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uploadPath = path.join(__dirname, 'public/uploads');

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

const productSchema = new mongoose.Schema({
    ten: { type: String, required: true },
    gia: { type: Number, required: true },
    image: String,
    moTa: String,
    danhMuc: String,
    trangThai: { type: String, default: 'Còn hàng' }
}, { collection: 'products' });

const Product = mongoose.model('Product', productSchema);
const seedProducts = async () => {
    const count = await Product.countDocuments();
    if (count === 0) {
        await Product.insertMany(duLieuMau);
        console.log('Đã thêm dữ liệu mẫu cho Product Service');
    } else {
        console.log('Database đã có dữ liệu, bỏ qua bước thêm mẫu');
    }
};

mongoose.connect('mongodb://product-db:27017/revo_product_db')
    .then(async () => {
        console.log('Product Service da ket noi MongoDB thanh cong');
        await seedProducts();
    })
    .catch((err) => console.error('Loi ket noi MongoDB cua Product Service:', err));

app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Chưa chọn file ảnh.' });
        }

        const filePath = `/uploads/${req.file.filename}`;
        res.json({ imageUrl: filePath });
    } catch (error) {
        res.status(500).json({ error: 'Upload thất bại.' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const sanPhamMoi = new Product(req.body);
        const sanPhamDaLuu = await sanPhamMoi.save();
        res.status(201).json(sanPhamDaLuu);
    } catch (error) {
        res.status(500).json({ loi: 'Không thể tạo sản phẩm.' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const danhSach = await Product.find();
        res.json(danhSach);
    } catch (error) {
        res.status(500).json({ loi: 'Không thể lấy danh sách sản phẩm.' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ loi: 'Không tìm thấy sản phẩm.' });
        }
        res.json(product);
    } catch (error) {
        res.status(400).json({ loi: 'Mã sản phẩm không hợp lệ.' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!product) {
            return res.status(404).json({ loi: 'Không tìm thấy sản phẩm để cập nhật.' });
        }
        res.json(product);
    } catch (error) {
        res.status(400).json({ loi: 'Không thể cập nhật sản phẩm.' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ loi: 'Không tìm thấy sản phẩm để xóa.' });
        }
        res.json({ thongBao: 'Xóa sản phẩm thành công.', sanPham: product });
    } catch (error) {
        res.status(400).json({ loi: 'Mã sản phẩm không hợp lệ.' });
    }
});

app.get('/', (req, res) => {
    res.send('Product Service đang chạy. Mở /admin-products.html để quản lý sản phẩm.');
});

app.listen(3001, () => {
    console.log('Product Service dang chay tai cong 3001');
});