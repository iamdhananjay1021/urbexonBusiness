// hooks/useAllCategories.js
import { useState, useEffect } from "react";
import { fetchActiveCategories } from "../api/categoryApi";

let cache = null;
let inflight = null;

export function useAllCategories() {
    const [data, setData] = useState(cache || []);
    const [loading, setLoading] = useState(!cache);

    useEffect(() => {
        if (cache) { setData(cache); setLoading(false); return; }
        if (!inflight) {
            inflight = fetchActiveCategories().then((res) => {
                cache = Array.isArray(res?.data) ? res.data : (res?.data?.data || []);
                return cache;
            }).finally(() => { inflight = null; });
        }
        inflight.then((cats) => { setData(cats); setLoading(false); });
    }, []);

    return { categories: data, loading };
}