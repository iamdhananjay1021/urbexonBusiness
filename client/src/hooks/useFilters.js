/**
 * useFilters.js — the engine behind the global filtering system.
 *
 * ONE hook powers every listing page (All Products, Category pages, …):
 *
 *   const f = useFilters({ base: { category: "shirts" } });
 *
 * Responsibilities:
 *   • URL ⟷ state sync — every filter lives in the query string, so
 *     refresh preserves filters and the browser Back button works.
 *   • Fetches products (debounced, AbortController-cancelled) and the
 *     dynamic facet groups for the current context.
 *   • Derives selected-filter chips, hasActiveFilters, pagination.
 *
 * URL param conventions (all optional):
 *   brand=Nike,Puma   color=Black,Blue   size=M,L      ← multi (comma)
 *   priceMin=500&priceMax=2000  rating=4  discount=25  ← single
 *   attr_fabric=Cotton,Silk                            ← dynamic attributes
 *   sort=price_asc  page=2  search=shirt
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchFilteredProducts, fetchFacets } from "../services/filter.service";

const PAGE_SIZE = 24;
const DEBOUNCE_MS = 250;

/** Params that are NOT value-filters (never rendered as chips). */
const RESERVED = new Set(["page", "sort", "search", "category", "subcategory"]);
const MULTI_KEYS = new Set(["brand", "color", "size"]);

const parseMulti = (v) => (v ? v.split(",").filter(Boolean) : []);

export const useFilters = ({ base = {} } = {}) => {
    const [searchParams, setSearchParams] = useSearchParams();

    /* ── 1. Read the full filter state straight from the URL ── */
    const state = useMemo(() => {
        const s = {
            page: Math.max(1, Number(searchParams.get("page")) || 1),
            sort: searchParams.get("sort") || "newest",
            search: searchParams.get("search") || "",
            category: base.category ?? (searchParams.get("category") || ""),
            subcategory: searchParams.get("subcategory") || "",
            brand: parseMulti(searchParams.get("brand")),
            color: parseMulti(searchParams.get("color")),
            size: parseMulti(searchParams.get("size")),
            priceMin: searchParams.get("priceMin") || "",
            priceMax: searchParams.get("priceMax") || "",
            rating: searchParams.get("rating") || "",
            discount: searchParams.get("discount") || "",
            availability: searchParams.get("availability") || "",
            attrs: {},
        };
        for (const [key, value] of searchParams.entries()) {
            if (key.startsWith("attr_")) s.attrs[key.slice(5)] = parseMulti(value);
        }
        return s;
        // base.category is a stable page prop; searchParams is the source of truth
    }, [searchParams, base.category]);

    /* ── 2. URL writers ────────────────────────────────────── */
    const updateParams = useCallback((mutate, { resetPage = true } = {}) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            mutate(next);
            if (resetPage) next.delete("page");
            return next;
        }, { replace: false });
    }, [setSearchParams]);

    /** Toggle one value inside a multi-select group ("brand", "attr_fabric"…). */
    const toggleValue = useCallback((group, value) => {
        updateParams((next) => {
            const current = parseMulti(next.get(group));
            const idx = current.findIndex((v) => v.toLowerCase() === String(value).toLowerCase());
            if (idx >= 0) current.splice(idx, 1); else current.push(value);
            if (current.length) next.set(group, current.join(","));
            else next.delete(group);
        });
    }, [updateParams]);

    /** Set (or clear with "") a single-value param — rating, discount, subcategory… */
    const setValue = useCallback((key, value) => {
        updateParams((next) => {
            if (value === "" || value == null) next.delete(key);
            else next.set(key, String(value));
        });
    }, [updateParams]);

    /** Price range — both bounds at once so one URL entry is pushed. */
    const setPriceRange = useCallback((min, max) => {
        updateParams((next) => {
            if (min != null && min !== "") next.set("priceMin", String(min)); else next.delete("priceMin");
            if (max != null && max !== "") next.set("priceMax", String(max)); else next.delete("priceMax");
        });
    }, [updateParams]);

    const setSort = useCallback((sort) => setValue("sort", sort === "newest" ? "" : sort), [setValue]);

    const setPage = useCallback((page) => {
        updateParams((next) => {
            if (page > 1) next.set("page", String(page)); else next.delete("page");
        }, { resetPage: false });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [updateParams]);

    const clearAll = useCallback(() => {
        updateParams((next) => {
            for (const key of [...next.keys()]) {
                if (!RESERVED.has(key)) next.delete(key);
            }
        });
    }, [updateParams]);

    /* ── 3. Selected-filter chips (derived) ────────────────── */
    const chips = useMemo(() => {
        const list = [];
        for (const key of MULTI_KEYS) {
            for (const v of state[key]) list.push({ group: key, value: v, label: v });
        }
        for (const [attrKey, values] of Object.entries(state.attrs)) {
            for (const v of values) list.push({ group: `attr_${attrKey}`, value: v, label: v });
        }
        if (state.subcategory) list.push({ group: "subcategory", value: state.subcategory, label: state.subcategory, single: true });
        if (state.priceMin || state.priceMax) {
            list.push({
                group: "price", single: true,
                value: "price",
                label: `₹${state.priceMin || 0} – ₹${state.priceMax || "max"}`,
            });
        }
        if (state.rating) list.push({ group: "rating", value: state.rating, label: `${state.rating}★ & above`, single: true });
        if (state.discount) list.push({ group: "discount", value: state.discount, label: `${state.discount}%+ off`, single: true });
        if (state.availability === "all") list.push({ group: "availability", value: "all", label: "Include out of stock", single: true });
        return list;
    }, [state]);

    const removeChip = useCallback((chip) => {
        if (chip.group === "price") setPriceRange("", "");
        else if (chip.single) setValue(chip.group, "");
        else toggleValue(chip.group, chip.value);
    }, [setPriceRange, setValue, toggleValue]);

    const hasActiveFilters = chips.length > 0;

    /* ── 4. Products fetch — debounced + abortable ──────────
       Results are stored WITH the request key they belong to, so
       `loading` is derived (result.key !== currentKey) instead of being
       set synchronously inside the effect. */
    const [result, setResult] = useState({ key: null, products: [], total: 0 });
    const [errorState, setErrorState] = useState(null); // { key, message }
    const [retryTick, setRetryTick] = useState(0);
    const retry = useCallback(() => setRetryTick((t) => t + 1), []);

    const productParams = useMemo(() => {
        const p = {
            productType: base.productType || "ecommerce",
            page: state.page,
            limit: base.pageSize || PAGE_SIZE,
            sort: state.sort,
        };
        if (state.search) p.search = state.search;
        if (state.category) p.category = state.category;
        if (state.subcategory) p.subcategory = state.subcategory;
        if (state.brand.length) p.brand = state.brand.join(",");
        if (state.color.length) p.color = state.color.join(",");
        if (state.size.length) p.size = state.size.join(",");
        if (state.priceMin) p.minPrice = state.priceMin;
        if (state.priceMax) p.maxPrice = state.priceMax;
        if (state.rating) p.rating = state.rating;
        if (state.discount) p.discount = state.discount;
        if (state.availability) p.availability = state.availability;
        if (base.deal) p.deal = "true";
        for (const [k, values] of Object.entries(state.attrs)) {
            if (values.length) p[`attr_${k}`] = values.join(",");
        }
        return p;
    }, [state, base.productType, base.pageSize, base.deal]);

    // Deterministic dependency key — avoids refetching when the object
    // identity changes but the actual params didn't.
    const productKey = useMemo(() => JSON.stringify(productParams), [productParams]);

    useEffect(() => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => {
            fetchFilteredProducts(JSON.parse(productKey), ctrl.signal)
                .then((data) => {
                    // Backend returns { loading: true } while its anti-stampede
                    // lock is held — retry shortly instead of showing 0 results.
                    if (data?.loading) { setTimeout(retry, 700); return; }
                    setResult({ key: productKey, products: data?.products || [], total: data?.total || 0 });
                })
                .catch((err) => {
                    if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
                    setErrorState({ key: productKey, message: err.response?.data?.message || "Failed to load products" });
                });
        }, DEBOUNCE_MS);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [productKey, retryTick, retry]);

    const error = errorState?.key === productKey ? errorState.message : null;
    const loading = result.key !== productKey && !error;
    const { products, total } = result;

    /* ── 5. Facets fetch — only when the CONTEXT changes ───── */
    const [facetResult, setFacetResult] = useState({ key: null, facets: null });

    const facetKey = useMemo(() => JSON.stringify({
        productType: base.productType || "ecommerce",
        category: state.category || "",
        search: state.search || "",
        deal: base.deal ? "true" : "",
    }), [base.productType, base.deal, state.category, state.search]);

    useEffect(() => {
        const ctrl = new AbortController();
        fetchFacets(JSON.parse(facetKey), ctrl.signal)
            .then((data) => setFacetResult({ key: facetKey, facets: data?.filters || null }))
            .catch((err) => {
                if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
                setFacetResult({ key: facetKey, facets: null });
            });
        return () => ctrl.abort();
    }, [facetKey]);

    const facets = facetResult.facets;
    const facetsLoading = facetResult.key !== facetKey;

    const pageSize = base.pageSize || PAGE_SIZE;

    return {
        // data
        products, total, loading, error, retry,
        facets, facetsLoading,
        // state
        ...state,
        chips, hasActiveFilters,
        page: state.page,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        // actions
        toggleValue, setValue, setPriceRange, setSort, setPage, clearAll, removeChip,
    };
};

export default useFilters;
