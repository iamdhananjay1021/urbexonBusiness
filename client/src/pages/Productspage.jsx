/**
 * ProductsPage.jsx — All Products Listing
 * Pure Tailwind CSS · ProductCard (same as Home) · Proper responsive grid
 * Production ready — no inline styles, no style blocks
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import api from "../api/axios";
import ProductCard from "../components/ProductCard";
import {
    FaSortAmountDown, FaChevronDown, FaChevronLeft,
    FaChevronRight, FaBoxOpen, FaExclamationTriangle,
    FaFilter, FaTimes,
} from "react-icons/fa";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const SORT_OPTIONS = [
    { val: "newest", label: "Newest First" },
    { val: "price_asc", label: "Price: Low to High" },
    { val: "price_desc", label: "Price: High to Low" },
    { val: "rating", label: "Top Rated" },
    { val: "discount", label: "Best Discount" },
];

const PAGE_SIZE = 24;

/* ─────────────────────────────────────────────
   SKELETON — exact ProductCard shape
───────────────────────────────────────────── */
const SkeletonCard = () => (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col w-full h-full">
        <div className="w-full aspect-square bg-stone-100 animate-pulse" />
        <div className="p-3 flex flex-col gap-2 flex-1">
            <div className="h-2.5 w-1/3 bg-stone-200 rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-stone-200 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-stone-200 rounded animate-pulse" />
            <div className="mt-auto pt-2 space-y-2">
                <div className="h-4 w-2/5 bg-stone-200 rounded animate-pulse" />
                <div className="h-8 bg-stone-200 rounded animate-pulse" />
            </div>
        </div>
    </div>
);

/* ─────────────────────────────────────────────
   SORT DROPDOWN
───────────────────────────────────────────── */
const SortDropdown = ({ sort, onSort }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const current = SORT_OPTIONS.find(o => o.val === sort)?.label || "Sort";

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1c1917] text-white text-[13px] font-bold rounded-lg transition-all hover:bg-[#2d2926] whitespace-nowrap"
            >
                <FaSortAmountDown size={13} />
                {current}
                <FaChevronDown
                    size={10}
                    className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-[#e7e5e1] rounded-xl shadow-xl z-50 min-w-[190px] overflow-hidden">
                    {SORT_OPTIONS.map((opt, i) => (
                        <button
                            key={opt.val}
                            onClick={() => { onSort(opt.val); setOpen(false); }}
                            className={`w-full px-4 py-3 text-left text-[13px] font-medium transition-colors
                ${sort === opt.val
                                    ? "bg-[#f7f4f0] text-[#c8a96e] font-bold"
                                    : "text-[#1c1917] hover:bg-[#f7f4f0]"
                                }
                ${i < SORT_OPTIONS.length - 1 ? "border-b border-[#f0ede8]" : ""}
              `}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────
   PAGINATION
───────────────────────────────────────────── */
const Pagination = ({ page, totalPages, onChange }) => {
    if (totalPages <= 1) return null;

    // Build page number list with ellipsis
    const pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (page > 3) pages.push("…");
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
        if (page < totalPages - 2) pages.push("…");
        pages.push(totalPages);
    }

    const btnBase = "flex items-center justify-center w-9 h-9 rounded-lg text-[13px] font-bold transition-all";

    return (
        <div className="flex items-center justify-center gap-1.5 py-10 px-4 flex-wrap">
            {/* Prev */}
            <button
                onClick={() => onChange(page - 1)}
                disabled={page === 1}
                className={`${btnBase} ${page === 1 ? "bg-[#f0ede8] text-[#a8a29e] cursor-not-allowed" : "bg-[#1c1917] text-white hover:bg-[#2d2926]"}`}
            >
                <FaChevronLeft size={11} />
            </button>

            {pages.map((p, i) =>
                p === "…" ? (
                    <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-[#a8a29e] text-sm">…</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        className={`${btnBase} ${page === p ? "bg-[#1c1917] text-white shadow-md" : "bg-[#f0ede8] text-[#1c1917] hover:bg-[#e7e3db]"}`}
                    >
                        {p}
                    </button>
                )
            )}

            {/* Next */}
            <button
                onClick={() => onChange(page + 1)}
                disabled={page === totalPages}
                className={`${btnBase} ${page === totalPages ? "bg-[#f0ede8] text-[#a8a29e] cursor-not-allowed" : "bg-[#1c1917] text-white hover:bg-[#2d2926]"}`}
            >
                <FaChevronRight size={11} />
            </button>
        </div>
    );
};

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
const ProductsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);

    const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
    const [sort, setSort] = useState(searchParams.get("sort") || "newest");
    const [category, setCategory] = useState(searchParams.get("category") || "");

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const categoryDisplay = category
        ? " — " + category.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
        : "";

    /* ── Fetch ── */
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        let url = `/products?page=${page}&limit=${PAGE_SIZE}&sort=${sort}&productType=ecommerce`;
        if (category) url += `&category=${encodeURIComponent(category)}`;

        api.get(url)
            .then(r => {
                if (cancelled) return;
                setProducts(r.data?.products || []);
                setTotal(r.data?.total || 0);
            })
            .catch(err => {
                if (cancelled) return;
                setError(err.response?.data?.error || "Failed to load products");
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [page, sort, category]);

    /* ── Handlers ── */
    const handleSort = useCallback((newSort) => {
        setSort(newSort);
        setPage(1);
        const params = { sort: newSort, page: 1 };
        if (category) params.category = category;
        setSearchParams(params);
    }, [category, setSearchParams]);

    const handlePageChange = useCallback((newPage) => {
        setPage(newPage);
        const params = { sort, page: newPage };
        if (category) params.category = category;
        setSearchParams(params);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [sort, category, setSearchParams]);

    const clearCategory = useCallback(() => {
        setCategory("");
        setPage(1);
        setSearchParams({ sort, page: 1 });
    }, [sort, setSearchParams]);

    /* ─────────────────────────────────────────
       ERROR STATE
    ───────────────────────────────────────── */
    if (!loading && error) return (
        <div className="min-h-screen bg-[#f7f4f0] flex flex-col items-center justify-center px-4 gap-4">
            <FaExclamationTriangle size={40} className="text-[#e7e5e1]" />
            <h3 className="text-lg font-extrabold text-[#1c1917]">{error}</h3>
            <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-[#1c1917] text-white text-[13px] font-bold rounded-lg hover:bg-[#2d2926] transition-colors"
            >
                Try Again
            </button>
        </div>
    );

    /* ─────────────────────────────────────────
       EMPTY STATE
    ───────────────────────────────────────── */
    if (!loading && products.length === 0) return (
        <div className="min-h-screen bg-[#f7f4f0] flex flex-col items-center justify-center px-4 gap-3">
            <FaBoxOpen size={40} className="text-[#e7e5e1]" />
            <h3 className="text-lg font-extrabold text-[#1c1917]">No Products Found</h3>
            <p className="text-[14px] text-[#78716c]">Try adjusting your filters or check back soon!</p>
            {category && (
                <button
                    onClick={clearCategory}
                    className="flex items-center gap-1.5 mt-2 px-4 py-2 bg-[#1c1917] text-white text-[13px] font-bold rounded-lg hover:bg-[#2d2926] transition-colors"
                >
                    <FaTimes size={11} /> Clear Filter
                </button>
            )}
        </div>
    );

    /* ─────────────────────────────────────────
       MAIN RENDER
    ───────────────────────────────────────── */
    return (
        <div className="bg-[#f7f4f0] min-h-screen">
            <SEO
                title={`All Products${categoryDisplay}`}
                description={`Browse ${total || ""} products on Urbexon. Find the best deals on fashion, electronics, and more.`}
                path="/products"
            />

            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-20 bg-white border-b border-[#e7e5e1] shadow-sm">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-4 flex-wrap">
                    {/* Title + meta */}
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1c1917] leading-tight truncate">
                            All Products{categoryDisplay}
                        </h1>
                        <p className="text-[12px] sm:text-[13px] text-[#78716c] mt-0.5 font-medium">
                            {loading
                                ? "Loading…"
                                : `Showing ${products.length} of ${total.toLocaleString()} products`}
                        </p>
                    </div>

                    {/* Right: active filter chip + sort */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {category && (
                            <button
                                onClick={clearCategory}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f7f4f0] border border-[#e7e5e1] text-[12px] font-bold text-[#78716c] hover:bg-[#ede9e4] transition-colors"
                            >
                                <FaFilter size={10} className="text-[#c8a96e]" />
                                {category.replace(/-/g, " ")}
                                <FaTimes size={9} />
                            </button>
                        )}
                        <SortDropdown sort={sort} onSort={handleSort} />
                    </div>
                </div>
            </div>

            {/* ── Products Grid ── */}
            <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-10 py-5 sm:py-7">
                {/*
          RESPONSIVE GRID — same as Home page:
          2 cols mobile · 3 cols sm · 4 cols lg · 5 cols xl
          This ensures cards are same size everywhere on the site.
        */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
                    {loading
                        ? Array(PAGE_SIZE).fill(0).map((_, i) => <SkeletonCard key={i} />)
                        : products.map(p => (
                            <ProductCard key={p._id || p.id} product={p} hideActions />
                        ))
                    }
                </div>

                {/* ── Pagination ── */}
                {!loading && (
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onChange={handlePageChange}
                    />
                )}
            </div>
        </div>
    );
};

export default ProductsPage;