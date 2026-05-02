const Product = require('../models/product');
const { DEFAULT_CATEGORY, PRODUCT_STATUS } = require('../config/constants');
const { ensureCategoryForProduct } = require('./categoryService');
const {
    normalizeText,
    normalizeTags,
    normalizeStatus,
    deriveStatusFromStock,
    parseNonNegativeInteger,
    parsePositiveNumber,
    escapeRegex
} = require('../utils/text');

async function resolveProductCategory(body, existingProduct, actor) {
    const categoryId = normalizeText(
        body.categoryId === undefined ? existingProduct?.categoryId : body.categoryId,
        64
    );
    const categoryName = body.danhMuc === undefined
        ? (existingProduct?.danhMuc || DEFAULT_CATEGORY)
        : normalizeText(body.danhMuc, 120);
    const canReuseInactiveCategory = Boolean(
        existingProduct?.categoryId
        && categoryId
        && String(existingProduct.categoryId) === String(categoryId)
    );

    return ensureCategoryForProduct({
        categoryId,
        categoryName,
        actor,
        allowCreate: true,
        allowInactive: canReuseInactiveCategory
    });
}

async function buildProductPayload(body, {
    existingProduct = null,
    isCreate = false,
    actor = null
} = {}) {
    const errors = [];
    const ten = body.ten === undefined ? existingProduct?.ten : normalizeText(body.ten, 160);
    const moTa = body.moTa === undefined ? (existingProduct?.moTa || '') : normalizeText(body.moTa, 2000);
    const brand = body.brand === undefined ? (existingProduct?.brand || '') : normalizeText(body.brand, 120);
    const tags = body.tags === undefined ? (existingProduct?.tags || []) : normalizeTags(body.tags);
    const requestedPrice = body.gia === undefined ? existingProduct?.gia : parsePositiveNumber(body.gia);
    const requestedStock = body.stockQuantity === undefined ? null : parseNonNegativeInteger(body.stockQuantity);
    const requestedSoldCount = body.soldCount === undefined
        ? (existingProduct?.soldCount ?? 0)
        : parseNonNegativeInteger(body.soldCount);

    if (!ten || ten.length < 2) {
        errors.push('Ten san pham phai co it nhat 2 ky tu.');
    }

    if (requestedPrice === null || requestedPrice === undefined) {
        errors.push('Gia san pham phai lon hon 0.');
    }

    if (body.stockQuantity !== undefined && requestedStock === null) {
        errors.push('So luong ton kho phai la so nguyen khong am.');
    }

    if (body.soldCount !== undefined && requestedSoldCount === null) {
        errors.push('So luong da ban phai la so nguyen khong am.');
    }

    const currentStock = existingProduct?.stockQuantity ?? 0;
    let stockQuantity = currentStock;

    if (requestedStock !== null) {
        stockQuantity = requestedStock;
    } else if (body.trangThai !== undefined || isCreate) {
        const requestedStatus = normalizeStatus(body.trangThai);

        if (requestedStatus === PRODUCT_STATUS.OUT_OF_STOCK) {
            stockQuantity = 0;
        } else if (!existingProduct || currentStock <= 0) {
            stockQuantity = 1;
        }
    }

    if (errors.length) {
        return {
            errors,
            data: null
        };
    }

    const category = await resolveProductCategory(body, existingProduct, actor);

    return {
        errors,
        data: {
            ten,
            gia: requestedPrice,
            moTa,
            danhMuc: category.name,
            categoryId: category._id,
            brand,
            tags,
            stockQuantity,
            soldCount: requestedSoldCount ?? 0,
            trangThai: deriveStatusFromStock(stockQuantity),
            isDeleted: existingProduct?.isDeleted || false,
            deletedAt: existingProduct?.deletedAt || null
        }
    };
}

function getSortDefinition(sortKey) {
    switch (sortKey) {
    case 'price_asc':
        return { gia: 1, createdAt: -1 };
    case 'price_desc':
        return { gia: -1, createdAt: -1 };
    case 'name_asc':
        return { ten: 1, createdAt: -1 };
    case 'name_desc':
        return { ten: -1, createdAt: -1 };
    case 'stock_desc':
        return { stockQuantity: -1, createdAt: -1 };
    case 'oldest':
        return { createdAt: 1 };
    case 'newest':
    default:
        return { createdAt: -1 };
    }
}

function parsePagination(query) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const rawLimit = query.limit === undefined ? 0 : Number.parseInt(query.limit, 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 0;

    return { page, limit };
}

async function listProducts(query, { canIncludeDeleted = false } = {}) {
    const search = normalizeText(query.search, 100);
    const category = normalizeText(query.category, 120);
    const status = normalizeText(query.status, 30);
    const brand = normalizeText(query.brand, 120);
    const minPrice = query.minPrice === undefined ? null : Number(query.minPrice);
    const maxPrice = query.maxPrice === undefined ? null : Number(query.maxPrice);
    const sort = normalizeText(query.sort, 30) || 'newest';
    const { page, limit } = parsePagination(query);
    const filters = {};

    if (!canIncludeDeleted) {
        filters.isDeleted = false;
    }

    if (category) {
        filters.danhMuc = new RegExp(`^${escapeRegex(category)}$`, 'i');
    }

    if (brand) {
        filters.brand = new RegExp(`^${escapeRegex(brand)}$`, 'i');
    }

    if (status === PRODUCT_STATUS.IN_STOCK || status === PRODUCT_STATUS.OUT_OF_STOCK) {
        filters.trangThai = status;
    }

    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
        filters.gia = {};

        if (Number.isFinite(minPrice)) {
            filters.gia.$gte = minPrice;
        }

        if (Number.isFinite(maxPrice)) {
            filters.gia.$lte = maxPrice;
        }
    }

    if (search) {
        const searchRegex = new RegExp(escapeRegex(search), 'i');
        filters.$or = [
            { ten: searchRegex },
            { moTa: searchRegex },
            { danhMuc: searchRegex },
            { brand: searchRegex },
            { tags: searchRegex }
        ];
    }

    const total = await Product.countDocuments(filters);
    const productQuery = Product.find(filters).sort(getSortDefinition(sort));

    if (limit > 0) {
        productQuery.skip((page - 1) * limit).limit(limit);
    }

    const items = await productQuery;

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1
        },
        filters: {
            search,
            category,
            status,
            brand,
            sort
        }
    };
}

module.exports = {
    buildProductPayload,
    listProducts,
    parsePagination,
    getSortDefinition,
    deriveStatusFromStock,
    normalizeStatus,
    parseNonNegativeInteger
};
