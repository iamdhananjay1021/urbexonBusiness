/**
 * useRecentlyViewed — localStorage-based recently viewed products tracker
 * Separate storage for Ecommerce vs Urbexon Hour — they never merge.
 *
 * Usage:
 *   useRecentlyViewed("ecommerce")      → ecommerce products
 *   useRecentlyViewed("urbexon_hour") → UH products
 */
import { useState, useCallback, useEffect } from "react";

const KEYS = {
    ecommerce: "ux_recently_viewed",
    urbexon_hour: "ux_recently_viewed_uh",
};
const MAX_ITEMS = 20;

const SOURCE_ALIASES = {
    ecommerce: ["ecommerce", "ec", "shop", "store"],
    urbexon_hour: ["urbexon_hour", "urbexonhour", "urbexon-hour", "hour", "uh"],
};

export const normalizeRecentlyViewedSource = (value) => {
    if (!value) return "ecommerce";
    const raw = String(value).trim().toLowerCase();
    if (SOURCE_ALIASES.ecommerce.includes(raw)) return "ecommerce";
    if (SOURCE_ALIASES.urbexon_hour.includes(raw)) return "urbexon_hour";
    return "ecommerce";
};

const normalizeEntry = (entry, fallbackSource = "ecommerce", preferStoredModule = true) => {
    if (!entry || typeof entry !== "object") return null;

    const recognizedSource = preferStoredModule
        ? normalizeRecentlyViewedSource(entry.productType || entry.module || entry.source || entry.type || fallbackSource)
        : normalizeRecentlyViewedSource(fallbackSource || entry.productType || entry.module || entry.source || entry.type || "ecommerce");
    const normalizedImage = entry.image?.url || entry.image || (typeof entry.image === "string" ? entry.image : "");
    const firstImage = Array.isArray(entry.images) && entry.images.length ? entry.images[0] : null;
    const imageUrl = firstImage?.url || firstImage?.image || normalizedImage || "";

    return {
        ...entry,
        _id: entry._id,
        name: entry.name,
        slug: entry.slug || entry._id,
        price: entry.price,
        mrp: entry.mrp,
        images: firstImage ? [{ url: imageUrl }] : [],
        image: imageUrl,
        inStock: entry.inStock !== false,
        viewedAt: entry.viewedAt || Date.now(),
        productType: recognizedSource,
    };
};

export const filterRecentlyViewedItems = (items, source = "ecommerce") => {
    const target = normalizeRecentlyViewedSource(source);
    if (!Array.isArray(items)) return [];

    return items
        .map((item) => normalizeEntry(item, target))
        .filter(Boolean)
        .filter((item) => normalizeRecentlyViewedSource(item.productType) === target)
        .sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0))
        .slice(0, MAX_ITEMS);
};

const getStored = (key) => {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
    try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const migrateStoredItems = (source = "ecommerce") => {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return [];

    const target = normalizeRecentlyViewedSource(source);
    const entriesByModule = { ecommerce: [], urbexon_hour: [] };
    const seen = new Set();

    Object.entries(KEYS).forEach(([module, key]) => {
        getStored(key).forEach((rawItem) => {
            const normalized = normalizeEntry(rawItem, module);
            if (!normalized?._id) return;
            const moduleName = normalizeRecentlyViewedSource(normalized.productType);
            const dedupeKey = `${moduleName}:${normalized._id}`;
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);
            entriesByModule[moduleName].push(normalized);
        });
    });

    Object.entries(entriesByModule).forEach(([module, items]) => {
        const cleaned = items
            .sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0))
            .slice(0, MAX_ITEMS);
        localStorage.setItem(KEYS[module], JSON.stringify(cleaned));
    });

    return filterRecentlyViewedItems(getStored(KEYS[target]), target);
};

export const useRecentlyViewed = (source = "ecommerce") => {
    const key = KEYS[normalizeRecentlyViewedSource(source)] || KEYS.ecommerce;
    const [items, setItems] = useState(() => migrateStoredItems(source));

    useEffect(() => {
        const nextItems = migrateStoredItems(source);
        setItems(nextItems);
    }, [key, source]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === key) setItems(filterRecentlyViewedItems(getStored(key), source));
        };
        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
    }, [key, source]);

    const trackView = useCallback((product) => {
        if (!product?._id) return;

        const entry = normalizeEntry({ ...product, viewedAt: Date.now() }, source, false);
        if (!entry) return;

        const current = filterRecentlyViewedItems(getStored(key), source).filter((p) => p._id !== entry._id);
        const updated = [entry, ...current].slice(0, MAX_ITEMS);

        localStorage.setItem(key, JSON.stringify(updated));
        setItems(updated);
    }, [key, source]);

    const clearAll = useCallback(() => {
        localStorage.removeItem(key);
        setItems([]);
    }, [key]);

    return { recentlyViewed: items, trackView, clearAll };
};
