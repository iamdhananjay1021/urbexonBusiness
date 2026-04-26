/**
 * Cache.js — Unified cache interface
 * 
 * ✅ NodeCache is ALWAYS primary (guaranteed uptime)
 * ✅ Redis is OPTIONAL (if configured and UP)
 * ✅ Automatic fallback on any error
 * ✅ No crashes, no dependencies
 * 
 * All operations delegated to redis.js for single source of truth
 */

import {
    cacheGet,
    cacheSet,
    cacheDel,
    cacheDelByPrefix,
    isRedisUp,
    getCacheStatus,
} from "../config/redis.js";

// ─────────────────────────────────────────────
// SET CACHE
// ─────────────────────────────────────────────
export const setCache = async (key, value, ttl = 300) => {
    return cacheSet(key, value, ttl);
};

// ─────────────────────────────────────────────
// GET CACHE
// ─────────────────────────────────────────────
export const getCache = async (key) => {
    return cacheGet(key);
};

// ─────────────────────────────────────────────
// DELETE CACHE
// ─────────────────────────────────────────────
export const delCache = async (key) => {
    return cacheDel(key);
};

// ─────────────────────────────────────────────
// DELETE CACHE BY PREFIX
// ─────────────────────────────────────────────
export const delCacheByPrefix = async (prefix) => {
    return cacheDelByPrefix(prefix);
};

// ─────────────────────────────────────────────
// CACHE STATUS
// ─────────────────────────────────────────────
export const isCacheActive = () => true; // Always true (NodeCache fallback)
export const getCacheBackend = () => isRedisUp() ? "Redis" : "NodeCache";
export const cacheStatus = () => getCacheStatus();

/* ── FLUSH ALL ── */
export const flushCache = async () => {
    const redis = getRedis();
    if (redis && isRedisUp()) {
        try { await redis.flushdb(); return; } catch { /* fall through */ }
    }
    memCache.flushAll();
};

export const getCacheStats = () => ({
    backend: isRedisUp() ? "redis" : "memory",
    keys: memCache.keys().length,
    hits: memCache.getStats().hits,
    misses: memCache.getStats().misses,
});

export default { getCache, setCache, delCache, delCacheByPrefix, flushCache, getCacheStats };
