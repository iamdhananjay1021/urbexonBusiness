/**
 * Home.jsx — Urbexon Production Redesign
 * Aesthetic: Clean minimal white · Sharp typography · Gen Z Urbexon Hour
 * All business logic 100% preserved
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

const ALL_SORT_OPTIONS = [
    { key: "newest", label: "New Arrivals" },
    { key: "rating", label: "Top Rated" },
    { key: "price_asc", label: "Price ↑" },
    { key: "price_desc", label: "Price ↓" },
    { key: "discount", label: "Best Deals" },
];

const WHY = [
    { Icon: FaShippingFast, label: "Fast Delivery", sub: "Free shipping above ₹499", color: "#2563eb", bg: "#eff6ff" },
    { Icon: FaLock, label: "Secure Payment", sub: "100% encrypted checkout", color: "#16a34a", bg: "#f0fdf4" },
    { Icon: FaMedal, label: "Quality Products", sub: "Verified & authentic", color: "#d97706", bg: "#fffbeb" },
    { Icon: FaHeadset, label: "24/7 Support", sub: "Always here for you", color: "#7c3aed", bg: "#f5f3ff" },
];

const SEARCH_KEY = "ux_search_history";
const getHistory = () => { try { return JSON.parse(localStorage.getItem(SEARCH_KEY)) || []; } catch { return []; } };
const saveSearch = t => {
    if (!t?.trim()) return;
    const h = getHistory().filter(x => x.toLowerCase() !== t.trim().toLowerCase());
    h.unshift(t.trim());
    localStorage.setItem(SEARCH_KEY, JSON.stringify(h.slice(0, 15)));
};

/* ─── SKELETON ─── */
const SkCard = () => (
    <div style={{
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid #f0f0f0",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
    }}>
        <div className="sk-img" style={{ width: "100%", aspectRatio: "3/4", background: "#f5f5f5", animation: "pulse 1.4s ease-in-out infinite" }} />
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            {["33%", "80%", "55%"].map((w, i) => (
                <div key={i} style={{ height: i === 0 ? 10 : 12, width: w, background: "#efefef", borderRadius: 6, animation: "pulse 1.4s ease-in-out infinite" }} />
            ))}
            <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ height: 16, width: "45%", background: "#efefef", borderRadius: 6, animation: "pulse 1.4s ease-in-out infinite" }} />
                <div style={{ height: 32, background: "#efefef", borderRadius: 8, animation: "pulse 1.4s ease-in-out infinite" }} />
            </div>
        </div>
    </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {[{ v: t.h, l: "H" }, { v: t.m, l: "M" }, { v: t.s, l: "S" }].map(({ v, l }, i) => (
                <div key={l} style={{ display: "contents" }}>
                    <div style={{
                        background: "rgba(0,0,0,0.18)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 10,
                        width: 40, height: 40,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                    }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{pad(v)}</span>
                        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.55)", fontWeight: 700, marginTop: 2 }}>{l}</span>
                    </div>
                    {i < 2 && <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 900, fontSize: 18 }}>:</span>}
                </div>
            ))}
        </div>
    );
};

/* ─── SECTION HEADER ─── */
const SecHead = ({ title, sub, to, label = "View All" }) => (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div>
            <h2 style={{ fontSize: "clamp(17px,2.5vw,22px)", fontWeight: 800, color: "#0a0a0a", lineHeight: 1.2, letterSpacing: "-0.02em", margin: 0 }}>
                {title}
            </h2>
            {sub && <p style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{sub}</p>}
        </div>
        {to && (
            <Link to={to} style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 700, color: "#2563eb",
                textDecoration: "none", whiteSpace: "nowrap", paddingBottom: 2,
                letterSpacing: "0.02em",
            }}>
                {label} <FaArrowRight size={9} />
            </Link>
        )}
    </div>
);

/* ─── HORIZONTAL SCROLL ROW ─── */
const HScrollRow = ({ products = [], loading, skCount = 6 }) => {
    const rowRef = useRef(null);
    const scroll = dir => rowRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
    return (
        <div style={{ position: "relative" }} className="group-row">
            <button onClick={() => scroll(-1)} className="hscroll-btn hscroll-btn-l">
                <FaChevronLeft size={11} />
            </button>
            <button onClick={() => scroll(1)} className="hscroll-btn hscroll-btn-r">
                <FaChevronRight size={11} />
            </button>
            <div ref={rowRef} style={{
                display: "flex", gap: 12,
                overflowX: "auto", paddingBottom: 12, paddingTop: 4,
                scrollSnapType: "x mandatory", scrollBehavior: "smooth",
                msOverflowStyle: "none", scrollbarWidth: "none",
                alignItems: "stretch"
            }}>
                {loading
                    ? Array(skCount).fill(0).map((_, i) => (
                        <div key={i} style={{ width: 160, minWidth: 160, scrollSnapAlign: "start" }} className="hscroll-item">
                            <SkCard />
                        </div>
                    ))
                    : products.map(p => (
                        <div key={p._id || p.id} style={{ width: 160, minWidth: 160, scrollSnapAlign: "start" }} className="hscroll-item">
                            <ProductCard product={p} hideActions />
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

/* ─── PRODUCT GRID ─── */
const PGrid = ({ products = [], loading, skCount = 10, showActions = false }) => (
    <div className="pgrid">
        {loading
            ? Array(skCount).fill(0).map((_, i) => <SkCard key={i} />)
            : products.map(p => <ProductCard key={p._id || p.id} product={p} hideActions={!showActions} />)
        }
    </div>
);

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
        <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0" }}>
            <div className="container" style={{ paddingTop: 48, paddingBottom: 56 }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: "clamp(17px,2.5vw,22px)", fontWeight: 800, color: "#0a0a0a", letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                            <FaThLarge size={15} style={{ color: "#2563eb" }} /> All Products
                        </h2>
                        <p style={{ fontSize: 12, color: "#888", marginTop: 3 }}>Browse our complete catalog</p>
                    </div>
                    <Link to="/products" style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                        Full Catalog <FaArrowRight size={9} />
                    </Link>
                </div>

                {/* Sort pills */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
                    {ALL_SORT_OPTIONS.map(o => (
                        <button key={o.key} onClick={() => setSort(o.key)} style={{
                            padding: "7px 18px",
                            borderRadius: 100,
                            fontSize: 11, fontWeight: 700,
                            border: sort === o.key ? "1.5px solid #0a0a0a" : "1.5px solid #e5e5e5",
                            background: sort === o.key ? "#0a0a0a" : "#fff",
                            color: sort === o.key ? "#fff" : "#555",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.15s",
                            letterSpacing: "0.02em",
                        }}>
                            {o.label}
                        </button>
                    ))}
                </div>

                <div style={{ position: "relative" }}>
                    {isSorting && (
                        <div style={{
                            position: "absolute", inset: 0, background: "rgba(255,255,255,0.8)",
                            backdropFilter: "blur(4px)", zIndex: 10, display: "flex",
                            alignItems: "center", justifyContent: "center", borderRadius: 16,
                        }}>
                            <span className="spinner" style={{ borderTopColor: "#0a0a0a" }} />
                        </div>
                    )}
                    {loading ? <PGrid loading skCount={PAGE_SIZE} />
                        : products.length > 0 ? <PGrid products={products} />
                            : (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 0", color: "#ccc" }}>
                                    <FaStore size={40} style={{ marginBottom: 12, color: "#e5e5e5" }} />
                                    <div style={{ fontWeight: 700, color: "#999" }}>No products found</div>
                                </div>
                            )
                    }
                </div>

                {!loading && hasMore && (
                    <button onClick={loadMore} disabled={loadingMore} style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        width: "100%", maxWidth: 240, margin: "32px auto 0",
                        padding: "12px 28px",
                        border: "1.5px solid #0a0a0a", borderRadius: 12,
                        background: "#fff", color: "#0a0a0a",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        transition: "all 0.15s",
                        opacity: loadingMore ? 0.5 : 1,
                    }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#0a0a0a"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#0a0a0a"; }}
                    >
                        {loadingMore
                            ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: "currentColor" }} /> Loading…</>
                            : <><FaArrowRight size={11} /> Load More</>
                        }
                    </button>
                )}
            </div>
        </section>
    );
};

/* ─── FLASH DEALS SECTION ─── */
const FlashDealsSection = ({ deals, loading, nearestDealEnd }) => {
    if (!loading && deals.length === 0) return null;
    return (
        <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0" }}>
            <div className="container" style={{ paddingTop: 48, paddingBottom: 56 }}>
                <SecHead title="Lightning Deals" sub="Limited-time offers — grab before they expire" to="/deals" label="All Deals" />
                {/* Flash banner */}
                <div style={{
                    position: "relative", overflow: "hidden",
                    background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #111 100%)",
                    borderRadius: 20, padding: "20px 24px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 16, marginBottom: 24,
                    border: "1px solid #222",
                }}>
                    {/* Noise texture overlay */}
                    <div style={{
                        position: "absolute", inset: 0, borderRadius: 20,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
                        opacity: 0.6, pointerEvents: "none",
                    }} />
                    {/* Accent glow */}
                    <div style={{ position: "absolute", top: -60, right: 80, width: 200, height: 200, borderRadius: "50%", background: "rgba(239,68,68,0.12)", filter: "blur(40px)", pointerEvents: "none" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
                        <div style={{
                            width: 48, height: 48, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
                        }}>⚡</div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>Flash Sale Live!</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Massive discounts · Limited stock</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Ends in</span>
                        <FlashTimer endsAt={nearestDealEnd} />
                    </div>
                </div>
                <PGrid products={deals} loading={loading} skCount={8} />
                {!loading && deals.length > 0 && (
                    <div style={{ textAlign: "center", marginTop: 28 }}>
                        <Link to="/deals" style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "12px 28px", borderRadius: 12,
                            background: "#0a0a0a", color: "#fff",
                            fontWeight: 700, fontSize: 13, textDecoration: "none",
                            letterSpacing: "0.02em",
                            transition: "opacity 0.15s",
                        }}>
                            <FaTag size={11} /> View All Deals <FaArrowRight size={10} />
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

    /* ── SEARCH VIEW ── */
    if (searchQuery.trim()) return (
        <div style={{ background: "#f8f8f8", minHeight: "100vh" }}>
            <style>{GLOBAL_CSS}</style>
            <div className="container" style={{ paddingTop: 24, paddingBottom: 80 }}>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: "clamp(17px,3vw,22px)", fontWeight: 800, color: "#0a0a0a", letterSpacing: "-0.02em" }}>
                        Results for &ldquo;{searchQuery}&rdquo;
                    </h1>
                    <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                        {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`}
                    </p>
                </div>
                {searching ? <PGrid loading skCount={8} />
                    : searchResults.length > 0 ? <PGrid products={searchResults} />
                        : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", color: "#ccc" }}>
                                <FaSearch size={36} style={{ marginBottom: 12, color: "#e5e5e5" }} />
                                <div style={{ fontWeight: 700, color: "#999" }}>No products found</div>
                                <div style={{ fontSize: 13, marginTop: 4, color: "#bbb" }}>Try a different search term</div>
                            </div>
                        )
                }
            </div>
        </div>
    );

    /* ══ MAIN VIEW ══ */
    return (
        <div style={{ background: "#f8f8f8", overflowX: "hidden", width: "100%" }}>
            <style>{GLOBAL_CSS}</style>
            <SEO title="Premium Online Shopping" description="Shop at Urbexon for the best deals." path="/" />

            {/* ━━ HERO BANNER ━━ */}
            {loading && slides.length === 0 ? (
                <div style={{ background: "#0a0a0a", minHeight: 260 }}>
                    <div className="container" style={{ paddingTop: 64, paddingBottom: 48, display: "flex", flexDirection: "column", gap: 14 }}>
                        {["140px", "70%", "50%", "30%"].map((w, i) => (
                            <div key={i} style={{ height: i === 0 ? 14 : i === 1 ? 22 : i === 2 ? 16 : 12, width: w, background: "rgba(255,255,255,0.07)", borderRadius: 8, animation: "pulse 1.4s ease-in-out infinite" }} />
                        ))}
                    </div>
                </div>
            ) : slides.length > 0 ? (
                <div style={{ position: "relative", width: "100%", background: "#0a0a0a", overflow: "hidden" }}
                    className="hero-aspect">
                    {slides.map((slide, i) => {
                        const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";
                        return (
                            <div key={slide._id} style={{
                                position: "absolute", inset: 0, width: "100%", height: "100%",
                                opacity: i === heroIdx ? 1 : 0, zIndex: i === heroIdx ? 10 : 0,
                                transition: "opacity 0.7s ease",
                                display: "flex", alignItems: "center",
                            }}>
                                <img
                                    src={bg} alt={slide.title || "Banner"}
                                    loading={i === 0 ? "eager" : "lazy"}
                                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                                />
                                {/* Gradient: left heavy, fades right */}
                                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.05) 100%)" }} />

                                <div className="container" style={{ position: "relative", zIndex: 2, width: "100%", paddingTop: 32, paddingBottom: 32 }}>
                                    <div style={{ maxWidth: 520 }}>
                                        {slide.tag && (
                                            <div style={{
                                                display: "inline-flex", alignItems: "center", gap: 6,
                                                padding: "5px 12px", borderRadius: 100,
                                                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)",
                                                fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.9)",
                                                letterSpacing: "0.1em", textTransform: "uppercase",
                                                marginBottom: 14, backdropFilter: "blur(8px)",
                                            }}>
                                                🔥 {slide.tag}
                                            </div>
                                        )}
                                        <h1 style={{
                                            fontSize: "clamp(22px,5vw,56px)", fontWeight: 900,
                                            color: "#fff", lineHeight: 1.08, letterSpacing: "-0.03em",
                                            margin: "0 0 12px",
                                        }}>
                                            {slide.title}
                                            {slide.highlight && (
                                                <em style={{ color: "#facc15", display: "block", fontStyle: "normal" }}>{slide.highlight}</em>
                                            )}
                                        </h1>
                                        {(slide.subtitle || slide.desc || slide.description) && (
                                            <p style={{
                                                fontSize: 14, color: "rgba(255,255,255,0.65)",
                                                lineHeight: 1.6, marginBottom: 24, maxWidth: 420,
                                                display: "none",
                                            }} className="hero-desc">
                                                {slide.subtitle || slide.desc || slide.description}
                                            </p>
                                        )}
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                            <button
                                                onClick={() => {
                                                    const t = slide.link || slide.ctaLink || "/";
                                                    t.startsWith("http") ? window.open(t, "_blank", "noopener") : navigate(t);
                                                }}
                                                style={{
                                                    padding: "11px 24px", borderRadius: 12,
                                                    background: "#fff", color: "#0a0a0a",
                                                    fontSize: 13, fontWeight: 800,
                                                    border: "none", cursor: "pointer",
                                                    display: "flex", alignItems: "center", gap: 8,
                                                    letterSpacing: "-0.01em",
                                                    transition: "all 0.15s",
                                                    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = "#f0f0f0"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "translateY(0)"; }}
                                            >
                                                {slide.buttonText || slide.cta || "Shop Now"} <FaArrowRight size={11} />
                                            </button>
                                            {slide.secondary && (
                                                <button
                                                    onClick={() => navigate(slide.secondaryLink || "/deals")}
                                                    style={{
                                                        padding: "11px 22px", borderRadius: 12,
                                                        background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.25)",
                                                        color: "#fff", fontSize: 13, fontWeight: 600,
                                                        cursor: "pointer", backdropFilter: "blur(8px)",
                                                        transition: "all 0.15s",
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                                                >
                                                    {slide.secondary}
                                                </button>
                                            )}
                                        </div>
                                        {/* Stats — desktop */}
                                        <div className="hero-stats">
                                            {[
                                                { v: "Free", l: "Delivery ₹499+" },
                                                { v: stats.products ? `${stats.products.toLocaleString()}+` : "—", l: "Products" },
                                                { v: stats.categories || "—", l: "Categories" },
                                            ].map(({ v, l }) => (
                                                <div key={l} style={{
                                                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                                                    borderRadius: 12, padding: "10px 16px", backdropFilter: "blur(8px)",
                                                }}>
                                                    <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>{v}</div>
                                                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{l}</div>
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
                            <button onClick={() => goHero(-1)} className="hero-nav hero-nav-l"><FaChevronLeft size={12} /></button>
                            <button onClick={() => goHero(1)} className="hero-nav hero-nav-r"><FaChevronRight size={12} /></button>
                            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 20 }}>
                                {slides.map((_, i) => (
                                    <button key={i} onClick={() => { setHeroIdx(i); resetTimer(); }} style={{
                                        height: 4, borderRadius: 4, background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer",
                                        width: i === heroIdx ? 24 : 6, opacity: i === heroIdx ? 1 : 0.35,
                                        transition: "all 0.3s", padding: 0,
                                    }} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : !loading && (
                <div style={{
                    background: "#0a0a0a", display: "flex", alignItems: "center",
                    minHeight: 380,
                }}>
                    <div className="container" style={{ paddingTop: 64, paddingBottom: 64 }}>
                        <div style={{ maxWidth: 520 }}>
                            <h1 style={{ fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, color: "#fff", lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 16 }}>
                                Welcome to Urbexon
                                <em style={{ color: "#facc15", display: "block", fontStyle: "normal" }}>Shop the Best</em>
                            </h1>
                            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 28, lineHeight: 1.6 }}>
                                Discover amazing products from verified sellers.
                            </p>
                            <button onClick={() => navigate("/deals")} style={{
                                padding: "12px 28px", background: "#fff", color: "#0a0a0a",
                                border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800,
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                                letterSpacing: "-0.01em",
                            }}>
                                Explore Deals <FaArrowRight size={11} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ URBEXON HOUR — GEN Z STRIP ━━ */}
            <div onClick={() => navigate("/urbexon-hour")}
                style={{
                    background: "linear-gradient(90deg, #0d0d0d 0%, #0f0f0f 100%)",
                    cursor: "pointer",
                    width: "100%",
                    borderBottom: "1px solid #1a1a1a",
                    position: "relative",
                    overflow: "hidden",
                }}
                className="uh-strip"
            >
                {/* Animated accent line */}
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: "linear-gradient(90deg, #a855f7, #ec4899, #f97316, #eab308, #a855f7)",
                    backgroundSize: "300% 100%",
                    animation: "gradientShift 3s linear infinite",
                }} />
                {/* Glow blob */}
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    width: 300, height: 80,
                    background: "rgba(168,85,247,0.08)",
                    filter: "blur(40px)",
                    borderRadius: "50%",
                    pointerEvents: "none",
                }} />

                <div className="container">
                    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0" }}>
                        {/* Icon */}
                        <div style={{
                            width: 44, height: 44, borderRadius: 14,
                            background: "linear-gradient(135deg, #a855f7, #ec4899)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, boxShadow: "0 0 16px rgba(168,85,247,0.4)",
                        }}>
                            <FaBolt style={{ color: "#fff" }} size={18} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{
                                    fontSize: 15, fontWeight: 900, color: "#fff",
                                    letterSpacing: "-0.02em",
                                }}>
                                    Urbexon <span style={{
                                        background: "linear-gradient(90deg,#a855f7,#ec4899)",
                                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                        backgroundClip: "text",
                                    }}>Hour</span>
                                </span>
                                <span style={{
                                    fontSize: 9, fontWeight: 800, padding: "3px 8px",
                                    background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
                                    color: "#c084fc", borderRadius: 100, letterSpacing: "0.1em", textTransform: "uppercase",
                                }}>LIVE</span>
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                                Groceries & essentials in{" "}
                                <strong style={{ color: "#4ade80", fontWeight: 800 }}>45 min</strong>
                                {" "}· Quick commerce
                            </div>
                        </div>

                        {/* Right badges */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{
                                display: "none", fontSize: 10, fontWeight: 700,
                                padding: "5px 12px", borderRadius: 100,
                                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                                color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em",
                                textTransform: "uppercase",
                            }} className="uh-badge">
                                ⚡ Fast delivery
                            </span>
                            <FaArrowRight size={13} style={{ color: "rgba(255,255,255,0.25)" }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ━━ CATEGORIES ━━ */}
            {(loading || categories.length > 0) && (
                <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
                    <div className="container">
                        <CategoryBrowser categories={categories} />
                    </div>
                </div>
            )}

            {/* ━━ FLASH DEALS ━━ */}
            <FlashDealsSection deals={deals} loading={loading} nearestDealEnd={nearestDealEnd} />

            {/* ━━ TRENDING ━━ */}
            {(loading || featured.length > 0) && (
                <section style={{ background: "#f8f8f8", borderTop: "1px solid #f0f0f0" }}>
                    <div className="container" style={{ paddingTop: 48, paddingBottom: 48 }}>
                        <SecHead title="Trending Now" sub="Most popular right now" to="/products?sort=rating" label="See all" />
                        <PGrid products={featured} loading={loading} skCount={8} />
                    </div>
                </section>
            )}

            {/* ━━ NEW ARRIVALS ━━ */}
            {(loading || newArrivals.length > 0) && (
                <section style={{ background: "#fff" }}>
                    <div className="container" style={{ paddingTop: 48, paddingBottom: 48 }}>
                        <SecHead title="New Arrivals" sub="Fresh drops, just for you" to="/products?sort=newest" label="See all" />
                        <HScrollRow products={newArrivals} loading={loading} skCount={6} />
                    </div>
                </section>
            )}

            {/* ━━ RECENTLY VIEWED ━━ */}
            {ecRecent.length > 0 && (
                <section style={{ background: "#f8f8f8", borderTop: "1px solid #f0f0f0" }}>
                    <div className="container" style={{ paddingTop: 48, paddingBottom: 48 }}>
                        <SecHead title="Recently Viewed" sub="Continue where you left off" />
                        <HScrollRow products={ecRecent.slice(0, 12)} loading={false} />
                    </div>
                </section>
            )}

            {/* ━━ FOR YOU ━━ */}
            {forYouProducts.length > 0 && (
                <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0" }}>
                    <div className="container" style={{ paddingTop: 48, paddingBottom: 48 }}>
                        <SecHead
                            title={`Based on "${forYouTerm}"`}
                            sub="Handpicked for you"
                            to={`/?search=${encodeURIComponent(forYouTerm)}`} label="See all"
                        />
                        <HScrollRow products={forYouProducts} loading={false} />
                    </div>
                </section>
            )}

            {/* ━━ ALL PRODUCTS ━━ */}
            <AllProductsSection />

            {/* ━━ WHY CHOOSE URBEXON ━━ */}
            <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0" }}>
                <div className="container" style={{ paddingTop: 48, paddingBottom: 56 }}>
                    <div style={{ textAlign: "center", marginBottom: 32 }}>
                        <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#0a0a0a", letterSpacing: "-0.025em", margin: 0 }}>
                            Why Choose Urbexon?
                        </h2>
                        <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>Your trusted partner for online shopping</p>
                    </div>
                    <div className="why-grid">
                        {WHY.map(({ Icon, label, sub, color, bg }) => (
                            <div key={label} className="why-card" style={{ "--why-bg": bg, "--why-color": color }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14, background: bg,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    margin: "0 auto 16px",
                                }}>
                                    <Icon size={20} style={{ color }} />
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "#0a0a0a", marginBottom: 6, letterSpacing: "-0.01em" }}>{label}</div>
                                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ━━ NEWSLETTER ━━ */}
            <section style={{ background: "#0a0a0a", paddingTop: 56, paddingBottom: 80 }} className="nl-section">
                <div className="container">
                    <div style={{ maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "5px 14px", borderRadius: 100,
                            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                            fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)",
                            letterSpacing: "0.12em", textTransform: "uppercase",
                            marginBottom: 16,
                        }}>
                            ✉️ Newsletter
                        </div>
                        <h3 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.025em", margin: "0 0 10px" }}>
                            Stay in the Loop
                        </h3>
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 28, lineHeight: 1.6 }}>
                            Exclusive deals, new arrivals, and offers — straight to your inbox.
                        </p>
                        {nlStatus === "done" ? (
                            <p style={{ color: "#4ade80", fontWeight: 700, fontSize: 14 }}>✅ Successfully subscribed!</p>
                        ) : (
                            <form onSubmit={handleNL} style={{
                                display: "flex", borderRadius: 14, overflow: "hidden",
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "rgba(255,255,255,0.06)",
                            }}>
                                <input
                                    type="email" value={nlEmail} required
                                    onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                    placeholder="Enter your email"
                                    style={{
                                        flex: 1, minWidth: 0, padding: "14px 16px",
                                        background: "transparent", border: "none", outline: "none",
                                        fontSize: 13, color: "#fff",
                                        placeholderColor: "rgba(255,255,255,0.4)",
                                    }}
                                />
                                <button type="submit" disabled={nlStatus === "sending"} style={{
                                    padding: "14px 22px",
                                    background: "#fff", color: "#0a0a0a",
                                    border: "none", fontSize: 13, fontWeight: 800,
                                    cursor: "pointer", whiteSpace: "nowrap",
                                    letterSpacing: "-0.01em",
                                    opacity: nlStatus === "sending" ? 0.6 : 1,
                                    transition: "opacity 0.15s",
                                }}>
                                    {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                                </button>
                            </form>
                        )}
                        {nlStatus === "error" && (
                            <p style={{ color: "#f87171", fontSize: 11, marginTop: 8 }}>Failed. Please try again.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

/* ══════════════════════════════════════════════
   GLOBAL CSS
══════════════════════════════════════════════ */
const GLOBAL_CSS = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    100% { background-position: 300% 50%; }
  }

  /* Container */
  .container {
    max-width: 1280px;
    margin: 0 auto;
    padding-left: 16px;
    padding-right: 16px;
  }
  @media (min-width: 640px) {
    .container { padding-left: 24px; padding-right: 24px; }
  }
  @media (min-width: 1024px) {
    .container { padding-left: 48px; padding-right: 48px; }
  }

  /* Hero aspect ratio */
  .hero-aspect {
    aspect-ratio: 4/3;
  }
  @media (min-width: 640px) {
    .hero-aspect { aspect-ratio: 16/7; }
    .hero-desc { display: block !important; }
    .hero-stats { display: flex !important; gap: 10px; margin-top: 24px; flex-wrap: wrap; }
  }
  @media (min-width: 1024px) {
    .hero-aspect { aspect-ratio: 19/6; }
  }
  .hero-stats { display: none; }

  /* Hero nav buttons */
  .hero-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
    width: 36px; height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.9);
    border: none;
    display: none;
    align-items: center; justify-content: center;
    cursor: pointer;
    color: #0a0a0a;
    box-shadow: 0 2px 12px rgba(0,0,0,0.2);
    transition: all 0.15s;
  }
  .hero-nav:hover { background: #fff; transform: translateY(-50%) scale(1.05); }
  @media (min-width: 640px) {
    .hero-nav { display: flex; }
  }
  .hero-nav-l { left: 12px; }
  .hero-nav-r { right: 12px; }

  /* Scroll buttons */
  .hscroll-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 34px; height: 34px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid #e5e5e5;
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    display: none;
    align-items: center; justify-content: center;
    cursor: pointer;
    color: #555;
    transition: all 0.15s;
    opacity: 0;
  }
  .hscroll-btn:hover { background: #f8f8f8; }
  @media (min-width: 768px) {
    .hscroll-btn { display: flex; }
    .group-row:hover .hscroll-btn { opacity: 1; }
  }
  .hscroll-btn-l { left: -8px; }
  .hscroll-btn-r { right: -8px; }

  /* Hscroll items */
  .hscroll-item { width: 160px !important; min-width: 160px !important; display: flex; flex-direction: column; align-items: stretch; height: auto; }
  .hscroll-item .aspect-square { aspect-ratio: 5/4 !important; }
  .hscroll-item .sk-img { aspect-ratio: 5/4 !important; }

  @media (min-width: 640px) {
    .hscroll-item { width: 175px !important; min-width: 175px !important; }
  }
  @media (min-width: 1024px) {
    .hscroll-item { width: 190px !important; min-width: 190px !important; }
  }

  /* Product grid */
  .pgrid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  @media (min-width: 640px) {
    .pgrid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
  }
  @media (min-width: 1024px) {
    .pgrid { grid-template-columns: repeat(5, 1fr); gap: 12px; }
  }
  @media (min-width: 1280px) {
    .pgrid { grid-template-columns: repeat(6, 1fr); gap: 12px; }
  }

  /* Spinner */
  .spinner {
    display: inline-block;
    width: 28px; height: 28px;
    border: 3px solid #e5e5e5;
    border-top-color: #0a0a0a;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Why grid */
  .why-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  @media (min-width: 1024px) {
    .why-grid { grid-template-columns: repeat(4, 1fr); }
  }
  .why-card {
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 18px;
    padding: 24px 16px;
    text-align: center;
    transition: all 0.2s;
    cursor: default;
  }
  .why-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.07);
    border-color: #e8e8e8;
  }

  /* UH strip */
  .uh-strip:hover { filter: brightness(1.04); }
  @media (min-width: 640px) {
    .uh-badge { display: inline-flex !important; }
  }

  /* Newsletter section bottom padding for mobile bottom nav */
  @media (max-width: 767px) {
    .nl-section { padding-bottom: 112px !important; }
  }

  /* Scrollbar hide */
  ::-webkit-scrollbar { display: none; }
`;

export default Home;