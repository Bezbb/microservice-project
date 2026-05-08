const authCallbackMessage = document.getElementById('auth-callback-message');

function setCallbackMessage(message, type = 'success') {
    authCallbackMessage.textContent = message;
    authCallbackMessage.className = `subtext ${type}`;
}

function normalizeNextPath(path) {
    const value = String(path || '/').trim();

    if (!value || /^https?:\/\//i.test(value) || value.startsWith('//')) {
        return '/';
    }

    const normalized = value.startsWith('/')
        ? value
        : `/${value.replace(/^\.?\//, '')}`;

    if (/(^|\/)(login|register|auth-callback|reset-password)\.html/i.test(normalized)) {
        return '/';
    }

    return normalized;
}

async function completeGoogleLogin() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    const next = normalizeNextPath(params.get('next'));

    if (!token) {
        setCallbackMessage('Không nhận được token đăng nhập từ Google.', 'error');
        return;
    }

    try {
        window.Auth.saveSession({ token });
        await window.Auth.fetchCurrentUser();
        setCallbackMessage('Đăng nhập thành công. Đang chuyển trang...', 'success');

        setTimeout(() => {
            window.location.replace(next);
        }, 500);
    } catch (error) {
        window.Auth.clearSession();
        setCallbackMessage(error.message || 'Không thể hoàn tất đăng nhập Google.', 'error');
    }
}

void completeGoogleLogin();
