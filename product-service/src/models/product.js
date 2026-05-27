const mongoose = require('mongoose');
const { DEFAULT_CATEGORY, PRODUCT_STATUS } = require('../config/constants');
const auditUserSchema = require('./auditUserSchema');

const flashSaleSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    salePrice: { type: Number, min: 0, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    stockLimit: { type: Number, min: 0, default: 0 },
    soldCount: { type: Number, min: 0, default: 0 },
    perOrderLimit: { type: Number, min: 0, default: 0 }
}, { _id: false });

const productSchema = new mongoose.Schema({
    ten: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    gia: { type: Number, required: true, min: 0 },
    image: { type: String, trim: true, default: '' },
    moTa: { type: String, trim: true, maxlength: 2000, default: '' },
    danhMuc: { type: String, trim: true, maxlength: 120, default: DEFAULT_CATEGORY },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    trangThai: {
        type: String,
        enum: Object.values(PRODUCT_STATUS),
        default: PRODUCT_STATUS.OUT_OF_STOCK
    },
    stockQuantity: { type: Number, min: 0, default: 0 },
    soldCount: { type: Number, min: 0, default: 0 },
    brand: { type: String, trim: true, maxlength: 120, default: '' },
    tags: { type: [String], default: [] },
    flashSale: { type: flashSaleSchema, default: () => ({}) },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: auditUserSchema, default: null },
    updatedBy: { type: auditUserSchema, default: null }
}, {
    collection: 'products',
    timestamps: true
});

productSchema.index({ danhMuc: 1, isDeleted: 1 });
productSchema.index({ categoryId: 1, isDeleted: 1 });
productSchema.index({ stockQuantity: 1, isDeleted: 1 });
productSchema.index({ createdAt: -1, isDeleted: 1 });
productSchema.index({
    'flashSale.enabled': 1,
    'flashSale.startsAt': 1,
    'flashSale.endsAt': 1,
    isDeleted: 1
});
productSchema.index({
    ten: 'text',
    moTa: 'text',
    danhMuc: 'text',
    brand: 'text',
    tags: 'text'
});

productSchema.set('toJSON', {
    transform(_doc, ret) {
        delete ret.slug;
        delete ret.sku;
        return ret;
    }
});

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
