const API_BASE = window.Auth?.API_BASE || 'http://localhost:3000';
const FALLBACK_IMAGE = '/images/default-product.svg';
const IN_STOCK_STATUS = 'Còn hàng';
const OUT_OF_STOCK_STATUS = 'Hết hàng';

if (window.Auth && !window.Auth.isAdmin()) {
    window.location.replace(`/login.html?next=${encodeURIComponent('/admin-products.html')}`);
}

const state = {
    products: [],
    categories: [],
    users: [],
    orders: [],
    payments: [],
    selectedUserId: '',
    userSearch: '',
    userRoleFilter: 'all',
    orderSearch: '',
    orderStatusFilter: 'all',
    orderPaymentFilter: 'all',
    orderDateFrom: '',
    orderDateTo: ''
};

const DELIVERY_WINDOW_DAYS = 7;
const DELIVERY_WINDOW_MS = DELIVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const PAID_ORDER_STATUSES = new Set(['paid', 'confirmed', 'shipping', 'delivered']);
const ORDER_STATUS_ACTIONS = {
    paid: [
        { status: 'confirmed', label: 'Xác nhận' },
        { status: 'cancelled', label: 'Hủy đơn' }
    ],
    confirmed: [
        { status: 'shipping', label: 'Đang giao' },
        { status: 'cancelled', label: 'Hủy đơn' }
    ],
    shipping: [
        { status: 'delivered', label: 'Đã giao' }
    ],
    delivered: [
        { status: 'returned', label: 'Hoàn trả' }
    ]
};

const form = document.getElementById('product-form');
const tableBody = document.getElementById('product-table-body');
const productCount = document.getElementById('product-count');
const formTitle = document.getElementById('form-title');
const imageInput = document.getElementById('imageFile');
const previewImage = document.getElementById('preview-image');
const brandInput = document.getElementById('brand');
const stockQuantityInput = document.getElementById('stockQuantity');
const tagsInput = document.getElementById('tags');
const categorySelect = document.getElementById('categoryId');
const newCategoryNameInput = document.getElementById('newCategoryName');
const flashSaleEnabledInput = document.getElementById('flashSaleEnabled');
const flashSaleTitleInput = document.getElementById('flashSaleTitle');
const flashSaleSalePriceInput = document.getElementById('flashSaleSalePrice');
const flashSaleStartsAtInput = document.getElementById('flashSaleStartsAt');
const flashSaleEndsAtInput = document.getElementById('flashSaleEndsAt');
const flashSaleStockLimitInput = document.getElementById('flashSaleStockLimit');
const flashSalePerOrderLimitInput = document.getElementById('flashSalePerOrderLimit');
const flashSaleDelayValueInput = document.getElementById('flashSaleDelayValue');
const flashSaleDelayUnitInput = document.getElementById('flashSaleDelayUnit');
const flashSaleApplyDelayButton = document.getElementById('flashSaleApplyDelayButton');
const flashSaleStartNowButton = document.getElementById('flashSaleStartNowButton');
const flashSaleSchedulePreview = document.getElementById('flashSaleSchedulePreview');
const flashSaleDurationButtons = document.querySelectorAll('[data-flash-sale-duration]');
const refreshProductsButton = document.getElementById('refresh-products-button');
const resetProductFormButton = document.getElementById('reset-product-form-button');
const refreshAdminButton = document.getElementById('refresh-admin-button');

const categoryTableBody = document.getElementById('category-table-body');
const categoryCount = document.getElementById('category-count');
const categoryManagementMessage = document.getElementById('category-management-message');
const categoryForm = document.getElementById('category-form');
const categoryFormTitle = document.getElementById('category-form-title');
const categoryEditorIdInput = document.getElementById('category-editor-id');
const categoryNameInput = document.getElementById('category-name');
const categorySortOrderInput = document.getElementById('category-sort-order');
const categoryActiveInput = document.getElementById('category-active');
const categoryDescriptionInput = document.getElementById('category-description');
const refreshCategoriesButton = document.getElementById('refresh-categories-button');
const resetCategoryFormButton = document.getElementById('reset-category-form-button');
const archiveCategoryButton = document.getElementById('archive-category-button');
const deleteCategoryButton = document.getElementById('delete-category-button');

const userTableBody = document.getElementById('user-table-body');
const userManagementMessage = document.getElementById('user-management-message');
const userSearchInput = document.getElementById('user-search-input');
const userRoleFilter = document.getElementById('user-role-filter');
const refreshUsersButton = document.getElementById('refresh-users-button');
const clearUserSelectionButton = document.getElementById('clear-user-selection');
const userEditorForm = document.getElementById('user-editor-form');
const selectedUserEmpty = document.getElementById('selected-user-empty');
const selectedUserContent = document.getElementById('selected-user-content');
const selectedUserHeading = document.getElementById('selected-user-heading');
const selectedUserIdInput = document.getElementById('selected-user-id');
const selectedUserFullNameInput = document.getElementById('selected-user-full-name');
const selectedUserEmailInput = document.getElementById('selected-user-email');
const selectedUserRoleInput = document.getElementById('selected-user-role');
const selectedUserCreatedAtInput = document.getElementById('selected-user-created-at');
const selectedUserLastLoginInput = document.getElementById('selected-user-last-login');
const deleteUserButton = document.getElementById('delete-user-button');
const selectedUserOrders = document.getElementById('selected-user-orders');
const selectedUserOrdersCaption = document.getElementById('selected-user-orders-caption');
const selectedUserTotalOrders = document.getElementById('selected-user-total-orders');
const selectedUserPendingOrders = document.getElementById('selected-user-pending-orders');
const selectedUserPaidOrders = document.getElementById('selected-user-paid-orders');
const selectedUserTotalSpent = document.getElementById('selected-user-total-spent');

const allOrderTableBody = document.getElementById('all-order-table-body');
const allOrderCount = document.getElementById('all-order-count');
const orderManagementMessage = document.getElementById('order-management-message');
const reconciliationResult = document.getElementById('reconciliation-result');
const orderSearchInput = document.getElementById('order-search-input');
const orderStatusFilter = document.getElementById('order-status-filter');
const orderPaymentFilter = document.getElementById('order-payment-filter');
const orderDateFromInput = document.getElementById('order-date-from');
const orderDateToInput = document.getElementById('order-date-to');
const refreshOrdersButton = document.getElementById('refresh-orders-button');
const reconcilePaymentsButton = document.getElementById('reconcile-payments-button');
const repairPaymentsButton = document.getElementById('repair-payments-button');

const overviewProducts = document.getElementById('overview-products');
const overviewUsers = document.getElementById('overview-users');
const overviewAdmins = document.getElementById('overview-admins');
const overviewOrders = document.getElementById('overview-orders');
const overviewPaidOrders = document.getElementById('overview-paid-orders');
const overviewRevenue = document.getElementById('overview-revenue');

let selectedImageUrl = '';
let previewObjectUrl = '';

function getAdminJsonHeaders() {
    return window.Auth
        ? window.Auth.getAuthHeaders({
            'Content-Type': 'application/json'
        })
        : {
            'Content-Type': 'application/json'
        };
}

function getAdminHeaders() {
    return window.Auth ? window.Auth.getAuthHeaders() : {};
}

function revokePreviewObjectUrl() {
    if (!previewObjectUrl) {
        return;
    }

    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
    return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} VND`;
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

function toDateTimeLocalValue(value) {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
        return '';
    }

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
}

function parseDateTimeLocalValue(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

function toApiDateTimeValue(input) {
    const date = parseDateTimeLocalValue(input?.value);
    return date ? date.toISOString() : '';
}

function setDateTimeLocalInput(input, date) {
    if (!input || !date || !Number.isFinite(date.getTime())) {
        return;
    }

    input.value = toDateTimeLocalValue(date);
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

function getFlashSaleStartDate() {
    return parseDateTimeLocalValue(flashSaleStartsAtInput.value);
}

function getFlashSaleEndDate() {
    return parseDateTimeLocalValue(flashSaleEndsAtInput.value);
}

function getFlashSaleDurationMs() {
    const startsAt = getFlashSaleStartDate();
    const endsAt = getFlashSaleEndDate();

    if (startsAt && endsAt && endsAt > startsAt) {
        return endsAt.getTime() - startsAt.getTime();
    }

    return 2 * 60 * 60 * 1000;
}

function getFlashSaleDelayMinutes() {
    const rawValue = Math.max(0, Number(flashSaleDelayValueInput.value) || 0);

    switch (flashSaleDelayUnitInput.value) {
    case 'days':
        return rawValue * 24 * 60;
    case 'hours':
        return rawValue * 60;
    case 'minutes':
    default:
        return rawValue;
    }
}

function formatRemainingTime(milliseconds) {
    const safeMilliseconds = Math.max(0, milliseconds);
    const totalSeconds = Math.floor(safeMilliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
        return `${days} ngày ${hours} giờ ${minutes} phút`;
    }

    return [hours, minutes, seconds]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
}

function getFlashSaleScheduleStatus() {
    const startsAt = getFlashSaleStartDate();
    const endsAt = getFlashSaleEndDate();

    if (!flashSaleEnabledInput.checked) {
        return {
            type: 'muted',
            text: 'Flash sale chưa bật'
        };
    }

    if (!startsAt || !endsAt) {
        return {
            type: 'warning',
            text: 'Cần chọn thời gian bắt đầu và kết thúc'
        };
    }

    if (endsAt <= startsAt) {
        return {
            type: 'error',
            text: 'Thời gian kết thúc phải sau thời gian bắt đầu'
        };
    }

    const now = new Date();

    if (startsAt > now) {
        return {
            type: 'upcoming',
            text: `Đã hẹn chạy sau ${formatRemainingTime(startsAt.getTime() - now.getTime())}`
        };
    }

    if (endsAt > now) {
        return {
            type: 'active',
            text: `Đang chạy, còn ${formatRemainingTime(endsAt.getTime() - now.getTime())}`
        };
    }

    return {
        type: 'ended',
        text: 'Flash sale đã kết thúc'
    };
}

function updateFlashSaleSchedulePreview() {
    if (!flashSaleSchedulePreview) {
        return;
    }

    const status = getFlashSaleScheduleStatus();
    flashSaleSchedulePreview.textContent = status.text;
    flashSaleSchedulePreview.className = `flash-sale-schedule-preview is-${status.type}`;
}

function applyFlashSaleDelaySchedule() {
    const delayMinutes = getFlashSaleDelayMinutes();
    const durationMs = getFlashSaleDurationMs();
    const startsAt = addMinutes(new Date(), delayMinutes);

    flashSaleEnabledInput.checked = true;
    setDateTimeLocalInput(flashSaleStartsAtInput, startsAt);
    setDateTimeLocalInput(flashSaleEndsAtInput, new Date(startsAt.getTime() + durationMs));
    updateFlashSaleSchedulePreview();
}

function startFlashSaleNow() {
    const startsAt = new Date();
    const durationMs = getFlashSaleDurationMs();

    flashSaleDelayValueInput.value = '0';
    flashSaleDelayUnitInput.value = 'minutes';
    flashSaleEnabledInput.checked = true;
    setDateTimeLocalInput(flashSaleStartsAtInput, startsAt);
    setDateTimeLocalInput(flashSaleEndsAtInput, new Date(startsAt.getTime() + durationMs));
    updateFlashSaleSchedulePreview();
}

function applyFlashSaleDuration(durationMinutes) {
    const startsAt = getFlashSaleStartDate() || new Date();

    flashSaleEnabledInput.checked = true;
    setDateTimeLocalInput(flashSaleStartsAtInput, startsAt);
    setDateTimeLocalInput(flashSaleEndsAtInput, addMinutes(startsAt, durationMinutes));
    updateFlashSaleSchedulePreview();
}

function validateFlashSaleScheduleBeforeSubmit() {
    if (!flashSaleEnabledInput.checked) {
        return true;
    }

    const status = getFlashSaleScheduleStatus();
    if (status.type === 'warning' || status.type === 'error') {
        alert(status.text);
        return false;
    }

    return true;
}

function getFlashSale(product) {
    return product?.flashSale || {};
}

function isFlashSaleEnabled(product) {
    return getFlashSale(product).enabled === true;
}

function getFlashSaleStatus(product) {
    const flashSale = getFlashSale(product);

    if (!flashSale.enabled) {
        return 'disabled';
    }

    if (product?.isFlashSaleActive) {
        return 'active';
    }

    const startsAt = new Date(flashSale.startsAt || '');
    const endsAt = new Date(flashSale.endsAt || '');
    const now = new Date();

    if (Number.isFinite(startsAt.getTime()) && startsAt > now) {
        return 'upcoming';
    }

    if (Number.isFinite(endsAt.getTime()) && endsAt <= now) {
        return 'ended';
    }

    return 'draft';
}

function getFlashSaleBadge(product) {
    switch (getFlashSaleStatus(product)) {
    case 'active':
        return '<span class="status-badge status-sale">Đang sale</span>';
    case 'upcoming':
        return '<span class="status-badge status-upcoming">Sắp chạy</span>';
    case 'ended':
        return '<span class="status-badge status-outstock">Đã kết thúc</span>';
    case 'draft':
        return '<span class="status-badge status-pending">Chưa đủ lịch</span>';
    default:
        return '<span class="status-badge status-muted">Chưa bật</span>';
    }
}

function renderFlashSaleTableCell(product) {
    const flashSale = getFlashSale(product);

    if (!isFlashSaleEnabled(product)) {
        return '<span class="table-subtext">Không áp dụng</span>';
    }

    const salePrice = product.isFlashSaleActive
        ? product.effectivePrice
        : flashSale.salePrice;
    const remainingText = Number(product.flashSaleStockLimit) > 0
        ? `${Number(product.flashSaleRemainingStock) || 0}/${Number(product.flashSaleStockLimit) || 0} suất`
        : 'Không giới hạn suất';

    return `
        <div class="flash-sale-table-cell">
            ${getFlashSaleBadge(product)}
            <strong>${formatCurrency(salePrice)}</strong>
            <span class="table-subtext">${escapeHtml(flashSale.title || product.flashSaleLabel || 'Flash Sale')}</span>
            <span class="table-subtext">${remainingText}</span>
            <span class="table-subtext">${formatDate(flashSale.startsAt)} - ${formatDate(flashSale.endsAt)}</span>
        </div>
    `;
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

function formatOrderStatus(status) {
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

function getOrderStatusClass(status) {
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

function formatPaymentStatus(status) {
    switch (status) {
    case 'paid':
        return 'Đã thu tiền';
    case 'pending':
        return 'Đang chờ';
    case 'failed':
        return 'Thất bại';
    case 'refunded':
        return 'Đã hoàn tiền';
    default:
        return status || 'Chưa có giao dịch';
    }
}

function getPaymentStatusClass(status) {
    if (status === 'paid') {
        return 'is-paid';
    }

    if (status === 'refunded' || status === 'failed') {
        return 'is-cancelled';
    }

    return 'is-pending';
}

function getImageUrl(image) {
    if (!image) {
        return FALLBACK_IMAGE;
    }

    if (image.startsWith('http')) {
        return image;
    }

    if (image.startsWith('/')) {
        return `${API_BASE}${image}`;
    }

    return image;
}

function getProductStatusBadge(trangThai) {
    if (trangThai === OUT_OF_STOCK_STATUS) {
        return `<span class="status-badge status-outstock">${escapeHtml(trangThai)}</span>`;
    }

    return `<span class="status-badge status-instock">${escapeHtml(trangThai || IN_STOCK_STATUS)}</span>`;
}

function getCategoryStatusBadge(isActive) {
    if (isActive) {
        return '<span class="status-badge status-instock">Đang dùng</span>';
    }

    return '<span class="status-badge status-outstock">Tạm ẩn</span>';
}

function normalizeProductListPayload(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    return [];
}

function normalizeCategoryListPayload(payload) {
    return Array.isArray(payload) ? payload : [];
}

function syncStatusFromStock() {
    const stockValue = Math.max(0, Number(stockQuantityInput.value) || 0);
    document.getElementById('trangThai').value = stockValue > 0 ? IN_STOCK_STATUS : OUT_OF_STOCK_STATUS;
}

function syncStockFromStatus() {
    const statusValue = document.getElementById('trangThai').value;
    const currentStock = Math.max(0, Number(stockQuantityInput.value) || 0);

    if (statusValue === OUT_OF_STOCK_STATUS) {
        stockQuantityInput.value = '0';
        return;
    }

    if (currentStock <= 0) {
        stockQuantityInput.value = '1';
    }
}

function getRoleBadge(role) {
    const normalizedRole = role === 'admin' ? 'admin' : 'customer';
    const label = normalizedRole === 'admin' ? 'Admin' : 'Khách hàng';
    return `<span class="role-badge role-${normalizedRole}">${label}</span>`;
}

function setUserManagementMessage(text, type = '') {
    userManagementMessage.textContent = text;
    // Map old class names to new ones
    const classMap = {
        'is-loading': 'account-message loading',
        'is-success': 'account-message success',
        'is-error': 'account-message error',
        'is-info': 'account-message info'
    };
    userManagementMessage.className = classMap[type] || `account-message ${type}`.trim();
}

function setCategoryManagementMessage(text, type = '') {
    categoryManagementMessage.textContent = text;
    // Map old class names to new ones
    const classMap = {
        'is-loading': 'account-message loading',
        'is-success': 'account-message success',
        'is-error': 'account-message error',
        'is-info': 'account-message info'
    };
    categoryManagementMessage.className = classMap[type] || `account-message ${type}`.trim();
}

function setOrderManagementMessage(text, type = '') {
    orderManagementMessage.textContent = text;
    // Map old class names to new ones
    const classMap = {
        'is-loading': 'account-message loading',
        'is-success': 'account-message success',
        'is-error': 'account-message error',
        'is-info': 'account-message info'
    };
    orderManagementMessage.className = classMap[type] || `account-message ${type}`.trim();
}

function getSelectedUser() {
    return state.users.find((user) => user.id === state.selectedUserId) || null;
}

function getSelectedCategory(categoryId = categorySelect.value) {
    return state.categories.find((category) => category._id === categoryId) || null;
}

function getCategoryById(categoryId) {
    return state.categories.find((category) => category._id === categoryId) || null;
}

function canDeleteCategory(category) {
    return Boolean(category?._id);
}

function getCategoryForProduct(product) {
    if (!product) {
        return null;
    }

    const categoryId = product.categoryId ? String(product.categoryId) : '';
    if (categoryId) {
        const matchedById = getCategoryById(categoryId);
        if (matchedById) {
            return matchedById;
        }
    }

    const productCategoryName = String(product.danhMuc || '').trim().toLowerCase();
    if (!productCategoryName) {
        return null;
    }

    return state.categories.find((category) => String(category.name || '').trim().toLowerCase() === productCategoryName) || null;
}

function renderCategoryOptions(selectedId = '') {
    const activeCategories = state.categories.filter((category) => category.isActive);
    const selectedInactiveCategory = selectedId
        ? state.categories.find((category) => category._id === selectedId && !category.isActive)
        : null;
    const options = ['<option value="">Chọn danh mục</option>'];

    activeCategories.forEach((category) => {
        options.push(`<option value="${escapeHtml(category._id)}">${escapeHtml(category.name)}</option>`);
    });

    if (selectedInactiveCategory) {
        options.push(
            `<option value="${escapeHtml(selectedInactiveCategory._id)}">${escapeHtml(selectedInactiveCategory.name)} (tạm ẩn)</option>`
        );
    }

    categorySelect.innerHTML = options.join('');
    categorySelect.value = options.includes(`value="${escapeHtml(selectedId)}"`) ? selectedId : '';
}

function resetCategoryEditor() {
    categoryForm.reset();
    categoryEditorIdInput.value = '';
    categoryNameInput.value = '';
    categorySortOrderInput.value = '0';
    categoryActiveInput.value = 'true';
    categoryDescriptionInput.value = '';
    categoryFormTitle.textContent = 'Tạo danh mục mới';
    archiveCategoryButton.hidden = true;
    deleteCategoryButton.hidden = true;
    deleteCategoryButton.disabled = false;
    deleteCategoryButton.title = '';
}

function fillCategoryEditor(category) {
    categoryEditorIdInput.value = category._id;
    categoryNameInput.value = category.name || '';
    categorySortOrderInput.value = String(Number(category.sortOrder) || 0);
    categoryActiveInput.value = category.isActive ? 'true' : 'false';
    categoryDescriptionInput.value = category.description || '';
    categoryFormTitle.textContent = `Cập nhật ${category.name || 'danh mục'}`;
    archiveCategoryButton.hidden = !category.isActive;
    deleteCategoryButton.hidden = false;
    deleteCategoryButton.disabled = false;
    deleteCategoryButton.title = Number(category.productCount) > 0
        ? 'Xóa danh mục và chuyển sản phẩm sang Chưa phân loại'
        : 'Xóa hẳn danh mục khỏi hệ thống';
}

function getOrdersForUser(userId) {
    return state.orders.filter((order) => order.user?.userId === userId);
}

function getPaymentForOrder(orderId) {
    const payments = state.payments.filter((payment) => payment.orderId === orderId);

    return payments.find((payment) => payment.status === 'paid')
        || payments.find((payment) => payment.status === 'refunded')
        || payments[0]
        || null;
}

function getOrderStats(orders) {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((order) => order.status === 'pending_payment').length;
    const paidOrders = orders.filter((order) => PAID_ORDER_STATUSES.has(order.status)).length;
    const totalSpent = orders
        .filter((order) => PAID_ORDER_STATUSES.has(order.status))
        .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

    return {
        totalOrders,
        pendingOrders,
        paidOrders,
        totalSpent
    };
}

function getOrderActionButtons(order) {
    const actions = ORDER_STATUS_ACTIONS[order.status] || [];
    const refundButton = getRefundActionButton(order);

    if (!actions.length && !refundButton) {
        return '';
    }

    return `
        <div class="order-actions">
            ${actions.map((action) => `
                <button class="${action.status === 'cancelled' || action.status === 'returned' ? 'delete-btn' : 'edit-btn'}" type="button" onclick="updateOrderStatus('${escapeHtml(order._id)}', '${escapeHtml(action.status)}')">
                    ${escapeHtml(action.label)}
                </button>
            `).join('')}
            ${refundButton}
        </div>
    `;
}

function getRefundActionButton(order) {
    const payment = getPaymentForOrder(order._id);

    if (order.status !== 'returned' || payment?.status !== 'paid') {
        return '';
    }

    return `
        <button class="delete-btn" type="button" onclick="refundPayment('${escapeHtml(payment._id)}', '${escapeHtml(order._id)}')">
            Hoàn tiền
        </button>
    `;
}

function getOrderTableActions(order) {
    const actions = ORDER_STATUS_ACTIONS[order.status] || [];
    const actionButtons = actions.map((action) => `
        <button class="${action.status === 'cancelled' || action.status === 'returned' ? 'delete-btn' : 'edit-btn'}" type="button" onclick="updateOrderStatus('${escapeHtml(order._id)}', '${escapeHtml(action.status)}')">
            ${escapeHtml(action.label)}
        </button>
    `).join('');
    const refundButton = getRefundActionButton(order);

    if (!actionButtons && !refundButton) {
        return '<span class="supporting-copy">Không có thao tác</span>';
    }

    return `<div class="order-table-actions">${actionButtons}${refundButton}</div>`;
}

function getOrderSearchText(order, payment) {
    return [
        order._id,
        order.user?.fullName,
        order.user?.email,
        order.customerInfo?.fullName,
        order.customerInfo?.phone,
        order.customerInfo?.address,
        order.transactionId,
        payment?.transactionId,
        payment?.momoOrderId
    ].filter(Boolean).join(' ').toLowerCase();
}

function getOrderPaymentFilterValue(order) {
    const payment = getPaymentForOrder(order._id);
    return payment?.status || 'unpaid';
}

function parseDateFilter(value, isEndOfDay = false) {
    if (!value) {
        return null;
    }

    const date = new Date(`${value}T${isEndOfDay ? '23:59:59.999' : '00:00:00.000'}`);

    return Number.isFinite(date.getTime()) ? date : null;
}

function getFilteredOrders() {
    const query = state.orderSearch.trim().toLowerCase();
    const fromDate = parseDateFilter(state.orderDateFrom);
    const toDate = parseDateFilter(state.orderDateTo, true);

    return state.orders.filter((order) => {
        const payment = getPaymentForOrder(order._id);
        const orderedAt = new Date(order.thoiGian || '');

        if (query && !getOrderSearchText(order, payment).includes(query)) {
            return false;
        }

        if (state.orderStatusFilter !== 'all' && order.status !== state.orderStatusFilter) {
            return false;
        }

        if (state.orderPaymentFilter !== 'all' && getOrderPaymentFilterValue(order) !== state.orderPaymentFilter) {
            return false;
        }

        if (fromDate && (!Number.isFinite(orderedAt.getTime()) || orderedAt < fromDate)) {
            return false;
        }

        if (toDate && (!Number.isFinite(orderedAt.getTime()) || orderedAt > toDate)) {
            return false;
        }

        return true;
    });
}

function renderPaymentSummary(order) {
    const payment = getPaymentForOrder(order._id);
    const paymentStatus = payment?.status || '';
    const method = payment?.method || order.paymentMethod || '';
    const transactionId = payment?.transactionId || order.transactionId || payment?.momoOrderId || '-';

    return `
        <div class="payment-stack">
            <span class="account-status-badge ${getPaymentStatusClass(paymentStatus)}">${escapeHtml(formatPaymentStatus(paymentStatus))}</span>
            <span>${escapeHtml(formatPaymentMethod(method))}</span>
            <span class="payment-meta">${escapeHtml(transactionId)}</span>
            ${payment?.refundAmount ? `<span class="payment-meta">Hoàn: ${formatCurrency(payment.refundAmount)}</span>` : ''}
        </div>
    `;
}

function renderAllOrdersTable() {
    const orders = getFilteredOrders();

    allOrderCount.textContent = `${orders.length}/${state.orders.length} đơn hàng`;

    if (!orders.length) {
        allOrderTableBody.innerHTML = '<tr><td colspan="8">Không có đơn hàng phù hợp bộ lọc.</td></tr>';
        return;
    }

    allOrderTableBody.innerHTML = orders.map((order) => `
        <tr>
            <td>
                <strong>${escapeHtml(order._id)}</strong>
                <span class="table-subtext">${escapeHtml((order.items || []).map((item) => item.name).join(', ') || '-')}</span>
            </td>
            <td>
                ${escapeHtml(order.customerInfo?.fullName || order.user?.fullName || '-')}
                <span class="table-subtext">${escapeHtml(order.user?.email || order.customerInfo?.phone || '-')}</span>
            </td>
            <td>
                <span class="account-status-badge ${getOrderStatusClass(order.status)}">${escapeHtml(formatOrderStatus(order.status))}</span>
            </td>
            <td>${renderPaymentSummary(order)}</td>
            <td>${formatDate(order.thoiGian)}</td>
            <td>${formatDate(getEstimatedDeliveryDate(order))}</td>
            <td>${formatCurrency(order.totalAmount)}</td>
            <td>${getOrderTableActions(order)}</td>
        </tr>
    `).join('');
}

function formatReconciliationIssue(issue) {
    switch (issue?.code) {
    case 'order_not_found':
        return 'Không tìm thấy đơn hàng tương ứng với thanh toán.';
    case 'refund_required':
        return 'Đơn hàng đã hoàn trả nhưng giao dịch chưa được ghi nhận hoàn tiền.';
    case 'paid_payment_waiting_order':
        return 'Thanh toán đã thành công nhưng đơn hàng vẫn đang chờ thanh toán.';
    case 'paid_payment_order_mismatch':
        return 'Thanh toán đã thành công nhưng trạng thái đơn hàng không phù hợp.';
    case 'failed_payment_waiting_order':
        return 'Thanh toán thất bại nhưng đơn hàng vẫn đang chờ thanh toán.';
    case 'failed_payment_paid_order':
        return 'Giao dịch thất bại nhưng đơn hàng đang ở trạng thái đã thu tiền.';
    case 'refunded_payment_order_not_returned':
        return 'Thanh toán đã hoàn tiền nhưng đơn hàng chưa ở trạng thái hoàn trả.';
    case 'stale_pending_payment':
        return 'Giao dịch thanh toán đang chờ quá thời gian xử lý.';
    case 'pending_payment_order_mismatch':
        return 'Giao dịch đang chờ nhưng đơn hàng không còn chờ thanh toán.';
    default:
        return issue?.message || 'Lệch thanh toán cần kiểm tra.';
    }
}

function renderReconciliationResult(result) {
    const issues = Array.isArray(result?.issues) ? result.issues : [];
    const repaired = Array.isArray(result?.repaired) ? result.repaired : [];
    const issuePreview = issues.slice(0, 5).map((issue) => `
        <li>${escapeHtml(issue.orderId)}: ${escapeHtml(formatReconciliationIssue(issue))}${issue.repairError ? ` (${escapeHtml(issue.repairError)})` : ''}</li>
    `).join('');

    reconciliationResult.hidden = false;
    reconciliationResult.innerHTML = `
        <strong>Đã kiểm tra ${Number(result?.checked) || 0} giao dịch.</strong>
        <div>${repaired.length} lệch đã sửa, ${issues.length} lệch cần xử lý.</div>
        ${issuePreview ? `<ul>${issuePreview}</ul>` : '<div>Không còn lệch thanh toán cần xử lý.</div>'}
    `;
}

function renderOverview() {
    const adminCount = state.users.filter((user) => user.role === 'admin').length;
    const customerCount = Math.max(0, state.users.length - adminCount);
    const paidOrders = state.orders.filter((order) => PAID_ORDER_STATUSES.has(order.status));
    const revenue = paidOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

    overviewProducts.textContent = String(state.products.length);
    overviewUsers.textContent = String(state.users.length);
    overviewAdmins.textContent = `${adminCount} admin, ${customerCount} khách hàng`;
    overviewOrders.textContent = String(state.orders.length);
    overviewPaidOrders.textContent = `${paidOrders.length} đơn đã thanh toán`;
    overviewRevenue.textContent = formatCurrency(revenue);
}

function renderOrderCards(container, orders, emptyState) {
    if (!orders.length) {
        container.innerHTML = `
            <div class="empty-account-state compact-empty-state">
                <div class="empty-cart-badge">${escapeHtml(emptyState.badge)}</div>
                <h3>${escapeHtml(emptyState.title)}</h3>
                <p>${escapeHtml(emptyState.description)}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map((order) => {
        const itemsHtml = (order.items || []).map((item) => `
            <div class="order-item-row">
                <div>
                    <p class="order-item-name">${escapeHtml(item.name)}</p>
                    <p class="order-item-meta">
                        ${item.flashSaleApplied ? `<span class="flash-sale-badge">${escapeHtml(item.flashSaleTitle || 'Flash Sale')}</span> ` : ''}
                        ${Number(item.quantity) || 0} x ${item.flashSaleApplied ? `<span class="original-price">${formatCurrency(item.originalPrice || item.price)}</span> ` : ''}${formatCurrency(item.price)}
                    </p>
                </div>
                <strong>${formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong>
            </div>
        `).join('');
        const orderActionsHtml = getOrderActionButtons(order);

        return `
            <article class="order-card">
                <div class="order-card-head">
                    <div>
                        <p class="card-eyebrow">Mã đơn hàng</p>
                        <h3>${escapeHtml(order._id)}</h3>
                    </div>
                    <span class="account-status-badge ${getOrderStatusClass(order.status)}">${escapeHtml(formatOrderStatus(order.status))}</span>
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
                        <strong>${formatCurrency(order.totalAmount)}</strong>
                    </div>
                    <div class="order-block">
                        <span>Phương thức</span>
                        <strong>${escapeHtml(formatPaymentMethod(order.paymentMethod))}</strong>
                    </div>
                    <div class="order-block">
                        <span>Giao dịch</span>
                        <strong>${escapeHtml(order.transactionId || '-')}</strong>
                    </div>
                </div>

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
}

function resetForm() {
    form.reset();
    document.getElementById('product-id').value = '';
    document.getElementById('trangThai').value = IN_STOCK_STATUS;
    stockQuantityInput.value = '1';
    brandInput.value = '';
    tagsInput.value = '';
    flashSaleEnabledInput.checked = false;
    flashSaleTitleInput.value = '';
    flashSaleSalePriceInput.value = '';
    flashSaleStartsAtInput.value = '';
    flashSaleEndsAtInput.value = '';
    flashSaleStockLimitInput.value = '0';
    flashSalePerOrderLimitInput.value = '0';
    flashSaleDelayValueInput.value = '0';
    flashSaleDelayUnitInput.value = 'minutes';
    updateFlashSaleSchedulePreview();
    selectedImageUrl = '';
    newCategoryNameInput.value = '';
    renderCategoryOptions('');
    revokePreviewObjectUrl();
    previewImage.src = '';
    formTitle.textContent = 'Thêm sản phẩm mới';
}

async function fetchProducts() {
    const response = await fetch(`${API_BASE}/api/products?limit=0&sort=newest`, {
        headers: getAdminHeaders()
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.error || payload.message || 'Không tải được sản phẩm.');
    }

    return normalizeProductListPayload(payload);
}

async function fetchCategories() {
    const response = await fetch(`${API_BASE}/api/products/categories/manage?includeInactive=true`, {
        headers: getAdminHeaders()
    });
    const payload = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(payload.error || 'Không tải được danh mục.');
    }

    return normalizeCategoryListPayload(payload);
}

async function fetchUsers() {
    const response = await fetch(`${API_BASE}/api/users`, {
        headers: getAdminHeaders()
    });
    const users = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(users.error || 'Không tải được danh sách người dùng.');
    }

    return Array.isArray(users) ? users : [];
}

async function fetchOrders() {
    const response = await fetch(`${API_BASE}/api/orders`, {
        headers: getAdminHeaders()
    });
    const orders = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(orders.loi || orders.error || 'Không tải được danh sách đơn hàng.');
    }

    return Array.isArray(orders) ? orders : [];
}

async function fetchPayments() {
    const response = await fetch(`${API_BASE}/api/payments`, {
        headers: getAdminHeaders()
    });
    const payments = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(payments.error || 'Không tải được danh sách thanh toán.');
    }

    return Array.isArray(payments) ? payments : [];
}

function renderProductsTable() {
    if (!state.products.length) {
        tableBody.innerHTML = '<tr><td colspan="8">Chưa có sản phẩm nào.</td></tr>';
        productCount.textContent = '0 sản phẩm';
        return;
    }

    productCount.textContent = `${state.products.length} sản phẩm`;
    tableBody.innerHTML = state.products.map((product) => `
        <tr>
            <td>
                <img src="${getImageUrl(product.image)}" alt="${escapeHtml(product.ten)}" onerror="this.src='${FALLBACK_IMAGE}'">
            </td>
            <td>${escapeHtml(product.ten)}</td>
            <td>${formatCurrency(product.gia)}</td>
            <td>${renderFlashSaleTableCell(product)}</td>
            <td>${escapeHtml(product.danhMuc || '')}</td>
            <td>${Number(product.stockQuantity) || 0}</td>
            <td>${getProductStatusBadge(product.trangThai)}</td>
            <td>
                <button class="edit-btn" type="button" onclick="editProduct('${product._id}')">Sửa</button>
                <button class="delete-btn" type="button" onclick="deleteProduct('${product._id}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

function renderCategoryTable() {
    if (!state.categories.length) {
        categoryTableBody.innerHTML = '<tr><td colspan="5">Chưa có danh mục nào.</td></tr>';
        categoryCount.textContent = '0 danh mục';
        return;
    }

    categoryCount.textContent = `${state.categories.length} danh mục`;
    categoryTableBody.innerHTML = state.categories.map((category) => {
        const actionLabel = category.isActive ? 'Ẩn' : 'Kích hoạt';
        const actionClass = category.isActive ? 'delete-btn' : 'edit-btn';
        const deleteButtonMarkup = `<button class="delete-btn" type="button" onclick="deleteCategoryPermanently('${category._id}')" title="${Number(category.productCount) > 0 ? 'Xóa danh mục và chuyển sản phẩm sang Chưa phân loại' : 'Xóa hẳn danh mục khỏi hệ thống'}">Xóa hẳn</button>`;
        const description = category.description
            ? `<span class="table-subtext">${escapeHtml(category.description)}</span>`
            : '<span class="table-subtext">Không có mô tả</span>';

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(category.name)}</strong>
                    ${description}
                </td>
                <td>${getCategoryStatusBadge(category.isActive)}</td>
                <td>${Number(category.sortOrder) || 0}</td>
                <td>${Number(category.productCount) || 0}</td>
                <td>
                    <button class="edit-btn" type="button" onclick="editCategory('${category._id}')">Sửa</button>
                    <button class="${actionClass}" type="button" onclick="toggleCategory('${category._id}', ${category.isActive ? 'false' : 'true'})">${actionLabel}</button>
                    ${deleteButtonMarkup}
                </td>
            </tr>
        `;
    }).join('');
}

async function loadProducts() {
    tableBody.innerHTML = '<tr><td colspan="8">Đang tải dữ liệu...</td></tr>';
    refreshProductsButton.disabled = true;

    try {
        state.products = await fetchProducts();
        renderProductsTable();
        renderOverview();
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
    } finally {
        refreshProductsButton.disabled = false;
    }
}

async function loadCategories({ preserveProductSelection = true, preserveEditorSelection = true } = {}) {
    const previousProductCategoryId = categorySelect.value;
    const previousQuickCategoryName = newCategoryNameInput.value;
    const previousEditorId = categoryEditorIdInput.value;

    refreshCategoriesButton.disabled = true;
    setCategoryManagementMessage('Đang tải danh mục...', 'is-loading');

    try {
        state.categories = await fetchCategories();
        renderCategoryTable();
        renderCategoryOptions(preserveProductSelection ? previousProductCategoryId : '');
        newCategoryNameInput.value = preserveProductSelection ? previousQuickCategoryName : '';

        if (preserveEditorSelection && previousEditorId) {
            const selectedCategory = getCategoryById(previousEditorId);
            if (selectedCategory) {
                fillCategoryEditor(selectedCategory);
            } else {
                resetCategoryEditor();
            }
        } else if (!preserveEditorSelection) {
            resetCategoryEditor();
        }

        setCategoryManagementMessage(`Đã tải ${state.categories.length} danh mục.`, 'is-success');
    } catch (error) {
        console.error(error);
        categoryTableBody.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
        setCategoryManagementMessage(error.message, 'is-error');
    } finally {
        refreshCategoriesButton.disabled = false;
    }
}

function editProduct(id) {
    const product = state.products.find((item) => item._id === id);
    if (!product) {
        return;
    }

    const matchedCategory = getCategoryForProduct(product);
    document.getElementById('product-id').value = product._id;
    document.getElementById('ten').value = product.ten || '';
    document.getElementById('gia').value = product.gia || '';
    brandInput.value = product.brand || '';
    stockQuantityInput.value = String(Number(product.stockQuantity) || 0);
    tagsInput.value = Array.isArray(product.tags) ? product.tags.join(', ') : '';
    flashSaleEnabledInput.checked = isFlashSaleEnabled(product);
    flashSaleTitleInput.value = getFlashSale(product).title || '';
    flashSaleSalePriceInput.value = getFlashSale(product).salePrice || '';
    flashSaleStartsAtInput.value = toDateTimeLocalValue(getFlashSale(product).startsAt);
    flashSaleEndsAtInput.value = toDateTimeLocalValue(getFlashSale(product).endsAt);
    flashSaleStockLimitInput.value = String(Number(getFlashSale(product).stockLimit) || 0);
    flashSalePerOrderLimitInput.value = String(Number(getFlashSale(product).perOrderLimit) || 0);
    flashSaleDelayValueInput.value = '0';
    flashSaleDelayUnitInput.value = 'minutes';
    updateFlashSaleSchedulePreview();
    selectedImageUrl = product.image || '';
    imageInput.value = '';
    revokePreviewObjectUrl();
    document.getElementById('moTa').value = product.moTa || '';
    document.getElementById('trangThai').value = product.trangThai || IN_STOCK_STATUS;
    renderCategoryOptions(matchedCategory?._id || '');
    newCategoryNameInput.value = matchedCategory ? '' : (product.danhMuc || '');
    previewImage.src = getImageUrl(selectedImageUrl);

    formTitle.textContent = 'Cập nhật sản phẩm';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProduct(id) {
    const confirmed = await showConfirmModal(
        'Xóa sản phẩm?',
        'Ẩn sản phẩm này khỏi catalog? Dữ liệu vẫn được giữ lại trong hệ thống và có thể khôi phục lại.',
        { confirmText: 'Xóa', cancelText: 'Hủy', isDangerous: true }
    );

    if (!confirmed) {
        return;
    }

    const button = event?.target;
    if (button) setButtonLoading(button, true);

    try {
        const response = await fetch(`${API_BASE}/api/products/${id}`, {
            method: 'DELETE',
            headers: getAdminJsonHeaders()
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.loi || result.error || result.message || 'Xóa sản phẩm thất bại.');
        }

        showMessage('✓ Xóa sản phẩm thành công!', 'success', document.querySelector('[data-message-container]'), 4000);
        await loadProducts();
        resetForm();
        alert(result.message || 'Đã ẩn sản phẩm khỏi catalog.');
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

function editCategory(id) {
    const category = getCategoryById(id);
    if (!category) {
        return;
    }

    fillCategoryEditor(category);
    window.scrollTo({ top: document.getElementById('category-management').offsetTop - 16, behavior: 'smooth' });
}

async function saveCategory(event) {
    event.preventDefault();

    const categoryId = categoryEditorIdInput.value;
    const payload = {
        name: categoryNameInput.value.trim(),
        description: categoryDescriptionInput.value.trim(),
        sortOrder: String(Math.max(0, Number(categorySortOrderInput.value) || 0)),
        isActive: categoryActiveInput.value === 'true'
    };

    setCategoryManagementMessage(categoryId ? 'Đang cập nhật danh mục...' : 'Đang tạo danh mục...', 'is-loading');

    try {
        const response = await fetch(
            categoryId ? `${API_BASE}/api/products/categories/${categoryId}` : `${API_BASE}/api/products/categories`,
            {
                method: categoryId ? 'PUT' : 'POST',
                headers: getAdminJsonHeaders(),
                body: JSON.stringify(payload)
            }
        );
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Không thể lưu danh mục.');
        }

        await Promise.all([
            loadCategories({ preserveProductSelection: true, preserveEditorSelection: false }),
            loadProducts()
        ]);
        resetCategoryEditor();
        setCategoryManagementMessage(
            categoryId ? 'Đã cập nhật danh mục.' : 'Đã tạo danh mục mới.',
            'is-success'
        );
    } catch (error) {
        console.error(error);
        setCategoryManagementMessage(error.message, 'is-error');
    }
}

async function toggleCategory(categoryId, shouldActivate) {
    const category = getCategoryById(categoryId);
    if (!category) {
        return;
    }

    const actionLabel = shouldActivate ? 'kích hoạt' : 'tạm ẩn';
    const isConfirmed = confirm(`Bạn có chắc muốn ${actionLabel} danh mục "${category.name}"?`);
    if (!isConfirmed) {
        return;
    }

    try {
        let response;

        if (shouldActivate) {
            response = await fetch(`${API_BASE}/api/products/categories/${categoryId}`, {
                method: 'PUT',
                headers: getAdminJsonHeaders(),
                body: JSON.stringify({
                    name: category.name,
                    description: category.description || '',
                    sortOrder: String(Number(category.sortOrder) || 0),
                    isActive: true
                })
            });
        } else {
            response = await fetch(`${API_BASE}/api/products/categories/${categoryId}`, {
                method: 'DELETE',
                headers: getAdminJsonHeaders()
            });
        }

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || `Không thể ${actionLabel} danh mục.`);
        }

        await Promise.all([
            loadCategories({ preserveProductSelection: true, preserveEditorSelection: true }),
            loadProducts()
        ]);
        setCategoryManagementMessage(
            shouldActivate ? 'Đã kích hoạt danh mục.' : 'Đã tạm ẩn danh mục.',
            'is-success'
        );
    } catch (error) {
        console.error(error);
        setCategoryManagementMessage(error.message, 'is-error');
    }
}

async function archiveCurrentCategory() {
    const categoryId = categoryEditorIdInput.value;
    if (!categoryId) {
        return;
    }

    await toggleCategory(categoryId, false);
}

async function deleteCategoryPermanently(categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) {
        return;
    }

    const productCount = Number(category.productCount) || 0;
    const confirmMessage = productCount > 0
        ? `${productCount} sản phẩm đang dùng sẽ được chuyển sang "Chưa phân loại". Hành động này không thể hoàn tác.`
        : `Hành động này sẽ xóa danh mục khỏi hệ thống hoàn toàn và không thể hoàn tác.`;

    const confirmed = await showConfirmModal(
        `Xóa danh mục "${category.name}"?`,
        confirmMessage,
        { confirmText: 'Xóa danh mục', cancelText: 'Hủy', isDangerous: true }
    );

    if (!confirmed) {
        return;
    }

    const button = event?.target;
    if (button) setButtonLoading(button, true);

    try {
        const response = await fetch(`${API_BASE}/api/products/categories/${categoryId}?permanent=true`, {
            method: 'DELETE',
            headers: getAdminJsonHeaders()
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Không thể xóa danh mục.');
        }

        if (categoryEditorIdInput.value === categoryId) {
            resetCategoryEditor();
        }

        await Promise.all([
            loadCategories({ preserveProductSelection: true, preserveEditorSelection: true }),
            loadProducts()
        ]);
        setCategoryManagementMessage(result.message || 'Đã xóa hẳn danh mục khỏi hệ thống.', 'is-success');
    } catch (error) {
        console.error(error);
        setCategoryManagementMessage(error.message, 'is-error');
    }
}

async function deleteCategoryPermanentlyLegacy(categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) {
        return;
    }

    if (!canDeleteCategory(category)) {
        setCategoryManagementMessage('Chỉ có thể xóa hẳn danh mục khi không còn sản phẩm nào đang dùng.', 'is-error');
        return;
    }

    const isConfirmed = confirm(`Xóa hẳn danh mục "${category.name}"? Hành động này sẽ xóa khỏi hệ thống và không thể hoàn tác.`);
    if (!isConfirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/products/categories/${categoryId}?permanent=true`, {
            method: 'DELETE',
            headers: getAdminJsonHeaders()
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Không thể xóa danh mục.');
        }

        if (categoryEditorIdInput.value === categoryId) {
            resetCategoryEditor();
        }

        await loadCategories({ preserveProductSelection: true, preserveEditorSelection: true });
        setCategoryManagementMessage(result.message || 'Đã xóa hẳn danh mục khỏi hệ thống.', 'is-success');
    } catch (error) {
        console.error(error);
        setCategoryManagementMessage(error.message, 'is-error');
    }
}

function getFilteredUsers() {
    const searchValue = state.userSearch.trim().toLowerCase();

    return state.users.filter((user) => {
        const matchesRole = state.userRoleFilter === 'all' || user.role === state.userRoleFilter;
        if (!matchesRole) {
            return false;
        }

        if (!searchValue) {
            return true;
        }

        return [user.fullName, user.email]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(searchValue));
    });
}

function renderUsersTable() {
    const users = getFilteredUsers();

    if (!users.length) {
        userTableBody.innerHTML = '<tr><td colspan="7">Không tìm thấy người dùng phù hợp.</td></tr>';
        return;
    }

    userTableBody.innerHTML = users.map((user) => {
        const stats = getOrderStats(getOrdersForUser(user.id));
        const isSelected = user.id === state.selectedUserId;

        return `
            <tr class="${isSelected ? 'is-selected-row' : ''}">
                <td>${escapeHtml(user.fullName)}</td>
                <td>${escapeHtml(user.email)}</td>
                <td>${getRoleBadge(user.role)}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>${formatDate(user.lastLoginAt)}</td>
                <td>${stats.totalOrders}</td>
                <td>
                    <button class="edit-btn" type="button" onclick="selectUser('${user.id}')">${isSelected ? 'Đang xem' : 'Xem'}</button>
                </td>
            </tr>
        `;
    }).join('');
}

function clearSelectedUser() {
    state.selectedUserId = '';
    renderUsersTable();
    renderSelectedUserPanel();
}

function renderSelectedUserPanel() {
    const user = getSelectedUser();

    if (!user) {
        selectedUserHeading.textContent = 'Chưa chọn tài khoản';
        selectedUserEmpty.hidden = false;
        selectedUserContent.hidden = true;
        return;
    }

    const orders = getOrdersForUser(user.id);
    const stats = getOrderStats(orders);

    selectedUserHeading.textContent = user.fullName;
    selectedUserIdInput.value = user.id;
    selectedUserFullNameInput.value = user.fullName || '';
    selectedUserEmailInput.value = user.email || '';
    selectedUserRoleInput.value = user.role || 'customer';
    selectedUserCreatedAtInput.value = formatDate(user.createdAt);
    selectedUserLastLoginInput.value = formatDate(user.lastLoginAt);

    selectedUserTotalOrders.textContent = String(stats.totalOrders);
    selectedUserPendingOrders.textContent = String(stats.pendingOrders);
    selectedUserPaidOrders.textContent = String(stats.paidOrders);
    selectedUserTotalSpent.textContent = formatCurrency(stats.totalSpent);
    selectedUserOrdersCaption.textContent = `${stats.totalOrders} đơn hàng`;

    renderOrderCards(selectedUserOrders, orders, {
        badge: 'Chưa có đơn hàng',
        title: 'Tài khoản này chưa đặt đơn nào',
        description: 'Khi người dùng hoàn tất checkout, lịch sử đặt hàng sẽ hiển thị tại đây.'
    });

    selectedUserEmpty.hidden = true;
    selectedUserContent.hidden = false;
}

function selectUser(userId) {
    state.selectedUserId = userId;
    renderUsersTable();
    renderSelectedUserPanel();
}

async function loadUsersAndOrders() {
    refreshUsersButton.disabled = true;
    refreshOrdersButton.disabled = true;
    setUserManagementMessage('Đang tải danh sách người dùng và đơn hàng...', 'is-loading');
    setOrderManagementMessage('Đang tải danh sách đơn hàng và thanh toán...', 'is-loading');

    try {
        const [users, orders, payments] = await Promise.all([fetchUsers(), fetchOrders(), fetchPayments()]);
        state.users = users;
        state.orders = orders;
        state.payments = payments;

        if (state.selectedUserId && !state.users.some((user) => user.id === state.selectedUserId)) {
            state.selectedUserId = '';
        }

        renderUsersTable();
        renderSelectedUserPanel();
        renderAllOrdersTable();
        renderOverview();
        setUserManagementMessage(`Đã tải ${users.length} người dùng và ${orders.length} đơn hàng.`, 'is-success');
        setOrderManagementMessage(`Đã tải ${orders.length} đơn hàng và ${payments.length} giao dịch thanh toán.`, 'is-success');
    } catch (error) {
        console.error(error);
        userTableBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        allOrderTableBody.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
        setUserManagementMessage(error.message, 'is-error');
        setOrderManagementMessage(error.message, 'is-error');
    } finally {
        refreshUsersButton.disabled = false;
        refreshOrdersButton.disabled = false;
    }
}

async function updateOrderStatus(orderId, nextStatus) {
    const order = state.orders.find((item) => item._id === orderId);
    const statusLabel = formatOrderStatus(nextStatus);
    const isConfirmed = confirm(`Cập nhật đơn hàng ${orderId} sang "${statusLabel}"?`);

    if (!isConfirmed) {
        return;
    }

    setUserManagementMessage('Đang cập nhật trạng thái đơn hàng...', 'is-loading');
    setOrderManagementMessage('Đang cập nhật trạng thái đơn hàng...', 'is-loading');

    try {
        const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}/status`, {
            method: 'PATCH',
            headers: getAdminJsonHeaders(),
            body: JSON.stringify({
                status: nextStatus,
                reason: nextStatus === 'returned' ? 'admin_returned' : 'admin_update',
                cancelledReason: nextStatus === 'cancelled' ? 'admin_cancelled' : undefined
            })
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.loi || result.error || 'Không thể cập nhật trạng thái đơn hàng.');
        }

        const updatedOrder = result.donHang || result.order || result;
        state.orders = state.orders.map((item) => (item._id === orderId ? updatedOrder : item));

        renderUsersTable();
        renderSelectedUserPanel();
        renderAllOrdersTable();
        renderOverview();
        setUserManagementMessage(`Đã cập nhật đơn hàng ${order?._id || orderId} sang ${statusLabel}.`, 'is-success');
        setOrderManagementMessage(`Đã cập nhật đơn hàng ${order?._id || orderId} sang ${statusLabel}.`, 'is-success');
    } catch (error) {
        console.error(error);
        setUserManagementMessage(error.message, 'is-error');
        setOrderManagementMessage(error.message, 'is-error');
    }
}

async function refundPayment(paymentId, orderId) {
    const payment = state.payments.find((item) => item._id === paymentId);
    const order = state.orders.find((item) => item._id === orderId);
    const amountText = formatCurrency(payment?.amount || order?.totalAmount || 0);
    const isConfirmed = confirm(`Ghi nhận hoàn tiền ${amountText} cho đơn hàng ${orderId}?`);

    if (!isConfirmed) {
        return;
    }

    setOrderManagementMessage('Đang ghi nhận hoàn tiền...', 'is-loading');
    setUserManagementMessage('Đang ghi nhận hoàn tiền...', 'is-loading');

    try {
        const response = await fetch(`${API_BASE}/api/payments/${encodeURIComponent(paymentId)}/refund`, {
            method: 'PATCH',
            headers: getAdminJsonHeaders(),
            body: JSON.stringify({
                amount: payment?.amount || order?.totalAmount,
                reason: 'admin_refund',
                note: `Hoàn tiền cho đơn hàng ${orderId}`
            })
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Không thể ghi nhận hoàn tiền.');
        }

        const updatedPayment = result.payment || result;
        state.payments = state.payments.map((item) => (item._id === paymentId ? updatedPayment : item));

        renderSelectedUserPanel();
        renderAllOrdersTable();
        renderOverview();
        setOrderManagementMessage(`Đã ghi nhận hoàn tiền cho đơn hàng ${orderId}.`, 'is-success');
        setUserManagementMessage(`Đã ghi nhận hoàn tiền cho đơn hàng ${orderId}.`, 'is-success');
    } catch (error) {
        console.error(error);
        setOrderManagementMessage(error.message, 'is-error');
        setUserManagementMessage(error.message, 'is-error');
    }
}

async function runPaymentReconciliation(repair = false) {
    reconcilePaymentsButton.disabled = true;
    repairPaymentsButton.disabled = true;
    setOrderManagementMessage(repair ? 'Đang đối soát và sửa các lệch đơn giản...' : 'Đang đối soát thanh toán...', 'is-loading');

    try {
        const response = await fetch(`${API_BASE}/api/payments/reconcile`, {
            method: 'POST',
            headers: getAdminJsonHeaders(),
            body: JSON.stringify({ repair })
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Không thể đối soát thanh toán.');
        }

        if (repair && Number(result.repairedCount) > 0) {
            await loadUsersAndOrders();
        }

        renderReconciliationResult(result);
        setOrderManagementMessage(
            `Đối soát xong: ${Number(result.repairedCount) || 0} lệch đã sửa, ${Number(result.issueCount) || 0} lệch cần xử lý.`,
            Number(result.issueCount) ? 'is-loading' : 'is-success'
        );
    } catch (error) {
        console.error(error);
        setOrderManagementMessage(error.message, 'is-error');
    } finally {
        reconcilePaymentsButton.disabled = false;
        repairPaymentsButton.disabled = false;
    }
}

async function saveSelectedUser(event) {
    event.preventDefault();

    const user = getSelectedUser();
    if (!user) {
        return;
    }

    const payload = {
        fullName: selectedUserFullNameInput.value.trim(),
        role: selectedUserRoleInput.value
    };

    try {
        const response = await fetch(`${API_BASE}/api/users/${user.id}`, {
            method: 'PATCH',
            headers: getAdminJsonHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Không thể cập nhật người dùng.');
        }

        const updatedUser = result.user || {};
        state.users = state.users.map((item) => (item.id === user.id ? updatedUser : item));

        renderUsersTable();
        renderSelectedUserPanel();
        renderOverview();
        setUserManagementMessage(`Đã cập nhật tài khoản ${updatedUser.fullName || user.fullName}.`, 'is-success');
    } catch (error) {
        console.error(error);
        setUserManagementMessage(error.message, 'is-error');
    }
}

async function deleteSelectedUser() {
    const user = getSelectedUser();
    if (!user) {
        return;
    }

    const confirmed = await showConfirmModal(
        `Xóa tài khoản ${user.fullName}?`,
        `Tài khoản sẽ bị xóa nhưng lịch sử đơn hàng vẫn được giữ lại. Hành động này không thể hoàn tác.`,
        { confirmText: 'Xóa tài khoản', cancelText: 'Hủy', isDangerous: true }
    );

    if (!confirmed) {
        return;
    }

    const button = deleteUserButton;
    setButtonLoading(button, true);

    try {
        const response = await fetch(`${API_BASE}/api/users/${user.id}`, {
            method: 'DELETE',
            headers: getAdminJsonHeaders()
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Không thể xóa người dùng.');
        }

        state.users = state.users.filter((item) => item.id !== user.id);
        state.selectedUserId = '';
        renderUsersTable();
        renderSelectedUserPanel();
        renderOverview();
        showMessage(`✓ Đã xóa tài khoản ${user.fullName}!`, 'success', document.querySelector('[data-message-container]'), 4000);
    } catch (error) {
        console.error(error);
        showMessage(`✗ ${error.message}`, 'error', document.querySelector('[data-message-container]'), 5000);
    } finally {
        setButtonLoading(button, false);
    }
}

async function loadAdminData() {
    refreshAdminButton.disabled = true;

    await Promise.allSettled([
        loadProducts(),
        loadCategories({ preserveProductSelection: true, preserveEditorSelection: true }),
        loadUsersAndOrders()
    ]);

    refreshAdminButton.disabled = false;
}

imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) {
        revokePreviewObjectUrl();
        previewImage.src = getImageUrl(selectedImageUrl);
        return;
    }

    revokePreviewObjectUrl();
    previewObjectUrl = URL.createObjectURL(file);
    previewImage.src = previewObjectUrl;
});

categorySelect.addEventListener('change', () => {
    if (categorySelect.value) {
        newCategoryNameInput.value = '';
    }
});

newCategoryNameInput.addEventListener('input', () => {
    if (newCategoryNameInput.value.trim()) {
        categorySelect.value = '';
    }
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('product-id').value;
    const productData = new FormData();
    const selectedCategory = getSelectedCategory();
    const quickCategoryName = newCategoryNameInput.value.trim();

    if (!validateFlashSaleScheduleBeforeSubmit()) {
        return;
    }

    productData.append('ten', document.getElementById('ten').value.trim());
    productData.append('gia', String(Number(document.getElementById('gia').value)));
    productData.append('brand', brandInput.value.trim());
    productData.append('stockQuantity', String(Math.max(0, Number(stockQuantityInput.value) || 0)));
    productData.append('tags', tagsInput.value.trim());
    productData.append('flashSaleEnabled', flashSaleEnabledInput.checked ? 'true' : 'false');
    productData.append('flashSaleTitle', flashSaleTitleInput.value.trim());
    productData.append('flashSaleSalePrice', String(Number(flashSaleSalePriceInput.value) || 0));
    productData.append('flashSaleStartsAt', toApiDateTimeValue(flashSaleStartsAtInput));
    productData.append('flashSaleEndsAt', toApiDateTimeValue(flashSaleEndsAtInput));
    productData.append('flashSaleStockLimit', String(Math.max(0, Number(flashSaleStockLimitInput.value) || 0)));
    productData.append('flashSalePerOrderLimit', String(Math.max(0, Number(flashSalePerOrderLimitInput.value) || 0)));
    productData.append('moTa', document.getElementById('moTa').value.trim());
    productData.append('trangThai', document.getElementById('trangThai').value);

    if (quickCategoryName) {
        productData.append('danhMuc', quickCategoryName);
    } else if (selectedCategory) {
        productData.append('categoryId', selectedCategory._id);
        productData.append('danhMuc', selectedCategory.name);
    } else {
        productData.append('danhMuc', '');
    }

    const selectedFile = imageInput.files[0];
    if (selectedFile) {
        productData.append('image', selectedFile);
    }

    try {
        const response = await fetch(
            id ? `${API_BASE}/api/products/${id}` : `${API_BASE}/api/products`,
            {
                method: id ? 'PUT' : 'POST',
                headers: getAdminHeaders(),
                body: productData
            }
        );
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.loi || result.error || result.message || 'Không thể lưu sản phẩm.');
        }

        await Promise.all([
            loadProducts(),
            loadCategories({ preserveProductSelection: true, preserveEditorSelection: true })
        ]);
        resetForm();
        alert(id ? 'Cập nhật sản phẩm thành công.' : 'Thêm sản phẩm thành công.');
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
});

categoryForm.addEventListener('submit', saveCategory);
archiveCategoryButton.addEventListener('click', () => {
    void archiveCurrentCategory();
});
deleteCategoryButton.addEventListener('click', () => {
    void deleteCategoryPermanently(categoryEditorIdInput.value);
});
resetCategoryFormButton.addEventListener('click', resetCategoryEditor);
refreshCategoriesButton.addEventListener('click', () => {
    void loadCategories({ preserveProductSelection: true, preserveEditorSelection: true });
});

resetProductFormButton.addEventListener('click', resetForm);
refreshProductsButton.addEventListener('click', () => {
    void loadProducts();
});
refreshUsersButton.addEventListener('click', () => {
    void loadUsersAndOrders();
});
refreshOrdersButton.addEventListener('click', () => {
    void loadUsersAndOrders();
});
refreshAdminButton.addEventListener('click', () => {
    void loadAdminData();
});
userSearchInput.addEventListener('input', (event) => {
    state.userSearch = event.target.value || '';
    renderUsersTable();
});
userRoleFilter.addEventListener('change', (event) => {
    state.userRoleFilter = event.target.value || 'all';
    renderUsersTable();
});
orderSearchInput.addEventListener('input', (event) => {
    state.orderSearch = event.target.value || '';
    renderAllOrdersTable();
});
orderStatusFilter.addEventListener('change', (event) => {
    state.orderStatusFilter = event.target.value || 'all';
    renderAllOrdersTable();
});
orderPaymentFilter.addEventListener('change', (event) => {
    state.orderPaymentFilter = event.target.value || 'all';
    renderAllOrdersTable();
});
orderDateFromInput.addEventListener('change', (event) => {
    state.orderDateFrom = event.target.value || '';
    renderAllOrdersTable();
});
orderDateToInput.addEventListener('change', (event) => {
    state.orderDateTo = event.target.value || '';
    renderAllOrdersTable();
});
reconcilePaymentsButton.addEventListener('click', () => {
    void runPaymentReconciliation(false);
});
repairPaymentsButton.addEventListener('click', () => {
    void runPaymentReconciliation(true);
});
stockQuantityInput.addEventListener('input', syncStatusFromStock);
document.getElementById('trangThai').addEventListener('change', syncStockFromStatus);
flashSaleApplyDelayButton.addEventListener('click', applyFlashSaleDelaySchedule);
flashSaleStartNowButton.addEventListener('click', startFlashSaleNow);
flashSaleDurationButtons.forEach((button) => {
    button.addEventListener('click', () => {
        applyFlashSaleDuration(Math.max(1, Number(button.dataset.flashSaleDuration) || 60));
    });
});
[
    flashSaleEnabledInput,
    flashSaleStartsAtInput,
    flashSaleEndsAtInput,
    flashSaleDelayValueInput,
    flashSaleDelayUnitInput
].forEach((input) => {
    input.addEventListener('input', updateFlashSaleSchedulePreview);
    input.addEventListener('change', updateFlashSaleSchedulePreview);
});
clearUserSelectionButton.addEventListener('click', clearSelectedUser);
userEditorForm.addEventListener('submit', saveSelectedUser);
deleteUserButton.addEventListener('click', () => {
    void deleteSelectedUser();
});

updateFlashSaleSchedulePreview();
setInterval(updateFlashSaleSchedulePreview, 1000);

void loadAdminData();

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.editCategory = editCategory;
window.toggleCategory = toggleCategory;
window.deleteCategoryPermanently = deleteCategoryPermanently;
window.selectUser = selectUser;
window.updateOrderStatus = updateOrderStatus;
window.refundPayment = refundPayment;
