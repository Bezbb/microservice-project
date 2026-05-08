function getClientKey(req) {
    return req.ip
        || req.headers['x-forwarded-for']
        || req.socket?.remoteAddress
        || 'unknown';
}

function createRateLimiter(options = {}) {
    const windowMs = Number(options.windowMs) || 60_000;
    const max = Number(options.max) || 120;
    const message = options.message || 'Qua nhieu yeu cau. Vui long thu lai sau.';
    const buckets = new Map();

    const cleanupTimer = setInterval(() => {
        const now = Date.now();

        for (const [key, bucket] of buckets.entries()) {
            if (bucket.resetAt <= now) {
                buckets.delete(key);
            }
        }
    }, Math.min(windowMs, 60_000));

    if (typeof cleanupTimer.unref === 'function') {
        cleanupTimer.unref();
    }

    return (req, res, next) => {
        if (req.method === 'OPTIONS') {
            return next();
        }

        const now = Date.now();
        const key = `${options.name || 'default'}:${getClientKey(req)}`;
        const currentBucket = buckets.get(key);
        const bucket = currentBucket && currentBucket.resetAt > now
            ? currentBucket
            : {
                count: 0,
                resetAt: now + windowMs
            };

        bucket.count += 1;
        buckets.set(key, bucket);

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > max) {
            res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
            return res.status(429).json({ error: message });
        }

        return next();
    };
}

module.exports = {
    createRateLimiter
};
