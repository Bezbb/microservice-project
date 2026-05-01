const API_BASE = window.Auth?.API_BASE || 'http://localhost:3000';

const fullNameEl = document.getElementById('account-full-name');
const emailEl = document.getElementById('account-email');
const roleEl = document.getElementById('account-role');
const createdAtEl = document.getElementById('account-created-at');
const totalOrdersEl = document.getElementById('stats-total-orders');
const pendingOrdersEl = document.getElementById('stats-pending-orders');
const paidOrdersEl = document.getElementById('stats-paid-orders');
const totalSpentEl = document.getElementById('stats-total-spent');
const ordersListEl = document.getElementById('orders-list');
const messageEl = document.getElementById('account-orders-message');
const refreshButton = document.getElementById('refresh-orders-button');

function formatCurrency(value) {
    return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}

function formatDate(value) {
    if (!value) {
        return '-';
    }

    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));
}

function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = `account-message ${type}`.trim();
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
    default:
        return status || 'Không xác định';
    }
}

function getStatusClass(status) {
    return status === 'paid' ? 'is-paid' : 'is-pending';
}

function renderProfile(user) {
    fullNameEl.textContent = user?.fullName || 'Không có dữ liệu';
    emailEl.textContent = user?.email || '-';
    roleEl.textContent = formatRole(user?.role);
    createdAtEl.textContent = formatDate(user?.createdAt);
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
                        <span>Tổng tiền</span>
                        <strong>${formatCurrency(order.totalAmount || 0)}</strong>
                    </div>
                    <div class="order-block">
                        <span>Phương thức</span>
                        <strong>${order.paymentMethod || 'Chưa thanh toán'}</strong>
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
        renderProfile(user);

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

void loadAccountPage();
