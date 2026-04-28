/**
 * UrbexonHour.jsx — Production v4 — Full Tailwind, no PAGE_CSS block
 * Color scheme: violet/purple (matches UH Navbar)
 */
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../hooks/useCart";
import {
    FaBolt, FaMapMarkerAlt, FaStore, FaShoppingCart,
    FaClock, FaStar, FaChevronRight, FaSearch, FaBell,
    FaPlus, FaMinus, FaTimes, FaTrash, FaFire,
} from "react-icons/fa";
import NearbyShops from "../components/NearbyShops";
import CategoryBrowser from "../components/CategoryBrowser";
import UHBannerCarousel from "../components/uh/UHBannerCarousel";
import UHCategoryStrip from "../components/uh/UHCategoryStrip";
import UHProductSection from "../components/uh/UHProductSection";
import UHMidBanner from "../components/uh/UHMidBanner";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import SEO from "../components/SEO";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ── Live Countdown ── */
const LiveCountdown = memo(({ endsAt }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        if (!endsAt) return;
        const update = () => {
            const diff = new Date(endsAt) - new Date();
            if (diff <= 0) { setTimeLeft("Expired"); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${h}h ${m}m ${s}s left`);
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [endsAt]);

    if (!timeLeft || timeLeft === "Expired") return null;
    return <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-orange-50 border-t border-orange-100 text-[11px] font-bold text-orange-600"><FaClock size={9} /> {timeLeft}</div>;
});

/* ── Product Card ── */
const ProductCard = memo(({ product }) => {
    const { addItem, isInUHCart, uhItems, increment, decrement, removeItem } = useCart();
    const inCart = isInUHCart(product._id);
    const cartItem = uhItems.find((i) => i._id === product._id);
    const qty = cartItem?.quantity || 0;
    const nav = useNavigate();

    const discount = product.mrp && product.mrp > product.price
        ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

    const handleAdd = useCallback((e) => {
        e.stopPropagation();
        if (!inCart) { addItem({ ...product, productType: "urbexon_hour", quantity: 1 }); if (navigator.vibrate) navigator.vibrate(10); }
    }, [inCart, product, addItem]);

    const handleCardClick = useCallback(() => nav(`/uh-product/${product.slug || product._id}`), [nav, product]);

    return (
        <div
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-gray-200 flex flex-col group"
            onClick={handleCardClick} role="link"
        >
            <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden flex-shrink-0">
                {discount > 0 && (
                    <span className="absolute top-0 left-0 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-extrabold px-2.5 py-1.5 rounded-br-xl leading-tight text-center z-10">
                        {discount}%<br />OFF
                    </span>
                )}
                {product.tag && (
                    <span className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[9px] font-bold px-2 py-1 rounded-md animate-pulse z-10 shadow-md">
                        {product.tag}
                    </span>
                )}
                {product.rating >= 4 && (
                    <span className="absolute bottom-2 left-2 bg-black/65 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-1 rounded-md flex items-center gap-1 z-10">
                        <FaStar size={8} className="text-yellow-400" /> {product.rating.toFixed(1)}
                    </span>
                )}
                <img
                    src={product.images?.[0]?.url || product.image?.url || product.image || "/placeholder.png"}
                    alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy"
                    onError={(e) => { e.target.src = "/placeholder.png"; }}
                />
                {!product.inStock && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center text-xs font-bold text-gray-500 uppercase tracking-widest z-20">
                        Out of Stock
                    </div>
                )}
            </div>
            <div className="p-3 flex flex-col gap-1 flex-1">
                {product.brand && <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">{product.brand}</div>}
                <div className="text-[13px] font-semibold text-gray-700 leading-snug line-clamp-2">{product.name}</div>
                {product.prepTimeMinutes && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                        <FaClock size={9} /> {product.prepTimeMinutes} min
                    </div>
                )}
                <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
                    <span className="text-base font-black text-gray-900">{fmt(product.price)}</span>
                    {product.mrp && product.mrp > product.price && <span className="text-[11px] text-gray-400 line-through">{fmt(product.mrp)}</span>}
                    {discount > 0 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{discount}% off</span>}
                </div>

                {product.inStock === false ? (
                    <button className="mt-auto w-full py-2 text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed uppercase tracking-wide" disabled>
                        Out of Stock
                    </button>
                ) : !inCart ? (
                    <button
                        className="mt-auto w-full py-2.5 text-[13px] font-bold bg-white border border-green-500 text-green-600 rounded-lg cursor-pointer hover:bg-green-500 hover:text-white transition-all uppercase tracking-wide hover:shadow-md active:scale-95"
                        onClick={handleAdd}>ADD
                    </button>
                ) : (
                    <div className="mt-auto flex items-center justify-between bg-green-500 rounded-lg overflow-hidden border border-green-500">
                        <button
                            className="w-9 h-9 border-none bg-transparent text-white cursor-pointer flex items-center justify-center hover:bg-white/15 transition-colors active:scale-90"
                            onClick={(e) => { e.stopPropagation(); if (qty <= 1) removeItem(product._id, "urbexon_hour"); else decrement(product._id, "urbexon_hour"); }}>
                            {qty <= 1 ? <FaTrash size={9} /> : <FaMinus size={9} />}
                        </button>
                        <span className="flex-1 text-center text-[15px] font-black text-white select-none">{qty}</span>
                        <button
                            className="w-9 h-9 border-none bg-transparent text-white cursor-pointer flex items-center justify-center hover:bg-white/15 transition-colors active:scale-90"
                            onClick={(e) => { e.stopPropagation(); increment(product._id, "urbexon_hour"); }}>
                            <FaPlus size={9} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});

/* ── Helpers ── */
const calculateEstimatedDeliveryTime = (pinData) => {
    if (!pinData?.available) return { min: 45, max: 120 };
    if (pinData.premium) return { min: 25, max: 50 };
    if (pinData.standardDelivery) return { min: 45, max: 90 };
    return { min: 60, max: 120 };
};

const calculateEstimatedSavings = (uhItems) => {
    if (!Array.isArray(uhItems) || uhItems.length === 0) return 0;
    return uhItems.reduce((total, item) => total + (((item.mrp || 0) - (item.price || 0)) * (item.quantity || 0)), 0);
};

const CATEGORY_EMOJIS = {
    dairy: "🥛", milk: "🥛", vegetables: "🥦", veggies: "🥦", fruits: "🍎", fruit: "🍎",
    bakery: "🍞", bread: "🍞", meat: "🥩", chicken: "🍗", drinks: "🧃", beverages: "🥤",
    frozen: "🍦", pantry: "🫙", groceries: "🛒", electronics: "📱", fashion: "👔", lifestyle: "✨",
    snacks: "🍿", default: "📦",
};
const getCategoryEmoji = (cat) => {
    if (!cat) return "📦";
    const key = cat.toLowerCase().replace(/[^a-z]/g, "");
    for (const [k, v] of Object.entries(CATEGORY_EMOJIS)) { if (key.includes(k)) return v; }
    return CATEGORY_EMOJIS.default;
};

/* ── Main Page ── */
const UrbexonHour = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { slug } = useParams();
    const { user } = useAuth();
    const { uhTotalQty, uhTotal, uhItems } = useCart();
    const { recentlyViewed: uhRecentlyViewed } = useRecentlyViewed("urbexon_hour");

    const [pincode, setPincode] = useState("");
    const [pinData, setPinData] = useState(null);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [apiCategories, setApiCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [error, setError] = useState("");
    const [waitlistEmail, setWaitlistEmail] = useState("");
    const [waitlistSuccess, setWaitlistSuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [savedPincode, setSavedPincode] = useState(() => {
        try { const stored = localStorage.getItem("uh_pincode"); if (stored) { const p = JSON.parse(stored); if (p?.code && /^\d{6}$/.test(p.code)) return p; } } catch { }
        return null;
    });
    const [initialLoading, setInitialLoading] = useState(() => {
        try { const stored = localStorage.getItem("uh_pincode"); if (stored) { const p = JSON.parse(stored); if (p?.code) return true; } } catch { }
        return false;
    });
    const [showPincodeEdit, setShowPincodeEdit] = useState(false);
    const searchQuery = searchParams.get("search") || "";
    const [uhDeals, setUhDeals] = useState([]);
    const [cartAnimating, setCartAnimating] = useState(false);
    const [heroBanners, setHeroBanners] = useState([]);
    const [midBanners, setMidBanners] = useState([]);
    const [homepageData, setHomepageData] = useState(null);

    const clearSearch = useCallback(() => {
        setSearchParams(prev => { prev.delete("search"); return prev; }, { replace: true });
    }, [setSearchParams]);

    const handleCategorySelect = useCallback((catName) => {
        if (!catName) { navigate("/urbexon-hour", { replace: true }); setActiveCategory(null); return; }
        const matched = apiCategories.find(c => c.name === catName);
        const urlSlug = matched?.slug || catName.toLowerCase().replace(/\s+/g, "-");
        navigate(`/urbexon-hour/${urlSlug}`);
        setActiveCategory(catName);
    }, [apiCategories, navigate]);

    useEffect(() => {
        api.get("/categories", { params: { type: "urbexon_hour" } }).then(({ data }) => {
            const cats = Array.isArray(data) ? data : data.categories || [];
            setApiCategories(cats.filter(c => c.isActive !== false));
        }).catch(() => { });
    }, []);

    useEffect(() => {
        if (!slug) { setActiveCategory(null); return; }
        const decoded = decodeURIComponent(slug).toLowerCase().replace(/-/g, " ");
        const matched = apiCategories.find(c =>
            c.slug?.toLowerCase() === slug.toLowerCase() ||
            c.name?.toLowerCase() === decoded ||
            c.name?.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase()
        );
        setActiveCategory(matched ? matched.name : null);
    }, [slug, apiCategories]);

    useEffect(() => {
        api.get("/banners", { params: { type: "urbexon_hour", placement: "hero" } }).then(({ data }) => setHeroBanners(Array.isArray(data) ? data : [])).catch(() => { });
        api.get("/banners", { params: { type: "urbexon_hour", placement: "mid" } }).then(({ data }) => setMidBanners(Array.isArray(data) ? data : [])).catch(() => { });
        api.get("/products/urbexon-hour/homepage").then(({ data }) => setHomepageData(data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (uhTotalQty > 0) { setCartAnimating(true); const t = setTimeout(() => setCartAnimating(false), 600); return () => clearTimeout(t); }
    }, [uhTotalQty]);

    const checkPincodeInner = async (code) => {
        const pc = code.trim();
        if (!/^\d{6}$/.test(pc)) return;
        setLoading(true); setError(""); setPinData(null); setProducts([]); setCategories([]); setActiveCategory(null);
        try {
            const { data } = await api.get(`/pincode/check/${pc}`);
            setPinData(data);
            if (data.available) {
                const [pRes, dRes, hRes] = await Promise.allSettled([
                    api.get("/products/urbexon-hour", { params: { pincode: pc, limit: 60 } }),
                    api.get("/products/urbexon-hour/deals", { params: { limit: 12, pincode: pc } }),
                    api.get("/products/urbexon-hour/homepage", { params: { pincode: pc } })
                ]);
                const prods = pRes.status === "fulfilled" ? (pRes.value.data.products || pRes.value.data || []) : [];
                setProducts(prods);
                const catSet = new Set();
                prods.forEach((p) => { if (p.category) catSet.add(p.category); });
                setCategories([...catSet]);
                setUhDeals(dRes.status === "fulfilled" ? (dRes.value.data.products || []) : []);
                if (hRes.status === "fulfilled") setHomepageData(hRes.value.data);
                const pincodeData = { code: pc, area: data.area || null, city: data.city || null, state: data.state || null };
                localStorage.setItem("uh_pincode", JSON.stringify(pincodeData));
                setSavedPincode(pincodeData);
                setShowPincodeEdit(false);
                if (user) api.post("/addresses/uh-pincode", pincodeData).catch(() => { });
            }
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to check pincode. Please try again.");
        } finally { setLoading(false); }
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            let code = null;
            if (user) {
                try {
                    const { data } = await api.get("/addresses/uh-pincode");
                    if (data?.uhPincode?.code && !cancelled) {
                        const localStored = (() => { try { return JSON.parse(localStorage.getItem("uh_pincode") || "{}"); } catch { return {}; } })();
                        const merged = { ...data.uhPincode, area: data.uhPincode.area || localStored.area || null, city: data.uhPincode.city || localStored.city || null, state: data.uhPincode.state || localStored.state || null };
                        setSavedPincode(merged); setPincode(merged.code); code = merged.code;
                    }
                } catch { }
            }
            if (!code && savedPincode?.code) { code = savedPincode.code; setPincode(code); }
            if (code && !cancelled) await checkPincodeInner(code);
            if (!cancelled) setInitialLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line

    const detectLocation = useCallback(async () => {
        setLocationLoading(true); setError("");
        try {
            if (!navigator.geolocation) { setError("Location not supported in your browser"); setLocationLoading(false); return; }
            navigator.geolocation.getCurrentPosition(
                async ({ coords: { latitude, longitude } }) => {
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`, { headers: { "Accept-Language": "en" } });
                        if (!res.ok) throw new Error("Geocoding failed");
                        const data = await res.json();
                        const pc = data.address?.postcode;
                        if (pc && /^\d{6}$/.test(pc)) { setPincode(pc); await checkPincodeInner(pc); }
                        else setError("Could not detect your pincode. Please enter it manually.");
                    } catch { setError("Could not fetch location details. Please enter pincode manually."); }
                    finally { setLocationLoading(false); }
                },
                (err) => {
                    setLocationLoading(false);
                    if (err.code === 1) setError("Location permission denied. Please enter pincode manually.");
                    else if (err.code === 2) setError("Location unavailable. Please enter pincode manually.");
                    else setError("Location timeout. Please enter pincode manually.");
                },
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
            );
        } catch { setLocationLoading(false); setError("Location detection failed. Please enter pincode manually."); }
    }, []);

    const checkPincode = useCallback(() => {
        if (!/^\d{6}$/.test(pincode.trim())) { setError("Please enter a valid 6-digit pincode"); return; }
        checkPincodeInner(pincode);
    }, [pincode, user]); // eslint-disable-line

    const handleChangePincode = useCallback(() => {
        setShowPincodeEdit(true); setPincode(""); setPinData(null); setProducts([]); setCategories([]); setActiveCategory(null); setUhDeals([]);
    }, []);

    const joinWaitlist = useCallback(async () => {
        if (!waitlistEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail)) { setError("Please enter a valid email address"); return; }
        try { await api.post("/pincode/waitlist", { code: pincode, email: waitlistEmail }); setWaitlistSuccess(true); setError(""); }
        catch (err) { setError(err?.response?.data?.message || "Failed to join waitlist"); }
    }, [waitlistEmail, pincode]);

    const groupByVendor = useCallback((prods) => {
        const map = {};
        prods.forEach((p) => {
            const vid = typeof p.vendorId === "object" ? p.vendorId?._id : p.vendorId || "unknown";
            const vname = typeof p.vendorId === "object" ? p.vendorId?.shopName : p.vendorName || "Local Store";
            if (!map[vid]) map[vid] = { vendorId: vid, vendorName: vname ?? "Local Store", products: [] };
            map[vid].products.push(p);
        });
        return Object.values(map);
    }, []);

    const filteredProducts = useMemo(() => {
        let prods = products;
        if (activeCategory) prods = prods.filter((p) => p.category === activeCategory);
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            prods = prods.filter((p) => p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
        }
        return prods;
    }, [products, activeCategory, searchQuery]);

    const vendorGroups = groupByVendor(filteredProducts);
    const cartSavings = useMemo(() => calculateEstimatedSavings(uhItems), [uhItems]);
    const deliveryEta = useMemo(() => calculateEstimatedDeliveryTime(pinData), [pinData]);

    const hasActiveService = pinData?.available;
    const showHero = (!savedPincode?.code && !hasActiveService && !loading && !initialLoading) || showPincodeEdit;
    const showSkeleton = (loading || initialLoading) && savedPincode?.code && !showPincodeEdit;
    const isHomepageEmpty = !homepageData?.bestSellers?.length && !homepageData?.recommended?.length && !homepageData?.topDeals?.length && !homepageData?.trending?.length && !uhDeals.length;
    const showVendorGroups = Boolean(searchQuery || activeCategory || isHomepageEmpty);

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden antialiased">
            <SEO title="Urbexon Hour - Quick Delivery" description="Get groceries, essentials, and more delivered in minutes with Urbexon Hour." path="/urbexon-hour" />
            <main>

                {/* ── UH LOCATION BAR ── */}
                {(hasActiveService || showSkeleton) && !showPincodeEdit && (
                    <div className="bg-gradient-to-r from-violet-700 to-violet-600 border-b border-violet-500/30">
                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12 flex items-center justify-between py-2.5">
                            <div className="flex items-center gap-2.5 text-[13px] text-white/85 font-semibold">
                                <FaBolt size={12} className="text-yellow-300 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]" />
                                <span className="text-white/50 text-xs">Delivering to</span>
                                <span className="text-white font-bold">{savedPincode?.area || savedPincode?.city || pincode}</span>
                                <span className="text-yellow-300 font-bold text-xs">• {deliveryEta.min}–{deliveryEta.max} min</span>
                            </div>
                            <button
                                className="bg-white/10 border border-white/25 text-white/90 px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer hover:bg-white/20 hover:border-white/40 transition-all"
                                onClick={handleChangePincode}>Change</button>
                        </div>
                    </div>
                )}

                {/* ── HERO ── */}
                {showHero && (
                    <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-violet-600 to-purple-500">
                        <div className="absolute inset-0 opacity-10 pointer-events-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12 relative z-10">
                            <div className="flex items-center gap-12 py-16 lg:py-20 justify-between">
                                <div className="flex-1">
                                    <div className="inline-flex items-center gap-1.5 bg-white/20 border border-white/40 text-white text-[11px] font-bold tracking-wider uppercase px-3.5 py-1.5 rounded-full mb-4 backdrop-blur-sm">
                                        <FaBolt size={10} /> 45–120 Min Delivery
                                    </div>
                                    <h1 className="text-[clamp(28px,5vw,48px)] font-extrabold leading-tight text-white mb-3 tracking-tight">
                                        Express delivery<br />in <em className="not-italic bg-gradient-to-r from-yellow-300 to-amber-200 bg-clip-text text-transparent">record time</em>
                                    </h1>
                                    <p className="text-base text-white/85 mb-7 max-w-[480px] leading-relaxed">Products from local vendors, delivered fast right to your door.</p>

                                    <div className="max-w-[600px]">
                                        <div className="flex gap-3 mb-3 flex-wrap">
                                            <div className="flex-1 min-w-[200px] relative flex items-center">
                                                <FaSearch size={13} className="absolute left-3.5 text-gray-400 pointer-events-none" />
                                                <input
                                                    className="w-full pl-10 pr-4 py-3 bg-white rounded-xl text-[15px] font-semibold tracking-wider text-gray-800 outline-none shadow-lg focus:shadow-xl transition-shadow placeholder:text-gray-400 placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
                                                    type="tel" inputMode="numeric" maxLength={6}
                                                    placeholder="Enter 6-digit pincode"
                                                    value={pincode}
                                                    onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setPincode(v); setError(""); setPinData(null); }}
                                                    onKeyDown={(e) => { if (e.key === "Enter" && pincode.length === 6) checkPincode(); }}
                                                />
                                            </div>
                                            <button
                                                className="px-7 py-3 bg-white text-violet-700 font-extrabold text-[13px] rounded-xl border-none cursor-pointer shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                                                onClick={checkPincode} disabled={loading || pincode.length !== 6}>
                                                {loading ? <span className="w-3.5 h-3.5 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin inline-block" /> : "Check"}
                                            </button>
                                        </div>
                                        <button
                                            className="bg-transparent border-none text-white/75 text-xs cursor-pointer flex items-center gap-1.5 px-3.5 py-2 font-semibold hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
                                            onClick={detectLocation} disabled={locationLoading}>
                                            <FaMapMarkerAlt size={11} />
                                            {locationLoading ? "Detecting location…" : "Use my current location"}
                                        </button>
                                        {savedPincode && showPincodeEdit && (
                                            <button
                                                className="bg-transparent border-none text-white/75 text-xs cursor-pointer flex items-center gap-1.5 px-3.5 py-2 font-semibold hover:text-white hover:bg-white/10 rounded-lg transition-all mt-1"
                                                onClick={() => { setPincode(savedPincode.code); checkPincodeInner(savedPincode.code); setShowPincodeEdit(false); }}>
                                                ← Back to {savedPincode.area || savedPincode.city || savedPincode.code}
                                            </button>
                                        )}
                                        {error && <div className="text-red-200 text-xs mt-2 font-medium">{error}</div>}
                                    </div>
                                </div>

                                <div className="hidden md:flex relative w-[clamp(120px,20vw,260px)] flex-shrink-0 h-[clamp(150px,20vw,260px)] items-center justify-center">
                                    <div className="absolute w-52 h-52 rounded-full bg-white/6 -right-10 -top-8" />
                                    <div className="absolute w-32 h-32 rounded-full bg-white/8 right-8 bottom-5" />
                                    <span className="text-[clamp(80px,12vw,140px)] relative z-10 filter drop-shadow-[0_8px_24px_rgba(0,0,0,0.2)] animate-bounce" style={{ animationDuration: "3s" }}>🛵</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TRUST STRIP ── */}
                {(hasActiveService || showSkeleton) && !showPincodeEdit && (
                    <div className="bg-white border-b border-t border-gray-100 shadow-sm">
                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                            <div className="grid grid-cols-2 md:grid-cols-4">
                                {[
                                    { ic: "🚀", t: "EXPRESS DELIVERY", sub: `${deliveryEta.min}–${deliveryEta.max} min`, accent: "bg-blue-50 border-blue-100" },
                                    { ic: "✅", t: "QUALITY CHECKED", sub: "100% verified products", accent: "bg-green-50 border-green-100" },
                                    { ic: "🏪", t: "LOCAL VENDORS", sub: `${homepageData?.stats?.totalVendors || vendorGroups.length || "0"} verified stores`, accent: "bg-violet-50 border-violet-100" },
                                    { ic: "🔒", t: "SECURE PAYMENTS", sub: "256-bit encrypted", accent: "bg-amber-50 border-amber-100" },
                                ].map((f, i) => (
                                    <div key={f.t} className={`flex items-center gap-3 px-4 lg:px-6 py-4 lg:py-5 border-r border-gray-100 last:border-r-0 transition-colors hover:bg-gray-50 ${i >= 2 ? "border-t md:border-t-0" : ""}`}
                                        style={{ animationDelay: `${i * 80}ms` }}>
                                        <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${f.accent}`}>
                                            <span className="text-lg md:text-xl">{f.ic}</span>
                                        </div>
                                        <div>
                                            <div className="text-[10px] md:text-[11px] font-extrabold text-gray-800 tracking-wider uppercase">{f.t}</div>
                                            <div className="text-[10px] md:text-[11.5px] text-gray-500 mt-0.5 font-medium">{f.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SKELETON LOADING ── */}
                {showSkeleton && (
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-5">
                        <div className="flex gap-4 mb-5">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex flex-col items-center gap-2">
                                    <div className="w-14 h-14 rounded-2xl bg-gray-200 animate-pulse" />
                                    <div className="w-12 h-2.5 rounded bg-gray-200 animate-pulse" />
                                </div>
                            ))}
                        </div>
                        <div className="h-5 w-36 rounded bg-gray-200 animate-pulse mb-4" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
                                    <div className="aspect-square bg-gray-200 animate-pulse" />
                                    <div className="p-3 space-y-2">
                                        <div className="h-2.5 w-4/5 bg-gray-200 rounded animate-pulse" />
                                        <div className="h-2.5 w-1/2 bg-gray-200 rounded animate-pulse" />
                                        <div className="h-2.5 w-2/5 bg-gray-200 rounded animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ HOMEPAGE SECTIONS ═══ */}
                {hasActiveService && !showPincodeEdit && !searchQuery && !activeCategory && (
                    <>
                        {heroBanners.length > 0 && (
                            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-5">
                                <UHBannerCarousel banners={heroBanners} />
                            </div>
                        )}

                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-5">
                            <UHCategoryStrip categories={apiCategories} activeCategory={activeCategory} onSelect={handleCategorySelect} />
                        </div>

                        {homepageData?.categorySections && Object.keys(homepageData.categorySections).some(k => homepageData.categorySections[k]?.length >= 3) && (
                            <div className="bg-gradient-to-b from-gray-50 to-white border-y border-gray-100 mt-4 py-1">
                                <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                                    <div className="flex items-center gap-3.5 py-5 pb-1">
                                        <span className="text-3xl filter drop-shadow-sm">🏬</span>
                                        <div>
                                            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Shop by Category</h2>
                                            <p className="text-xs text-gray-500 mt-0.5 font-medium">Browse products organized by what you need</p>
                                        </div>
                                    </div>
                                </div>
                                {Object.entries(homepageData.categorySections).map(([catName, prods]) =>
                                    prods.length >= 3 && (
                                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12" key={catName}>
                                            <UHProductSection title={catName} subtitle={`${prods.length} products`} icon={getCategoryEmoji(catName)} products={prods} renderCard={(p) => <ProductCard product={p} />} />
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {uhDeals.length > 0 && (
                            <div className="bg-white border-y border-gray-100 mt-4 py-6">
                                <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                                    <div className="flex items-center gap-3.5 mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center text-white text-xl shadow-lg shadow-orange-200">
                                            <FaFire size={14} />
                                        </div>
                                        <div>
                                            <div className="text-xl font-extrabold text-gray-900 tracking-tight">Flash Deals</div>
                                            <div className="text-xs text-gray-500 mt-0.5 font-medium">
                                                {uhDeals.length} hot offer{uhDeals.length !== 1 ? "s" : ""} — grab before they expire!
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3.5 overflow-x-auto pb-2.5 scrollbar-hide snap-x">
                                        {uhDeals.map((p) => (
                                            <div key={p._id} className="min-w-[200px] max-w-[220px] flex-shrink-0 snap-start bg-white border-[1.5px] border-gray-100 rounded-2xl overflow-hidden hover:border-orange-400 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                                <ProductCard product={p} />
                                                <LiveCountdown endsAt={p.dealEndsAt} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {homepageData?.bestSellers?.length > 0 && <div className="max-w-[1280px] mx-auto px-4 lg:px-12"><UHProductSection title="Best Sellers" subtitle="Most popular in your area" icon="🔥" products={homepageData.bestSellers} renderCard={(p) => <ProductCard product={p} />} /></div>}
                        {homepageData?.topDeals?.length > 0 && <div className="max-w-[1280px] mx-auto px-4 lg:px-12"><UHProductSection title="Top Deals" subtitle="Biggest discounts right now" icon="💰" products={homepageData.topDeals} renderCard={(p) => <ProductCard product={p} />} /></div>}

                        {midBanners.length > 0 && (
                            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-3">
                                <UHMidBanner banners={midBanners} />
                            </div>
                        )}

                        {homepageData?.trending?.length > 0 && <div className="max-w-[1280px] mx-auto px-4 lg:px-12"><UHProductSection title="Trending Now" subtitle="What everyone is buying" icon="📈" products={homepageData.trending} renderCard={(p) => <ProductCard product={p} />} /></div>}
                        {homepageData?.budgetPicks?.length > 0 && <div className="max-w-[1280px] mx-auto px-4 lg:px-12"><UHProductSection title="Budget Picks" subtitle="Best deals under ₹500" icon="🏷️" products={homepageData.budgetPicks} renderCard={(p) => <ProductCard product={p} />} /></div>}

                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                            <NearbyShops pincode={pincode} pincodeLabel={savedPincode?.area || savedPincode?.city || ''} maxResults={12} />
                        </div>

                        {uhRecentlyViewed.length > 0 && (
                            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-3">
                                <UHProductSection title="Recently Viewed" subtitle="Continue where you left off" icon="🕐" products={uhRecentlyViewed.slice(0, 10)} renderCard={(p) => <ProductCard product={p} />} />
                            </div>
                        )}

                        {homepageData?.recommended?.length > 0 && <div className="max-w-[1280px] mx-auto px-4 lg:px-12"><UHProductSection title="Fresh Arrivals" subtitle="Just landed on the platform" icon="✨" products={homepageData.recommended} renderCard={(p) => <ProductCard product={p} />} /></div>}

                        {/* Why section */}
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border-t border-violet-100 py-10 mt-4">
                            <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                                <h3 className="text-[clamp(18px,3.5vw,22px)] font-extrabold text-gray-900 text-center mb-7 tracking-tight">Why shop on Urbexon Hour?</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { ic: "🏪", title: "Support Local", desc: "Every order helps local vendors & small businesses grow" },
                                        { ic: "🕐", title: "Superfast Delivery", desc: `Get your order in ${deliveryEta.min}-${deliveryEta.max} minutes flat` },
                                        { ic: "🛡️", title: "Quality Promise", desc: "Every product is quality checked before dispatch" },
                                        { ic: "💯", title: "Best Prices", desc: "We match prices so you always get the best deal" },
                                    ].map(item => (
                                        <div key={item.title}
                                            className="bg-white border border-violet-100 rounded-2xl px-4 py-6 text-center hover:-translate-y-1 hover:shadow-lg hover:border-violet-200 transition-all relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <span className="text-3xl block mb-3 filter drop-shadow-sm">{item.ic}</span>
                                            <h4 className="text-sm font-extrabold text-gray-900 mb-1.5 tracking-tight">{item.title}</h4>
                                            <p className="text-xs text-gray-500 leading-relaxed font-medium">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── CATEGORY BROWSER (search/filter active) ── */}
                {hasActiveService && !showPincodeEdit && (searchQuery || activeCategory) && (
                    <div className="bg-white border-b border-gray-100 py-6">
                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                            <CategoryBrowser categories={apiCategories} onCategorySelect={handleCategorySelect} activeCategory={activeCategory}
                                title="Shop by Category" subtitle={activeCategory ? `Showing: ${activeCategory}` : "Tap to filter by category"} type="urbexon_hour" />
                        </div>
                    </div>
                )}

                {/* ── SEARCH RESULTS BAR ── */}
                {searchQuery && hasActiveService && !showPincodeEdit && (
                    <div className="bg-blue-50 border-b-2 border-[#2874f0] border-t border-blue-100 mt-3 animate-[slideDown_0.3s_ease]">
                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12 flex items-center gap-2 py-3">
                            <FaSearch size={13} className="text-blue-500 flex-shrink-0" />
                            <span className="text-[13px] text-blue-800 font-medium flex-1 min-w-0 truncate">
                                Found <strong className="text-blue-900 font-bold">{filteredProducts.length}</strong> product{filteredProducts.length !== 1 ? "s" : ""} matching "<strong className="font-bold">{searchQuery}</strong>"
                            </span>
                            <button className="flex items-center gap-1.5 bg-red-100 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer hover:bg-red-200 transition-colors flex-shrink-0"
                                onClick={clearSearch}><FaTimes size={12} /> Clear</button>
                        </div>
                    </div>
                )}

                {/* ── PRODUCTS BY VENDOR ── */}
                {pinData?.available && showVendorGroups && (
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-4">
                        {filteredProducts.length === 0 && !loading && (
                            <div className="py-20 text-center flex flex-col items-center gap-3.5">
                                <FaStore size={40} className="text-gray-200" />
                                <div className="text-lg font-extrabold text-gray-800">
                                    {activeCategory ? `No products in "${activeCategory}"` : searchQuery ? `No results for "${searchQuery}"` : "No products available yet"}
                                </div>
                                <div className="text-sm text-gray-500">We are expanding fast. Check back soon!</div>
                                <button className="mt-4 px-6 py-2.5 bg-violet-600 text-white font-bold text-sm rounded-xl border-none cursor-pointer hover:bg-violet-700 transition-colors"
                                    onClick={() => { handleCategorySelect(null); clearSearch(); }}>Show all products</button>
                            </div>
                        )}

                        {vendorGroups.map((group) => (
                            <div key={group.vendorId} className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden transition-all hover:border-gray-200 hover:shadow-md">
                                <div className="flex items-center gap-3.5 px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-50">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 text-xl">
                                        <FaStore size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-extrabold text-gray-900 tracking-tight">{group.vendorName}</div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 font-medium flex-wrap">
                                            <span className="flex items-center gap-1"><FaStar size={10} className="text-amber-400" /> {(group.products[0]?.vendorId?.rating || 4.0).toFixed(1)}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1"><FaClock size={10} /> {deliveryEta.min}–{deliveryEta.max} min</span>
                                            <span>•</span>
                                            <span>{group.products.length} items</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                    {group.products.map((p) => <ProductCard key={p._id} product={p} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── NOT IN AREA ── */}
                {pinData && !pinData.available && pinData.status === "not_found" && (
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-6">
                        <div className="bg-white border border-gray-100 rounded-2xl px-8 py-16 text-center flex flex-col items-center shadow-sm">
                            <div className="text-5xl mb-4">📍</div>
                            <div className="text-xl font-extrabold text-gray-900 mb-2.5 tracking-tight">We are not in your area yet</div>
                            <div className="text-sm text-gray-500 mb-6 leading-relaxed">Pincode <strong className="font-bold text-gray-700">{pincode}</strong> is not covered. We are expanding fast!</div>
                        </div>
                    </div>
                )}

                {/* ── WAITLIST ── */}
                {pinData && !pinData.available && pinData.status !== "not_found" && !waitlistSuccess && (
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-6">
                        <div className="bg-white border border-gray-100 rounded-2xl px-8 py-16 text-center flex flex-col items-center shadow-sm">
                            <FaBell size={32} className="text-violet-700 mb-3" />
                            <div className="text-xl font-extrabold text-gray-900 mb-2.5">Launching soon in your area!</div>
                            <div className="text-sm text-gray-500 mb-6 leading-relaxed max-w-md">
                                {pinData.status === "coming_soon" ? "Be the first to know when we go live." : pinData.message}
                            </div>
                            <div className="flex gap-3 w-full max-w-[480px] flex-wrap">
                                <input type="email" placeholder="your@email.com" value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)}
                                    className="flex-1 min-w-[200px] px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-800 outline-none focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all" />
                                <button onClick={joinWaitlist}
                                    className="px-5 py-3 bg-violet-600 border-none rounded-xl text-white font-extrabold text-[13px] cursor-pointer hover:bg-violet-700 transition-colors hover:-translate-y-0.5 shadow-md whitespace-nowrap">
                                    Notify Me
                                </button>
                            </div>
                            {error && <div className="text-red-500 text-xs mt-2 font-medium">{error}</div>}
                        </div>
                    </div>
                )}

                {waitlistSuccess && (
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-6">
                        <div className="bg-green-50 border border-green-200 rounded-2xl text-green-700 font-bold text-sm text-center py-4 px-5">
                            ✅ You are on the waitlist! We will notify you when we launch in your area.
                        </div>
                    </div>
                )}

                <div className="h-20" />
            </main>

            {/* ── FLOATING CART ── */}
            {uhTotalQty > 0 && (
                <button
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-green-600 text-white border-none cursor-pointer flex items-center gap-3 px-5 py-3 rounded-full font-bold shadow-[0_8px_32px_rgba(34,197,94,0.35)] z-50 whitespace-nowrap max-w-[calc(100vw-32px)] transition-all hover:-translate-x-1/2 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(34,197,94,0.4)] active:-translate-y-0.5 ${cartAnimating ? "scale-105" : ""}`}
                    onClick={() => navigate("/uh-cart")}
                    title={`${uhTotalQty} item${uhTotalQty !== 1 ? 's' : ''} • ${fmt(uhTotal)}`}
                    style={{ transform: cartAnimating ? "translateX(-50%) scale(1.05)" : undefined }}
                >
                    <div className="relative flex items-center justify-center flex-shrink-0">
                        <FaShoppingCart size={16} />
                        <span className="absolute -top-2 -right-2 bg-white text-green-600 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center border-2 border-green-500 shadow">{uhTotalQty}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-[60px]">
                        <div className="text-xs font-bold opacity-90">{uhTotalQty} item{uhTotalQty !== 1 ? "s" : ""}</div>
                        <div className="text-[15px] font-black tracking-tight">{fmt(uhTotal)}</div>
                    </div>
                    <div className="flex flex-col gap-0.5 text-[10px] opacity-90">
                        {cartSavings > 0 && <span className="bg-white/20 px-1.5 py-0.5 rounded font-bold">Save {fmt(cartSavings)}</span>}
                        {pinData && <span className="bg-white/15 px-1.5 py-0.5 rounded font-bold">{deliveryEta.min}-{deliveryEta.max} min</span>}
                    </div>
                    <FaChevronRight size={12} className="opacity-80 flex-shrink-0" />
                </button>
            )}

            {/* ── FOOTER ── */}
            <footer className="bg-gradient-to-br from-gray-900 to-gray-800 border-t-2 border-violet-900/30 mt-16 pb-24">
                <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                        <div className="max-w-sm">
                            <div className="flex items-start gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-500 flex items-center justify-center font-black text-[13px] text-white flex-shrink-0">UX</div>
                                <div>
                                    <div className="font-extrabold text-base text-white tracking-tight">URBEXON<em className="text-yellow-400 not-italic ml-0.5">Hour</em></div>
                                    <div className="text-[11px] text-gray-400 mt-0.5 font-semibold">Express Delivery Service</div>
                                </div>
                            </div>
                            <p className="text-sm text-gray-300 mt-3 leading-relaxed">Fast, fresh & local products delivered to your doorstep in 45–120 minutes.</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-white mb-2.5 uppercase tracking-wider">Subscribe for Updates</h4>
                            <div className="flex gap-2 mt-2">
                                <input type="email" placeholder="Your email"
                                    className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-xs outline-none focus:border-violet-500 transition-colors placeholder:text-white/30" />
                                <button className="px-4 py-2.5 bg-violet-600 text-white border-none rounded-lg text-xs font-extrabold cursor-pointer hover:bg-violet-500 transition-colors whitespace-nowrap">Subscribe</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-6">
                        {[
                            { title: "Company", links: ["About Us", "Careers", "Press", "Blog"] },
                            { title: "Help & Support", links: ["FAQs", "Contact Us", "Track Order", "Support Center"] },
                            { title: "Legal", links: ["Privacy Policy", "Terms & Conditions", "Refund Policy", "Shipping Policy"] },
                        ].map(sec => (
                            <div key={sec.title}>
                                <h5 className="text-xs font-black text-white mb-3 uppercase tracking-wider">{sec.title}</h5>
                                <ul className="space-y-1.5">
                                    {sec.links.map(link => (
                                        <li key={link}><a href="#" className="text-[13px] text-gray-300 no-underline hover:text-violet-400 transition-colors leading-loose">{link}</a></li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        <div>
                            <h5 className="text-xs font-black text-white mb-3 uppercase tracking-wider">Follow Us</h5>
                            <div className="flex gap-2.5 flex-wrap">
                                {[{ label: "f", title: "Facebook" }, { label: "𝕏", title: "Twitter" }, { label: "📷", title: "Instagram" }, { label: "in", title: "LinkedIn" }].map(s => (
                                    <a key={s.title} href="#" title={s.title}
                                        className="w-9 h-9 rounded-full bg-violet-900/40 border border-violet-800/40 flex items-center justify-center text-violet-400 no-underline hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all text-sm">
                                        {s.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6" />
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <p className="text-xs text-gray-500">© {new Date().getFullYear()} Urbexon Hour. All rights reserved. | Made with ❤️ for local communities</p>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">We Accept</span>
                            <div className="flex gap-2">
                                {["💳", "🏦", "📱", "₹"].map(ic => (
                                    <span key={ic} className="text-base bg-white/10 px-2 py-1 rounded">{ic}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </footer>

            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display:none; }
                .scrollbar-hide { scrollbar-width: none; }
                @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
            `}</style>
        </div>
    );
};

export default UrbexonHour;