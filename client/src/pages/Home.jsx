/**
 * Home.jsx — Urbexon v4 · "Signal" redesign
 * ─ Styled entirely with the Signal design-system tokens (tokens.css):
 *   graphite neutrals, indigo brand accent, amber reserved for Urbexon Hour.
 * ─ Editorial hero with a single scrim, solid CTAs, and trust badges —
 *   no gradient blobs, gradient text, or emoji chips.
 * ─ Sections share one rhythm (py-6/8), SecHead, CardWrap, and a
 *   fade-up <Reveal> on scroll (respects prefers-reduced-motion globally).
 * ─ All business logic 100% preserved — presentation-only changes.
 * ─ The category browser strip lives in the Navbar (single source of
 *   category navigation instead of duplicating it below the hero).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import * as productApi from "../api/productApi";
import { fetchActiveBanners } from "../api/bannerApi";
import { subscribeNewsletter } from "../api/contactApi";
import ProductCard from "../components/ProductCard";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import {
    FaArrowRight, FaBolt, FaChevronLeft, FaChevronRight,
    FaSearch, FaStore, FaThLarge, FaTag, FaLayerGroup,
    FaShippingFast, FaLock, FaMedal, FaHeadset,
} from "react-icons/fa";
import { fetchCollections } from "../api/collectionApi";
import { imgUrl, imgSrcSet } from "../utils/imageUrl";

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
    { Icon: FaShippingFast, label: "Free Delivery", sub: "On all orders above ₹499", iconBg: "bg-accent-tint", iconColor: "text-accent" },
    { Icon: FaLock, label: "Secure Checkout", sub: "100% encrypted payments", iconBg: "bg-success-tint", iconColor: "text-success" },
    { Icon: FaMedal, label: "Trusted Sellers", sub: "Verified & authentic products", iconBg: "bg-warning-tint", iconColor: "text-[var(--color-warning-700)]" },
    { Icon: FaBolt, label: "Fast Delivery", sub: "Urbexon Hour in 45 minutes", iconBg: "bg-hour-tint", iconColor: "text-[var(--accent-hour-hover)]" },
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
    <div className="flex flex-col bg-white rounded-xl border border-[var(--color-graphite-100)] overflow-hidden
                    w-full h-full shadow-[var(--shadow-xs)] transition-all duration-200
                    hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-default">
        {children}
    </div>
);

/* ─── FADE-UP SECTION REVEAL — presentational only ─── */
const Reveal = ({ children, className = "" }) => {
    const ref = useRef(null);
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === "undefined") { setShown(true); return; }
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) { setShown(true); io.disconnect(); }
        }, { rootMargin: "0px 0px -48px 0px", threshold: 0.05 });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={ref}
            className={`${className} transition-[opacity,transform] duration-500 ease-out will-change-transform
                        ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
            {children}
        </div>
    );
};

/* ─── SKELETON CARD ─── */
const SkCard = () => (
    <CardWrap>
        <div className="w-full aspect-[4/3] bg-[var(--color-graphite-100)] animate-pulse" />
        <div className="p-3 flex flex-col gap-2 flex-1">
            <div className="h-2.5 w-2/5 bg-[var(--color-graphite-100)] rounded-full animate-pulse" />
            <div className="h-3   w-4/5 bg-[var(--color-graphite-100)] rounded-full animate-pulse" />
            <div className="h-2.5 w-3/5 bg-[var(--color-graphite-100)] rounded-full animate-pulse" />
            <div className="mt-auto pt-2 flex flex-col gap-2">
                <div className="h-3 w-2/5 bg-[var(--color-graphite-100)] rounded-full animate-pulse" />
                <div className="h-8 w-full bg-[var(--color-graphite-100)] rounded-lg  animate-pulse" />
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
    <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div className="flex-1">
            {eyebrow && (
                <span className="inline-block pl-2.5 border-l-2 border-[var(--accent-primary)]
                                 text-[10px] font-bold tracking-[0.14em] uppercase text-accent
                                 mb-2 leading-none">
                    {eyebrow}
                </span>
            )}
            <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight leading-tight
                           flex items-center gap-2.5 m-0">
                {icon && icon}
                {title}
            </h2>
            {sub && <p className="text-[13px] text-muted mt-1.5 font-normal">{sub}</p>}
        </div>
        {to && (
            <Link to={to}
                className="group inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg
                           border border-default bg-white text-xs font-semibold text-secondary
                           no-underline whitespace-nowrap
                           hover:border-strong hover:text-primary transition-colors duration-200">
                {label}
                <FaArrowRight size={9} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
        )}
    </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PRODUCT GRID — 2→3→4→5 cols
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PGrid = ({ products = [], loading, skCount = 10 }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {loading
            ? Array(skCount).fill(0).map((_, i) => <SkCard key={i} />)
            : products.map(p => (
                /* ProductCard is its own card shell now — wrapping it in
                   CardWrap doubled the border/shadow/hover. */
                <ProductCard key={p._id || p.id} product={p} hideActions />
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
                           w-9 h-9 rounded-full bg-white border border-strong shadow-md
                           items-center justify-center text-secondary hover:text-primary
                           transition-all duration-150 hidden md:flex
                           opacity-0 group-hover/hrow:opacity-100 -translate-x-1/2">
                <FaChevronLeft size={11} />
            </button>
            <button onClick={() => scroll(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                           w-9 h-9 rounded-full bg-white border border-strong shadow-md
                           items-center justify-center text-secondary hover:text-primary
                           transition-all duration-150 hidden md:flex
                           opacity-0 group-hover/hrow:opacity-100 translate-x-1/2">
                <FaChevronRight size={11} />
            </button>
            <div ref={rowRef}
                className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 pt-0.5
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
                            <ProductCard product={p} hideActions />
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
        productApi.getProducts(`?sort=${sort}&productType=ecommerce&limit=${PAGE_SIZE}&page=1`)
            .then(r => { if (cancelled) return; const l = r.data?.products || []; setProducts(l); setHasMore(l.length === PAGE_SIZE); })
            .catch(() => { }).finally(() => { if (!cancelled) { setLoading(false); setIsSorting(false); } });
        return () => { cancelled = true; };
    }, [sort]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const next = page + 1;
        try {
            const r = await productApi.getProducts(`?sort=${sort}&productType=ecommerce&limit=${PAGE_SIZE}&page=${next}`);
            const l = r.data?.products || [];
            setProducts(prev => [...prev, ...l]); setPage(next); setHasMore(l.length === PAGE_SIZE);
        } catch { /* load-more failed — loadingMore reset in finally; user can retry via scroll/button */ } finally { setLoadingMore(false); }
    }, [sort, page, loadingMore, hasMore]);

    return (
        <section className="bg-canvas border-t border-[var(--color-graphite-100)] py-6 sm:py-8">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
                <SecHead eyebrow="Catalog" title="All Products" sub="Browse our complete collection"
                    to="/products" label="Full catalog"
                    icon={<FaThLarge size={15} className="text-accent" />} />
                <div className="flex gap-2 flex-wrap mb-6">
                    {ALL_SORT_OPTIONS.map(o => (
                        <button key={o.key} onClick={() => setSort(o.key)}
                            className={`h-8 px-4 rounded-full text-xs font-semibold border transition-colors duration-200 whitespace-nowrap
                                ${sort === o.key
                                    ? "bg-[var(--color-graphite-900)] border-[var(--color-graphite-900)] text-white"
                                    : "bg-white border-default text-secondary hover:border-strong hover:text-primary"}`}>
                            {o.label}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    {isSorting && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10
                                        flex items-center justify-center rounded-xl">
                            <div className="w-6 h-6 rounded-full border-2 border-strong border-t-[var(--color-graphite-900)] animate-spin" />
                        </div>
                    )}
                    {loading ? <PGrid loading skCount={PAGE_SIZE} />
                        : products.length > 0 ? <PGrid products={products} />
                            : (
                                <div className="flex flex-col items-center py-14 text-center">
                                    <FaStore size={36} className="text-[var(--color-graphite-200)] mb-3" />
                                    <p className="font-bold text-muted">No products found</p>
                                </div>
                            )
                    }
                </div>
                {!loading && hasMore && (
                    <div className="flex justify-center mt-8">
                        <button onClick={loadMore} disabled={loadingMore}
                            className="inline-flex items-center gap-2 h-11 px-8
                                       border border-[var(--color-graphite-900)] rounded-xl
                                       bg-white text-primary text-sm font-semibold
                                       hover:bg-[var(--color-graphite-900)] hover:text-white
                                       disabled:opacity-50 transition-colors duration-200">
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

/* ─── COLLECTIONS SECTION ───
   BUG FIX: the Collection Engine (admin creates/edits collections with
   rules, image, SEO — see AdminCollections.jsx) has always had its own
   dedicated pages (/collections, /collections/:slug), but nothing on the
   homepage ever linked to them — the only way a customer would ever see
   one was by already knowing the direct URL or clicking a Footer link.
   Every collection an admin creates was invisible on the page that
   actually gets traffic. Self-fetches (same pattern as AllProductsSection
   above) so it degrades to rendering nothing if there are no active
   collections yet, instead of needing to thread collections through the
   homepage's bulk endpoint. */
const CollectionsSection = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ctrl = new AbortController();
        fetchCollections({ signal: ctrl.signal })
            .then(({ data }) => setCollections(data?.collections || []))
            .catch((err) => { if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") setCollections([]); })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, []);

    if (!loading && collections.length === 0) return null;

    return (
        <section className="bg-white border-t border-[var(--color-graphite-100)] py-6 sm:py-8">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
                <SecHead eyebrow="Curated" title="Collections" sub="Hand-picked themes that update themselves"
                    to="/collections" label="View all"
                    icon={<FaLayerGroup size={15} className="text-accent" />} />
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                    {loading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex-shrink-0 w-[260px] sm:w-[300px] aspect-[16/9] rounded-xl bg-[var(--color-graphite-100)] animate-pulse" />
                        ))
                        : collections.map((c) => (
                            <Link key={c.slug} to={`/collections/${c.slug}`}
                                className="group no-underline flex-shrink-0 w-[260px] sm:w-[300px] relative aspect-[16/9]
                                           rounded-xl overflow-hidden bg-[var(--color-graphite-900)]
                                           shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5
                                           transition-all duration-200">
                                {c.image ? (
                                    <img src={c.image} alt={c.name} loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <FaLayerGroup size={26} className="text-white/20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,21,26,0.6)] to-transparent" />
                                <p className="absolute bottom-3 left-4 right-4 text-white font-display font-bold text-base leading-tight">
                                    {c.name}
                                </p>
                            </Link>
                        ))
                    }
                </div>
            </div>
        </section>
    );
};

/* ─── FLASH DEALS SECTION ─── */
const FlashDealsSection = ({ deals, loading, nearestDealEnd }) => {
    if (!loading && deals.length === 0) return null;
    return (
        <section className="bg-white border-t border-[var(--color-graphite-100)] py-6 sm:py-8">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
                <Reveal>
                    <SecHead eyebrow="Limited time" title="Flash Deals"
                        sub="Stock is running out — grab yours now" to="/deals" label="All deals" />
                    <div className="relative overflow-hidden bg-[var(--color-graphite-900)]
                                    rounded-2xl px-5 py-4 sm:px-6 flex items-center justify-between flex-wrap gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/10 border border-white/15
                                            rounded-xl flex items-center justify-center flex-shrink-0">
                                <FaBolt size={15} className="text-[var(--accent-hour)]" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white tracking-tight m-0">Flash sale — live now</p>
                                <p className="text-xs text-white/60 mt-0.5 m-0">Deep discounts · Limited quantities</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-white/50 uppercase tracking-[0.16em]">Ends in</span>
                            <FlashTimer endsAt={nearestDealEnd} />
                        </div>
                    </div>
                    <PGrid products={deals} loading={loading} skCount={8} />
                    {!loading && deals.length > 0 && (
                        <div className="flex justify-center mt-8">
                            <Link to="/deals"
                                className="inline-flex items-center gap-2 h-11 px-7 rounded-xl
                                           bg-[var(--color-graphite-900)] text-white text-sm font-semibold no-underline
                                           hover:bg-[var(--color-graphite-800)] transition-colors duration-200">
                                <FaTag size={11} /> View all deals <FaArrowRight size={11} />
                            </Link>
                        </div>
                    )}
                </Reveal>
            </div>
        </section>
    );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ★  HERO SLIDE COMPONENT  ★
   — Light-mode-first, vibrant gradient bg, animated
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HeroSlide = ({ slide, active, isFirst, stats, navigate }) => {
    const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";

    return (
        <div className={`absolute inset-0 transition-all duration-700 ease-in-out
                         ${active ? "opacity-100 z-10 scale-100" : "opacity-0 z-0 scale-[1.01]"}`}>

            {/* ── Background image ── */}
            <div className="absolute inset-0">
                {/* First slide is the page's LCP element — eager + high
                    priority so the browser fetches it before anything else,
                    instead of discovering it late via the default scanner
                    priority every other image gets. */}
                <img src={imgUrl.zoom(bg)} srcSet={imgSrcSet(bg, 1200)} alt={slide.title || "Banner"}
                    loading={isFirst ? "eager" : "lazy"}
                    decoding={isFirst ? "sync" : "async"}
                    fetchPriority={isFirst ? "high" : "auto"}
                    className="w-full h-full object-cover object-center saturate-[1.08] contrast-[1.03]" />
                {/* Dark scrim only where the copy sits — image stays vibrant on the right */}
                <div className="absolute inset-0
                                bg-gradient-to-r
                                from-[rgba(20,21,26,0.78)] via-[rgba(20,21,26,0.42)] to-transparent
                                sm:from-[rgba(20,21,26,0.72)] sm:via-[rgba(20,21,26,0.32)] sm:to-transparent" />
                <div className="absolute inset-0
                                bg-gradient-to-t from-[rgba(20,21,26,0.65)] via-transparent to-transparent
                                sm:hidden" />
            </div>

            {/* ── Content ── */}
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16
                            relative z-10 w-full h-full flex items-center py-10">
                <div className="max-w-[520px] flex flex-col items-start">

                    {/* Tag */}
                    {slide.tag && (
                        <div className="inline-flex items-center gap-2 mb-4
                                        text-[11px] font-bold text-white/90 tracking-[0.16em] uppercase
                                        animate-[fadeSlideDown_0.5s_ease_both]">
                            <span className="w-6 h-px bg-white/60" />
                            {slide.tag}
                        </div>
                    )}

                    {/* Headline */}
                    <h1 className="text-[clamp(28px,4.5vw,56px)] font-extrabold
                                   text-white leading-[1.06] tracking-[-0.03em]
                                   m-0 mb-3.5 [text-shadow:0_1px_2px_rgba(20,21,26,0.2)]
                                   animate-[fadeSlideUp_0.5s_ease_0.1s_both]">
                        {slide.title}
                        {slide.highlight && (
                            <span className="block text-[var(--color-indigo-300)] mt-1">
                                {slide.highlight}
                            </span>
                        )}
                    </h1>

                    {/* Subtitle */}
                    {(slide.subtitle || slide.desc || slide.description) && (
                        <p className="text-[clamp(13px,1.3vw,15px)] text-white/80
                                      leading-relaxed mb-7 max-w-[420px]
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
                            className="inline-flex items-center gap-2 h-12 px-7 rounded-xl
                                       bg-accent text-white text-sm font-bold border-none cursor-pointer
                                       shadow-[0_2px_8px_rgba(20,21,26,0.25)]
                                       hover:bg-accent-hover hover:scale-[1.02]
                                       active:scale-[0.98] transition-all duration-200">
                            {slide.buttonText || slide.cta || "Shop Now"}
                            <FaArrowRight size={11} />
                        </button>
                        {slide.secondary && (
                            <button onClick={() => navigate(slide.secondaryLink || "/deals")}
                                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl
                                           bg-white/10 backdrop-blur-sm
                                           border border-white/30 text-white text-sm font-semibold
                                           cursor-pointer hover:bg-white/20 hover:border-white/50
                                           active:scale-[0.98] transition-all duration-200">
                                {slide.secondary}
                            </button>
                        )}
                    </div>

                    {/* Trust indicators */}
                    <div className="flex items-center flex-wrap gap-x-5 gap-y-2
                                    animate-[fadeSlideUp_0.5s_ease_0.4s_both]">
                        {[
                            { Icon: FaShippingFast, v: "Free delivery", l: "on orders over ₹499" },
                            { Icon: FaLock, v: "Secure checkout", l: "100% encrypted" },
                            { Icon: FaMedal, v: stats.products ? `${stats.products.toLocaleString()}+ products` : "500+ products", l: "verified sellers" },
                        ].map(({ Icon, v, l }, i) => ( // eslint-disable-line no-unused-vars -- Icon rendered as <Icon/>
                            <div key={v} className="flex items-center gap-2.5">
                                {i > 0 && <span className="hidden sm:block w-px h-6 bg-white/20 mr-2.5" />}
                                <span className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20
                                                 flex items-center justify-center flex-shrink-0">
                                    <Icon size={12} className="text-white" />
                                </span>
                                <div>
                                    <div className="text-[12px] font-bold text-white leading-none">{v}</div>
                                    <div className="text-[10px] text-white/70 font-medium mt-1 leading-none whitespace-nowrap">{l}</div>
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
    <div className="w-full bg-white border-b border-[var(--color-graphite-100)]
                    h-[260px] sm:h-[360px] md:h-[440px] lg:h-[500px]
                    flex items-center relative overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 w-full">
            <div className="max-w-[520px] flex flex-col gap-4 animate-pulse">
                <div className="h-3 w-24 bg-[var(--color-graphite-100)] rounded-full" />
                <div className="h-10 sm:h-14 w-full bg-[var(--color-graphite-100)] rounded-xl" />
                <div className="h-8 sm:h-10 w-3/4 bg-[var(--color-graphite-100)] rounded-xl" />
                <div className="h-4 w-1/2 bg-[var(--color-graphite-100)] rounded-lg" />
                <div className="flex gap-3 mt-2">
                    <div className="h-12 w-36 bg-[var(--color-graphite-100)] rounded-lg" />
                    <div className="h-12 w-28 bg-[var(--color-graphite-100)] rounded-lg" />
                </div>
            </div>
        </div>
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

    /* Fetch homepage (banners + featured/new/deals) — categories handled by useCategories */
    useEffect(() => {
        if (_homeCache && Date.now() - _homeCache._ts < CACHE_TTL) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [bannersRes, homeRes] = await Promise.allSettled([
                    fetchActiveBanners(),
                    productApi.getHomepageProducts(),
                ]);
                if (cancelled) return;
                const cache = { _ts: Date.now() };
                if (bannersRes.status === "fulfilled" && bannersRes.value?.data?.length) {
                    const s = bannersRes.value.data.filter(b =>
                        b.type !== "urbexon_hour" && b.category !== "urbexon_hour" && !b.isUrbexonHour && b.placement !== "urbexon_hour"
                    );
                    setSlides(s); cache.slides = s;
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
        productApi.getProducts(`?search=${encodeURIComponent(term)}&productType=ecommerce&limit=8`)
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
        productApi.getProducts(`?search=${encodeURIComponent(searchQuery)}&productType=ecommerce&limit=24`, { signal: ctrl.signal })
            .then(r => setSearchResults(r.data?.products || [])).catch(() => { }).finally(() => setSearching(false));
        return () => ctrl.abort();
    }, [searchQuery]);

    /* Newsletter */
    const handleNL = async e => {
        e.preventDefault(); if (!nlEmail.trim()) return;
        setNlStatus("sending");
        try { await subscribeNewsletter({ email: nlEmail.trim() }); setNlEmail(""); setNlStatus("done"); }
        catch { setNlStatus("error"); }
    };

    const C = "max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16";

    /* ── SEARCH VIEW ── */
    if (searchQuery.trim()) return (
        <div className="bg-canvas min-h-screen">
            <div className={`${C} pt-10 pb-20`}>
                <span className="inline-block pl-2.5 border-l-[3px] border-[var(--accent-primary)]
                                 text-[10px] font-bold tracking-widest uppercase text-accent mb-2 leading-none">
                    Search
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight mt-1.5">
                    Results for <em className="not-italic text-accent">"{searchQuery}"</em>
                </h1>
                <p className="text-xs text-muted mt-2 mb-8">
                    {searching ? "Searching…" : `${searchResults.length} product${searchResults.length !== 1 ? "s" : ""} found`}
                </p>
                {searching ? <PGrid loading skCount={12} />
                    : searchResults.length > 0 ? <PGrid products={searchResults} />
                        : (
                            <div className="flex flex-col items-center py-24 text-center">
                                <FaSearch size={44} className="text-[var(--color-graphite-200)] mb-4" />
                                <p className="font-bold text-muted text-base">No products match "{searchQuery}"</p>
                                <p className="text-xs text-muted mt-2">Try a broader term or browse categories</p>
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
        <div className="bg-canvas overflow-x-hidden w-full">

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
                                bg-white border-b border-[var(--color-graphite-100)]
                                group">

                    {/* Slides */}
                    {slides.map((slide, i) => (
                        <HeroSlide
                            key={slide._id || i}
                            slide={slide}
                            active={i === heroIdx}
                            isFirst={i === 0}
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
                                           bg-white/15 backdrop-blur-md
                                           border border-white/25
                                           flex items-center justify-center
                                           text-white
                                           cursor-pointer transition-all duration-200
                                           hover:bg-white/30 hover:scale-105
                                           opacity-100 sm:opacity-0 group-hover:opacity-100">
                                <FaChevronLeft size={13} />
                            </button>
                            <button onClick={() => goHero(1)}
                                className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20
                                           w-9 h-9 rounded-full
                                           bg-white/15 backdrop-blur-md
                                           border border-white/25
                                           flex items-center justify-center
                                           text-white
                                           cursor-pointer transition-all duration-200
                                           hover:bg-white/30 hover:scale-105
                                           opacity-100 sm:opacity-0 group-hover:opacity-100">
                                <FaChevronRight size={13} />
                            </button>

                            {/* ── Dot indicators ── */}
                            <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-20
                                            flex gap-1.5
                                            bg-[rgba(20,21,26,0.3)] backdrop-blur-md
                                            border border-white/15
                                            px-3 py-2 rounded-full">
                                {slides.map((_, i) => (
                                    <button key={i}
                                        onClick={() => { setHeroIdx(i); resetTimer(); }}
                                        aria-label={`Slide ${i + 1}`}
                                        className={`h-1.5 rounded-full border-none cursor-pointer p-0
                                                    transition-all duration-300
                                                    ${i === heroIdx
                                                ? "w-6 bg-white"
                                                : "w-1.5 bg-white/40 hover:bg-white/60"}`} />
                                ))}
                            </div>

                            {/* ── Slide counter — top right ── */}
                            <div className="absolute top-4 right-4 z-20
                                            bg-[rgba(20,21,26,0.3)] backdrop-blur-md
                                            border border-white/15
                                            text-[10px] font-bold text-white/90
                                            px-2.5 py-1 rounded-full hidden sm:block">
                                {heroIdx + 1} / {slides.length}
                            </div>
                        </>
                    )}

                    {/* ── Progress bar at the bottom ── */}
                    {slides.length > 1 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20 z-20">
                            <div
                                key={heroIdx}
                                className="h-full bg-accent"
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
                                bg-white border-b border-[var(--color-graphite-100)]
                                flex items-center">
                    <div className={`${C} py-14 relative z-10 w-full`}>
                        <div className="max-w-[560px]">
                            {/* Eyebrow */}
                            <div className="inline-flex items-center gap-2 mb-5
                                            text-[11px] font-bold text-accent tracking-[0.16em] uppercase">
                                <span className="w-6 h-px bg-[var(--accent-primary)]" />
                                Premium Shopping
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold
                                           text-primary leading-[1.08] tracking-[-0.03em] mb-4">
                                Everything you love,
                                <span className="block text-accent mt-1">delivered by Urbexon</span>
                            </h1>
                            <p className="text-sm sm:text-base text-secondary mb-8 leading-relaxed max-w-[440px]">
                                Premium products from verified sellers — fast delivery,
                                secure checkout, and service you can count on.
                            </p>
                            <div className="flex gap-3 flex-wrap">
                                <button onClick={() => navigate("/deals")}
                                    className="inline-flex items-center gap-2 h-12 px-7
                                               bg-accent text-white rounded-xl text-sm font-bold cursor-pointer
                                               shadow-[0_2px_8px_rgba(20,21,26,0.15)]
                                               hover:bg-accent-hover hover:scale-[1.02]
                                               active:scale-[0.98] transition-all duration-200">
                                    Explore deals <FaArrowRight size={12} />
                                </button>
                                <button onClick={() => navigate("/products")}
                                    className="inline-flex items-center gap-2 h-12 px-6
                                               bg-white border border-strong
                                               text-primary rounded-xl text-sm font-semibold cursor-pointer
                                               hover:border-[var(--color-graphite-400)]
                                               active:scale-[0.98] transition-all duration-200">
                                    Browse all
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ URBEXON HOUR — delivery promise banner ━━ */}
            <section className="bg-canvas py-5 sm:py-6">
                <div className={C}>
                    <Reveal>
                        <div
                            onClick={() => navigate("/urbexon-hour")}
                            className="group/uh cursor-pointer relative overflow-hidden
                                       bg-white border border-[var(--color-graphite-100)] rounded-2xl
                                       shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)]
                                       transition-shadow duration-300"
                        >
                            {/* Amber brand edge — the one place amber leads */}
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-hour" aria-hidden="true" />

                            <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8 p-6 sm:p-8">

                                {/* ── Brand block ── */}
                                <div className="flex items-center gap-4 flex-shrink-0 md:w-[240px]">
                                    <div className="w-14 h-14 rounded-2xl bg-hour-tint
                                                    flex items-center justify-center flex-shrink-0
                                                    transition-transform duration-300 group-hover/uh:scale-[1.04]">
                                        <FaBolt size={22} className="text-[var(--accent-hour-hover)]" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-extrabold tracking-tight text-primary leading-none whitespace-nowrap">
                                                Urbexon <span className="text-[var(--accent-hour-hover)]">Hour</span>
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded
                                                             bg-hour-tint text-[var(--accent-hour-hover)]
                                                             text-[8px] font-extrabold tracking-widest uppercase">
                                                <span className="w-1 h-1 rounded-full bg-[var(--accent-hour)]" />
                                                Live
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted mt-1.5 font-medium">
                                            Quick commerce · Hyperlocal
                                        </p>
                                    </div>
                                </div>

                                {/* ── Promise ── */}
                                <div className="flex-1 min-w-0 md:border-l md:border-[var(--color-graphite-100)] md:pl-8">
                                    <h3 className="text-[15px] sm:text-[17px] font-bold text-primary leading-snug tracking-tight m-0">
                                        Groceries &amp; essentials, delivered in
                                        <span className="text-[var(--accent-hour-hover)]"> 45 minutes</span>
                                    </h3>
                                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
                                        {[
                                            { Icon: FaShippingFast, text: "45-min delivery" },
                                            { Icon: FaStore, text: "Fresh, local stock" },
                                            { Icon: FaMedal, text: "Quality assured" },
                                        ].map(({ Icon, text }) => ( // eslint-disable-line no-unused-vars -- Icon rendered as <Icon/>
                                            <span key={text} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-secondary">
                                                <Icon size={11} className="text-[var(--accent-hour)]" />
                                                {text}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* ── CTA ── */}
                                <div className="flex-shrink-0 flex items-center gap-5">
                                    <div className="hidden sm:block text-right">
                                        <div className="text-[22px] font-extrabold text-primary leading-none tabular-nums">
                                            45<span className="text-[13px] font-bold text-muted"> min</span>
                                        </div>
                                        <div className="text-[9px] text-muted font-semibold uppercase tracking-[0.12em] mt-1">avg delivery</div>
                                    </div>
                                    <button
                                        className="inline-flex items-center gap-2 h-11 px-6 rounded-xl
                                                   bg-hour-hover text-white text-[13px] font-bold border-none cursor-pointer
                                                   shadow-[0_2px_8px_rgba(217,138,31,0.25)]
                                                   group-hover/uh:shadow-[0_4px_14px_rgba(217,138,31,0.3)]
                                                   transition-shadow duration-200"
                                    >
                                        Order now
                                        <FaArrowRight size={10} className="transition-transform duration-200 group-hover/uh:translate-x-0.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ━━ FLASH DEALS ━━ */}
            <FlashDealsSection deals={deals} loading={loading} nearestDealEnd={nearestDealEnd} />

            {/* ━━ TRENDING ━━ */}
            {(loading || featured.length > 0) && (
                <section className="bg-white border-t border-[var(--color-graphite-100)] py-6 sm:py-8">
                    <div className={C}>
                        <Reveal>
                            <SecHead eyebrow="Popular" title="Trending Now" sub="Most-loved products this week"
                                to="/products?sort=rating" label="See all" />
                            <PGrid products={featured} loading={loading} skCount={8} />
                        </Reveal>
                    </div>
                </section>
            )}

            {/* ━━ COLLECTIONS ━━ */}
            <CollectionsSection />

            {/* ━━ ALL PRODUCTS ━━ */}
            <AllProductsSection />

            {/* ━━ NEW ARRIVALS ━━ */}
            {(loading || newArrivals.length > 0) && (
                <section className="bg-canvas border-t border-[var(--color-graphite-100)] py-6 sm:py-8">
                    <div className={C}>
                        <Reveal>
                            <SecHead eyebrow="Just in" title="New Arrivals"
                                sub="Fresh drops and latest collections"
                                to="/products?sort=newest" label="See all" />
                            <HScrollRow products={newArrivals} loading={loading} skCount={6} />
                        </Reveal>
                    </div>
                </section>
            )}

            {ecRecent.length > 0 && (
                <section className="bg-white border-t border-[var(--color-graphite-100)] py-6 sm:py-8">
                    <div className={C}>
                        <Reveal>
                            <SecHead eyebrow="Your history" title="Recently Viewed"
                                sub="Continue where you left off" />
                            <HScrollRow products={ecRecent.slice(0, 12)} loading={false} />
                        </Reveal>
                    </div>
                </section>
            )}

            {forYouProducts.length > 0 && (
                <section className="bg-canvas border-t border-[var(--color-graphite-100)] py-6 sm:py-8">
                    <div className={C}>
                        <Reveal>
                            <SecHead eyebrow="Picked for you" title={`Similar to "${forYouTerm}"`}
                                sub="Based on your recent searches"
                                to={`/?search=${encodeURIComponent(forYouTerm)}`} label="See all" />
                            <HScrollRow products={forYouProducts} loading={false} />
                        </Reveal>
                    </div>
                </section>
            )}

            <section className="bg-white border-t border-[var(--color-graphite-100)] py-6 sm:py-8">
                <div className={C}>
                    <Reveal>
                        <div className="text-center mb-8">
                            <span className="inline-block text-[10px] font-bold tracking-[0.16em] uppercase text-accent">
                                Our promise
                            </span>
                            <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight mt-2.5">
                                Why Choose Urbexon?
                            </h2>
                            <p className="text-[13px] text-muted mt-1.5">Your trusted partner for premium shopping</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                            {WHY.map(({ Icon, label, sub, iconBg, iconColor }) => ( // eslint-disable-line no-unused-vars -- Icon is rendered as <Icon/> below; false positive without eslint-plugin-react's jsx-uses-vars
                                <div key={label}
                                    className="bg-white border border-[var(--color-graphite-100)] rounded-xl p-5 sm:p-6 text-center
                                               shadow-[var(--shadow-xs)]
                                               hover:scale-[1.02] hover:shadow-[var(--shadow-md)]
                                               transition-all duration-200 cursor-default">
                                    <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                                        <Icon size={17} className={iconColor} />
                                    </div>
                                    <p className="text-sm font-bold text-primary mb-1 tracking-tight">{label}</p>
                                    <p className="text-xs text-muted leading-relaxed">{sub}</p>
                                </div>
                            ))}
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ━━ NEWSLETTER ━━ */}
            <section className="relative overflow-hidden border-t border-[var(--color-graphite-100)] bg-[var(--color-graphite-950)] pt-10 pb-16 sm:py-12">
                <div className={`${C} relative z-10`}>
                    <Reveal>
                        <div className="max-w-[460px] mx-auto text-center">
                            <span className="inline-block text-[10px] font-bold tracking-[0.16em] uppercase text-white/50 mb-3 leading-none">
                                Newsletter
                            </span>
                            <h3 className="text-[clamp(24px,4vw,32px)] font-extrabold text-white tracking-tight mb-3">
                                Stay in the loop
                            </h3>
                            <p className="text-sm text-white/60 leading-relaxed mb-8">
                                Exclusive deals, new arrivals, and special offers — straight to your inbox.
                            </p>
                            {nlStatus === "done" ? (
                                <div className="p-4 bg-white/10 border border-white/15 rounded-xl
                                                text-white font-semibold text-sm">
                                    You're subscribed — check your inbox.
                                </div>
                            ) : (
                                <form onSubmit={handleNL}
                                    className="flex rounded-xl overflow-hidden
                                               border border-white/15 bg-white/[0.06]
                                               focus-within:border-white/30 transition-colors duration-200">
                                    <input type="email" value={nlEmail} required
                                        onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                        placeholder="your@email.com"
                                        className="flex-1 min-w-0 px-4 py-3.5 bg-transparent border-none outline-none
                                                   text-sm text-white placeholder:text-white/40" />
                                    <button type="submit" disabled={nlStatus === "sending"}
                                        className="px-6 py-3.5 bg-accent hover:bg-accent-hover
                                                   text-white text-sm font-bold border-none cursor-pointer
                                                   whitespace-nowrap disabled:opacity-60 transition-colors duration-200">
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
                    </Reveal>
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
