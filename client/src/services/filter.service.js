/**
 * filter.service.js — data layer for the global filtering system.
 *
 * Wraps the two backend endpoints:
 *   GET /products          (paged, filtered product list)
 *   GET /products/filters  (dynamic facets for the current context)
 *
 * Adds a small session cache keyed by the exact query so repeated
 * visits (Back button, re-selecting the same filter) don't refire
 * identical requests. Entries expire after TTL. Only successful
 * responses are cached; aborted/failed requests are not.
 */
import api from "../api/axios";

const TTL = 60 * 1000;          // products — 1 min
const FACET_TTL = 5 * 60 * 1000; // facets — 5 min (matches backend cache)
const cache = new Map();

const keyFor = (path, params) => {
    const qs = Object.keys(params)
        .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&");
    return `${path}?${qs}`;
};

const cachedGet = async (path, params, signal, ttl) => {
    const key = keyFor(path, params);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < ttl) return hit.data;

    const { data } = await api.get(path, { params, signal });
    cache.set(key, { data, ts: Date.now() });
    // Basic bound so a long browse session can't grow the map forever.
    if (cache.size > 300) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    return data;
};

/** Paged, filtered products. `params` is a flat object of query params. */
export const fetchFilteredProducts = (params, signal) =>
    cachedGet("/products", params, signal, TTL);

/** Dynamic facet groups for the given context (category/search/…). */
export const fetchFacets = (params, signal) =>
    cachedGet("/products/filters", params, signal, FACET_TTL);

/** Test hook / manual invalidation (e.g. after admin edits). */
export const clearFilterCache = () => cache.clear();
