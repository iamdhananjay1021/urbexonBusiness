/**
 * ProductsPage.jsx — All Products Listing, powered by the global
 * filtering system (FilterProvider + useFilters).
 *
 * The page itself contains ZERO filter logic: URL sync, debounced
 * fetching, facet generation, chips — all live in useFilters(). The
 * sidebar/drawer render whatever facets the backend aggregates, so new
 * brands/attributes added from Admin appear here automatically.
 *
 * ProductCard = the app's real business-logic component, untouched.
 */
import { useState, useEffect, useRef, memo } from "react";
import SEO from "../components/SEO";
import ProductCard from "../components/ProductCard";
import { FilterProvider, useFilterContext } from "../context/FilterContext";
import { FilterSidebar, FilterChips, FilterDrawer } from "../components/filters";
import {
    FiChevronDown, FiPackage, FiAlertTriangle, FiFilter, FiX, FiArrowUp,
} from "react-icons/fi";
import Button from "../design-system/Button";
import Pagination from "../design-system/Pagination";
import { SkeletonCard } from "../design-system/Skeleton";
import { EmptyState, ErrorState } from "../design-system/EmptyState";

const SORT_OPTIONS = [
    { val: "newest", label: "Newest First" },
    { val: "recommended", label: "Recommended" },
    { val: "popularity", label: "Popularity" },
    { val: "price_asc", label: "Price: Low to High" },
    { val: "price_desc", label: "Price: High to Low" },
    { val: "rating", label: "Top Rated" },
    { val: "discount", label: "Best Discount" },
];

const PAGE_SIZE = 24;

/* ─── Sort dropdown (needs selected-item highlight) ─── */
const SortDropdown = memo(({ sort, onSort }) => {
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
                className="flex items-center gap-2 h-10 px-4 bg-[var(--color-graphite-900)] text-white text-[13px] font-bold rounded-[var(--radius-md)] transition-colors duration-200 hover:bg-[var(--color-graphite-800)] whitespace-nowrap focus-ring-accent"
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
                            className={`w-full px-4 py-3 text-left text-[13px] font-medium transition-colors duration-150 ${sort === opt.val ? "bg-accent-tint text-accent font-bold" : "text-primary hover:bg-canvas"
                                } ${i < SORT_OPTIONS.length - 1 ? "border-b border-[var(--color-graphite-100)]" : ""}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});
SortDropdown.displayName = "SortDropdown";

/* ─── Inner page — everything reads from FilterContext ─── */
const ProductsPageInner = () => {
    const f = useFilterContext();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const categoryDisplay = f.category
        ? " — " + f.category.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
        : "";

    return (
        <div className="bg-canvas min-h-screen">
            <SEO
                title={`All Products${categoryDisplay}`}
                description={`Browse ${f.total || ""} products on Urbexon. Find the best deals on fashion, electronics, and more.`}
                path="/products"
            />

            {/* ── Sticky Header ── */}
            <div className="sticky top-[var(--nav-h,0px)] z-20 bg-surface border-b border-default shadow-xs">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-primary leading-tight truncate font-display">
                            All Products{categoryDisplay}
                        </h1>
                        <p className="text-[12px] sm:text-[13px] text-secondary mt-0.5 font-medium" aria-live="polite">
                            {f.loading ? "Loading…" : `Showing ${f.products.length} of ${f.total.toLocaleString()} products`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Mobile: open the filter bottom sheet */}
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className="lg:hidden flex items-center gap-2 h-10 px-4 rounded-[var(--radius-md)]
                                       bg-white border border-default text-[13px] font-bold text-primary
                                       hover:border-strong transition-colors duration-200 focus-ring-accent"
                        >
                            <FiFilter size={13} className="text-accent" aria-hidden="true" />
                            Filters
                            {f.hasActiveFilters && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                                    {f.chips.length}
                                </span>
                            )}
                        </button>
                        <SortDropdown sort={f.sort} onSort={f.setSort} />
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-10 py-5 sm:py-7">
                <div className="flex gap-6 lg:gap-8 items-start">

                    {/* ── Desktop sidebar — sticky ── */}
                    <aside className="hidden lg:block w-[260px] shrink-0 sticky top-[calc(var(--nav-h,0px)+96px)]
                                      max-h-[calc(100vh-108px)] overflow-y-auto scrollbar-hide
                                      bg-white border border-[var(--color-graphite-100)] rounded-xl px-5 py-2
                                      shadow-[var(--shadow-xs)]">
                        <div className="flex items-center justify-between py-3 border-b border-[var(--color-graphite-100)]">
                            <span className="text-[13px] font-bold text-primary uppercase tracking-[0.08em]">Filters</span>
                            {f.hasActiveFilters && (
                                <button onClick={f.clearAll}
                                    className="text-[11px] font-bold text-accent hover:text-[var(--accent-primary-hover)] uppercase tracking-wide transition-colors duration-200 focus-ring-accent rounded">
                                    Clear all
                                </button>
                            )}
                        </div>
                        <FilterSidebar />
                    </aside>

                    {/* ── Results column ── */}
                    <div className="flex-1 min-w-0">
                        {/* Selected chips */}
                        {f.hasActiveFilters && (
                            <div className="mb-4"><FilterChips /></div>
                        )}

                        {/* Error */}
                        {!f.loading && f.error ? (
                            <div className="py-16 flex justify-center">
                                <ErrorState
                                    icon={FiAlertTriangle}
                                    title={f.error}
                                    description="Check your connection and try again."
                                    action={<Button variant="primary" onClick={f.retry}>Try Again</Button>}
                                />
                            </div>
                        ) : !f.loading && f.products.length === 0 ? (
                            /* Empty */
                            <div className="py-16 flex justify-center">
                                <EmptyState
                                    icon={FiPackage}
                                    title="No Products Found"
                                    description={f.hasActiveFilters
                                        ? "No products match these filters — try removing a few."
                                        : "Try adjusting your search or check back soon!"}
                                    action={f.hasActiveFilters && (
                                        <Button variant="primary" icon={FiX} onClick={f.clearAll}>Clear Filters</Button>
                                    )}
                                />
                            </div>
                        ) : (
                            <>
                                {/* 2 → 3 → 4 col grid (sidebar takes one visual column on lg+) */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                                    {f.loading
                                        ? Array(PAGE_SIZE).fill(0).map((_, i) => <SkeletonCard key={i} />)
                                        : f.products.map(p => (
                                            <ProductCard key={p._id || p.id} product={p} hideActions />
                                        ))
                                    }
                                </div>

                                {!f.loading && f.totalPages > 1 && (
                                    <div className="py-10">
                                        <Pagination page={f.page} totalPages={f.totalPages} onChange={f.setPage} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Mobile bottom-sheet filters ── */}
            <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </div>
    );
};

/* ─── Page shell — provides ONE shared filter state ─── */
const ProductsPage = () => (
    <FilterProvider base={{}}>
        <ProductsPageInner />
    </FilterProvider>
);

export default ProductsPage;
