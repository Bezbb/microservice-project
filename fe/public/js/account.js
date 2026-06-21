const API_BASE = window.Auth?.API_BASE || window.AppConfig?.API_BASE_URL || window.__API_BASE__ || '';

const fullNameEl = document.getElementById('account-full-name');
const emailEl = document.getElementById('account-email');
const roleEl = document.getElementById('account-role');
const createdAtEl = document.getElementById('account-created-at');
const lastLoginAtEl = document.getElementById('account-last-login-at');
const totalOrdersEl = document.getElementById('stats-total-orders');
const pendingOrdersEl = document.getElementById('stats-pending-orders');
const paidOrdersEl = document.getElementById('stats-paid-orders');
const activeOrdersEl = document.getElementById('stats-active-orders');
const totalSpentEl = document.getElementById('stats-total-spent');
const ordersListEl = document.getElementById('orders-list');
const messageEl = document.getElementById('account-orders-message');
const refreshButton = document.getElementById('refresh-orders-button');
const orderCountEl = document.getElementById('account-order-count');
const orderSearchInput = document.getElementById('account-order-search');
const orderStatusFilter = document.getElementById('account-order-status');
const orderSortSelect = document.getElementById('account-order-sort');
const profileForm = document.getElementById('account-profile-form');
const profileFullNameInput = document.getElementById('profile-full-name');
const profileEmailInput = document.getElementById('profile-email');
const currentPasswordInput = document.getElementById('profile-current-password');
const newPasswordInput = document.getElementById('profile-new-password');
const confirmPasswordInput = document.getElementById('profile-confirm-password');
const profileMessageEl = document.getElementById('account-profile-message');
const saveProfileButton = document.getElementById('save-profile-button');
const resetProfileButton = document.getElementById('reset-profile-button');
const currentFocusEl = document.getElementById('account-current-focus');

const state = {
    currentUser: null,
    orders: [],
    orderSearch: '',
    orderStatusFilter: 'all',
    orderSort: 'newest'
};

const DELIVERY_WINDOW_DAYS = 7;
const DELIVERY_WINDOW_MS = DELIVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const PAID_ORDER_STATUSES = new Set(['paid', 'confirmed', 'shipping', 'delivered']);
const ACTIVE_ORDER_STATUSES = new Set(['pending_payment', 'paid', 'confirmed', 'shipping']);
const ORDER_PROGRESS_STEPS = [
    { status: 'pending_payment', label: 'Đặt hàng' },
    { status: 'paid', label: 'Thanh toán' },
    { status: 'confirmed', label: 'Xác nhận' },
    { status: 'shipping', label: 'Giao hàng' },
    { status: 'delivered', label: 'Hoàn tất' }
];
const ORDER_PROGRESS_INDEX = {
    pending_payment: 0,
    paid: 1,
    confirmed: 2,
    shipping: 3,
    delivered: 4,
    returned: 4
};

function formatCurrency(value) {
    return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
    case 'confirmed':
        return 'Đã xác nhận';
    case 'shipping':
        return 'Đang giao';
    case 'delivered':
        return 'Đã giao';
    case 'returned':
        return 'Đã hoàn trả';
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
    if (status === 'paid' || status === 'confirmed') {
        return 'is-paid';
    }

    if (status === 'shipping') {
        return 'is-shipping';
    }

    if (status === 'delivered') {
        return 'is-delivered';
    }

    if (status === 'cancelled' || status === 'payment_failed' || status === 'returned') {
        return 'is-cancelled';
    }

    return 'is-pending';
}

function getOrderSearchText(order) {
    return [
        order._id,
        order.transactionId,
        order.customerInfo?.fullName,
        order.customerInfo?.phone,
        order.customerInfo?.address,
        order.customerInfo?.note,
        ...(order.items || []).map((item) => item.name)
    ].filter(Boolean).join(' ').toLowerCase();
}

function getOrderedAtTime(order) {
    const date = new Date(order?.thoiGian || '');
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function getFilteredOrders() {
    const query = state.orderSearch.trim().toLowerCase();

    return [...state.orders]
        .filter((order) => {
            if (state.orderStatusFilter !== 'all' && order.status !== state.orderStatusFilter) {
                return false;
            }

            if (query && !getOrderSearchText(order).includes(query)) {
                return false;
            }

            return true;
        })
        .sort((first, second) => {
            if (state.orderSort === 'oldest') {
                return getOrderedAtTime(first) - getOrderedAtTime(second);
            }

            if (state.orderSort === 'amount-desc') {
                return (Number(second.totalAmount) || 0) - (Number(first.totalAmount) || 0);
            }

            return getOrderedAtTime(second) - getOrderedAtTime(first);
        });
}

function renderOrderCount(filteredCount) {
    orderCountEl.textContent = `${filteredCount}/${state.orders.length} đơn hàng`;
}

function renderAccountSnapshot(orders) {
    if (!orders.length) {
        currentFocusEl.innerHTML = `
            <strong>Chưa có đơn hàng nào.</strong>
            <span>Bạn có thể bắt đầu mua sắm và theo dõi đơn ngay tại trang này.</span>
        `;
        return;
    }

    const pendingOrder = orders.find((order) => order.status === 'pending_payment');
    if (pendingOrder) {
        currentFocusEl.innerHTML = `
            <strong>Có đơn đang chờ thanh toán.</strong>
            <span>Mã đơn ${escapeHtml(pendingOrder._id)} được tạo lúc ${formatDate(pendingOrder.thoiGian)}.</span>
        `;
        return;
    }

    const shippingOrder = orders.find((order) => order.status === 'shipping');
    if (shippingOrder) {
        currentFocusEl.innerHTML = `
            <strong>Đơn hàng đang được giao.</strong>
            <span>Dự kiến giao đơn ${escapeHtml(shippingOrder._id)} vào ${formatDate(getEstimatedDeliveryDate(shippingOrder))}.</span>
        `;
        return;
    }

    const activeOrder = orders.find((order) => ACTIVE_ORDER_STATUSES.has(order.status));
    if (activeOrder) {
        currentFocusEl.innerHTML = `
            <strong>Đơn hàng đang được xử lý.</strong>
            <span>Đơn ${escapeHtml(activeOrder._id)} hiện ở trạng thái ${escapeHtml(formatStatus(activeOrder.status))}.</span>
        `;
        return;
    }

    const latestOrder = [...orders].sort((first, second) => getOrderedAtTime(second) - getOrderedAtTime(first))[0];
    currentFocusEl.innerHTML = `
        <strong>Đơn gần nhất: ${escapeHtml(formatStatus(latestOrder.status))}.</strong>
        <span>Mã đơn ${escapeHtml(latestOrder._id)} tạo lúc ${formatDate(latestOrder.thoiGian)}.</span>
    `;
}

function renderOrderProgress(order) {
    if (order.status === 'cancelled' || order.status === 'payment_failed') {
        return `
            <div class="order-progress">
                <div class="order-progress-step is-done">Đặt hàng</div>
                <div class="order-progress-step is-stopped">${escapeHtml(formatStatus(order.status))}</div>
            </div>
        `;
    }

    const currentIndex = ORDER_PROGRESS_INDEX[order.status] ?? 0;
    return `
        <div class="order-progress">
            ${ORDER_PROGRESS_STEPS.map((step, index) => {
        const className = index < currentIndex
            ? 'is-done'
            : index === currentIndex
                ? 'is-current'
                : '';
        const label = order.status === 'returned' && index === ORDER_PROGRESS_STEPS.length - 1
            ? 'Hoàn trả'
            : step.label;

        return `<div class="order-progress-step ${className}">${escapeHtml(label)}</div>`;
    }).join('')}
        </div>
    `;
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
    const paidOrders = orders.filter((order) => PAID_ORDER_STATUSES.has(order.status)).length;
    const activeOrders = orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status)).length;
    const totalSpent = orders
        .filter((order) => PAID_ORDER_STATUSES.has(order.status))
        .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

    totalOrdersEl.textContent = String(totalOrders);
    pendingOrdersEl.textContent = String(pendingOrders);
    paidOrdersEl.textContent = String(paidOrders);
    activeOrdersEl.textContent = String(activeOrders);
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

function canCancelOrder(order) {
    return order?.status === 'pending_payment';
}

async function cancelOrder(orderId) {
    const isConfirmed = confirm('Hủy đơn hàng này? Sản phẩm đang được giữ sẽ được hoàn lại tồn kho.');
    if (!isConfirmed) {
        return;
    }

    setMessage('Đang hủy đơn hàng...', 'is-loading');

    try {
        const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}/cancel`, {
            method: 'PATCH',
            headers: window.Auth ? window.Auth.getAuthHeaders({
                'Content-Type': 'application/json'
            }) : {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'customer_cancelled' })
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.loi || result.error || 'Không thể hủy đơn hàng.');
        }

        setMessage(result.thongBao || 'Đã hủy đơn hàng.', 'is-success');
        await loadAccountPage();
    } catch (error) {
        console.error(error);
        setMessage(error.message, 'is-error');
    }
}

function bindOrderActions() {
    ordersListEl.querySelectorAll('[data-cancel-order-id]').forEach((button) => {
        button.addEventListener('click', () => {
            void cancelOrder(button.dataset.cancelOrderId);
        });
    });
}

function renderEmptyOrders() {
    renderOrderCount(0);
    ordersListEl.innerHTML = `
        <div class="empty-account-state">
            <div class="empty-cart-badge">Chưa có đơn hàng</div>
            <h3>Bạn chưa đặt đơn nào</h3>
            <p>Hãy quay lại trang chủ, thêm sản phẩm vào giỏ và hoàn tất thanh toán để thấy lịch sử đơn hàng tại đây.</p>
            <a class="primary-link" href="/">Mua hàng ngay</a>
        </div>
    `;
}

function renderEmptyFilteredOrders() {
    renderOrderCount(0);
    ordersListEl.innerHTML = `
        <div class="empty-account-state">
            <div class="empty-cart-badge">Không có kết quả</div>
            <h3>Không tìm thấy đơn phù hợp</h3>
            <p>Hãy đổi từ khóa, trạng thái hoặc cách sắp xếp để xem các đơn khác.</p>
        </div>
    `;
}

function renderOrders() {
    const orders = getFilteredOrders();

    renderOrderCount(orders.length);

    if (!state.orders.length) {
        renderEmptyOrders();
        return;
    }

    if (!orders.length) {
        renderEmptyFilteredOrders();
        return;
    }

    ordersListEl.innerHTML = orders.map((order) => {
        const itemsHtml = (order.items || []).map((item) => `
            <div class="order-item-row">
                <div>
                    <p class="order-item-name">${escapeHtml(item.name)}</p>
                    <p class="order-item-meta">
                        ${item.flashSaleApplied ? `<span class="flash-sale-badge">${escapeHtml(item.flashSaleTitle || 'Flash Sale')}</span> ` : ''}
                        ${item.quantity} x ${item.flashSaleApplied ? `<span class="original-price">${formatCurrency(item.originalPrice || item.price)}</span> ` : ''}${formatCurrency(item.price)}
                    </p>
                </div>
                <strong>${formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong>
            </div>
        `).join('');

        const orderActionsHtml = canCancelOrder(order)
            ? `
                <div class="order-actions">
                    <button class="delete-btn" type="button" data-cancel-order-id="${escapeHtml(order._id)}">Hủy đơn</button>
                </div>
            `
            : '';

        return `
            <article class="order-card">
                <div class="order-card-head">
                    <div>
                        <p class="card-eyebrow">Mã đơn hàng</p>
                        <h3>${escapeHtml(order._id)}</h3>
                    </div>
                    <span class="account-status-badge ${getStatusClass(order.status)}">${escapeHtml(formatStatus(order.status))}</span>
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
                        <strong>${escapeHtml(order.transactionId || '-')}</strong>
                    </div>
                </div>

                ${renderOrderProgress(order)}
                ${orderActionsHtml}

                <div class="order-section">
                    <p class="order-section-title">Người nhận</p>
                    <p>${escapeHtml(order.customerInfo?.fullName || '-')}</p>
                    <p>${escapeHtml(order.customerInfo?.phone || '-')}</p>
                    <p>${escapeHtml(order.customerInfo?.address || '-')}</p>
                    ${order.customerInfo?.note ? `<p>Ghi chú: ${escapeHtml(order.customerInfo.note)}</p>` : ''}
                </div>

                <div class="order-section">
                    <p class="order-section-title">Sản phẩm</p>
                    <div class="order-items-list">${itemsHtml}</div>
                </div>
            </article>
        `;
    }).join('');
    bindOrderActions();
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
        state.orders = orders;
        renderStats(orders);
        renderAccountSnapshot(orders);
        renderOrders();

        setMessage(`Tìm thấy ${orders.length} đơn hàng của tài khoản này.`, 'is-success');
    } catch (error) {
        console.error(error);
        state.orders = [];
        renderStats([]);
        renderAccountSnapshot([]);
        renderOrderCount(0);
        ordersListEl.innerHTML = '';
        setMessage(error.message, 'is-error');
    } finally {
        refreshButton.disabled = false;
    }
}

refreshButton.addEventListener('click', () => {
    void loadAccountPage();
});

orderSearchInput.addEventListener('input', (event) => {
    state.orderSearch = event.target.value || '';
    renderOrders();
});

orderStatusFilter.addEventListener('change', (event) => {
    state.orderStatusFilter = event.target.value || 'all';
    renderOrders();
});

orderSortSelect.addEventListener('change', (event) => {
    state.orderSort = event.target.value || 'newest';
    renderOrders();
});

profileForm.addEventListener('submit', saveProfile);
resetProfileButton.addEventListener('click', resetProfileForm);

void loadAccountPage();
