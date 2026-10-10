function normalizeText(value, maxLength = 2000) {
    return String(value || '')
        .trim()
        .slice(0, maxLength);
}

function removeVietnameseDiacritics(str = '') {
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

function escapeRegex(text = '') {
    return String(text).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function formatCurrency(amount = 0) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function parsePriceFromText(text = '') {
    const raw = removeVietnameseDiacritics(text);
    let minPrice = null;
    let maxPrice = null;

    // Pattern: "duoi 10 trieu", "duoi 500k", "duoi 5tr"
    const underMatch = raw.match(/duoi\s+(\d+(?:[.,]\d+)?)\s*(trieu|tr|k|nghin|ngan|dong|vnd)?/i);
    if (underMatch) {
        const num = parseFloat(underMatch[1].replace(',', '.'));
        const unit = (underMatch[2] || '').toLowerCase();
        if (unit.startsWith('tr') || unit.startsWith('trieu')) {
            maxPrice = num * 1000000;
        } else if (unit === 'k' || unit.startsWith('ng')) {
            maxPrice = num * 1000;
        } else if (num < 100) {
            maxPrice = num * 1000000; // e.g. "duoi 5" usually means 5 trieu
        } else {
            maxPrice = num;
        }
    }

    // Pattern: "tren 5 trieu", "tu 5 trieu"
    const overMatch = raw.match(/(?:tren|tu)\s+(\d+(?:[.,]\d+)?)\s*(trieu|tr|k|nghin|ngan|dong|vnd)?/i);
    if (overMatch) {
        const num = parseFloat(overMatch[1].replace(',', '.'));
        const unit = (overMatch[2] || '').toLowerCase();
        if (unit.startsWith('tr') || unit.startsWith('trieu')) {
            minPrice = num * 1000000;
        } else if (unit === 'k' || unit.startsWith('ng')) {
            minPrice = num * 1000;
        } else if (num < 100) {
            minPrice = num * 1000000;
        } else {
            minPrice = num;
        }
    }

    // Pattern: "tam 5 - 10 trieu", "khoang 3 den 7 tr"
    const rangeMatch = raw.match(/(?:tam|khoang|tu)?\s*(\d+(?:[.,]\d+)?)\s*(?:-|den|toi|\s+)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|k)?/i);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
        const n1 = parseFloat(rangeMatch[1].replace(',', '.'));
        const n2 = parseFloat(rangeMatch[2].replace(',', '.'));
        const unit = (rangeMatch[3] || '').toLowerCase();
        const multiplier = (unit.startsWith('tr') || n2 < 100) ? 1000000 : (unit === 'k' ? 1000 : 1);
        minPrice = Math.min(n1, n2) * multiplier;
        maxPrice = Math.max(n1, n2) * multiplier;
    }

    return { minPrice, maxPrice };
}

module.exports = {
    normalizeText,
    removeVietnameseDiacritics,
    escapeRegex,
    formatCurrency,
    parsePriceFromText
};
