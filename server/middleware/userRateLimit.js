const logger = require('../logger');

// Rate limiter par user_id (en mémoire)
// Complémente le rate limit par IP pour éviter qu'un même user spam depuis la même IP WiFi
function createUserRateLimit({ windowMs = 60 * 1000, max = 30, message = 'Trop de requêtes.' } = {}) {
  const hits = new Map(); // user_id → { count, resetAt }

  // Nettoyage périodique des entrées expirées (toutes les 5 min)
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of hits) {
      if (now > val.resetAt) hits.delete(key);
    }
  }, 5 * 60 * 1000);

  return (req, res, next) => {
    const userId = req.body?.user_id || req.query?.user_id;
    if (!userId) return next(); // pas de user_id → laisser passer (le rate limit IP s'en charge)

    const now = Date.now();
    let entry = hits.get(userId);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(userId, entry);
    }

    entry.count++;

    if (entry.count > max) {
      logger.warn({ userId, count: entry.count, windowMs }, '[rate-limit-user] Limite dépassée');
      return res.status(429).json({ error: message });
    }

    next();
  };
}

module.exports = { createUserRateLimit };
