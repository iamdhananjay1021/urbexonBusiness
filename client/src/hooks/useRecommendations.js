/**
 * useRecommendations — one hook for every recommendation rail.
 *
 *   const { products, loading } = useRecommendations("trending");
 *   const { products } = useRecommendations("popular-in-category", { category: "shirts" });
 *   const { products } = useRecommendations("similar", { productId });
 *
 * Backed by GET /products/recommendations (strategy map on the server).
 * Session-cached + abortable; new strategies need zero client changes.
 */
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const cache = new Map();
const TTL = 3 * 60 * 1000;

export const useRecommendations = (type, { category, productId, limit } = {}) => {
    const key = useMemo(
        () => JSON.stringify({ type, category: category || "", productId: productId || "", limit: limit || 12 }),
        [type, category, productId, limit]
    );

    const [result, setResult] = useState(() => {
        const hit = cache.get(key);
        return hit && Date.now() - hit.ts < TTL ? { key, products: hit.products } : { key: null, products: [] };
    });

    useEffect(() => {
        const ctrl = new AbortController();
        const params = JSON.parse(key);
        const hit = cache.get(key);
        const isWarm = hit && Date.now() - hit.ts < TTL;
        // Warm cache resolves through the same promise path (async, so no
        // sync setState inside the effect body).
        const source = isWarm
            ? Promise.resolve({ data: { products: hit.products } })
            : api.get("/products/recommendations", {
                params: { type: params.type, category: params.category || undefined, productId: params.productId || undefined, limit: params.limit },
                signal: ctrl.signal,
            });
        let cancelled = false;
        source
            .then(({ data }) => {
                if (cancelled) return;
                const products = data?.products || [];
                if (!isWarm) cache.set(key, { products, ts: Date.now() });
                setResult({ key, products });
            })
            .catch((err) => {
                if (cancelled || err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
                setResult({ key, products: [] });
            });
        return () => { cancelled = true; ctrl.abort(); };
    }, [key]);

    return { products: result.products, loading: result.key !== key };
};

export default useRecommendations;
