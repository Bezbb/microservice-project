const registerForm = document.getElementById('register-form');
const registerMessage = document.getElementById('register-message');

function setRegisterMessage(message, type = 'error') {
    registerMessage.textContent = message;
    registerMessage.className = `login-message ${type}`;
}

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
        setRegisterMessage('Mật khẩu xác nhận không khớp.', 'error');
        return;
    }

    setRegisterMessage('Đang tạo tài khoản...', 'success');

    try {
        const response = await fetch(`${window.Auth.API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullName,
                email,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Đăng ký thất bại.');
        }

        window.Auth.saveSession({
            token: result.token,
            user: result.user
        });

        setRegisterMessage('Đăng ký thành công. Đang chuyển trang...', 'success');

        setTimeout(() => {
            window.Auth.redirectAuthenticatedUser();
        }, 500);
    } catch (error) {
        setRegisterMessage(error.message, 'error');
    }
});
