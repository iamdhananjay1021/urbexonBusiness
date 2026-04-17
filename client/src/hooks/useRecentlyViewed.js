/**
 * useRecentlyViewed — localStorage-based recently viewed products tracker
 * Separate storage for Ecommerce vs Urbexon Hour — they never merge.
 *
 * Usage:
 *   useRecentlyViewed()              → ecommerce (default)
 *   useRecentlyViewed("urbexon_hour") → UH products
 */
import { useState, useCallback, useEffect } from "react";

const KEYS = {
    ecommerce: "ux_recently_viewed",
    urbexon_hour: "ux_recently_viewed_uh",
};
const MAX_ITEMS = 20;

const getStored = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
        return [];
    }
};

export const useRecentlyViewed = (source = "ecommerce") => {
    const key = KEYS[source] || KEYS.ecommerce;
    const [items, setItems] = useState(() => getStored(key));

    // Sync across tabs
    useEffect(() => {
        const handler = (e) => {
            if (e.key === key) setItems(getStored(key));
        };
        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
    }, [key]);

    const trackView = useCallback((product) => {
        if (!product?._id) return;

        const entry = {
            _id: product._id,
            name: product.name,
            slug: product.slug || product._id,
            price: product.price,
            mrp: product.mrp,
            images: product.images?.length ? [{ url: product.images[0].url }] : [],
            image: product.images?.[0]?.url || product.image?.url || (typeof product.image === "string" ? product.image : ""),
            inStock: product.inStock !== false,
            viewedAt: Date.now(),
        };

        const current = getStored(key).filter(p => p._id !== product._id);
        const updated = [entry, ...current].slice(0, MAX_ITEMS);

        localStorage.setItem(key, JSON.stringify(updated));
        setItems(updated);
    }, [key]);

    const clearAll = useCallback(() => {
        localStorage.removeItem(key);
        setItems([]);
    }, [key]);

    return { recentlyViewed: items, trackView, clearAll };
};
