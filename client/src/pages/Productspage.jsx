/**
 * ProductsPage.jsx — All Products Listing
 * ProductCard = the app's real business-logic component (../components/ProductCard),
 * left untouched. Chrome (header, sort, pagination, skeleton, empty/error states)
 * migrated to the Signal design system.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import { getProducts } from "../api/productApi";
import ProductCard from "../components/ProductCard";
import {
    FiChevronDown, FiPackage, FiAlertTriangle, FiFilter, FiX, FiArrowUp,
} from "react-icons/fi";
import Button from "../design-system/Button";
import Pagination from "../design-system/Pagination";
import { SkeletonCard } from "../design-system/Skeleton";
import { EmptyState, ErrorState } from "../design-system/EmptyState";

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

// Session-lifetime cache keyed by page/sort/category — same pattern as
// Home.jsx's _homeCache and useCategories.js. Without it, every visit to
// /products (including hitting Back from a product detail page) unmounted
// the grid and re-showed a full skeleton for a refetch of data that likely
// hadn't changed, which is what made the product images look like they
// were "reloading" on every navigation.
const CACHE_TTL = 60 * 1000;
const productsCache = new Map(); // `${page}|${sort}|${category}` -> { products, total, ts }
const cacheKeyFor = (page, sort, category) => `${page}|${sort}|${category}`;

/* ─────────────────────────────────────────────
   SORT DROPDOWN — kept custom (token-ified): needs a
   selected-item highlight that the generic Dropdown
   component doesn't support.
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
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-graphite-900)] text-white text-[13px] font-bold rounded-[var(--radius-md)] transition-colors hover:bg-[var(--color-graphite-800)] whitespace-nowrap"
            >
                <FiArrowUp size={13} className="rotate-180" aria-hidden="true" />
                {current}
                <FiChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {open && (
                <div role="menu" className="absolute top-full right-0 mt-2 bg-surface border border-default rounded-[var(--radius-md)] shadow-lg z-50 min-w-[190px] overflow-hidden">
                    {SORT_OPTIONS.map((opt, i) => (
                        <button
                            key={opt.val}
                            role="menuitem"
                            onClick={() => { onSort(opt.val); setOpen(false); }}
                            className={`w-full px-4 py-3 text-left text-[13px] font-medium transition-colors ${sort === opt.val ? "bg-accent-tint text-accent font-bold" : "text-primary hover:bg-canvas"
                                } ${i < SORT_OPTIONS.length - 1 ? "border-b border-default" : ""}`}
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
   MAIN PAGE
───────────────────────────────────────────── */
const ProductsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
    const [sort, setSort] = useState(searchParams.get("sort") || "newest");
    const [category, setCategory] = useState(searchParams.get("category") || "");

    const initialCache = productsCache.get(cacheKeyFor(page, sort, category));
    const [products, setProducts] = useState(() => initialCache?.products || []);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(() => initialCache?.total || 0);
    const [loading, setLoading] = useState(() => !initialCache || Date.now() - initialCache.ts > CACHE_TTL);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const categoryDisplay = category
        ? " — " + category.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
        : "";

    /* ── Fetch ── */
    useEffect(() => {
        const key = cacheKeyFor(page, sort, category);
        const cached = productsCache.get(key);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
            setProducts(cached.products);
            setTotal(cached.total);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        let query = `?page=${page}&limit=${PAGE_SIZE}&sort=${sort}&productType=ecommerce`;
        if (category) query += `&category=${encodeURIComponent(category)}`;

        getProducts(query)
            .then(r => {
                if (cancelled) return;
                const list = r.data?.products || [];
                const totalCount = r.data?.total || 0;
                setProducts(list);
                setTotal(totalCount);
                productsCache.set(key, { products: list, total: totalCount, ts: Date.now() });
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

    /* ── ERROR STATE ── */
    if (!loading && error) return (
        <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
            <ErrorState
                icon={FiAlertTriangle}
                title={error}
                description=""
                action={<Button variant="primary" onClick={() => window.location.reload()}>Try Again</Button>}
            />
        </div>
    );

    /* ── EMPTY STATE ── */
    if (!loading && products.length === 0) return (
        <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
            <EmptyState
                icon={FiPackage}
                title="No Products Found"
                description="Try adjusting your filters or check back soon!"
                action={category && (
                    <Button variant="primary" icon={FiX} onClick={clearCategory}>Clear Filter</Button>
                )}
            />
        </div>
    );

    /* ── MAIN RENDER ── */
    return (
        <div className="bg-canvas min-h-screen">
            <SEO
                title={`All Products${categoryDisplay}`}
                description={`Browse ${total || ""} products on Urbexon. Find the best deals on fashion, electronics, and more.`}
                path="/products"
            />

            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-20 bg-surface border-b border-default shadow-xs">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-primary leading-tight truncate font-display">
                            All Products{categoryDisplay}
                        </h1>
                        <p className="text-[12px] sm:text-[13px] text-secondary mt-0.5 font-medium">
                            {loading ? "Loading…" : `Showing ${products.length} of ${total.toLocaleString()} products`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {category && (
                            <button
                                onClick={clearCategory}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-canvas border border-default text-[12px] font-bold text-secondary hover:bg-[var(--color-graphite-100)] transition-colors"
                            >
                                <FiFilter size={10} className="text-accent" aria-hidden="true" />
                                {category.replace(/-/g, " ")}
                                <FiX size={9} aria-hidden="true" />
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
                    <div className="py-10">
                        <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductsPage;
