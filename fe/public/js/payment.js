const API_BASE = 'http://localhost:3000';
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
            image: item.image || '',
            quantity: Math.max(1, Number(item.quantity) || 1),
            trangThai: item.trangThai || 'Còn hàng'
        })),
        amount: Number(rawCheckoutData.amount) || 0,
        orderId: rawCheckoutData.orderId || null,
        customerInfo: rawCheckoutData.customerInfo || null
    }
    : null;

const orderIdEl = document.getElementById('order-id');
const checkoutCountEl = document.getElementById('checkout-count');
const amountEl = document.getElementById('payment-amount');
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

function formatCurrency(value) {
    return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
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
    checkoutWarningEl.hidden = true;

    checkoutItemsEl.innerHTML = checkoutData.items.map((item) => `
        <div class="checkout-item-row">
            <div>
                <p class="checkout-item-name">${item.name}</p>
                <p class="checkout-item-meta">${item.quantity} x ${formatCurrency(item.price)}</p>
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

            checkoutData.orderId = order._id;
            checkoutData.amount = Number(order.totalAmount) || checkoutData.amount;
            persistCheckoutData();
            renderCheckoutSummary();
        }

        const paymentResult = await createPayment({
            orderId: checkoutData.orderId,
            amount: checkoutData.amount,
            method: methodEl.value
        });

        localStorage.removeItem(CHECKOUT_STORAGE_KEY);
        localStorage.removeItem(LEGACY_PAYMENT_STORAGE_KEY);
        localStorage.removeItem('cart');

        orderIdEl.textContent = checkoutData.orderId;
        setMessage(`Thanh toán thành công. Mã giao dịch: ${paymentResult.transactionId || 'OK'}`, 'success');

        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    } catch (error) {
        setMessage(error.message, 'error');
        confirmButton.disabled = false;
        confirmButton.textContent = 'Xác nhận thanh toán';
    }
});

renderCheckoutSummary();
