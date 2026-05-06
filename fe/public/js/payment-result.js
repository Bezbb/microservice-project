const CHECKOUT_STORAGE_KEY = 'pendingCheckout';
const LEGACY_PAYMENT_STORAGE_KEY = 'pendingPayment';

const params = new URLSearchParams(window.location.search);
const status = params.get('status') || 'failed';
const orderId = params.get('orderId') || '-';
const transactionId = params.get('transactionId') || '-';
const message = params.get('message') || '';

const titleEl = document.getElementById('payment-result-title');
const messageEl = document.getElementById('payment-result-message');
const orderEl = document.getElementById('payment-result-order');
const transactionEl = document.getElementById('payment-result-transaction');

orderEl.textContent = orderId;
transactionEl.textContent = transactionId;

if (status === 'success') {
    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PAYMENT_STORAGE_KEY);
    localStorage.removeItem('cart');
    titleEl.textContent = 'Thanh toán MoMo thành công';
    messageEl.textContent = 'Đơn hàng đã được ghi nhận thanh toán.';
} else {
    titleEl.textContent = 'Thanh toán MoMo chưa hoàn tất';
    messageEl.textContent = message || 'Giao dịch chưa thành công. Bạn có thể quay lại giỏ hàng để thử lại.';
}
