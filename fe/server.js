const express = require('express');
const path = require('path');

const app = express();
const PORT = 3004;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cart.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});

app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin-products.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-products.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend chạy tại http://localhost:${PORT}`);
});