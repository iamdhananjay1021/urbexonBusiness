/**
 * Home.jsx — Urbexon v3 · Hero Redesign
 * ─ Vibrant, light-mode hero with Tailwind animations
 * ─ Removed heavy dark overlays — modern gradient approach
 * ─ Animated floating orbs, slide transitions, stat chips
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
    FaFire, FaStar,
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
   CARD WRAPPER
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const CardWrap = ({ children }) => (
    <div className="flex flex-col bg-white rounded-xl border border-neutral-100 overflow-hidden
                    w-full h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
        {children}
    </div>
);

/* ─── SKELETON CARD ─── */
const SkCard = () => (
    <CardWrap>
        <div className="w-full aspect-[4/3] bg-neutral-100 animate-pulse" />
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
    <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
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
   PRODUCT GRID — 2→3→4→5 cols
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PGrid = ({ products = [], loading, skCount = 10 }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
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
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HScrollRow = ({ products = [], loading, skCount = 6 }) => {
    const rowRef = useRef(null);
    const scroll = dir => rowRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
    return (
        <div className="relative group/hrow">
            <button onClick={() => scroll(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10
                           w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-md
                           items-center justify-center text-neutral-500 hover:text-neutral-900
                           transition-all duration-150 hidden md:flex
                           opacity-0 group-hover/hrow:opacity-100 -translate-x-1/2">
                <FaChevronLeft size={11} />
            </button>
            <button onClick={() => scroll(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                           w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-md
                           items-center justify-center text-neutral-500 hover:text-neutral-900
                           transition-all duration-150 hidden md:flex
                           opacity-0 group-hover/hrow:opacity-100 translate-x-1/2">
                <FaChevronRight size={11} />
            </button>
            <div ref={rowRef}
                className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5
                           scroll-smooth [scroll-snap-type:x_mandatory]
                           [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {loading
                    ? Array(skCount).fill(0).map((_, i) => (
                        <div key={i} className={`${CARD_SIZE} flex-shrink-0 [scroll-snap-align:start]`}>
                            <SkCard />
                        </div>
                    ))
                    : products.map(p => (
                        <div key={p._id || p.id} className={`${CARD_SIZE} flex-shrink-0 [scroll-snap-align:start]`}>
                            <CardWrap>
                                <ProductCard product={p} hideActions />
                            </CardWrap>
                        </div>
                    ))
                }
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
        <section className="bg-neutral-50 border-t border-neutral-100 py-7">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
                <SecHead eyebrow="Catalog" title="All Products" sub="Browse our complete collection"
                    to="/products" label="Full catalog"
                    icon={<FaThLarge size={15} className="text-orange-500" />} />
                <div className="flex gap-2 flex-wrap mb-4">
                    {ALL_SORT_OPTIONS.map(o => (
                        <button key={o.key} onClick={() => setSort(o.key)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 whitespace-nowrap
                                ${sort === o.key
                                    ? "bg-neutral-900 border-neutral-900 text-white"
                                    : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
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
                                <div className="flex flex-col items-center py-14 text-center">
                                    <FaStore size={36} className="text-neutral-200 mb-3" />
                                    <p className="font-bold text-neutral-400">No products found</p>
                                </div>
                            )
                    }
                </div>
                {!loading && hasMore && (
                    <div className="flex justify-center mt-6">
                        <button onClick={loadMore} disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-8 py-3
                                       border-[1.5px] border-neutral-900 rounded-lg
                                       bg-white text-neutral-900 text-sm font-bold
                                       hover:bg-neutral-900 hover:text-white hover:-translate-y-0.5
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

/* ─── FLASH DEALS SECTION ─── */
const FlashDealsSection = ({ deals, loading, nearestDealEnd }) => {
    if (!loading && deals.length === 0) return null;
    return (
        <section className="bg-white border-t border-neutral-100 py-7">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
                <SecHead eyebrow="Limited time" title="Flash Deals"
                    sub="Stock is running out — grab yours now" to="/deals" label="All deals" />
                <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500
                                rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4 mb-5">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0
                                    animate-[shimmer_2.5s_ease-in-out_infinite]" />
                    <div className="absolute -top-6 right-20 w-32 h-32 rounded-full bg-yellow-300/20 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-6 left-10 w-24 h-24 rounded-full bg-rose-300/20 blur-2xl pointer-events-none" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 bg-white/20 border border-white/30
                                        rounded-xl flex items-center justify-center text-lg flex-shrink-0 animate-bounce">
                            ⚡
                        </div>
                        <div>
                            <p className="text-sm font-extrabold text-white tracking-tight">Flash Sale — Live Now</p>
                            <p className="text-xs text-white/70 mt-0.5">Deep discounts · Limited quantities</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Ends in</span>
                        <FlashTimer endsAt={nearestDealEnd} />
                    </div>
                </div>
                <PGrid products={deals} loading={loading} skCount={8} />
                {!loading && deals.length > 0 && (
                    <div className="flex justify-center mt-5">
                        <Link to="/deals"
                            className="inline-flex items-center gap-2 px-7 py-2.5 rounded-lg
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ★  HERO SLIDE COMPONENT  ★
   — Light-mode-first, vibrant gradient bg, animated
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HeroSlide = ({ slide, active, stats, onCta, navigate }) => {
    const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";

    return (
        <div className={`absolute inset-0 transition-all duration-700 ease-in-out
                         ${active ? "opacity-100 z-10 scale-100" : "opacity-0 z-0 scale-[1.01]"}`}>

            {/* ── Background image ── */}
            <div className="absolute inset-0">
                <img src={bg} alt={slide.title || "Banner"}
                    className="w-full h-full object-cover object-center" />
                {/*
                    Light gradient: left side gets a warm-to-white fade
                    so text is readable without killing the image
                */}
                <div className="absolute inset-0
                                bg-gradient-to-r
                                from-white/95 via-white/75 to-white/0
                                sm:from-white/90 sm:via-white/65 sm:to-white/0" />
                {/* Bottom fade for mobile readability */}
                <div className="absolute inset-0
                                bg-gradient-to-t from-white/80 via-transparent to-transparent
                                sm:hidden" />
            </div>

            {/* ── Decorative animated blobs ── */}
            <div className="absolute top-8 left-[38%] w-48 h-48 rounded-full
                            bg-gradient-to-br from-orange-300/25 to-rose-300/20
                            blur-3xl pointer-events-none
                            animate-[pulse_4s_ease-in-out_infinite]" />
            <div className="absolute bottom-6 left-[28%] w-32 h-32 rounded-full
                            bg-gradient-to-br from-violet-300/20 to-indigo-300/15
                            blur-2xl pointer-events-none
                            animate-[pulse_6s_ease-in-out_infinite_1s]" />

            {/* ── Content ── */}
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16
                            relative z-10 w-full h-full flex items-center py-10">
                <div className="max-w-[520px] flex flex-col items-start">

                    {/* Tag pill */}
                    {slide.tag && (
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                                        bg-orange-50 border border-orange-200
                                        text-[10px] font-extrabold text-orange-600 tracking-widest uppercase mb-4
                                        animate-[fadeSlideDown_0.5s_ease_both]">
                            <FaFire size={9} className="text-orange-500 animate-pulse" />
                            {slide.tag}
                        </div>
                    )}

                    {/* Headline */}
                    <h1 className="text-[clamp(28px,4.5vw,58px)] font-black
                                   text-neutral-900 leading-[1.05] tracking-[-0.03em]
                                   m-0 mb-3
                                   animate-[fadeSlideUp_0.5s_ease_0.1s_both]">
                        {slide.title}
                        {slide.highlight && (
                            <span className="block bg-gradient-to-r from-orange-500 to-rose-500
                                             bg-clip-text text-transparent mt-1">
                                {slide.highlight}
                            </span>
                        )}
                    </h1>

                    {/* Subtitle */}
                    {(slide.subtitle || slide.desc || slide.description) && (
                        <p className="text-[clamp(13px,1.3vw,15px)] text-neutral-500
                                      leading-relaxed mb-6 max-w-[420px]
                                      animate-[fadeSlideUp_0.5s_ease_0.2s_both]">
                            {slide.subtitle || slide.desc || slide.description}
                        </p>
                    )}

                    {/* CTA Buttons */}
                    <div className="flex gap-3 flex-wrap mb-8 animate-[fadeSlideUp_0.5s_ease_0.3s_both]">
                        <button
                            onClick={() => {
                                const t = slide.link || slide.ctaLink || "/";
                                t.startsWith("http") ? window.open(t, "_blank", "noopener") : navigate(t);
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                                       bg-gradient-to-r from-orange-500 to-rose-500
                                       text-white text-sm font-black border-none cursor-pointer
                                       shadow-[0_4px_20px_rgba(249,115,22,0.4)]
                                       hover:shadow-[0_6px_28px_rgba(249,115,22,0.5)]
                                       hover:-translate-y-0.5 hover:from-orange-600 hover:to-rose-600
                                       active:scale-95 transition-all duration-200">
                            {slide.buttonText || slide.cta || "Shop Now"}
                            <FaArrowRight size={11} />
                        </button>
                        {slide.secondary && (
                            <button onClick={() => navigate(slide.secondaryLink || "/deals")}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl
                                           bg-white/90 backdrop-blur-sm
                                           border border-neutral-200 text-neutral-700 text-sm font-semibold
                                           cursor-pointer hover:bg-white hover:border-neutral-300
                                           hover:-translate-y-0.5 active:scale-95 transition-all duration-200
                                           shadow-sm hover:shadow-md">
                                {slide.secondary}
                            </button>
                        )}
                    </div>

                    {/* Stats chips */}
                    <div className="flex gap-2.5 flex-wrap animate-[fadeSlideUp_0.5s_ease_0.4s_both]">
                        {[
                            { v: "Free", l: "Delivery ₹499+", icon: "🚚" },
                            { v: stats.products ? `${stats.products.toLocaleString()}+` : "500+", l: "Products", icon: "📦" },
                            { v: stats.categories || "20+", l: "Categories", icon: "🏷️" },
                        ].map(({ v, l, icon }) => (
                            <div key={l} className="flex items-center gap-2
                                                     px-3.5 py-2 rounded-xl
                                                     bg-white/80 backdrop-blur-sm
                                                     border border-neutral-200/80
                                                     shadow-sm hover:shadow-md
                                                     transition-shadow duration-200">
                                <span className="text-base leading-none">{icon}</span>
                                <div>
                                    <div className="text-[13px] font-black text-neutral-900 leading-none">{v}</div>
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ★  HERO SKELETON  ★
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HeroSkeleton = () => (
    <div className="w-full bg-gradient-to-br from-orange-50 via-rose-50 to-violet-50
                    h-[260px] sm:h-[360px] md:h-[440px] lg:h-[500px]
                    flex flex-col justify-center gap-4 px-6 sm:px-12 animate-pulse relative overflow-hidden">
        {/* shimmer blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-violet-200/25 blur-3xl" />
        <div className="h-4 w-20 bg-orange-200/60 rounded-full relative z-10" />
        <div className="h-10 sm:h-14 w-3/4 sm:w-1/2 bg-neutral-200/60 rounded-xl relative z-10" />
        <div className="h-8 sm:h-10 w-2/3 sm:w-2/5 bg-neutral-200/40 rounded-xl relative z-10" />
        <div className="h-4 w-1/2 sm:w-1/3 bg-neutral-200/40 rounded-lg relative z-10" />
        <div className="h-11 w-36 bg-orange-300/50 rounded-xl mt-2 relative z-10" />
    </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOME COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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
        if (slides.length > 1) heroTimer.current = setInterval(() => setHeroIdx(i => (i + 1) % slides.length), 5500);
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

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       MAIN RENDER
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    return (
        <div className="bg-neutral-50 overflow-x-hidden w-full">

            {/* ── Keyframes injected once ── */}
            <style>{`
                @keyframes fadeSlideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to   { opacity: 1; transform: translateY(0);     }
                }
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                @keyframes shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(100%);  }
                }
                @keyframes floatUp {
                    0%, 100% { transform: translateY(0);    }
                    50%       { transform: translateY(-8px); }
                }
                @keyframes gradientShift {
                    0%   { background-position: 0%   50%; }
                    100% { background-position: 300% 50%; }
                }
            `}</style>

            <SEO title="Premium Online Shopping — Urbexon"
                description="Discover premium products from verified sellers with fast delivery and secure checkout."
                path="/" />

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                ★  HERO  ★
                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {loading && slides.length === 0 ? (
                <HeroSkeleton />
            ) : slides.length > 0 ? (

                <div className="relative w-full overflow-hidden
                                h-[260px] sm:h-[360px] md:h-[440px] lg:h-[500px] xl:h-[540px]
                                bg-gradient-to-br from-orange-50 via-white to-violet-50
                                group">

                    {/* Slides */}
                    {slides.map((slide, i) => (
                        <HeroSlide
                            key={slide._id || i}
                            slide={slide}
                            active={i === heroIdx}
                            stats={stats}
                            navigate={navigate}
                        />
                    ))}

                    {/* ── Nav arrows ── */}
                    {slides.length > 1 && (
                        <>
                            <button onClick={() => goHero(-1)}
                                className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20
                                           w-9 h-9 rounded-full
                                           bg-white/80 backdrop-blur-sm
                                           border border-neutral-200 shadow-md
                                           flex items-center justify-center
                                           text-neutral-600 hover:text-neutral-900
                                           cursor-pointer transition-all duration-200
                                           hover:bg-white hover:scale-105
                                           opacity-100 sm:opacity-0 group-hover:opacity-100">
                                <FaChevronLeft size={13} />
                            </button>
                            <button onClick={() => goHero(1)}
                                className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20
                                           w-9 h-9 rounded-full
                                           bg-white/80 backdrop-blur-sm
                                           border border-neutral-200 shadow-md
                                           flex items-center justify-center
                                           text-neutral-600 hover:text-neutral-900
                                           cursor-pointer transition-all duration-200
                                           hover:bg-white hover:scale-105
                                           opacity-100 sm:opacity-0 group-hover:opacity-100">
                                <FaChevronRight size={13} />
                            </button>

                            {/* ── Dot indicators ── */}
                            <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-20
                                            flex gap-1.5
                                            bg-white/70 backdrop-blur-sm
                                            border border-neutral-200/60
                                            px-3 py-2 rounded-full shadow-sm">
                                {slides.map((_, i) => (
                                    <button key={i}
                                        onClick={() => { setHeroIdx(i); resetTimer(); }}
                                        aria-label={`Slide ${i + 1}`}
                                        className={`h-1.5 rounded-full border-none cursor-pointer p-0
                                                    transition-all duration-300
                                                    ${i === heroIdx
                                                ? "w-6 bg-orange-500"
                                                : "w-1.5 bg-neutral-300 hover:bg-neutral-400"}`} />
                                ))}
                            </div>

                            {/* ── Slide counter — top right ── */}
                            <div className="absolute top-4 right-4 z-20
                                            bg-white/70 backdrop-blur-sm
                                            border border-neutral-200/60
                                            text-[10px] font-bold text-neutral-500
                                            px-2.5 py-1 rounded-full hidden sm:block">
                                {heroIdx + 1} / {slides.length}
                            </div>
                        </>
                    )}

                    {/* ── Progress bar at the bottom ── */}
                    {slides.length > 1 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-100 z-20">
                            <div
                                key={heroIdx}
                                className="h-full bg-gradient-to-r from-orange-400 to-rose-500 rounded-full"
                                style={{
                                    animation: "progressBar 5.5s linear forwards",
                                }} />
                        </div>
                    )}
                </div>

            ) : !loading && (
                /* ── Fallback hero when no banners ── */
                <div className="w-full relative overflow-hidden
                                min-h-[260px] sm:min-h-[380px]
                                bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50
                                flex items-center">
                    {/* Blobs */}
                    <div className="absolute top-0 right-0 w-80 h-80 rounded-full
                                    bg-gradient-to-br from-orange-200/40 to-rose-200/30
                                    blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full
                                    bg-violet-200/25 blur-3xl pointer-events-none" />

                    <div className={`${C} py-14 relative z-10 w-full`}>
                        <div className="max-w-[540px]">
                            {/* Eyebrow */}
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                                            bg-orange-100 border border-orange-200
                                            text-[10px] font-extrabold text-orange-600 tracking-widest uppercase mb-5">
                                <FaStar size={8} className="text-orange-500 animate-pulse" />
                                Premium Shopping
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black
                                           text-neutral-900 leading-tight tracking-tight mb-4">
                                Welcome to{" "}
                                <span className="bg-gradient-to-r from-orange-500 to-rose-500
                                                 bg-clip-text text-transparent">
                                    Urbexon
                                </span>
                            </h1>
                            <p className="text-sm sm:text-base text-neutral-500 mb-8 leading-relaxed max-w-[440px]">
                                Premium products · Fast delivery · Secure checkout.
                                Shop from thousands of verified sellers.
                            </p>
                            <div className="flex gap-3 flex-wrap">
                                <button onClick={() => navigate("/deals")}
                                    className="inline-flex items-center gap-2 px-6 py-3
                                               bg-gradient-to-r from-orange-500 to-rose-500
                                               text-white rounded-xl text-sm font-bold cursor-pointer
                                               shadow-[0_4px_20px_rgba(249,115,22,0.35)]
                                               hover:-translate-y-0.5 hover:shadow-[0_6px_28px_rgba(249,115,22,0.45)]
                                               transition-all duration-200">
                                    Explore deals <FaArrowRight size={12} />
                                </button>
                                <button onClick={() => navigate("/products")}
                                    className="inline-flex items-center gap-2 px-5 py-3
                                               bg-white border border-neutral-200
                                               text-neutral-700 rounded-xl text-sm font-semibold cursor-pointer
                                               hover:border-neutral-300 hover:-translate-y-0.5
                                               transition-all duration-200 shadow-sm hover:shadow-md">
                                    Browse all
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ URBEXON HOUR — Full Premium Section ━━ */}
            <div className="w-full relative overflow-hidden bg-gradient-to-br from-[#f5f0ff] via-[#fdf4ff] to-[#fff0f7] border-y border-violet-100">

                {/* ── Background decoration ── */}
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-violet-200/30 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-fuchsia-200/25 blur-3xl pointer-events-none" />
                <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-pink-200/20 blur-2xl pointer-events-none" />

                {/* ── Top animated accent line ── */}
                <div className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{
                        background: "linear-gradient(90deg,#7c3aed,#a855f7,#ec4899,#f97316,#a855f7,#7c3aed)",
                        backgroundSize: "300% 100%",
                        animation: "gradientShift 4s linear infinite",
                    }} />

                <div className={`${C} py-6 sm:py-7`}>
                    <div
                        onClick={() => navigate("/urbexon-hour")}
                        className="group/uh cursor-pointer"
                    >
                        {/* ════ Main card ════ */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">

                            {/* ── LEFT: Brand identity block ── */}
                            <div className="flex flex-col items-center sm:items-start gap-3 flex-shrink-0">

                                {/* Logo mark */}
                                <div className="relative">
                                    {/* Outer glow ring */}
                                    <div className="absolute inset-0 rounded-[20px] scale-110
                                                    bg-gradient-to-br from-violet-400 to-fuchsia-500
                                                    opacity-25 blur-md
                                                    group-hover/uh:opacity-40 group-hover/uh:scale-125
                                                    transition-all duration-500" />
                                    {/* Ping ring */}
                                    <div className="absolute inset-0 rounded-[20px]
                                                    bg-gradient-to-br from-violet-400 to-fuchsia-500
                                                    opacity-30
                                                    animate-[ping_2.5s_ease-in-out_infinite]" />
                                    {/* Main icon box */}
                                    <div className="relative w-[72px] h-[72px] rounded-[20px]
                                                    bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600
                                                    flex flex-col items-center justify-center gap-0.5
                                                    shadow-[0_8px_28px_rgba(124,58,237,0.45)]
                                                    group-hover/uh:shadow-[0_12px_36px_rgba(124,58,237,0.55)]
                                                    group-hover/uh:-translate-y-0.5
                                                    transition-all duration-300">
                                        <FaBolt size={26} className="text-white drop-shadow" />
                                        <span className="text-[8px] text-white/70 font-black tracking-[0.2em] uppercase leading-none">HOUR</span>
                                    </div>
                                </div>

                                {/* Brand name */}
                                <div className="text-center sm:text-left">
                                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                                        <span className="text-[22px] font-black tracking-tight text-neutral-900 leading-none">
                                            Urbexon
                                        </span>
                                        <span className="text-[22px] font-black tracking-tight leading-none"
                                            style={{
                                                background: "linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)",
                                                WebkitBackgroundClip: "text",
                                                WebkitTextFillColor: "transparent",
                                                backgroundClip: "text",
                                            }}>
                                            Hour
                                        </span>
                                        {/* Live badge */}
                                        <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full
                                                         bg-gradient-to-r from-violet-600 to-fuchsia-600
                                                         text-white text-[8px] font-black tracking-widest uppercase shadow-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-[pulse_1s_ease-in-out_infinite]" />
                                            LIVE
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-500 mt-1 font-medium">
                                        Quick commerce · Hyperlocal delivery
                                    </p>
                                </div>
                            </div>

                            {/* ── CENTER: Headline + features ── */}
                            <div className="flex-1 min-w-0">
                                {/* Tagline */}
                                <div className="mb-3.5">
                                    <h3 className="text-[15px] sm:text-[17px] font-extrabold text-neutral-900 leading-snug tracking-tight mb-1">
                                        Groceries & essentials at your door
                                        <span className="block text-sm font-semibold mt-0.5"
                                            style={{
                                                background: "linear-gradient(90deg,#7c3aed,#ec4899)",
                                                WebkitBackgroundClip: "text",
                                                WebkitTextFillColor: "transparent",
                                                backgroundClip: "text",
                                            }}>
                                            in just 45 minutes ⚡
                                        </span>
                                    </h3>
                                </div>

                                {/* Feature chips row */}
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { icon: "⚡", text: "45-min delivery", bg: "bg-violet-50", border: "border-violet-200", color: "text-violet-700" },
                                        { icon: "🛒", text: "Fresh groceries", bg: "bg-fuchsia-50", border: "border-fuchsia-200", color: "text-fuchsia-700" },
                                        { icon: "📍", text: "Hyperlocal network", bg: "bg-pink-50", border: "border-pink-200", color: "text-pink-700" },
                                        { icon: "✅", text: "Quality assured", bg: "bg-purple-50", border: "border-purple-200", color: "text-purple-700" },
                                    ].map(({ icon, text, bg, border, color }) => (
                                        <span key={text}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl
                                                        ${bg} border ${border} ${color}
                                                        text-[11px] font-semibold whitespace-nowrap
                                                        shadow-sm hover:shadow transition-shadow`}>
                                            <span className="text-sm leading-none">{icon}</span>
                                            {text}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* ── RIGHT: CTA block ── */}
                            <div className="flex-shrink-0 flex flex-col items-center sm:items-end gap-2.5">
                                {/* Delivery time badge */}
                                <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl
                                                bg-white border border-violet-200
                                                shadow-[0_2px_12px_rgba(124,58,237,0.12)]">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600
                                                    flex items-center justify-center flex-shrink-0">
                                        <FaBolt size={13} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="text-[18px] font-black text-violet-700 leading-none tabular-nums">45<span className="text-[12px] font-bold text-violet-500"> min</span></div>
                                        <div className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wide leading-none mt-0.5">avg delivery</div>
                                    </div>
                                </div>

                                {/* CTA button */}
                                <button
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                                               bg-gradient-to-r from-violet-600 to-fuchsia-600
                                               text-white text-[12px] font-bold
                                               shadow-[0_4px_16px_rgba(124,58,237,0.4)]
                                               group-hover/uh:shadow-[0_6px_22px_rgba(124,58,237,0.5)]
                                               group-hover/uh:-translate-y-0.5
                                               transition-all duration-250"
                                >
                                    Order Now
                                    <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center
                                                    group-hover/uh:translate-x-0.5 transition-transform duration-200">
                                        <FaArrowRight size={9} className="text-white" />
                                    </div>
                                </button>

                                <p className="text-[10px] text-neutral-400 font-medium">
                                    📍 Available in your area
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
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
                <section className="bg-white border-t border-neutral-100 py-7">
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
                <section className="bg-neutral-50 border-t border-neutral-100 py-7">
                    <div className={C}>
                        <SecHead eyebrow="Just in" title="New Arrivals"
                            sub="Fresh drops and latest collections"
                            to="/products?sort=newest" label="See all" />
                        <HScrollRow products={newArrivals} loading={loading} skCount={6} />
                    </div>
                </section>
            )}

            {ecRecent.length > 0 && (
                <section className="bg-white border-t border-neutral-100 py-7">
                    <div className={C}>
                        <SecHead eyebrow="Your history" title="Recently Viewed"
                            sub="Continue where you left off" />
                        <HScrollRow products={ecRecent.slice(0, 12)} loading={false} />
                    </div>
                </section>
            )}

            {forYouProducts.length > 0 && (
                <section className="bg-neutral-50 border-t border-neutral-100 py-7">
                    <div className={C}>
                        <SecHead eyebrow="Picked for you" title={`Similar to "${forYouTerm}"`}
                            sub="Based on your recent searches"
                            to={`/?search=${encodeURIComponent(forYouTerm)}`} label="See all" />
                        <HScrollRow products={forYouProducts} loading={false} />
                    </div>
                </section>
            )}

            <section className="bg-white border-t border-neutral-100 py-7">
                <div className={C}>
                    <div className="text-center mb-5">
                        <span className="inline-block px-0 pb-1.5 border-b-2 border-orange-500
                                         text-[10px] font-bold tracking-widest uppercase text-orange-500">
                            Our promise
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
                                           hover:-translate-y-1.5 hover:shadow-xl hover:border-transparent
                                           transition-all duration-200 cursor-default">
                                <div className={`w-10 h-10 ${iconBg} rounded-[12px] flex items-center justify-center mx-auto mb-2.5`}>
                                    <Icon size={18} className={iconColor} />
                                </div>
                                <p className="text-sm font-bold text-neutral-900 mb-1 tracking-tight">{label}</p>
                                <p className="text-xs text-neutral-400 leading-relaxed">{sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ━━ NEWSLETTER ━━ */}
            <section className="relative overflow-hidden border-t border-neutral-100 pt-10 pb-16 sm:pb-10">
                {/* Vibrant gradient background — replaced dark neutral-900 */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-rose-500 to-violet-600" />
                {/* Texture blobs */}
                <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-black/10 blur-3xl pointer-events-none" />

                <div className={`${C} relative z-10`}>
                    <div className="max-w-[460px] mx-auto text-center">
                        <span className="inline-block pl-2.5 border-l-[3px] border-white/50
                                         text-[10px] font-bold tracking-widest uppercase text-white/70 mb-3 leading-none">
                            Newsletter
                        </span>
                        <h3 className="text-[clamp(26px,4vw,34px)] font-black text-white tracking-tight mb-3">
                            Stay in the Loop
                        </h3>
                        <p className="text-sm text-white/75 leading-relaxed mb-8">
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
                                    className="px-5 py-3.5 bg-white hover:bg-neutral-50
                                               text-orange-600 text-sm font-bold border-none cursor-pointer
                                               whitespace-nowrap disabled:opacity-60 transition-colors">
                                    {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                                </button>
                            </form>
                        )}
                        {nlStatus === "error" && (
                            <p className="text-white/70 text-xs mt-2.5 bg-white/10 rounded-lg py-1.5 px-3">
                                Something went wrong. Please try again.
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* Progress bar keyframe */}
            <style>{`
                @keyframes progressBar {
                    from { width: 0%; }
                    to   { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default Home;