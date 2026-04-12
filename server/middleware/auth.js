const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

// Middleware : vérifie le JWT et injecte req.userId
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  try {
    const { userId } = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

// Middleware optionnel : injecte req.userId si token présent, sinon continue
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const { userId } = jwt.verify(auth.slice(7), JWT_SECRET);
      req.userId = userId;
    } catch { /* token invalide — on continue sans auth */ }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
