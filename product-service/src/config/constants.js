const PRODUCT_STATUS = {
    IN_STOCK: 'C\u00f2n h\u00e0ng',
    OUT_OF_STOCK: 'H\u1ebft h\u00e0ng'
};

const DEFAULT_CATEGORY = 'Ch\u01b0a ph\u00e2n lo\u1ea1i';
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXTENSION_BY_TYPE = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

module.exports = {
    PRODUCT_STATUS,
    DEFAULT_CATEGORY,
    MAX_IMAGE_SIZE_BYTES,
    ALLOWED_IMAGE_TYPES,
    IMAGE_EXTENSION_BY_TYPE
};
