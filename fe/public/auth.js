(() => {
    const AUTH_API_BASE = 'http://localhost:3000';
    const AUTH_TOKEN_KEY = 'authToken';
    const AUTH_USER_KEY = 'authUser';

    function parseStoredJson(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null');
        } catch (error) {
            return null;
        }
    }

    function getStoredToken() {
        return localStorage.getItem(AUTH_TOKEN_KEY) || '';
    }

    function getStoredUser() {
        return parseStoredJson(AUTH_USER_KEY);
    }

    function isAuthenticated() {
        return Boolean(getStoredToken() && getStoredUser());
    }

    function isAdmin() {
        return getStoredUser()?.role === 'admin';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCurrentRelativePath() {
        const pathname = window.location.pathname;
        const fileName = pathname.endsWith('/') ? '/' : pathname.split('/').pop();
        const normalizedPath = !fileName || fileName === 'index.html' ? '/' : fileName;
        return `${normalizedPath}${window.location.search || ''}${window.location.hash || ''}`;
    }

    function isAuthPagePath(path) {
        return /(^|\/)(login|register)\.html/i.test(path || '');
    }

    function getNextUrl(defaultUrl = '/') {
        const next = new URLSearchParams(window.location.search).get('next');
        if (!next || isAuthPagePath(next)) {
            return defaultUrl;
        }
        return next;
    }

    function buildAuthHref(pageName) {
        const rawCurrentPath = getCurrentRelativePath();
        const currentPath = encodeURIComponent(isAuthPagePath(rawCurrentPath) ? '/' : rawCurrentPath);
        return `${pageName}.html?next=${currentPath}`;
    }

    function renderAuthUi() {
        renderTopbarAuth();
        renderAdminLink();
        renderSidebarUser();
    }

    function saveSession({ token, user }) {
        if (token) {
            localStorage.setItem(AUTH_TOKEN_KEY, token);
        }

        if (user) {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        }

        renderAuthUi();
    }

    function clearSession() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        renderAuthUi();
    }

    function getAuthHeaders(baseHeaders = {}) {
        const headers = { ...baseHeaders };
        const token = getStoredToken();

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    async function fetchCurrentUser() {
        const token = getStoredToken();

        if (!token) {
            return null;
        }

        const response = await fetch(`${AUTH_API_BASE}/api/auth/me`, {
            headers: getAuthHeaders()
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            clearSession();
            throw new Error(result.error || 'Phiên đăng nhập không hợp lệ.');
        }

        if (result.user) {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
            renderAuthUi();
        }

        return result.user || null;
    }

    async function logout() {
        try {
            if (getStoredToken()) {
                await fetch(`${AUTH_API_BASE}/api/auth/logout`, {
                    method: 'POST',
                    headers: getAuthHeaders({
                        'Content-Type': 'application/json'
                    })
                });
            }
        } catch (error) {
            console.error('Lỗi đăng xuất:', error);
        } finally {
            clearSession();
        }
    }

    function renderTopbarAuth() {
        const authSlot = document.getElementById('auth-nav-slot');
        const user = getStoredUser();

        if (!authSlot) {
            return;
        }

        if (!user) {
            authSlot.innerHTML = `
                <div class="auth-actions">
                    <a class="auth-link auth-secondary" href="${buildAuthHref('login')}">Đăng nhập</a>
                    <a class="auth-link" href="${buildAuthHref('register')}">Đăng ký</a>
                </div>
            `;
            return;
        }

        authSlot.innerHTML = `
            <div class="auth-actions">
                <span class="auth-user-badge ${user.role === 'admin' ? 'is-admin' : ''}">
                    <span>${escapeHtml(user.fullName)}</span>
                    <small>${user.role === 'admin' ? 'admin' : 'user'}</small>
                </span>
                <button type="button" class="auth-link auth-secondary" id="nav-logout-button">Đăng xuất</button>
            </div>
        `;

        const logoutButton = document.getElementById('nav-logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                await logout();
                if (document.body.dataset.requiresAdmin === 'true') {
                    window.location.replace('/');
                }
            });
        }
    }

    function renderAdminLink() {
        const adminSlot = document.getElementById('admin-link-slot');

        if (!adminSlot) {
            return;
        }

        adminSlot.innerHTML = isAdmin() ? '<a href="admin-products.html">Quản trị</a>' : '';
    }

    function renderSidebarUser() {
        const sidebarUserInfo = document.getElementById('sidebar-user-info');
        const user = getStoredUser();

        if (!sidebarUserInfo) {
            return;
        }

        if (!user) {
            sidebarUserInfo.innerHTML = `
                <p class="sidebar-user-label">Chưa đăng nhập</p>
                <a class="auth-link" href="${buildAuthHref('login')}">Đăng nhập</a>
            `;
            return;
        }

        sidebarUserInfo.innerHTML = `
            <p class="sidebar-user-label">${user.role === 'admin' ? 'Quản trị viên' : 'Tài khoản'}</p>
            <h3 class="sidebar-user-name">${escapeHtml(user.fullName)}</h3>
            <p class="sidebar-user-email">${escapeHtml(user.email)}</p>
            <button type="button" class="secondary-btn sidebar-logout" id="sidebar-logout-button">Đăng xuất</button>
        `;

        const logoutButton = document.getElementById('sidebar-logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                await logout();
                window.location.replace('/');
            });
        }
    }

    function redirectToLogin() {
        const next = encodeURIComponent(getCurrentRelativePath());
        window.__AUTH_REDIRECTING__ = true;
        window.location.replace(`login.html?next=${next}`);
    }

    function redirectAuthenticatedUser() {
        const fallbackUrl = isAdmin() ? 'admin-products.html' : '/';
        window.location.replace(getNextUrl(fallbackUrl));
    }

    async function ensurePageAccess() {
        const requiresAdmin = document.body.dataset.requiresAdmin === 'true';
        const requiresAuth = document.body.dataset.requiresAuth === 'true';

        if (!requiresAdmin && !requiresAuth) {
            return true;
        }

        if (!isAuthenticated()) {
            redirectToLogin();
            return false;
        }

        try {
            const currentUser = await fetchCurrentUser();

            if (!currentUser) {
                redirectToLogin();
                return false;
            }

            if (requiresAdmin && currentUser.role !== 'admin') {
                clearSession();
                window.location.replace('/');
                return false;
            }

            return true;
        } catch (error) {
            console.error(error);
            redirectToLogin();
            return false;
        }
    }

    window.Auth = {
        API_BASE: AUTH_API_BASE,
        getUser: getStoredUser,
        getToken: getStoredToken,
        isAuthenticated,
        isAdmin,
        saveSession,
        clearSession,
        getAuthHeaders,
        fetchCurrentUser,
        logout,
        redirectToLogin,
        getNextUrl,
        redirectAuthenticatedUser,
        renderAuthUi
    };

    renderAuthUi();

    if (document.body.dataset.authPage && isAuthenticated()) {
        redirectAuthenticatedUser();
    } else {
        void ensurePageAccess();
    }
})();
