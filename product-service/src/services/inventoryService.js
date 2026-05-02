const Product = require('../models/product');
const { PRODUCT_STATUS } = require('../config/constants');
const { createHttpError } = require('../utils/errors');
const {
    normalizeText,
    parsePositiveInteger
} = require('../utils/text');

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

        quantitiesByProductId.set(productId, (quantitiesByProductId.get(productId) || 0) + quantity);
    }

    return [...quantitiesByProductId.entries()].map(([productId, quantity]) => ({
        productId,
        quantity
    }));
}

function buildCanonicalOrderItem(product, quantity) {
    return {
        productId: String(product._id),
        name: product.ten,
        price: Number(product.gia) || 0,
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

            if (availableStock < item.quantity) {
                throw createHttpError(getInventoryStatusMessage(product.ten, availableStock), 409);
            }

            const updatedProduct = await Product.findOneAndUpdate(
                {
                    _id: item.productId,
                    isDeleted: false,
                    stockQuantity: { $gte: item.quantity }
                },
                [
                    {
                        $set: {
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
                        }
                    }
                ],
                { new: true }
            );

            if (!updatedProduct) {
                throw createHttpError(`Khong the giu ton kho cho ${product.ten}. Vui long thu lai.`, 409);
            }

            reservedItems.push(item);
            canonicalItems.push(buildCanonicalOrderItem(product, item.quantity));
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
                [
                    {
                        $set: {
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
                        }
                    }
                ],
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
