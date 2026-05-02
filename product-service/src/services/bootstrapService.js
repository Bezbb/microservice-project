const Product = require('../models/product');
const sampleProducts = require('../config/sampleProducts');
const { PRODUCT_STATUS, DEFAULT_CATEGORY } = require('../config/constants');
const {
    deriveStatusFromStock,
    normalizeStatus,
    parseNonNegativeInteger,
    normalizeText
} = require('../utils/text');
const {
    getSystemActor,
    syncCategoriesFromProducts
} = require('./categoryService');

async function seedProducts() {
    const count = await Product.countDocuments();

    if (count > 0) {
        return;
    }

    const items = sampleProducts.map((item) => ({
        ...item,
        danhMuc: normalizeText(item.danhMuc, 120) || DEFAULT_CATEGORY,
        soldCount: 0,
        trangThai: deriveStatusFromStock(item.stockQuantity),
        isDeleted: false,
        deletedAt: null,
        createdBy: getSystemActor(),
        updatedBy: getSystemActor()
    }));

    await Product.insertMany(items);
    console.log('Da them du lieu mau cho Product Service');
}

async function migrateExistingProducts() {
    await Product.updateMany(
        {
            $or: [
                { slug: { $exists: true } },
                { sku: { $exists: true } }
            ]
        },
        {
            $unset: {
                slug: '',
                sku: ''
            }
        },
        { strict: false }
    );

    const products = await Product.find().sort({ _id: 1 });

    for (const product of products) {
        let changed = false;

        product.danhMuc = normalizeText(product.danhMuc, 120) || DEFAULT_CATEGORY;

        if (parseNonNegativeInteger(product.stockQuantity) === null) {
            product.stockQuantity = normalizeStatus(product.trangThai) === PRODUCT_STATUS.OUT_OF_STOCK ? 0 : 1;
            changed = true;
        } else {
            const normalizedStock = parseNonNegativeInteger(product.stockQuantity);
            if (normalizedStock !== product.stockQuantity) {
                product.stockQuantity = normalizedStock;
                changed = true;
            }
        }

        const expectedStatus = deriveStatusFromStock(product.stockQuantity);
        if (product.trangThai !== expectedStatus) {
            product.trangThai = expectedStatus;
            changed = true;
        }

        if (parseNonNegativeInteger(product.soldCount) === null) {
            product.soldCount = 0;
            changed = true;
        }

        if (!Array.isArray(product.tags)) {
            product.tags = [];
            changed = true;
        }

        if (typeof product.brand !== 'string') {
            product.brand = '';
            changed = true;
        }

        if (typeof product.isDeleted !== 'boolean') {
            product.isDeleted = false;
            changed = true;
        }

        if (product.deletedAt === undefined) {
            product.deletedAt = null;
            changed = true;
        }

        if (!product.createdAt) {
            product.createdAt = product._id.getTimestamp();
            changed = true;
        }

        if (!product.updatedAt) {
            product.updatedAt = product.createdAt || new Date();
            changed = true;
        }

        if (product.categoryId === undefined) {
            product.categoryId = null;
            changed = true;
        }

        if (changed) {
            await product.save();
        }
    }
}

async function bootstrapProductData() {
    await seedProducts();
    await migrateExistingProducts();
    await syncCategoriesFromProducts();
}

module.exports = {
    bootstrapProductData
};
