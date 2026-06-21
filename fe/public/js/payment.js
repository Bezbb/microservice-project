const API_BASE = window.Auth?.API_BASE || window.AppConfig?.API_BASE_URL || window.__API_BASE__ || '';
const CHECKOUT_STORAGE_KEY = 'pendingCheckout';
const LEGACY_PAYMENT_STORAGE_KEY = 'pendingPayment';

const rawCheckoutData = JSON.parse(localStorage.getItem(CHECKOUT_STORAGE_KEY) || 'null');
const legacyPaymentData = JSON.parse(localStorage.getItem(LEGACY_PAYMENT_STORAGE_KEY) || 'null');

const checkoutData = rawCheckoutData && Array.isArray(rawCheckoutData.items)
    ? {
        items: rawCheckoutData.items.map((item) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price) || 0,
            originalPrice: Number(item.originalPrice) || Number(item.price) || 0,
            discountPercent: Number(item.discountPercent) || 0,
            flashSaleApplied: item.flashSaleApplied === true,
            flashSaleTitle: item.flashSaleTitle || '',
            image: item.image || '',
            quantity: Math.max(1, Number(item.quantity) || 1),
            trangThai: item.trangThai || 'Còn hàng'
        })),
        amount: Number(rawCheckoutData.amount) || 0,
        orderId: rawCheckoutData.orderId || null,
        thoiGian: rawCheckoutData.thoiGian || null,
        ngayGiaoDuKien: rawCheckoutData.ngayGiaoDuKien || null,
        customerInfo: rawCheckoutData.customerInfo || null
    }
    : null;

const orderIdEl = document.getElementById('order-id');
const checkoutCountEl = document.getElementById('checkout-count');
const amountEl = document.getElementById('payment-amount');
const estimatedDeliveryDateEl = document.getElementById('estimated-delivery-date');
const methodEl = document.getElementById('payment-method');
const messageEl = document.getElementById('payment-message');
const confirmButton = document.getElementById('confirm-payment');
const checkoutItemsEl = document.getElementById('checkout-items');
const checkoutWarningEl = document.getElementById('checkout-warning');
const fullNameEl = document.getElementById('full-name');
const phoneEl = document.getElementById('phone');
const addressEl = document.getElementById('address');
const noteEl = document.getElementById('note');
const currentUser = window.Auth ? window.Auth.getUser() : null;

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

function getEstimatedDeliveryDate(orderDate = new Date()) {
    const orderedAt = new Date(orderDate);

    if (!Number.isFinite(orderedAt.getTime())) {
        return null;
    }

    return new Date(orderedAt.getTime() + DELIVERY_WINDOW_MS);
}

function formatPaymentMethod(method) {
    switch (method) {
    case 'momo':
        return 'MoMo';
    case 'cash':
        return 'Tiền mặt';
    default:
        return method || 'Chưa thanh toán';
    }
}

function normalizeOrderItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map((item) => ({
        id: item.productId || item.id,
        name: item.name || '',
        price: Number(item.price) || 0,
        originalPrice: Number(item.originalPrice) || Number(item.price) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        flashSaleApplied: item.flashSaleApplied === true,
        flashSaleTitle: item.flashSaleTitle || '',
        image: item.image || '',
        quantity: Math.max(1, Number(item.quantity) || 1),
        trangThai: item.trangThai || 'Còn hàng'
    })).filter((item) => item.id && item.name);
}

function getCheckoutTotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCheckoutQuantity(items) {
    return items.reduce((sum, item) => sum + item.quantity, 0);
}

function persistCheckoutData() {
    localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(checkoutData));
}

function setMessage(text, type = 'error') {
    messageEl.textContent = text;
    messageEl.className = `payment-message ${type}`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getCustomerInfo() {
    return {
        fullName: fullNameEl.value.trim(),
        phone: phoneEl.value.trim(),
        address: addressEl.value.trim(),
        note: noteEl.value.trim()
    };
}

function validateCustomerInfo(customerInfo) {
    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.address) {
        throw new Error('Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.');
    }

    const normalizedPhone = customerInfo.phone.replace(/\s+/g, '');
    if (!/^[0-9+]{9,15}$/.test(normalizedPhone)) {
        throw new Error('Số điện thoại không hợp lệ.');
    }
}

function ensureAuthenticatedCheckout() {
    if (window.Auth && window.Auth.isAuthenticated()) {
        return true;
    }

    setMessage('Vui lòng đăng nhập để thanh toán.', 'error');

    if (window.Auth && typeof window.Auth.redirectToLogin === 'function') {
        window.Auth.redirectToLogin();
    } else {
        window.location.href = '/login.html';
    }

    return false;
}

function getRequestHeaders() {
    const baseHeaders = {
        'Content-Type': 'application/json'
    };

    if (window.Auth && typeof window.Auth.getAuthHeaders === 'function') {
        return window.Auth.getAuthHeaders(baseHeaders);
    }

    return baseHeaders;
}

function renderCheckoutSummary() {
    if (!checkoutData || !checkoutData.items.length) {
        orderIdEl.textContent = legacyPaymentData?.orderId || 'Không có dữ liệu';
        checkoutCountEl.textContent = '0';
        amountEl.textContent = formatCurrency(legacyPaymentData?.amount || 0);
        checkoutItemsEl.innerHTML = '';
        checkoutWarningEl.hidden = false;
        checkoutWarningEl.textContent = 'Không tìm thấy giỏ hàng để thanh toán. Hãy quay lại giỏ hàng.';
        confirmButton.disabled = true;
        setMessage('Không có dữ liệu checkout hợp lệ.', 'error');
        return;
    }

    if (checkoutData.customerInfo) {
        fullNameEl.value = checkoutData.customerInfo.fullName || '';
        phoneEl.value = checkoutData.customerInfo.phone || '';
        addressEl.value = checkoutData.customerInfo.address || '';
        noteEl.value = checkoutData.customerInfo.note || '';
    } else if (currentUser?.fullName) {
        fullNameEl.value = currentUser.fullName;
    }

    const totalAmount = checkoutData.amount || getCheckoutTotal(checkoutData.items);
    checkoutData.amount = totalAmount;

    orderIdEl.textContent = checkoutData.orderId || 'Sẽ tạo khi xác nhận';
    checkoutCountEl.textContent = `${getCheckoutQuantity(checkoutData.items)}`;
    amountEl.textContent = formatCurrency(totalAmount);
    estimatedDeliveryDateEl.textContent = formatDate(
        checkoutData.ngayGiaoDuKien || getEstimatedDeliveryDate(checkoutData.thoiGian || new Date())
    );
    checkoutWarningEl.hidden = true;

    checkoutItemsEl.innerHTML = checkoutData.items.map((item) => `
        <div class="checkout-item-row">
            <div>
                <p class="checkout-item-name">${escapeHtml(item.name)}</p>
                <p class="checkout-item-meta">
                    ${item.flashSaleApplied ? `<span class="flash-sale-badge">${escapeHtml(item.flashSaleTitle || 'Flash Sale')}</span> ` : ''}
                    ${item.quantity} x ${item.flashSaleApplied ? `<span class="original-price">${formatCurrency(item.originalPrice)}</span> ` : ''}${formatCurrency(item.price)}
                </p>
            </div>
            <strong>${formatCurrency(item.price * item.quantity)}</strong>
        </div>
    `).join('');
}

async function createOrder(payload) {
    const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(result.loi || result.error || 'Không thể tạo đơn hàng.');
    }

    return result.donHang || result.order || result;
}

async function createPayment(payload) {
    const response = await fetch(`${API_BASE}/api/payments`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(result.error || result.loi || 'Thanh toán thất bại.');
    }

    return result;
}

confirmButton.addEventListener('click', async () => {
    if (!checkoutData || !checkoutData.items.length) {
        return;
    }

    if (!ensureAuthenticatedCheckout()) {
        return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = 'Đang xử lý...';
    setMessage('');

    try {
        const customerInfo = getCustomerInfo();
        validateCustomerInfo(customerInfo);

        checkoutData.customerInfo = customerInfo;
        persistCheckoutData();

        if (!checkoutData.orderId) {
            const order = await createOrder({
                items: checkoutData.items,
                customerInfo
            });

            const normalizedOrderItems = normalizeOrderItems(order.items);
            checkoutData.orderId = order._id;
            checkoutData.thoiGian = order.thoiGian || checkoutData.thoiGian;
            checkoutData.ngayGiaoDuKien = order.ngayGiaoDuKien
                || getEstimatedDeliveryDate(order.thoiGian || new Date())?.toISOString()
                || checkoutData.ngayGiaoDuKien;
            checkoutData.items = normalizedOrderItems.length ? normalizedOrderItems : checkoutData.items;
            checkoutData.amount = Number(order.totalAmount) || checkoutData.amount;
            persistCheckoutData();
            renderCheckoutSummary();
        }

        const selectedMethod = methodEl.value;
        const paymentResult = await createPayment({
            orderId: checkoutData.orderId,
            amount: checkoutData.amount,
            method: selectedMethod
        });

        if (selectedMethod === 'cash') {
            localStorage.removeItem(CHECKOUT_STORAGE_KEY);
            localStorage.removeItem(LEGACY_PAYMENT_STORAGE_KEY);
            localStorage.removeItem('cart');

            orderIdEl.textContent = checkoutData.orderId;
            setMessage(
                `Đã ghi nhận thanh toán tiền mặt. Mã giao dịch: ${paymentResult.transactionId || 'OK'}`,
                'success'
            );

            setTimeout(() => {
                window.location.href = '/account.html';
            }, 1500);
            return;
        }

        const payUrl = paymentResult.payUrl || paymentResult.payment?.payUrl || paymentResult.shortLink;

        if (!payUrl) {
            throw new Error('Không nhận được liên kết thanh toán MoMo.');
        }

        setMessage(`Đang chuyển sang cổng thanh toán ${formatPaymentMethod(selectedMethod)}...`, 'success');
        window.location.href = payUrl;
    } catch (error) {
        setMessage(error.message, 'error');
        confirmButton.disabled = false;
        confirmButton.textContent = 'Xác nhận thanh toán';
    }
});

renderCheckoutSummary();
