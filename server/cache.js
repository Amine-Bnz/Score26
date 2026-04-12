// Cache mémoire simple avec TTL (pour classements)
class MemoryCache {
  constructor(ttlMs = 60 * 1000) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate() {
    this.store.clear();
  }
}

// Instance partagée pour le classement global (TTL 60s)
const rankingCache = new MemoryCache(60 * 1000);

// Cache pour le classement par journée (TTL 60s)
const matchdayCache = new MemoryCache(60 * 1000);

module.exports = { rankingCache, matchdayCache, MemoryCache };
