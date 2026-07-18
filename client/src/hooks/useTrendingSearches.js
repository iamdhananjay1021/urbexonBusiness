/**
 * useTrendingSearches — live "Trending" chips for the search overlay,
 * backed by GET /products/search/trending (SearchLog analytics).
 * Falls back to the provided static list until real data exists.
 * Fetched once per session (module cache).
 */
import { useEffect, useState } from "react";
import api from "../api/axios";

let cached = null;      // string[] | null
let inflight = null;    // Promise | null

export const useTrendingSearches = (fallback = []) => {
    const [terms, setTerms] = useState(cached || fallback);

    useEffect(() => {
        if (cached) return;
        let cancelled = false;
        inflight = inflight || api.get("/products/search/trending").then(({ data }) => {
            cached = Array.isArray(data?.terms) && data.terms.length ? data.terms : null;
            return cached;
        }).catch(() => null).finally(() => { inflight = null; });

        inflight?.then((result) => {
            if (!cancelled && result?.length) setTerms(result);
        });
        return () => { cancelled = true; };
        // fallback is intentionally not a dep — it's a static default
    }, []);

    return terms;
};

export default useTrendingSearches;
