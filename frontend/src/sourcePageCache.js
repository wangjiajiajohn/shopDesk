// View-local memory only; a new login/view starts with an empty cache.
export function createSourcePageCache({ maxPages = 50, ttl = 300000, now = Date.now } = {}) {
  const pages = new Map();
  let revision = 0;
  return {
    get revision() { return revision; },
    clear() { pages.clear(); revision += 1; },
    get(key) {
      const entry = pages.get(key);
      if (!entry || now() - entry.loadedAt > ttl) { pages.delete(key); return null; }
      pages.delete(key); pages.set(key, entry);
      return entry;
    },
    put(key, data, expectedRevision) {
      if (revision !== expectedRevision) return null;
      const entry = { data, loadedAt: now() };
      pages.delete(key); pages.set(key, entry);
      while (pages.size > maxPages) pages.delete(pages.keys().next().value);
      return entry;
    },
  };
}
