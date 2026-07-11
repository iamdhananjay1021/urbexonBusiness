import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getProducts } from "../api/productApi";
import { fetchCategoryBySlug, fetchCategorySubcategories } from "../api/categoryApi";
import ProductCard from "../components/ProductCard";
import { FiSearch, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { FaSortAmountDown } from "react-icons/fa";
import SEO from "../components/SEO";
import { normalizeCategory } from "../utils/normalizeCategory";
import Chip from "../design-system/Chip";
import Button from "../design-system/Button";
import { EmptyState } from "../design-system/EmptyState";
import { SkeletonCard } from "../design-system/Skeleton";

const SORT_OPTIONS = [
    { val: "newest", label: "Newest First" },
    { val: "price_asc", label: "Price: Low to High" },
    { val: "price_desc", label: "Price: High to Low" },
    { val: "rating", label: "Top Rated" },
    { val: "discount", label: "Best Discount" },
];

// Session-lifetime cache for a category's first page, keyed by filters —
// same pattern as Home.jsx's _homeCache. Without it, the page cleared
// `products` to `[]` and re-showed the skeleton on every mount (including
// revisits via Back), even when the exact same filtered list had just been
// fetched moments ago.
const CACHE_TTL = 60 * 1000;
const categoryProductsCache = new Map(); // key -> { products, total, hasMore, ts }

/* ════════════════════════════════════════
   CATEGORY PAGE
   NOTE: uses the app's real ProductCard (../components/ProductCard) —
   left untouched, owns real cart/wishlist business logic. Only page chrome
   (hero, toolbar, filters, skeleton, empty state) is migrated below.
════════════════════════════════════════ */
const CategoryPage = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const initialCacheKey = `${slug}|${searchParams.get("sort") || "newest"}|${searchParams.get("search") || ""}|${searchParams.get("subcategory") || ""}`;
    const getInitialCache = () => {
        const c = categoryProductsCache.get(initialCacheKey);
        return c && Date.now() - c.ts < CACHE_TTL ? c : null;
    };

    const [products, setProducts] = useState(() => getInitialCache()?.products || []);
    const [total, setTotal] = useState(() => getInitialCache()?.total || 0);
    const [loading, setLoading] = useState(() => !getInitialCache());
    const [, setInView] = useState(() => !!getInitialCache());
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(() => getInitialCache()?.hasMore || false);
    const [sort, setSort] = useState(searchParams.get("sort") || "newest");
    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
    const [sortOpen, setSortOpen] = useState(false);
    const [activeSubcategory, setActiveSubcategory] = useState(searchParams.get("subcategory") || "");
    const [subcategories, setSubcategories] = useState([]);

    const LIMIT = 12;
    const [categoryLabel, setCategoryLabel] = useState(
        slug?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Products"
    );

    // Fetch proper category name + subcategories from API
    useEffect(() => {
        if (!slug) return;
        setCategoryLabel(slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
        fetchCategoryBySlug(slug)
            .then(r => { if (r.data?.name) setCategoryLabel(r.data.name); })
            .catch(() => { });
        fetchCategorySubcategories(slug)
            .then(r => setSubcategories(r.data?.subcategories || []))
            .catch(() => { });
    }, [slug]);

    // Sync subcategory from URL
    useEffect(() => {
        setActiveSubcategory(searchParams.get("subcategory") || "");
    }, [searchParams]);

    /* ── Fetch ── */
    const fetchProducts = useCallback(async (pg = 1, srt = sort, srch = search) => {
        try {
            setLoading(true);

            // BUG FIX: The API expects a TitleCased category slug (e.g., "Mens-Fashion")
            // but the URL provides a lowercase one ("mens-fashion"). Normalizing it ensures a match.
            // Also, the subcategory is likely matched case-insensitively or as lowercase on the backend.
            // Sending it as lowercase is a safer bet to ensure a match.
            const normalizedCat = normalizeCategory(slug);

            const params = new URLSearchParams({
                category: normalizedCat,
                sort: srt,
                limit: LIMIT,
                page: pg,
            });
            if (activeSubcategory) params.set("subcategory", activeSubcategory.toLowerCase());
            if (srch.trim()) params.set("search", srch.trim());

            const { data } = await getProducts(`?${params}`);
            const prods = Array.isArray(data) ? data : (data?.products || []);
            const totalCount = data?.total || prods.length;
            const more = prods.length === LIMIT;

            setProducts(pg === 1 ? prods : prev => [...prev, ...prods]);
            setTotal(pg === 1 ? totalCount : prev => prev);
            setHasMore(more);

            if (pg === 1) {
                const key = `${slug}|${srt}|${srch}|${activeSubcategory}`;
                categoryProductsCache.set(key, { products: prods, total: totalCount, hasMore: more, ts: Date.now() });
            }
        } catch (e) {
            console.error("Category fetch error:", e);
        } finally {
            setLoading(false);
            setTimeout(() => setInView(true), 80);
        }
    }, [slug, sort, search, activeSubcategory]);

    // Re-fetch when slug/sort/search/subcategory changes — but if this exact
    // combo was already fetched recently, restore it instantly instead of
    // clearing the grid and refetching.
    useEffect(() => {
        const key = `${slug}|${sort}|${search}|${activeSubcategory}`;
        const cached = categoryProductsCache.get(key);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
            setPage(1);
            setProducts(cached.products);
            setTotal(cached.total);
            setHasMore(cached.hasMore);
            setLoading(false);
            setInView(true);
            return;
        }
        setPage(1);
        setProducts([]);
        setInView(false);
        fetchProducts(1, sort, search);
    }, [slug, sort, search, activeSubcategory]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSort = (val) => {
        setSort(val);
        setSortOpen(false);
        setSearchParams(p => { p.set("sort", val); return p; });
    };

    const handleSubcategory = (name) => {
        setSearchParams(p => {
            if (name) p.set("subcategory", name);
            else p.delete("subcategory");
            return p;
        });
    };

    const loadMore = () => {
        const next = page + 1;
        setPage(next);
        fetchProducts(next, sort, search);
    };

    return (
        <>
            <SEO
                title={categoryLabel || slug?.replace(/-/g, " ")}
                description={`Shop ${categoryLabel || slug?.replace(/-/g, " ")} on Urbexon. Browse ${total || ""} products with best prices and fast delivery.`}
                path={`/category/${slug}`}
            />
            <div className="min-h-screen bg-canvas">

                {/* ── Hero banner ── */}
                <div className="bg-[var(--color-graphite-900)] px-[clamp(16px,5vw,80px)] pt-12 pb-10">
                    <div className="max-w-[1440px] mx-auto">
                        <p className="text-[10px] font-bold tracking-[.18em] uppercase text-accent/70 mb-2.5">
                            Urbexon · {categoryLabel}
                        </p>
                        <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold text-white mb-2.5">
                            {categoryLabel}{activeSubcategory ? ` › ${activeSubcategory}` : ""}
                        </h1>
                        <p className="text-[13px] text-white/50">
                            {loading ? "Loading products…" : `${total || products.length} products`}
                        </p>
                    </div>
                </div>

                {/* ── Toolbar ── */}
                <div className="bg-surface border-b border-default sticky top-16 z-40">
                    <div className="max-w-[1440px] mx-auto px-[clamp(16px,5vw,80px)] py-3 flex items-center gap-3 flex-wrap">

                        {/* Search */}
                        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[180px] max-w-[340px] bg-canvas border border-default px-3 h-[38px] rounded-[var(--radius-sm)] order-1 sm:order-none">
                            <FiSearch size={13} className="text-muted flex-shrink-0" aria-hidden="true" />
                            <input
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder={`Search in ${categoryLabel}…`}
                                className="bg-transparent border-none outline-none text-[13px] text-primary w-full"
                            />
                        </form>

                        {/* Results count */}
                        <span className="text-xs text-muted whitespace-nowrap order-3 sm:order-none">
                            {!loading && `${products.length} products`}
                        </span>

                        {/* Sort */}
                        <div className="relative ml-auto order-2 sm:order-none">
                            <button
                                onClick={() => setSortOpen(o => !o)}
                                className="flex items-center gap-2 px-4 h-[38px] border border-default bg-surface text-[12px] font-semibold text-primary rounded-[var(--radius-sm)]"
                            >
                                <FaSortAmountDown size={12} aria-hidden="true" />
                                <span className="hidden sm:inline">{SORT_OPTIONS.find(s => s.val === sort)?.label || "Sort"}</span>
                                {sortOpen ? <FiChevronUp size={11} aria-hidden="true" /> : <FiChevronDown size={11} aria-hidden="true" />}
                            </button>
                            {sortOpen && (
                                <>
                                    <div onClick={() => setSortOpen(false)} className="fixed inset-0 z-[49]" aria-hidden="true" />
                                    <div className="absolute top-[calc(100%+6px)] right-[-8px] sm:right-0 bg-surface border border-default min-w-[190px] z-50 shadow-md rounded-[var(--radius-md)] py-1.5">
                                        {SORT_OPTIONS.map(opt => (
                                            <div
                                                key={opt.val}
                                                onClick={() => handleSort(opt.val)}
                                                className={`px-4 py-2.5 text-[13px] font-medium cursor-pointer transition-colors duration-100 ${sort === opt.val ? "text-accent font-bold bg-accent-tint" : "text-primary hover:bg-canvas"}`}
                                            >
                                                {sort === opt.val && "✓ "}{opt.label}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Subcategory Filter Chips ── */}
                {subcategories.length > 0 && (
                    <div className="bg-canvas border-b border-default">
                        <div className="max-w-[1440px] mx-auto px-[clamp(16px,5vw,80px)] py-2.5 flex gap-2 flex-wrap items-center">
                            <Chip selected={!activeSubcategory} onClick={() => handleSubcategory("")}>All</Chip>
                            {subcategories.map(sub => (
                                <Chip key={sub.name} selected={activeSubcategory === sub.name} onClick={() => handleSubcategory(sub.name)}>
                                    {sub.name} {sub.count > 0 && <span className="opacity-60 text-[10px]">({sub.count})</span>}
                                </Chip>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Products ── */}
                <div className="max-w-[1440px] mx-auto px-[clamp(16px,5vw,80px)] pt-8 pb-16">

                    {/* Skeleton */}
                    {loading && products.length === 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
                            {Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    )}

                    {/* Empty */}
                    {!loading && products.length === 0 && (
                        <EmptyState
                            icon={FiSearch}
                            title="No products found"
                            description="Try different search terms or browse other categories"
                            action={<Button variant="primary" onClick={() => navigate("/")}>Back to Home</Button>}
                        />
                    )}

                    {/* Grid */}
                    {products.length > 0 && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
                                {products.map((p) => (
                                    <ProductCard key={p._id || p.id} product={p} hideActions />
                                ))}
                            </div>

                            {/* Load more */}
                            {hasMore && (
                                <div className="text-center mt-12">
                                    <Button variant="outline" onClick={loadMore} loading={loading}>
                                        {loading ? "Loading…" : "Load More"}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default CategoryPage;
