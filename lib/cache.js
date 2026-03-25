/**
 * Simple in-memory cache with TTL to avoid redundant API calls.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

class Cache {
  constructor(ttl = DEFAULT_TTL_MS) {
    this._store = new Map();
    this._ttl = ttl;
  }

  /**
   * Get a cached value by key. Returns undefined if expired or missing.
   * @param {string} key
   * @returns {*|undefined}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this._ttl) {
      this._store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in the cache.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this._store.set(key, { value, timestamp: Date.now() });
  }

  /**
   * Remove a specific key.
   * @param {string} key
   */
  remove(key) {
    this._store.delete(key);
  }

  /** Clear the entire cache. */
  clear() {
    this._store.clear();
  }
}

export const snapshotCache = new Cache();
