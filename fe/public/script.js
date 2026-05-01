const API_BASE = 'http://localhost:3000';
const FALLBACK_IMAGE = 'images/default-product.svg';

function normalizeCart(rawCart) {
    return (rawCart || []).map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        image: item.image || FALLBACK_IMAGE,
        quantity: Math.max(1, Number(item.quantity) || 1)
    }));
}

let cart = normalizeCart(JSON.parse(localStorage.getItem('cart')) || []);

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
    localStorage.setItem('cart', JSON.stringify(cart));
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
    window.location.href = 'cart.html';
}

function getItemImage(item) {
    if (!item.image) return FALLBACK_IMAGE;

    if (item.image.startsWith('http')) {
        return item.image.replace('via.placeholder.com', 'placehold.co');
    }

    if (item.image.startsWith('/')) {
        return `${API_BASE}${item.image}`;
    }

    return item.image;
}

function addToCart(item) {
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
    if (!item) return;

    item.quantity = Math.max(1, item.quantity + delta);
    saveCart();
    renderCartPage();
    updateCartCount();
}

async function createOrdersFromCart() {
    const createdOrders = await Promise.all(
        cart.map((item) =>
            fetch(`${API_BASE}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sanPhamId: item.id,
                    tenSanPham: item.name,
                    giaTien: item.price,
                    soLuong: item.quantity
                })
            }).then((response) => response.json())
        )
    );

    const failedOrder = createdOrders.find((order) => order.loi || order.error || order.message);
    if (failedOrder) {
        throw new Error(failedOrder.loi || failedOrder.error || failedOrder.message);
    }

    return createdOrders;
}

async function checkoutCart() {
    if (cart.length === 0) {
        alert('Giỏ hàng đang trống');
        return;
    }

    const checkoutButton = document.getElementById('checkout-button');
    if (checkoutButton) {
        checkoutButton.disabled = true;
        checkoutButton.textContent = 'Đang xử lý...';
    }

    try {
        const createdOrders = await createOrdersFromCart();
        const totalAmount = getTotalAmount();

        const orderId =
            createdOrders[0]?.donHang?._id ||
            createdOrders[0]?._id ||
            `ORDER-${Date.now()}`;

        localStorage.setItem('pendingPayment', JSON.stringify({
            orderId,
            amount: totalAmount
        }));

        window.location.href = 'payment.html';
    } catch (error) {
        console.error('Lỗi khi chuyển sang thanh toán:', error);
        alert(`Có lỗi: ${error.message}`);
    } finally {
        if (checkoutButton) {
            checkoutButton.disabled = false;
            checkoutButton.textContent = 'Thanh toán tất cả';
        }
    }
}

function renderProductsPage(products) {
    const container = document.getElementById('products');
    if (!container) return;

    container.innerHTML = '';

    products.forEach((product) => {
        const card = document.createElement('article');
        card.className = 'product-card';

        const cartItem = {
            id: product._id || product.id,
            name: product.ten,
            price: product.gia,
            image: product.image
        };

        card.innerHTML = `
            <div class="card-media">
                <img src="${getItemImage(product)}" alt="${product.ten}" loading="lazy">
            </div>
            <div class="card-body">
                <p class="card-eyebrow">${product.danhMuc || 'Sản phẩm'}</p>
                <h3>${product.ten}</h3>
                <p>${product.moTa || 'Sản phẩm chất lượng, phù hợp nhu cầu mua sắm hằng ngày.'}</p>
                <p class="card-price">${formatCurrency(product.gia)}</p>
                <button type="button" class="card-button">Thêm vào giỏ</button>
            </div>
        `;

        const image = card.querySelector('img');
        image.addEventListener('error', () => {
            image.src = FALLBACK_IMAGE;
        });

        card.querySelector('button').addEventListener('click', () => addToCart(cartItem));
        container.appendChild(card);
    });
}

function renderCartPage() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    const totalElement = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout-button');

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-badge">Giỏ hàng đang trống</div>
                <h3>Chưa có sản phẩm nào được chọn</h3>
                <p>Quay lại trang chủ để tiếp tục mua hàng.</p>
                <a class="primary-link" href="/">Quay lại chọn sản phẩm</a>
            </div>
        `;

        if (totalElement) totalElement.textContent = formatCurrency(0);
        if (checkoutButton) checkoutButton.disabled = true;
        return;
    }

    if (checkoutButton) checkoutButton.disabled = false;
    container.innerHTML = '';

    cart.forEach((item, index) => {
        const row = document.createElement('article');
        row.className = 'cart-row';

        row.innerHTML = `
            <img class="cart-row-image" src="${getItemImage(item)}" alt="${item.name}">
            <div class="cart-row-info">
                <p class="card-eyebrow">Sản phẩm</p>
                <h3>${item.name}</h3>
                <p>${formatCurrency(item.price)} / sản phẩm</p>
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

        row.querySelector('[data-action="decrease"]').addEventListener('click', () => changeQuantity(index, -1));
        row.querySelector('[data-action="increase"]').addEventListener('click', () => changeQuantity(index, 1));
        row.querySelector('[data-action="remove"]').addEventListener('click', () => removeItem(index));

        container.appendChild(row);
    });

    if (totalElement) {
        totalElement.textContent = formatCurrency(getTotalAmount());
    }
}

async function loadProducts() {
    const container = document.getElementById('products');
    if (!container) return;

    container.innerHTML = '<div class="loading-card">Đang tải danh sách sản phẩm...</div>';

    try {
        const response = await fetch(`${API_BASE}/api/products`, {
            cache: 'no-store'
        });

        const products = await response.json();

        if (!response.ok || !Array.isArray(products)) {
            throw new Error('Không tải được dữ liệu sản phẩm');
        }

        renderProductsPage(products);
    } catch (error) {
        console.error('Lỗi khi nạp sản phẩm:', error);
        container.innerHTML = '<div class="loading-card error-card">Không tải được danh sách sản phẩm. Hãy tải lại trang.</div>';
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
