// client/src/hooks/useCategories.js
import { useState, useEffect } from "react";
import { fetchActiveCategories } from "../api/categoryApi";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes — matches backend's own 600s category cache roughly

const cache = new Map();     // type -> { data, ts }
const inflight = new Map();  // type -> Promise

const parse = (res) =>
    Array.isArray(res?.data?.data) ? res.data.data
        : Array.isArray(res?.data?.categories) ? res.data.categories
            : Array.isArray(res?.data) ? res.data : [];

const isFresh = (entry) => entry && Date.now() - entry.ts < CACHE_TTL;

/**
 * Invalidate the categories cache.
 * - invalidateCategories() clears everything (all types)
 * - invalidateCategories("urbexon_hour") clears just that type
 *
 * Call this after any admin create/update/delete on categories so the
 * next render picks up fresh data instead of waiting out the TTL.
 */
export function invalidateCategories(type) {
    if (type) {
        cache.delete(type);
        inflight.delete(type);
    } else {
        cache.clear();
        inflight.clear();
    }
    // Notify any other mounted useCategories consumers (same tab) to refetch.
    window.dispatchEvent(new CustomEvent("categories:invalidated", { detail: { type } }));
}

export function useCategories(type) {
    const cached = cache.get(type);
    const [categories, setCategories] = useState(() => (isFresh(cached) ? cached.data : []));
    const [loading, setLoading] = useState(() => !isFresh(cached));

    useEffect(() => {
        let cancelled = false;

        const load = (force = false) => {
            const entry = cache.get(type);
            if (!force && isFresh(entry)) {
                setCategories(entry.data);
                setLoading(false);
                return;
            }

            if (!inflight.has(type)) {
                inflight.set(
                    type,
                    fetchActiveCategories({ params: { type } })
                        .then((res) => {
                            const cats = parse(res);
                            cache.set(type, { data: cats, ts: Date.now() });
                            return cats;
                        })
                        .catch(() => {
                            // Don't cache failures with a fresh timestamp — let it retry sooner.
                            cache.set(type, { data: [], ts: 0 });
                            return [];
                        })
                        .finally(() => inflight.delete(type))
                );
            }

            inflight.get(type).then((cats) => {
                if (!cancelled) { setCategories(cats); setLoading(false); }
            });
        };

        load();

        // Refetch if this type's cache gets invalidated elsewhere (e.g. admin panel action).
        const onInvalidate = (e) => {
            if (!e.detail?.type || e.detail.type === type) load(true);
        };
        window.addEventListener("categories:invalidated", onInvalidate);

        return () => {
            cancelled = true;
            window.removeEventListener("categories:invalidated", onInvalidate);
        };
    }, [type]);

    return { categories, loading };
}