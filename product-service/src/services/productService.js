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
    parseOptionalBoolean,
    escapeRegex
} = require('../utils/text');

const FLASH_SALE_DEFAULT_TITLE = 'Flash Sale';

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

function getObjectValue(object, key) {
    return object && Object.prototype.hasOwnProperty.call(object, key)
        ? object[key]
        : undefined;
}

function getFlashSaleInput(body, key, flatKey) {
    const nestedValue = getObjectValue(body.flashSale, key);

    if (nestedValue !== undefined) {
        return nestedValue;
    }

    return getObjectValue(body, flatKey);
}

function parseOptionalDate(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeFlashSaleDocument(flashSale = {}) {
    const startsAt = parseOptionalDate(flashSale.startsAt);
    const endsAt = parseOptionalDate(flashSale.endsAt);
    const salePrice = Number(flashSale.salePrice);
    const stockLimit = parseNonNegativeInteger(flashSale.stockLimit);
    const soldCount = parseNonNegativeInteger(flashSale.soldCount);
    const perOrderLimit = parseNonNegativeInteger(flashSale.perOrderLimit);

    return {
        enabled: Boolean(flashSale.enabled),
        title: normalizeText(flashSale.title, 120),
        salePrice: Number.isFinite(salePrice) && salePrice > 0 ? salePrice : 0,
        startsAt,
        endsAt,
        stockLimit: stockLimit ?? 0,
        soldCount: soldCount ?? 0,
        perOrderLimit: perOrderLimit ?? 0
    };
}

function hasFlashSaleInput(body = {}) {
    return [
        ['enabled', 'flashSaleEnabled'],
        ['title', 'flashSaleTitle'],
        ['salePrice', 'flashSaleSalePrice'],
        ['startsAt', 'flashSaleStartsAt'],
        ['endsAt', 'flashSaleEndsAt'],
        ['stockLimit', 'flashSaleStockLimit'],
        ['perOrderLimit', 'flashSalePerOrderLimit']
    ].some(([key, flatKey]) => getFlashSaleInput(body, key, flatKey) !== undefined);
}

function parseFlashSaleInteger(value, fieldLabel, errors) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return 0;
    }

    const parsed = parseNonNegativeInteger(value);

    if (parsed === null) {
        errors.push(`${fieldLabel} phai la so nguyen khong am.`);
        return 0;
    }

    return parsed;
}

function parseFlashSalePrice(value, errors) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return 0;
    }

    const parsed = parsePositiveNumber(value);

    if (parsed === null) {
        errors.push('Gia flash sale phai lon hon 0.');
        return 0;
    }

    return parsed;
}

function parseFlashSaleDateInput(value, fieldLabel, errors) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return null;
    }

    const date = parseOptionalDate(value);

    if (!date) {
        errors.push(`${fieldLabel} khong hop le.`);
    }

    return date;
}

function buildFlashSalePayload(body, existingProduct, regularPrice, errors) {
    const existingFlashSale = normalizeFlashSaleDocument(existingProduct?.flashSale);

    if (!hasFlashSaleInput(body) && existingProduct) {
        return existingFlashSale;
    }

    const enabledValue = getFlashSaleInput(body, 'enabled', 'flashSaleEnabled');
    const parsedEnabled = enabledValue === undefined ? null : parseOptionalBoolean(enabledValue);

    if (enabledValue !== undefined && parsedEnabled === null) {
        errors.push('Trang thai flash sale khong hop le.');
    }

    const salePrice = parseFlashSalePrice(getFlashSaleInput(body, 'salePrice', 'flashSaleSalePrice'), errors);
    const startsAt = parseFlashSaleDateInput(getFlashSaleInput(body, 'startsAt', 'flashSaleStartsAt'), 'Thoi gian bat dau flash sale', errors);
    const endsAt = parseFlashSaleDateInput(getFlashSaleInput(body, 'endsAt', 'flashSaleEndsAt'), 'Thoi gian ket thuc flash sale', errors);
    const stockLimit = parseFlashSaleInteger(getFlashSaleInput(body, 'stockLimit', 'flashSaleStockLimit'), 'So luong flash sale', errors);
    const perOrderLimit = parseFlashSaleInteger(getFlashSaleInput(body, 'perOrderLimit', 'flashSalePerOrderLimit'), 'Gioi han moi don', errors);
    const nextFlashSale = {
        enabled: enabledValue === undefined ? existingFlashSale.enabled : Boolean(parsedEnabled),
        title: getFlashSaleInput(body, 'title', 'flashSaleTitle') === undefined
            ? existingFlashSale.title
            : normalizeText(getFlashSaleInput(body, 'title', 'flashSaleTitle'), 120),
        salePrice: salePrice === undefined ? existingFlashSale.salePrice : salePrice,
        startsAt: startsAt === undefined ? existingFlashSale.startsAt : startsAt,
        endsAt: endsAt === undefined ? existingFlashSale.endsAt : endsAt,
        stockLimit: stockLimit === undefined ? existingFlashSale.stockLimit : stockLimit,
        soldCount: existingFlashSale.soldCount,
        perOrderLimit: perOrderLimit === undefined ? existingFlashSale.perOrderLimit : perOrderLimit
    };

    if (!nextFlashSale.enabled) {
        return nextFlashSale;
    }

    if (!nextFlashSale.title) {
        nextFlashSale.title = FLASH_SALE_DEFAULT_TITLE;
    }

    if (!nextFlashSale.salePrice || nextFlashSale.salePrice <= 0) {
        errors.push('Can nhap gia flash sale khi kich hoat chuong trinh.');
    } else if (Number.isFinite(regularPrice) && nextFlashSale.salePrice >= regularPrice) {
        errors.push('Gia flash sale phai nho hon gia goc.');
    }

    if (!nextFlashSale.startsAt || !nextFlashSale.endsAt) {
        errors.push('Flash sale can co thoi gian bat dau va ket thuc.');
    } else if (nextFlashSale.startsAt >= nextFlashSale.endsAt) {
        errors.push('Thoi gian ket thuc flash sale phai sau thoi gian bat dau.');
    }

    if (nextFlashSale.stockLimit > 0 && nextFlashSale.soldCount > nextFlashSale.stockLimit) {
        errors.push('So luong flash sale khong duoc nho hon so luong da duoc giu hoac da ban.');
    }

    if (nextFlashSale.perOrderLimit > 0
        && nextFlashSale.stockLimit > 0
        && nextFlashSale.perOrderLimit > nextFlashSale.stockLimit) {
        errors.push('Gioi han moi don khong duoc lon hon so luong flash sale.');
    }

    return nextFlashSale;
}

function toPlainProduct(product) {
    if (!product) {
        return {};
    }

    return typeof product.toObject === 'function'
        ? product.toObject()
        : { ...product };
}

function calculateDiscountPercent(originalPrice, salePrice) {
    if (!Number.isFinite(originalPrice) || originalPrice <= 0 || !Number.isFinite(salePrice) || salePrice <= 0) {
        return 0;
    }

    return Math.max(0, Math.round((1 - (salePrice / originalPrice)) * 100));
}

function getFlashSaleState(product, now = new Date()) {
    const productData = toPlainProduct(product);
    const flashSale = normalizeFlashSaleDocument(productData.flashSale);
    const originalPrice = Number(productData.gia) || 0;
    const stockQuantity = Math.max(0, Number(productData.stockQuantity) || 0);
    const salePrice = Number(flashSale.salePrice) || 0;
    const limitedRemaining = flashSale.stockLimit > 0
        ? Math.max(0, flashSale.stockLimit - flashSale.soldCount)
        : stockQuantity;
    const remainingStock = Math.max(0, Math.min(stockQuantity, limitedRemaining));
    const hasValidWindow = Boolean(
        flashSale.startsAt
        && flashSale.endsAt
        && flashSale.startsAt <= now
        && flashSale.endsAt > now
    );
    const hasValidDiscount = salePrice > 0 && salePrice < originalPrice;
    const isActive = Boolean(
        flashSale.enabled
        && hasValidWindow
        && hasValidDiscount
        && stockQuantity > 0
        && remainingStock > 0
    );

    return {
        ...flashSale,
        salePrice,
        originalPrice,
        stockQuantity,
        remainingStock,
        discountPercent: calculateDiscountPercent(originalPrice, salePrice),
        isActive,
        hasValidWindow,
        hasValidDiscount
    };
}

function getProductPricing(product, options = {}) {
    const now = options.now || new Date();
    const quantity = Math.max(1, Number.parseInt(options.quantity, 10) || 1);
    const state = getFlashSaleState(product, now);
    const exceedsPerOrderLimit = state.perOrderLimit > 0 && quantity > state.perOrderLimit;
    const hasFlashSaleCapacity = state.remainingStock >= quantity;
    const flashSaleApplied = Boolean(state.isActive && hasFlashSaleCapacity && !exceedsPerOrderLimit);
    const finalPrice = flashSaleApplied ? state.salePrice : state.originalPrice;

    return {
        originalPrice: state.originalPrice,
        finalPrice,
        discountPercent: flashSaleApplied ? state.discountPercent : 0,
        isFlashSaleActive: state.isActive,
        flashSaleApplied,
        flashSaleTitle: state.title || FLASH_SALE_DEFAULT_TITLE,
        flashSaleStartsAt: state.startsAt,
        flashSaleEndsAt: state.endsAt,
        flashSaleRemainingStock: state.remainingStock,
        flashSaleStockLimit: state.stockLimit,
        flashSaleSoldCount: state.soldCount,
        flashSalePerOrderLimit: state.perOrderLimit,
        hasFlashSaleCapacity,
        exceedsPerOrderLimit
    };
}

function decorateProduct(product, options = {}) {
    const productData = toPlainProduct(product);
    const pricing = getProductPricing(productData, options);
    delete productData.slug;
    delete productData.sku;

    return {
        ...productData,
        originalPrice: pricing.originalPrice,
        effectivePrice: pricing.finalPrice,
        discountPercent: pricing.discountPercent,
        isFlashSaleActive: pricing.isFlashSaleActive,
        flashSaleApplied: pricing.flashSaleApplied,
        flashSaleLabel: pricing.flashSaleTitle,
        flashSaleStartsAt: pricing.flashSaleStartsAt ? pricing.flashSaleStartsAt.toISOString() : null,
        flashSaleEndsAt: pricing.flashSaleEndsAt ? pricing.flashSaleEndsAt.toISOString() : null,
        flashSaleRemainingStock: pricing.flashSaleRemainingStock,
        flashSaleStockLimit: pricing.flashSaleStockLimit,
        flashSaleSoldCount: pricing.flashSaleSoldCount,
        flashSalePerOrderLimit: pricing.flashSalePerOrderLimit
    };
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

    const flashSale = buildFlashSalePayload(body, existingProduct, requestedPrice, errors);

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
            flashSale,
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
    case 'sale_ending':
        return { 'flashSale.endsAt': 1, createdAt: -1 };
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
    const flashSale = normalizeText(query.flashSale, 30);
    const { page, limit } = parsePagination(query);
    const filters = {};
    const now = new Date();

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

    if (flashSale === 'active') {
        filters.stockQuantity = { $gt: 0 };
        filters['flashSale.enabled'] = true;
        filters['flashSale.salePrice'] = { $gt: 0 };
        filters['flashSale.startsAt'] = { $lte: now };
        filters['flashSale.endsAt'] = { $gt: now };
        filters.$expr = {
            $and: [
                { $lt: ['$flashSale.salePrice', '$gia'] },
                {
                    $or: [
                        { $lte: ['$flashSale.stockLimit', 0] },
                        { $gt: [{ $subtract: ['$flashSale.stockLimit', '$flashSale.soldCount'] }, 0] }
                    ]
                }
            ]
        };
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

    const items = (await productQuery).map((product) => decorateProduct(product, { now }));

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
            sort,
            flashSale
        }
    };
}

module.exports = {
    buildProductPayload,
    decorateProduct,
    getFlashSaleState,
    getProductPricing,
    listProducts,
    parsePagination,
    getSortDefinition,
    deriveStatusFromStock,
    normalizeStatus,
    parseNonNegativeInteger
};
