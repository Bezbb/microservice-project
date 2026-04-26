const form = document.getElementById('login-form');
const msg = document.getElementById('login-message');

if (form) {
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const text = await response.text();
            let data = {};

            try {
                data = text ? JSON.parse(text) : {};
            } catch (err) {
                throw new Error('Server không trả JSON hợp lệ: ' + text);
            }

            if (!response.ok) {
                throw new Error(data.message || 'Đăng nhập thất bại');
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            msg.style.color = 'green';
            msg.textContent = 'Đăng nhập thành công, đang chuyển trang...';

            setTimeout(() => {
                window.location.href = '/';
            }, 800);
        } catch (error) {
            msg.style.color = '#b91c1c';
            msg.textContent = error.message;
            console.error(error);
        }
    });
}