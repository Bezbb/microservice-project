const mongoose = require('mongoose');
const auditUserSchema = require('./auditUserSchema');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, min: 0, default: 0 },
    createdBy: { type: auditUserSchema, default: null },
    updatedBy: { type: auditUserSchema, default: null }
}, {
    collection: 'product_categories',
    timestamps: true
});

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
