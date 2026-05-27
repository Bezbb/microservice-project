const storefront = window.Storefront;

if (storefront) {
    const categoryExplorerState = {
        categories: [],
        products: [],
        selectedCategory: '',
        sort: 'newest',
        onlyInStock: false,
        searchTerm: ''
    };

    const totalCategoriesElement = document.getElementById('catalog-total-categories');
    const totalProductsElement = document.getElementById('catalog-total-products');
    const categoryFocusElement = document.getElementById('category-focus');
    const categoryGridElement = document.getElementById('catalog-category-grid');
    const categoryProductsElement = document.getElementById('catalog-products');
    const categoryResultsSummaryElement = document.getElementById('catalog-results-summary');
    const categoryActiveFiltersElement = document.getElementById('catalog-active-filters');
    const categorySortSelect = document.getElementById('catalog-sort');
    const categoryStockToggle = document.getElementById('catalog-stock-toggle');
    const categorySearchInput = document.getElementById('catalog-search');
    const categorySelect = document.getElementById('catalog-category-select');
    const categoryResetButton = document.getElementById('catalog-reset-filters');

    function updateCategoryQuery() {
        const url = new URL(window.location.href);

        if (categoryExplorerState.selectedCategory) {
            url.searchParams.set('category', categoryExplorerState.selectedCategory);
        } else {
            url.searchParams.delete('category');
        }

        if (categoryExplorerState.sort && categoryExplorerState.sort !== 'newest') {
            url.searchParams.set('sort', categoryExplorerState.sort);
        } else {
            url.searchParams.delete('sort');
        }

        if (categoryExplorerState.onlyInStock) {
            url.searchParams.set('stock', 'in');
        } else {
            url.searchParams.delete('stock');
        }

        if (categoryExplorerState.searchTerm) {
            url.searchParams.set('search', categoryExplorerState.searchTerm);
        } else {
            url.searchParams.delete('search');
        }

        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    function getSelectedCategory() {
        return categoryExplorerState.categories.find((category) => (
            storefront.normalizeCategoryValue(category.name) === storefront.normalizeCategoryValue(categoryExplorerState.selectedCategory)
        )) || null;
    }

    function hasActiveFilters() {
        return Boolean(
            categoryExplorerState.selectedCategory
            || categoryExplorerState.onlyInStock
            || categoryExplorerState.searchTerm
            || categoryExplorerState.sort !== 'newest'
        );
    }

    function sortProducts(products, sortKey) {
        const sorted = [...products];

        switch (sortKey) {
        case 'price_asc':
            sorted.sort((left, right) => storefront.getProductEffectivePrice(left) - storefront.getProductEffectivePrice(right));
            break;
        case 'price_desc':
            sorted.sort((left, right) => storefront.getProductEffectivePrice(right) - storefront.getProductEffectivePrice(left));
            break;
        case 'name_asc':
            sorted.sort((left, right) => String(left.ten || '').localeCompare(String(right.ten || ''), 'vi'));
            break;
        case 'stock_desc':
            sorted.sort((left, right) => (Number(right.stockQuantity) || 0) - (Number(left.stockQuantity) || 0));
            break;
        case 'newest':
        default:
            sorted.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
            break;
        }

        return sorted;
    }

    function getFilteredProducts() {
        let products = [...categoryExplorerState.products];

        if (categoryExplorerState.selectedCategory) {
            products = products.filter((product) => (
                storefront.normalizeCategoryValue(product.danhMuc) === storefront.normalizeCategoryValue(categoryExplorerState.selectedCategory)
            ));
        }

        if (categoryExplorerState.searchTerm) {
            products = products.filter((product) => storefront.matchesProductSearch(product, categoryExplorerState.searchTerm));
        }

        if (categoryExplorerState.onlyInStock) {
            products = products.filter((product) => !storefront.isOutOfStockProduct(product));
        }

        return sortProducts(products, categoryExplorerState.sort);
    }

    function buildCategoryFocusMarkup() {
        const selectedCategory = getSelectedCategory();
        const totalProducts = categoryExplorerState.products.length;
        const totalInStock = categoryExplorerState.products.filter((product) => !storefront.isOutOfStockProduct(product)).length;

        if (!selectedCategory) {
            return `
                <p class="section-kicker">Toàn cảnh catalog</p>
                <h2>Chọn nhanh danh mục rồi tìm đúng sản phẩm bạn cần</h2>
                <p class="section-copy">Bạn có thể chọn danh mục, gõ từ khóa và chỉ giữ lại các sản phẩm còn hàng mà không cần rời khỏi trang.</p>
                <div class="catalog-focus-metrics">
                    <div>
                        <strong>${categoryExplorerState.categories.length}</strong>
                        <span>danh mục đang hoạt động</span>
                    </div>
                    <div>
                        <strong>${totalProducts}</strong>
                        <span>sản phẩm trên storefront</span>
                    </div>
                    <div>
                        <strong>${totalInStock}</strong>
                        <span>sản phẩm còn hàng</span>
                    </div>
                </div>
            `;
        }

        return `
            <p class="section-kicker">Danh mục đang chọn</p>
            <h2>${storefront.escapeHtml(selectedCategory.name)}</h2>
            <p class="section-copy">${storefront.escapeHtml(selectedCategory.description || 'Danh mục này đang được tối ưu để bạn duyệt nhanh những sản phẩm liên quan.')}</p>
            <div class="catalog-focus-metrics">
                <div>
                    <strong>${Number(selectedCategory.productCount) || 0}</strong>
                    <span>sản phẩm phù hợp</span>
                </div>
                <div>
                    <strong>${Number(selectedCategory.inStockCount) || 0}</strong>
                    <span>còn hàng</span>
                </div>
                <div>
                    <strong>${selectedCategory.minPrice !== null ? storefront.formatCurrency(selectedCategory.minPrice) : 'Đang cập nhật'}</strong>
                    <span>mức giá khởi điểm</span>
                </div>
            </div>
            <div class="catalog-focus-footer">
                <span>${storefront.escapeHtml(selectedCategory.sampleProductName || 'Danh mục đã sẵn sàng để khám phá')}</span>
                <button type="button" class="ghost-button" id="catalog-clear-category">Xem toàn bộ</button>
            </div>
        `;
    }

    function renderCategoryFocus() {
        if (!categoryFocusElement) {
            return;
        }

        categoryFocusElement.innerHTML = buildCategoryFocusMarkup();
        const clearButton = document.getElementById('catalog-clear-category');

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                categoryExplorerState.selectedCategory = '';
                renderCategoryExplorer();
            });
        }
    }

    function renderCategoryGrid() {
        if (!categoryGridElement) {
            return;
        }

        if (!categoryExplorerState.categories.length) {
            categoryGridElement.innerHTML = '<div class="loading-card">Chưa có danh mục nào để hiển thị.</div>';
            return;
        }

        categoryGridElement.innerHTML = '';

        const allButton = document.createElement('button');
        allButton.type = 'button';
        allButton.className = `catalog-browser-item${categoryExplorerState.selectedCategory ? '' : ' is-active'}`;
        allButton.innerHTML = `
            <strong>Tất cả danh mục</strong>
            <span>${categoryExplorerState.products.length} sản phẩm</span>
        `;
        allButton.addEventListener('click', () => {
            categoryExplorerState.selectedCategory = '';
            renderCategoryExplorer();
        });
        categoryGridElement.appendChild(allButton);

        categoryExplorerState.categories.forEach((category, index) => {
            const button = document.createElement('button');
            const theme = storefront.getCategoryTheme(index);
            const isActive = storefront.normalizeCategoryValue(category.name) === storefront.normalizeCategoryValue(categoryExplorerState.selectedCategory);

            button.type = 'button';
            button.className = `catalog-browser-item${isActive ? ' is-active' : ''}`;
            button.style.setProperty('--category-start', theme.start);
            button.style.setProperty('--category-end', theme.end);
            button.innerHTML = `
                <strong>${storefront.escapeHtml(category.name)}</strong>
                <span>${Number(category.productCount) || 0} sản phẩm</span>
            `;
            button.addEventListener('click', () => {
                categoryExplorerState.selectedCategory = category.name;
                renderCategoryExplorer();
            });

            categoryGridElement.appendChild(button);
        });
    }

    function renderCategorySelect() {
        if (!categorySelect) {
            return;
        }

        const previousValue = categorySelect.value;
        categorySelect.innerHTML = '<option value="">Tất cả danh mục</option>';

        categoryExplorerState.categories.forEach((category) => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = `${category.name} (${Number(category.productCount) || 0})`;
            categorySelect.appendChild(option);
        });

        categorySelect.value = categoryExplorerState.selectedCategory || previousValue || '';
    }

    function renderCategoryActiveFilters() {
        if (!categoryActiveFiltersElement) {
            return;
        }

        const activeFilters = [];

        if (categoryExplorerState.selectedCategory) {
            activeFilters.push(`danh mục "${categoryExplorerState.selectedCategory}"`);
        }

        if (categoryExplorerState.searchTerm) {
            activeFilters.push(`từ khóa "${categoryExplorerState.searchTerm}"`);
        }

        if (categoryExplorerState.onlyInStock) {
            activeFilters.push('chỉ còn hàng');
        }

        if (categoryExplorerState.sort !== 'newest') {
            activeFilters.push('đã đổi cách sắp xếp');
        }

        categoryActiveFiltersElement.textContent = activeFilters.length
            ? `Bộ lọc đang áp dụng: ${activeFilters.join(', ')}.`
            : 'Bạn đang xem toàn bộ catalog, chưa áp dụng bộ lọc nào.';
    }

    function renderCategoryResultsSummary(filteredProducts) {
        if (!categoryResultsSummaryElement) {
            return;
        }

        const totalProducts = categoryExplorerState.products.length;

        if (!hasActiveFilters()) {
            categoryResultsSummaryElement.textContent = `Hiển thị ${filteredProducts.length} / ${totalProducts} sản phẩm trên toàn bộ storefront.`;
            return;
        }

        categoryResultsSummaryElement.textContent = `Tìm thấy ${filteredProducts.length} / ${totalProducts} sản phẩm phù hợp với bộ lọc hiện tại.`;
    }

    function renderCategoryProducts() {
        if (!categoryProductsElement) {
            return;
        }

        const filteredProducts = getFilteredProducts();
        renderCategoryActiveFilters();
        renderCategoryResultsSummary(filteredProducts);
        storefront.renderProductGrid(categoryProductsElement, filteredProducts, {
            emptyTitle: categoryExplorerState.selectedCategory
                ? `Chưa có sản phẩm khả dụng trong ${categoryExplorerState.selectedCategory}`
                : 'Không tìm thấy sản phẩm phù hợp',
            emptyDescription: categoryExplorerState.onlyInStock
                ? 'Hãy tắt bộ lọc còn hàng, đổi từ khóa hoặc chuyển sang danh mục khác.'
                : 'Hãy thử một từ khóa khác hoặc đặt lại bộ lọc để xem toàn bộ catalog.'
        });
    }

    function updateCategoryHeroStats() {
        if (totalCategoriesElement) {
            totalCategoriesElement.textContent = String(categoryExplorerState.categories.length);
        }

        if (totalProductsElement) {
            totalProductsElement.textContent = String(categoryExplorerState.products.length);
        }
    }

    function syncControlState() {
        if (categorySortSelect) {
            categorySortSelect.value = categoryExplorerState.sort;
        }

        if (categorySearchInput && categorySearchInput.value !== categoryExplorerState.searchTerm) {
            categorySearchInput.value = categoryExplorerState.searchTerm;
        }

        if (categorySelect) {
            categorySelect.value = categoryExplorerState.selectedCategory;
        }

        if (categoryStockToggle) {
            categoryStockToggle.setAttribute('aria-pressed', categoryExplorerState.onlyInStock ? 'true' : 'false');
            categoryStockToggle.classList.toggle('is-active', categoryExplorerState.onlyInStock);
        }

        if (categoryResetButton) {
            categoryResetButton.disabled = !hasActiveFilters();
        }
    }

    function renderCategoryExplorer() {
        updateCategoryHeroStats();
        renderCategorySelect();
        syncControlState();
        renderCategoryFocus();
        renderCategoryGrid();
        renderCategoryProducts();
        updateCategoryQuery();
    }

    async function initializeCategoryExplorer() {
        if (!categoryProductsElement) {
            return;
        }

        const currentUrl = new URL(window.location.href);
        categoryExplorerState.selectedCategory = currentUrl.searchParams.get('category') || '';
        categoryExplorerState.sort = currentUrl.searchParams.get('sort') || 'newest';
        categoryExplorerState.onlyInStock = currentUrl.searchParams.get('stock') === 'in';
        categoryExplorerState.searchTerm = currentUrl.searchParams.get('search') || '';

        try {
            const [products, categories] = await Promise.all([
                storefront.fetchProductsList(),
                storefront.fetchCategoryBrowse().catch(() => [])
            ]);

            categoryExplorerState.products = products;
            categoryExplorerState.categories = categories.length
                ? categories
                : storefront.deriveCategoryBrowseFromProducts(products);

            const hasSelectedCategory = categoryExplorerState.categories.some((category) => (
                storefront.normalizeCategoryValue(category.name) === storefront.normalizeCategoryValue(categoryExplorerState.selectedCategory)
            ));

            if (!hasSelectedCategory) {
                categoryExplorerState.selectedCategory = '';
            }

            storefront.syncCartWithProducts(products);
            renderCategoryExplorer();
        } catch (error) {
            console.error('Lỗi khi tải trang danh mục:', error);
            categoryFocusElement.innerHTML = '<div class="loading-card error-card">Không tải được dữ liệu danh mục.</div>';
            if (categoryGridElement) {
                categoryGridElement.innerHTML = '<div class="loading-card error-card">Không tải được danh sách danh mục.</div>';
            }
            categoryProductsElement.innerHTML = '<div class="loading-card error-card">Không tải được sản phẩm. Hãy thử tải lại trang.</div>';
            categoryResultsSummaryElement.textContent = 'Không tải được dữ liệu storefront.';
        }
    }

    if (categorySortSelect) {
        categorySortSelect.addEventListener('change', (event) => {
            categoryExplorerState.sort = event.target.value || 'newest';
            renderCategoryExplorer();
        });
    }

    if (categorySearchInput) {
        categorySearchInput.addEventListener('input', (event) => {
            categoryExplorerState.searchTerm = String(event.target.value || '').trim();
            renderCategoryExplorer();
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', (event) => {
            categoryExplorerState.selectedCategory = event.target.value || '';
            renderCategoryExplorer();
        });
    }

    if (categoryStockToggle) {
        categoryStockToggle.addEventListener('click', () => {
            categoryExplorerState.onlyInStock = !categoryExplorerState.onlyInStock;
            renderCategoryExplorer();
        });
    }

    if (categoryResetButton) {
        categoryResetButton.addEventListener('click', () => {
            categoryExplorerState.selectedCategory = '';
            categoryExplorerState.sort = 'newest';
            categoryExplorerState.onlyInStock = false;
            categoryExplorerState.searchTerm = '';
            renderCategoryExplorer();
        });
    }

    void initializeCategoryExplorer();
}
