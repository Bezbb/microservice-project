const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = express();
const PORT = 3005;
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@shoponline.local';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'Shop Admin';
const ALLOWED_USER_ROLES = new Set(['customer', 'admin']);
const MONGODB_URIS = [
    process.env.USER_MONGODB_URI,
    process.env.MONGODB_URI,
    'mongodb://user-db:27017/revo_user_db',
    'mongodb://localhost:27021/revo_user_db'
].filter(Boolean);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 3000);
const DB_SERVER_SELECTION_TIMEOUT_MS = Number(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || 5000);

app.use(cors());
app.use(express.json());

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, default: 'customer' },
    authToken: String,
    lastLoginAt: Date,
    createdAt: { type: Date, default: Date.now }
}, { collection: 'users' });

userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function isDatabaseReady() {
    return mongoose.connection.readyState === 1;
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function sanitizeUser(user) {
    return {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt || null,
        createdAt: user.createdAt
    };
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { passwordHash, passwordSalt: salt };
}

function verifyPassword(password, salt, passwordHash) {
    const incomingHash = crypto.scryptSync(password, salt, 64);
    const storedHash = Buffer.from(passwordHash, 'hex');

    if (incomingHash.length !== storedHash.length) {
        return false;
    }

    return crypto.timingSafeEqual(incomingHash, storedHash);
}

function createAuthToken() {
    return crypto.randomBytes(48).toString('hex');
}

async function seedDefaultAdmin() {
    const email = normalizeEmail(DEFAULT_ADMIN_EMAIL);
    const existingAdmin = await User.findOne({ email });
    const credentials = hashPassword(DEFAULT_ADMIN_PASSWORD);

    if (!existingAdmin) {
        await User.create({
            fullName: DEFAULT_ADMIN_NAME,
            email,
            passwordHash: credentials.passwordHash,
            passwordSalt: credentials.passwordSalt,
            role: 'admin'
        });

        console.log('Da tao tai khoan admin mac dinh cho User Service');
        return;
    }

    if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
    }
}

function getBearerToken(req) {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
        return '';
    }

    return authHeader.slice(7).trim();
}

async function requireAuth(req, res, next) {
    try {
        const authToken = getBearerToken(req);

        if (!authToken) {
            return res.status(401).json({ error: 'Bạn chưa đăng nhập.' });
        }

        const user = await User.findOne({ authToken });

        if (!user) {
            return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
        }

        req.authUser = user;
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Không thể xác thực người dùng.' });
    }
}

function requireAdmin(req, res, next) {
    if (req.authUser?.role !== 'admin') {
        return res.status(403).json({ error: 'Chi admin moi duoc phep truy cap.' });
    }

    return next();
}

function ensureDatabaseReady(req, res, next) {
    if (!isDatabaseReady()) {
        return res.status(503).json({ error: 'User service chua ket noi database.' });
    }

    return next();
}

async function connectToMongoWithRetry() {
    while (!isDatabaseReady()) {
        for (const uri of MONGODB_URIS) {
            try {
                await mongoose.connect(uri, {
                    serverSelectionTimeoutMS: DB_SERVER_SELECTION_TIMEOUT_MS
                });

                console.log(`User Service da ket noi MongoDB thanh cong qua ${uri}`);
                await seedDefaultAdmin();
                return;
            } catch (error) {
                console.error(`Khong the ket noi MongoDB qua ${uri}:`, error.message);
            }
        }

        console.error(`User Service se thu ket noi lai sau ${DB_RETRY_DELAY_MS}ms`);
        await wait(DB_RETRY_DELAY_MS);
    }
}

mongoose.connection.on('disconnected', () => {
    console.warn('User Service bi mat ket noi MongoDB');
});

app.use('/api/auth', ensureDatabaseReady);
app.use('/api/users', ensureDatabaseReady, requireAuth, requireAdmin);

app.post('/api/auth/register', async (req, res) => {
    try {
        const fullName = String(req.body.fullName || '').trim();
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || '');

        if (!fullName || !email || !password) {
            return res.status(400).json({ error: 'Họ tên, email và mật khẩu là bắt buộc.' });
        }

        if (!/.+@.+\..+/.test(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Email này đã được đăng ký.' });
        }

        const credentials = hashPassword(password);
        const authToken = createAuthToken();

        const user = await User.create({
            fullName,
            email,
            passwordHash: credentials.passwordHash,
            passwordSalt: credentials.passwordSalt,
            role: 'customer',
            authToken,
            lastLoginAt: new Date()
        });

        res.status(201).json({
            message: 'Đăng ký thành công.',
            token: authToken,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Không thể đăng ký tài khoản.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || '');

        if (!email || !password) {
            return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc.' });
        }

        const user = await User.findOne({ email });

        if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
        }

        user.authToken = createAuthToken();
        user.lastLoginAt = new Date();
        await user.save();

        res.json({
            message: 'Đăng nhập thành công.',
            token: user.authToken,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Không thể đăng nhập.' });
    }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
    res.json({
        user: sanitizeUser(req.authUser)
    });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
    try {
        req.authUser.authToken = null;
        await req.authUser.save();

        res.json({ message: 'Đăng xuất thành công.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Không thể đăng xuất.' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const search = String(req.query.search || '').trim();
        const role = String(req.query.role || '').trim().toLowerCase();
        const filters = {};

        if (ALLOWED_USER_ROLES.has(role)) {
            filters.role = role;
        }

        if (search) {
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            filters.$or = [
                { fullName: searchRegex },
                { email: searchRegex }
            ];
        }

        const users = await User.find(filters).sort({ createdAt: -1 });
        res.json(users.map((user) => sanitizeUser(user)));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Khong the lay danh sach nguoi dung.' });
    }
});

app.patch('/api/users/:id', async (req, res) => {
    try {
        const fullName = req.body.fullName === undefined ? undefined : String(req.body.fullName || '').trim();
        const role = req.body.role === undefined ? undefined : String(req.body.role || '').trim().toLowerCase();
        const updates = {};

        if (fullName !== undefined) {
            if (!fullName) {
                return res.status(400).json({ error: 'Ho ten nguoi dung khong duoc de trong.' });
            }

            updates.fullName = fullName;
        }

        if (role !== undefined) {
            if (!ALLOWED_USER_ROLES.has(role)) {
                return res.status(400).json({ error: 'Vai tro nguoi dung khong hop le.' });
            }

            updates.role = role;
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({ error: 'Khong co thay doi hop le de cap nhat.' });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'Khong tim thay nguoi dung.' });
        }

        const isSelf = String(user._id) === String(req.authUser._id);
        const isChangingAdminRole = user.role === 'admin' && updates.role && updates.role !== 'admin';

        if (isSelf && updates.role && updates.role !== 'admin') {
            return res.status(400).json({ error: 'Ban khong the tu ha quyen admin cua chinh minh.' });
        }

        if (isChangingAdminRole) {
            const adminCount = await User.countDocuments({ role: 'admin' });

            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Khong the thay doi vai tro cua admin cuoi cung.' });
            }
        }

        Object.assign(user, updates);
        await user.save();

        res.json({
            message: 'Cap nhat nguoi dung thanh cong.',
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Khong the cap nhat nguoi dung.' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'Khong tim thay nguoi dung.' });
        }

        if (String(user._id) === String(req.authUser._id)) {
            return res.status(400).json({ error: 'Ban khong the xoa chinh tai khoan admin dang dang nhap.' });
        }

        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });

            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Khong the xoa admin cuoi cung cua he thong.' });
            }
        }

        const deletedUser = sanitizeUser(user);
        await user.deleteOne();

        res.json({
            message: 'Xoa nguoi dung thanh cong.',
            user: deletedUser
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Khong the xoa nguoi dung.' });
    }
});

app.get('/health', (req, res) => {
    res.status(isDatabaseReady() ? 200 : 503).json({
        status: isDatabaseReady() ? 'ok' : 'degraded',
        service: 'user-service',
        databaseReady: isDatabaseReady()
    });
});

app.get('/', (req, res) => {
    res.send('User Service dang chay.');
});

async function startServer() {
    await connectToMongoWithRetry();

    app.listen(PORT, () => {
        console.log(`User Service dang chay tai cong ${PORT}`);
    });
}

startServer().catch((error) => {
    console.error('Khong the khoi dong User Service:', error);
    process.exit(1);
});
