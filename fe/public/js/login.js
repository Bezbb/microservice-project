const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');

function setLoginMessage(message, type = 'error') {
    loginMessage.textContent = message;
    loginMessage.className = `login-message ${type}`;
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    setLoginMessage('Đang đăng nhập...', 'success');

    try {
        const response = await fetch(`${window.Auth.API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Đăng nhập thất bại.');
        }

        window.Auth.saveSession({
            token: result.token,
            user: result.user
        });

        setLoginMessage('Đăng nhập thành công. Đang chuyển trang...', 'success');

        setTimeout(() => {
            window.Auth.redirectAuthenticatedUser();
        }, 500);
    } catch (error) {
        setLoginMessage(error.message, 'error');
    }
});
