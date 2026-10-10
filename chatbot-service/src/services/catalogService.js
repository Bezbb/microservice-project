const { PRODUCT_SERVICE_URL, INTERNAL_SERVICE_TOKEN } = require('../config/env');
const { removeVietnameseDiacritics, parsePriceFromText } = require('../utils/text');

let cachedProducts = [];
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s cache

async function fetchProductsFromService() {
    try {
        const url = `${PRODUCT_SERVICE_URL}/api/products?limit=100`;
        const response = await fetch(url, {
            headers: {
                'x-internal-service-token': INTERNAL_SERVICE_TOKEN,
                'x-internal-service': 'chatbot-service'
            }
        });

        if (!response.ok) {
            console.warn(`[CatalogService] Failed to fetch products: ${response.status}`);
            return cachedProducts;
        }

        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        cachedProducts = items;
        lastFetchedAt = Date.now();
        return items;
    } catch (error) {
        console.error('[CatalogService] Error fetching products:', error.message);
        return cachedProducts;
    }
}

async function getCatalog(forceRefresh = false) {
    const isExpired = Date.now() - lastFetchedAt > CACHE_TTL_MS;
    if (forceRefresh || isExpired || cachedProducts.length === 0) {
        return await fetchProductsFromService();
    }
    return cachedProducts;
}

function mapToProductSummary(item) {
    const effectivePrice = item.effectivePrice ?? item.gia ?? 0;
    const originalPrice = item.originalPrice ?? item.gia ?? 0;
    const discountPercent = item.discountPercent ?? 0;

    return {
        productId: String(item._id || item.id || ''),
        name: item.ten || '',
        price: effectivePrice,
        originalPrice,
        discountPercent,
        image: item.image || '',
        category: item.danhMuc || '',
        brand: item.brand || '',
        stockQuantity: item.stockQuantity ?? 0,
        isFlashSale: Boolean(item.isFlashSaleActive || item.flashSale?.enabled)
    };
}

async function searchProducts(queryText = '', options = {}) {
    const catalog = await getCatalog();
    const limit = options.limit || 4;
    const normalizedQuery = removeVietnameseDiacritics(queryText);
    const { minPrice, maxPrice } = parsePriceFromText(queryText);

    const isAskingSale = /flash\s*sale|giam\s*gia|khuyen\s*mai|deal|giam\s*sau/i.test(normalizedQuery);
    const isAskingBestSeller = /ban\s*chay|pho\s*bien|hot|yeu\s*thich/i.test(normalizedQuery);
    const queryTokens = normalizedQuery
        .split(/\s+/)
        .filter((token) => token.length > 1 && !['co', 'khong', 'la', 'nhung', 'cac', 'va', 'muon', 'can', 'tim', 'cho', 'minh', 'toi'].includes(token));

    const scored = catalog.map((item) => {
        let score = 0;
        const nameNorm = removeVietnameseDiacritics(item.ten || '');
        const descNorm = removeVietnameseDiacritics(item.moTa || '');
        const catNorm = removeVietnameseDiacritics(item.danhMuc || '');
        const brandNorm = removeVietnameseDiacritics(item.brand || '');
        const tagsNorm = (item.tags || []).map(removeVietnameseDiacritics).join(' ');

        const price = item.effectivePrice ?? item.gia ?? 0;

        // Price filtering score
        if (minPrice !== null && price < minPrice) score -= 50;
        if (maxPrice !== null && price > maxPrice) score -= 50;
        if (maxPrice !== null && price <= maxPrice && price >= (minPrice || 0)) score += 30;

        // Sale filter
        if (isAskingSale && (item.isFlashSaleActive || (item.discountPercent || 0) > 0)) {
            score += 40;
        }

        // Bestseller / stock
        if (item.stockQuantity > 0) score += 5;
        if (item.soldCount > 0) score += Math.min(item.soldCount, 15);

        // Keyword tokens matching
        for (const token of queryTokens) {
            if (nameNorm.includes(token)) score += 25;
            if (catNorm.includes(token)) score += 20;
            if (brandNorm.includes(token)) score += 20;
            if (tagsNorm.includes(token)) score += 15;
            if (descNorm.includes(token)) score += 8;
        }

        // Direct full query substring match
        if (nameNorm.includes(normalizedQuery)) score += 50;
        if (catNorm.includes(normalizedQuery)) score += 40;

        return { item, score };
    });

    const filtered = scored
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => mapToProductSummary(entry.item));

    if (filtered.length === 0 && (isAskingSale || isAskingBestSeller || catalog.length > 0)) {
        // Fallback to top featured or flash sale items
        const fallbacks = catalog
            .filter((item) => item.stockQuantity > 0)
            .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0))
            .slice(0, limit)
            .map(mapToProductSummary);
        return fallbacks;
    }

    return filtered;
}

async function getFlashSaleProducts(limit = 4) {
    const catalog = await getCatalog();
    const flashSales = catalog
        .filter((item) => (item.isFlashSaleActive || (item.discountPercent || 0) > 0) && item.stockQuantity > 0)
        .slice(0, limit)
        .map(mapToProductSummary);
    return flashSales;
}

async function getFeaturedProducts(limit = 4) {
    const catalog = await getCatalog();
    return catalog
        .filter((item) => item.stockQuantity > 0)
        .slice(0, limit)
        .map(mapToProductSummary);
}

module.exports = {
    getCatalog,
    searchProducts,
    getFlashSaleProducts,
    getFeaturedProducts,
    mapToProductSummary
};
