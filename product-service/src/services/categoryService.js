const mongoose = require('mongoose');
const Category = require('../models/category');
const Product = require('../models/product');
const { DEFAULT_CATEGORY } = require('../config/constants');
const { createHttpError } = require('../utils/errors');
const {
    normalizeText,
    parseNonNegativeInteger,
    parseOptionalBoolean,
    normalizeCategoryName,
    slugify
} = require('../utils/text');

const SYSTEM_ACTOR = {
    userId: 'system',
    email: 'system@internal.local',
    fullName: 'system'
};

function getSystemActor() {
    return SYSTEM_ACTOR;
}

function toCategoryResponse(category, countsById = new Map()) {
    const plain = typeof category.toJSON === 'function' ? category.toJSON() : category;
    return {
        ...plain,
        productCount: countsById.get(String(plain._id)) || 0
    };
}

function buildCategoryPayload(body, { existingCategory = null } = {}) {
    const errors = [];
    const name = body.name === undefined
        ? (existingCategory?.name || '')
        : normalizeCategoryName(body.name, '');
    const description = body.description === undefined
        ? (existingCategory?.description || '')
        : normalizeText(body.description, 300);
    const parsedSortOrder = body.sortOrder === undefined
        ? (existingCategory?.sortOrder ?? 0)
        : parseNonNegativeInteger(body.sortOrder);
    const parsedIsActive = body.isActive === undefined
        ? (existingCategory?.isActive ?? true)
        : parseOptionalBoolean(body.isActive);

    if (!name || name.length < 2) {
        errors.push('Ten danh muc phai co it nhat 2 ky tu.');
    }

    if (body.sortOrder !== undefined && parsedSortOrder === null) {
        errors.push('Thu tu sap xep phai la so nguyen khong am.');
    }

    if (body.isActive !== undefined && parsedIsActive === null) {
        errors.push('Trang thai danh muc khong hop le.');
    }

    return {
        errors,
        data: {
            name,
            slug: slugify(name),
            description,
            sortOrder: parsedSortOrder ?? 0,
            isActive: parsedIsActive ?? true
        }
    };
}

async function buildCategoryCounts(categories) {
    const categoryIds = categories
        .map((category) => category._id)
        .filter(Boolean);

    if (!categoryIds.length) {
        return new Map();
    }

    const counts = await Product.aggregate([
        {
            $match: {
                isDeleted: false,
                categoryId: { $in: categoryIds }
            }
        },
        {
            $group: {
                _id: '$categoryId',
                productCount: { $sum: 1 }
            }
        }
    ]);

    return new Map(counts.map((entry) => [String(entry._id), entry.productCount]));
}

async function listManagedCategories({ includeInactive = false, search = '' } = {}) {
    const filters = {};
    const keyword = normalizeText(search, 120);

    if (!includeInactive) {
        filters.isActive = true;
    }

    if (keyword) {
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filters.$or = [
            { name: regex },
            { description: regex }
        ];
    }

    const categories = await Category.find(filters).sort({ sortOrder: 1, name: 1 });
    const countsById = await buildCategoryCounts(categories);

    return categories.map((category) => toCategoryResponse(category, countsById));
}

async function listPublicCategoryNames() {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    return categories.map((category) => category.name);
}

async function listPublicCategoryBrowse() {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });

    if (!categories.length) {
        return [];
    }

    const categoryIds = categories.map((category) => category._id);
    const stats = await Product.aggregate([
        {
            $match: {
                isDeleted: false,
                categoryId: { $in: categoryIds }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $group: {
                _id: '$categoryId',
                productCount: { $sum: 1 },
                inStockCount: {
                    $sum: {
                        $cond: [
                            { $gt: ['$stockQuantity', 0] },
                            1,
                            0
                        ]
                    }
                },
                minPrice: { $min: '$gia' },
                sampleImage: { $first: '$image' },
                sampleProductName: { $first: '$ten' },
                sampleBrand: { $first: '$brand' }
            }
        }
    ]);
    const statsById = new Map(stats.map((entry) => [String(entry._id), entry]));

    return categories.map((category) => {
        const plain = category.toJSON();
        const categoryStats = statsById.get(String(category._id)) || {};

        return {
            _id: plain._id,
            name: plain.name,
            slug: plain.slug,
            description: plain.description || '',
            sortOrder: plain.sortOrder || 0,
            productCount: categoryStats.productCount || 0,
            inStockCount: categoryStats.inStockCount || 0,
            minPrice: categoryStats.minPrice ?? null,
            sampleImage: categoryStats.sampleImage || '',
            sampleProductName: categoryStats.sampleProductName || '',
            sampleBrand: categoryStats.sampleBrand || ''
        };
    });
}

async function findCategoryById(categoryId, { allowInactive = false } = {}) {
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
        return null;
    }

    const category = await Category.findById(categoryId);
    if (!category) {
        return null;
    }

    if (!allowInactive && !category.isActive) {
        return null;
    }

    return category;
}

async function syncCategoryNameToProducts(category) {
    await Product.updateMany(
        { categoryId: category._id },
        {
            $set: {
                danhMuc: category.name
            }
        }
    );
}

async function ensureDefaultCategory(actor = SYSTEM_ACTOR) {
    return ensureCategoryForProduct({
        categoryName: DEFAULT_CATEGORY,
        actor,
        allowCreate: true,
        allowInactive: true
    });
}

async function ensureCategoryForProduct({
    categoryId = '',
    categoryName = '',
    actor = SYSTEM_ACTOR,
    allowCreate = true,
    allowInactive = false
} = {}) {
    const requestedName = normalizeCategoryName(categoryName, DEFAULT_CATEGORY);

    if (categoryId) {
        const categoryById = await findCategoryById(categoryId, { allowInactive });
        if (categoryById) {
            return categoryById;
        }
    }

    const slug = slugify(requestedName);
    let category = await Category.findOne({ slug });

    if (category) {
        let changed = false;

        if (!category.isActive && !allowInactive) {
            if (!allowCreate) {
                throw createHttpError('Danh muc da ngung hoat dong.', 409);
            }

            category.isActive = true;
            changed = true;
        }

        if (category.name !== requestedName) {
            category.name = requestedName;
            changed = true;
        }

        if (changed) {
            category.updatedBy = actor;
            await category.save();
            await syncCategoryNameToProducts(category);
        }

        return category;
    }

    if (!allowCreate) {
        throw createHttpError('Danh muc khong ton tai.', 404);
    }

    category = await Category.create({
        name: requestedName,
        slug,
        description: '',
        isActive: true,
        sortOrder: 0,
        createdBy: actor,
        updatedBy: actor
    });

    return category;
}

async function createCategory(body, actor) {
    const { data, errors } = buildCategoryPayload(body);

    if (errors.length) {
        throw createHttpError(errors.join(' '), 400);
    }

    const existingCategory = await Category.findOne({ slug: data.slug });

    if (existingCategory && existingCategory.isActive) {
        throw createHttpError('Danh muc da ton tai.', 409);
    }

    if (existingCategory) {
        Object.assign(existingCategory, data, {
            isActive: data.isActive,
            updatedBy: actor
        });

        if (!existingCategory.createdBy) {
            existingCategory.createdBy = actor;
        }

        await existingCategory.save();
        await syncCategoryNameToProducts(existingCategory);
        return existingCategory;
    }

    return Category.create({
        ...data,
        createdBy: actor,
        updatedBy: actor
    });
}

async function updateCategory(categoryId, body, actor) {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw createHttpError('Ma danh muc khong hop le.', 400);
    }

    const category = await Category.findById(categoryId);

    if (!category) {
        throw createHttpError('Khong tim thay danh muc.', 404);
    }

    const { data, errors } = buildCategoryPayload(body, { existingCategory: category });

    if (errors.length) {
        throw createHttpError(errors.join(' '), 400);
    }

    const duplicateCategory = await Category.findOne({
        slug: data.slug,
        _id: { $ne: category._id }
    });

    if (duplicateCategory) {
        throw createHttpError('Danh muc da ton tai.', 409);
    }

    const previousName = category.name;
    Object.assign(category, data, { updatedBy: actor });
    await category.save();

    if (previousName !== category.name) {
        await syncCategoryNameToProducts(category);
    }

    return category;
}

async function archiveCategory(categoryId, actor) {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw createHttpError('Ma danh muc khong hop le.', 400);
    }

    const category = await Category.findById(categoryId);

    if (!category) {
        throw createHttpError('Khong tim thay danh muc.', 404);
    }

    if (category.slug === slugify(DEFAULT_CATEGORY)) {
        throw createHttpError('Khong the an danh muc mac dinh.', 400);
    }

    category.isActive = false;
    category.updatedBy = actor;
    await category.save();

    return category;
}

async function deleteCategoryPermanently(categoryId, actor = SYSTEM_ACTOR) {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw createHttpError('Ma danh muc khong hop le.', 400);
    }

    const category = await Category.findById(categoryId);

    if (!category) {
        throw createHttpError('Khong tim thay danh muc.', 404);
    }

    if (category.slug === slugify(DEFAULT_CATEGORY)) {
        throw createHttpError('Khong the xoa danh muc mac dinh.', 400);
    }

    const linkedProductFilter = {
        $or: [
            { categoryId: category._id },
            { categoryId: null, danhMuc: category.name }
        ]
    };
    const linkedProductCount = await Product.countDocuments(linkedProductFilter);

    if (linkedProductCount > 0) {
        const defaultCategory = await ensureDefaultCategory(actor);

        await Product.updateMany(
            linkedProductFilter,
            {
                $set: {
                    categoryId: defaultCategory._id,
                    danhMuc: defaultCategory.name,
                    updatedBy: actor
                }
            }
        );
    }

    await Category.deleteOne({ _id: category._id });
    return category;
}

async function syncCategoriesFromProducts() {
    await ensureDefaultCategory(SYSTEM_ACTOR);

    const products = await Product.find().sort({ _id: 1 });

    for (const product of products) {
        const category = await ensureCategoryForProduct({
            categoryId: product.categoryId ? String(product.categoryId) : '',
            categoryName: product.danhMuc,
            actor: SYSTEM_ACTOR,
            allowCreate: true,
            allowInactive: true
        });

        if (String(product.categoryId || '') !== String(category._id) || product.danhMuc !== category.name) {
            product.categoryId = category._id;
            product.danhMuc = category.name;
            await product.save();
        }
    }
}

module.exports = {
    DEFAULT_CATEGORY,
    getSystemActor,
    listManagedCategories,
    listPublicCategoryNames,
    listPublicCategoryBrowse,
    ensureCategoryForProduct,
    ensureDefaultCategory,
    createCategory,
    updateCategory,
    archiveCategory,
    deleteCategoryPermanently,
    syncCategoriesFromProducts
};
