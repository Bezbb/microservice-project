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
    selectedUserId: '',
    userSearch: '',
    userRoleFilter: 'all'
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

    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));
}

function formatOrderStatus(status) {
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

function getOrderStatusClass(status) {
    if (status === 'paid') {
        return 'is-paid';
    }

    if (status === 'cancelled' || status === 'payment_failed') {
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
    userManagementMessage.className = `account-message ${type}`.trim();
}

function setCategoryManagementMessage(text, type = '') {
    categoryManagementMessage.textContent = text;
    categoryManagementMessage.className = `account-message ${type}`.trim();
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

function getOrderStats(orders) {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((order) => order.status === 'pending_payment').length;
    const paidOrders = orders.filter((order) => order.status === 'paid').length;
    const totalSpent = orders
        .filter((order) => order.status === 'paid')
        .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

    return {
        totalOrders,
        pendingOrders,
        paidOrders,
        totalSpent
    };
}

function renderOverview() {
    const adminCount = state.users.filter((user) => user.role === 'admin').length;
    const customerCount = Math.max(0, state.users.length - adminCount);
    const paidOrders = state.orders.filter((order) => order.status === 'paid');
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
                    <p class="order-item-meta">${Number(item.quantity) || 0} x ${formatCurrency(item.price)}</p>
                </div>
                <strong>${formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong>
            </div>
        `).join('');

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
                        <span>Tổng tiền</span>
                        <strong>${formatCurrency(order.totalAmount)}</strong>
                    </div>
                    <div class="order-block">
                        <span>Phương thức</span>
                        <strong>${escapeHtml(order.paymentMethod || 'Chưa thanh toán')}</strong>
                    </div>
                    <div class="order-block">
                        <span>Giao dịch</span>
                        <strong>${escapeHtml(order.transactionId || '-')}</strong>
                    </div>
                </div>

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

function renderProductsTable() {
    if (!state.products.length) {
        tableBody.innerHTML = '<tr><td colspan="7">Chưa có sản phẩm nào.</td></tr>';
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
    tableBody.innerHTML = '<tr><td colspan="7">Đang tải dữ liệu...</td></tr>';
    refreshProductsButton.disabled = true;

    try {
        state.products = await fetchProducts();
        renderProductsTable();
        renderOverview();
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
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
    const isConfirmed = confirm('Ẩn sản phẩm này khỏi catalog? Dữ liệu vẫn được giữ lại trong hệ thống.');
    if (!isConfirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/products/${id}`, {
            method: 'DELETE',
            headers: getAdminJsonHeaders()
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.loi || result.error || result.message || 'Xóa sản phẩm thất bại.');
        }

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
        ? `Xóa hẳn danh mục "${category.name}"? ${productCount} sản phẩm đang dùng sẽ được chuyển sang "Chưa phân loại".`
        : `Xóa hẳn danh mục "${category.name}"? Hành động này sẽ xóa khỏi hệ thống và không thể hoàn tác.`;

    if (!confirm(confirmMessage)) {
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
    setUserManagementMessage('Đang tải danh sách người dùng và đơn hàng...', 'is-loading');

    try {
        const [users, orders] = await Promise.all([fetchUsers(), fetchOrders()]);
        state.users = users;
        state.orders = orders;

        if (state.selectedUserId && !state.users.some((user) => user.id === state.selectedUserId)) {
            state.selectedUserId = '';
        }

        renderUsersTable();
        renderSelectedUserPanel();
        renderOverview();
        setUserManagementMessage(`Đã tải ${users.length} người dùng và ${orders.length} đơn hàng.`, 'is-success');
    } catch (error) {
        console.error(error);
        userTableBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        setUserManagementMessage(error.message, 'is-error');
    } finally {
        refreshUsersButton.disabled = false;
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

    const isConfirmed = confirm(`Xóa tài khoản ${user.fullName}? Hành động này không xóa lịch sử đơn hàng đã lưu.`);
    if (!isConfirmed) {
        return;
    }

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
        setUserManagementMessage(`Đã xóa tài khoản ${user.fullName}.`, 'is-success');
    } catch (error) {
        console.error(error);
        setUserManagementMessage(error.message, 'is-error');
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

    productData.append('ten', document.getElementById('ten').value.trim());
    productData.append('gia', String(Number(document.getElementById('gia').value)));
    productData.append('brand', brandInput.value.trim());
    productData.append('stockQuantity', String(Math.max(0, Number(stockQuantityInput.value) || 0)));
    productData.append('tags', tagsInput.value.trim());
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
stockQuantityInput.addEventListener('input', syncStatusFromStock);
document.getElementById('trangThai').addEventListener('change', syncStockFromStatus);
clearUserSelectionButton.addEventListener('click', clearSelectedUser);
userEditorForm.addEventListener('submit', saveSelectedUser);
deleteUserButton.addEventListener('click', () => {
    void deleteSelectedUser();
});

void loadAdminData();

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.editCategory = editCategory;
window.toggleCategory = (categoryId, shouldActivate) => {
    void toggleCategory(categoryId, shouldActivate);
};
window.deleteCategoryPermanently = (categoryId) => {
    void deleteCategoryPermanently(categoryId);
};
window.selectUser = selectUser;
