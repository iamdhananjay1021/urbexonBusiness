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

/* ─── SKELETON CARD — Modern Loading State ─── */
const SkCard = () => (
    <div style={{
        background: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #f0f0f0",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        transition: "all 0.2s ease",
    }}>
        <div className="sk-img" style={{ width: "100%", aspectRatio: "3/4", background: "#f5f5f5", animation: "pulse 1.8s ease-in-out infinite" }} />
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            {["35%", "75%", "50%"].map((w, i) => (
                <div key={i} style={{ height: i === 0 ? 10 : 11, width: w, background: "#f0f0f0", borderRadius: 6, animation: "pulse 1.8s ease-in-out infinite", animationDelay: `${i * 0.1}s` }} />
            ))}
            <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 10, width: "40%", background: "#f0f0f0", borderRadius: 6, animation: "pulse 1.8s ease-in-out infinite", animationDelay: "0.2s" }} />
                <div style={{ height: 32, background: "#f0f0f0", borderRadius: 8, animation: "pulse 1.8s ease-in-out infinite", animationDelay: "0.3s" }} />
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

/* ─── SECTION HEADER — Modern Typography ─── */
const SecHead = ({ title, sub, to, label = "View All" }) => (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
            <h2 style={{
                fontSize: "clamp(18px, 2.2vw, 24px)",
                fontWeight: 800,
                color: "#1a1a1a",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                margin: 0,
                fontFamily: "'Inter', 'Poppins', -apple-system, sans-serif",
            }}>
                {title}
            </h2>
            {sub && <p style={{ fontSize: 13, color: "#999", marginTop: 6, fontWeight: 500 }}>{sub}</p>}
        </div>
        {to && (
            <Link to={to} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 700, color: "#2563eb",
                textDecoration: "none", whiteSpace: "nowrap", paddingBottom: 2,
                letterSpacing: "0.02em",
                transition: "all 0.2s ease",
                fontFamily: "'Inter', -apple-system, sans-serif",
            }}
                onMouseEnter={e => { e.currentTarget.style.color = "#1d4ed8"; e.currentTarget.style.transform = "translateX(2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#2563eb"; e.currentTarget.style.transform = "translateX(0)"; }}
            >
                {label} <FaArrowRight size={9} style={{ marginTop: 1 }} />
            </Link>
        )}
    </div>
);

/* ─── HORIZONTAL SCROLL ROW — Modern Layout ─── */
const HScrollRow = ({ products = [], loading, skCount = 6 }) => {
    const rowRef = useRef(null);
    const scroll = dir => rowRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
    return (
        <div style={{ position: "relative" }} className="group-row">
            <button onClick={() => scroll(-1)} className="hscroll-btn hscroll-btn-l">
                <FaChevronLeft size={12} style={{ opacity: 0.7 }} />
            </button>
            <button onClick={() => scroll(1)} className="hscroll-btn hscroll-btn-r">
                <FaChevronRight size={12} style={{ opacity: 0.7 }} />
            </button>
            <div ref={rowRef} style={{
                display: "flex", gap: 12,
                overflowX: "auto", paddingBottom: 8, paddingTop: 2,
                scrollSnapType: "x mandatory", scrollBehavior: "smooth",
                msOverflowStyle: "none", scrollbarWidth: "none",
                alignItems: "stretch"
            }}>
                {loading
                    ? Array(skCount).fill(0).map((_, i) => (
                        <div key={i} style={{ width: 140, minWidth: 140, scrollSnapAlign: "start" }} className="hscroll-item">
                            <SkCard />
                        </div>
                    ))
                    : products.map(p => (
                        <div key={p._id || p.id} style={{ width: 140, minWidth: 140, scrollSnapAlign: "start" }} className="hscroll-item">
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
        <section style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
            <div className="container" style={{ paddingTop: 15, paddingBottom: 15 }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <h2 style={{ fontSize: "clamp(18px, 2.2vw, 24px)", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: 10, fontFamily: "'Inter', 'Poppins', -apple-system, sans-serif" }}>
                            <FaThLarge size={16} style={{ color: "#2563eb" }} /> All Products
                        </h2>
                        <p style={{ fontSize: 13, color: "#999", marginTop: 6, fontWeight: 500 }}>Browse our complete catalog of products</p>
                    </div>
                    <Link to="/products" style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", transition: "all 0.2s ease", fontFamily: "'Inter', -apple-system, sans-serif" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#1d4ed8"; e.currentTarget.style.transform = "translateX(2px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#2563eb"; e.currentTarget.style.transform = "translateX(0)"; }}
                    >
                        Full Catalog <FaArrowRight size={10} />
                    </Link>
                </div>

                {/* Sort pills */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24, overflowX: "auto", paddingBottom: 6 }}>
                    {ALL_SORT_OPTIONS.map(o => (
                        <button key={o.key} onClick={() => setSort(o.key)} style={{
                            padding: "8px 16px",
                            borderRadius: 100,
                            fontSize: 12, fontWeight: 600,
                            border: sort === o.key ? "1.5px solid #1a1a1a" : "1.5px solid #e5e5e5",
                            background: sort === o.key ? "#1a1a1a" : "#fff",
                            color: sort === o.key ? "#fff" : "#666",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                            letterSpacing: "0.02em",
                            fontFamily: "'Inter', -apple-system, sans-serif",
                        }}
                            onMouseEnter={e => {
                                if (sort !== o.key) {
                                    e.currentTarget.style.borderColor = "#d0d0d0";
                                    e.currentTarget.style.background = "#f9f9f9";
                                }
                            }}
                            onMouseLeave={e => {
                                if (sort !== o.key) {
                                    e.currentTarget.style.borderColor = "#e5e5e5";
                                    e.currentTarget.style.background = "#fff";
                                }
                            }}
                        >
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
                        width: "100%", maxWidth: 240, margin: "40px auto 0",
                        padding: "12px 28px",
                        border: "1.5px solid #1a1a1a", borderRadius: 8,
                        background: "#fff", color: "#1a1a1a",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        opacity: loadingMore ? 0.6 : 1,
                        fontFamily: "'Inter', -apple-system, sans-serif",
                        letterSpacing: "0.01em",
                    }}
                        onMouseEnter={e => { if (!loadingMore) { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                        onMouseLeave={e => { if (!loadingMore) { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#1a1a1a"; e.currentTarget.style.transform = "translateY(0)"; } }}
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
                    <div style={{ textAlign: "center", marginTop: 32 }}>
                        <Link to="/deals" style={{
                            display: "inline-flex", alignItems: "center", gap: 10,
                            padding: "12px 28px", borderRadius: 8,
                            background: "#1a1a1a", color: "#fff",
                            fontWeight: 700, fontSize: 13, textDecoration: "none",
                            letterSpacing: "0.02em",
                            fontFamily: "'Inter', -apple-system, sans-serif",
                            transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#2d2d2d"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                            <FaTag size={12} /> View All Deals <FaArrowRight size={11} />
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
        <div style={{ background: "#fafafa", minHeight: "100vh" }}>
            <style>{GLOBAL_CSS}</style>
            <div className="container" style={{ paddingTop: 32, paddingBottom: 80 }}>
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em", fontFamily: "'Inter', 'Poppins', -apple-system, sans-serif" }}>
                        Search Results for <em style={{ fontStyle: "italic", color: "#2563eb" }}>"{searchQuery}"</em>
                    </h1>
                    <p style={{ fontSize: 13, color: "#999", marginTop: 8, fontWeight: 500 }}>
                        {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`}
                    </p>
                </div>
                {searching ? <PGrid loading skCount={12} />
                    : searchResults.length > 0 ? <PGrid products={searchResults} />
                        : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "120px 0", color: "#ccc" }}>
                                <FaSearch size={48} style={{ marginBottom: 16, color: "#e5e5e5" }} />
                                <div style={{ fontWeight: 700, color: "#999", fontSize: 16 }}>No products found</div>
                                <div style={{ fontSize: 13, marginTop: 8, color: "#bbb" }}>Try a different search term or browse our categories</div>
                            </div>
                        )
                }
            </div>
        </div>
    );

    /* ──────────────────────────────────────────────────────────
       MAIN RENDER — Modern Premium Layout
    ────────────────────────────────────────────────────────── */
    return (
        <div style={{ background: "#fafafa", overflowX: "hidden", width: "100%" }}>
            <style>{GLOBAL_CSS}</style>
            <SEO title="Premium Online Shopping — Urbexon" description="Discover premium products from verified sellers with fast delivery and secure checkout." path="/" />

            {/* ━━ HERO BANNER ━━ */}
            {loading && slides.length === 0 ? (
                <div className="w-full bg-zinc-900 h-[280px] sm:h-[350px] md:h-[450px] lg:h-[500px] xl:h-[600px] flex flex-col gap-4 justify-center px-6 sm:px-12 animate-pulse">
                    <div className="h-4 w-24 bg-white/10 rounded-full" />
                    <div className="h-8 sm:h-12 w-3/4 sm:w-1/2 bg-white/10 rounded-lg" />
                    <div className="h-4 sm:h-6 w-1/2 sm:w-1/3 bg-white/10 rounded-md" />
                    <div className="h-10 sm:h-12 w-32 bg-white/10 rounded-xl mt-4" />
                </div>
            ) : slides.length > 0 ? (
                <div className="relative w-full bg-zinc-900 overflow-hidden h-[320px] xs:h-[380px] sm:h-[450px] md:h-[500px] lg:h-[550px] xl:h-[600px] group">
                    {slides.map((slide, i) => {
                        const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";
                        return (
                            <div key={slide._id}
                                className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out flex items-center ${i === heroIdx ? "opacity-100 z-10" : "opacity-0 z-0"}`}>

                                {/* Background Image with safe object-fit */}
                                <div className="absolute inset-0 w-full h-full">
                                    <img
                                        src={bg} alt={slide.title || "Banner"}
                                        loading={i === 0 ? "eager" : "lazy"}
                                        className="w-full h-full object-cover object-center sm:object-cover"
                                    />
                                    {/* Gradient Overlay for Text Readability */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10 sm:from-black/80 sm:via-black/40 sm:to-transparent" />
                                    {/* Additional bottom gradient for mobile to make dots/arrows visible */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent sm:hidden" />
                                </div>

                                {/* Content Overlay */}
                                <div className="container relative z-10 w-full pt-8 pb-12 sm:py-12 flex flex-col justify-center h-full">
                                    <div className="w-full max-w-[90%] sm:max-w-[450px] md:max-w-[550px] lg:max-w-[650px] flex flex-col items-start">

                                        {slide.tag && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] sm:text-xs font-bold text-white tracking-widest uppercase mb-3 sm:mb-4 backdrop-blur-md shadow-sm">
                                                🔥 {slide.tag}
                                            </div>
                                        )}

                                        <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.15] tracking-tight mb-2 sm:mb-4 drop-shadow-lg">
                                            {slide.title}
                                            {slide.highlight && (
                                                <em className="text-yellow-400 block not-italic mt-1 sm:mt-2 drop-shadow-md">{slide.highlight}</em>
                                            )}
                                        </h1>

                                        {(slide.subtitle || slide.desc || slide.description) && (
                                            <p className="text-sm sm:text-base lg:text-lg text-white/90 leading-relaxed mb-5 sm:mb-8 max-w-[95%] sm:max-w-[90%] drop-shadow-md line-clamp-2 sm:line-clamp-none">
                                                {slide.subtitle || slide.desc || slide.description}
                                            </p>
                                        )}

                                        {/* Buttons */}
                                        <div className="flex gap-3 sm:gap-4 flex-wrap mt-2 sm:mt-0">
                                            <button
                                                onClick={() => {
                                                    const t = slide.link || slide.ctaLink || "/";
                                                    t.startsWith("http") ? window.open(t, "_blank", "noopener") : navigate(t);
                                                }}
                                                className="px-5 py-2.5 sm:px-8 sm:py-3.5 rounded-lg sm:rounded-xl bg-white text-zinc-900 text-xs sm:text-sm md:text-base font-extrabold border-none cursor-pointer flex items-center gap-2 hover:bg-zinc-100 active:scale-95 transition-all shadow-lg"
                                            >
                                                {slide.buttonText || slide.cta || "Shop Now"} <FaArrowRight size={11} />
                                            </button>

                                            {slide.secondary && (
                                                <button
                                                    onClick={() => navigate(slide.secondaryLink || "/deals")}
                                                    className="px-5 py-2.5 sm:px-6 sm:py-3.5 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 text-white text-xs sm:text-sm md:text-base font-semibold cursor-pointer backdrop-blur-md hover:bg-white/20 active:scale-95 transition-all"
                                                >
                                                    {slide.secondary}
                                                </button>
                                            )}
                                        </div>

                                        {/* Stats — desktop */}
                                        <div className="hidden md:flex gap-4 mt-10">
                                            {[
                                                { v: "Free", l: "Delivery ₹499+" },
                                                { v: stats.products ? `${stats.products.toLocaleString()}+` : "—", l: "Products" },
                                                { v: stats.categories || "—", l: "Categories" },
                                            ].map(({ v, l }) => (
                                                <div key={l} className="bg-white/10 border border-white/10 rounded-xl px-5 py-3 backdrop-blur-md shadow-sm">
                                                    <div className="text-lg lg:text-xl font-black text-white leading-none mb-1">{v}</div>
                                                    <div className="text-[10px] lg:text-xs text-white/60 font-bold uppercase tracking-widest">{l}</div>
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
                            {/* Navigation Arrows */}
                            <button onClick={() => goHero(-1)} className="absolute left-2 sm:left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/20 hover:bg-black/40 border border-white/20 flex items-center justify-center text-white cursor-pointer backdrop-blur-md transition-all active:scale-95 opacity-100 sm:opacity-0 group-hover:opacity-100">
                                <FaChevronLeft size={14} className="mr-0.5" />
                            </button>
                            <button onClick={() => goHero(1)} className="absolute right-2 sm:right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/20 hover:bg-black/40 border border-white/20 flex items-center justify-center text-white cursor-pointer backdrop-blur-md transition-all active:scale-95 opacity-100 sm:opacity-0 group-hover:opacity-100">
                                <FaChevronRight size={14} className="ml-0.5" />
                            </button>

                            {/* Dots Indicator */}
                            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                                {slides.map((_, i) => (
                                    <button key={i} onClick={() => { setHeroIdx(i); resetTimer(); }}
                                        className={`h-1.5 sm:h-2 rounded-full border-none cursor-pointer transition-all duration-300 p-0 ${i === heroIdx ? "w-6 sm:w-8 bg-white" : "w-1.5 sm:w-2 bg-white/40 hover:bg-white/60"}`}
                                        aria-label={`Go to slide ${i + 1}`} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : !loading && (
                <div className="w-full bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center min-h-[300px] sm:min-h-[420px]">
                    <div className="container py-12 sm:py-16">
                        <div className="max-w-[540px]">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
                                Welcome to <em className="text-yellow-400 not-italic">Urbexon</em>
                            </h1>
                            <p className="text-sm sm:text-base text-white/70 mb-8 leading-relaxed max-w-[460px]">
                                Discover premium products from verified sellers with fast delivery and secure checkout.
                            </p>
                            <button onClick={() => navigate("/deals")}
                                className="px-6 py-3 bg-white text-zinc-900 rounded-xl text-sm font-bold cursor-pointer inline-flex items-center gap-2 hover:bg-zinc-100 hover:-translate-y-0.5 transition-all shadow-lg">
                                Explore Deals <FaArrowRight size={12} />
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
                <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0" }}>
                    <div className="container" style={{ paddingTop: 10, paddingBottom: 10 }}>
                        <SecHead title="Trending Now" sub="Most popular products right now" to="/products?sort=rating" label="See all" />
                        <PGrid products={featured} loading={loading} skCount={8} />
                    </div>
                </section>
            )}

            {/* ━━ NEW ARRIVALS ━━ */}
            {(loading || newArrivals.length > 0) && (
                <section style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
                    <div className="container" style={{ paddingTop: 10, paddingBottom: 10 }}>
                        <SecHead title="New Arrivals" sub="Fresh drops and latest collections" to="/products?sort=newest" label="See all" />
                        <HScrollRow products={newArrivals} loading={loading} skCount={6} />
                    </div>
                </section>
            )}

            {/* ━━ RECENTLY VIEWED ━━ */}
            {ecRecent.length > 0 && (
                <section style={{ background: "#fff", borderTop: "1px solid #f0f0f0" }}>
                    <div className="container" style={{ paddingTop: 10, paddingBottom: 10 }}>
                        <SecHead title="Recently Viewed" sub="Continue where you left off" />
                        <HScrollRow products={ecRecent.slice(0, 12)} loading={false} />
                    </div>
                </section>
            )}

            {/* ━━ FOR YOU ━━ */}
            {forYouProducts.length > 0 && (
                <section style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
                    <div className="container" style={{ paddingTop: 15, paddingBottom: 15 }}>
                        <SecHead
                            title={`Similar to "${forYouTerm}"`}
                            sub="Handpicked recommendations just for you"
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
                <div className="container" style={{ paddingTop: 15, paddingBottom: 15 }}>
                    <div style={{ textAlign: "center", marginBottom: 40 }}>
                        <h2 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em", margin: 0, fontFamily: "'Inter', 'Poppins', -apple-system, sans-serif" }}>
                            Why Choose Urbexon?
                        </h2>
                        <p style={{ fontSize: 14, color: "#999", marginTop: 8, fontWeight: 500 }}>Your trusted partner for premium online shopping</p>
                    </div>
                    <div className="why-grid">
                        {WHY.map(({ Icon, label, sub, color, bg }) => (
                            <div key={label} className="why-card" style={{ "--why-bg": bg, "--why-color": color }}>
                                <div style={{
                                    width: 52, height: 52, borderRadius: 12, background: bg,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    margin: "0 auto 16px",
                                }}>
                                    <Icon size={22} style={{ color }} />
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 8, letterSpacing: "-0.01em", fontFamily: "'Inter', -apple-system, sans-serif" }}>{label}</div>
                                <div style={{ fontSize: 13, color: "#999", lineHeight: 1.6 }}>{sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ━━ NEWSLETTER ━━ */}
            <section style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)", paddingTop: 64, paddingBottom: 96 }} className="nl-section">
                <div className="container">
                    <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "6px 14px", borderRadius: 100,
                            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                            fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)",
                            letterSpacing: "0.12em", textTransform: "uppercase",
                            marginBottom: 20,
                            fontFamily: "'Inter', -apple-system, sans-serif",
                        }}>
                            ✉️ Newsletter
                        </div>
                        <h3 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", margin: "0 0 12px", fontFamily: "'Inter', 'Poppins', -apple-system, sans-serif" }}>
                            Stay in the Loop
                        </h3>
                        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 32, lineHeight: 1.7 }}>
                            Get exclusive deals, new arrivals, and special offers delivered to your inbox.
                        </p>
                        {nlStatus === "done" ? (
                            <div style={{ padding: "16px 20px", background: "rgba(74,222,128,0.1)", border: "1px solid #22c55e", borderRadius: 8, color: "#4ade80", fontWeight: 700, fontSize: 14 }}>✅ Successfully subscribed! Check your email.</div>
                        ) : (
                            <form onSubmit={handleNL} style={{
                                display: "flex", borderRadius: 8, overflow: "hidden",
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: "rgba(255,255,255,0.04)",
                                backdropFilter: "blur(8px)",
                            }}>
                                <input
                                    type="email" value={nlEmail} required
                                    onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                    placeholder="Enter your email address"
                                    style={{
                                        flex: 1, minWidth: 0, padding: "14px 18px",
                                        background: "transparent", border: "none", outline: "none",
                                        fontSize: 14, color: "#fff",
                                        fontFamily: "'Inter', -apple-system, sans-serif",
                                    }}
                                />
                                <button type="submit" disabled={nlStatus === "sending"} style={{
                                    padding: "14px 24px",
                                    background: "#fff", color: "#1a1a1a",
                                    border: "none", fontSize: 13, fontWeight: 800,
                                    letterSpacing: "-0.01em",
                                    fontFamily: "'Inter', -apple-system, sans-serif",
                                    opacity: nlStatus === "sending" ? 0.7 : 1,
                                    transition: "all 0.2s ease",
                                }}>
                                    {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                                </button>
                            </form>
                        )}
                        {nlStatus === "error" && (
                            <p style={{ color: "#fca5a5", fontSize: 12, marginTop: 10 }}>❌ Failed to subscribe. Please try again.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════════════════
   MODERN MINIMALIST GLOBAL CSS — Production Premium Design System
   Inspired by: Flipkart, Apple, Nike
   Color Palette: Clean white (#fff), soft grays (#f5f5f5, #f0f0f0, #e5e5e5), dark text
   Typography: Inter, Poppins, SF Pro Display
══════════════════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
  /* ━━━━━━━━━━━━━━━━━━ ROOT & FONTS ━━━━━━━━━━━━━━━━━━ */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
  
  :root {
    --primary: #2563eb;
    --primary-light: #3b82f6;
    --primary-dark: #1d4ed8;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --text-tertiary: #999999;
    --bg-white: #ffffff;
    --bg-light: #f9f9f9;
    --bg-lighter: #f5f5f5;
    --border-light: #f0f0f0;
    --border: #e5e5e5;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
    --shadow-lg: 0 10px 25px rgba(0,0,0,0.08);
    --shadow-xl: 0 20px 40px rgba(0,0,0,0.1);
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --radius-2xl: 20px;
  }

  /* ━━━━━━━━━━━━━━━━━━ ANIMATIONS ━━━━━━━━━━━━━━━━━━ */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    100% { background-position: 300% 50%; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ━━━━━━━━━━━━━━━━━━ CONTAINER ━━━━━━━━━━━━━━━━━━ */
  .container {
    max-width: 1280px;
    margin: 0 auto;
    padding-left: 12px;
    padding-right: 12px;
  }
  @media (min-width: 640px) {
    .container { padding-left: 20px; padding-right: 20px; }
  }
  @media (min-width: 1024px) {
    .container { padding-left: 40px; padding-right: 40px; }
  }
  @media (min-width: 1280px) {
    .container { padding-left: 60px; padding-right: 60px; }
  }

  /* ━━━━━━━━━━━━━━━━━━ HORIZONTAL SCROLL ━━━━━━━━━━━━━━━━━━ */
  .group-row {
    position: relative;
  }
  
  .hscroll-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 38px; height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    opacity: 0;
    backdrop-filter: blur(4px);
  }
  .hscroll-btn:hover { 
    background: var(--bg-lighter);
    border-color: var(--border-light);
    color: var(--text-primary);
  }
  .hscroll-btn:active { transform: translateY(-50%) scale(0.95); }
  @media (min-width: 768px) {
    .hscroll-btn { display: flex; }
    .group-row:hover .hscroll-btn { opacity: 1; }
  }
  .hscroll-btn-l { left: -16px; }
  .hscroll-btn-r { right: -16px; }
  @media (min-width: 1024px) {
    .hscroll-btn-l { left: -40px; }
    .hscroll-btn-r { right: -40px; }
  }
  @media (min-width: 1280px) {
    .hscroll-btn-l { left: -52px; }
    .hscroll-btn-r { right: -52px; }
  }

  .hscroll-item {
    width: 140px !important;
    min-width: 140px !important;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    height: auto;
    scroll-snap-align: start;
    scroll-snap-stop: auto;
  }
  .hscroll-item .aspect-square { aspect-ratio: 1/1.25 !important; }
  .hscroll-item .sk-img { aspect-ratio: 1/1.25 !important; }

  @media (min-width: 640px) {
    .hscroll-item { width: 160px !important; min-width: 160px !important; }
  }
  @media (min-width: 1024px) {
    .hscroll-item { width: 180px !important; min-width: 180px !important; }
  }

  /* ━━━━━━━━━━━━━━━━━━ PRODUCT GRID ━━━━━━━━━━━━━━━━━━ */
  .pgrid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    animation: fadeIn 0.3s ease-out;
  }
  @media (min-width: 640px) {
    .pgrid { grid-template-columns: repeat(3, 1fr); gap: 12px; }
  }
  @media (min-width: 1024px) {
    .pgrid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
  }
  @media (min-width: 1280px) {
    .pgrid { grid-template-columns: repeat(5, 1fr); gap: 12px; }
  }

  /* ━━━━━━━━━━━━━━━━━━ SPINNER ━━━━━━━━━━━━━━━━━━ */
  .spinner {
    display: inline-block;
    width: 24px; height: 24px;
    border: 2.5px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* ━━━━━━━━━━━━━━━━━━ WHY CHOOSE GRID ━━━━━━━━━━━━━━━━━━ */
  .why-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    animation: fadeIn 0.4s ease-out;
  }
  @media (min-width: 768px) {
    .why-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; }
  }

  .why-card {
    background: var(--bg-white);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 20px 16px;
    text-align: center;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    cursor: default;
  }
  .why-card:hover {
    transform: translateY(-6px);
    box-shadow: var(--shadow-lg);
    border-color: var(--border-light);
  }

  /* ━━━━━━━━━━━━━━━━━━ UH STRIP ━━━━━━━━━━━━━━━━━━ */
  .uh-strip {
    transition: all 0.3s ease;
  }
  .uh-strip:hover { 
    filter: brightness(1.02);
  }
  @media (min-width: 640px) {
    .uh-badge { display: inline-flex !important; }
  }

  /* ━━━━━━━━━━━━━━━━━━ NEWSLETTER SECTION ━━━━━━━━━━━━━━━━━━ */
  @media (max-width: 767px) {
    .nl-section { padding-bottom: 120px !important; }
  }

  /* ━━━━━━━━━━━━━━━━━━ SCROLLBAR ━━━━━━━━━━━━━━━━━━ */
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }
`;

export default Home;