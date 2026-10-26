const jwt = require('jsonwebtoken');

const roles = new Set(['admin', 'manager', 'editor', 'viewer']);

function createAuthenticator(config, supabase) {
  return async function authenticateToken(req, res, next) {
    const match = req.get('authorization')?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Authentication is required.' });
    }

    let claims;
    try {
      claims = jwt.verify(match[1], config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience
      });

      if (!claims.id || !roles.has(claims.role)) {
        return res.status(403).json({ error: 'The access token is invalid.' });
      }

    } catch {
      return res.status(401).json({ error: 'The access token is invalid or expired.' });
    }
    if (supabase) {
      try {
        const { data: user, error } = await supabase.from('users')
          .select('id, email, role').eq('id', claims.id).maybeSingle();
        if (error) return next(error);
        if (!user || !roles.has(user.role)) return res.status(401).json({ error: 'This account is no longer available.' });
        req.user = user;
      } catch (error) { return next(error); }
    } else {
      req.user = { id: claims.id, email: claims.email, role: claims.role };
    }
    return next();
  };
}

function authorizeRoles(...allowedRoles) {
  const allowed = new Set(allowedRoles);
  return function authorizeRole(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication is required.' });
    }
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

module.exports = { createAuthenticator, authorizeRoles };

