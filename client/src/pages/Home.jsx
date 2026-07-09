/**
 * Home.jsx — Urbexon · Professional Redesign
 * Same logic, same colors — clean structured layout
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
    FaFire, FaStar,
} from "react-icons/fa";

/* ─── Constants ─── */
const CACHE_TTL = 3 * 60 * 1000;
let _homeCache = null;
const PAGE_SIZE = 20;
const C = "max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16";
const CARD_SIZE = "w-[180px] min-w-[180px] sm:w-[200px] sm:min-w-[200px] lg:w-[220px] lg:min-w-[220px]";

const ALL_SORT_OPTIONS = [
    { key: "newest", label: "New Arrivals" },
    { key: "rating", label: "Top Rated" },
    { key: "price_asc", label: "Price ↑" },
    { key: "price_desc", label: "Price ↓" },
    { key: "discount", label: "Best Deals" },
];

const WHY = [
    { Icon: FaShippingFast, label: "Fast Delivery", sub: "Free shipping above ₹499", iconBg: "bg-orange-50", iconColor: "text-orange-500" },
    { Icon: FaLock, label: "Secure Payment", sub: "100% encrypted checkout", iconBg: "bg-green-50", iconColor: "text-green-600" },
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARED COMPONENTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const CardWrap = ({ children }) => (
    <div className="flex flex-col bg-white rounded-xl border border-neutral-100 overflow-hidden
                    w-full h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group">
        {children}
    </div>
);

const SkCard = () => (
    <CardWrap>
        <div className="w-full aspect-[4/3] bg-neutral-100 animate-pulse" />
        <div className="p-3 flex flex-col gap-2 flex-1">
            <div className="h-2.5 w-2/5 bg-neutral-100 rounded-full animate-pulse" />
            <div className="h-3 w-4/5 bg-neutral-100 rounded-full animate-pulse" />
            <div className="h-2.5 w-3/5 bg-neutral-100 rounded-full animate-pulse" />
        </div>
    </CardWrap>
);

/* Section header — eyebrow + title + view-all link */
const SecHead = ({ eyebrow, title, sub, to, label = "View all", icon }) => (
    <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div className="flex-1">
            {eyebrow && (
                <span className="inline-block pl-2.5 border-l-[3px] border-orange-500
                                 text-[10px] font-bold tracking-widest uppercase text-orange-500 mb-1.5 leading-none block">
                    {eyebrow}
                </span>
            )}
            <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight leading-tight flex items-center gap-2 m-0">
                {icon && icon}
                {title}
            </h2>
            {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
        </div>
        {to && (
            <Link to={to}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-500
                           no-underline whitespace-nowrap hover:text-orange-600 transition-colors">
                {label} <FaArrowRight size={9} />
            </Link>
        )}
    </div>
);

/* Countdown timer */
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
                    <div className="w-11 h-11 bg-white/15 border border-white/25 rounded-xl
                                    flex flex-col items-center justify-center">
                        <span className="text-base font-black text-white tabular-nums leading-none">{pad(v)}</span>
                        <span className="text-[7px] text-white/60 font-bold mt-0.5 tracking-widest">{l}</span>
                    </div>
                    {i < 2 && <span className="text-white/40 font-black text-base">:</span>}
                </div>
            ))}
        </div>
    );
};

/* Product grid */
const PGrid = ({ products = [], loading, skCount = 10 }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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

/* Horizontal scroll row */
const HScrollRow = ({ products = [], loading, skCount = 6 }) => {
    const rowRef = useRef(null);
    const scroll = dir => rowRef.current?.scrollBy({ left: dir * 230, behavior: "smooth" });
    return (
        <div className="relative group/hrow">
            <button onClick={() => scroll(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -translate-x-1/2
                           w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-md
                           items-center justify-center text-neutral-500 hover:text-neutral-900
                           cursor-pointer transition-all duration-150 hidden md:flex
                           opacity-0 group-hover/hrow:opacity-100">
                <FaChevronLeft size={11} />
            </button>
            <button onClick={() => scroll(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 translate-x-1/2
                           w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-md
                           items-center justify-center text-neutral-500 hover:text-neutral-900
                           cursor-pointer transition-all duration-150 hidden md:flex
                           opacity-0 group-hover/hrow:opacity-100">
                <FaChevronRight size={11} />
            </button>
            <div ref={rowRef}
                className="flex gap-3 overflow-x-auto pb-1 scroll-smooth
                           [scroll-snap-type:x_mandatory]
                           [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {loading
                    ? Array(skCount).fill(0).map((_, i) => (
                        <div key={i} className={`${CARD_SIZE} flex-shrink-0 [scroll-snap-align:start]`}><SkCard /></div>
                    ))
                    : products.map(p => (
                        <div key={p._id || p.id} className={`${CARD_SIZE} flex-shrink-0 [scroll-snap-align:start]`}>
                            <CardWrap><ProductCard product={p} hideActions /></CardWrap>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ALL PRODUCTS SECTION
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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
        <section className="bg-neutral-50 border-t border-neutral-100 py-8">
            <div className={C}>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <SecHead eyebrow="Catalog" title="All Products"
                        icon={<FaThLarge size={14} className="text-orange-500" />} />
                    <div className="flex gap-2 flex-wrap -mt-1">
                        {ALL_SORT_OPTIONS.map(o => (
                            <button key={o.key} onClick={() => setSort(o.key)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 whitespace-nowrap
                                    ${sort === o.key
                                        ? "bg-neutral-900 border-neutral-900 text-white"
                                        : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400"}`}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="relative">
                    {isSorting && (
                        <div className="absolute inset-0 bg-neutral-50/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                            <div className="w-6 h-6 rounded-full border-2 border-neutral-200 border-t-neutral-900 animate-spin" />
                        </div>
                    )}
                    {loading
                        ? <PGrid loading skCount={PAGE_SIZE} />
                        : products.length > 0
                            ? <PGrid products={products} />
                            : (
                                <div className="flex flex-col items-center py-14 text-center">
                                    <FaStore size={36} className="text-neutral-200 mb-3" />
                                    <p className="font-semibold text-neutral-400">No products found</p>
                                </div>
                            )
                    }
                </div>
                {!loading && hasMore && (
                    <div className="flex justify-center mt-7">
                        <button onClick={loadMore} disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-8 py-2.5
                                       border border-neutral-900 rounded-xl
                                       bg-white text-neutral-900 text-sm font-semibold
                                       hover:bg-neutral-900 hover:text-white
                                       disabled:opacity-50 transition-all duration-200">
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FLASH DEALS SECTION
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const FlashDealsSection = ({ deals, loading, nearestDealEnd }) => {
    if (!loading && deals.length === 0) return null;
    return (
        <section className="bg-white border-t border-neutral-100 py-8">
            <div className={C}>
                <SecHead eyebrow="Limited time" title="Flash Deals"
                    sub="Stock is running out — grab yours now"
                    to="/deals" label="All deals" icon={<span className="text-base">⚡</span>} />

                {/* Countdown banner */}
                <div className="relative overflow-hidden rounded-2xl mb-6
                                bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500
                                p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4">
                    <div className="absolute inset-0 opacity-10"
                        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 border border-white/30 rounded-xl
                                        flex items-center justify-center text-xl flex-shrink-0">
                            🔥
                        </div>
                        <div>
                            <p className="text-sm font-extrabold text-white">Flash Sale — Live Now</p>
                            <p className="text-xs text-white/70 mt-0.5">Deep discounts · Limited quantities</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                        <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest hidden sm:block">Ends in</span>
                        <FlashTimer endsAt={nearestDealEnd} />
                    </div>
                </div>

                <PGrid products={deals} loading={loading} skCount={8} />

                {!loading && deals.length > 0 && (
                    <div className="flex justify-center mt-5">
                        <Link to="/deals"
                            className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl
                                       bg-neutral-900 text-white text-sm font-bold no-underline
                                       hover:bg-neutral-800 hover:-translate-y-0.5 transition-all duration-200">
                            <FaTag size={11} /> View all deals
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HERO SLIDE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HeroSlide = ({ slide, active, stats, navigate }) => {
    const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";
    return (
        <div className={`absolute inset-0 transition-all duration-700 ease-in-out
                         ${active ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
            {/* BG image + fade */}
            <div className="absolute inset-0">
                <img src={bg} alt={slide.title || "Banner"} className="w-full h-full object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/70 to-white/10" />
                <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent sm:hidden" />
            </div>

            {/* Soft blobs */}
            <div className="absolute top-8 left-[40%] w-56 h-56 rounded-full bg-orange-300/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-8 left-[30%] w-36 h-36 rounded-full bg-violet-300/15 blur-2xl pointer-events-none" />

            {/* Content */}
            <div className={`${C} relative z-10 h-full flex items-center`}>
                <div className="max-w-[500px] flex flex-col items-start">

                    {slide.tag && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                        bg-orange-50 border border-orange-200
                                        text-[10px] font-extrabold text-orange-600 tracking-widest uppercase mb-4">
                            <FaFire size={8} className="text-orange-500" />
                            {slide.tag}
                        </div>
                    )}

                    <h1 className="text-[clamp(26px,4.2vw,56px)] font-black text-neutral-900
                                   leading-[1.05] tracking-tight m-0 mb-3">
                        {slide.title}
                        {slide.highlight && (
                            <span className="block bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
                                {slide.highlight}
                            </span>
                        )}
                    </h1>

                    {(slide.subtitle || slide.desc || slide.description) && (
                        <p className="text-sm text-neutral-500 leading-relaxed mb-6 max-w-[400px]">
                            {slide.subtitle || slide.desc || slide.description}
                        </p>
                    )}

                    <div className="flex gap-3 flex-wrap mb-7">
                        <button
                            onClick={() => {
                                const t = slide.link || slide.ctaLink || "/";
                                t.startsWith("http") ? window.open(t, "_blank", "noopener") : navigate(t);
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                                       bg-gradient-to-r from-orange-500 to-rose-500
                                       text-white text-sm font-bold border-none cursor-pointer
                                       shadow-[0_4px_18px_rgba(249,115,22,0.38)]
                                       hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(249,115,22,0.48)]
                                       active:scale-95 transition-all duration-200">
                            {slide.buttonText || slide.cta || "Shop Now"}
                            <FaArrowRight size={11} />
                        </button>
                        {slide.secondary && (
                            <button onClick={() => navigate(slide.secondaryLink || "/deals")}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl
                                           bg-white/90 border border-neutral-200
                                           text-neutral-700 text-sm font-semibold cursor-pointer
                                           hover:bg-white hover:border-neutral-300
                                           hover:-translate-y-0.5 active:scale-95 transition-all duration-200 shadow-sm">
                                {slide.secondary}
                            </button>
                        )}
                    </div>

                    {/* Stat chips */}
                    <div className="flex gap-2.5 flex-wrap">
                        {[
                            { v: "Free", l: "Delivery ₹499+", emoji: "🚚" },
                            { v: stats.products ? `${stats.products.toLocaleString()}+` : "500+", l: "Products", emoji: "📦" },
                            { v: stats.categories || "20+", l: "Categories", emoji: "🏷️" },
                        ].map(({ v, l, emoji }) => (
                            <div key={l}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl
                                           bg-white/80 border border-neutral-200/80 shadow-sm">
                                <span className="text-base leading-none">{emoji}</span>
                                <div>
                                    <div className="text-[12px] font-black text-neutral-900 leading-none">{v}</div>
                                    <div className="text-[9px] text-neutral-400 font-semibold mt-0.5 whitespace-nowrap">{l}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HeroSkeleton = () => (
    <div className="w-full h-[260px] sm:h-[360px] md:h-[440px] lg:h-[500px]
                    bg-gradient-to-br from-orange-50 via-rose-50 to-violet-50
                    flex flex-col justify-center gap-4 px-6 sm:px-16 animate-pulse relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-orange-200/25 blur-3xl" />
        <div className="h-4 w-16 bg-orange-200/70 rounded-full" />
        <div className="h-10 sm:h-14 w-3/4 sm:w-1/2 bg-neutral-200/60 rounded-xl" />
        <div className="h-4 w-1/2 sm:w-1/3 bg-neutral-200/40 rounded-lg" />
        <div className="h-11 w-36 bg-orange-300/50 rounded-xl mt-1" />
    </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOME COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

    /* ─ Fetch homepage ─ */
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

    /* ─ For You ─ */
    useEffect(() => {
        const h = getHistory(); if (!h.length) return;
        const term = h[0]; setForYouTerm(term);
        api.get(`/products?search=${encodeURIComponent(term)}&productType=ecommerce&limit=8`)
            .then(r => setForYouProducts(r.data?.products || [])).catch(() => { });
    }, []);

    /* ─ Hero autoplay ─ */
    const resetTimer = useCallback(() => {
        clearInterval(heroTimer.current);
        if (slides.length > 1) heroTimer.current = setInterval(() => setHeroIdx(i => (i + 1) % slides.length), 5500);
    }, [slides.length]);
    useEffect(() => { resetTimer(); return () => clearInterval(heroTimer.current); }, [resetTimer]);
    const goHero = useCallback(dir => {
        setHeroIdx(i => (i + dir + slides.length) % slides.length); resetTimer();
    }, [slides.length, resetTimer]);

    /* ─ Search ─ */
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

    /* ─ Newsletter ─ */
    const handleNL = async e => {
        e.preventDefault(); if (!nlEmail.trim()) return;
        setNlStatus("sending");
        try { await api.post("/contact/newsletter", { email: nlEmail.trim() }); setNlEmail(""); setNlStatus("done"); }
        catch { setNlStatus("error"); }
    };

    /* ── SEARCH RESULTS VIEW ── */
    if (searchQuery.trim()) return (
        <div className="bg-neutral-50 min-h-screen">
            <div className={`${C} pt-10 pb-20`}>
                <span className="block pl-2.5 border-l-[3px] border-orange-500
                                 text-[10px] font-bold tracking-widest uppercase text-orange-500 mb-2">
                    Search Results
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                    Results for <em className="not-italic text-orange-500">"{searchQuery}"</em>
                </h1>
                <p className="text-xs text-neutral-400 mt-2 mb-8">
                    {searching ? "Searching…" : `${searchResults.length} product${searchResults.length !== 1 ? "s" : ""} found`}
                </p>
                {searching
                    ? <PGrid loading skCount={12} />
                    : searchResults.length > 0
                        ? <PGrid products={searchResults} />
                        : (
                            <div className="flex flex-col items-center py-24 text-center">
                                <FaSearch size={44} className="text-neutral-200 mb-4" />
                                <p className="font-bold text-neutral-400">No products match "{searchQuery}"</p>
                                <p className="text-xs text-neutral-400 mt-1.5">Try a broader term or browse categories</p>
                            </div>
                        )
                }
            </div>
        </div>
    );

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       MAIN RENDER
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    return (
        <div className="bg-neutral-50 overflow-x-hidden w-full">

            <style>{`
                @keyframes progressBar {
                    from { width: 0%; }
                    to   { width: 100%; }
                }
                @keyframes gradientShift {
                    0%   { background-position: 0% 50%; }
                    100% { background-position: 300% 50%; }
                }
            `}</style>

            <SEO
                title="Premium Online Shopping — Urbexon"
                description="Discover premium products from verified sellers with fast delivery and secure checkout."
                path="/"
            />

            {/* ══════════════════════════════════════
                1. HERO BANNER
                ══════════════════════════════════════ */}
            {loading && slides.length === 0 ? (
                <HeroSkeleton />
            ) : slides.length > 0 ? (
                <div className="relative w-full overflow-hidden
                                h-[260px] sm:h-[360px] md:h-[440px] lg:h-[500px] xl:h-[540px]
                                bg-gradient-to-br from-orange-50 via-white to-violet-50 group">

                    {slides.map((slide, i) => (
                        <HeroSlide key={slide._id || i} slide={slide} active={i === heroIdx} stats={stats} navigate={navigate} />
                    ))}

                    {slides.length > 1 && (
                        <>
                            {/* Arrows */}
                            <button onClick={() => goHero(-1)}
                                className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20
                                           w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm
                                           border border-neutral-200 shadow-md
                                           flex items-center justify-center text-neutral-600
                                           cursor-pointer hover:bg-white hover:scale-105
                                           opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200">
                                <FaChevronLeft size={13} />
                            </button>
                            <button onClick={() => goHero(1)}
                                className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20
                                           w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm
                                           border border-neutral-200 shadow-md
                                           flex items-center justify-center text-neutral-600
                                           cursor-pointer hover:bg-white hover:scale-105
                                           opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200">
                                <FaChevronRight size={13} />
                            </button>

                            {/* Dot indicators */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20
                                            flex gap-1.5 bg-white/70 backdrop-blur-sm
                                            border border-neutral-200/50 px-3 py-2 rounded-full shadow-sm">
                                {slides.map((_, i) => (
                                    <button key={i}
                                        onClick={() => { setHeroIdx(i); resetTimer(); }}
                                        className={`h-1.5 rounded-full border-none cursor-pointer p-0 transition-all duration-300
                                                    ${i === heroIdx ? "w-6 bg-orange-500" : "w-1.5 bg-neutral-300"}`} />
                                ))}
                            </div>

                            {/* Slide counter */}
                            <div className="absolute top-4 right-4 z-20 hidden sm:block
                                            bg-white/70 backdrop-blur-sm border border-neutral-200/50
                                            text-[10px] font-bold text-neutral-500 px-2.5 py-1 rounded-full">
                                {heroIdx + 1} / {slides.length}
                            </div>

                            {/* Progress bar */}
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-100 z-20">
                                <div key={heroIdx} className="h-full bg-gradient-to-r from-orange-400 to-rose-500 rounded-full"
                                    style={{ animation: "progressBar 5.5s linear forwards" }} />
                            </div>
                        </>
                    )}
                </div>

            ) : !loading && (
                /* Fallback hero */
                <div className="w-full relative overflow-hidden min-h-[260px] sm:min-h-[380px]
                                bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 flex items-center">
                    <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-orange-200/35 blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full bg-violet-200/20 blur-3xl pointer-events-none" />
                    <div className={`${C} py-14 relative z-10 w-full`}>
                        <div className="max-w-[520px]">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                            bg-orange-100 border border-orange-200
                                            text-[10px] font-extrabold text-orange-600 tracking-widest uppercase mb-5">
                                <FaStar size={8} className="text-orange-500" /> Premium Shopping
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black text-neutral-900 leading-tight tracking-tight mb-4">
                                Welcome to{" "}
                                <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
                                    Urbexon
                                </span>
                            </h1>
                            <p className="text-sm text-neutral-500 mb-8 leading-relaxed max-w-[420px]">
                                Premium products · Fast delivery · Secure checkout.<br />
                                Shop from thousands of verified sellers.
                            </p>
                            <div className="flex gap-3 flex-wrap">
                                <button onClick={() => navigate("/deals")}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                                               bg-gradient-to-r from-orange-500 to-rose-500
                                               text-white text-sm font-bold cursor-pointer border-none
                                               shadow-[0_4px_18px_rgba(249,115,22,0.35)]
                                               hover:-translate-y-0.5 transition-all duration-200">
                                    Explore deals <FaArrowRight size={12} />
                                </button>
                                <button onClick={() => navigate("/products")}
                                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl
                                               bg-white border border-neutral-200
                                               text-neutral-700 text-sm font-semibold cursor-pointer
                                               hover:border-neutral-300 hover:-translate-y-0.5 transition-all duration-200 shadow-sm">
                                    Browse all
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════
                2. CATEGORIES STRIP
                ══════════════════════════════════════ */}
            {(loading || categories.length > 0) && (
                <div className="bg-white border-b border-neutral-100">
                    <div className={C}>
                        <CategoryBrowser categories={categories} />
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════
                3. URBEXON HOUR — Compact promo strip
                ══════════════════════════════════════ */}
            <div
                onClick={() => navigate("/urbexon-hour")}
                className="w-full cursor-pointer group/uh relative overflow-hidden
                           bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600
                           border-b border-violet-700">

                {/* Subtle texture */}
                <div className="absolute inset-0 opacity-[0.07]"
                    style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

                {/* Animated top line */}
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{
                        background: "linear-gradient(90deg,#f97316,#ec4899,#a855f7,#f97316)",
                        backgroundSize: "200% 100%",
                        animation: "gradientShift 3s linear infinite",
                    }} />

                <div className={`${C} py-4 relative z-10`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">

                        {/* Left — brand */}
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30
                                            flex items-center justify-center flex-shrink-0
                                            shadow-[0_4px_14px_rgba(0,0,0,0.2)]
                                            group-hover/uh:-translate-y-0.5 transition-transform duration-300">
                                <FaBolt size={20} className="text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-extrabold text-white tracking-tight leading-none">
                                        Urbexon Hour
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                                     bg-white/20 border border-white/30
                                                     text-[8px] font-black text-white tracking-widest uppercase">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                                    </span>
                                </div>
                                <p className="text-[11px] text-white/70 mt-0.5 font-medium">
                                    Groceries & essentials · Hyperlocal delivery in 45 min
                                </p>
                            </div>
                        </div>

                        {/* Center — feature chips */}
                        <div className="hidden sm:flex items-center gap-2">
                            {[
                                { emoji: "⚡", text: "45-min delivery" },
                                { emoji: "🛒", text: "Fresh groceries" },
                                { emoji: "📍", text: "Hyperlocal" },
                            ].map(({ emoji, text }) => (
                                <span key={text}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                                               bg-white/15 border border-white/20
                                               text-[11px] font-semibold text-white whitespace-nowrap">
                                    <span className="text-sm leading-none">{emoji}</span> {text}
                                </span>
                            ))}
                        </div>

                        {/* Right — CTA */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-center hidden md:block">
                                <div className="text-2xl font-black text-white leading-none tabular-nums">45</div>
                                <div className="text-[9px] text-white/60 font-bold uppercase tracking-wider leading-none mt-0.5">min avg</div>
                            </div>
                            <div className="w-px h-8 bg-white/20 hidden md:block" />
                            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                                               bg-white text-violet-700 text-[12px] font-bold
                                               shadow-[0_4px_14px_rgba(0,0,0,0.2)]
                                               group-hover/uh:-translate-y-0.5 group-hover/uh:shadow-[0_6px_18px_rgba(0,0,0,0.25)]
                                               transition-all duration-200">
                                Order Now <FaArrowRight size={9} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════
                4. NEW ARRIVALS
                ══════════════════════════════════════ */}
            {(loading || newArrivals.length > 0) && (
                <section className="bg-white border-b border-neutral-100 py-8">
                    <div className={C}>
                        <SecHead eyebrow="Just in" title="New Arrivals"
                            sub="Fresh drops and latest collections"
                            to="/products?sort=newest" label="See all" />
                        <HScrollRow products={newArrivals} loading={loading} skCount={6} />
                    </div>
                </section>
            )}

            {/* ══════════════════════════════════════
                5. FLASH DEALS
                ══════════════════════════════════════ */}
            <FlashDealsSection deals={deals} loading={loading} nearestDealEnd={nearestDealEnd} />

            {/* ══════════════════════════════════════
                6. TRENDING / FEATURED
                ══════════════════════════════════════ */}
            {(loading || featured.length > 0) && (
                <section className="bg-white border-t border-neutral-100 py-8">
                    <div className={C}>
                        <SecHead eyebrow="Popular" title="Trending Now"
                            sub="Most-loved products this week"
                            to="/products?sort=rating" label="See all" />
                        <PGrid products={featured} loading={loading} skCount={8} />
                    </div>
                </section>
            )}

            {/* ══════════════════════════════════════
                7. ALL PRODUCTS
                ══════════════════════════════════════ */}
            <AllProductsSection />

            {/* ══════════════════════════════════════
                8. RECENTLY VIEWED
                ══════════════════════════════════════ */}
            {ecRecent.length > 0 && (
                <section className="bg-white border-t border-neutral-100 py-8">
                    <div className={C}>
                        <SecHead eyebrow="Your history" title="Recently Viewed"
                            sub="Continue where you left off" />
                        <HScrollRow products={ecRecent.slice(0, 12)} loading={false} />
                    </div>
                </section>
            )}

            {/* ══════════════════════════════════════
                9. PICKED FOR YOU
                ══════════════════════════════════════ */}
            {forYouProducts.length > 0 && (
                <section className="bg-neutral-50 border-t border-neutral-100 py-8">
                    <div className={C}>
                        <SecHead eyebrow="Picked for you" title={`Similar to "${forYouTerm}"`}
                            sub="Based on your recent searches"
                            to={`/?search=${encodeURIComponent(forYouTerm)}`} label="See all" />
                        <HScrollRow products={forYouProducts} loading={false} />
                    </div>
                </section>
            )}

            {/* ══════════════════════════════════════
                10. WHY CHOOSE US
                ══════════════════════════════════════ */}
            <section className="bg-white border-t border-neutral-100 py-8">
                <div className={C}>
                    <div className="text-center mb-6">
                        <span className="inline-block pb-1.5 border-b-2 border-orange-500
                                         text-[10px] font-bold tracking-widest uppercase text-orange-500">
                            Our Promise
                        </span>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-2.5">
                            Why Choose Urbexon?
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1">Your trusted partner for premium shopping</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {WHY.map(({ Icon, label, sub, iconBg, iconColor }) => (
                            <div key={label}
                                className="bg-white border border-neutral-100 rounded-2xl p-4 text-center
                                           hover:-translate-y-1 hover:shadow-xl hover:border-transparent
                                           transition-all duration-200">
                                <div className={`w-10 h-10 ${iconBg} rounded-[12px] flex items-center justify-center mx-auto mb-3`}>
                                    <Icon size={18} className={iconColor} />
                                </div>
                                <p className="text-sm font-bold text-neutral-900 mb-1">{label}</p>
                                <p className="text-xs text-neutral-400 leading-relaxed">{sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════
                11. NEWSLETTER
                ══════════════════════════════════════ */}
            <section className="relative overflow-hidden border-t border-neutral-100 py-14">
                {/* Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-rose-500 to-violet-600" />
                <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-black/10 blur-3xl pointer-events-none" />

                <div className={`${C} relative z-10`}>
                    <div className="max-w-[440px] mx-auto text-center">
                        <span className="block pl-0 border-l-0 mb-2
                                         text-[10px] font-bold tracking-widest uppercase text-white/60">
                            Newsletter
                        </span>
                        <h3 className="text-[clamp(24px,3.5vw,34px)] font-black text-white tracking-tight mb-3">
                            Stay in the Loop
                        </h3>
                        <p className="text-sm text-white/75 leading-relaxed mb-7">
                            Exclusive deals, new arrivals, and special offers — straight to your inbox.
                        </p>

                        {nlStatus === "done" ? (
                            <div className="p-4 bg-white/15 border border-white/30 rounded-xl
                                            text-white font-bold text-sm backdrop-blur-sm">
                                ✅ You're subscribed! Check your inbox.
                            </div>
                        ) : (
                            <form onSubmit={handleNL}
                                className="flex rounded-xl overflow-hidden
                                           border border-white/25 bg-white/15 backdrop-blur-sm
                                           shadow-[0_4px_24px_rgba(0,0,0,0.15)]">
                                <input type="email" value={nlEmail} required
                                    onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                    placeholder="your@email.com"
                                    className="flex-1 min-w-0 px-4 py-3.5 bg-transparent border-none outline-none
                                               text-sm text-white placeholder:text-white/50" />
                                <button type="submit" disabled={nlStatus === "sending"}
                                    className="px-5 py-3.5 bg-white text-orange-600 text-sm font-bold
                                               border-none cursor-pointer whitespace-nowrap
                                               hover:bg-neutral-50 disabled:opacity-60 transition-colors">
                                    {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                                </button>
                            </form>
                        )}
                        {nlStatus === "error" && (
                            <p className="text-white/70 text-xs mt-3 bg-white/10 rounded-lg py-1.5 px-3">
                                Something went wrong. Please try again.
                            </p>
                        )}
                    </div>
                </div>
            </section>

        </div>
    );
};

export default Home;
