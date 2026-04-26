const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3005;
const SECRET_KEY = 'mysecretkey';

const users = [
    {
        id: 1,
        username: 'admin',
        password: '123',
        role: 'admin',
        hoTen: 'Quản trị viên'
    },
    {
        id: 2,
        username: 'user',
        password: '123',
        role: 'user',
        hoTen: 'Người dùng'
    }
];

app.get('/', (req, res) => {
    res.send('User Service đang chạy');
});

app.get('/health', (req, res) => {
    res.json({ service: 'user-service', status: 'ok' });
});

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: 'username và password là bắt buộc.'
            });
        }

        const user = users.find(
            (u) => u.username === username && u.password === password
        );

        if (!user) {
            return res.status(401).json({
                message: 'Sai tài khoản hoặc mật khẩu.'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                hoTen: user.hoTen
            },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Đăng nhập thành công.',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                hoTen: user.hoTen
            }
        });
    } catch (error) {
        res.status(500).json({
            message: 'Không thể đăng nhập.'
        });
    }
});

app.get('/api/profile', (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ message: 'Thiếu token.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, SECRET_KEY);

        res.json({
            message: 'Lấy thông tin người dùng thành công.',
            user: decoded
        });
    } catch (error) {
        res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
});

app.listen(PORT, () => {
    console.log(`User Service đang chạy tại cổng ${PORT}`);
});