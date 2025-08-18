const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: p.sub, role: p.role, countryId: p.countryId ?? null };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authRequired };
