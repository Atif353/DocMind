const crypto = require('crypto');

function requestContext(req, res, next) {
  const suppliedId = req.get('x-request-id');
  req.id = suppliedId && /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedId) ? suppliedId : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

function createRateLimiter({ windowMs = 60000, limit = 120 } = {}) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader('RateLimit-Limit', limit);
    res.setHeader('RateLimit-Remaining', Math.max(0, limit - bucket.count));
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (buckets.size > 10000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    if (bucket.count > limit) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }
    return next();
  };
}

module.exports = { requestContext, createRateLimiter };

