const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotMessage = document.getElementById('forgot-message');
const googleLoginButton = document.getElementById('google-login-button');

function setLoginMessage(message, type = 'error') {
    loginMessage.textContent = message;
    loginMessage.className = `login-message ${type}`;
}

function setForgotMessage(message, type = 'error') {
    forgotMessage.textContent = message;
    forgotMessage.className = `login-message ${type}`;
}

function getNextPath() {
    return window.Auth.getNextUrl('/');
}

function showAuthErrorFromQuery() {
    const authError = new URLSearchParams(window.location.search).get('authError');

    if (authError) {
        setLoginMessage(authError, 'error');
    }
}

googleLoginButton.addEventListener('click', (event) => {
    event.preventDefault();

    const next = encodeURIComponent(getNextPath());
    window.location.href = `${window.Auth.API_BASE}/api/auth/google?next=${next}`;
});

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

forgotPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const loginEmail = document.getElementById('login-email').value.trim();
    const emailInput = document.getElementById('forgot-email');
    const email = emailInput.value.trim() || loginEmail;

    if (!email) {
        setForgotMessage('Vui lòng nhập email đăng ký.', 'error');
        return;
    }

    emailInput.value = email;
    setForgotMessage('Đang gửi link đặt lại mật khẩu...', 'success');

    try {
        const response = await fetch(`${window.Auth.API_BASE}/api/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Không thể gửi email đặt lại mật khẩu.');
        }

        setForgotMessage(result.message || 'Nếu email tồn tại, hệ thống đã gửi link đặt lại mật khẩu.', 'success');
    } catch (error) {
        setForgotMessage(error.message, 'error');
    }
});

showAuthErrorFromQuery();
