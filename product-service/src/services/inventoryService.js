const Product = require('../models/product');
const { PRODUCT_STATUS } = require('../config/constants');
const { createHttpError } = require('../utils/errors');
const { getProductPricing } = require('./productService');
const {
    normalizeText,
    parsePositiveInteger
} = require('../utils/text');

function isFlashSaleAppliedItem(item) {
    return item?.flashSaleApplied === true || item?.flashSale?.applied === true;
}

function normalizeInventoryRequestItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    const quantitiesByProductId = new Map();

    for (const item of items) {
        const productId = normalizeText(item?.productId || item?.id, 64);
        const quantity = parsePositiveInteger(item?.quantity);

        if (!productId || quantity === null) {
            continue;
        }

        const flashSaleApplied = isFlashSaleAppliedItem(item);
        const key = `${productId}:${flashSaleApplied ? 'flash' : 'regular'}`;
        const existingItem = quantitiesByProductId.get(key) || {
            productId,
            quantity: 0,
            flashSaleApplied
        };

        existingItem.quantity += quantity;
        quantitiesByProductId.set(key, existingItem);
    }

    return [...quantitiesByProductId.values()];
}

function buildCanonicalOrderItem(product, quantity, pricing) {
    return {
        productId: String(product._id),
        name: product.ten,
        price: Number(pricing.finalPrice) || 0,
        originalPrice: Number(pricing.originalPrice) || 0,
        discountPercent: Number(pricing.discountPercent) || 0,
        flashSaleApplied: pricing.flashSaleApplied === true,
        flashSaleTitle: pricing.flashSaleApplied ? pricing.flashSaleTitle : '',
        image: product.image || '',
        quantity
    };
}

function getInventoryStatusMessage(productName, availableStock) {
    if ((Number(availableStock) || 0) <= 0) {
        return `${productName} hien da het hang.`;
    }

    return `${productName} chi con ${availableStock} san pham kha dung.`;
}

function getFlashSaleAvailabilityMessage(productName, pricing) {
    if (pricing.exceedsPerOrderLimit) {
        return `${productName} chi cho phep toi da ${pricing.flashSalePerOrderLimit} san pham trong moi don flash sale.`;
    }

    return `Flash sale cua ${productName} chi con ${pricing.flashSaleRemainingStock} san pham kha dung.`;
}

async function loadProductsForInventory(items) {
    const productIds = [...new Set(items.map((item) => item.productId))];

    if (!productIds.length) {
        throw createHttpError('Don hang phai co it nhat mot san pham hop le.', 400);
    }

    const products = await Product.find({
        _id: { $in: productIds },
        isDeleted: false
    });
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    for (const item of items) {
        if (!productMap.has(item.productId)) {
            throw createHttpError('Co san pham khong con ton tai hoac da bi an khoi catalog.', 404);
        }
    }

    return productMap;
}

function buildReserveQuery(item, pricing, now) {
    const query = {
        _id: item.productId,
        isDeleted: false,
        stockQuantity: { $gte: item.quantity }
    };

    if (!pricing.flashSaleApplied) {
        return query;
    }

    return {
        ...query,
        'flashSale.enabled': true,
        'flashSale.salePrice': pricing.finalPrice,
        'flashSale.startsAt': { $lte: now },
        'flashSale.endsAt': { $gt: now },
        $or: [
            { 'flashSale.stockLimit': { $lte: 0 } },
            {
                $expr: {
                    $gte: [
                        {
                            $subtract: [
                                { $ifNull: ['$flashSale.stockLimit', 0] },
                                { $ifNull: ['$flashSale.soldCount', 0] }
                            ]
                        },
                        item.quantity
                    ]
                }
            }
        ]
    };
}

function buildReserveUpdate(item, actor, pricing) {
    const set = {
        stockQuantity: { $subtract: ['$stockQuantity', item.quantity] },
        trangThai: {
            $cond: [
                { $gt: [{ $subtract: ['$stockQuantity', item.quantity] }, 0] },
                PRODUCT_STATUS.IN_STOCK,
                PRODUCT_STATUS.OUT_OF_STOCK
            ]
        },
        updatedBy: actor,
        updatedAt: '$$NOW'
    };

    if (pricing.flashSaleApplied) {
        set['flashSale.soldCount'] = {
            $add: [
                { $ifNull: ['$flashSale.soldCount', 0] },
                item.quantity
            ]
        };
    }

    return [{ $set: set }];
}

function buildReleaseUpdate(item, actor, decrementSoldCount) {
    const set = {
        stockQuantity: { $add: ['$stockQuantity', item.quantity] },
        soldCount: decrementSoldCount
            ? { $max: [{ $subtract: ['$soldCount', item.quantity] }, 0] }
            : '$soldCount',
        trangThai: {
            $cond: [
                { $gt: [{ $add: ['$stockQuantity', item.quantity] }, 0] },
                PRODUCT_STATUS.IN_STOCK,
                PRODUCT_STATUS.OUT_OF_STOCK
            ]
        },
        updatedBy: actor,
        updatedAt: '$$NOW'
    };

    if (item.flashSaleApplied) {
        set['flashSale.soldCount'] = {
            $max: [
                {
                    $subtract: [
                        { $ifNull: ['$flashSale.soldCount', 0] },
                        item.quantity
                    ]
                },
                0
            ]
        };
    }

    return [{ $set: set }];
}

async function reserveInventoryItems(items, actor) {
    const normalizedItems = normalizeInventoryRequestItems(items);

    if (!normalizedItems.length) {
        throw createHttpError('Don hang phai co it nhat mot san pham hop le.', 400);
    }

    const productMap = await loadProductsForInventory(normalizedItems);
    const reservedItems = [];
    const canonicalItems = [];

    try {
        for (const item of normalizedItems) {
            const product = productMap.get(item.productId);
            const availableStock = Number(product.stockQuantity) || 0;
            const now = new Date();
            const pricing = getProductPricing(product, {
                now,
                quantity: item.quantity
            });

            if (availableStock < item.quantity) {
                throw createHttpError(getInventoryStatusMessage(product.ten, availableStock), 409);
            }

            if (pricing.isFlashSaleActive && !pricing.flashSaleApplied) {
                throw createHttpError(getFlashSaleAvailabilityMessage(product.ten, pricing), 409);
            }

            const updatedProduct = await Product.findOneAndUpdate(
                buildReserveQuery(item, pricing, now),
                buildReserveUpdate(item, actor, pricing),
                { new: true }
            );

            if (!updatedProduct) {
                throw createHttpError(
                    pricing.flashSaleApplied
                        ? `Flash sale cua ${product.ten} vua thay doi. Vui long kiem tra lai gio hang.`
                        : `Khong the giu ton kho cho ${product.ten}. Vui long thu lai.`,
                    409
                );
            }

            reservedItems.push({
                ...item,
                flashSaleApplied: pricing.flashSaleApplied
            });
            canonicalItems.push(buildCanonicalOrderItem(product, item.quantity, pricing));
        }

        return {
            items: canonicalItems,
            totalAmount: canonicalItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
        };
    } catch (error) {
        if (reservedItems.length) {
            await releaseInventoryItems(reservedItems, actor, { suppressErrors: true });
        }

        throw error;
    }
}

async function releaseInventoryItems(items, actor, options = {}) {
    const normalizedItems = normalizeInventoryRequestItems(items);
    const decrementSoldCount = options.decrementSoldCount === true;
    const suppressErrors = options.suppressErrors === true;

    for (const item of normalizedItems) {
        try {
            const updatedProduct = await Product.findByIdAndUpdate(
                item.productId,
                buildReleaseUpdate(item, actor, decrementSoldCount),
                { new: true }
            );

            if (!updatedProduct && !suppressErrors) {
                throw createHttpError('Khong tim thay san pham de hoan kho.', 404);
            }
        } catch (error) {
            if (!suppressErrors) {
                throw error;
            }
        }
    }
}

async function confirmSoldItems(items, actor) {
    const normalizedItems = normalizeInventoryRequestItems(items);

    for (const item of normalizedItems) {
        const updatedProduct = await Product.findByIdAndUpdate(
            item.productId,
            [
                {
                    $set: {
                        soldCount: { $add: ['$soldCount', item.quantity] },
                        updatedBy: actor,
                        updatedAt: '$$NOW'
                    }
                }
            ],
            { new: true }
        );

        if (!updatedProduct) {
            throw createHttpError('Khong tim thay san pham de xac nhan ban.', 404);
        }
    }
}

module.exports = {
    reserveInventoryItems,
    releaseInventoryItems,
    confirmSoldItems
};
