/**
 * redis.js — Production Ready (Redis + NodeCache Fallback)
 */

import Redis from "ioredis";
import NodeCache from "node-cache";

let redisClient = null;
let redisAvailable = false;

// fallback cache
const cache = new NodeCache({
    stdTTL: 60,        // default 60 sec
    checkperiod: 120,  // cleanup interval
});

// ─────────────────────────────────────────────
// CONNECT REDIS
// ─────────────────────────────────────────────
export const connectRedis = () => {
    const url = process.env.REDIS_URL;

    if (!url) {
        console.log("📦 [Redis] Not configured → Using NodeCache fallback");
        return null;
    }

    try {
        redisClient = new Redis(url, {
            maxRetriesPerRequest: null,
            connectTimeout: 5000,
            enableOfflineQueue: false,
            lazyConnect: false,

            retryStrategy: (times) => {
                const delay = Math.min(times * 100, 2000);
                console.log(`🔁 [Redis] Reconnect attempt ${times}, delay ${delay}ms`);
                return delay;
            },
        });

        redisClient.on("connect", () => {
            redisAvailable = true;
            console.log("✅ [Redis] Connected and ready (UP)");
        });

        redisClient.on("error", (err) => {
            redisAvailable = false;
            console.warn("⚠️  [Redis] Error → Falling back to NodeCache:", err.message);
        });

        redisClient.on("close", () => {
            redisAvailable = false;
            console.warn("⚠️  [Redis] Connection closed → Using NodeCache fallback");
        });

    } catch (err) {
        redisAvailable = false;
        console.warn("⚠️  [Redis] Init failed → Using NodeCache fallback:", err.message);
    }

    return redisClient;
};

// ─────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────
export const isRedisUp = () => redisAvailable;
export const getRedis = () => redisClient;

export const getCacheStatus = () => {
    return {
        backend: redisAvailable ? "Redis" : "NodeCache",
        redisUp: redisAvailable,
        cacheActive: true, // NodeCache is always active
        message: redisAvailable
            ? "✅ [Cache] Redis UP (primary backend)"
            : "🟡 [Cache] Using NodeCache fallback",
    };
};

// ─────────────────────────────────────────────
// CACHE GET
// ─────────────────────────────────────────────
export const cacheGet = async (key) => {
    try {
        if (redisAvailable && redisClient) {
            try {
                const data = await redisClient.get(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    return parsed;
                }
                return null;
            } catch (redisErr) {
                if (redisErr instanceof SyntaxError) {
                    console.warn(`[Cache] JSON parse error for key "${key}" in Redis, using NodeCache`);
                } else {
                    console.warn(`[Cache] Redis GET failed for key "${key}", using NodeCache:`, redisErr.message);
                }
                return cache.get(key) || null;
            }
        }

        return cache.get(key) || null;

    } catch (err) {
        console.error(`[Cache] Unexpected error in GET for key "${key}":`, err.message);
        return cache.get(key) || null;
    }
};

// ─────────────────────────────────────────────
// CACHE SET
// ─────────────────────────────────────────────
export const cacheSet = async (key, value, ttl = 60) => {
    try {
        if (redisAvailable && redisClient) {
            try {
                const stringified = JSON.stringify(value);
                await redisClient.setex(key, ttl, stringified);
                return true;
            } catch (redisErr) {
                if (redisErr instanceof TypeError || redisErr instanceof SyntaxError) {
                    console.warn(`[Cache] JSON stringify failed for key "${key}", using NodeCache only`);
                } else {
                    console.warn(`[Cache] Redis SET failed for key "${key}", using NodeCache:`, redisErr.message);
                }
                cache.set(key, value, ttl);
                return true;
            }
        } else {
            cache.set(key, value, ttl);
            return true;
        }
    } catch (err) {
        console.error(`[Cache] Unexpected error in SET for key "${key}":`, err.message);
        try {
            cache.set(key, value, ttl);
        } catch (cacheErr) {
            console.error(`[Cache] Even NodeCache failed for key "${key}":`, cacheErr.message);
        }
        return false;
    }
};

// ─────────────────────────────────────────────
// CACHE DELETE
// ─────────────────────────────────────────────
export const cacheDel = async (key) => {
    try {
        if (redisAvailable && redisClient) {
            try {
                await redisClient.del(key);
            } catch (redisErr) {
                console.warn(`[Cache] Redis DELETE failed for key "${key}":`, redisErr.message);
            }
        }
        cache.del(key);
        return true;
    } catch (err) {
        console.error(`[Cache] Unexpected error in DELETE for key "${key}":`, err.message);
        try {
            cache.del(key);
        } catch (cacheErr) {
            console.error(`[Cache] Even NodeCache DELETE failed for key "${key}":`, cacheErr.message);
        }
        return false;
    }
};

// ─────────────────────────────────────────────
// CACHE DELETE BY PREFIX
// ─────────────────────────────────────────────
export const cacheDelByPrefix = async (prefix) => {
    try {
        if (redisAvailable && redisClient) {
            try {
                let cursor = "0";
                let deletedCount = 0;
                do {
                    const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
                    cursor = nextCursor;
                    if (keys.length) {
                        await redisClient.del(...keys);
                        deletedCount += keys.length;
                    }
                } while (cursor !== "0");

                // Also cleanup NodeCache
                const memKeys = cache.keys().filter(k => k.startsWith(prefix));
                memKeys.forEach(k => cache.del(k));

                return deletedCount + memKeys.length;
            } catch (redisErr) {
                console.warn(`[Cache] Redis DELETE BY PREFIX failed for prefix "${prefix}":`, redisErr.message);
            }
        }

        const memKeys = cache.keys().filter(k => k.startsWith(prefix));
        memKeys.forEach(k => cache.del(k));
        return memKeys.length;

    } catch (err) {
        console.error(`[Cache] Unexpected error in DELETE BY PREFIX for prefix "${prefix}":`, err.message);
        try {
            const memKeys = cache.keys().filter(k => k.startsWith(prefix));
            memKeys.forEach(k => cache.del(k));
            return memKeys.length;
        } catch (cacheErr) {
            console.error(`[Cache] Even NodeCache failed for DELETE BY PREFIX:`, cacheErr.message);
            return 0;
        }
    }
};