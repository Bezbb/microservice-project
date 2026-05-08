const resetPasswordForm = document.getElementById('reset-password-form');
const resetPasswordMessage = document.getElementById('reset-password-message');
const resetEmailInput = document.getElementById('reset-email');
const resetToken = new URLSearchParams(window.location.search).get('token') || '';
const resetEmail = new URLSearchParams(window.location.search).get('email') || '';

function setResetPasswordMessage(message, type = 'error') {
    resetPasswordMessage.textContent = message;
    resetPasswordMessage.className = `login-message ${type}`;
}

if (resetEmail) {
    resetEmailInput.value = resetEmail;
}

if (!resetToken) {
    setResetPasswordMessage('Link đặt lại mật khẩu thiếu mã xác thực. Vui lòng yêu cầu gửi lại email.', 'error');
}

resetPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = resetEmailInput.value.trim();
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (!resetToken) {
        setResetPasswordMessage('Link đặt lại mật khẩu không hợp lệ.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        setResetPasswordMessage('Mật khẩu xác nhận không khớp.', 'error');
        return;
    }

    setResetPasswordMessage('Đang đặt lại mật khẩu...', 'success');

    try {
        const response = await fetch(`${window.Auth.API_BASE}/api/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                token: resetToken,
                newPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Không thể đặt lại mật khẩu.');
        }

        window.Auth.clearSession();
        setResetPasswordMessage(result.message || 'Đặt lại mật khẩu thành công.', 'success');

        setTimeout(() => {
            window.location.replace('/login.html');
        }, 1000);
    } catch (error) {
        setResetPasswordMessage(error.message, 'error');
    }
});
