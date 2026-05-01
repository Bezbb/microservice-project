const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadPath = path.join(__dirname, 'public/uploads');

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadPath));

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

const duLieuMau = [
    {
        ten: 'Bàn phím cơ Gaming RGB',
        gia: 750000,
        image: 'https://placehold.co/300x200?text=Ban+Phim+Co',
        moTa: 'Bàn phím cơ RGB, switch êm, phù hợp chơi game và làm việc.',
        danhMuc: 'Phụ kiện máy tính',
        trangThai: 'Còn hàng'
    },
    {
        ten: 'Chuột không dây Logitech',
        gia: 320000,
        image: 'https://placehold.co/300x200?text=Chuot+Khong+Day',
        moTa: 'Chuột không dây thiết kế gọn nhẹ, pin lâu.',
        danhMuc: 'Phụ kiện máy tính',
        trangThai: 'Còn hàng'
    },
    {
        ten: 'Tai nghe Bluetooth Sony',
        gia: 1250000,
        image: 'https://placehold.co/300x200?text=Tai+Nghe+Bluetooth',
        moTa: 'Tai nghe âm thanh rõ nét, chống ồn tốt.',
        danhMuc: 'Âm thanh',
        trangThai: 'Còn hàng'
    },
    {
        ten: 'Loa mini Bluetooth',
        gia: 450000,
        image: 'https://placehold.co/300x200?text=Loa+Mini',
        moTa: 'Loa mini kết nối nhanh, âm thanh sống động.',
        danhMuc: 'Âm thanh',
        trangThai: 'Còn hàng'
    },
    {
        ten: 'Màn hình LG 24 inch',
        gia: 2890000,
        image: 'https://placehold.co/300x200?text=Man+Hinh+LG',
        moTa: 'Màn hình Full HD, màu sắc đẹp, phù hợp học tập và văn phòng.',
        danhMuc: 'Màn hình',
        trangThai: 'Còn hàng'
    }
];

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

        res.json({
            imageUrl: `/uploads/${req.file.filename}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload thất bại.' });
    }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const sanPhamMoi = new Product({
            ten: req.body.ten,
            gia: Number(req.body.gia),
            image: req.file ? `/uploads/${req.file.filename}` : req.body.image,
            moTa: req.body.moTa,
            danhMuc: req.body.danhMuc,
            trangThai: req.body.trangThai || 'Còn hàng'
        });

        const sanPhamDaLuu = await sanPhamMoi.save();
        res.status(201).json(sanPhamDaLuu);
    } catch (error) {
        console.error(error);
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

app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    try {
        const updateData = {
            ten: req.body.ten,
            gia: Number(req.body.gia),
            moTa: req.body.moTa,
            danhMuc: req.body.danhMuc,
            trangThai: req.body.trangThai
        };

        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        } else if (req.body.image) {
            updateData.image = req.body.image;
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ loi: 'Không tìm thấy sản phẩm để cập nhật.' });
        }

        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(400).json({ loi: 'Không thể cập nhật sản phẩm.' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ loi: 'Không tìm thấy sản phẩm để xóa.' });
        }

        res.json({
            thongBao: 'Xóa sản phẩm thành công.',
            sanPham: product
        });
    } catch (error) {
        res.status(400).json({ loi: 'Mã sản phẩm không hợp lệ.' });
    }
});

app.get('/', (req, res) => {
    res.send('Product Service đang chạy.');
});

app.listen(3001, () => {
    console.log('Product Service dang chay tai cong 3001');
});