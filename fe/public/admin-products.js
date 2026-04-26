const API_BASE = 'http://localhost:3000';
const FALLBACK_IMAGE = 'https://via.placeholder.com/100x100?text=No+Image';

const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !currentUser || currentUser.role !== 'admin') {
    alert('Bạn không có quyền truy cập trang quản trị.');
    window.location.href = '/login.html';
}

const form = document.getElementById('product-form');
const tableBody = document.getElementById('product-table-body');
const productCount = document.getElementById('product-count');
const formTitle = document.getElementById('form-title');
const imageInput = document.getElementById('imageFile');
const previewImage = document.getElementById('preview-image');

function formatCurrency(value) {
    return new Intl.NumberFormat('vi-VN').format(value) + ' VND';
}

function getStatusBadge(trangThai) {
    if (trangThai === 'Hết hàng') {
        return `<span class="status-badge status-outstock">${trangThai}</span>`;
    }
    return `<span class="status-badge status-instock">${trangThai || 'Còn hàng'}</span>`;
}

function resetForm() {
    form.reset();
    document.getElementById('product-id').value = '';
    document.getElementById('trangThai').value = 'Còn hàng';
    document.getElementById('image').value = '';
    previewImage.src = '';
    formTitle.textContent = 'Thêm sản phẩm mới';
}

imageInput.addEventListener('change', async () => {
    const file = imageInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || data.message || 'Upload lỗi');
        }

        document.getElementById('image').value = data.imageUrl;
        previewImage.src = `${API_BASE}${data.imageUrl}`;
    } catch (err) {
        console.error(err);
        alert('Upload ảnh thất bại');
    }
});

async function loadProducts() {
    tableBody.innerHTML = `<tr><td colspan="6">Đang tải dữ liệu...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE}/api/products`);
        const products = await response.json();

        if (!response.ok) {
            throw new Error('Không tải được sản phẩm');
        }

        if (!products.length) {
            tableBody.innerHTML = `<tr><td colspan="6">Chưa có sản phẩm nào.</td></tr>`;
            productCount.textContent = '0 sản phẩm';
            return;
        }

        productCount.textContent = `${products.length} sản phẩm`;

        tableBody.innerHTML = products.map(product => `
            <tr>
                <td>
                    <img src="${product.image ? `${API_BASE}${product.image}` : FALLBACK_IMAGE}" alt="${product.ten}" onerror="this.src='${FALLBACK_IMAGE}'">
                </td>
                <td>${product.ten}</td>
                <td>${formatCurrency(product.gia)}</td>
                <td>${product.danhMuc || ''}</td>
                <td>${getStatusBadge(product.trangThai)}</td>
                <td>
                    <button class="edit-btn" onclick="editProduct('${product._id}')">Sửa</button>
                    <button class="delete-btn" onclick="deleteProduct('${product._id}')">Xóa</button>
                </td>
            </tr>
        `).join('');

        window.currentProducts = products;
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="6">Có lỗi khi tải dữ liệu.</td></tr>`;
    }
}

function editProduct(id) {
    const product = (window.currentProducts || []).find(item => item._id === id);
    if (!product) return;

    document.getElementById('product-id').value = product._id;
    document.getElementById('ten').value = product.ten || '';
    document.getElementById('gia').value = product.gia || '';
    document.getElementById('image').value = product.image || '';
    document.getElementById('moTa').value = product.moTa || '';
    document.getElementById('danhMuc').value = product.danhMuc || '';
    document.getElementById('trangThai').value = product.trangThai || 'Còn hàng';
    previewImage.src = product.image ? `${API_BASE}${product.image}` : '';

    formTitle.textContent = 'Cập nhật sản phẩm';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProduct(id) {
    const isConfirmed = confirm('Bạn có chắc muốn xóa sản phẩm này không?');
    if (!isConfirmed) return;

    try {
        const response = await fetch(`${API_BASE}/api/products/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.loi || result.message || 'Xóa thất bại');
        }

        alert('Xóa sản phẩm thành công');
        loadProducts();
        resetForm();
    } catch (error) {
        console.error(error);
        alert(`Lỗi: ${error.message}`);
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('product-id').value;
    const productData = {
        ten: document.getElementById('ten').value.trim(),
        gia: Number(document.getElementById('gia').value),
        image: document.getElementById('image').value.trim(),
        moTa: document.getElementById('moTa').value.trim(),
        danhMuc: document.getElementById('danhMuc').value.trim(),
        trangThai: document.getElementById('trangThai').value
    };

    try {
        const response = await fetch(
            id ? `${API_BASE}/api/products/${id}` : `${API_BASE}/api/products`,
            {
                method: id ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.loi || result.message || 'Lưu sản phẩm thất bại');
        }

        alert(id ? 'Cập nhật sản phẩm thành công' : 'Thêm sản phẩm thành công');
        resetForm();
        loadProducts();
    } catch (error) {
        console.error(error);
        alert(`Lỗi: ${error.message}`);
    }
});

loadProducts();
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.resetForm = resetForm;
window.loadProducts = loadProducts;