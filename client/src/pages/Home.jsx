/**
 * Home.jsx — Urbexon v5 — Full Tailwind, no inline CSS blocks
 */
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import api from "../api/axios";
import { fetchActiveBanners } from "../api/bannerApi";
import { fetchActiveCategories } from "../api/categoryApi";
import CategoryBrowser from "../components/CategoryBrowser";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import { useAuth } from "../contexts/AuthContext";
import {
    FaArrowRight, FaBolt, FaStar, FaChevronLeft, FaChevronRight,
    FaSearch, FaHeart, FaRegHeart, FaStore, FaThLarge, FaTag,
    FaShippingFast, FaLock, FaMedal, FaHeadset,
} from "react-icons/fa";

/* ─────────────────────────────────────────────
   SEARCH HISTORY
───────────────────────────────────────────── */
const SEARCH_HISTORY_KEY = "ux_search_history";
const getSearchHistory = () => {
    try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || []; }
    catch { return []; }
};
const saveSearchTerm = (term) => {
    if (!term?.trim()) return;
    const t = term.trim();
    const hist = getSearchHistory().filter(h => h.toLowerCase() !== t.toLowerCase());
    hist.unshift(t);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(hist.slice(0, 15)));
};

/* ─────────────────────────────────────────────
   UTILS
───────────────────────────────────────────── */
const imgSrc = p =>
    p?.images?.[0]?.url || (typeof p?.image === "string" ? p.image : p?.image?.url) || "";
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const disc = p => p?.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;

/* ─────────────────────────────────────────────
   CACHE
───────────────────────────────────────────── */
let _homeCache = null;
const CACHE_TTL = 3 * 60 * 1000;

const WHY = [
    { Icon: FaShippingFast, label: "Fast Delivery", sub: "Free shipping on orders over ₹499", bg: "bg-blue-50", iconColor: "text-blue-500" },
    { Icon: FaLock, label: "Secure Payment", sub: "100% secure & encrypted transactions", bg: "bg-green-50", iconColor: "text-green-600" },
    { Icon: FaMedal, label: "Quality Products", sub: "Verified & authentic items only", bg: "bg-amber-50", iconColor: "text-amber-600" },
    { Icon: FaHeadset, label: "24/7 Support", sub: "Dedicated customer service team", bg: "bg-purple-50", iconColor: "text-purple-600" },
];

const ALL_SORT_OPTIONS = [
    { key: "newest", label: "New Arrivals" },
    { key: "rating", label: "Top Rated" },
    { key: "price_asc", label: "Price: Low → High" },
    { key: "price_desc", label: "Price: High → Low" },
    { key: "discount", label: "Best Deals" },
];
const PAGE_SIZE = 20;

/* ─────────────────────────────────────────────
   SKELETON CARD
───────────────────────────────────────────── */
const SkCard = () => (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 h-full w-full flex flex-col">
        <div className="h-[200px] sm:h-[220px] shrink-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
        <div className="p-3 flex-1 flex flex-col space-y-2">
            <div className="h-2.5 w-1/3 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-gray-200 rounded animate-pulse" />
            <div className="mt-auto space-y-2 pt-2">
                <div className="h-4 w-2/5 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
            </div>
        </div>
    </div>
);

/* ─────────────────────────────────────────────
   FLASH TIMER
───────────────────────────────────────────── */
const FlashTimer = ({ endsAt }) => {
    const calc = useCallback(() => {
        const now = Date.now();
        const end = endsAt ? new Date(endsAt).getTime() : (() => {
            const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime();
        })();
        const diff = Math.max(0, end - now);
        return { h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) };
    }, [endsAt]);

    const [t, setT] = useState(calc);
    useEffect(() => {
        const id = setInterval(() => setT(calc()), 1000);
        return () => clearInterval(id);
    }, [calc]);

    const pad = n => String(n).padStart(2, "0");
    return (
        <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-3 py-2.5 rounded-xl border border-white/15">
            {[{ v: t.h, l: "HR" }, { v: t.m, l: "MIN" }, { v: t.s, l: "SEC" }].map(({ v, l }, i) => (
                <div key={l} className="contents">
                    <div className="bg-black/25 border border-white/15 rounded-lg px-2.5 py-1.5 text-center min-w-[46px]">
                        <div className="text-lg font-black text-white leading-none tabular-nums">{pad(v)}</div>
                        <div className="text-[8px] text-white/70 mt-0.5 font-bold tracking-wider">{l}</div>
                    </div>
                    {i < 2 && <span className="text-xl font-black text-white/70 animate-pulse">:</span>}
                </div>
            ))}
        </div>
    );
};

/* ─────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────── */
const SecHead = ({ title, sub, to, label = "View All", icon }) => (
    <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                {icon && icon}{title}
            </h2>
            {sub && <p className="text-[13px] text-gray-500 mt-1 font-medium">{sub}</p>}
        </div>
        {to && (
            <Link to={to}
                className="text-xs font-bold text-[#2874f0] flex items-center gap-1 px-3.5 py-1.5 rounded-full border-[1.5px] border-blue-100 bg-blue-50 hover:bg-[#2874f0] hover:text-white hover:border-[#2874f0] transition-all whitespace-nowrap">
                {label} <FaArrowRight size={10} />
            </Link>
        )}
    </div>
);

/* ─────────────────────────────────────────────
   PRODUCT CARD
───────────────────────────────────────────── */
const PCard = memo(({ product, showDealBadge = false }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addItem, isInEcommerceCart, isInUHCart } = useCart();
    const { inWishlist, toggle: toggleWish } = useWishlist(product._id);
    const [flash, setFlash] = useState(false);

    const isUH = product?.productType === "urbexon_hour";
    const inCart = isUH ? isInUHCart(product._id) : isInEcommerceCart(product._id);
    const isOOS = !product.inStock || product.stock === 0;
    const d = disc(product);
    const img = imgSrc(product);

    const handleCart = useCallback(e => {
        e.stopPropagation();
        if (inCart || isOOS) return;
        addItem(product);
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
    }, [inCart, isOOS, product, addItem]);

    const handleWish = useCallback(e => {
        e.stopPropagation();
        if (!user) { navigate("/login"); return; }
        toggleWish();
    }, [user, navigate, toggleWish]);

    const btnVariant = isOOS
        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
        : (inCart || flash)
            ? (flash ? "bg-[#2874f0] text-white border-[#2874f0]" : "bg-green-50 text-green-700 border-green-300")
            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-[#2874f0] hover:text-white hover:border-[#2874f0]";

    const btnText = isOOS ? "Out of Stock" : inCart ? "✓ In Cart" : flash ? "Added!" : isUH ? "⚡ Express" : "+ Add to Cart";

    return (
        <div
            className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl hover:border-gray-200 flex flex-col group h-full w-full"
            onClick={() => navigate(`/products/${product.slug || product._id}`)}
        >
            <div className="relative overflow-hidden bg-gray-50 h-[200px] sm:h-[220px] shrink-0">
                {img
                    ? <img src={img} alt={product.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    : <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-gray-50 to-gray-100">🛍️</div>
                }
                {showDealBadge && d > 0 && (
                    <div className="absolute top-2.5 left-2.5 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-1"><FaBolt size={8} /> DEAL</div>
                )}
                {!showDealBadge && d > 0 && (
                    <div className="absolute top-2.5 left-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">{d}% OFF</div>
                )}
                {isUH && (
                    <div className="absolute bottom-2 left-2 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><FaBolt size={8} /> EXPRESS</div>
                )}
                {isOOS && (
                    <div className="absolute inset-0 bg-white/75 flex items-center justify-center text-[11px] font-bold text-gray-500 uppercase tracking-widest">Out of Stock</div>
                )}
                <button
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 border-none cursor-pointer flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 transition-opacity hover:scale-110 md:opacity-100"
                    onClick={handleWish} aria-label="Wishlist"
                    style={{ opacity: undefined }}
                >
                    {inWishlist ? <FaHeart size={13} className="text-red-500" /> : <FaRegHeart size={13} className="text-gray-400" />}
                </button>
            </div>
            <div className="p-3 flex-1 flex flex-col">
                {product.brand ? (
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 line-clamp-1">{product.brand}</div>
                ) : (
                    <div className="h-[14px] mb-1" />
                )}
                <div className="text-[12px] text-gray-600 leading-tight mb-1.5 line-clamp-2 font-medium min-h-[34px]">{product.name}</div>
                <div className="mt-auto">
                    <div className="h-[20px] mb-2 flex items-center">
                        {product.rating > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="bg-[#388e3c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] flex items-center gap-1">{product.rating.toFixed(1)} <FaStar size={8} /></span>
                                {product.numReviews > 0 && <span className="text-[11px] text-gray-500 font-medium">({product.numReviews.toLocaleString()})</span>}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                        <span className="text-base font-extrabold text-gray-900">{fmt(product.price)}</span>
                        {product.mrp > product.price && <span className="text-xs text-gray-400 line-through">{fmt(product.mrp)}</span>}
                        {d > 0 && <span className="text-[11px] font-bold text-green-600">{d}% off</span>}
                    </div>
                    <button
                        className={`w-full py-2 text-[11px] font-bold rounded-lg border-[1.5px] transition-all uppercase tracking-wide flex items-center justify-center gap-1.5 ${btnVariant}`}
                        onClick={handleCart} disabled={isOOS}
                    >
                        {btnText}
                    </button>
                </div>
            </div>
        </div >
    );
});
PCard.displayName = "PCard";

/* ─────────────────────────────────────────────
   ALL PRODUCTS SECTION
───────────────────────────────────────────── */
const AllProductsSection = () => {
    const navigate = useNavigate();
    const [sort, setSort] = useState("newest");
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isSorting, setIsSorting] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (products.length === 0) {
            setLoading(true);
        } else {
            setIsSorting(true);
        }
        setPage(1);
        setHasMore(true);

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
        const nextPage = page + 1;
        try {
            const r = await api.get(`/products?sort=${sort}&productType=ecommerce&limit=${PAGE_SIZE}&page=${nextPage}`);
            const list = r.data?.products || [];
            setProducts(prev => [...prev, ...list]); setPage(nextPage); setHasMore(list.length === PAGE_SIZE);
        } catch { } finally { setLoadingMore(false); }
    }, [sort, page, loadingMore, hasMore]);

    return (
        <div className="bg-white border-t border-gray-100">
            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-11">
                <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
                    <div>
                        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                            <FaThLarge size={18} className="text-[#2874f0]" /> All Products
                        </h2>
                        <p className="text-[13px] text-gray-500 mt-1 font-medium">Browse our complete catalog</p>
                    </div>
                    <Link to="/products" className="text-xs font-bold text-[#2874f0] flex items-center gap-1 px-3.5 py-1.5 rounded-full border-[1.5px] border-blue-100 bg-blue-50 hover:bg-[#2874f0] hover:text-white hover:border-[#2874f0] transition-all whitespace-nowrap">
                        Full Catalog <FaArrowRight size={10} />
                    </Link>
                </div>

                <div className="flex gap-2 flex-wrap mb-5">
                    {ALL_SORT_OPTIONS.map(o => (
                        <button key={o.key}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold border-[1.5px] cursor-pointer transition-all whitespace-nowrap
                                ${sort === o.key ? "bg-[#2874f0] text-white border-[#2874f0]" : "bg-white text-gray-600 border-gray-200 hover:border-[#2874f0] hover:text-[#2874f0]"}`}
                            onClick={() => setSort(o.key)}>
                            {o.label}
                        </button>
                    ))}
                </div>

                {loading ? ( // Initial load skeleton
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
                        {Array(PAGE_SIZE).fill(0).map((_, i) => <SkCard key={i} />)}
                    </div>
                ) : products.length > 0 ? ( // Grid with products
                    <div className="relative">
                        {isSorting && (
                            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center">
                                <span className="w-8 h-8 border-4 border-blue-200 border-t-[#2874f0] rounded-full animate-spin" />
                            </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
                            {products.map(p => <PCard key={p._id} product={p} />)}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-400">
                        <FaStore size={36} className="mx-auto mb-3 text-gray-200" />
                        <div className="font-bold text-base">No products found</div>
                    </div>
                )}

                {!loading && hasMore && (
                    <button
                        className="flex items-center justify-center gap-2.5 w-full max-w-[300px] mx-auto mt-8 px-7 py-3 rounded-xl bg-white border-2 border-[#2874f0] text-[#2874f0] text-sm font-extrabold cursor-pointer transition-all hover:bg-[#2874f0] hover:text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={loadMore} disabled={loadingMore}
                    >
                        {loadingMore
                            ? <><span className="w-5 h-5 border-2 border-blue-200 border-t-[#2874f0] rounded-full animate-spin inline-block" /> Loading…</>
                            : <><FaArrowRight size={12} /> Load More Products</>
                        }
                    </button>
                )}

                {!loading && products.length > 0 && (
                    <div className="flex items-center justify-center mt-7">
                        <Link to="/products"
                            className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#2874f0] to-[#1a5dc8] text-white text-[15px] font-extrabold tracking-wide shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all">
                            <FaStore size={15} /> Shop All Products <FaArrowRight size={12} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   FLASH DEALS SECTION
───────────────────────────────────────────── */
const FlashDealsSection = ({ deals, loading, nearestDealEnd }) => {
    if (!loading && deals.length === 0) return null;
    return (
        <div className="bg-gray-50 border-t border-gray-100">
            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-11">
                <SecHead
                    title="Lightning Deals"
                    sub="Limited-time offers — grab them before they expire"
                    to="/deals"
                    label="All Deals"
                    icon={<FaBolt size={16} className="text-orange-500" />}
                />

                {/* Flash banner */}
                <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 rounded-2xl px-6 py-6 flex items-center justify-between gap-4 flex-wrap shadow-xl mb-7">
                    <div className="absolute inset-0 pointer-events-none opacity-10 text-[200px] leading-none select-none right-[-20px] top-[-40px] absolute text-white">⚡</div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 flex-shrink-0 bg-white/25 border-2 border-white/30 rounded-xl flex items-center justify-center text-2xl animate-pulse">⚡</div>
                        <div>
                            <div className="text-[19px] font-black text-white tracking-tight">Flash Sale Live Now!</div>
                            <div className="text-xs text-white/90 font-medium mt-0.5">Massive discounts · Limited stock · Don't miss out</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 relative z-10 flex-shrink-0 flex-wrap">
                        <div className="text-[10px] font-extrabold text-white/85 tracking-widest uppercase">Ends in</div>
                        <FlashTimer endsAt={nearestDealEnd} />
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
                        {Array(8).fill(0).map((_, i) => <SkCard key={i} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
                        {deals.map(p => <PCard key={p._id} product={p} showDealBadge />)}
                    </div>
                )}

                {!loading && deals.length > 0 && (
                    <div className="text-center mt-7">
                        <Link to="/deals"
                            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white font-extrabold text-sm tracking-wide shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all">
                            <FaTag size={13} /> View All Deals <FaArrowRight size={12} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   HOME
───────────────────────────────────────────── */
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

    /* ── Fetch homepage data ── */
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
                    const s = bannersRes.value.data; setSlides(s); cache.slides = s;
                }
                if (catsRes.status === "fulfilled" && catsRes.value?.data?.length) {
                    const ecCats = catsRes.value.data.filter(c => c.productType !== "urbexon_hour" && c.type !== "urbexon_hour" && !c.isUrbexonHour);
                    setCategories(ecCats); cache.categories = ecCats;
                }
                if (homeRes.status === "fulfilled") {
                    const d = homeRes.value.data;
                    const f = d.featured || [], na = d.newArrivals || [], dl = d.deals || [];
                    setFeatured(f); setNewArrivals(na); setDeals(dl);
                    cache.featured = f; cache.newArrivals = na; cache.deals = dl;
                    if (d.stats) { setStats(d.stats); cache.stats = d.stats; }
                    const dEnd = dl.map(p => p.dealEndsAt).filter(Boolean).map(d => new Date(d)).filter(d => d > new Date());
                    if (dEnd.length) { const nd = new Date(Math.min(...dEnd)).toISOString(); setNearestDealEnd(nd); cache.nearestDealEnd = nd; }
                }
                _homeCache = cache;
            } finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, []);

    /* ── For You ── */
    useEffect(() => {
        const history = getSearchHistory();
        if (!history.length) return;
        const term = history[0]; setForYouTerm(term);
        api.get(`/products?search=${encodeURIComponent(term)}&productType=ecommerce&limit=8`)
            .then(r => setForYouProducts(r.data?.products || [])).catch(() => { });
    }, []);

    /* ── Hero autoplay ── */
    const resetTimer = useCallback(() => {
        clearInterval(heroTimer.current);
        if (slides.length > 1) heroTimer.current = setInterval(() => setHeroIdx(i => (i + 1) % slides.length), 5000);
    }, [slides.length]);
    useEffect(() => { resetTimer(); return () => clearInterval(heroTimer.current); }, [resetTimer]);
    const goHero = useCallback(dir => { setHeroIdx(i => (i + dir + slides.length) % slides.length); resetTimer(); }, [slides.length, resetTimer]);

    /* ── Search ── */
    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        saveSearchTerm(searchQuery.trim());
        const ctrl = new AbortController();
        setSearching(true);
        api.get(`/products?search=${encodeURIComponent(searchQuery)}&productType=ecommerce&limit=24`, { signal: ctrl.signal })
            .then(r => setSearchResults(r.data?.products || [])).catch(() => { }).finally(() => setSearching(false));
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

    /* ═══════════════════════════════════════
       SEARCH VIEW
    ═══════════════════════════════════════ */
    if (searchQuery.trim()) return (
        <div className="bg-gray-50 min-h-screen">
            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-10 pb-16">
                <div className="mb-5">
                    <h1 className="text-xl font-extrabold text-gray-900">Results for &ldquo;{searchQuery}&rdquo;</h1>
                    <p className="text-[13px] text-gray-500 mt-1 font-medium">
                        {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
                    </p>
                </div>
                {searching ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">{Array(8).fill(0).map((_, i) => <SkCard key={i} />)}</div>
                ) : searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">{searchResults.map(p => <PCard key={p._id} product={p} />)}</div>
                ) : (
                    <div className="text-center py-20 text-gray-400">
                        <FaSearch size={36} className="mx-auto mb-3 text-gray-200" />
                        <div className="font-bold text-base">No products found</div>
                        <div className="text-sm mt-1.5">Try a different search term</div>
                    </div>
                )}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════
       MAIN VIEW
    ═══════════════════════════════════════ */
    return (
        <div className="bg-gray-50 font-[family-name:var(--font-sans,_ui-sans-serif,system-ui)]">
            <SEO title="Premium Online Shopping" description="Shop at Urbexon for the best deals on fashion, electronics, home essentials, and more." path="/" />

            {/* ━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {loading && slides.length === 0 ? (
                <div className="bg-gradient-to-br from-[#2874f0] to-[#1a5dc8] min-h-[360px] relative overflow-hidden">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-16 pb-12">
                        {[120, "80%", "55%"].map((w, i) => (
                            <div key={i} className="h-5 rounded-lg bg-white/10 animate-pulse mb-3" style={{ width: w }} />
                        ))}
                        <div className="h-11 w-36 rounded-xl bg-white/20 animate-pulse mt-4" />
                    </div>
                </div>
            ) : slides.length > 0 ? (
                <div className="relative overflow-hidden min-h-[380px] sm:min-h-[480px] lg:min-h-[560px] w-full bg-gray-100">
                    {slides.map((slide, i) => {
                        const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";
                        return (
                            <div key={slide._id} className={`absolute inset-0 w-full h-full ${i === heroIdx ? "flex" : "hidden"} items-center overflow-hidden`}>
                                <img className="absolute inset-0 w-full h-full object-cover" src={bg} alt={slide.title || "Banner"} loading={i === 0 ? "eager" : "lazy"} />
                                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
                                <div className="max-w-[1280px] mx-auto px-4 lg:px-12 relative z-10 w-full py-16 lg:py-20">
                                    <div className="max-w-[500px] animate-[slideUp_0.5s_ease]">
                                        {slide.tag && (
                                            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-[11px] font-bold text-white tracking-wider uppercase mb-4 backdrop-blur-sm">
                                                🔥 {slide.tag}
                                            </div>
                                        )}
                                        <h1 className="text-[clamp(24px,5vw,54px)] font-black leading-[1.08] text-white mb-3.5 tracking-tight">
                                            {slide.title}
                                            {slide.highlight && <em className="text-yellow-400 not-italic block mt-1.5">{slide.highlight}</em>}
                                        </h1>
                                        {(slide.subtitle || slide.desc || slide.description) && (
                                            <p className="text-[14px] text-white/85 leading-relaxed mb-7 max-w-[460px]">{slide.subtitle || slide.desc || slide.description}</p>
                                        )}
                                        <div className="flex gap-3 flex-wrap">
                                            <button
                                                className="px-7 py-3 border-none rounded-xl bg-white text-[#2874f0] text-[13px] font-extrabold cursor-pointer flex items-center gap-2 shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all"
                                                onClick={() => { const t = slide.link || slide.ctaLink || "/"; t.startsWith("http") ? window.open(t, "_blank", "noopener") : navigate(t); }}>
                                                {slide.buttonText || slide.cta || "Shop Now"} <FaArrowRight size={12} />
                                            </button>
                                            {slide.secondary && (
                                                <button className="px-6 py-3 border-[1.5px] border-white/45 bg-white/10 text-white text-[13px] font-semibold cursor-pointer rounded-xl hover:bg-white/20 hover:border-white/60 transition-all backdrop-blur-sm"
                                                    onClick={() => navigate(slide.secondaryLink || "/deals")}>{slide.secondary}</button>
                                            )}
                                        </div>
                                        <div className="flex gap-3 mt-7 flex-wrap">
                                            {[
                                                { v: "Fast", l: "Delivery" },
                                                { v: stats.products ? `${stats.products.toLocaleString()}+` : "—", l: "Products" },
                                                { v: stats.categories || "—", l: "Categories" },
                                            ].map(({ v, l }) => (
                                                <div key={l} className="bg-white/12 border border-white/18 rounded-xl px-4 py-3 backdrop-blur-sm flex flex-col">
                                                    <span className="text-base font-extrabold text-white">{v}</span>
                                                    <span className="text-[10px] text-white/70 font-semibold uppercase tracking-wider mt-0.5">{l}</span>
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
                            <button className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 border-none cursor-pointer flex items-center justify-center shadow-md hover:scale-105 transition-all text-gray-600 hidden sm:flex"
                                onClick={() => goHero(-1)}><FaChevronLeft size={13} /></button>
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 border-none cursor-pointer flex items-center justify-center shadow-md hover:scale-105 transition-all text-gray-600 hidden sm:flex"
                                onClick={() => goHero(1)}><FaChevronRight size={13} /></button>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                {slides.map((_, i) => (
                                    <button key={i} className={`h-1.5 border-none cursor-pointer rounded-full transition-all bg-white ${i === heroIdx ? "w-5 opacity-100" : "w-1.5 opacity-40"}`}
                                        onClick={() => { setHeroIdx(i); resetTimer(); }} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : !loading && (
                <div className="bg-gradient-to-br from-[#2874f0] to-[#1a5dc8] min-h-[400px] flex items-center relative overflow-hidden">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 w-full relative z-10 py-16">
                        <div className="max-w-[500px]">
                            <h1 className="text-[clamp(24px,5vw,48px)] font-black text-white leading-tight mb-3">
                                Welcome to Urbexon<em className="text-yellow-400 not-italic block mt-2">Shop the Best Deals</em>
                            </h1>
                            <p className="text-sm text-white/85 mb-7 leading-relaxed">Discover amazing products from verified sellers across India.</p>
                            <button className="px-7 py-3 bg-white text-[#2874f0] font-extrabold text-sm rounded-xl border-none cursor-pointer flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all"
                                onClick={() => navigate("/deals")}>Explore Deals <FaArrowRight size={12} /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ UH STRIP ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="bg-gradient-to-r from-violet-700 to-violet-600 cursor-pointer hover:brightness-105 transition-all border-none w-full"
                onClick={() => navigate("/urbexon-hour")}>
                <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                    <div className="flex items-center gap-4 py-4">
                        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-yellow-300 text-lg flex-shrink-0">
                            <FaBolt />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white">Urbexon <strong className="font-extrabold text-yellow-300">Hour</strong></div>
                            <div className="text-xs text-white/65 font-medium mt-0.5">Groceries &amp; essentials in <strong className="text-green-400 font-bold">45 min</strong></div>
                        </div>
                        <span className="hidden sm:inline bg-white/15 border border-white/25 text-white text-[10px] font-extrabold px-3 py-1 rounded-full tracking-widest uppercase flex-shrink-0">FAST DELIVERY</span>
                        <FaArrowRight size={13} className="text-white/40 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>

            {/* ━━ CATEGORIES ━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {(loading || categories.length > 0) && (
                <div className="bg-white border-b border-gray-100">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                        <CategoryBrowser categories={categories} />
                    </div>
                </div>
            )}

            {/* ━━ NEW ARRIVALS ━━━━━━━━━━━━━━━━━━━━━━ */}
            {(loading || newArrivals.length > 0) && (
                <div className="bg-white">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-11">
                        <SecHead title="New Arrivals" sub="Fresh drops, just for you" to="/products?sort=newest" label="See all" />
                        {loading
                            ? <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-hide items-stretch">{Array(6).fill(0).map((_, i) => <div key={i} className="min-w-[200px] h-full"><SkCard /></div>)}</div>
                            : <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-hide items-stretch">{newArrivals.map(p => <div key={p._id} className="min-w-[200px] sm:min-w-[162px] flex-shrink-0 h-full"><PCard product={p} /></div>)}</div>
                        }
                    </div>
                </div>
            )}

            {/* ━━ RECENTLY VIEWED ━━━━━━━━━━━━━━━━━━━ */}
            {recentlyViewed.length > 0 && (
                <div className="bg-gray-50 border-t border-gray-100">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-11">
                        <SecHead title="Recently Viewed" sub="Continue where you left off" />
                        <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-hide items-stretch">
                            {recentlyViewed.slice(0, 12).map(p => <div key={p._id} className="min-w-[200px] flex-shrink-0 h-full"><PCard product={p} /></div>)}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ ALL PRODUCTS ━━━━━━━━━━━━━━━━━━━━━━ */}
            <AllProductsSection />

            {/* ━━ TRENDING ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {(loading || featured.length > 0) && (
                <div className="bg-gray-50 border-t border-gray-100">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-11">
                        <SecHead title="Trending Products" sub="Most popular right now" to="/products?sort=rating" label="See all" />
                        {loading
                            ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">{Array(8).fill(0).map((_, i) => <SkCard key={i} />)}</div>
                            : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">{featured.map(p => <PCard key={p._id} product={p} />)}</div>
                        }
                    </div>
                </div>
            )}

            {/* ━━ FLASH DEALS ━━━━━━━━━━━━━━━━━━━━━━━ */}
            <FlashDealsSection deals={deals} loading={loading} nearestDealEnd={nearestDealEnd} />

            {/* ━━ FOR YOU ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {forYouProducts.length > 0 && (
                <div className="bg-white border-t border-gray-100">
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-11">
                        <SecHead title={`Based on "${forYouTerm}"`} sub="Products picked for you" to={`/?search=${encodeURIComponent(forYouTerm)}`} label="See all" />
                        <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-hide items-stretch">
                            {forYouProducts.map(p => <div key={p._id} className="min-w-[200px] flex-shrink-0 h-full"><PCard product={p} /></div>)}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ WHY CHOOSE ━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="bg-gradient-to-b from-white to-gray-50 border-t border-gray-100">
                <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-11 text-center">
                    <h2 className="text-[22px] font-extrabold text-gray-900 mb-1.5">Why Choose Urbexon?</h2>
                    <p className="text-[13px] text-gray-500 mb-8 font-medium">Your trusted partner for online shopping</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                        {WHY.map(({ Icon, label, sub, bg, iconColor }) => (
                            <div key={label} className="bg-white border-[1.5px] border-gray-100 rounded-2xl px-5 py-7 text-center hover:-translate-y-1.5 hover:shadow-lg hover:border-gray-200 transition-all">
                                <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center mx-auto mb-4`}>
                                    <Icon size={22} className={iconColor} />
                                </div>
                                <div className="text-[15px] font-extrabold text-gray-900 mb-2">{label}</div>
                                <div className="text-[13px] text-gray-500 leading-relaxed font-medium">{sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ━━ NEWSLETTER ━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 py-14">
                <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                    <div className="text-center max-w-[520px] mx-auto">
                        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold bg-blue-900/40 text-blue-300 border border-blue-800/40 mb-4 tracking-wider">✉️ NEWSLETTER</div>
                        <h3 className="text-2xl font-extrabold text-gray-50 mb-2">Stay in the Loop</h3>
                        <p className="text-sm text-white/70 mb-7 leading-relaxed">Get exclusive deals, new arrivals, and offers delivered straight to your inbox.</p>
                        {nlStatus === "done" ? (
                            <p className="text-green-400 font-bold text-sm">✅ Successfully subscribed!</p>
                        ) : (
                            <form className="flex rounded-xl overflow-hidden border border-white/10 bg-white/6 backdrop-blur-sm shadow-md" onSubmit={handleNL}>
                                <input
                                    className="flex-1 px-5 py-3.5 bg-transparent border-none outline-none text-sm text-gray-100 placeholder:text-white/45"
                                    type="email" value={nlEmail} onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                    placeholder="Enter your email address" required
                                />
                                <button type="submit" className="px-7 py-3.5 bg-gradient-to-r from-[#2874f0] to-[#1a5dc8] border-none text-white text-[13px] font-extrabold cursor-pointer hover:brightness-110 hover:-translate-y-0.5 transition-all whitespace-nowrap shadow-md"
                                    disabled={nlStatus === "sending"}>
                                    {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                                </button>
                            </form>
                        )}
                        {nlStatus === "error" && <p className="text-red-400 text-xs mt-2">Failed to subscribe. Please try again.</p>}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
                .scrollbar-hide::-webkit-scrollbar { display:none; }
                .scrollbar-hide { scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default Home;