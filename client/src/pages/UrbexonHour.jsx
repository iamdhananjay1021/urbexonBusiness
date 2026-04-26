/**
 * UrbexonHour.jsx — Production Ready v3.1
 * Fixes:
 *  1. Location bar shows stale area — now merges fresh pinData area/city into savedPincode
 *  2. Category click does not change URL — now navigates to /urbexon-hour/:slug
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

/* ── Product Card ── */
const ProductCard = memo(({ product }) => {
    const { addItem, isInUHCart, uhItems, increment, decrement, removeItem } = useCart();
    const inCart = isInUHCart(product._id);
    const cartItem = uhItems.find((i) => i._id === product._id);
    const qty = cartItem?.quantity || 0;
    const nav = useNavigate();

    const discount =
        product.mrp && product.mrp > product.price
            ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
            : 0;

    const handleAdd = useCallback((e) => {
        e.stopPropagation();
        if (!inCart) {
            addItem({ ...product, productType: "urbexon_hour" });
            if (navigator.vibrate) navigator.vibrate(10);
        }
    }, [inCart, product, addItem]);

    const handleCardClick = useCallback(() => {
        nav(`/uh-product/${product.slug || product._id}`);
    }, [nav, product]);

    return (
        <div className="pc" onClick={handleCardClick} role="link">
            <div className="pc-img-wrap">
                {discount > 0 && <span className="pc-disc">{discount}%<br />OFF</span>}
                {product.tag && <span className="pc-tag">{product.tag}</span>}
                {product.rating >= 4 && (
                    <span className="pc-rating-badge">
                        <FaStar size={8} /> {product.rating.toFixed(1)}
                    </span>
                )}
                <img
                    src={product.images?.[0]?.url || product.image?.url || product.image || "/placeholder.png"}
                    alt={product.name} className="pc-img" loading="lazy"
                    onError={(e) => { e.target.src = "/placeholder.png"; }}
                />
                {!product.inStock && <div className="pc-oos-overlay">Out of Stock</div>}
            </div>
            <div className="pc-body">
                {product.brand && <div className="pc-brand">{product.brand}</div>}
                <div className="pc-name">{product.name}</div>
                {product.prepTimeMinutes && (
                    <div className="pc-prep"><FaClock size={9} /> {product.prepTimeMinutes} min</div>
                )}
                <div className="pc-price-row">
                    <span className="pc-price">{fmt(product.price)}</span>
                    {product.mrp && product.mrp > product.price && (
                        <span className="pc-mrp">{fmt(product.mrp)}</span>
                    )}
                    {discount > 0 && <span className="pc-disc-text">{discount}% off</span>}
                </div>

                {product.inStock === false ? (
                    <button className="pc-add pc-add-oos" disabled>Out of Stock</button>
                ) : !inCart ? (
                    <button className="pc-add" onClick={handleAdd}>ADD</button>
                ) : (
                    <div className="pc-qty-stepper">
                        <button onClick={(e) => {
                            e.stopPropagation();
                            if (qty <= 1) removeItem(product._id, "urbexon_hour");
                            else decrement(product._id, "urbexon_hour");
                        }}>
                            {qty <= 1 ? <FaTrash size={9} /> : <FaMinus size={9} />}
                        </button>
                        <span>{qty}</span>
                        <button onClick={(e) => { e.stopPropagation(); increment(product._id, "urbexon_hour"); }}>
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
    return uhItems.reduce((total, item) => {
        const itemSavings = (item.mrp || 0) - (item.price || 0);
        return total + (itemSavings * (item.quantity || 0));
    }, 0);
};

/* ── Category emoji helper ── */
const CATEGORY_EMOJIS = {
    dairy: "🥛", milk: "🥛", vegetables: "🥦", veggies: "🥦",
    fruits: "🍎", fruit: "🍎", bakery: "🍞", bread: "🍞",
    meat: "🥩", chicken: "🍗", drinks: "🧃", beverages: "🥤",
    frozen: "🍦", pantry: "🫙", groceries: "🛒", electronics: "📱",
    fashion: "👔", lifestyle: "✨", snacks: "🍿", default: "📦",
};

const getCategoryEmoji = (cat) => {
    if (!cat) return "📦";
    const key = cat.toLowerCase().replace(/[^a-z]/g, "");
    for (const [k, v] of Object.entries(CATEGORY_EMOJIS)) {
        if (key.includes(k)) return v;
    }
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

    /* ── State ── */
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
        try {
            const stored = localStorage.getItem("uh_pincode");
            if (stored) { const p = JSON.parse(stored); if (p?.code && /^\d{6}$/.test(p.code)) return p; }
        } catch { }
        return null;
    });
    const [initialLoading, setInitialLoading] = useState(() => {
        try {
            const stored = localStorage.getItem("uh_pincode");
            if (stored) { const p = JSON.parse(stored); if (p?.code) return true; }
        } catch { }
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

    /* ── FIX: Category select → navigate to URL slug ── */
    const handleCategorySelect = useCallback((catName) => {
        if (!catName) {
            navigate("/urbexon-hour", { replace: true });
            setActiveCategory(null);
            return;
        }
        const matched = apiCategories.find(c => c.name === catName);
        const urlSlug = matched?.slug || catName.toLowerCase().replace(/\s+/g, "-");
        navigate(`/urbexon-hour/${urlSlug}`);
        setActiveCategory(catName);
    }, [apiCategories, navigate]);

    /* ── Fetch UH categories ── */
    useEffect(() => {
        api.get("/categories", { params: { type: "urbexon_hour" } }).then(({ data }) => {
            const cats = Array.isArray(data) ? data : data.categories || [];
            setApiCategories(cats.filter(c => c.isActive !== false));
        }).catch(() => { });
    }, []);

    /* ── Map URL slug to activeCategory ── */
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

    /* ── Fetch banners & homepage data ── */
    useEffect(() => {
        api.get("/banners", { params: { type: "urbexon_hour", placement: "hero" } })
            .then(({ data }) => setHeroBanners(Array.isArray(data) ? data : []))
            .catch(() => { });
        api.get("/banners", { params: { type: "urbexon_hour", placement: "mid" } })
            .then(({ data }) => setMidBanners(Array.isArray(data) ? data : []))
            .catch(() => { });
        api.get("/products/urbexon-hour/homepage")
            .then(({ data }) => setHomepageData(data))
            .catch(() => { });
    }, []);

    /* ── Cart animation ── */
    useEffect(() => {
        if (uhTotalQty > 0) {
            setCartAnimating(true);
            const timer = setTimeout(() => setCartAnimating(false), 600);
            return () => clearTimeout(timer);
        }
    }, [uhTotalQty]);

    /* ── Inner Pincode Check ── */
    const checkPincodeInner = async (code) => {
        const pc = code.trim();
        if (!/^\d{6}$/.test(pc)) return;
        setLoading(true); setError(""); setPinData(null); setProducts([]); setCategories([]); setActiveCategory(null);
        try {
            const { data } = await api.get(`/pincode/check/${pc}`);
            setPinData(data);
            if (data.available) {
                const [pRes, dRes] = await Promise.allSettled([
                    api.get("/products", { params: { productType: "urbexon_hour", pincode: pc, limit: 60 } }),
                    api.get("/products/urbexon-hour/deals", { params: { limit: 12 } }),
                ]);

                const prods = pRes.status === "fulfilled" ? (pRes.value.data.products || pRes.value.data || []) : [];
                setProducts(prods);

                const catSet = new Set();
                prods.forEach((p) => { if (p.category) catSet.add(p.category); });
                setCategories([...catSet]);

                setUhDeals(dRes.status === "fulfilled" ? (dRes.value.data.products || []) : []);

                /* FIX: Always use fresh area/city from pincode API response */
                const pincodeData = {
                    code: pc,
                    area: data.area || null,
                    city: data.city || null,
                    state: data.state || null,
                };
                localStorage.setItem("uh_pincode", JSON.stringify(pincodeData));
                setSavedPincode(pincodeData);
                setShowPincodeEdit(false);
                if (user) {
                    api.post("/addresses/uh-pincode", pincodeData).catch(() => { });
                }
            }
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to check pincode. Please try again.");
        } finally { setLoading(false); }
    };

    /* ── Load saved pincode on mount ── */
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            let code = null;
            if (user) {
                try {
                    const { data } = await api.get("/addresses/uh-pincode");
                    if (data?.uhPincode?.code && !cancelled) {
                        /* FIX: Merge server data with localStorage to avoid blank area */
                        const localStored = (() => {
                            try { return JSON.parse(localStorage.getItem("uh_pincode") || "{}"); } catch { return {}; }
                        })();
                        const merged = {
                            ...data.uhPincode,
                            area: data.uhPincode.area || localStored.area || null,
                            city: data.uhPincode.city || localStored.city || null,
                            state: data.uhPincode.state || localStored.state || null,
                        };
                        setSavedPincode(merged);
                        setPincode(merged.code);
                        code = merged.code;
                    }
                } catch { /* continue */ }
            }
            if (!code && savedPincode?.code) {
                code = savedPincode.code;
                setPincode(code);
            }
            if (code && !cancelled) {
                await checkPincodeInner(code);
            }
            if (!cancelled) setInitialLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line

    /* ── GPS Detection ── */
    const detectLocation = useCallback(async () => {
        setLocationLoading(true); setError("");
        try {
            if (!navigator.geolocation) {
                setError("Location not supported in your browser");
                setLocationLoading(false);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                async ({ coords: { latitude, longitude } }) => {
                    try {
                        const res = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
                            { headers: { "Accept-Language": "en" } }
                        );
                        if (!res.ok) throw new Error("Geocoding failed");
                        const data = await res.json();
                        const pc = data.address?.postcode;
                        if (pc && /^\d{6}$/.test(pc)) {
                            setPincode(pc);
                            await checkPincodeInner(pc);
                        } else {
                            setError("Could not detect your pincode. Please enter it manually.");
                        }
                    } catch {
                        setError("Could not fetch location details. Please enter pincode manually.");
                    } finally { setLocationLoading(false); }
                },
                (err) => {
                    setLocationLoading(false);
                    if (err.code === 1) setError("Location permission denied. Please enter pincode manually.");
                    else if (err.code === 2) setError("Location unavailable. Please enter pincode manually.");
                    else setError("Location timeout. Please enter pincode manually.");
                },
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
            );
        } catch {
            setLocationLoading(false);
            setError("Location detection failed. Please enter pincode manually.");
        }
    }, []);

    /* ── Pincode Check (button handler) ── */
    const checkPincode = useCallback(() => {
        if (!/^\d{6}$/.test(pincode.trim())) { setError("Please enter a valid 6-digit pincode"); return; }
        checkPincodeInner(pincode);
    }, [pincode, user]); // eslint-disable-line

    /* ── Change Pincode ── */
    const handleChangePincode = useCallback(() => {
        setShowPincodeEdit(true);
        setPincode("");
        setPinData(null);
        setProducts([]);
        setCategories([]);
        setActiveCategory(null);
        setUhDeals([]);
    }, []);

    /* ── Waitlist ── */
    const joinWaitlist = useCallback(async () => {
        if (!waitlistEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail)) {
            setError("Please enter a valid email address"); return;
        }
        try {
            await api.post("/pincode/waitlist", { code: pincode, email: waitlistEmail });
            setWaitlistSuccess(true); setError("");
        } catch (err) { setError(err?.response?.data?.message || "Failed to join waitlist"); }
    }, [waitlistEmail, pincode]);

    /* ── Group by Vendor ── */
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

    /* ── Search + category filter ── */
    const filteredProducts = useMemo(() => {
        let prods = products;
        if (activeCategory) prods = prods.filter((p) => p.category === activeCategory);
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            prods = prods.filter((p) =>
                p.name?.toLowerCase().includes(q) ||
                p.brand?.toLowerCase().includes(q) ||
                p.category?.toLowerCase().includes(q)
            );
        }
        return prods;
    }, [products, activeCategory, searchQuery]);

    const vendorGroups = groupByVendor(filteredProducts);

    const cartSavings = useMemo(() => calculateEstimatedSavings(uhItems), [uhItems]);
    const deliveryEta = useMemo(() => calculateEstimatedDeliveryTime(pinData), [pinData]);

    const hasActiveService = pinData?.available && products.length > 0;
    const showHero = (!savedPincode?.code && !hasActiveService && !loading && !initialLoading) || showPincodeEdit;
    const showSkeleton = (loading || initialLoading) && savedPincode?.code && !showPincodeEdit;

    return (
        <div className="uh-root">
            <SEO title="Urbexon Hour - Quick Delivery" description="Get groceries, essentials, and more delivered in minutes with Urbexon Hour. Order now for lightning-fast delivery!" path="/urbexon-hour" />
            <style>{PAGE_CSS}</style>
            <main>

                {/* ── UH LOCATION BAR ── */}
                {(hasActiveService || showSkeleton) && !showPincodeEdit && (
                    <div className="uh-loc-bar">
                        <div className="container uh-loc-bar-inner">
                            <div className="uh-loc-bar-left">
                                <FaBolt size={12} className="uh-loc-bolt" />
                                <span className="uh-loc-bar-label">Delivering to</span>
                                <span className="uh-loc-bar-area">
                                    {savedPincode?.area || savedPincode?.city || pincode}
                                </span>
                                <span className="uh-loc-bar-eta">• {deliveryEta.min}–{deliveryEta.max} min</span>
                            </div>
                            <button className="uh-loc-bar-change" onClick={handleChangePincode}>
                                Change
                            </button>
                        </div>
                    </div>
                )}

                {/* ── HERO ── */}
                {showHero && (
                    <div className="hero">
                        <div className="hero-bg" />
                        <div className="container hero-inner">
                            <div className="hero-content">
                                <div className="hero-badge"><FaBolt size={10} /> 45–120 Min Delivery</div>
                                <h1 className="hero-title">
                                    Express delivery<br />in <em>record time</em>
                                </h1>
                                <p className="hero-sub">
                                    Products from local vendors, delivered fast right to your door.
                                </p>

                                <div className="pin-block">
                                    <div className="pin-row">
                                        <div className="pin-inp-wrap">
                                            <FaSearch size={13} className="pin-search-ic" />
                                            <input
                                                className="pin-inp"
                                                type="tel" inputMode="numeric" maxLength={6}
                                                placeholder="Enter 6-digit pincode"
                                                value={pincode}
                                                onChange={(e) => {
                                                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                                                    setPincode(v); setError(""); setPinData(null);
                                                }}
                                                onKeyDown={(e) => { if (e.key === "Enter" && pincode.length === 6) checkPincode(); }}
                                            />
                                        </div>
                                        <button
                                            className="pin-btn"
                                            onClick={() => checkPincode()}
                                            disabled={loading || pincode.length !== 6}
                                        >
                                            {loading ? <span className="spin" /> : "Check"}
                                        </button>
                                    </div>
                                    <button className="detect-btn" onClick={detectLocation} disabled={locationLoading}>
                                        <FaMapMarkerAlt size={11} />
                                        {locationLoading ? "Detecting location…" : "Use my current location"}
                                    </button>
                                    {savedPincode && showPincodeEdit && (
                                        <button
                                            className="detect-btn"
                                            style={{ marginTop: 4 }}
                                            onClick={() => {
                                                setPincode(savedPincode.code);
                                                checkPincodeInner(savedPincode.code);
                                                setShowPincodeEdit(false);
                                            }}
                                        >
                                            ← Back to {savedPincode.area || savedPincode.city || savedPincode.code}
                                        </button>
                                    )}
                                    {error && <div className="pin-error">{error}</div>}
                                </div>
                            </div>

                            <div className="hero-art">
                                <div className="hero-c1" /><div className="hero-c2" />
                                <span className="hero-emoji">🛵</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TRUST STRIP ── */}
                {(hasActiveService || showSkeleton) && !showPincodeEdit && (
                    <div className="trust-strip">
                        <div className="container trust-inner">
                            {[
                                { ic: "🚀", t: "EXPRESS DELIVERY", sub: deliveryEta ? `${deliveryEta.min}–${deliveryEta.max} min` : "45–120 min", accent: "#3b82f6" },
                                { ic: "✅", t: "QUALITY CHECKED", sub: "100% verified products", accent: "#10b981" },
                                { ic: "🏪", t: "LOCAL VENDORS", sub: `${homepageData?.stats?.totalVendors || vendorGroups.length || "0"} verified stores`, accent: "#8b5cf6" },
                                { ic: "🔒", t: "SECURE PAYMENTS", sub: "256-bit encrypted", accent: "#f59e0b" },
                            ].map((f, i) => (
                                <div key={f.t} className="trust-item" style={{ animationDelay: `${i * 80}ms` }}>
                                    <div className="trust-ic-wrap" style={{ background: `${f.accent}15`, border: `1.5px solid ${f.accent}25` }}>
                                        <span className="trust-ic">{f.ic}</span>
                                    </div>
                                    <div>
                                        <div className="trust-title">{f.t}</div>
                                        <div className="trust-sub">{f.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── SKELETON LOADING ── */}
                {showSkeleton && (
                    <div className="container" style={{ padding: "20px 16px" }}>
                        <div className="uh-sk-cats">
                            {[1, 2, 3, 4].map(i => <div key={i} className="uh-sk-cat"><div className="uh-sk-circle" /><div className="uh-sk-line-sm" /></div>)}
                        </div>
                        <div className="uh-sk-section"><div className="uh-sk-line-lg" /></div>
                        <div className="uh-sk-grid">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="uh-sk-card">
                                    <div className="uh-sk-card-img" />
                                    <div className="uh-sk-card-body">
                                        <div className="uh-sk-line" style={{ width: "70%" }} />
                                        <div className="uh-sk-line" style={{ width: "50%" }} />
                                        <div className="uh-sk-line" style={{ width: "40%" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ HOMEPAGE SECTIONS ═══ */}
                {hasActiveService && !showPincodeEdit && !searchQuery && !activeCategory && (
                    <>
                        {/* Hero Banner */}
                        {heroBanners.length > 0 && (
                            <div className="container" style={{ paddingTop: 20, paddingBottom: 0 }}>
                                <UHBannerCarousel banners={heroBanners} />
                            </div>
                        )}

                        {/* Category Strip — FIX: onSelect uses handleCategorySelect for URL navigation */}
                        <div className="container" style={{ paddingTop: 20 }}>
                            <UHCategoryStrip
                                categories={apiCategories}
                                activeCategory={activeCategory}
                                onSelect={handleCategorySelect}
                            />
                        </div>

                        {/* Shop by Category */}
                        {homepageData?.categorySections && Object.keys(homepageData.categorySections).some(k => homepageData.categorySections[k]?.length >= 3) && (
                            <div className="uh-cat-group">
                                <div className="container">
                                    <div className="uh-group-header">
                                        <span className="uh-group-ic">🏬</span>
                                        <div>
                                            <h2 className="uh-group-title">Shop by Category</h2>
                                            <p className="uh-group-sub">Browse products organized by what you need</p>
                                        </div>
                                    </div>
                                </div>
                                {Object.entries(homepageData.categorySections).map(([catName, prods]) => (
                                    prods.length >= 3 && (
                                        <div className="container" key={catName}>
                                            <UHProductSection
                                                title={catName}
                                                subtitle={`${prods.length} products`}
                                                icon={getCategoryEmoji(catName)}
                                                products={prods}
                                                renderCard={(p) => <ProductCard product={p} />}
                                            />
                                        </div>
                                    )
                                ))}
                            </div>
                        )}

                        {/* Flash Deals */}
                        {uhDeals.length > 0 && (
                            <div className="uh-deals-section">
                                <div className="container">
                                    <div className="uh-deals-header">
                                        <div className="uh-deals-title-row">
                                            <div className="uh-deals-icon"><FaFire size={14} /></div>
                                            <div>
                                                <div className="uh-deals-title">Flash Deals</div>
                                                <div className="uh-deals-sub">
                                                    {uhDeals.length} hot offer{uhDeals.length !== 1 ? "s" : ""}
                                                    {uhDeals.length > 0 && uhDeals[0].meta ? ` • Avg ${uhDeals[0].meta.avgDiscount}% off` : ""}
                                                    — grab before they expire!
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="uh-deals-scroll">
                                        {uhDeals.map((p) => (
                                            <div key={p._id} className="uh-deals-scroll-item">
                                                <ProductCard product={p} />
                                                {p.dealEndsAt && (() => {
                                                    const diff = new Date(p.dealEndsAt) - new Date();
                                                    if (diff <= 0) return null;
                                                    const h = Math.floor(diff / 3600000);
                                                    const m = Math.floor((diff % 3600000) / 60000);
                                                    return <div className="uh-deal-timer"><FaClock size={9} /> {h}h {m}m left</div>;
                                                })()}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Best Sellers */}
                        {homepageData?.bestSellers?.length > 0 && (
                            <div className="container">
                                <UHProductSection
                                    title="Best Sellers"
                                    subtitle="Most popular in your area"
                                    icon="🔥"
                                    products={homepageData.bestSellers}
                                    renderCard={(p) => <ProductCard product={p} />}
                                />
                            </div>
                        )}

                        {/* Top Deals */}
                        {homepageData?.topDeals?.length > 0 && (
                            <div className="container">
                                <UHProductSection
                                    title="Top Deals"
                                    subtitle="Biggest discounts right now"
                                    icon="💰"
                                    products={homepageData.topDeals}
                                    renderCard={(p) => <ProductCard product={p} />}
                                />
                            </div>
                        )}

                        {/* Mid Banners */}
                        {midBanners.length > 0 && (
                            <div className="container" style={{ paddingTop: 12, paddingBottom: 12 }}>
                                <UHMidBanner banners={midBanners} />
                            </div>
                        )}

                        {/* Trending Now */}
                        {homepageData?.trending?.length > 0 && (
                            <div className="container">
                                <UHProductSection
                                    title="Trending Now"
                                    subtitle="What everyone is buying"
                                    icon="📈"
                                    products={homepageData.trending}
                                    renderCard={(p) => <ProductCard product={p} />}
                                />
                            </div>
                        )}

                        {/* Budget Picks */}
                        {homepageData?.budgetPicks?.length > 0 && (
                            <div className="container">
                                <UHProductSection
                                    title="Budget Picks"
                                    subtitle="Best deals under ₹500"
                                    icon="🏷️"
                                    products={homepageData.budgetPicks}
                                    renderCard={(p) => <ProductCard product={p} />}
                                />
                            </div>
                        )}

                        {/* Nearby Stores */}
                        <div className="container">
                            <NearbyShops pincode={pincode} pincodeLabel={savedPincode?.area || savedPincode?.city || ''} maxResults={12} />
                        </div>

                        {/* Recently Viewed */}
                        {uhRecentlyViewed.length > 0 && (
                            <div className="container" style={{ paddingTop: 12, paddingBottom: 8 }}>
                                <UHProductSection
                                    title="Recently Viewed"
                                    subtitle="Continue where you left off"
                                    icon="🕐"
                                    products={uhRecentlyViewed.slice(0, 10)}
                                    renderCard={(p) => <ProductCard product={p} />}
                                />
                            </div>
                        )}

                        {/* Fresh Arrivals */}
                        {homepageData?.recommended?.length > 0 && (
                            <div className="container">
                                <UHProductSection
                                    title="Fresh Arrivals"
                                    subtitle="Just landed on the platform"
                                    icon="✨"
                                    products={homepageData.recommended}
                                    renderCard={(p) => <ProductCard product={p} />}
                                />
                            </div>
                        )}

                        {/* Why Urbexon Hour */}
                        <div className="uh-why-section">
                            <div className="container">
                                <h3 className="uh-why-title">Why shop on Urbexon Hour?</h3>
                                <div className="uh-why-grid">
                                    {[
                                        { ic: "🏪", title: "Support Local", desc: "Every order helps local vendors & small businesses grow" },
                                        { ic: "🕐", title: "Superfast Delivery", desc: `Get your order in ${deliveryEta.min}-${deliveryEta.max} minutes flat` },
                                        { ic: "🛡️", title: "Quality Promise", desc: "Every product is quality checked before dispatch" },
                                        { ic: "💯", title: "Best Prices", desc: "We match prices so you always get the best deal" },
                                    ].map(item => (
                                        <div key={item.title} className="uh-why-card">
                                            <span className="uh-why-ic">{item.ic}</span>
                                            <h4 className="uh-why-card-title">{item.title}</h4>
                                            <p className="uh-why-card-desc">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── CATEGORY BROWSER (search/filter active) ── */}
                {hasActiveService && !showPincodeEdit && (searchQuery || activeCategory) && (
                    <div className="section">
                        <div className="container">
                            <CategoryBrowser
                                categories={apiCategories}
                                onCategorySelect={handleCategorySelect}
                                activeCategory={activeCategory}
                                title="Shop by Category"
                                subtitle={activeCategory ? `Showing: ${activeCategory}` : "Tap to filter by category"}
                                type="urbexon_hour"
                            />
                        </div>
                    </div>
                )}

                {/* ── SEARCH RESULTS COUNTER ── */}
                {searchQuery && hasActiveService && !showPincodeEdit && (
                    <div className="search-results-bar">
                        <div className="container search-results-inner">
                            <FaSearch size={13} style={{ color: '#3b82f6' }} />
                            <span>
                                Found <strong>{filteredProducts.length}</strong> product{filteredProducts.length !== 1 ? "s" : ""} matching "<strong>{searchQuery}</strong>"
                            </span>
                            <button className="search-clear-btn" onClick={clearSearch} title="Clear search">
                                <FaTimes size={12} /> Clear
                            </button>
                        </div>
                    </div>
                )}

                {/* ── PRODUCTS BY VENDOR (filtering/searching) ── */}
                {pinData?.available && (searchQuery || activeCategory) && (
                    <div className="container">
                        {filteredProducts.length === 0 && !loading && (
                            <div className="empty-state">
                                <FaStore size={40} className="empty-ic" />
                                <div className="empty-title">
                                    {activeCategory
                                        ? `No products in "${activeCategory}" for your area`
                                        : searchQuery
                                            ? `No results for "${searchQuery}"`
                                            : "No products available in your area yet"}
                                </div>
                                <div className="empty-sub">We are expanding fast. Check back soon!</div>
                                <button
                                    className="pin-btn"
                                    style={{ marginTop: 16 }}
                                    onClick={() => { handleCategorySelect(null); clearSearch(); }}
                                >
                                    Show all products
                                </button>
                            </div>
                        )}

                        {vendorGroups.map((group) => (
                            <div key={group.vendorId} className="vendor-block">
                                <div className="vendor-header">
                                    <div className="vendor-avatar"><FaStore size={18} /></div>
                                    <div className="vendor-info">
                                        <div className="vendor-name">{group.vendorName}</div>
                                        <div className="vendor-meta">
                                            <FaStar size={10} className="star-ic" /> {(group.products[0]?.vendorId?.rating || 4.0).toFixed(1)} &bull;
                                            <FaClock size={10} /> {deliveryEta.min}–{deliveryEta.max} min &bull; {group.products.length} items
                                        </div>
                                    </div>
                                </div>
                                <div className="prod-grid">
                                    {group.products.map((p) => <ProductCard key={p._id} product={p} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── NOT IN AREA ── */}
                {pinData && !pinData.available && pinData.status === "not_found" && (
                    <div className="container">
                        <div className="state-card">
                            <div style={{ fontSize: 48 }}>📍</div>
                            <div className="state-title">We are not in your area yet</div>
                            <div className="state-sub">
                                Pincode <strong>{pincode}</strong> is not covered. We are expanding fast!
                            </div>
                        </div>
                    </div>
                )}

                {/* ── WAITLIST ── */}
                {pinData && !pinData.available && pinData.status !== "not_found" && !waitlistSuccess && (
                    <div className="container">
                        <div className="state-card">
                            <FaBell size={32} style={{ color: "#1a1740", marginBottom: 12 }} />
                            <div className="state-title">Launching soon in your area!</div>
                            <div className="state-sub">
                                {pinData.status === "coming_soon" ? "Be the first to know when we go live." : pinData.message}
                            </div>
                            <div className="waitlist-row">
                                <input
                                    type="email" placeholder="your@email.com"
                                    value={waitlistEmail}
                                    onChange={(e) => setWaitlistEmail(e.target.value)}
                                    className="waitlist-inp"
                                />
                                <button onClick={joinWaitlist} className="waitlist-btn">Notify Me</button>
                            </div>
                            {error && <div className="pin-error" style={{ marginTop: 8, color: "#ef4444" }}>{error}</div>}
                        </div>
                    </div>
                )}

                {waitlistSuccess && (
                    <div className="container">
                        <div className="wl-success">
                            ✅ You are on the waitlist! We will notify you when we launch in your area.
                        </div>
                    </div>
                )}

                <div style={{ height: 80 }} />
            </main>

            {/* ── FLOATING CART ── */}
            {uhTotalQty > 0 && (
                <button
                    className={`float-cart ${cartAnimating ? 'cart-pulse' : ''}`}
                    onClick={() => navigate("/uh-cart")}
                    title={`${uhTotalQty} item${uhTotalQty !== 1 ? 's' : ''} • ${fmt(uhTotal)}`}
                >
                    <div className="float-cart-icon-badge">
                        <FaShoppingCart size={16} />
                        <span className="cart-badge">{uhTotalQty}</span>
                    </div>
                    <div className="float-cart-content">
                        <div className="cart-qty-text">{uhTotalQty} item{uhTotalQty !== 1 ? "s" : ""}</div>
                        <div className="cart-amount-text">{fmt(uhTotal)}</div>
                    </div>
                    <div className="float-cart-meta">
                        {cartSavings > 0 && (
                            <span className="cart-savings">Save {fmt(cartSavings)}</span>
                        )}
                        {pinData && (
                            <span className="cart-delivery">
                                {deliveryEta.min}-{deliveryEta.max} min
                            </span>
                        )}
                    </div>
                    <FaChevronRight size={12} className="cart-chevron" />
                </button>
            )}

            {/* ── FOOTER ── */}
            <footer className="footer">
                <div className="container footer-main">
                    <div className="footer-top">
                        <div className="footer-brand-sec">
                            <div className="footer-brand">
                                <span className="logo-mark-sm">UX</span>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.5px" }}>
                                        URBEXON<em style={{ color: "#c9a84c", fontStyle: "normal", marginLeft: "2px" }}>Hour</em>
                                    </div>
                                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: "2px", fontWeight: 600 }}>Express Delivery Service</div>
                                </div>
                            </div>
                            <p style={{ fontSize: 13, color: "#d1d5db", marginTop: 12, lineHeight: 1.5 }}>
                                Fast, fresh & local products delivered to your doorstep in 45–120 minutes.
                            </p>
                        </div>

                        <div className="footer-newsletter">
                            <h4 style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Subscribe for Updates</h4>
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <input type="email" placeholder="Your email" style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans'" }} />
                                <button style={{ padding: "10px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseEnter={(e) => e.target.style.background = "#2563eb"} onMouseLeave={(e) => e.target.style.background = "#3b82f6"}>Subscribe</button>
                            </div>
                        </div>
                    </div>

                    <div className="footer-links-grid">
                        {[
                            { title: "Company", links: ["About Us", "Careers", "Press", "Blog"] },
                            { title: "Help & Support", links: ["FAQs", "Contact Us", "Track Order", "Support Center"] },
                            { title: "Legal", links: ["Privacy Policy", "Terms & Conditions", "Refund Policy", "Shipping Policy"] },
                        ].map(sec => (
                            <div key={sec.title} className="footer-section">
                                <h5 style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>{sec.title}</h5>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                    {sec.links.map(link => (
                                        <li key={link}>
                                            <a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }}
                                                onMouseEnter={(e) => e.target.style.color = "#3b82f6"}
                                                onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>
                                                {link}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}

                        <div className="footer-section">
                            <h5 style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Follow Us</h5>
                            <div style={{ display: "flex", gap: 10 }}>
                                {[{ label: "f", title: "Facebook" }, { label: "𝕏", title: "Twitter" }, { label: "📷", title: "Instagram" }, { label: "in", title: "LinkedIn" }].map(s => (
                                    <a key={s.title} href="#" title={s.title}
                                        style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(59,130,246,.2)", border: "1px solid rgba(59,130,246,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", textDecoration: "none", transition: "all 0.2s", fontSize: 14 }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "#3b82f6"; e.currentTarget.style.color = "#fff"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(59,130,246,.2)"; e.currentTarget.style.color = "#3b82f6"; }}>
                                        {s.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.1), transparent)", margin: "24px 0" }} />

                    <div className="footer-bottom">
                        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", justifyContent: "space-between", width: "100%" }}>
                            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>© 2025 Urbexon Hour. All rights reserved. | Made with ❤️ for local communities</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>We Accept</span>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    {["💳", "🏦", "📱", "₹"].map(ic => (
                                        <span key={ic} style={{ fontSize: 16, background: "rgba(255,255,255,.1)", padding: "4px 8px", borderRadius: 4 }}>{ic}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

/* ── CSS ── */
const PAGE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#f5f6fa}
main{position:relative;z-index:1}
.uh-root{min-height:100vh;background:#f5f6fa;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a202c;position:relative;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.container{max-width:1280px;margin:0 auto;padding:0 clamp(16px,4vw,48px)}

.uh-initial-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:14px;color:#64748b;font-size:14px}
.uh-loader{width:40px;height:40px;border:3px solid #e2e8f0;border-top:3px solid #3b82f6;border-radius:50%;animation:uhspin .8s linear infinite}
@keyframes uhspin{to{transform:rotate(360deg)}}

.uh-loc-bar{background:linear-gradient(135deg,#1a1740 0%,#2d1b69 100%);border-bottom:1px solid rgba(201,168,76,.15);backdrop-filter:blur(10px)}
.uh-loc-bar-inner{display:flex;align-items:center;justify-content:space-between;padding:10px 0}
.uh-loc-bar-left{display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(255,255,255,.85);font-weight:600}
.uh-loc-bolt{color:#c9a84c;filter:drop-shadow(0 0 4px rgba(201,168,76,.4))}
.uh-loc-bar-label{color:rgba(255,255,255,.5);font-size:12px}
.uh-loc-bar-area{color:#fff;font-weight:700}
.uh-loc-bar-eta{color:#c9a84c;font-weight:700;font-size:12px}
.uh-loc-bar-change{background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);color:#c9a84c;padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
.uh-loc-bar-change:hover{background:rgba(201,168,76,.2);border-color:#c9a84c;transform:scale(1.02)}
@media(max-width:640px){
  .uh-loc-bar-inner{padding:8px 0;gap:6px}
  .uh-loc-bar-left{font-size:11px;gap:5px;flex-wrap:wrap}
  .uh-loc-bar-change{padding:4px 12px;font-size:10px}
}

.uh-sk-cats{display:flex;gap:16px;margin-bottom:20px}
.uh-sk-cat{display:flex;flex-direction:column;align-items:center;gap:8px}
.uh-sk-circle{width:56px;height:56px;border-radius:14px;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
.uh-sk-line-sm{width:48px;height:10px;border-radius:4px;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
.uh-sk-section{margin-bottom:16px}
.uh-sk-line-lg{width:140px;height:18px;border-radius:6px;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
.uh-sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.uh-sk-card{border-radius:14px;border:1px solid #f0f0f0;overflow:hidden;background:#fff}
.uh-sk-card-img{aspect-ratio:1;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
.uh-sk-card-body{padding:12px;display:flex;flex-direction:column;gap:8px}
.uh-sk-line{height:10px;border-radius:4px;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
@keyframes uhsk{0%{background-position:200% 0}100%{background-position:-200% 0}}

.hero{background:linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f093fb 100%);position:relative;overflow:hidden;margin-bottom:0}
.hero-bg{position:absolute;inset:0;pointer-events:none;opacity:.3;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.hero-inner{position:relative;z-index:1;display:flex;align-items:center;gap:48px;padding:clamp(48px,6vw,80px) 0;justify-content:space-between}
.hero-content{flex:1}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:7px 14px;border-radius:24px;margin-bottom:18px;backdrop-filter:blur(10px)}
.hero-title{font-size:clamp(28px,5vw,48px);font-weight:800;line-height:1.15;color:#fff;margin-bottom:12px;letter-spacing:-.5px}
.hero-title em{font-style:normal;background:linear-gradient(120deg,#ffd89b,#fff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-sub{font-size:16px;color:rgba(255,255,255,.85);margin-bottom:28px;max-width:480px;line-height:1.6}
.hero-art{position:relative;width:clamp(120px,20vw,260px);flex-shrink:0;align-self:center;height:clamp(150px,20vw,260px)}
.hero-c1{position:absolute;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.06);right:-40px;top:-30px}
.hero-c2{position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08);right:30px;bottom:20px}
.hero-emoji{font-size:clamp(80px,12vw,140px);position:relative;z-index:2;filter:drop-shadow(0 8px 24px rgba(0,0,0,.2));animation:bob 3s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}

.pin-block{max-width:600px}
.pin-row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.pin-inp-wrap{flex:1;min-width:200px;position:relative;display:flex;align-items:center}
.pin-search-ic{position:absolute;left:14px;color:rgba(0,0,0,.3);pointer-events:none;font-size:14px}
.pin-inp{width:100%;padding:13px 14px 13px 40px;background:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;letter-spacing:1.5px;color:#1f2937;outline:none;box-shadow:0 4px 20px rgba(0,0,0,.12);font-family:'DM Sans',sans-serif;transition:all .2s}
.pin-inp:focus{box-shadow:0 8px 32px rgba(0,0,0,.18)}
.pin-inp::placeholder{color:#a1a1a1;letter-spacing:0;font-weight:400;font-size:13px}
.pin-btn{padding:13px 28px;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:12px;color:#fff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 4px 16px rgba(59,130,246,.3);transition:all .2s;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:'DM Sans',sans-serif;letter-spacing:.3px}
.pin-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(59,130,246,.4)}
.pin-btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.detect-btn{background:none;border:none;color:rgba(255,255,255,.75);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-family:'DM Sans',sans-serif;font-weight:600;transition:all .15s;border-radius:8px}
.detect-btn:hover{color:#fff;background:rgba(255,255,255,.1)}
.detect-btn:disabled{opacity:.5;cursor:not-allowed}
.pin-error{color:#fca5a5;font-size:12px;margin-top:8px;font-weight:500}
.spin{width:14px;height:14px;display:inline-block;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sp .6s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}

.trust-strip{background:linear-gradient(135deg,#ffffff,#f8fafc);border-bottom:1px solid #e8ecf1;border-top:1px solid #e8ecf1;box-shadow:0 2px 12px rgba(0,0,0,.03)}
.trust-inner{display:grid;grid-template-columns:repeat(4,1fr);gap:0;width:100%;overflow:hidden}
.trust-item{display:flex;align-items:center;gap:clamp(10px,1.5vw,14px);padding:clamp(16px,2.5vw,22px) clamp(14px,2vw,24px);border-right:1px solid #e8ecf1;position:relative;transition:all .3s;min-width:0;animation:trustSlideIn .5s cubic-bezier(.34,.1,.68,1) backwards}
.trust-item:last-child{border-right:none}
.trust-item:hover{background:linear-gradient(135deg,rgba(59,130,246,.04),rgba(139,92,246,.03))}
.trust-ic-wrap{width:clamp(36px,4vw,44px);height:clamp(36px,4vw,44px);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .3s}
.trust-item:hover .trust-ic-wrap{transform:scale(1.08)}
.trust-ic{font-size:clamp(18px,2.5vw,22px);filter:drop-shadow(0 1px 3px rgba(0,0,0,.08))}
.trust-title{font-size:clamp(10px,1.8vw,11.5px);font-weight:800;color:#0f172a;letter-spacing:.6px;text-transform:uppercase;font-family:'DM Sans';white-space:nowrap}
.trust-sub{font-size:clamp(10px,1.5vw,11.5px);color:#64748b;margin-top:2px;line-height:1.3;font-weight:500;white-space:nowrap}
@keyframes trustSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:1024px){.trust-inner{grid-template-columns:repeat(4,1fr)}.trust-item{padding:14px 12px;gap:10px}}
@media(max-width:768px){.trust-inner{grid-template-columns:repeat(2,1fr)}.trust-item{border-right:none;border-bottom:1px solid #e8ecf1;padding:12px 14px;min-width:0}.trust-item:nth-child(odd){border-right:1px solid #e8ecf1}.trust-item:nth-child(3),.trust-item:nth-child(4){border-bottom:none}.trust-title{font-size:10px}.trust-sub{font-size:10px}}
@media(max-width:480px){.trust-inner{grid-template-columns:repeat(2,1fr)}.trust-item{padding:10px 10px;gap:8px}.trust-title{font-size:9px;letter-spacing:.3px}.trust-sub{display:none}.trust-ic-wrap{width:32px;height:32px;border-radius:8px}.trust-ic{font-size:16px}}

.uh-why-section{background:linear-gradient(135deg,#f8fafc,#eef2ff);padding:40px 0;margin:8px 0}
.uh-cat-group{background:linear-gradient(180deg,#fafbfc 0%,#f5f6fa 100%);padding:8px 0 4px;margin:8px 0;border-top:1px solid #e8ecf1;border-bottom:1px solid #e8ecf1}
.uh-group-header{display:flex;align-items:center;gap:14px;padding:20px 0 4px}
.uh-group-ic{font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.06))}
.uh-group-title{font-size:clamp(18px,3.5vw,22px);font-weight:800;color:#0f172a;margin:0;letter-spacing:-.3px}
.uh-group-sub{font-size:12px;color:#64748b;margin:2px 0 0;font-weight:500}
@media(max-width:640px){.uh-group-header{padding:16px 0 2px;gap:10px}.uh-group-ic{font-size:22px}.uh-group-title{font-size:16px}}
.uh-why-title{font-size:clamp(18px,3.5vw,24px);font-weight:800;color:#0f172a;text-align:center;margin-bottom:28px;letter-spacing:-.3px}
.uh-why-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.uh-why-card{background:#fff;border:1px solid #e8ecf1;border-radius:16px;padding:24px 18px;text-align:center;transition:all .3s;cursor:default;position:relative;overflow:hidden}
.uh-why-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#8b5cf6);opacity:0;transition:opacity .3s}
.uh-why-card:hover{transform:translateY(-4px);box-shadow:0 8px 32px rgba(0,0,0,.08);border-color:#c7d2fe}
.uh-why-card:hover::before{opacity:1}
.uh-why-ic{font-size:32px;display:block;margin-bottom:12px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.08))}
.uh-why-card-title{font-size:14px;font-weight:800;color:#0f172a;margin-bottom:6px;letter-spacing:-.2px}
.uh-why-card-desc{font-size:12px;color:#64748b;line-height:1.5;font-weight:500}
@media(max-width:768px){.uh-why-grid{grid-template-columns:repeat(2,1fr);gap:12px}.uh-why-card{padding:18px 14px}}
@media(max-width:480px){.uh-why-grid{grid-template-columns:1fr 1fr;gap:10px}.uh-why-card{padding:16px 12px}.uh-why-ic{font-size:26px;margin-bottom:8px}.uh-why-card-title{font-size:12px}.uh-why-card-desc{font-size:11px}}

.section{background:#fff;margin:16px 0;padding:clamp(24px,4vw,40px) 0;border-bottom:1px solid #f0f0f0}
.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:12px}
.section-title{font-size:clamp(16px,3vw,22px);font-weight:800;color:#1f2937;letter-spacing:-.3px}
.see-all-btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#3b82f6;font-weight:700;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;padding:4px 8px;border-radius:6px;transition:all .2s}
.see-all-btn:hover{background:rgba(59,130,246,.08)}

.search-results-bar{background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:1px solid #bfdbfe;border-bottom:2px solid #3b82f6;margin:12px 0;animation:slideDown .3s ease;position:relative;z-index:25}
.search-results-inner{display:flex;align-items:center;gap:8px;padding:12px 16px}
.search-results-inner>span{font-size:13px;color:#1e40af;font-weight:500;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.search-results-inner strong{color:#1e3a8a;font-weight:700}
.search-clear-btn{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#dc2626;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:4px;transition:all .2s;white-space:nowrap;flex-shrink:0}
.search-clear-btn:hover{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.5)}
@keyframes slideDown{from{opacity:0;transform:translateY(-8px);max-height:0}to{opacity:1;transform:translateY(0);max-height:60px}}

.uh-deals-section{background:#fff;margin:16px 0;padding:clamp(24px,4vw,40px) 0;border-bottom:1px solid #f0f0f0;overflow:hidden}
.uh-deals-header{margin-bottom:24px}
.uh-deals-title-row{display:flex;align-items:center;gap:14px}
.uh-deals-icon{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#ff6b35 0%,#ff8c42 100%);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;font-size:20px;box-shadow:0 4px 12px rgba(255,107,53,.25)}
.uh-deals-title{font-size:clamp(16px,3vw,22px);font-weight:800;color:#1f2937;letter-spacing:-.3px}
.uh-deals-sub{font-size:12px;color:#6b7280;margin-top:4px;font-weight:500}
.uh-deals-scroll{display:flex;gap:14px;overflow-x:auto;padding-bottom:10px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.uh-deals-scroll::-webkit-scrollbar{height:5px}
.uh-deals-scroll::-webkit-scrollbar-track{background:#f3f4f6;border-radius:6px}
.uh-deals-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:6px}
.uh-deals-scroll::-webkit-scrollbar-thumb:hover{background:#9ca3af}
.uh-deals-scroll-item{min-width:200px;max-width:220px;flex-shrink:0;scroll-snap-align:start;background:#fff;border:1.5px solid #e5e7eb;border-radius:14px;overflow:hidden;transition:all .25s;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.uh-deals-scroll-item:hover{border-color:#ff6b35;box-shadow:0 6px 20px rgba(255,107,53,.12);transform:translateY(-3px)}
.uh-deals-scroll-item .pc{padding:0;border:none;box-shadow:none}
.uh-deals-scroll-item .pc-img-wrap{border-radius:0}
.uh-deal-timer{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;background:#fff7ed;border-top:1px solid #fed7aa;font-size:11px;font-weight:700;color:#ea580c;letter-spacing:.2px}
@media(max-width:640px){.uh-deals-scroll-item{min-width:180px;max-width:200px}}

.vendor-block{background:#fff;border-radius:16px;border:1px solid #e8ecf1;margin:16px 0;overflow:visible;transition:all .25s;box-shadow:0 2px 12px rgba(0,0,0,.04)}
.vendor-block:hover{border-color:#c7d2fe;box-shadow:0 8px 32px rgba(0,0,0,.06)}
.vendor-header{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid #f0f2f5;background:linear-gradient(135deg,#fafbfc,#f8fafc);transition:background .2s;border-radius:16px 16px 0 0}
.vendor-avatar{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#dbeafe,#eff6ff);color:#1e40af;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px}
.vendor-info{flex:1}
.vendor-name{font-size:14px;font-weight:800;color:#1f2937;letter-spacing:-.2px}
.vendor-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:#6b7280;margin-top:4px;flex-wrap:wrap;font-weight:500}
.star-ic{color:#f59e0b;font-size:11px}

.prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;background:transparent;padding:20px;border-radius:0 0 14px 14px}
@media(max-width:768px){.prod-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:16px}}
@media(max-width:480px){.prod-grid{grid-template-columns:repeat(2,1fr);gap:10px;padding:12px}}

.pc{background:#fff;padding:0;cursor:pointer;border-radius:14px;transition:all .3s cubic-bezier(.34,.1,.68,1);border:1px solid #edf0f4;height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.03)}
.pc:hover{border-color:#d4dae4;box-shadow:0 8px 32px rgba(0,0,0,.08);transform:translateY(-4px)}
.pc-img-wrap{position:relative;aspect-ratio:1;background:linear-gradient(135deg,#f8f9fc,#f0f4f8);border-radius:0;overflow:hidden;border:none;flex-shrink:0}
.pc-img{width:100%;height:100%;object-fit:cover;transition:transform .4s cubic-bezier(.34,.1,.68,1)}
.pc:hover .pc-img{transform:scale(1.06)}
.pc-disc{position:absolute;top:0;left:0;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:800;padding:6px 10px;border-radius:0 0 10px 0;letter-spacing:.3px;line-height:1.2;text-align:center;z-index:2}
.pc-tag{position:absolute;top:8px;right:8px;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;font-size:9px;font-weight:700;padding:4px 8px;border-radius:6px;animation:pulse 2s ease-in-out infinite;z-index:2;box-shadow:0 2px 8px rgba(249,115,22,.3)}
.pc-rating-badge{position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);color:#fff;font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px;display:flex;align-items:center;gap:3px;z-index:2}
.pc-rating-badge svg{color:#fbbf24}
.pc-oos-overlay{position:absolute;inset:0;background:rgba(255,255,255,.7);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#6b7280;z-index:3}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
.pc-body{padding:12px;display:flex;flex-direction:column;gap:3px;flex:1}
.pc-brand{font-size:10px;font-weight:700;color:#8b5cf6;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px}
.pc-name{font-size:13px;font-weight:600;color:#1e293b;margin-bottom:2px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pc-prep{display:flex;align-items:center;gap:4px;font-size:10px;color:#94a3b8;margin-bottom:2px;font-weight:500}
.pc-price-row{display:flex;align-items:baseline;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.pc-price{font-size:16px;font-weight:900;color:#0f172a;letter-spacing:-.3px}
.pc-mrp{font-size:11px;color:#94a3b8;text-decoration:line-through;font-weight:500}
.pc-disc-text{font-size:10px;font-weight:700;color:#16a34a;background:linear-gradient(135deg,#dcfce7,#bbf7d0);padding:2px 6px;border-radius:4px}
.pc-add{width:100%;padding:9px 12px;background:#fff;border:1.5px solid #22c55e;color:#16a34a;font-weight:800;font-size:13px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:all .2s cubic-bezier(.34,.1,.68,1);font-family:'DM Sans',sans-serif;letter-spacing:.3px;margin-top:auto;text-transform:uppercase}
.pc-add:hover{background:#22c55e;color:#fff;box-shadow:0 4px 16px rgba(34,197,94,.25);transform:scale(1.02)}
.pc-add:active{transform:scale(0.97)}
.pc-add-oos{border-color:#d1d5db;color:#9ca3af;cursor:not-allowed;font-size:11px;text-transform:none}
.pc-add-oos:hover{background:#fff;color:#9ca3af;box-shadow:none;transform:none}
.pc-qty-stepper{display:flex;align-items:center;justify-content:space-between;border:1.5px solid #22c55e;border-radius:8px;overflow:hidden;background:#22c55e;margin-top:auto;transition:all .15s}
.pc-qty-stepper:hover{box-shadow:0 4px 16px rgba(34,197,94,.2)}
.pc-qty-stepper button{width:34px;height:34px;border:none;background:transparent;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s cubic-bezier(.34,.1,.68,1);font-size:12px;font-weight:700}
.pc-qty-stepper button:hover{background:rgba(255,255,255,.15)}
.pc-qty-stepper button:active{transform:scale(0.9)}
.pc-qty-stepper span{flex:1;text-align:center;font-size:15px;font-weight:900;color:#fff;user-select:none}

.empty-state{padding:clamp(40px,8vw,80px) 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.empty-ic{color:#d1d5db;font-size:48px}
.empty-title{font-size:18px;font-weight:800;color:#1f2937}
.empty-sub{font-size:14px;color:#6b7280;max-width:380px}
.state-card{background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;padding:clamp(40px,6vw,60px) 32px;text-align:center;margin:24px 0;display:flex;flex-direction:column;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.04)}
.state-title{font-size:20px;font-weight:800;color:#1f2937;margin-bottom:10px;letter-spacing:-.3px}
.state-sub{font-size:14px;color:#6b7280;margin-bottom:24px;line-height:1.6}
.waitlist-row{display:flex;gap:12px;width:100%;max-width:480px;flex-wrap:wrap}
.waitlist-inp{flex:1;min-width:200px;padding:12px 16px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:10px;font-size:13px;color:#1f2937;outline:none;font-family:'DM Sans',sans-serif;transition:all .2s}
.waitlist-inp:focus{border-color:#3b82f6;background:#fff;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
.waitlist-btn{padding:12px 20px;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:10px;color:#fff;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;font-family:'DM Sans',sans-serif;transition:all .2s;box-shadow:0 2px 8px rgba(59,130,246,.2);letter-spacing:.2px}
.waitlist-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(59,130,246,.3)}
.wl-success{background:#dcfce7;border:1.5px solid #86efac;border-radius:12px;color:#15803d;font-weight:700;font-size:14px;text-align:center;padding:18px 20px;margin:20px 0;letter-spacing:.2px}

.float-cart{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:50px;font-family:'DM Sans',sans-serif;font-weight:700;box-shadow:0 8px 32px rgba(34,197,94,.35),0 2px 8px rgba(0,0,0,.1);z-index:50;white-space:nowrap;animation:floatIn .3s ease;transition:all .25s cubic-bezier(.34,.1,.68,1);max-width:calc(100vw - 32px);pointer-events:auto;backdrop-filter:blur(4px)}
.float-cart:hover{transform:translateX(-50%) translateY(-4px);box-shadow:0 12px 40px rgba(34,197,94,.4),0 4px 12px rgba(0,0,0,.1)}
.float-cart:active{transform:translateX(-50%) translateY(-2px)}
.float-cart.cart-pulse{animation:cartPulse .6s cubic-bezier(.34,.1,.68,1)}
@keyframes cartPulse{0%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.08)}100%{transform:translateX(-50%) scale(1)}}
.float-cart-icon-badge{position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cart-badge{position:absolute;top:-8px;right:-8px;background:#fff;color:#16a34a;font-size:10px;font-weight:900;padding:2px 6px;border-radius:12px;min-width:20px;text-align:center;border:2px solid #16a34a;box-shadow:0 2px 6px rgba(0,0,0,.1)}
.float-cart-content{display:flex;flex-direction:column;gap:1px;min-width:60px}
.cart-qty-text{font-size:12px;font-weight:700;opacity:.9}
.cart-amount-text{font-size:15px;font-weight:900;letter-spacing:-.3px}
.float-cart-meta{display:flex;flex-direction:column;gap:2px;font-size:10px;opacity:.9}
.cart-savings{background:rgba(255,255,255,.2);padding:2px 6px;border-radius:4px;font-weight:700}
.cart-delivery{background:rgba(255,255,255,.15);padding:2px 6px;border-radius:4px;font-weight:700}
.cart-chevron{opacity:.8;transition:transform .25s}
.float-cart:hover .cart-chevron{transform:translateX(3px)}
@keyframes floatIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@media(max-width:768px){.float-cart{gap:10px;padding:11px 16px}.cart-amount-text{font-size:14px}.float-cart-meta{gap:1px;font-size:9px}}
@media(max-width:480px){.float-cart{gap:8px;padding:10px 14px;font-size:12px;bottom:16px;border-radius:40px}.float-cart-content{min-width:50px}.cart-qty-text{font-size:11px}.cart-amount-text{font-size:13px}.float-cart-meta{display:none}.cart-badge{font-size:9px;padding:1px 4px}}

.footer{background:linear-gradient(135deg,#0f172a,#1e293b);border-top:2px solid rgba(59,130,246,.1);margin-top:60px;position:relative;z-index:20;padding-bottom:100px}
.footer-main{padding:48px clamp(16px,4vw,48px)}
.footer-top{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:40px;align-items:start}
.footer-brand-sec{max-width:380px}
.footer-brand{display:flex;align-items:flex-start;gap:12px;margin-bottom:8px}
.logo-mark-sm{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#fff;font-family:'DM Sans',sans-serif;flex-shrink:0}
.footer-links-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;margin-bottom:24px}
.footer-bottom{display:flex;align-items:center;justify-content:space-between;padding-top:24px;border-top:1px solid rgba(255,255,255,.05)}
@media(max-width:1024px){.footer-links-grid{grid-template-columns:repeat(2,1fr);gap:24px}}
@media(max-width:768px){.footer-top{grid-template-columns:1fr;gap:24px}.footer-links-grid{grid-template-columns:1fr 1fr;gap:20px}.footer-bottom{flex-direction:column;gap:16px;align-items:flex-start;text-align:center}.footer-main{padding:36px clamp(16px,4vw,32px)}}
@media(max-width:480px){.footer-top{margin-bottom:28px}.footer-links-grid{grid-template-columns:1fr;gap:16px;margin-bottom:18px}.footer-bottom{font-size:11px;gap:12px}}

@media(max-width:768px){.hero-art{display:none}.hero-inner{flex-direction:column;gap:32px}.pin-row{flex-direction:column}.pin-inp-wrap{width:100%}}
@media(max-width:480px){.hero-title{font-size:clamp(24px,6vw,32px)}.pin-inp{font-size:14px;padding:11px 14px 11px 36px}.pin-btn{padding:11px 16px;font-size:12px}.section-title{font-size:16px}.vendor-name{font-size:13px}.hero-sub{font-size:14px;margin-bottom:20px}}
`;

export default UrbexonHour;