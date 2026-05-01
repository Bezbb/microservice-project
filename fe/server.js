const express = require('express');
const path = require('path');

const app = express();
const PORT = 3004;
const publicDir = path.join(__dirname, 'public');
const pagesDir = path.join(publicDir, 'pages');

app.use(express.static(publicDir));

function sendPage(pageName) {
    return (req, res) => {
        res.sendFile(path.join(pagesDir, pageName));
    };
}

app.get('/', sendPage('index.html'));
app.get('/index.html', sendPage('index.html'));
app.get('/cart.html', sendPage('cart.html'));
app.get('/payment.html', sendPage('payment.html'));
app.get('/login.html', sendPage('login.html'));
app.get('/register.html', sendPage('register.html'));
app.get('/account.html', sendPage('account.html'));
app.get('/admin-products.html', sendPage('admin-products.html'));

app.listen(PORT, () => {
    console.log(`Frontend chạy tại http://localhost:${PORT}`);
});
