/**
 * Categorypage.jsx — /category/:slug listing, powered by the global
 * filtering system (FilterProvider + useFilters).
 *
 * ZERO page-specific filter logic: the provider gets the category as its
 * base context and everything else (URL sync, debounced fetches, facets,
 * chips, drawer) is the same reusable machinery as ProductsPage —
 * so a "Shirts" category automatically gets fabric/size/brand filters
 * while "Mobiles" gets ram/storage, purely from live product data.
 *
 * ProductCard (real cart/wishlist business logic) is untouched.
 */
import { useState, useEffect, memo } from "react";
import { useParams } from "react-router-dom";
import { fetchCategoryMetadata } from "../api/categoryApi";
import ProductCard from "../components/ProductCard";
import { FiSearch, FiFilter, FiX, FiChevronDown, FiChevronUp, FiPackage, FiAlertTriangle } from "react-icons/fi";
import { FaSortAmountDown } from "react-icons/fa";
import SEO, { JsonLd } from "../components/SEO";
import { normalizeCategory } from "../utils/normalizeCategory";
import Chip from "../design-system/Chip";
import Button from "../design-system/Button";
import Pagination from "../design-system/Pagination";
import { EmptyState, ErrorState } from "../design-system/EmptyState";
import { SkeletonCard } from "../design-system/Skeleton";
import { FilterProvider, useFilterContext } from "../context/FilterContext";
import { FilterSidebar, FilterChips, FilterDrawer } from "../components/filters";

const SORT_OPTIONS = [
    { val: "newest", label: "Newest First" },
    { val: "recommended", label: "Recommended" },
    { val: "popularity", label: "Popularity" },
    { val: "price_asc", label: "Price: Low to High" },
    { val: "price_desc", label: "Price: High to Low" },
    { val: "rating", label: "Top Rated" },
    { val: "discount", label: "Best Discount" },
];

/* ─── Sort dropdown (compact toolbar variant) ─── */
const SortMenu = memo(({ sort, onSort }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative ml-auto order-2 sm:order-none">
            <button
                onClick={() => setOpen(o => !o)}
                aria-haspopup="menu" aria-expanded={open}
                className="flex items-center gap-2 px-4 h-[38px] border border-default bg-surface text-[12px] font-semibold text-primary rounded-[var(--radius-sm)] focus-ring-accent"
            >
                <FaSortAmountDown size={12} aria-hidden="true" />
                <span className="hidden sm:inline">{SORT_OPTIONS.find(s => s.val === sort)?.label || "Sort"}</span>
                {open ? <FiChevronUp size={11} aria-hidden="true" /> : <FiChevronDown size={11} aria-hidden="true" />}
            </button>
            {open && (
                <>
                    <div onClick={() => setOpen(false)} className="fixed inset-0 z-[49]" aria-hidden="true" />
                    <div role="menu" className="absolute top-[calc(100%+6px)] right-[-8px] sm:right-0 bg-surface border border-default min-w-[190px] z-50 shadow-md rounded-[var(--radius-md)] py-1.5">
                        {SORT_OPTIONS.map(opt => (
                            <button
                                key={opt.val} role="menuitem"
                                onClick={() => { onSort(opt.val); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-[13px] font-medium cursor-pointer transition-colors duration-100 ${sort === opt.val ? "text-accent font-bold bg-accent-tint" : "text-primary hover:bg-canvas"}`}
                            >
                                {sort === opt.val && "✓ "}{opt.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
});
SortMenu.displayName = "SortMenu";

/* ─── Inner page — reads everything from FilterContext ─── */
const CategoryPageInner = ({ slug, categoryLabel, meta }) => {
    const f = useFilterContext();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchInput, setSearchInput] = useState(f.search);

    // Keep the input in sync when the URL changes externally (Back button) —
    // render-phase adjustment instead of a setState-in-effect.
    const [prevSearch, setPrevSearch] = useState(f.search);
    if (prevSearch !== f.search) {
        setPrevSearch(f.search);
        setSearchInput(f.search);
    }

    const handleSearch = (e) => {
        e.preventDefault();
        f.setValue("search", searchInput.trim());
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const subcategories = f.facets?.subcategories || [];

    return (
        <>
            {/* SEO — driven by category metadata when the admin has set it */}
            <SEO
                title={meta?.seo?.title || categoryLabel || slug?.replace(/-/g, " ")}
                description={meta?.seo?.description ||
                    `Shop ${categoryLabel || slug?.replace(/-/g, " ")} on Urbexon. Browse ${f.total || ""} products with best prices and fast delivery.`}
                path={`/category/${slug}`}
                image={meta?.image || undefined}
            />
            {meta?.breadcrumbs?.length > 0 && (
                <JsonLd data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    itemListElement: meta.breadcrumbs.map((b, i) => ({
                        "@type": "ListItem",
                        position: i + 1,
                        name: b.name,
                        item: `https://www.urbexon.in${b.path}`,
                    })),
                }} />
            )}
            <div className="min-h-screen bg-canvas">

                {/* ── Hero banner — light, matches the site's Signal palette
                       (the old graphite-900 block clashed with the light theme) ── */}
                <div className="bg-white border-b border-[var(--color-graphite-100)] px-[clamp(16px,5vw,80px)] pt-9 pb-7">
                    <div className="max-w-[1440px] mx-auto">
                        <p className="inline-block pl-2.5 border-l-2 border-[var(--accent-primary)] text-[10px] font-bold tracking-[.16em] uppercase text-accent mb-3 leading-none">
                            Urbexon · {categoryLabel}
                        </p>
                        <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-extrabold text-primary tracking-tight mb-2">
                            {categoryLabel}{f.subcategory ? ` › ${f.subcategory}` : ""}
                        </h1>
                        <p className="text-[13px] text-muted" aria-live="polite">
                            {f.loading ? "Loading products…" : `${f.total.toLocaleString()} products`}
                        </p>
                    </div>
                </div>

                {/* ── Toolbar ── */}
                <div className="bg-surface border-b border-default sticky top-[var(--nav-h,0px)] z-40">
                    <div className="max-w-[1440px] mx-auto px-[clamp(16px,5vw,80px)] py-3 flex items-center gap-3 flex-wrap">

                        {/* Search within category */}
                        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[180px] max-w-[340px] bg-canvas border border-default px-3 h-[38px] rounded-[var(--radius-sm)] order-1 sm:order-none focus-within:border-[var(--accent-primary)] transition-colors duration-200">
                            <FiSearch size={13} className="text-muted flex-shrink-0" aria-hidden="true" />
                            <input
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder={`Search in ${categoryLabel}…`}
                                aria-label={`Search in ${categoryLabel}`}
                                className="bg-transparent border-none outline-none text-[13px] text-primary w-full"
                            />
                            {searchInput && (
                                <button type="button" aria-label="Clear search"
                                    onClick={() => { setSearchInput(""); f.setValue("search", ""); }}
                                    className="text-muted hover:text-primary transition-colors">
                                    <FiX size={12} />
                                </button>
                            )}
                        </form>

                        {/* Mobile filters trigger */}
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className="lg:hidden flex items-center gap-2 px-4 h-[38px] border border-default bg-surface text-[12px] font-semibold text-primary rounded-[var(--radius-sm)] order-2 sm:order-none focus-ring-accent"
                        >
                            <FiFilter size={12} className="text-accent" aria-hidden="true" />
                            Filters
                            {f.hasActiveFilters && (
                                <span className="min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                                    {f.chips.length}
                                </span>
                            )}
                        </button>

                        <SortMenu sort={f.sort} onSort={f.setSort} />
                    </div>
                </div>

                {/* ── Subcategory chips — generated from live facet data ── */}
                {subcategories.length > 0 && (
                    <div className="bg-canvas border-b border-default">
                        <div className="max-w-[1440px] mx-auto px-[clamp(16px,5vw,80px)] py-2.5 flex gap-2 flex-wrap items-center">
                            <Chip selected={!f.subcategory} onClick={() => f.setValue("subcategory", "")}>All</Chip>
                            {subcategories.map(sub => (
                                <Chip
                                    key={sub.value}
                                    selected={f.subcategory.toLowerCase() === sub.value.toLowerCase()}
                                    onClick={() => f.setValue("subcategory",
                                        f.subcategory.toLowerCase() === sub.value.toLowerCase() ? "" : sub.value)}
                                >
                                    {sub.value} {sub.count > 0 && <span className="opacity-60 text-[10px]">({sub.count})</span>}
                                </Chip>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Content: sidebar + grid ── */}
                <div className="max-w-[1440px] mx-auto px-[clamp(16px,5vw,80px)] pt-8 pb-16">
                    <div className="flex gap-6 lg:gap-8 items-start">

                        {/* Desktop sidebar */}
                        <aside className="hidden lg:block w-[260px] shrink-0 sticky top-[calc(var(--nav-h,0px)+76px)]
                                          max-h-[calc(100vh-136px)] overflow-y-auto scrollbar-hide
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

                        {/* Results */}
                        <div className="flex-1 min-w-0">
                            {f.hasActiveFilters && <div className="mb-4"><FilterChips /></div>}

                            {!f.loading && f.error ? (
                                <div className="py-12 flex justify-center">
                                    <ErrorState
                                        icon={FiAlertTriangle}
                                        title={f.error}
                                        description="Check your connection and try again."
                                        action={<Button variant="primary" onClick={f.retry}>Try Again</Button>}
                                    />
                                </div>
                            ) : !f.loading && f.products.length === 0 ? (
                                <div className="py-12 flex justify-center">
                                    <EmptyState
                                        icon={FiPackage}
                                        title="No products found"
                                        description={f.hasActiveFilters
                                            ? "No products match these filters — try removing a few."
                                            : "Try different search terms or browse other categories"}
                                        action={f.hasActiveFilters && (
                                            <Button variant="primary" icon={FiX} onClick={f.clearAll}>Clear Filters</Button>
                                        )}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                                        {f.loading
                                            ? Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />)
                                            : f.products.map((p) => (
                                                <ProductCard key={p._id || p.id} product={p} hideActions />
                                            ))}
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
            </div>

            {/* Mobile bottom-sheet filters */}
            <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </>
    );
};

/* ─── Page shell ─── */
const fallbackLabel = (slug) =>
    slug?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Products";

const CategoryPage = () => {
    const { slug } = useParams();
    // Discovery metadata — display name, SEO, breadcrumbs, attribute schema.
    // Stored with its slug so stale metadata is never shown for a new slug.
    const [metaResult, setMetaResult] = useState({ slug: null, meta: null });

    useEffect(() => {
        if (!slug) return;
        const ctrl = new AbortController();
        fetchCategoryMetadata(slug, { signal: ctrl.signal })
            .then(r => setMetaResult({ slug, meta: r.data?.metadata || null }))
            .catch(() => setMetaResult({ slug, meta: null }));
        return () => ctrl.abort();
    }, [slug]);

    const meta = metaResult.slug === slug ? metaResult.meta : null;
    const categoryLabel = meta?.name || fallbackLabel(slug);

    return (
        // key={slug} remounts the provider on category change so filter
        // state never leaks between categories.
        <FilterProvider key={slug} base={{ category: normalizeCategory(slug) }}>
            <CategoryPageInner slug={slug} categoryLabel={categoryLabel} meta={meta} />
        </FilterProvider>
    );
};

export default CategoryPage;
