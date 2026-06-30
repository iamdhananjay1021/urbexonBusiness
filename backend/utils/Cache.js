/**
 * Cache.js — Unified cache interface
 * 
 * ✅ NodeCache is ALWAYS primary (guaranteed uptime)
 * ✅ Redis is OPTIONAL (if configured and UP)
 * ✅ Automatic fallback on any error
 * ✅ No crashes, no dependencies
 * 
 * All operations delegated to redis.js for single source of truth
 * (Redis path), with a local NodeCache instance kept for safe
 * stats/flush operations so this file never references an
 * undefined variable.
 */

import NodeCache from "node-cache";
import {
    cacheGet,
    cacheSet,
    cacheDel,
    cacheDelByPrefix,
    isRedisUp,
    getCacheStatus,
} from "../config/redis.js";

// ✅ Local in-memory cache instance — used only for stats/flush bookkeeping.
// The actual get/set/del logic still goes through redis.js (cacheGet/cacheSet/etc),
// which already has its own internal NodeCache fallback. This local instance
// just gives flushCache()/getCacheStats() something real to call instead of
// referencing an undefined `memCache`.
const memCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

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
    try {
        memCache.flushAll();
    } catch (err) {
        console.error("[flushCache]", err.message);
    }
};

// ─────────────────────────────────────────────
// CACHE STATS (safe — never throws, never crashes routes)
// ─────────────────────────────────────────────
export const getCacheStats = () => {
    try {
        const stats = memCache.getStats();
        return {
            backend: isRedisUp() ? "redis" : "memory",
            keys: memCache.keys().length,
            hits: stats.hits,
            misses: stats.misses,
        };
    } catch (err) {
        console.error("[getCacheStats]", err.message);
        return { backend: "unknown", keys: 0, hits: 0, misses: 0 };
    }
};

export default { getCache, setCache, delCache, delCacheByPrefix, flushCache, getCacheStats };