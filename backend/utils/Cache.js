/**
 * Cache.js — Unified cache: Redis (primary) + node-cache (fallback)
 * All callers use the same API regardless of which backend is active
 */
import NodeCache from "node-cache";
import { getRedis, isRedisUp } from "../config/redis.js";

const memCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/* ── SET ── */
export const setCache = async (key, value, ttl = 300) => {
    const redis = getRedis();
    if (redis && isRedisUp()) {
        try {
            await redis.setex(key, ttl, JSON.stringify(value));
            return;
        } catch { /* fall through */ }
    }
    memCache.set(key, value, ttl);
};

/* ── GET ── */
export const getCache = async (key) => {
    const redis = getRedis();
    if (redis && isRedisUp()) {
        try {
            const val = await redis.get(key);
            return val ? JSON.parse(val) : null;
        } catch { /* fall through */ }
    }
    return memCache.get(key) ?? null;
};

/* ── DEL ── */
export const delCache = async (key) => {
    const redis = getRedis();
    if (redis && isRedisUp()) {
        try { await redis.del(key); return; } catch { /* fall through */ }
    }
    memCache.del(key);
};

/* ── DEL by pattern prefix ── */
export const delCacheByPrefix = async (prefix) => {
    const redis = getRedis();
    if (redis && isRedisUp()) {
        try {
            let cursor = "0";
            do {
                const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
                cursor = nextCursor;
                if (keys.length) await redis.del(...keys);
            } while (cursor !== "0");
            return;
        } catch { /* fall through */ }
    }
    const keys = memCache.keys().filter(k => k.startsWith(prefix));
    keys.forEach(k => memCache.del(k));
};

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
