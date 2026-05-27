const express = require('express');
const Product = require('../models/product');
const { PRODUCT_STATUS } = require('../config/constants');
const { requireTrustedAdmin, canAdminIncludeDeleted } = require('../middlewares/auth');
const { handleImageUpload } = require('../middlewares/upload');
const { removeManagedUpload } = require('../utils/uploads');
const {
    buildProductPayload,
    decorateProduct,
    listProducts,
    deriveStatusFromStock,
    normalizeStatus,
    parseNonNegativeInteger
} = require('../services/productService');
const {
    listPublicCategoryNames,
    listPublicCategoryBrowse,
    listManagedCategories,
    createCategory,
    updateCategory,
    archiveCategory,
    deleteCategoryPermanently
} = require('../services/categoryService');

const router = express.Router();

router.get('/categories', async (_req, res) => {
    try {
        const categories = await listPublicCategoryNames();
        return res.json(categories);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Khong the lay danh muc san pham.' });
    }
});

router.get('/categories/browse', async (_req, res) => {
    try {
        const categories = await listPublicCategoryBrowse();
        return res.json(categories);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Khong the tai danh muc cho storefront.' });
    }
});

router.get('/categories/manage', requireTrustedAdmin, async (req, res) => {
    try {
        const categories = await listManagedCategories({
            includeInactive: String(req.query.includeInactive || '') === 'true',
            search: req.query.search
        });
        return res.json(categories);
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Khong the tai danh muc.' });
    }
});

router.post('/categories', requireTrustedAdmin, async (req, res) => {
    try {
        const category = await createCategory(req.body, req.requestActor);
        return res.status(201).json(category);
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Khong the tao danh muc.' });
    }
});

router.put('/categories/:id', requireTrustedAdmin, async (req, res) => {
    try {
        const category = await updateCategory(req.params.id, req.body, req.requestActor);
        return res.json(category);
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Khong the cap nhat danh muc.' });
    }
});

router.delete('/categories/:id', requireTrustedAdmin, async (req, res) => {
    try {
        const isPermanentDelete = String(req.query.permanent || '') === 'true';
        const category = isPermanentDelete
            ? await deleteCategoryPermanently(req.params.id, req.requestActor)
            : await archiveCategory(req.params.id, req.requestActor);
        return res.json({
            message: isPermanentDelete
                ? 'Da xoa vinh vien danh muc khoi he thong.'
                : 'Da an danh muc khoi danh sach su dung.',
            category
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({
            error: error.message || (String(req.query.permanent || '') === 'true'
                ? 'Khong the xoa danh muc.'
                : 'Khong the an danh muc.')
        });
    }
});

router.post('/', requireTrustedAdmin, handleImageUpload, async (req, res) => {
    try {
        const { data, errors } = await buildProductPayload(req.body, {
            isCreate: true,
            actor: req.requestActor
        });

        if (errors.length) {
            if (req.file?.filename) {
                await removeManagedUpload(`/uploads/${req.file.filename}`);
            }

            return res.status(400).json({ error: errors.join(' ') });
        }

        const product = new Product({
            ...data,
            image: req.file ? `/uploads/${req.file.filename}` : '',
            createdBy: req.requestActor,
            updatedBy: req.requestActor
        });

        const savedProduct = await product.save();
        return res.status(201).json(savedProduct);
    } catch (error) {
        if (req.file?.filename) {
            await removeManagedUpload(`/uploads/${req.file.filename}`);
        }

        console.error(error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Khong the tao san pham.' });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await listProducts(req.query, {
            canIncludeDeleted: canAdminIncludeDeleted(req)
        });
        return res.json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Khong the lay danh sach san pham.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const canIncludeDeleted = canAdminIncludeDeleted(req);
        const product = await Product.findOne({
            _id: req.params.id,
            ...(canIncludeDeleted ? {} : { isDeleted: false })
        });

        if (!product) {
            return res.status(404).json({ error: 'Khong tim thay san pham.' });
        }

        return res.json(decorateProduct(product));
    } catch (_error) {
        return res.status(400).json({ error: 'Ma san pham khong hop le.' });
    }
});

router.put('/:id', requireTrustedAdmin, handleImageUpload, async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, isDeleted: false });

        if (!product) {
            if (req.file?.filename) {
                await removeManagedUpload(`/uploads/${req.file.filename}`);
            }

            return res.status(404).json({ error: 'Khong tim thay san pham de cap nhat.' });
        }

        const previousImage = product.image;
        const { data, errors } = await buildProductPayload(req.body, {
            existingProduct: product,
            isCreate: false,
            actor: req.requestActor
        });

        if (errors.length) {
            if (req.file?.filename) {
                await removeManagedUpload(`/uploads/${req.file.filename}`);
            }

            return res.status(400).json({ error: errors.join(' ') });
        }

        const nextImage = req.file
            ? `/uploads/${req.file.filename}`
            : product.image;

        Object.assign(product, {
            ...data,
            image: nextImage,
            updatedBy: req.requestActor
        });

        const updatedProduct = await product.save();

        if (req.file && previousImage && previousImage !== nextImage) {
            await removeManagedUpload(previousImage);
        }

        return res.json(updatedProduct);
    } catch (error) {
        if (req.file?.filename) {
            await removeManagedUpload(`/uploads/${req.file.filename}`);
        }

        console.error(error);
        return res.status(error.statusCode || 400).json({ error: error.message || 'Khong the cap nhat san pham.' });
    }
});

router.patch('/:id/status', requireTrustedAdmin, async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, isDeleted: false });

        if (!product) {
            return res.status(404).json({ error: 'Khong tim thay san pham de cap nhat trang thai.' });
        }

        const nextStatus = normalizeStatus(req.body.trangThai);
        product.stockQuantity = nextStatus === PRODUCT_STATUS.OUT_OF_STOCK
            ? 0
            : Math.max(1, product.stockQuantity || 0);
        product.trangThai = deriveStatusFromStock(product.stockQuantity);
        product.updatedBy = req.requestActor;

        await product.save();
        return res.json(product);
    } catch (error) {
        console.error(error);
        return res.status(400).json({ error: 'Khong the cap nhat trang thai san pham.' });
    }
});

router.patch('/:id/stock', requireTrustedAdmin, async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, isDeleted: false });

        if (!product) {
            return res.status(404).json({ error: 'Khong tim thay san pham de cap nhat ton kho.' });
        }

        const stockQuantity = parseNonNegativeInteger(req.body.stockQuantity);

        if (stockQuantity === null) {
            return res.status(400).json({ error: 'So luong ton kho phai la so nguyen khong am.' });
        }

        product.stockQuantity = stockQuantity;
        product.trangThai = deriveStatusFromStock(stockQuantity);
        product.updatedBy = req.requestActor;

        await product.save();
        return res.json(product);
    } catch (error) {
        console.error(error);
        return res.status(400).json({ error: 'Khong the cap nhat ton kho san pham.' });
    }
});

router.delete('/:id', requireTrustedAdmin, async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, isDeleted: false });

        if (!product) {
            return res.status(404).json({ error: 'Khong tim thay san pham de xoa.' });
        }

        product.isDeleted = true;
        product.deletedAt = new Date();
        product.updatedBy = req.requestActor;
        await product.save();

        return res.json({
            message: 'Da an san pham khoi catalog.',
            product
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ error: 'Ma san pham khong hop le.' });
    }
});

module.exports = router;
