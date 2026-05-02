const { DEFAULT_CATEGORY, PRODUCT_STATUS } = require('../config/constants');

function normalizeText(value, maxLength = 500) {
    return String(value || '').trim().slice(0, maxLength);
}

function normalizeTags(value) {
    const input = Array.isArray(value)
        ? value
        : String(value || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

    return [...new Set(input
        .map((item) => normalizeText(item, 40).toLowerCase())
        .filter(Boolean))];
}

function normalizeStatus(value) {
    const status = normalizeText(value, 40);
    return status === PRODUCT_STATUS.OUT_OF_STOCK
        ? PRODUCT_STATUS.OUT_OF_STOCK
        : PRODUCT_STATUS.IN_STOCK;
}

function deriveStatusFromStock(stockQuantity) {
    return Number(stockQuantity) > 0 ? PRODUCT_STATUS.IN_STOCK : PRODUCT_STATUS.OUT_OF_STOCK;
}

function parseNonNegativeInteger(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return Math.floor(parsed);
}

function parsePositiveInteger(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.floor(parsed);
}

function parsePositiveNumber(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
}

function parseOptionalBoolean(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
    }

    return null;
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCategoryName(value, fallback = DEFAULT_CATEGORY) {
    return normalizeText(value, 120) || fallback;
}

function slugify(value) {
    const normalized = normalizeText(value, 120)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || 'category';
}

module.exports = {
    normalizeText,
    normalizeTags,
    normalizeStatus,
    deriveStatusFromStock,
    parseNonNegativeInteger,
    parsePositiveInteger,
    parsePositiveNumber,
    parseOptionalBoolean,
    escapeRegex,
    normalizeCategoryName,
    slugify
};
