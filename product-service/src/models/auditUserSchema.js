const mongoose = require('mongoose');

const auditUserSchema = new mongoose.Schema({
    userId: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    fullName: { type: String, trim: true, default: '' }
}, { _id: false });

module.exports = auditUserSchema;
