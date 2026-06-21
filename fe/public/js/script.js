const API_BASE = window.Auth?.API_BASE || window.AppConfig?.API_BASE_URL || window.__API_BASE__ || '';
const FALLBACK_IMAGE = '/images/default-product.svg';
const CART_STORAGE_KEY = 'cart';
const CHECKOUT_STORAGE_KEY = 'pendingCheckout';
const LEGACY_PAYMENT_STORAGE_KEY = 'pendingPayment';
const IN_STOCK_STATUS = 'Còn hàng';
const OUT_OF_STOCK_STATUS = 'Hết hàng';
const CATEGORY_THEMES = [
    { start: '#1e3a8a', end: '#0f172a', glow: 'rgba(96, 165, 250, 0.26)' },
    { start: '#0f766e', end: '#134e4a', glow: 'rgba(45, 212, 191, 0.24)' },
    { start: '#4338ca', end: '#312e81', glow: 'rgba(129, 140, 248, 0.24)' },
    { start: '#0f5f8d', end: '#083344', glow: 'rgba(56, 189, 248, 0.22)' },
    { start: '#9f1239', end: '#4c0519', glow: 'rgba(251, 113, 133, 0.2)' },
    { start: '#166534', end: '#14532d', glow: 'rgba(74, 222, 128, 0.2)' }
];

const homeState = {
    products: [],
    categories: [],
    selectedCategory: '',
    searchTerm: '',
    onlyInStock: false
};

function normalizeCart(rawCart) {
    return (rawCart || [])
        .map((item) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price) || 0,
            originalPrice: Number(item.originalPrice) || Number(item.price) || 0,
            discountPercent: Number(item.discountPercent) || 0,
            flashSaleApplied: item.flashSaleApplied === true,
            flashSaleTitle: item.flashSaleTitle || '',
            flashSaleEndsAt: item.flashSaleEndsAt || null,
            flashSaleRemainingStock: Math.max(0, Number(item.flashSaleRemainingStock) || 0),
            flashSalePerOrderLimit: Math.max(0, Number(item.flashSalePerOrderLimit) || 0),
            image: item.image || FALLBACK_IMAGE,
            quantity: Math.max(1, Number(item.quantity) || 1),
            trangThai: item.trangThai || IN_STOCK_STATUS,
            danhMuc: item.danhMuc || ''
        }))
        .filter((item) => item.id && item.name);
}

let cart = normalizeCart(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []);
let flashSaleCountdownTimer = null;

const currencyFormatter = new Intl.NumberFormat('vi-VN');

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
    return `${currencyFormatter.format(Number(value) || 0)} VND`;
}

function normalizeCategoryValue(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeCategoryKey(value) {
    return normalizeCategoryValue(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
}

function isHiddenStorefrontCategory(categoryName) {
    const key = normalizeCategoryKey(categoryName);

    return key === 'chua phan loai' || key === 'uncategorized';
}

function buildProductSearchText(product) {
    return [
        product?.ten,
        product?.name,
        product?.brand,
        product?.danhMuc,
        product?.moTa,
        product?.description
    ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
}

function matchesProductSearch(product, searchTerm) {
    const normalizedSearchTerm = normalizeCategoryValue(searchTerm);

    if (!normalizedSearchTerm) {
        return true;
    }

    return buildProductSearchText(product).includes(normalizedSearchTerm);
}

function getTotalQuantity() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function getTotalAmount() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function updateCartCount() {
    const totalQuantity = getTotalQuantity();

    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = `Giỏ hàng (${totalQuantity})`;
    }

    const cartCountSummary = document.getElementById('cart-count-summary');
    if (cartCountSummary) {
        cartCountSummary.textContent = `${totalQuantity} sản phẩm trong giỏ hàng`;
    }
}

function goToCart() {
    window.location.href = '/cart.html';
}

function isAuthenticatedUser() {
    return Boolean(window.Auth && window.Auth.isAuthenticated());
}

function redirectToLogin() {
    if (window.Auth && typeof window.Auth.redirectToLogin === 'function') {
        window.Auth.redirectToLogin();
        return;
    }

    window.location.href = '/login.html';
}

function requireAuthentication(message) {
    if (isAuthenticatedUser()) {
        return true;
    }

    alert(message);
    redirectToLogin();
    return false;
}

function getItemImage(item) {
    if (!item.image) {
        return FALLBACK_IMAGE;
    }

    if (item.image.startsWith('http')) {
        return item.image;
    }

    if (item.image.startsWith('/')) {
        return `${API_BASE}${item.image}`;
    }

    return item.image;
}

function isOutOfStockProduct(product) {
    return (product?.trangThai || '').trim() === OUT_OF_STOCK_STATUS;
}

function getProductEffectivePrice(product) {
    return Number(product?.effectivePrice ?? product?.price ?? product?.gia) || 0;
}

function getProductOriginalPrice(product) {
    return Number(product?.originalPrice ?? product?.gia ?? product?.price) || 0;
}

function isFlashSaleProduct(product) {
    return product?.isFlashSaleActive === true || product?.flashSaleApplied === true;
}

function getFlashSaleLimit(item) {
    if (!item?.flashSaleApplied) {
        return Infinity;
    }

    const limits = [];

    if (Number(item.flashSaleRemainingStock) > 0) {
        limits.push(Number(item.flashSaleRemainingStock));
    }

    if (Number(item.flashSalePerOrderLimit) > 0) {
        limits.push(Number(item.flashSalePerOrderLimit));
    }

    return limits.length ? Math.max(1, Math.min(...limits)) : Infinity;
}

function formatFlashSaleCountdown(value) {
    const endsAt = new Date(value || '');
    const remainingMs = Number.isFinite(endsAt.getTime()) ? endsAt.getTime() - Date.now() : 0;

    if (remainingMs <= 0) {
        return '00:00:00';
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
}

function toCartItem(product, quantity = 1) {
    const flashSaleApplied = isFlashSaleProduct(product);

    return {
        id: product._id || product.id,
        name: product.ten || product.name,
        price: getProductEffectivePrice(product),
        originalPrice: getProductOriginalPrice(product),
        discountPercent: Number(product.discountPercent) || 0,
        flashSaleApplied,
        flashSaleTitle: flashSaleApplied ? (product.flashSaleLabel || product.flashSaleTitle || 'Flash Sale') : '',
        flashSaleEndsAt: flashSaleApplied ? (product.flashSaleEndsAt || product.flashSale?.endsAt || null) : null,
        flashSaleRemainingStock: flashSaleApplied ? Math.max(0, Number(product.flashSaleRemainingStock) || 0) : 0,
        flashSalePerOrderLimit: flashSaleApplied ? Math.max(0, Number(product.flashSalePerOrderLimit) || 0) : 0,
        image: product.image || FALLBACK_IMAGE,
        quantity: Math.max(1, Number(quantity) || 1),
        trangThai: product.trangThai || IN_STOCK_STATUS,
        danhMuc: product.danhMuc || ''
    };
}

function getCategoryTheme(index) {
    return CATEGORY_THEMES[index % CATEGORY_THEMES.length];
}

function buildApiUrl(path, query = {}) {
    const url = new URL(path, API_BASE || window.location.origin);

    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            return;
        }

        url.searchParams.set(key, value);
    });

    return url.toString();
}

async function fetchProductsList(filters = {}) {
    const response = await fetch(buildApiUrl('/api/products', filters), {
        cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    const products = Array.isArray(payload) ? payload : payload.items;

    if (!response.ok || !Array.isArray(products)) {
        throw new Error(payload.error || 'Không tải được dữ liệu sản phẩm.');
    }

    return products;
}

async function fetchCategoryBrowse() {
    const response = await fetch(buildApiUrl('/api/products/categories/browse'), {
        cache: 'no-store'
    });
    const payload = await response.json().catch(() => []);

    if (!response.ok || !Array.isArray(payload)) {
        throw new Error('Không tải được dữ liệu danh mục.');
    }

    return payload.filter((category) => category && !isHiddenStorefrontCategory(category.name));
}

function deriveCategoryBrowseFromProducts(products) {
    const categoriesByName = new Map();

    products.forEach((product) => {
        const categoryName = String(product.danhMuc || '').trim();
        if (!categoryName || isHiddenStorefrontCategory(categoryName)) {
            return;
        }

        const existingCategory = categoriesByName.get(categoryName) || {
            _id: categoryName,
            name: categoryName,
            slug: encodeURIComponent(categoryName),
            description: '',
            sortOrder: 0,
            productCount: 0,
            inStockCount: 0,
            minPrice: null,
            sampleImage: '',
            sampleProductName: '',
            sampleBrand: ''
        };

        existingCategory.productCount += 1;
        if (!isOutOfStockProduct(product)) {
            existingCategory.inStockCount += 1;
        }

        const displayPrice = getProductEffectivePrice(product);
        if (existingCategory.minPrice === null || displayPrice < existingCategory.minPrice) {
            existingCategory.minPrice = displayPrice;
        }

        if (!existingCategory.sampleImage && product.image) {
            existingCategory.sampleImage = product.image;
        }

        if (!existingCategory.sampleProductName && product.ten) {
            existingCategory.sampleProductName = product.ten;
        }

        if (!existingCategory.sampleBrand && product.brand) {
            existingCategory.sampleBrand = product.brand;
        }

        categoriesByName.set(categoryName, existingCategory);
    });

    return [...categoriesByName.values()].sort((left, right) => left.name.localeCompare(right.name, 'vi'));
}

function syncCartWithProducts(products) {
    const productMap = new Map(
        products.map((product) => [String(product._id || product.id), product])
    );

    cart = cart.map((item) => {
        const product = productMap.get(String(item.id));
        if (!product) {
            return item;
        }

        return toCartItem(product, item.quantity);
    });

    saveCart();
    updateCartCount();

    if (document.getElementById('cart-items')) {
        renderCartPage();
    }
}

function addToCart(item) {
    if (!requireAuthentication('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.')) {
        return;
    }

    if (isOutOfStockProduct(item)) {
        alert('Sản phẩm này hiện đang hết hàng.');
        return;
    }

    const existingItem = cart.find((cartItem) => cartItem.id === item.id);

    if (existingItem) {
        const nextQuantity = existingItem.quantity + 1;
        const flashSaleLimit = getFlashSaleLimit(existingItem);

        if (nextQuantity > flashSaleLimit) {
            alert(`Sản phẩm flash sale này chỉ còn tối đa ${flashSaleLimit} sản phẩm cho giỏ hàng của bạn.`);
            return;
        }

        existingItem.quantity += 1;
    } else {
        cart.push({
            ...item,
            quantity: 1
        });
    }

    saveCart();
    updateCartCount();
    renderCartPage();
    alert(`Đã thêm "${item.name}" vào giỏ hàng`);
}

function removeItem(index) {
    cart.splice(index, 1);
    saveCart();
    renderCartPage();
    updateCartCount();
}

function changeQuantity(index, delta) {
    const item = cart[index];
    if (!item || isOutOfStockProduct(item)) {
        return;
    }

    const nextQuantity = Math.max(1, item.quantity + delta);
    const flashSaleLimit = getFlashSaleLimit(item);

    if (delta > 0 && nextQuantity > flashSaleLimit) {
        alert(`Sản phẩm flash sale này chỉ còn tối đa ${flashSaleLimit} sản phẩm cho giỏ hàng của bạn.`);
        return;
    }

    item.quantity = nextQuantity;
    saveCart();
    renderCartPage();
    updateCartCount();
}

async function validateCartBeforeCheckout() {
    const products = await fetchProductsList();
    const productMap = new Map(
        products.map((product) => [String(product._id || product.id), product])
    );
    const unavailableItems = [];

    cart = cart.map((item) => {
        const product = productMap.get(String(item.id));

        if (!product) {
            unavailableItems.push(`${item.name} (không còn tồn tại)`);
            return item;
        }

        const syncedItem = toCartItem(product, item.quantity);

        if (isOutOfStockProduct(syncedItem)) {
            unavailableItems.push(`${syncedItem.name} (hết hàng)`);
        }

        const flashSaleLimit = getFlashSaleLimit(syncedItem);
        if (syncedItem.flashSaleApplied && syncedItem.quantity > flashSaleLimit) {
            unavailableItems.push(`${syncedItem.name} (flash sale chỉ còn ${flashSaleLimit} sản phẩm)`);
        }

        return syncedItem;
    });

    saveCart();
    updateCartCount();
    renderCartPage();

    if (unavailableItems.length) {
        throw new Error(`Không thể thanh toán: ${unavailableItems.join(', ')}`);
    }

    return cart.map((item) => ({ ...item }));
}

async function checkoutCart() {
    if (cart.length === 0) {
        alert('Giỏ hàng đang trống');
        return;
    }

    if (!requireAuthentication('Vui lòng đăng nhập để thanh toán.')) {
        return;
    }

    const checkoutButton = document.getElementById('checkout-button');
    if (checkoutButton) {
        checkoutButton.disabled = true;
        checkoutButton.textContent = 'Đang xử lý...';
    }

    try {
        const validItems = await validateCartBeforeCheckout();
        const checkoutData = {
            items: validItems,
            amount: validItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
            orderId: null,
            createdAt: new Date().toISOString()
        };

        localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(checkoutData));
        localStorage.removeItem(LEGACY_PAYMENT_STORAGE_KEY);

        window.location.href = '/payment.html';
    } catch (error) {
        console.error('Lỗi khi chuyển sang thanh toán:', error);
        alert(`Có lỗi: ${error.message}`);
    } finally {
        if (checkoutButton && document.getElementById('cart-items')) {
            renderCartPage();
        }
    }
}

function buildPriceMarkup(product) {
    if (!isFlashSaleProduct(product)) {
        return `<p class="card-price">${formatCurrency(getProductEffectivePrice(product))}</p>`;
    }

    return `
        <div class="flash-price-stack">
            <span class="flash-sale-badge">-${Number(product.discountPercent) || 0}%</span>
            <p class="card-price">${formatCurrency(getProductEffectivePrice(product))}</p>
            <p class="original-price">${formatCurrency(getProductOriginalPrice(product))}</p>
        </div>
    `;
}

function buildFlashSaleMarkup(product) {
    if (!isFlashSaleProduct(product)) {
        return '';
    }

    const remainingStock = Math.max(0, Number(product.flashSaleRemainingStock) || 0);
    const stockLimit = Math.max(0, Number(product.flashSaleStockLimit) || 0);
    const soldPercent = stockLimit > 0
        ? Math.min(100, Math.max(0, ((stockLimit - remainingStock) / stockLimit) * 100))
        : 0;
    const stockText = stockLimit > 0
        ? `Còn ${remainingStock}/${stockLimit} suất`
        : `Còn ${remainingStock || Number(product.stockQuantity) || 0} sản phẩm`;

    return `
        <div class="flash-sale-card-meta">
            <div class="flash-sale-card-top">
                <span>${escapeHtml(product.flashSaleLabel || 'Flash Sale')}</span>
                <strong data-flash-sale-countdown data-sale-ends-at="${escapeHtml(product.flashSaleEndsAt || '')}">
                    ${formatFlashSaleCountdown(product.flashSaleEndsAt)}
                </strong>
            </div>
            <div class="flash-sale-progress" aria-hidden="true">
                <span style="width: ${soldPercent}%"></span>
            </div>
            <p>${stockText}</p>
        </div>
    `;
}

function updateFlashSaleCountdowns() {
    document.querySelectorAll('[data-flash-sale-countdown]').forEach((element) => {
        element.textContent = formatFlashSaleCountdown(element.dataset.saleEndsAt);
    });
}

function ensureFlashSaleCountdownTimer() {
    if (flashSaleCountdownTimer) {
        return;
    }

    flashSaleCountdownTimer = window.setInterval(updateFlashSaleCountdowns, 1000);
}

function createProductCardElement(product) {
    const card = document.createElement('article');
    const flashSaleActive = isFlashSaleProduct(product);
    card.className = `product-card${flashSaleActive ? ' product-card--flash' : ''}`;

    const cartItem = toCartItem(product);
    const outOfStock = isOutOfStockProduct(cartItem);
    const buttonLabel = outOfStock
        ? 'Hết hàng'
        : (isAuthenticatedUser() ? 'Thêm vào giỏ' : 'Đăng nhập để mua');
    const categoryName = String(product.danhMuc || '').trim();
    const categoryMarkup = categoryName && !isHiddenStorefrontCategory(categoryName)
        ? `<a class="card-eyebrow card-eyebrow-link" href="/categories.html?category=${encodeURIComponent(categoryName)}">${escapeHtml(categoryName)}</a>`
        : '<p class="card-eyebrow">Sản phẩm</p>';

    card.innerHTML = `
        <div class="card-media">
            <img src="${getItemImage(product)}" alt="${escapeHtml(product.ten)}" loading="lazy">
        </div>
        <div class="card-body">
            ${categoryMarkup}
            <h3>${escapeHtml(product.ten)}</h3>
            <p>${escapeHtml(product.moTa || 'Sản phẩm chất lượng, phù hợp nhu cầu mua sắm hằng ngày.')}</p>
            <div class="card-meta-line">
                <span>${product.brand ? escapeHtml(product.brand) : 'ShopOnline tuyển chọn'}</span>
                <span>${Number(product.stockQuantity) || 0} sản phẩm</span>
            </div>
            ${buildPriceMarkup(product)}
            ${buildFlashSaleMarkup(product)}
            ${outOfStock ? '<p class="stock-note out-of-stock">Sản phẩm hiện đã hết hàng.</p>' : ''}
            <button type="button" class="card-button" ${outOfStock ? 'disabled' : ''}>
                ${buttonLabel}
            </button>
        </div>
    `;

    const image = card.querySelector('img');
    image.addEventListener('error', () => {
        image.src = FALLBACK_IMAGE;
    });

    if (!outOfStock) {
        card.querySelector('button').addEventListener('click', () => addToCart(cartItem));
    }

    return card;
}

function renderProductGrid(container, products, options = {}) {
    if (!container) {
        return;
    }

    const {
        emptyTitle = 'Chưa có sản phẩm phù hợp',
        emptyDescription = 'Hãy thử chọn danh mục khác hoặc quay lại sau.'
    } = options;

    container.innerHTML = '';

    if (!products.length) {
        container.innerHTML = `
            <div class="products-empty-state">
                <div class="empty-cart-badge">Catalog đang trống</div>
                <h3>${escapeHtml(emptyTitle)}</h3>
                <p>${escapeHtml(emptyDescription)}</p>
                <a class="primary-link" href="/categories.html">Khám phá danh mục</a>
            </div>
        `;
        return;
    }

    products.forEach((product) => {
        container.appendChild(createProductCardElement(product));
    });

    if (products.some((product) => isFlashSaleProduct(product))) {
        updateFlashSaleCountdowns();
        ensureFlashSaleCountdownTimer();
    }
}

function getHomeFilteredProducts() {
    let products = [...homeState.products];

    if (homeState.selectedCategory) {
        products = products.filter((product) => (
            normalizeCategoryValue(product.danhMuc) === normalizeCategoryValue(homeState.selectedCategory)
        ));
    }

    if (homeState.searchTerm) {
        products = products.filter((product) => matchesProductSearch(product, homeState.searchTerm));
    }

    if (homeState.onlyInStock) {
        products = products.filter((product) => !isOutOfStockProduct(product));
    }

    return products;
}

function updateHomeUrlState() {
    const url = new URL(window.location.href);

    if (homeState.selectedCategory) {
        url.searchParams.set('category', homeState.selectedCategory);
    } else {
        url.searchParams.delete('category');
    }

    if (homeState.searchTerm) {
        url.searchParams.set('search', homeState.searchTerm);
    } else {
        url.searchParams.delete('search');
    }

    if (homeState.onlyInStock) {
        url.searchParams.set('stock', 'in');
    } else {
        url.searchParams.delete('stock');
    }

    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function syncHomeControlState() {
    const searchInput = document.getElementById('home-search');
    const stockToggle = document.getElementById('home-stock-toggle');
    const resetButton = document.getElementById('home-reset-filters');
    const hasActiveFilters = Boolean(homeState.selectedCategory || homeState.searchTerm || homeState.onlyInStock);

    if (searchInput && searchInput.value !== homeState.searchTerm) {
        searchInput.value = homeState.searchTerm;
    }

    if (stockToggle) {
        stockToggle.setAttribute('aria-pressed', homeState.onlyInStock ? 'true' : 'false');
        stockToggle.classList.toggle('is-active', homeState.onlyInStock);
    }

    if (resetButton) {
        resetButton.disabled = !hasActiveFilters;
    }
}

function renderHomeProductSummary(filteredProducts) {
    const summary = document.getElementById('products-summary');
    if (!summary) {
        return;
    }

    const totalProducts = homeState.products.length;
    const activeFilters = [];

    if (homeState.selectedCategory) {
        activeFilters.push(`danh mục "${homeState.selectedCategory}"`);
    }

    if (homeState.searchTerm) {
        activeFilters.push(`từ khóa "${homeState.searchTerm}"`);
    }

    if (homeState.onlyInStock) {
        activeFilters.push('chỉ còn hàng');
    }

    if (!activeFilters.length) {
        summary.textContent = `Hiển thị ${filteredProducts.length} / ${totalProducts} sản phẩm đang bán trên storefront.`;
        return;
    }

    summary.textContent = `Hiển thị ${filteredProducts.length} / ${totalProducts} sản phẩm theo ${activeFilters.join(', ')}.`;
}

function buildCategoryDescription(category) {
    if (category.description) {
        return category.description;
    }

    if (category.sampleProductName) {
        return `Gợi ý nổi bật: ${category.sampleProductName}${category.sampleBrand ? ` · ${category.sampleBrand}` : ''}`;
    }

    return 'Danh mục mới đang chờ bạn khám phá.';
}

function renderHomeCategoryCards(categories) {
    const container = document.getElementById('categories-grid');
    if (!container) {
        return;
    }

    if (!categories.length) {
        container.innerHTML = '<div class="loading-card">Chưa có danh mục nào sẵn sàng hiển thị.</div>';
        return;
    }

    container.innerHTML = '';

    categories.forEach((category, index) => {
        const theme = getCategoryTheme(index);
        const card = document.createElement('article');
        const isActive = normalizeCategoryValue(category.name) === normalizeCategoryValue(homeState.selectedCategory);

        card.className = `category-card category-card--interactive${isActive ? ' is-active' : ''}`;
        card.style.setProperty('--category-start', theme.start);
        card.style.setProperty('--category-end', theme.end);
        card.style.setProperty('--category-glow', theme.glow);
        card.innerHTML = `
            <div class="category-card-top">
                <span class="category-count">${Number(category.productCount) || 0} sản phẩm</span>
                <span class="category-stock">${Number(category.inStockCount) || 0} còn hàng</span>
            </div>
            <div class="category-card-content">
                <h3>${escapeHtml(category.name)}</h3>
                <p>${escapeHtml(buildCategoryDescription(category))}</p>
            </div>
            <div class="category-card-bottom">
                <button class="category-card-action" type="button">Lọc nhanh</button>
                <a class="category-card-link" href="/categories.html?category=${encodeURIComponent(category.name)}">Mở danh mục</a>
            </div>
        `;

        card.querySelector('.category-card-action').addEventListener('click', () => {
            applyHomeCategoryFilter(category.name, { scroll: true });
        });

        container.appendChild(card);
    });
}

function renderHomeCategoryPills(categories) {
    const container = document.getElementById('category-pills');
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = `category-pill${homeState.selectedCategory ? '' : ' is-active'}`;
    allButton.textContent = 'Tất cả';
    allButton.addEventListener('click', () => {
        applyHomeCategoryFilter('', { scroll: false });
    });
    container.appendChild(allButton);

    categories.forEach((category) => {
        const button = document.createElement('button');
        const isActive = normalizeCategoryValue(category.name) === normalizeCategoryValue(homeState.selectedCategory);

        button.type = 'button';
        button.className = `category-pill${isActive ? ' is-active' : ''}`;
        button.innerHTML = `${escapeHtml(category.name)} <span>${Number(category.productCount) || 0}</span>`;
        button.addEventListener('click', () => {
            applyHomeCategoryFilter(category.name, { scroll: false });
        });

        container.appendChild(button);
    });
}

function getActiveFlashSaleProducts(products) {
    return products
        .filter((product) => isFlashSaleProduct(product) && !isOutOfStockProduct(product))
        .sort((left, right) => new Date(left.flashSaleEndsAt || 0) - new Date(right.flashSaleEndsAt || 0));
}

function renderHomeFlashSale(products) {
    const section = document.getElementById('flash-sale');
    const container = document.getElementById('flash-sale-products');
    const countdown = document.getElementById('flash-sale-countdown');

    if (!section || !container) {
        return;
    }

    const flashSaleProducts = getActiveFlashSaleProducts(products).slice(0, 4);

    if (!flashSaleProducts.length) {
        section.hidden = true;
        container.innerHTML = '';
        return;
    }

    section.hidden = false;
    if (countdown) {
        const firstEndingProduct = flashSaleProducts[0];
        countdown.dataset.saleEndsAt = firstEndingProduct.flashSaleEndsAt || '';
        countdown.setAttribute('data-flash-sale-countdown', '');
        countdown.textContent = formatFlashSaleCountdown(firstEndingProduct.flashSaleEndsAt);
    }

    renderProductGrid(container, flashSaleProducts, {
        emptyTitle: 'Chưa có flash sale đang chạy',
        emptyDescription: 'Các ưu đãi giới hạn sẽ hiển thị tại đây khi được kích hoạt.'
    });
}

function applyHomeCategoryFilter(categoryName, options = {}) {
    const { scroll = false } = options;
    const container = document.getElementById('products');

    homeState.selectedCategory = String(categoryName || '').trim();
    syncHomeControlState();
    renderHomeCategoryCards(homeState.categories);
    renderHomeCategoryPills(homeState.categories);

    const filteredProducts = getHomeFilteredProducts();
    renderProductGrid(container, filteredProducts, {
        emptyTitle: homeState.selectedCategory
            ? `Chưa có sản phẩm trong danh mục ${homeState.selectedCategory}`
            : 'Chưa có sản phẩm để hiển thị',
        emptyDescription: homeState.selectedCategory
            ? 'Bạn có thể chuyển sang danh mục khác hoặc xem toàn bộ catalog.'
            : 'Catalog sẽ tự động xuất hiện khi có sản phẩm khả dụng.'
    });
    renderHomeProductSummary(filteredProducts);
    updateHomeUrlState();

    if (scroll) {
        document.getElementById('products-section')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

function initializeHomeControls() {
    const searchInput = document.getElementById('home-search');
    const stockToggle = document.getElementById('home-stock-toggle');
    const resetButton = document.getElementById('home-reset-filters');

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            homeState.searchTerm = String(event.target.value || '').trim();
            applyHomeCategoryFilter(homeState.selectedCategory, { scroll: false });
        });
    }

    if (stockToggle) {
        stockToggle.addEventListener('click', () => {
            homeState.onlyInStock = !homeState.onlyInStock;
            applyHomeCategoryFilter(homeState.selectedCategory, { scroll: false });
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            homeState.selectedCategory = '';
            homeState.searchTerm = '';
            homeState.onlyInStock = false;
            applyHomeCategoryFilter('', { scroll: false });
        });
    }
}

async function initializeHomePage() {
    const categoriesContainer = document.getElementById('categories-grid');
    const productsContainer = document.getElementById('products');

    if (!categoriesContainer && !productsContainer) {
        return;
    }

    try {
        const [products, categoryBrowse] = await Promise.all([
            fetchProductsList(),
            fetchCategoryBrowse().catch(() => [])
        ]);
        const query = new URLSearchParams(window.location.search);
        const initialCategory = query.get('category') || '';
        const initialSearchTerm = query.get('search') || '';
        const initialOnlyInStock = query.get('stock') === 'in';

        homeState.products = products;
        homeState.categories = categoryBrowse.length ? categoryBrowse : deriveCategoryBrowseFromProducts(products);
        homeState.searchTerm = initialSearchTerm;
        homeState.onlyInStock = initialOnlyInStock;
        syncCartWithProducts(products);
        initializeHomeControls();
        renderHomeCategoryCards(homeState.categories);
        renderHomeCategoryPills(homeState.categories);
        renderHomeFlashSale(products);

        const hasInitialCategory = homeState.categories.some((category) => (
            normalizeCategoryValue(category.name) === normalizeCategoryValue(initialCategory)
        ));

        applyHomeCategoryFilter(hasInitialCategory ? initialCategory : '', { scroll: false });
    } catch (error) {
        console.error('Lỗi khi nạp storefront:', error);

        if (categoriesContainer) {
            categoriesContainer.innerHTML = '<div class="loading-card error-card">Không tải được danh mục. Hãy tải lại trang.</div>';
        }

        if (productsContainer) {
            productsContainer.innerHTML = '<div class="loading-card error-card">Không tải được danh sách sản phẩm. Hãy tải lại trang.</div>';
        }

        const summary = document.getElementById('products-summary');
        if (summary) {
            summary.textContent = 'Không tải được dữ liệu catalog.';
        }
    }
}

function buildCartPriceMarkup(item) {
    if (!item.flashSaleApplied) {
        return `<p>${formatCurrency(item.price)} / sản phẩm</p>`;
    }

    return `
        <div class="cart-sale-price">
            <span class="flash-sale-badge">${escapeHtml(item.flashSaleTitle || 'Flash Sale')}</span>
            <p>
                <span class="original-price">${formatCurrency(item.originalPrice)}</span>
                ${formatCurrency(item.price)} / sản phẩm
            </p>
            ${item.flashSaleEndsAt ? `<span data-flash-sale-countdown data-sale-ends-at="${escapeHtml(item.flashSaleEndsAt)}">${formatFlashSaleCountdown(item.flashSaleEndsAt)}</span>` : ''}
        </div>
    `;
}

function renderCartPage() {
    const container = document.getElementById('cart-items');
    if (!container) {
        return;
    }

    const totalElement = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout-button');
    const isAuthenticated = isAuthenticatedUser();

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-badge">Giỏ hàng đang trống</div>
                <h3>Chưa có sản phẩm nào được chọn</h3>
                <p>Quay lại trang chủ để tiếp tục mua hàng.</p>
                <a class="primary-link" href="/">Quay lại chọn sản phẩm</a>
            </div>
        `;

        if (totalElement) {
            totalElement.textContent = formatCurrency(0);
        }

        if (checkoutButton) {
            checkoutButton.disabled = true;
            checkoutButton.textContent = 'Thanh toán tất cả';
        }

        return;
    }

    const unavailableItems = cart.filter((item) => isOutOfStockProduct(item));
    const cartWarnings = [];

    if (!isAuthenticated) {
        cartWarnings.push('Vui lòng đăng nhập trước khi thanh toán đơn hàng.');
    }

    if (unavailableItems.length) {
        cartWarnings.push(`Có ${unavailableItems.length} sản phẩm đã hết hàng trong giỏ. Vui lòng xóa chúng trước khi thanh toán.`);
    }

    container.innerHTML = cartWarnings
        .map((warning) => `<div class="warning-card">${escapeHtml(warning)}</div>`)
        .join('');

    cart.forEach((item, index) => {
        const row = document.createElement('article');
        row.className = 'cart-row';

        row.innerHTML = `
            <img class="cart-row-image" src="${getItemImage(item)}" alt="${escapeHtml(item.name)}">
            <div class="cart-row-info">
                <p class="card-eyebrow">${escapeHtml(item.danhMuc || 'Sản phẩm')}</p>
                <h3>${escapeHtml(item.name)}</h3>
                ${buildCartPriceMarkup(item)}
                ${isOutOfStockProduct(item) ? '<p class="stock-note out-of-stock">Sản phẩm này hiện đã hết hàng.</p>' : ''}
            </div>
            <div class="cart-row-actions">
                <div class="quantity-control">
                    <button class="qty-button" type="button" data-action="decrease">-</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="qty-button" type="button" data-action="increase">+</button>
                </div>
                <p class="line-total">${formatCurrency(item.price * item.quantity)}</p>
                <button class="ghost-button" type="button" data-action="remove">Xóa</button>
            </div>
        `;

        const image = row.querySelector('img');
        image.addEventListener('error', () => {
            image.src = FALLBACK_IMAGE;
        });

        const decreaseButton = row.querySelector('[data-action="decrease"]');
        const increaseButton = row.querySelector('[data-action="increase"]');
        const removeButton = row.querySelector('[data-action="remove"]');

        increaseButton.disabled = isOutOfStockProduct(item);

        decreaseButton.addEventListener('click', () => changeQuantity(index, -1));
        increaseButton.addEventListener('click', () => changeQuantity(index, 1));
        removeButton.addEventListener('click', () => removeItem(index));

        container.appendChild(row);
    });

    if (checkoutButton) {
        checkoutButton.disabled = unavailableItems.length > 0;
        checkoutButton.textContent = unavailableItems.length > 0
            ? 'Có sản phẩm hết hàng'
            : (isAuthenticated ? 'Thanh toán tất cả' : 'Đăng nhập để thanh toán');
    }

    if (totalElement) {
        totalElement.textContent = formatCurrency(getTotalAmount());
    }

    if (cart.some((item) => item.flashSaleApplied)) {
        updateFlashSaleCountdowns();
        ensureFlashSaleCountdownTimer();
    }
}

function initCartPage() {
    const checkoutButton = document.getElementById('checkout-button');

    if (checkoutButton) {
        checkoutButton.addEventListener('click', checkoutCart);
    }

    renderCartPage();
}

window.Storefront = {
    API_BASE,
    FALLBACK_IMAGE,
    IN_STOCK_STATUS,
    OUT_OF_STOCK_STATUS,
    formatCurrency,
    escapeHtml,
    getItemImage,
    isAuthenticatedUser,
    addToCart,
    fetchProductsList,
    fetchCategoryBrowse,
    deriveCategoryBrowseFromProducts,
    renderProductGrid,
    updateCartCount,
    saveCart,
    syncCartWithProducts,
    toCartItem,
    isOutOfStockProduct,
    isFlashSaleProduct,
    getProductEffectivePrice,
    getProductOriginalPrice,
    getCategoryTheme,
    normalizeCategoryValue,
    isHiddenStorefrontCategory,
    matchesProductSearch,
    goToCart
};

updateCartCount();
saveCart();
void initializeHomePage();
initCartPage();

window.goToCart = goToCart;
