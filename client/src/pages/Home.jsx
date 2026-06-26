/**
 * Home.jsx — Urbexon v3 · Full Tailwind Rewrite
 * ─ Pure Tailwind, zero custom CSS
 * ─ ONE card wrapper used everywhere (grid + hscroll)
 * ─ All business logic 100% preserved
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import api from "../api/axios";
import { fetchActiveBanners } from "../api/bannerApi";
import { fetchActiveCategories } from "../api/categoryApi";
import CategoryBrowser from "../components/CategoryBrowser";
import ProductCard from "../components/ProductCard";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import {
    FaArrowRight, FaBolt, FaChevronLeft, FaChevronRight,
    FaSearch, FaStore, FaThLarge, FaTag,
    FaShippingFast, FaLock, FaMedal, FaHeadset,
} from "react-icons/fa";

/* ─── Constants ─── */
const CACHE_TTL = 3 * 60 * 1000;
let _homeCache = null;
const PAGE_SIZE = 20;

const CARD_SIZE =
    "w-[180px] min-w-[180px] sm:w-[190px] sm:min-w-[190px] lg:w-[220px] lg:min-w-[220px]";

const ALL_SORT_OPTIONS = [
    { key: "newest", label: "New Arrivals" },
    { key: "rating", label: "Top Rated" },
    { key: "price_asc", label: "Price ↑" },
    { key: "price_desc", label: "Price ↓" },
    { key: "discount", label: "Best Deals" },
];

const WHY = [
    { Icon: FaShippingFast, label: "Fast Delivery", sub: "Free shipping above ₹499", iconBg: "bg-orange-50", iconColor: "text-orange-500" },
    { Icon: FaLock, label: "Secure Payment", sub: "100% encrypted checkout", iconBg: "bg-green-50", iconColor: "text-green-700" },
    { Icon: FaMedal, label: "Quality Products", sub: "Verified & authentic", iconBg: "bg-yellow-50", iconColor: "text-yellow-600" },
    { Icon: FaHeadset, label: "24/7 Support", sub: "Always here for you", iconBg: "bg-indigo-50", iconColor: "text-indigo-600" },
];

const SEARCH_KEY = "ux_search_history";
const getHistory = () => { try { return JSON.parse(localStorage.getItem(SEARCH_KEY)) || []; } catch { return []; } };
const saveSearch = t => {
    if (!t?.trim()) return;
    const h = getHistory().filter(x => x.toLowerCase() !== t.trim().toLowerCase());
    h.unshift(t.trim());
    localStorage.setItem(SEARCH_KEY, JSON.stringify(h.slice(0, 15)));
};



/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UNIFIED CARD WRAPPER
   — same dimensions everywhere (grid AND hscroll)
   — wraps ProductCard so sizing is controlled here, not inside ProductCard
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const CardWrap = ({ children }) => (
    <div className="flex flex-col bg-white rounded-xl border border-neutral-100 overflow-hidden
                  w-full h-full
                  transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
        {children}
    </div>
);

/* ─── SKELETON CARD ─── */
const SkCard = () => (
    <CardWrap>
        {/* image placeholder — fixed 3:4 */}
        <div className="w-full aspect-[3/4] bg-neutral-100 animate-pulse" />
        {/* body */}
        <div className="p-3 flex flex-col gap-2 flex-1">
            <div className="h-2.5 w-2/5 bg-neutral-100 rounded-full animate-pulse" />
            <div className="h-3   w-4/5 bg-neutral-100 rounded-full animate-pulse" />
            <div className="h-2.5 w-3/5 bg-neutral-100 rounded-full animate-pulse" />
            <div className="mt-auto pt-2 flex flex-col gap-2">
                <div className="h-3 w-2/5 bg-neutral-100 rounded-full animate-pulse" />
                <div className="h-8 w-full bg-neutral-100 rounded-lg  animate-pulse" />
            </div>
        </div>
    </CardWrap>
);

/* ─── FLASH TIMER ─── */
const FlashTimer = ({ endsAt }) => {
    const calc = useCallback(() => {
        const end = endsAt
            ? new Date(endsAt).getTime()
            : (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();
        const diff = Math.max(0, end - Date.now());
        return { h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) };
    }, [endsAt]);
    const [t, setT] = useState(calc);
    useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, [calc]);
    const pad = n => String(n).padStart(2, "0");
    return (
        <div className="flex items-center gap-1.5">
            {[{ v: t.h, l: "H" }, { v: t.m, l: "M" }, { v: t.s, l: "S" }].map(({ v, l }, i) => (
                <div key={l} className="contents">
                    <div className="w-11 h-11 bg-white/10 border border-white/20 rounded-xl
                          flex flex-col items-center justify-center">
                        <span className="text-base font-black text-white tabular-nums leading-none">{pad(v)}</span>
                        <span className="text-[7px] text-white/50 font-bold mt-0.5 tracking-widest">{l}</span>
                    </div>
                    {i < 2 && <span className="text-white/30 font-black text-lg leading-none">:</span>}
                </div>
            ))}
        </div>
    );
};

/* ─── SECTION HEADER ─── */
const SecHead = ({ eyebrow, title, sub, to, label = "View all", icon }) => (
    <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
        <div className="flex-1">
            {eyebrow && (
                <span className="inline-block pl-2.5 border-l-[3px] border-orange-500
                         text-[10px] font-bold tracking-widest uppercase text-orange-500
                         mb-2 leading-none">
                    {eyebrow}
                </span>
            )}
            <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight leading-tight
                     flex items-center gap-2.5 m-0">
                {icon && icon}
                {title}
            </h2>
            {sub && <p className="text-xs text-neutral-400 mt-1.5 font-normal">{sub}</p>}
        </div>
        {to && (
            <Link to={to}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-500
                   no-underline whitespace-nowrap tracking-wide
                   hover:text-orange-600 hover:translate-x-0.5 transition-all duration-150">
                {label} <FaArrowRight size={9} />
            </Link>
        )}
    </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PRODUCT GRID
   — 2 cols → 3 → 4 → 5
   — every cell is CardWrap so all cards are equal
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PGrid = ({ products = [], loading, skCount = 10 }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 animate-[fadeIn_0.3s_ease]">
        {loading
            ? Array(skCount).fill(0).map((_, i) => <SkCard key={i} />)
            : products.map(p => (
                <CardWrap key={p._id || p.id}>
                    <ProductCard product={p} hideActions />
                </CardWrap>
            ))
        }
    </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HORIZONTAL SCROLL ROW
   — fixed-width items, same CardWrap as PGrid
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HScrollRow = ({ products = [], loading, skCount = 6 }) => {
    const rowRef = useRef(null);
    const scroll = dir => rowRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
    return (
        <div className="relative group/hrow">
            {/* left arrow */}
            <button onClick={() => scroll(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10
                   w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-md
                   items-center justify-content-center
                   text-neutral-500 hover:text-neutral-900
                   transition-all duration-150
                   hidden md:flex
                   opacity-0 group-hover/hrow:opacity-100
                   -translate-x-1/2">
                <FaChevronLeft size={11} />
            </button>
            {/* right arrow */}
            <button onClick={() => scroll(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                   w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-md
                   items-center justify-content-center
                   text-neutral-500 hover:text-neutral-900
                   transition-all duration-150
                   hidden md:flex
                   opacity-0 group-hover/hrow:opacity-100
                   translate-x-1/2">
                <FaChevronRight size={11} />
            </button>

            {/* track */}
            <div
                ref={rowRef}
                className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5
               scroll-smooth [scroll-snap-type:x_mandatory]
               [&::-webkit-scrollbar]:hidden
               [-ms-overflow-style:none]
               [scrollbar-width:none]"
            >
                {loading
                    ? Array(skCount)
                        .fill(0)
                        .map((_, i) => (
                            <div
                                key={i}
                                className={`${CARD_SIZE} flex-shrink-0 [scroll-snap-align:start]`}
                            >
                                <SkCard />
                            </div>
                        ))
                    : products.map((p) => (
                        <div
                            key={p._id || p.id}
                            className={`${CARD_SIZE} flex-shrink-0 [scroll-snap-align:start]`}
                        >
                            <CardWrap>
                                <ProductCard
                                    product={p}
                                    hideActions
                                />
                            </CardWrap>
                        </div>
                    ))}
            </div>
        </div>
    );
};

/* ─── ALL PRODUCTS SECTION ─── */
const AllProductsSection = () => {
    const [sort, setSort] = useState("newest");
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isSorting, setIsSorting] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        let cancelled = false;
        products.length === 0 ? setLoading(true) : setIsSorting(true);
        setPage(1); setHasMore(true);
        api.get(`/products?sort=${sort}&productType=ecommerce&limit=${PAGE_SIZE}&page=1`)
            .then(r => { if (cancelled) return; const l = r.data?.products || []; setProducts(l); setHasMore(l.length === PAGE_SIZE); })
            .catch(() => { }).finally(() => { if (!cancelled) { setLoading(false); setIsSorting(false); } });
        return () => { cancelled = true; };
    }, [sort]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const next = page + 1;
        try {
            const r = await api.get(`/products?sort=${sort}&productType=ecommerce&limit=${PAGE_SIZE}&page=${next}`);
            const l = r.data?.products || [];
            setProducts(prev => [...prev, ...l]); setPage(next); setHasMore(l.length === PAGE_SIZE);
        } catch { } finally { setLoadingMore(false); }
    }, [sort, page, loadingMore, hasMore]);

    return (
        <section className="bg-neutral-50 border-t border-neutral-100 py-12">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
                <SecHead
                    eyebrow="Catalog"
                    title="All Products"
                    sub="Browse our complete collection"
                    to="/products"
                    label="Full catalog"
                    icon={<FaThLarge size={15} className="text-orange-500" />}
                />

                {/* Sort Pills */}
                <div className="flex gap-2 flex-wrap mb-6">
                    {ALL_SORT_OPTIONS.map(o => (
                        <button key={o.key} onClick={() => setSort(o.key)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 whitespace-nowrap
                ${sort === o.key
                                    ? "bg-neutral-900 border-neutral-900 text-white"
                                    : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50"
                                }`}>
                            {o.label}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    {isSorting && (
                        <div className="absolute inset-0 bg-neutral-50/80 backdrop-blur-sm z-10
                            flex items-center justify-center rounded-xl">
                            <div className="w-6 h-6 rounded-full border-2 border-neutral-200 border-t-neutral-900 animate-spin" />
                        </div>
                    )}
                    {loading ? <PGrid loading skCount={PAGE_SIZE} />
                        : products.length > 0 ? <PGrid products={products} />
                            : (
                                <div className="flex flex-col items-center py-20 text-center">
                                    <FaStore size={36} className="text-neutral-200 mb-3" />
                                    <p className="font-bold text-neutral-400">No products found</p>
                                </div>
                            )
                    }
                </div>

                {!loading && hasMore && (
                    <div className="flex justify-center mt-10">
                        <button onClick={loadMore} disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-8 py-3
                         border-[1.5px] border-neutral-900 rounded-lg
                         bg-white text-neutral-900 text-sm font-bold
                         hover:bg-neutral-900 hover:text-white hover:-translate-y-0.5
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200">
                            {loadingMore
                                ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" /> Loading…</>
                                : <>Load more <FaArrowRight size={11} /></>
                            }
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
};

/* ─── FLASH DEALS SECTION ─── */
const FlashDealsSection = ({ deals, loading, nearestDealEnd }) => {
    if (!loading && deals.length === 0) return null;
    return (
        <section className="bg-white border-t border-neutral-100 py-12">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
                <SecHead
                    eyebrow="Limited time"
                    title="Flash Deals"
                    sub="Stock is running out — grab yours now"
                    to="/deals"
                    label="All deals"
                />

                {/* Flash Banner */}
                <div className="relative overflow-hidden bg-neutral-900 rounded-2xl
                        p-5 flex items-center justify-between flex-wrap gap-4 mb-7
                        border border-neutral-800">
                    {/* glow */}
                    <div className="absolute -top-10 right-16 w-40 h-40 rounded-full
                          bg-orange-500/10 blur-3xl pointer-events-none" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-orange-500/15 border border-orange-500/25
                            rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                            ⚡
                        </div>
                        <div>
                            <p className="text-base font-extrabold text-white tracking-tight">Flash Sale — Live Now</p>
                            <p className="text-xs text-neutral-500 mt-0.5">Deep discounts · Limited quantities</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Ends in</span>
                        <FlashTimer endsAt={nearestDealEnd} />
                    </div>
                </div>

                <PGrid products={deals} loading={loading} skCount={8} />

                {!loading && deals.length > 0 && (
                    <div className="flex justify-center mt-8">
                        <Link to="/deals"
                            className="inline-flex items-center gap-2 px-7 py-3 rounded-lg
                         bg-neutral-900 text-white text-sm font-bold no-underline
                         hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-lg
                         transition-all duration-200">
                            <FaTag size={11} /> View all deals <FaArrowRight size={11} />
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
};

/* ══════════════════════════════════════════════
   HOME COMPONENT
══════════════════════════════════════════════ */
const Home = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get("search") || "";

    const [heroIdx, setHeroIdx] = useState(0);
    const [slides, setSlides] = useState(() => _homeCache?.slides || []);
    const [categories, setCategories] = useState(() =>
        (_homeCache?.categories || []).filter(c => c.productType !== "urbexon_hour" && c.type !== "urbexon_hour" && !c.isUrbexonHour)
    );
    const [featured, setFeatured] = useState(() => _homeCache?.featured || []);
    const [newArrivals, setNewArrivals] = useState(() => _homeCache?.newArrivals || []);
    const [deals, setDeals] = useState(() => _homeCache?.deals || []);
    const [stats, setStats] = useState(() => _homeCache?.stats || { products: 0, categories: 0 });
    const [nearestDealEnd, setNearestDealEnd] = useState(() => _homeCache?.nearestDealEnd || null);
    const [loading, setLoading] = useState(() => !_homeCache || Date.now() - (_homeCache?._ts || 0) > CACHE_TTL);
    const [nlEmail, setNlEmail] = useState("");
    const [nlStatus, setNlStatus] = useState("");
    const [forYouProducts, setForYouProducts] = useState([]);
    const [forYouTerm, setForYouTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const heroTimer = useRef(null);
    const { recentlyViewed } = useRecentlyViewed();
    const ecRecent = recentlyViewed.filter(p => p.productType !== "urbexon_hour");

    /* Fetch homepage */
    useEffect(() => {
        if (_homeCache && Date.now() - _homeCache._ts < CACHE_TTL) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [bannersRes, catsRes, homeRes] = await Promise.allSettled([
                    fetchActiveBanners(),
                    fetchActiveCategories({ params: { type: "ecommerce" } }),
                    api.get("/products/homepage"),
                ]);
                if (cancelled) return;
                const cache = { _ts: Date.now() };
                if (bannersRes.status === "fulfilled" && bannersRes.value?.data?.length) {
                    const s = bannersRes.value.data.filter(b =>
                        b.type !== "urbexon_hour" && b.category !== "urbexon_hour" && !b.isUrbexonHour && b.placement !== "urbexon_hour"
                    );
                    setSlides(s); cache.slides = s;
                }
                if (catsRes.status === "fulfilled" && catsRes.value?.data?.length) {
                    const ec = catsRes.value.data.filter(c => c.productType !== "urbexon_hour" && c.type !== "urbexon_hour" && !c.isUrbexonHour);
                    setCategories(ec); cache.categories = ec;
                }
                if (homeRes.status === "fulfilled") {
                    const d = homeRes.value.data;
                    const f = d.featured || [], na = d.newArrivals || [], dl = d.deals || [];
                    setFeatured(f); setNewArrivals(na); setDeals(dl);
                    cache.featured = f; cache.newArrivals = na; cache.deals = dl;
                    if (d.stats) { setStats(d.stats); cache.stats = d.stats; }
                    const ends = dl.map(p => p.dealEndsAt).filter(Boolean).map(x => new Date(x)).filter(x => x > new Date());
                    if (ends.length) { const nd = new Date(Math.min(...ends)).toISOString(); setNearestDealEnd(nd); cache.nearestDealEnd = nd; }
                }
                _homeCache = cache;
            } finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, []);

    /* For You */
    useEffect(() => {
        const h = getHistory(); if (!h.length) return;
        const term = h[0]; setForYouTerm(term);
        api.get(`/products?search=${encodeURIComponent(term)}&productType=ecommerce&limit=8`)
            .then(r => setForYouProducts(r.data?.products || [])).catch(() => { });
    }, []);

    /* Hero autoplay */
    const resetTimer = useCallback(() => {
        clearInterval(heroTimer.current);
        if (slides.length > 1) heroTimer.current = setInterval(() => setHeroIdx(i => (i + 1) % slides.length), 5000);
    }, [slides.length]);
    useEffect(() => { resetTimer(); return () => clearInterval(heroTimer.current); }, [resetTimer]);
    const goHero = useCallback(dir => {
        setHeroIdx(i => (i + dir + slides.length) % slides.length); resetTimer();
    }, [slides.length, resetTimer]);

    /* Search */
    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        window.scrollTo({ top: 0, behavior: "smooth" });
        saveSearch(searchQuery.trim());
        const ctrl = new AbortController();
        setSearching(true);
        api.get(`/products?search=${encodeURIComponent(searchQuery)}&productType=ecommerce&limit=24`, { signal: ctrl.signal })
            .then(r => setSearchResults(r.data?.products || [])).catch(() => { }).finally(() => setSearching(false));
        return () => ctrl.abort();
    }, [searchQuery]);

    /* Newsletter */
    const handleNL = async e => {
        e.preventDefault(); if (!nlEmail.trim()) return;
        setNlStatus("sending");
        try { await api.post("/contact/newsletter", { email: nlEmail.trim() }); setNlEmail(""); setNlStatus("done"); }
        catch { setNlStatus("error"); }
    };

    /* Shared container class */
    const C = "max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16";

    /* ── SEARCH VIEW ── */
    if (searchQuery.trim()) return (
        <div className="bg-neutral-50 min-h-screen">
            <div className={`${C} pt-10 pb-20`}>
                <span className="inline-block pl-2.5 border-l-[3px] border-orange-500
                         text-[10px] font-bold tracking-widest uppercase text-orange-500 mb-2 leading-none">
                    Search
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-1.5">
                    Results for <em className="not-italic text-orange-500">"{searchQuery}"</em>
                </h1>
                <p className="text-xs text-neutral-400 mt-2 mb-8">
                    {searching ? "Searching…" : `${searchResults.length} product${searchResults.length !== 1 ? "s" : ""} found`}
                </p>
                {searching ? <PGrid loading skCount={12} />
                    : searchResults.length > 0 ? <PGrid products={searchResults} />
                        : (
                            <div className="flex flex-col items-center py-24 text-center">
                                <FaSearch size={44} className="text-neutral-200 mb-4" />
                                <p className="font-bold text-neutral-400 text-base">No products match "{searchQuery}"</p>
                                <p className="text-xs text-neutral-400 mt-2">Try a broader term or browse categories</p>
                            </div>
                        )
                }
            </div>
        </div>
    );

    /* ── MAIN RENDER ── */
    return (
        <div className="bg-neutral-50 overflow-x-hidden w-full">
            <SEO title="Premium Online Shopping — Urbexon"
                description="Discover premium products from verified sellers with fast delivery and secure checkout."
                path="/" />

            ━━ HERO ━━
            {loading && slides.length === 0 ? (
                <div className="w-full bg-neutral-900 h-[300px] sm:h-[400px] md:h-[500px] lg:h-[580px]
                        flex flex-col justify-center gap-4 px-6 sm:px-12 animate-pulse">
                    <div className="h-5 w-24 bg-white/10 rounded-full" />
                    <div className="h-10 sm:h-14 w-3/4 sm:w-1/2 bg-white/10 rounded-xl" />
                    <div className="h-4 sm:h-5 w-1/2 sm:w-1/3 bg-white/10 rounded-lg" />
                    <div className="h-11 w-32 bg-white/10 rounded-xl mt-2" />
                </div>
            ) : slides.length > 0 ? (
                <div className="relative w-full bg-neutral-900 overflow-hidden
                        h-[300px] sm:h-[400px] md:h-[500px] lg:h-[580px] xl:h-[640px] group">
                    {slides.map((slide, i) => {
                        const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";
                        return (
                            <div key={slide._id}
                                className={`absolute inset-0 flex items-center transition-opacity duration-700
                            ${i === heroIdx ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
                                <div className="absolute inset-0">
                                    <img src={bg} alt={slide.title || "Banner"} loading={i === 0 ? "eager" : "lazy"}
                                        className="w-full h-full object-cover object-center" />
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/55 to-black/10" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent sm:hidden" />
                                </div>

                                <div className={`${C} relative z-10 w-full h-full flex items-center py-10`}>
                                    <div className="max-w-[540px] flex flex-col items-start">
                                        {slide.tag && (
                                            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                                      bg-white/10 border border-white/20 backdrop-blur-md
                                      text-[10px] font-bold text-white tracking-widest uppercase mb-4">
                                                🔥 {slide.tag}
                                            </div>
                                        )}
                                        <h1 className="text-[clamp(26px,4.5vw,56px)] font-black text-white leading-[1.1]
                                   tracking-[-0.03em] m-0 mb-3">
                                            {slide.title}
                                            {slide.highlight && (
                                                <em className="text-yellow-300 block not-italic mt-1">{slide.highlight}</em>
                                            )}
                                        </h1>
                                        {(slide.subtitle || slide.desc || slide.description) && (
                                            <p className="text-[clamp(13px,1.4vw,16px)] text-white/80 leading-relaxed mb-7 max-w-[440px]">
                                                {slide.subtitle || slide.desc || slide.description}
                                            </p>
                                        )}
                                        <div className="flex gap-3 flex-wrap">
                                            <button
                                                onClick={() => {
                                                    const t = slide.link || slide.ctaLink || "/";
                                                    t.startsWith("http") ? window.open(t, "_blank", "noopener") : navigate(t);
                                                }}
                                                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                                   bg-white text-neutral-900 text-sm font-black border-none cursor-pointer
                                   shadow-lg hover:bg-neutral-100 active:scale-95 transition-all duration-150">
                                                {slide.buttonText || slide.cta || "Shop Now"} <FaArrowRight size={11} />
                                            </button>
                                            {slide.secondary && (
                                                <button onClick={() => navigate(slide.secondaryLink || "/deals")}
                                                    className="inline-flex items-center px-5 py-3 rounded-lg
                                     bg-white/10 border border-white/20 text-white text-sm font-semibold
                                     backdrop-blur-md cursor-pointer hover:bg-white/20 active:scale-95 transition-all">
                                                    {slide.secondary}
                                                </button>
                                            )}
                                        </div>

                                        {/* Stats — desktop */}
                                        <div className="hidden md:flex gap-2.5 mt-10">
                                            {[
                                                { v: "Free", l: "Delivery ₹499+" },
                                                { v: stats.products ? `${stats.products.toLocaleString()}+` : "—", l: "Products" },
                                                { v: stats.categories || "—", l: "Categories" },
                                            ].map(({ v, l }) => (
                                                <div key={l} className="px-4 py-3 bg-white/8 border border-white/12
                                                rounded-xl backdrop-blur-md">
                                                    <div className="text-lg font-black text-white leading-none mb-1">{v}</div>
                                                    <div className="text-[9px] text-white/50 font-bold uppercase tracking-widest">{l}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {slides.length > 1 && (
                        <>
                            <button onClick={() => goHero(-1)}
                                className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20
                           w-9 h-9 rounded-full bg-black/25 border border-white/20 backdrop-blur-md
                           flex items-center justify-center text-white cursor-pointer
                           transition-all duration-150 hover:bg-black/45
                           opacity-100 sm:opacity-0 group-hover:opacity-100">
                                <FaChevronLeft size={13} />
                            </button>
                            <button onClick={() => goHero(1)}
                                className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20
                           w-9 h-9 rounded-full bg-black/25 border border-white/20 backdrop-blur-md
                           flex items-center justify-center text-white cursor-pointer
                           transition-all duration-150 hover:bg-black/45
                           opacity-100 sm:opacity-0 group-hover:opacity-100">
                                <FaChevronRight size={13} />
                            </button>
                            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20
                              flex gap-1.5 bg-black/20 backdrop-blur-sm border border-white/10
                              px-3 py-2 rounded-full">
                                {slides.map((_, i) => (
                                    <button key={i} onClick={() => { setHeroIdx(i); resetTimer(); }}
                                        aria-label={`Slide ${i + 1}`}
                                        className={`h-1.5 rounded-full border-none cursor-pointer p-0 transition-all duration-300
                                ${i === heroIdx ? "w-6 bg-white" : "w-1.5 bg-white/35 hover:bg-white/55"}`} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : !loading && (
                <div className="w-full bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center min-h-[300px] sm:min-h-[420px]">
                    <div className={`${C} py-14`}>
                        <div className="max-w-[540px]">
                            <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4">
                                Welcome to <em className="text-yellow-300 not-italic">Urbexon</em>
                            </h1>
                            <p className="text-sm sm:text-base text-white/70 mb-8 leading-relaxed max-w-[460px]">
                                Premium products · Fast delivery · Secure checkout.
                            </p>
                            <button onClick={() => navigate("/deals")}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900
                           rounded-xl text-sm font-bold cursor-pointer
                           hover:bg-neutral-100 hover:-translate-y-0.5 transition-all shadow-lg">
                                Explore deals <FaArrowRight size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ URBEXON HOUR STRIP ━━ */}
            <div onClick={() => navigate("/urbexon-hour")}
                className="bg-[#0D0D0D] cursor-pointer w-full border-b border-[#1c1c1c]
                   relative overflow-hidden hover:brightness-105 transition-all duration-200">
                {/* animated top line */}
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{
                        background: "linear-gradient(90deg,#a855f7,#ec4899,#f97316,#eab308,#a855f7)",
                        backgroundSize: "300% 100%",
                        animation: "gradientShift 3s linear infinite",
                    }} />
                {/* glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-72 h-20 bg-purple-500/8 blur-3xl rounded-full pointer-events-none" />
                <div className={C}>
                    <div className="flex items-center gap-3.5 py-3.5">
                        <div className="w-11 h-11 rounded-[13px] flex-shrink-0 flex items-center justify-center"
                            style={{
                                background: "linear-gradient(135deg,#a855f7,#ec4899)",
                                boxShadow: "0 0 14px rgba(168,85,247,0.4)",
                            }}>
                            <FaBolt size={16} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[15px] font-black text-white tracking-tight">
                                    Urbexon{" "}
                                    <span style={{
                                        background: "linear-gradient(90deg,#a855f7,#ec4899)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                        backgroundClip: "text",
                                    }}>Hour</span>
                                </span>
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase
                                 bg-purple-500/15 border border-purple-500/30 text-purple-300">
                                    LIVE
                                </span>
                            </div>
                            <p className="text-xs text-white/40 mt-0.5">
                                Groceries & essentials in{" "}
                                <strong className="text-green-400">45 min</strong>{" "}· Quick commerce
                            </p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest
                               text-white/40 px-3 py-1.5 rounded-full
                               bg-white/5 border border-white/10">
                                ⚡ Fast delivery
                            </span>
                            <FaArrowRight size={12} className="text-white/25" />
                        </div>
                    </div>
                </div>
                <style>{`@keyframes gradientShift{0%{background-position:0% 50%}100%{background-position:300% 50%}}`}</style>
            </div>

            {/* ━━ CATEGORIES ━━ */}
            {(loading || categories.length > 0) && (
                <div className="bg-white border-b border-neutral-100">
                    <div className={C}>
                        <CategoryBrowser categories={categories} />
                    </div>
                </div>
            )}

            {/* ━━ FLASH DEALS ━━ */}
            <FlashDealsSection deals={deals} loading={loading} nearestDealEnd={nearestDealEnd} />

            {/* ━━ TRENDING ━━ */}
            {(loading || featured.length > 0) && (
                <section className="bg-white border-t border-neutral-100 py-12">
                    <div className={C}>
                        <SecHead eyebrow="Popular" title="Trending Now" sub="Most-loved products this week"
                            to="/products?sort=rating" label="See all" />
                        <PGrid products={featured} loading={loading} skCount={8} />
                    </div>
                </section>
            )}

            {/* ━━ ALL PRODUCTS ━━ */}
            <AllProductsSection />

            {/* ━━ NEW ARRIVALS ━━ */}
            {(loading || newArrivals.length > 0) && (
                <section className="bg-neutral-50 border-t border-neutral-100 py-12">
                    <div className={C}>
                        <SecHead
                            eyebrow="Just in"
                            title="New Arrivals"
                            sub="Fresh drops and latest collections"
                            to="/products?sort=newest"
                            label="See all"
                        />

                        <HScrollRow
                            products={newArrivals}
                            loading={loading}
                            skCount={6}
                        />
                    </div>
                </section>
            )}

            {/* ━━ RECENTLY VIEWED ━━ */}
            {ecRecent.length > 0 && (
                <section className="bg-white border-t border-neutral-100 py-12">
                    <div className={C}>
                        <SecHead
                            eyebrow="Your history"
                            title="Recently Viewed"
                            sub="Continue where you left off"
                        />

                        <HScrollRow
                            products={ecRecent.slice(0, 12)}
                            loading={false}
                        />
                    </div>
                </section>
            )}

            {/* ━━ FOR YOU ━━ */}
            {forYouProducts.length > 0 && (
                <section className="bg-neutral-50 border-t border-neutral-100 py-12">
                    <div className={C}>
                        <SecHead
                            eyebrow="Picked for you"
                            title={`Similar to "${forYouTerm}"`}
                            sub="Based on your recent searches"
                            to={`/?search=${encodeURIComponent(forYouTerm)}`}
                            label="See all"
                        />

                        <HScrollRow
                            products={forYouProducts}
                            loading={false}
                        />
                    </div>
                </section>
            )}

            {/* ━━ WHY URBEXON ━━ */}
            <section className="bg-white border-t border-neutral-100 py-12">
                <div className={C}>
                    <div className="text-center mb-9">
                        <span className="inline-block px-0 pb-1.5 border-b-2 border-orange-500
                             text-[10px] font-bold tracking-widest uppercase text-orange-500">
                            Our promise
                        </span>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-3">
                            Why Choose Urbexon?
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1.5">Your trusted partner for premium shopping</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {WHY.map(({ Icon, label, sub, iconBg, iconColor }) => (
                            <div key={label}
                                className="bg-white border border-neutral-100 rounded-2xl p-6 text-center
                           hover:-translate-y-1.5 hover:shadow-xl hover:border-transparent
                           transition-all duration-200 cursor-default">
                                <div className={`w-12 h-12 ${iconBg} rounded-[14px] flex items-center justify-center mx-auto mb-3.5`}>
                                    <Icon size={20} className={iconColor} />
                                </div>
                                <p className="text-sm font-bold text-neutral-900 mb-1.5 tracking-tight">{label}</p>
                                <p className="text-xs text-neutral-400 leading-relaxed">{sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ━━ NEWSLETTER ━━ */}
            <section className="bg-neutral-900 border-t border-neutral-800 pt-16 pb-24 sm:pb-16">
                <div className={C}>
                    <div className="max-w-[460px] mx-auto text-center">
                        <span className="inline-block pl-2.5 border-l-[3px] border-white/30
                             text-[10px] font-bold tracking-widest uppercase text-white/50 mb-3 leading-none">
                            Newsletter
                        </span>
                        <h3 className="text-[clamp(26px,4vw,34px)] font-black text-white tracking-tight mb-3">
                            Stay in the Loop
                        </h3>
                        <p className="text-sm text-white/50 leading-relaxed mb-8">
                            Exclusive deals, new arrivals, and special offers — straight to your inbox.
                        </p>
                        {nlStatus === "done" ? (
                            <div className="p-4 bg-green-500/10 border border-green-500 rounded-xl
                              text-green-400 font-bold text-sm">
                                ✅ You're subscribed! Check your inbox.
                            </div>
                        ) : (
                            <form onSubmit={handleNL}
                                className="flex rounded-xl overflow-hidden border border-white/10 bg-white/4">
                                <input type="email" value={nlEmail} required
                                    onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                    placeholder="your@email.com"
                                    className="flex-1 min-w-0 px-4 py-3.5 bg-transparent border-none outline-none
                             text-sm text-white placeholder:text-white/30" />
                                <button type="submit" disabled={nlStatus === "sending"}
                                    className="px-5 py-3.5 bg-orange-500 hover:bg-orange-600 text-white
                             text-sm font-bold border-none cursor-pointer whitespace-nowrap
                             disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                                    {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                                </button>
                            </form>
                        )}
                        {nlStatus === "error" && (
                            <p className="text-red-400 text-xs mt-2.5">Something went wrong. Please try again.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;