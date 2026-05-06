const API_BASE = window.Auth?.API_BASE || 'http://localhost:3000';

const fullNameEl = document.getElementById('account-full-name');
const emailEl = document.getElementById('account-email');
const roleEl = document.getElementById('account-role');
const createdAtEl = document.getElementById('account-created-at');
const lastLoginAtEl = document.getElementById('account-last-login-at');
const totalOrdersEl = document.getElementById('stats-total-orders');
const pendingOrdersEl = document.getElementById('stats-pending-orders');
const paidOrdersEl = document.getElementById('stats-paid-orders');
const totalSpentEl = document.getElementById('stats-total-spent');
const ordersListEl = document.getElementById('orders-list');
const messageEl = document.getElementById('account-orders-message');
const refreshButton = document.getElementById('refresh-orders-button');
const profileForm = document.getElementById('account-profile-form');
const profileFullNameInput = document.getElementById('profile-full-name');
const profileEmailInput = document.getElementById('profile-email');
const currentPasswordInput = document.getElementById('profile-current-password');
const newPasswordInput = document.getElementById('profile-new-password');
const confirmPasswordInput = document.getElementById('profile-confirm-password');
const profileMessageEl = document.getElementById('account-profile-message');
const saveProfileButton = document.getElementById('save-profile-button');
const resetProfileButton = document.getElementById('reset-profile-button');

const state = {
    currentUser: null
};

const DELIVERY_WINDOW_DAYS = 7;
const DELIVERY_WINDOW_MS = DELIVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function formatCurrency(value) {
    return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}

function formatDate(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
        return '-';
    }

    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function getEstimatedDeliveryDate(order) {
    if (order?.ngayGiaoDuKien) {
        const deliveryDate = new Date(order.ngayGiaoDuKien);

        if (Number.isFinite(deliveryDate.getTime())) {
            return deliveryDate;
        }
    }

    const orderedAt = new Date(order?.thoiGian || '');

    if (!Number.isFinite(orderedAt.getTime())) {
        return null;
    }

    return new Date(orderedAt.getTime() + DELIVERY_WINDOW_MS);
}

function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = `account-message ${type}`.trim();
}

function setProfileMessage(text, type = '') {
    profileMessageEl.textContent = text;
    profileMessageEl.className = `account-message ${type}`.trim();
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function formatRole(role) {
    return role === 'admin' ? 'Quản trị viên' : 'Khách hàng';
}

function formatStatus(status) {
    switch (status) {
    case 'paid':
        return 'Đã thanh toán';
    case 'pending_payment':
        return 'Chờ thanh toán';
    case 'cancelled':
        return 'Đã hủy';
    case 'payment_failed':
        return 'Thanh toán thất bại';
    default:
        return status || 'Không xác định';
    }
}

function formatPaymentMethod(method) {
    switch (method) {
    case 'momo':
        return 'MoMo';
    case 'card':
        return 'Thẻ';
    case 'cash':
        return 'Tiền mặt';
    default:
        return method || 'Chưa thanh toán';
    }
}

function getStatusClass(status) {
    if (status === 'paid') {
        return 'is-paid';
    }

    if (status === 'cancelled' || status === 'payment_failed') {
        return 'is-cancelled';
    }

    return 'is-pending';
}

function renderProfile(user) {
    fullNameEl.textContent = user?.fullName || 'Không có dữ liệu';
    emailEl.textContent = user?.email || '-';
    roleEl.textContent = formatRole(user?.role);
    createdAtEl.textContent = formatDate(user?.createdAt);
    lastLoginAtEl.textContent = formatDate(user?.lastLoginAt);
}

function renderStats(orders) {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((order) => order.status === 'pending_payment').length;
    const paidOrders = orders.filter((order) => order.status === 'paid').length;
    const totalSpent = orders
        .filter((order) => order.status === 'paid')
        .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

    totalOrdersEl.textContent = String(totalOrders);
    pendingOrdersEl.textContent = String(pendingOrders);
    paidOrdersEl.textContent = String(paidOrders);
    totalSpentEl.textContent = formatCurrency(totalSpent);
}

function clearPasswordFields() {
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
}

function fillProfileForm(user) {
    profileFullNameInput.value = user?.fullName || '';
    profileEmailInput.value = user?.email || '';
    clearPasswordFields();
}

function setProfileFormDisabled(isDisabled) {
    [
        profileFullNameInput,
        profileEmailInput,
        currentPasswordInput,
        newPasswordInput,
        confirmPasswordInput,
        saveProfileButton,
        resetProfileButton
    ].forEach((element) => {
        element.disabled = isDisabled;
    });
}

function buildProfilePayload() {
    const fullName = String(profileFullNameInput.value || '').trim();
    const email = normalizeEmail(profileEmailInput.value);
    const currentPassword = currentPasswordInput.value || '';
    const newPassword = newPasswordInput.value || '';
    const confirmPassword = confirmPasswordInput.value || '';

    if (!fullName) {
        throw new Error('Vui lòng nhập họ và tên.');
    }

    if (!email) {
        throw new Error('Vui lòng nhập email.');
    }

    const profileChanged = !state.currentUser
        || fullName !== String(state.currentUser.fullName || '').trim()
        || email !== normalizeEmail(state.currentUser.email);
    const passwordChanged = Boolean(currentPassword || newPassword || confirmPassword);

    if (!profileChanged && !passwordChanged) {
        throw new Error('Không có thay đổi để lưu.');
    }

    const payload = {};

    if (profileChanged) {
        payload.fullName = fullName;
        payload.email = email;
    }

    if (passwordChanged) {
        if (!currentPassword) {
            throw new Error('Vui lòng nhập mật khẩu hiện tại.');
        }

        if (!newPassword) {
            throw new Error('Vui lòng nhập mật khẩu mới.');
        }

        if (newPassword.length < 6) {
            throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
        }

        if (newPassword !== confirmPassword) {
            throw new Error('Xác nhận mật khẩu không khớp.');
        }

        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
    }

    return payload;
}

async function saveProfile(event) {
    event.preventDefault();

    let payload;

    try {
        payload = buildProfilePayload();
    } catch (error) {
        setProfileMessage(error.message, 'is-error');
        return;
    }

    setProfileFormDisabled(true);
    setProfileMessage('Đang lưu thay đổi...', 'is-loading');

    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'PATCH',
            headers: window.Auth ? window.Auth.getAuthHeaders({
                'Content-Type': 'application/json'
            }) : {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Không thể cập nhật tài khoản.');
        }

        state.currentUser = result.user || state.currentUser;
        renderProfile(state.currentUser);
        fillProfileForm(state.currentUser);

        if (window.Auth && result.user) {
            window.Auth.saveSession({ user: result.user });
        }

        setProfileMessage(result.message || 'Đã cập nhật tài khoản.', 'is-success');
    } catch (error) {
        console.error(error);
        setProfileMessage(error.message, 'is-error');
    } finally {
        setProfileFormDisabled(false);
    }
}

function resetProfileForm() {
    fillProfileForm(state.currentUser);
    setProfileMessage('', '');
}

function renderEmptyOrders() {
    ordersListEl.innerHTML = `
        <div class="empty-account-state">
            <div class="empty-cart-badge">Chưa có đơn hàng</div>
            <h3>Bạn chưa đặt đơn nào</h3>
            <p>Hãy quay lại trang chủ, thêm sản phẩm vào giỏ và hoàn tất thanh toán để thấy lịch sử đơn hàng tại đây.</p>
            <a class="primary-link" href="/">Mua hàng ngay</a>
        </div>
    `;
}

function renderOrders(orders) {
    if (!orders.length) {
        renderEmptyOrders();
        return;
    }

    ordersListEl.innerHTML = orders.map((order) => {
        const itemsHtml = (order.items || []).map((item) => `
            <div class="order-item-row">
                <div>
                    <p class="order-item-name">${item.name}</p>
                    <p class="order-item-meta">${item.quantity} x ${formatCurrency(item.price)}</p>
                </div>
                <strong>${formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong>
            </div>
        `).join('');

        return `
            <article class="order-card">
                <div class="order-card-head">
                    <div>
                        <p class="card-eyebrow">Mã đơn hàng</p>
                        <h3>${order._id}</h3>
                    </div>
                    <span class="account-status-badge ${getStatusClass(order.status)}">${formatStatus(order.status)}</span>
                </div>

                <div class="order-grid">
                    <div class="order-block">
                        <span>Ngày tạo</span>
                        <strong>${formatDate(order.thoiGian)}</strong>
                    </div>
                    <div class="order-block">
                        <span>Dự kiến giao</span>
                        <strong>${formatDate(getEstimatedDeliveryDate(order))}</strong>
                    </div>
                    <div class="order-block">
                        <span>Tổng tiền</span>
                        <strong>${formatCurrency(order.totalAmount || 0)}</strong>
                    </div>
                    <div class="order-block">
                        <span>Phương thức</span>
                        <strong>${formatPaymentMethod(order.paymentMethod)}</strong>
                    </div>
                    <div class="order-block">
                        <span>Giao dịch</span>
                        <strong>${order.transactionId || '-'}</strong>
                    </div>
                </div>

                <div class="order-section">
                    <p class="order-section-title">Người nhận</p>
                    <p>${order.customerInfo?.fullName || '-'}</p>
                    <p>${order.customerInfo?.phone || '-'}</p>
                    <p>${order.customerInfo?.address || '-'}</p>
                    ${order.customerInfo?.note ? `<p>Ghi chú: ${order.customerInfo.note}</p>` : ''}
                </div>

                <div class="order-section">
                    <p class="order-section-title">Sản phẩm</p>
                    <div class="order-items-list">${itemsHtml}</div>
                </div>
            </article>
        `;
    }).join('');
}

async function fetchOrders() {
    const response = await fetch(`${API_BASE}/api/orders/my`, {
        headers: window.Auth ? window.Auth.getAuthHeaders() : {}
    });

    const result = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(result.loi || result.error || 'Không thể tải lịch sử đơn hàng.');
    }

    return Array.isArray(result) ? result : [];
}

async function loadAccountPage() {
    refreshButton.disabled = true;
    setMessage('Đang tải thông tin tài khoản...', 'is-loading');

    try {
        const user = window.Auth ? await window.Auth.fetchCurrentUser() : null;
        state.currentUser = user;
        renderProfile(user);
        fillProfileForm(user);

        const orders = await fetchOrders();
        renderStats(orders);
        renderOrders(orders);

        setMessage(`Tìm thấy ${orders.length} đơn hàng của tài khoản này.`, 'is-success');
    } catch (error) {
        console.error(error);
        renderStats([]);
        ordersListEl.innerHTML = '';
        setMessage(error.message, 'is-error');
    } finally {
        refreshButton.disabled = false;
    }
}

refreshButton.addEventListener('click', () => {
    void loadAccountPage();
});

profileForm.addEventListener('submit', saveProfile);
resetProfileButton.addEventListener('click', resetProfileForm);

void loadAccountPage();
