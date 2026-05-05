/**
 * Home.jsx — Urbexon Professional Redesign
 * All business logic preserved · UI completely redesigned
 * Clean, modern Indian e-commerce aesthetic
 *
 * FIXES:
 * 1. Banner responsive — aspect-ratio based, no crop on mobile/desktop
 * 2. Urbexon Hour slides filtered out from hero banners
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

/* ── Constants ── */
const CACHE_TTL = 3 * 60 * 1000;
let _homeCache = null;
const PAGE_SIZE = 20;

const ALL_SORT_OPTIONS = [
    { key: "newest", label: "New Arrivals" },
    { key: "rating", label: "Top Rated" },
    { key: "price_asc", label: "Price ↑" },
    { key: "price_desc", label: "Price ↓" },
    { key: "discount", label: "Best Deals" },
];

const WHY = [
    { Icon: FaShippingFast, label: "Fast Delivery", sub: "Free shipping above ₹499", color: "text-blue-600", bg: "bg-blue-50" },
    { Icon: FaLock, label: "Secure Payment", sub: "100% encrypted", color: "text-green-600", bg: "bg-green-50" },
    { Icon: FaMedal, label: "Quality Products", sub: "Verified & authentic", color: "text-amber-600", bg: "bg-amber-50" },
    { Icon: FaHeadset, label: "24/7 Support", sub: "Always here for you", color: "text-purple-600", bg: "bg-purple-50" },
];

const SEARCH_KEY = "ux_search_history";
const getHistory = () => { try { return JSON.parse(localStorage.getItem(SEARCH_KEY)) || []; } catch { return []; } };
const saveSearch = t => {
    if (!t?.trim()) return;
    const h = getHistory().filter(x => x.toLowerCase() !== t.trim().toLowerCase());
    h.unshift(t.trim());
    localStorage.setItem(SEARCH_KEY, JSON.stringify(h.slice(0, 15)));
};

/* ── SKELETON ── */
const SkCard = () => (
    <div className="bg-white rounded-xl overflow-hidden border border-stone-200 flex flex-col w-full h-full">
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

/* ── FLASH TIMER ── */
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
                    <div className="bg-black/30 border border-white/20 rounded-lg w-10 h-10 flex flex-col items-center justify-center">
                        <span className="text-[15px] font-black text-white tabular-nums leading-none">{pad(v)}</span>
                        <span className="text-[7px] text-white/60 font-bold mt-0.5">{l}</span>
                    </div>
                    {i < 2 && <span className="text-white/50 font-black text-lg">:</span>}
                </div>
            ))}
        </div>
    );
};

/* ── SECTION HEADER ── */
const SecHead = ({ title, sub, to, label = "View All", accent }) => (
    <div className="flex items-end justify-between mb-5 gap-3">
        <div>
            <h2 className="text-[18px] sm:text-[21px] font-extrabold text-gray-900 leading-tight">
                {title}
            </h2>
            {sub && <p className="text-[12px] text-gray-500 mt-0.5">{sub}</p>}
        </div>
        {to && (
            <Link to={to}
                className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-[#2874f0]
                    hover:text-blue-800 transition-colors whitespace-nowrap pb-1">
                {label} <FaArrowRight size={9} />
            </Link>
        )}
    </div>
);

/* ── HORIZONTAL SCROLL ROW ── */
const HScrollRow = ({ products = [], loading, skCount = 6 }) => {
    const rowRef = useRef(null);
    const scroll = dir => rowRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });

    return (
        <div className="relative group/row">
            <button onClick={() => scroll(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full
                    bg-white border border-gray-200 shadow-lg hidden md:flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 transition-all -translate-x-4
                    opacity-0 group-hover/row:opacity-100">
                <FaChevronLeft size={11} />
            </button>
            <button onClick={() => scroll(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full
                    bg-white border border-gray-200 shadow-lg hidden md:flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 transition-all translate-x-4
                    opacity-0 group-hover/row:opacity-100">
                <FaChevronRight size={11} />
            </button>

            <div ref={rowRef}
                className="flex gap-3 overflow-x-auto pb-3 pt-1
                    snap-x snap-mandatory scroll-smooth
                    [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {loading
                    ? Array(skCount).fill(0).map((_, i) => (
                        <div key={i} className="w-[150px] sm:w-[175px] lg:w-[195px] shrink-0 snap-start">
                            <SkCard />
                        </div>
                    ))
                    : products.map(p => (
                        <div key={p._id || p.id} className="w-[150px] sm:w-[175px] lg:w-[195px] shrink-0 snap-start">
                            <ProductCard product={p} hideActions />
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

/* ── PRODUCT GRID ── */
const PGrid = ({ products = [], loading, skCount = 10, showActions = false }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5">
        {loading
            ? Array(skCount).fill(0).map((_, i) => <SkCard key={i} />)
            : products.map(p => <ProductCard key={p._id || p.id} product={p} hideActions={!showActions} />)
        }
    </div>
);

/* ── ALL PRODUCTS SECTION ── */
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
            .then(r => {
                if (cancelled) return;
                const list = r.data?.products || [];
                setProducts(list); setHasMore(list.length === PAGE_SIZE);
            }).catch(() => { }).finally(() => { if (!cancelled) { setLoading(false); setIsSorting(false); } });
        return () => { cancelled = true; };
    }, [sort]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const next = page + 1;
        try {
            const r = await api.get(`/products?sort=${sort}&productType=ecommerce&limit=${PAGE_SIZE}&page=${next}`);
            const list = r.data?.products || [];
            setProducts(prev => [...prev, ...list]); setPage(next); setHasMore(list.length === PAGE_SIZE);
        } catch { } finally { setLoadingMore(false); }
    }, [sort, page, loadingMore, hasMore]);

    return (
        <div className="bg-white border-t border-gray-100">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-12">
                {/* Header */}
                <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
                    <div>
                        <h2 className="text-[18px] sm:text-[21px] font-extrabold text-gray-900 flex items-center gap-2">
                            <FaThLarge size={16} className="text-[#2874f0]" /> All Products
                        </h2>
                        <p className="text-[12px] text-gray-500 mt-0.5">Browse our complete catalog</p>
                    </div>
                    <Link to="/products"
                        className="text-[11px] font-bold text-[#2874f0] flex items-center gap-1.5
                            hover:text-blue-800 transition-colors">
                        Full Catalog <FaArrowRight size={9} />
                    </Link>
                </div>

                {/* Sort pills */}
                <div className="flex gap-2 flex-wrap mb-6 overflow-x-auto pb-1 [scrollbar-width:none]">
                    {ALL_SORT_OPTIONS.map(o => (
                        <button key={o.key} onClick={() => setSort(o.key)}
                            className={`px-4 py-1.5 rounded-full text-[11px] font-bold border
                                transition-all whitespace-nowrap shrink-0
                                ${sort === o.key
                                    ? "bg-[#2874f0] text-white border-[#2874f0] shadow-sm"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-[#2874f0] hover:text-[#2874f0]"
                                }`}>
                            {o.label}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div className="relative">
                    {isSorting && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                            <span className="w-8 h-8 border-4 border-gray-200 border-t-[#2874f0] rounded-full animate-spin" />
                        </div>
                    )}
                    {loading ? (
                        <PGrid loading skCount={PAGE_SIZE} />
                    ) : products.length > 0 ? (
                        <PGrid products={products} />
                    ) : (
                        <div className="flex flex-col items-center py-16 text-gray-400">
                            <FaStore size={40} className="mb-3 text-gray-200" />
                            <div className="font-bold text-gray-500">No products found</div>
                        </div>
                    )}
                </div>

                {!loading && hasMore && (
                    <button onClick={loadMore} disabled={loadingMore}
                        className="flex items-center justify-center gap-2 w-full max-w-[260px] mx-auto mt-8
                            px-7 py-3 rounded-xl border-2 border-gray-900 text-gray-900
                            text-[13px] font-bold transition-all hover:bg-gray-900 hover:text-white
                            disabled:opacity-50">
                        {loadingMore
                            ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Loading…</>
                            : <><FaArrowRight size={11} /> Load More</>
                        }
                    </button>
                )}
            </div>
        </div>
    );
};

/* ── FLASH DEALS SECTION ── */
const FlashDealsSection = ({ deals, loading, nearestDealEnd }) => {
    if (!loading && deals.length === 0) return null;
    return (
        <div className="bg-gray-50 border-t border-gray-100">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-12">
                <SecHead
                    title="Lightning Deals"
                    sub="Limited-time offers — grab before they expire"
                    to="/deals" label="All Deals"
                />

                {/* Flash banner */}
                <div className="relative overflow-hidden bg-gradient-to-r from-[#ff6161] to-[#ff9f43]
                    rounded-2xl px-5 py-5 flex items-center justify-between gap-4 flex-wrap
                    shadow-lg mb-6">
                    <div className="flex items-center gap-4 z-10">
                        <div className="w-12 h-12 bg-white/20 border-2 border-white/30 rounded-xl
                            flex items-center justify-center text-2xl shrink-0">⚡</div>
                        <div>
                            <div className="text-[18px] font-black text-white">Flash Sale Live!</div>
                            <div className="text-[12px] text-white/80 mt-0.5">Massive discounts · Limited stock</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 z-10">
                        <span className="text-[10px] font-bold text-white/70 tracking-widest uppercase">Ends in</span>
                        <FlashTimer endsAt={nearestDealEnd} />
                    </div>
                </div>

                <PGrid products={deals} loading={loading} skCount={8} />

                {!loading && deals.length > 0 && (
                    <div className="text-center mt-7">
                        <Link to="/deals"
                            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl
                                bg-gradient-to-r from-[#ff6161] to-[#ff9f43] text-white
                                font-bold text-[13px] shadow-lg hover:-translate-y-0.5 transition-all">
                            <FaTag size={11} /> View All Deals <FaArrowRight size={10} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════
   HOME
══════════════════════════════════════════════════ */
const Home = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get("search") || "";

    const [heroIdx, setHeroIdx] = useState(0);
    const [slides, setSlides] = useState(() => _homeCache?.slides || []);
    const [categories, setCategories] = useState(() =>
        (_homeCache?.categories || []).filter(c =>
            c.productType !== "urbexon_hour" && c.type !== "urbexon_hour" && !c.isUrbexonHour
        )
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

    /* ── Fetch homepage ── */
    useEffect(() => {
        if (_homeCache && Date.now() - _homeCache._ts < CACHE_TTL) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [bannersRes, catsRes, homeRes] = await Promise.allSettled([
                    fetchActiveBanners(),
                    fetchActiveCategories({ type: "ecommerce" }),
                    api.get("/products/homepage"),
                ]);
                if (cancelled) return;
                const cache = { _ts: Date.now() };
                if (bannersRes.status === "fulfilled" && bannersRes.value?.data?.length) {
                    // FIX: Urbexon Hour banners ko hero se filter out karo
                    const s = bannersRes.value.data.filter(b =>
                        b.type !== "urbexon_hour" &&
                        b.category !== "urbexon_hour" &&
                        !b.isUrbexonHour &&
                        b.placement !== "urbexon_hour"
                    );
                    setSlides(s); cache.slides = s;
                }
                if (catsRes.status === "fulfilled" && catsRes.value?.data?.length) {
                    const ec = catsRes.value.data.filter(c =>
                        c.productType !== "urbexon_hour" && c.type !== "urbexon_hour" && !c.isUrbexonHour
                    );
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

    /* ── For You ── */
    useEffect(() => {
        const h = getHistory();
        if (!h.length) return;
        const term = h[0]; setForYouTerm(term);
        api.get(`/products?search=${encodeURIComponent(term)}&productType=ecommerce&limit=8`)
            .then(r => setForYouProducts(r.data?.products || []))
            .catch(() => { });
    }, []);

    /* ── Hero autoplay ── */
    const resetTimer = useCallback(() => {
        clearInterval(heroTimer.current);
        if (slides.length > 1) heroTimer.current = setInterval(() => setHeroIdx(i => (i + 1) % slides.length), 5000);
    }, [slides.length]);
    useEffect(() => { resetTimer(); return () => clearInterval(heroTimer.current); }, [resetTimer]);
    const goHero = useCallback(dir => {
        setHeroIdx(i => (i + dir + slides.length) % slides.length); resetTimer();
    }, [slides.length, resetTimer]);

    /* ── Search ── */
    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        window.scrollTo({ top: 0, behavior: "smooth" });
        saveSearch(searchQuery.trim());
        const ctrl = new AbortController();
        setSearching(true);
        api.get(`/products?search=${encodeURIComponent(searchQuery)}&productType=ecommerce&limit=24`, { signal: ctrl.signal })
            .then(r => setSearchResults(r.data?.products || []))
            .catch(() => { })
            .finally(() => setSearching(false));
        return () => ctrl.abort();
    }, [searchQuery]);

    /* ── Newsletter ── */
    const handleNL = async e => {
        e.preventDefault();
        if (!nlEmail.trim()) return;
        setNlStatus("sending");
        try { await api.post("/contact/newsletter", { email: nlEmail.trim() }); setNlEmail(""); setNlStatus("done"); }
        catch { setNlStatus("error"); }
    };

    /* ══ SEARCH VIEW ══ */
    if (searchQuery.trim()) return (
        <div className="bg-gray-50 min-h-screen">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 pt-6 pb-24 sm:pb-12">
                <div className="mb-6">
                    <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">
                        Results for &ldquo;{searchQuery}&rdquo;
                    </h1>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                        {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`}
                    </p>
                </div>
                {searching
                    ? <PGrid loading skCount={8} />
                    : searchResults.length > 0
                        ? <PGrid products={searchResults} />
                        : (
                            <div className="flex flex-col items-center py-20 text-gray-400">
                                <FaSearch size={36} className="mb-3 text-gray-200" />
                                <div className="font-bold text-gray-500">No products found</div>
                                <div className="text-sm mt-1">Try a different search term</div>
                            </div>
                        )
                }
            </div>
        </div>
    );

    /* ══ MAIN VIEW ══ */
    return (
        <div className="bg-gray-50 overflow-x-hidden w-full">
            <SEO title="Premium Online Shopping" description="Shop at Urbexon for the best deals." path="/" />

            {/* ━━ HERO ━━ */}
            {loading && slides.length === 0 ? (
                <div className="bg-[#1a1a2e] min-h-[220px] sm:min-h-[340px]">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-16 pb-12 space-y-4">
                        {["w-32", "w-3/4", "w-1/2", "w-1/3"].map((w, i) => (
                            <div key={i} className={`h-5 rounded-lg bg-white/10 animate-pulse ${w}`} />
                        ))}
                    </div>
                </div>
            ) : slides.length > 0 ? (
                /*
                 * ━━ BANNER RESPONSIVE FIX ━━
                 *
                 * Problem: Fixed height (h-[520px]) pe banner image cut hoti thi
                 * kyunki 1900×600px image ko fixed height container me fit karna
                 * mushkil hai — mobile pe aur bhi zyada crop hoti thi.
                 *
                 * Solution: aspect-ratio based container use karo.
                 * - Desktop (≥1024px): 19:6 ratio → original banner dimensions match
                 * - Tablet (641–1023px): 16:7 ratio → thoda taller, banner visible
                 * - Mobile (<640px): 4:3 ratio → portrait-friendly, no awkward crop
                 *
                 * object-fit: cover + object-position: center center ensure karta hai
                 * ki image hamesha centered rahe aur sides pe crop ho (top/bottom nahi).
                 * Text overlay absolute positioned hai isliye ratio change se affect nahi hoga.
                 */
                <div className="relative w-full bg-gray-900
                    [aspect-ratio:4/3]
                    sm:[aspect-ratio:16/7]
                    lg:[aspect-ratio:19/6]
                    overflow-hidden">
                    {slides.map((slide, i) => {
                        const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";
                        return (
                            <div key={slide._id}
                                className={`absolute inset-0 w-full h-full transition-opacity duration-700
                                    ${i === heroIdx ? "opacity-100 z-10" : "opacity-0 z-0"} flex items-center`}>
                                {/*
                                 * object-cover: image fill karo container ko
                                 * object-center: horizontally + vertically center rakho
                                 * Agar tumhara banner landscape hai (1900×600) toh mobile pe
                                 * sides crop hongi — yeh expected hai aur center focus maintain hoga.
                                 * Agar tum chahte ho zero crop toh object-contain use karo
                                 * lekin phir sides pe black/gray bars aayenge.
                                 */}
                                <img
                                    className="absolute inset-0 w-full h-full object-cover object-center"
                                    src={bg}
                                    alt={slide.title || "Banner"}
                                    loading={i === 0 ? "eager" : "lazy"}
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
                                <div className="max-w-[1280px] mx-auto px-5 lg:px-12 relative z-10 w-full py-8 sm:py-12 lg:py-16">
                                    <div className="max-w-[520px]">
                                        {slide.tag && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                                bg-[#2874f0]/80 border border-blue-400/30 text-[10px] font-bold
                                                text-white tracking-widest uppercase mb-3 sm:mb-4 backdrop-blur-sm">
                                                🔥 {slide.tag}
                                            </span>
                                        )}
                                        <h1 className="text-[clamp(18px,4.5vw,52px)] font-black leading-tight
                                            text-white mb-3 sm:mb-4 tracking-tight">
                                            {slide.title}
                                            {slide.highlight && (
                                                <em className="text-yellow-400 not-italic block">{slide.highlight}</em>
                                            )}
                                        </h1>
                                        {(slide.subtitle || slide.desc || slide.description) && (
                                            <p className="text-[13px] sm:text-[14px] text-white/80 leading-relaxed mb-5 sm:mb-7 max-w-[440px]
                                                hidden sm:block">
                                                {slide.subtitle || slide.desc || slide.description}
                                            </p>
                                        )}
                                        <div className="flex gap-3 flex-wrap">
                                            <button
                                                onClick={() => {
                                                    const t = slide.link || slide.ctaLink || "/";
                                                    t.startsWith("http") ? window.open(t, "_blank", "noopener") : navigate(t);
                                                }}
                                                className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-[#2874f0] text-white
                                                    text-[12px] sm:text-[13px] font-bold flex items-center gap-2 shadow-xl
                                                    hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
                                                {slide.buttonText || slide.cta || "Shop Now"} <FaArrowRight size={11} />
                                            </button>
                                            {slide.secondary && (
                                                <button onClick={() => navigate(slide.secondaryLink || "/deals")}
                                                    className="px-5 sm:px-6 py-2.5 sm:py-3 border-2 border-white/40 bg-white/10
                                                        text-white text-[12px] sm:text-[13px] font-semibold rounded-xl
                                                        hover:bg-white/20 transition-all backdrop-blur-sm">
                                                    {slide.secondary}
                                                </button>
                                            )}
                                        </div>
                                        {/* Stats — desktop only to avoid clutter on mobile */}
                                        <div className="hidden sm:flex gap-3 mt-7 flex-wrap">
                                            {[
                                                { v: "Free", l: "Delivery ₹499+" },
                                                { v: stats.products ? `${stats.products.toLocaleString()}+` : "—", l: "Products" },
                                                { v: stats.categories || "—", l: "Categories" },
                                            ].map(({ v, l }) => (
                                                <div key={l} className="bg-white/10 border border-white/15 rounded-xl
                                                    px-4 py-3 backdrop-blur-sm">
                                                    <div className="text-[15px] font-extrabold text-white">{v}</div>
                                                    <div className="text-[9px] text-white/60 font-semibold uppercase tracking-wider mt-0.5">{l}</div>
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
                                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full
                                    bg-white/90 hidden sm:flex items-center justify-center shadow-md
                                    hover:bg-white hover:scale-105 transition-all text-gray-600">
                                <FaChevronLeft size={12} />
                            </button>
                            <button onClick={() => goHero(1)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full
                                    bg-white/90 hidden sm:flex items-center justify-center shadow-md
                                    hover:bg-white hover:scale-105 transition-all text-gray-600">
                                <FaChevronRight size={12} />
                            </button>
                            <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                                {slides.map((_, i) => (
                                    <button key={i} onClick={() => { setHeroIdx(i); resetTimer(); }}
                                        className={`h-1.5 rounded-full bg-white transition-all
                                            ${i === heroIdx ? "w-6 opacity-100" : "w-1.5 opacity-40"}`} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : !loading && (
                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] min-h-[380px] flex items-center">
                    <div className="max-w-[1280px] mx-auto px-5 lg:px-12 w-full py-16">
                        <div className="max-w-[520px]">
                            <h1 className="text-[clamp(26px,4.5vw,50px)] font-black text-white leading-tight mb-4">
                                Welcome to Urbexon
                                <em className="text-yellow-400 not-italic block mt-1">Shop the Best Deals</em>
                            </h1>
                            <p className="text-[14px] text-white/70 mb-7 leading-relaxed">
                                Discover amazing products from verified sellers.
                            </p>
                            <button onClick={() => navigate("/deals")}
                                className="px-7 py-3 bg-[#2874f0] text-white font-bold text-sm
                                    rounded-xl flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all">
                                Explore Deals <FaArrowRight size={11} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ URBEXON HOUR STRIP ━━ */}
            <div onClick={() => navigate("/urbexon-hour")}
                className="bg-gradient-to-r from-violet-700 to-violet-500 cursor-pointer
                    hover:brightness-105 transition-all w-full">
                <div className="max-w-[1280px] mx-auto px-5 lg:px-12">
                    <div className="flex items-center gap-4 py-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                            <FaBolt className="text-yellow-300" size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-bold text-white">
                                Urbexon <span className="text-yellow-300 font-extrabold">Hour</span>
                            </div>
                            <div className="text-[11px] text-white/65 mt-0.5">
                                Groceries & essentials in <strong className="text-green-400">45 min</strong>
                            </div>
                        </div>
                        <span className="hidden sm:inline bg-white/15 border border-white/25 text-white
                            text-[9px] font-bold px-3 py-1 rounded-full tracking-widest uppercase shrink-0">
                            FAST DELIVERY
                        </span>
                        <FaArrowRight size={12} className="text-white/50 shrink-0" />
                    </div>
                </div>
            </div>

            {/* ━━ CATEGORIES ━━ */}
            {(loading || categories.length > 0) && (
                <div className="bg-white border-b border-gray-100">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                        <CategoryBrowser categories={categories} />
                    </div>
                </div>
            )}

            {/* ━━ NEW ARRIVALS ━━ */}
            {(loading || newArrivals.length > 0) && (
                <div className="bg-white">
                    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-12">
                        <SecHead title="New Arrivals" sub="Fresh drops, just for you"
                            to="/products?sort=newest" label="See all" />
                        <HScrollRow products={newArrivals} loading={loading} skCount={6} />
                    </div>
                </div>
            )}

            {/* ━━ RECENTLY VIEWED ━━ */}
            {ecRecent.length > 0 && (
                <div className="bg-gray-50 border-t border-gray-100">
                    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-12">
                        <SecHead title="Recently Viewed" sub="Continue where you left off" />
                        <HScrollRow products={ecRecent.slice(0, 12)} loading={false} />
                    </div>
                </div>
            )}

            {/* ━━ ALL PRODUCTS ━━ */}
            <AllProductsSection />

            {/* ━━ TRENDING ━━ */}
            {(loading || featured.length > 0) && (
                <div className="bg-gray-50 border-t border-gray-100">
                    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-12">
                        <SecHead title="Trending Now" sub="Most popular right now"
                            to="/products?sort=rating" label="See all" />
                        <PGrid products={featured} loading={loading} skCount={8} />
                    </div>
                </div>
            )}

            {/* ━━ FLASH DEALS ━━ */}
            <FlashDealsSection deals={deals} loading={loading} nearestDealEnd={nearestDealEnd} />

            {/* ━━ FOR YOU ━━ */}
            {forYouProducts.length > 0 && (
                <div className="bg-white border-t border-gray-100">
                    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-12">
                        <SecHead
                            title={`Based on "${forYouTerm}"`}
                            sub="Handpicked for you"
                            to={`/?search=${encodeURIComponent(forYouTerm)}`} label="See all"
                        />
                        <HScrollRow products={forYouProducts} loading={false} />
                    </div>
                </div>
            )}

            {/* ━━ WHY CHOOSE ━━ */}
            <div className="bg-white border-t border-gray-100">
                <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-14">
                    <div className="text-center mb-8">
                        <h2 className="text-[20px] sm:text-[24px] font-extrabold text-gray-900">Why Choose Urbexon?</h2>
                        <p className="text-[13px] text-gray-500 mt-1.5">Your trusted partner for online shopping</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {WHY.map(({ Icon, label, sub, color, bg }) => (
                            <div key={label}
                                className="bg-white border border-gray-100 rounded-2xl px-4 py-6 text-center
                                    hover:-translate-y-1.5 hover:shadow-lg hover:border-blue-100 transition-all">
                                <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center mx-auto mb-4`}>
                                    <Icon size={20} className={color} />
                                </div>
                                <div className="text-[14px] font-extrabold text-gray-900 mb-1.5">{label}</div>
                                <div className="text-[12px] text-gray-500 leading-relaxed">{sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ━━ NEWSLETTER ━━ */}
            <div className="bg-[#1a1a2e] pt-12 pb-28 md:pb-14">
                <div className="max-w-[1280px] mx-auto px-5 lg:px-12">
                    <div className="text-center max-w-[480px] mx-auto">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            text-[10px] font-bold bg-blue-900/40 text-blue-400 border border-blue-800/40
                            mb-4 tracking-widest">
                            ✉️ NEWSLETTER
                        </span>
                        <h3 className="text-[22px] font-extrabold text-white mb-2">Stay in the Loop</h3>
                        <p className="text-[13px] text-white/60 mb-7 leading-relaxed">
                            Exclusive deals, new arrivals, and offers — straight to your inbox.
                        </p>
                        {nlStatus === "done" ? (
                            <p className="text-green-400 font-bold text-[14px]">✅ Successfully subscribed!</p>
                        ) : (
                            <form onSubmit={handleNL}
                                className="flex rounded-xl overflow-hidden border border-white/10
                                    bg-white/5 shadow-xl">
                                <input
                                    className="flex-1 min-w-0 px-4 py-3.5 bg-transparent outline-none
                                        text-[13px] text-white placeholder:text-white/35"
                                    type="email" value={nlEmail}
                                    onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                    placeholder="Enter your email" required
                                />
                                <button type="submit" disabled={nlStatus === "sending"}
                                    className="px-6 py-3.5 bg-[#2874f0] text-white text-[13px] font-bold
                                        hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-60">
                                    {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                                </button>
                            </form>
                        )}
                        {nlStatus === "error" && (
                            <p className="text-red-400 text-[11px] mt-2">Failed. Please try again.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;