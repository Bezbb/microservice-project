const API_BASE = 'http://localhost:3000';
const FALLBACK_IMAGE = '/images/default-product.svg';
const CART_STORAGE_KEY = 'cart';
const CHECKOUT_STORAGE_KEY = 'pendingCheckout';
const LEGACY_PAYMENT_STORAGE_KEY = 'pendingPayment';
const OUT_OF_STOCK_STATUS = 'Hết hàng';

function normalizeCart(rawCart) {
    return (rawCart || [])
        .map((item) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price) || 0,
            image: item.image || FALLBACK_IMAGE,
            quantity: Math.max(1, Number(item.quantity) || 1),
            trangThai: item.trangThai || 'Còn hàng'
        }))
        .filter((item) => item.id && item.name);
}

let cart = normalizeCart(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []);

const currencyFormatter = new Intl.NumberFormat('vi-VN');

function formatCurrency(value) {
    return `${currencyFormatter.format(value)} VND`;
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
        return item.image.replace('via.placeholder.com', 'placehold.co');
    }

    if (item.image.startsWith('/')) {
        return `${API_BASE}${item.image}`;
    }

    return item.image;
}

function isOutOfStockProduct(product) {
    return (product?.trangThai || '').trim() === OUT_OF_STOCK_STATUS;
}

function toCartItem(product, quantity = 1) {
    return {
        id: product._id || product.id,
        name: product.ten || product.name,
        price: Number(product.gia ?? product.price) || 0,
        image: product.image || FALLBACK_IMAGE,
        quantity: Math.max(1, Number(quantity) || 1),
        trangThai: product.trangThai || 'Còn hàng'
    };
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

    item.quantity = Math.max(1, item.quantity + delta);
    saveCart();
    renderCartPage();
    updateCartCount();
}

async function fetchProducts() {
    const response = await fetch(`${API_BASE}/api/products`, {
        cache: 'no-store'
    });

    const products = await response.json();

    if (!response.ok || !Array.isArray(products)) {
        throw new Error('Không tải được dữ liệu sản phẩm');
    }

    return products;
}

async function validateCartBeforeCheckout() {
    const products = await fetchProducts();
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

function renderProductsPage(products) {
    const container = document.getElementById('products');
    if (!container) {
        return;
    }

    const isAuthenticated = isAuthenticatedUser();
    container.innerHTML = '';

    products.forEach((product) => {
        const card = document.createElement('article');
        card.className = 'product-card';

        const cartItem = toCartItem(product);
        const outOfStock = isOutOfStockProduct(cartItem);
        const buttonLabel = outOfStock
            ? 'Hết hàng'
            : (isAuthenticated ? 'Thêm vào giỏ' : 'Đăng nhập để mua');

        card.innerHTML = `
            <div class="card-media">
                <img src="${getItemImage(product)}" alt="${product.ten}" loading="lazy">
            </div>
            <div class="card-body">
                <p class="card-eyebrow">${product.danhMuc || 'Sản phẩm'}</p>
                <h3>${product.ten}</h3>
                <p>${product.moTa || 'Sản phẩm chất lượng, phù hợp nhu cầu mua sắm hằng ngày.'}</p>
                <p class="card-price">${formatCurrency(product.gia)}</p>
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

        container.appendChild(card);
    });
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
        .map((warning) => `<div class="warning-card">${warning}</div>`)
        .join('');

    cart.forEach((item, index) => {
        const row = document.createElement('article');
        row.className = 'cart-row';

        row.innerHTML = `
            <img class="cart-row-image" src="${getItemImage(item)}" alt="${item.name}">
            <div class="cart-row-info">
                <p class="card-eyebrow">Sản phẩm</p>
                <h3>${item.name}</h3>
                <p>${formatCurrency(item.price)} / sản phẩm</p>
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
}

async function loadProducts() {
    const container = document.getElementById('products');
    if (container) {
        container.innerHTML = '<div class="loading-card">Đang tải danh sách sản phẩm...</div>';
    }

    try {
        const products = await fetchProducts();
        syncCartWithProducts(products);
        renderProductsPage(products);
    } catch (error) {
        console.error('Lỗi khi nạp sản phẩm:', error);
        if (container) {
            container.innerHTML = '<div class="loading-card error-card">Không tải được danh sách sản phẩm. Hãy tải lại trang.</div>';
        }
    }
}

function initCartPage() {
    const checkoutButton = document.getElementById('checkout-button');

    if (checkoutButton) {
        checkoutButton.addEventListener('click', checkoutCart);
    }

    renderCartPage();
}

updateCartCount();
saveCart();
loadProducts();
initCartPage();

window.goToCart = goToCart;
