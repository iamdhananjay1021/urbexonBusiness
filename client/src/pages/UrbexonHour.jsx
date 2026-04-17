/**
 * UrbexonHour.jsx — Production Ready v3.0 (Flipkart Minutes Style)
 * ─────────────────────────────────────────────────────────────────
 * • Pincode saved permanently after first entry (logged-in users)
 * • Change pincode option always visible
 * • Products load instantly for returning users
 * • Category filter chips
 * • Vendor-grouped product grid
 * • Floating UH cart button
 * • Qty controls directly on cards (Flipkart Minutes style)
 * • Auto-detect location from GPS
 */

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../hooks/useCart";
import {
    FaBolt, FaMapMarkerAlt, FaStore, FaShoppingCart,
    FaClock, FaStar, FaChevronRight, FaSearch, FaBell,
    FaPlus, FaMinus, FaTimes, FaTrash, FaFire,
} from "react-icons/fa";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ── Product Card (Flipkart Minutes style: qty controls) ── */
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
            // Trigger haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(10);
        }
    }, [inCart, product, addItem]);

    const handleCardClick = useCallback(() => {
        nav(`/uh-product/${product.slug || product._id}`);
    }, [nav, product]);

    return (
        <div className="pc" onClick={handleCardClick} role="link">
            <div className="pc-img-wrap">
                {discount > 0 && <span className="pc-disc">{discount}% OFF</span>}
                {product.tag && <span className="pc-tag">{product.tag}</span>}
                <img
                    src={product.images?.[0]?.url || product.image?.url || product.image || "/placeholder.png"}
                    alt={product.name} className="pc-img" loading="lazy"
                    onError={(e) => { e.target.src = "/placeholder.png"; }}
                />
            </div>
            <div className="pc-body">
                {product.brand && <div className="pc-brand">{product.brand}</div>}
                <div className="pc-name">{product.name}</div>
                {product.prepTimeMinutes && (
                    <div className="pc-prep"><FaClock size={9} /> {product.prepTimeMinutes} min prep</div>
                )}
                <div className="pc-price-row">
                    <span className="pc-price">{fmt(product.price)}</span>
                    {product.mrp && product.mrp > product.price && (
                        <span className="pc-mrp">{fmt(product.mrp)}</span>
                    )}
                    {discount > 0 && <span className="pc-disc-text">{discount}% off</span>}
                </div>

                {/* Flipkart Minutes style: ADD / qty stepper */}
                {!inCart ? (
                    <button className="pc-add" onClick={handleAdd}>
                        <FaPlus size={10} /> ADD
                    </button>
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

/* ── Helper Functions (Industry-level cart management) ── */
const calculateEstimatedDeliveryTime = (pinData) => {
    if (!pinData?.available) return { min: 45, max: 120 };
    // If within premium zone, faster delivery
    if (pinData.premium) return { min: 25, max: 50 };
    // Normal zones
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

const scrollToCart = () => {
    const cartBtn = document.querySelector('.float-cart');
    if (cartBtn) {
        cartBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Add pulse animation
        cartBtn.classList.add('cart-highlight');
        setTimeout(() => cartBtn.classList.remove('cart-highlight'), 1500);
    }
};

/* ── Main Page ────────────────────────────────────────── */
const UrbexonHour = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const { uhTotalQty, uhTotal, uhItems } = useCart();

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
    const [initialLoading, setInitialLoading] = useState(false);
    const [showPincodeEdit, setShowPincodeEdit] = useState(false);
    const searchQuery = searchParams.get("search") || "";
    const clearSearch = useCallback(() => {
        setSearchParams(prev => { prev.delete("search"); return prev; }, { replace: true });
    }, [setSearchParams]);
    const [uhDeals, setUhDeals] = useState([]);
    const [cartAnimating, setCartAnimating] = useState(false);

    /* ── Fetch UH categories from API on mount ── */
    useEffect(() => {
        api.get("/categories", { params: { type: "urbexon_hour" } }).then(({ data }) => {
            const cats = Array.isArray(data) ? data : data.categories || [];
            setApiCategories(cats.filter(c => c.isActive !== false));
        }).catch(() => { });
    }, []);

    /* ── Trigger cart animation when items added ── */
    useEffect(() => {
        if (uhTotalQty > 0) {
            setCartAnimating(true);
            const timer = setTimeout(() => setCartAnimating(false), 600);
            return () => clearTimeout(timer);
        }
    }, [uhTotalQty]);

    /* ── Load saved pincode on mount ── */
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            // 1) Try user account pincode (logged in)
            let code = null;
            if (user) {
                try {
                    const { data } = await api.get("/addresses/uh-pincode");
                    if (data?.uhPincode?.code && !cancelled) {
                        setSavedPincode(data.uhPincode);
                        setPincode(data.uhPincode.code);
                        code = data.uhPincode.code;
                    }
                } catch { /* continue */ }
            }
            // 2) Fallback to localStorage (already read in state init)
            if (!code && savedPincode?.code) {
                code = savedPincode.code;
                setPincode(code);
            }
            // 3) Fetch products for pincode
            if (code && !cancelled) {
                checkPincodeInner(code);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line

    /* ── Save pincode permanently ── */
    const savePincode = useCallback(async (code, pinInfo) => {
        const pincodeData = {
            code,
            area: pinInfo?.area || null,
            city: pinInfo?.city || null,
            state: pinInfo?.state || null,
        };

        // Save to localStorage (works for guests too)
        localStorage.setItem("uh_pincode", JSON.stringify(pincodeData));
        setSavedPincode(pincodeData);

        // Save to user account if logged in
        if (user) {
            try { await api.post("/addresses/uh-pincode", pincodeData); } catch { /* silent */ }
        }
    }, [user]);

    /* ── Track cart analytics (industry-level feature) ── */
    const trackCartInteraction = useCallback((eventType, cartData) => {
        // Send analytics to backend - valuable for business insights
        const analyticsPayload = {
            event: eventType, // 'view_cart', 'add_item', 'remove_item', 'checkout'
            timestamp: new Date().toISOString(),
            cartValue: cartData?.total || 0,
            itemCount: cartData?.qty || 0,
            itemsList: cartData?.items || [],
            pincode: cartData?.pincode,
            userId: cartData?.userId,
        };
        // This would typically be sent to your analytics service
        // api.post('/analytics/cart-interaction', analyticsPayload).catch(() => {});
    }, []);

    /* ── Get cart summary for quick insights ── */
    const getCartSummary = useCallback(() => {
        if (!Array.isArray(uhItems) || uhItems.length === 0) return null;

        const summary = {
            totalItems: uhTotalQty,
            totalAmount: uhTotal,
            totalSavings: calculateEstimatedSavings(uhItems),
            itemBreakdown: {
                uniqueItems: uhItems.length,
                averagePrice: Math.round(uhTotal / uhTotalQty),
                maxPricedItem: Math.max(...uhItems.map(i => i.price || 0)),
                minPricedItem: Math.min(...uhItems.map(i => i.price || 0)),
            },
            estimatedDelivery: calculateEstimatedDeliveryTime(pinData),
        };
        return summary;
    }, [uhItems, uhTotalQty, uhTotal, pinData]);

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

    /* ── Inner Pincode Check (no useCallback dep issues) ── */
    const checkPincodeInner = async (code) => {
        const pc = code.trim();
        if (!/^\d{6}$/.test(pc)) return;
        setLoading(true); setError(""); setPinData(null); setProducts([]); setCategories([]); setActiveCategory(null);
        try {
            const { data } = await api.get(`/pincode/check/${pc}`);
            setPinData(data);
            if (data.available) {
                // Fetch products + deals in parallel
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

                // Save pincode (fire-and-forget)
                const pincodeData = { code: pc, area: data.area || null, city: data.city || null, state: data.state || null };
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

    /* ── Search filter ── */
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

    /* ── Memoized cart metrics ── */
    const cartSavings = useMemo(() => calculateEstimatedSavings(uhItems), [uhItems]);
    const deliveryEta = useMemo(() => calculateEstimatedDeliveryTime(pinData), [pinData]);

    const hasActiveService = pinData?.available && products.length > 0;
    // Only show pincode entry if:
    // 1. No saved pincode (first visit), or
    // 2. User explicitly clicks 'Change' (showPincodeEdit)
    const showHero = (!savedPincode?.code && !hasActiveService && !loading) || showPincodeEdit;
    const showSkeleton = loading && savedPincode?.code && !showPincodeEdit;

    return (
        <div className="uh-root">
            <style>{PAGE_CSS}</style>
            <main>

                {/* ── UH LOCATION BAR (below main navbar) ── */}
                {(hasActiveService || showSkeleton) && !showPincodeEdit && (
                    <div className="uh-loc-bar">
                        <div className="container uh-loc-bar-inner">
                            <div className="uh-loc-bar-left">
                                <FaBolt size={12} className="uh-loc-bolt" />
                                <span className="uh-loc-bar-label">Delivering to</span>
                                <span className="uh-loc-bar-area">{savedPincode?.area || savedPincode?.city || pincode}</span>
                                <span className="uh-loc-bar-eta">• {deliveryEta.min}–{deliveryEta.max} min</span>
                            </div>
                            <button className="uh-loc-bar-change" onClick={handleChangePincode}>
                                Change
                            </button>
                        </div>
                    </div>
                )}

                {/* ── HERO (first time or changing pincode) ── */}
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

                {/* ── TRUST STRIP (from delivery config) ── */}
                {(hasActiveService || showSkeleton) && !showPincodeEdit && (
                    <div className="trust-strip">
                        <div className="container trust-inner">
                            {[
                                { ic: "🏍️", t: "FAST DELIVERY", sub: deliveryEta ? `${deliveryEta.min}–${deliveryEta.max} min` : "45–120 min" },
                                { ic: "✅", t: "QUALITY CHECKED", sub: "100% verified" },
                                { ic: "🏪", t: "LOCAL VENDORS", sub: `${vendorGroups.length || "0"} stores` },
                                { ic: "🔒", t: "SECURE PAYMENTS", sub: "Safe & encrypted" },
                            ].map((f) => (
                                <div key={f.t} className="trust-item">
                                    <span className="trust-ic">{f.ic}</span>
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

                {/* ── CATEGORY CHIPS (dynamic UH categories from backend) ── */}
                {hasActiveService && !showPincodeEdit && (
                    <div className="section">
                        <div className="container">
                            <div className="section-head">
                                <span className="section-title">Shop by Category</span>
                                {activeCategory && (
                                    <button className="see-all-btn" onClick={() => setActiveCategory(null)}>
                                        Clear filter
                                    </button>
                                )}
                            </div>
                            <div className="g-cat-grid">
                                {apiCategories.length > 0 ? apiCategories.map((cat) => {
                                    const catName = cat.name || cat;
                                    const hasProducts = categories.includes(catName);
                                    return (
                                        <div
                                            key={cat._id || catName}
                                            className={`g-cat-item${activeCategory === catName ? " active" : ""}${!hasProducts ? " g-cat-dim" : ""}`}
                                            onClick={() => hasProducts && setActiveCategory((prev) => prev === catName ? null : catName)}
                                        >
                                            {cat.image?.url ? (
                                                <img src={cat.image.url} alt={catName} className="g-cat-img" loading="lazy" />
                                            ) : (
                                                <div className="g-cat-emoji">{cat.emoji || getCategoryEmoji(catName)}</div>
                                            )}
                                            <div className="g-cat-label">{catName}</div>
                                        </div>
                                    );
                                }) : categories.map((cat) => (
                                    <div
                                        key={cat}
                                        className={`g-cat-item${activeCategory === cat ? " active" : ""}`}
                                        onClick={() => setActiveCategory((prev) => prev === cat ? null : cat)}
                                    >
                                        <div className="g-cat-emoji">{getCategoryEmoji(cat)}</div>
                                        <div className="g-cat-label">{cat}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── UH FLASH DEALS (hide when searching) ── */}
                {uhDeals.length > 0 && !searchQuery && (
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

                {/* ── AVAILABILITY BAR ── */}
                {pinData?.available && (
                    <div className="avail-bar">
                        <div className="container avail-inner">
                            <FaMapMarkerAlt size={13} className="avail-pin" />
                            <span>
                                Showing results for{" "}
                                <strong>{pinData.area || pincode}</strong>
                                {pinData.city ? `, ${pinData.city}` : ""} —{" "}
                                <strong>{pinData.vendorCount || vendorGroups.length}</strong>{" "}
                                vendor{(pinData.vendorCount || vendorGroups.length) !== 1 ? "s" : ""} available
                            </span>
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
                            <button
                                className="search-clear-btn"
                                onClick={clearSearch}
                                title="Clear search"
                            >
                                <FaTimes size={12} /> Clear
                            </button>
                        </div>
                    </div>
                )}

                {/* ── PRODUCTS BY VENDOR ── */}
                {pinData?.available && (
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
                                {(activeCategory || searchQuery) && (
                                    <button
                                        className="pin-btn"
                                        style={{ marginTop: 16 }}
                                        onClick={() => { setActiveCategory(null); clearSearch(); }}
                                    >
                                        Show all products
                                    </button>
                                )}
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

            {/* ── FLOATING UH CART BUTTON - Industry Level ── */}
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
                    {/* Footer Top - Brand & Newsletter */}
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
                            <h4 style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginkBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Subscribe for Updates</h4>
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <input type="email" placeholder="Your email" style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans'" }} />
                                <button style={{ padding: "10px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseEnter={(e) => e.target.style.background = "#2563eb"} onMouseLeave={(e) => e.target.style.background = "#3b82f6"}>Subscribe</button>
                            </div>
                        </div>
                    </div>

                    {/* Footer Middle - Links Sections */}
                    <div className="footer-links-grid">
                        <div className="footer-section">
                            <h5 style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Company</h5>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>About Us</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Careers</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Press</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Blog</a></li>
                            </ul>
                        </div>

                        <div className="footer-section">
                            <h5 style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Help & Support</h5>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>FAQs</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Contact Us</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Track Order</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Support Center</a></li>
                            </ul>
                        </div>

                        <div className="footer-section">
                            <h5 style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Legal</h5>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Privacy Policy</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Terms & Conditions</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Refund Policy</a></li>
                                <li><a href="#" style={{ fontSize: 13, color: "#d1d5db", textDecoration: "none", lineHeight: 2, transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#3b82f6"} onMouseLeave={(e) => e.target.style.color = "#d1d5db"}>Shipping Policy</a></li>
                            </ul>
                        </div>

                        <div className="footer-section">
                            <h5 style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Follow Us</h5>
                            <div style={{ display: "flex", gap: 10 }}>
                                <a href="#" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(59,130,246,.2)", border: "1px solid rgba(59,130,246,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", textDecoration: "none", transition: "all 0.2s", fontSize: 14 }} onMouseEnter={(e) => { e.target.style.background = "#3b82f6"; e.target.style.color = "#fff"; }} onMouseLeave={(e) => { e.target.style.background = "rgba(59,130,246,.2)"; e.target.style.color = "#3b82f6"; }} title="Facebook">f</a>
                                <a href="#" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(59,130,246,.2)", border: "1px solid rgba(59,130,246,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", textDecoration: "none", transition: "all 0.2s", fontSize: 12 }} onMouseEnter={(e) => { e.target.style.background = "#3b82f6"; e.target.style.color = "#fff"; }} onMouseLeave={(e) => { e.target.style.background = "rgba(59,130,246,.2)"; e.target.style.color = "#3b82f6"; }} title="Twitter">𝕏</a>
                                <a href="#" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(59,130,246,.2)", border: "1px solid rgba(59,130,246,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", textDecoration: "none", transition: "all 0.2s", fontSize: 14 }} onMouseEnter={(e) => { e.target.style.background = "#3b82f6"; e.target.style.color = "#fff"; }} onMouseLeave={(e) => { e.target.style.background = "rgba(59,130,246,.2)"; e.target.style.color = "#3b82f6"; }} title="Instagram">📷</a>
                                <a href="#" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(59,130,246,.2)", border: "1px solid rgba(59,130,246,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", textDecoration: "none", transition: "all 0.2s", fontSize: 14 }} onMouseEnter={(e) => { e.target.style.background = "#3b82f6"; e.target.style.color = "#fff"; }} onMouseLeave={(e) => { e.target.style.background = "rgba(59,130,246,.2)"; e.target.style.color = "#3b82f6"; }} title="LinkedIn">in</a>
                            </div>
                        </div>
                    </div>

                    {/* Footer Divider */}
                    <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.1), transparent)", margin: "24px 0" }} />

                    {/* Footer Bottom - Copyright & Payment Methods */}
                    <div className="footer-bottom">
                        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", justifyContent: "space-between", width: "100%" }}>
                            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>© 2025 Urbexon Hour. All rights reserved. | Made with ❤️ for local communities</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>We Accept</span>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <span style={{ fontSize: 16, background: "rgba(255,255,255,.1)", padding: "4px 8px", borderRadius: 4 }}>💳</span>
                                    <span style={{ fontSize: 16, background: "rgba(255,255,255,.1)", padding: "4px 8px", borderRadius: 4 }}>🏦</span>
                                    <span style={{ fontSize: 16, background: "rgba(255,255,255,.1)", padding: "4px 8px", borderRadius: 4 }}>📱</span>
                                    <span style={{ fontSize: 16, background: "rgba(255,255,255,.1)", padding: "4px 8px", borderRadius: 4 }}>₹</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
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

/* ── CSS ── */
const PAGE_CSS = `
/* fonts loaded from index.html */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#fafbfc}
main{position:relative;z-index:1}
.uh-root{min-height:100vh;background:#fafbfc;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;color:#1a202c;position:relative;overflow-x:hidden}
.container{max-width:1280px;margin:0 auto;padding:0 clamp(16px,4vw,48px)}

/* Initial loading */
.uh-initial-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:14px;color:#64748b;font-size:14px}
.uh-loader{width:40px;height:40px;border:3px solid #e2e8f0;border-top:3px solid #3b82f6;border-radius:50%;animation:uhspin .8s linear infinite}
@keyframes uhspin{to{transform:rotate(360deg)}}

/* UH LOCATION BAR */
.uh-loc-bar{background:#1a1740;border-bottom:1px solid #2d2a5e}
.uh-loc-bar-inner{display:flex;align-items:center;justify-content:space-between;padding:8px 0}
.uh-loc-bar-left{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.85);font-weight:600}
.uh-loc-bolt{color:#c9a84c}
.uh-loc-bar-label{color:rgba(255,255,255,.5);font-size:12px}
.uh-loc-bar-area{color:#fff;font-weight:700}
.uh-loc-bar-eta{color:#c9a84c;font-weight:700;font-size:12px}
.uh-loc-bar-change{background:none;border:1px solid rgba(201,168,76,.4);color:#c9a84c;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
.uh-loc-bar-change:hover{background:rgba(201,168,76,.15);border-color:#c9a84c}
@media(max-width:640px){
  .uh-loc-bar-inner{padding:6px 0;gap:6px}
  .uh-loc-bar-left{font-size:11px;gap:5px;flex-wrap:wrap}
  .uh-loc-bar-change{padding:4px 10px;font-size:10px}
}

/* SKELETON */
.uh-sk-cats{display:flex;gap:16px;margin-bottom:20px}
.uh-sk-cat{display:flex;flex-direction:column;align-items:center;gap:8px}
.uh-sk-circle{width:56px;height:56px;border-radius:14px;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
.uh-sk-line-sm{width:48px;height:10px;border-radius:4px;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
.uh-sk-section{margin-bottom:16px}
.uh-sk-line-lg{width:140px;height:18px;border-radius:6px;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
.uh-sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.uh-sk-card{border-radius:12px;border:1px solid #f0f0f0;overflow:hidden;background:#fff}
.uh-sk-card-img{aspect-ratio:1;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
.uh-sk-card-body{padding:12px;display:flex;flex-direction:column;gap:8px}
.uh-sk-line{height:10px;border-radius:4px;background:linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);background-size:200% 100%;animation:uhsk 1.2s infinite}
@keyframes uhsk{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* HERO */
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

/* PINCODE */
.pin-block{max-width:600px}
.pin-row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.pin-inp-wrap{flex:1;min-width:200px;position:relative;display:flex;align-items:center}
.pin-search-ic{position:absolute;left:14px;color:rgba(0,0,0,.3);pointer-events:none;font-size:14px}
.pin-inp{width:100%;padding:13px 14px 13px 40px;background:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:1.5px;color:#1f2937;outline:none;box-shadow:0 4px 16px rgba(0,0,0,.15);font-family:'DM Sans',sans-serif;transition:all .2s}
.pin-inp:focus{box-shadow:0 8px 24px rgba(0,0,0,.2)}
.pin-inp::placeholder{color:#a1a1a1;letter-spacing:0;font-weight:400;font-size:13px}
.pin-btn{padding:13px 28px;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:10px;color:#fff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 4px 16px rgba(59,130,246,.3);transition:all .2s;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:'DM Sans',sans-serif;letter-spacing:.3px}
.pin-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(59,130,246,.4)}
.pin-btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.detect-btn{background:none;border:none;color:rgba(255,255,255,.75);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-family:'DM Sans',sans-serif;font-weight:600;transition:all .15s;border-radius:8px}
.detect-btn:hover{color:#fff;background:rgba(255,255,255,.1)}
.detect-btn:disabled{opacity:.5;cursor:not-allowed}
.pin-error{color:#fca5a5;font-size:12px;margin-top:8px;font-weight:500}
.spin{width:14px;height:14px;display:inline-block;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sp .6s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}

/* TRUST STRIP - Premium */
.trust-strip{background:linear-gradient(135deg,#f8fafc,#f0f9ff);border-bottom:1px solid #e0e7ff;border-top:1px solid #e0e7ff}
.trust-inner{display:grid;grid-template-columns:repeat(4,1fr);gap:0;width:100%;overflow:hidden}
.trust-item{display:flex;align-items:center;gap:clamp(12px,2vw,16px);padding:clamp(16px,3vw,26px) clamp(18px,3vw,28px);border-right:1px solid #e0e7ff;position:relative;transition:all .25s;min-width:0}
.trust-item:last-child{border-right:none}
.trust-item:hover{background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.05));transform:translateY(-1px)}
.trust-ic{font-size:clamp(24px,3.5vw,38px);flex-shrink:0;animation:slideInTrust .6s cubic-bezier(.34,.1,.68,1) backwards;filter:drop-shadow(0 2px 4px rgba(0,0,0,.05))}
.trust-title{font-size:clamp(11px,2.5vw,13px);font-weight:900;color:#0f172a;letter-spacing:.5px;text-transform:uppercase;font-family:'DM Sans';white-space:normal;word-break:break-word}
.trust-sub{font-size:clamp(10px,2vw,12px);color:#64748b;margin-top:2px;line-height:1.3;font-weight:500;white-space:normal;word-break:break-word}
.trust-item:nth-child(1) .trust-ic{animation-delay:0ms}
.trust-item:nth-child(2) .trust-ic{animation-delay:80ms}
.trust-item:nth-child(3) .trust-ic{animation-delay:160ms}
.trust-item:nth-child(4) .trust-ic{animation-delay:240ms}
@keyframes slideInTrust{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:1024px){
  .trust-inner{grid-template-columns:repeat(4,1fr)}
  .trust-item{padding:clamp(14px,2.5vw,22px) clamp(14px,2.5vw,24px)}
}
@media(max-width:768px){
  .trust-inner{grid-template-columns:repeat(2,1fr)}
  .trust-item{border-right:none;border-bottom:1px solid #e0e7ff;padding:12px 16px;min-width:0}
  .trust-item:nth-child(odd){border-right:1px solid #e0e7ff}
  .trust-item:nth-child(3),.trust-item:nth-child(4){border-bottom:none}
  .trust-sub{display:none}
  .trust-title{font-size:clamp(11px,3vw,12px)}
  .trust-ic{font-size:clamp(22px,4vw,30px)}
}
@media(max-width:480px){
  .trust-inner{grid-template-columns:repeat(2,1fr)}
  .trust-item{padding:10px 12px;gap:8px}
  .trust-title{font-size:10px}
  .trust-sub{display:none}
  .trust-ic{font-size:20px}
}

/* SECTIONS */
.section{background:#fff;margin:16px 0;padding:clamp(24px,4vw,40px) 0;border-bottom:1px solid #f0f0f0}
.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:12px}
.section-title{font-size:clamp(16px,3vw,22px);font-weight:800;color:#1f2937;letter-spacing:-.3px}
.see-all-btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#3b82f6;font-weight:700;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;padding:4px 8px;border-radius:6px;transition:all .2s}
.see-all-btn:hover{background:rgba(59,130,246,.08)}

/* CATEGORY GRID */
.g-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:16px;margin:0 -8px;padding:0 8px}
@media(max-width:640px){.g-cat-grid{grid-template-columns:repeat(4,1fr);gap:12px;margin:0;padding:0}}
@media(max-width:480px){.g-cat-grid{grid-template-columns:repeat(3,1fr);gap:10px}}
.g-cat-item{display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;position:relative;transition:transform .2s;border-radius:16px;padding:8px 4px}
.g-cat-item:hover{transform:translateY(-4px)}
.g-cat-emoji{width:clamp(56px,10vw,88px);height:clamp(56px,10vw,88px);background:#fff;border:2px solid #e5e7eb;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:clamp(24px,4vw,36px);transition:all .25s;box-shadow:0 2px 8px rgba(0,0,0,.05)}
.g-cat-img{width:clamp(56px,10vw,88px);height:clamp(56px,10vw,88px);object-fit:cover;border-radius:16px;border:2px solid #e5e7eb;transition:all .25s;box-shadow:0 2px 8px rgba(0,0,0,.05)}
.g-cat-item:hover .g-cat-img,.g-cat-item.active .g-cat-img{border-color:#3b82f6;box-shadow:0 4px 16px rgba(59,130,246,.15);transform:scale(1.08)}
.g-cat-dim{opacity:.45;pointer-events:none}
.g-cat-item:hover .g-cat-emoji,.g-cat-item.active .g-cat-emoji{border-color:#3b82f6;background:#eff6ff;box-shadow:0 4px 16px rgba(59,130,246,.15);transform:scale(1.08)}
.g-cat-label{font-size:11px;font-weight:600;color:#475569;text-align:center;text-transform:capitalize;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;transition:color .2s}
.g-cat-item:hover .g-cat-label,.g-cat-item.active .g-cat-label{color:#3b82f6;font-weight:700}

/* AVAILABILITY */
.avail-bar{background:linear-gradient(135deg,#dcfce7,#ecfdf5);border-top:1px solid #bbf7d0;border-bottom:1px solid #bbf7d0;margin:12px 0}
.avail-inner{display:flex;align-items:center;gap:10px;padding:14px 16px;font-size:13px;color:#166534;font-weight:500}
.avail-pin{color:#16a34a;flex-shrink:0;font-size:14px}

/* SEARCH RESULTS BAR */
.search-results-bar{background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:1px solid #bfdbfe;border-bottom:2px solid #3b82f6;margin:12px 0;animation:slideDown .3s ease;position:relative;z-index:25}
.search-results-inner{display:flex;align-items:center;gap:8px;padding:12px 16px}
.search-results-inner>span{font-size:13px;color:#1e40af;font-weight:500;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.search-results-inner strong{color:#1e3a8a;font-weight:700}
.search-clear-btn{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#dc2626;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:4px;transition:all .2s;white-space:nowrap;flex-shrink:0}
.search-clear-btn:hover{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.5)}
@keyframes slideDown{from{opacity:0;transform:translateY(-8px);max-height:0}to{opacity:1;transform:translateY(0);max-height:60px}}

/* UH FLASH DEALS */
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
.uh-deals-scroll-item{min-width:200px;max-width:220px;flex-shrink:0;scroll-snap-align:start;background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;transition:all .25s;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.uh-deals-scroll-item:hover{border-color:#ff6b35;box-shadow:0 6px 20px rgba(255,107,53,.12);transform:translateY(-3px)}
.uh-deals-scroll-item .pc{padding:0}
.uh-deals-scroll-item .pc-img-wrap{border-radius:0}
.uh-deal-timer{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;background:#fff7ed;border-top:1px solid #fed7aa;font-size:11px;font-weight:700;color:#ea580c;letter-spacing:.2px}
.uh-deal-badge{padding:8px 10px;background:#fff3cd;border-top:1px solid #ffe69c;font-size:11px;font-weight:700;text-align:center;color:#856404}
.uh-deal-badge.ending-soon{background:linear-gradient(135deg,#fecaca,#fca5a5);border-top:1px solid #f87171;color:#7f1d1d;font-weight:800}
@media(max-width:640px){.uh-deals-scroll-item{min-width:180px;max-width:200px}}

/* VENDOR BLOCK */
.vendor-block{background:#fff;border-radius:14px;border:1px solid #e5e7eb;margin:16px 0;overflow:visible;transition:all .25s;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.vendor-block:hover{border-color:#e0e7ff;box-shadow:0 4px 16px rgba(0,0,0,.06)}
.vendor-header{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid #f3f4f6;background:#fafbfc;transition:background .2s}
.vendor-avatar{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#dbeafe,#eff6ff);color:#1e40af;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px}
.vendor-info{flex:1}
.vendor-name{font-size:14px;font-weight:800;color:#1f2937;letter-spacing:-.2px}
.vendor-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:#6b7280;margin-top:4px;flex-wrap:wrap;font-weight:500}
.star-ic{color:#f59e0b;font-size:11px}

/* PRODUCT GRID */
.prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;background:transparent;padding:20px;border-radius:0 0 14px 14px}
@media(max-width:768px){.prod-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:16px}}
@media(max-width:480px){.prod-grid{grid-template-columns:repeat(2,1fr);gap:10px;padding:12px}}

/* PRODUCT CARD */
.pc{background:#fff;padding:0;cursor:pointer;border-radius:12px;transition:all .25s;border:1px solid transparent;height:100%;display:flex;flex-direction:column;overflow:hidden}
.pc:hover{background:#fff;border-color:#e5e7eb;box-shadow:0 4px 16px rgba(0,0,0,.08);transform:translateY(-2px)}
.pc-img-wrap{position:relative;aspect-ratio:1;background:linear-gradient(135deg,#f8fafc,#f0f9ff);border-radius:0;overflow:hidden;border:none;flex-shrink:0}
.pc-img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.pc:hover .pc-img{transform:scale(1.05)}
.pc-disc{position:absolute;top:10px;left:10px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:800;padding:4px 8px;border-radius:6px;letter-spacing:.4px;box-shadow:0 2px 8px rgba(239,68,68,.25)}
.pc-tag{position:absolute;top:10px;right:10px;background:#f97316;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
.pc-body{padding:12px;display:flex;flex-direction:column;gap:4px;flex:1}
.pc-brand{font-size:10px;font-weight:800;color:#6366f1;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.pc-name{font-size:13px;font-weight:700;color:#1f2937;margin-bottom:4px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pc-prep{display:flex;align-items:center;gap:5px;font-size:11px;color:#9ca3af;margin-bottom:4px;font-weight:500}
.pc-price-row{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.pc-price{font-size:15px;font-weight:800;color:#1f2937}
.pc-mrp{font-size:12px;color:#9ca3af;text-decoration:line-through;font-weight:500}
.pc-disc-text{font-size:12px;font-weight:700;color:#16a34a;background:#dcfce7;padding:2px 6px;border-radius:4px}

/* ADD button */
.pc-add{width:100%;padding:10px;background:#fff;border:1.5px solid #3b82f6;color:#3b82f6;font-weight:700;font-size:13px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .25s cubic-bezier(.34,.1,.68,1);font-family:'DM Sans',sans-serif;letter-spacing:.2px;margin-top:auto;position:relative;overflow:hidden}
.pc-add::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:rgba(255,255,255,.5);transition:left .4s ease}
.pc-add:hover{background:#3b82f6;color:#fff;box-shadow:0 4px 12px rgba(59,130,246,.25);transform:scale(1.02)}
.pc-add:active{transform:scale(0.98)}

/* QTY Stepper (Modern style) */
.pc-qty-stepper{display:flex;align-items:center;justify-content:space-between;border:1.5px solid #3b82f6;border-radius:8px;overflow:hidden;background:#fff;margin-top:auto;transition:all .15s}
.pc-qty-stepper:hover{box-shadow:0 2px 8px rgba(59,130,246,.12)}
.pc-qty-stepper button{width:32px;height:32px;border:none;background:transparent;color:#3b82f6;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s cubic-bezier(.34,.1,.68,1);font-size:12px;font-weight:700;position:relative}
.pc-qty-stepper button:hover{background:#eff6ff;transform:scale(1.1)}
.pc-qty-stepper button:active{transform:scale(0.95)}
.pc-qty-stepper span{flex:1;text-align:center;font-size:14px;font-weight:800;color:#3b82f6;transition:all .15s;user-select:none}
.pc-qty-stepper:hover span{font-weight:900}

/* STATES */
.empty-state{padding:clamp(40px,8vw,80px) 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.empty-ic{color:#d1d5db;font-size:48px}
.empty-title{font-size:18px;font-weight:800;color:#1f2937}
.empty-sub{font-size:14px;color:#6b7280;max-width:380px}
.state-card{background:#fff;border:1.5px solid #e5e7eb;border-radius:14px;padding:clamp(40px,6vw,60px) 32px;text-align:center;margin:24px 0;display:flex;flex-direction:column;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.state-title{font-size:20px;font-weight:800;color:#1f2937;margin-bottom:10px;letter-spacing:-.3px}
.state-sub{font-size:14px;color:#6b7280;margin-bottom:24px;line-height:1.6}
.waitlist-row{display:flex;gap:12px;width:100%;max-width:480px;flex-wrap:wrap}
.waitlist-inp{flex:1;min-width:200px;padding:12px 16px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;color:#1f2937;outline:none;font-family:'DM Sans',sans-serif;transition:all .2s}
.waitlist-inp:focus{border-color:#3b82f6;background:#fff;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
.waitlist-btn{padding:12px 20px;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:8px;color:#fff;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;font-family:'DM Sans',sans-serif;transition:all .2s;box-shadow:0 2px 8px rgba(59,130,246,.2);letter-spacing:.2px}
.waitlist-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(59,130,246,.3)}
.wl-success{background:#dcfce7;border:1.5px solid #86efac;border-radius:10px;color:#15803d;font-weight:700;font-size:14px;text-align:center;padding:18px 20px;margin:20px 0;letter-spacing:.2px}

/* FLOATING CART */
.float-cart{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:50px;font-family:'DM Sans',sans-serif;font-weight:700;box-shadow:0 8px 32px rgba(59,130,246,.35);z-index:50;white-space:nowrap;animation:floatIn .3s ease;transition:all .25s cubic-bezier(.34,.1,.68,1);max-width:calc(100vw - 32px);pointer-events:auto}
.float-cart:hover{transform:translateX(-50%) translateY(-4px);box-shadow:0 12px 40px rgba(59,130,246,.4)}
.float-cart:active{transform:translateX(-50%) translateY(-2px)}
.float-cart.cart-pulse{animation:cartPulse .6s cubic-bezier(.34,.1,.68,1)}
@keyframes cartPulse{0%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.08)}100%{transform:translateX(-50%) scale(1)}}

.float-cart-icon-badge{position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cart-badge{position:absolute;top:-8px;right:-8px;background:#ff3b30;color:#fff;font-size:10px;font-weight:900;padding:2px 6px;border-radius:12px;min-width:20px;text-align:center;border:2px solid rgba(59,130,246)}
.float-cart-content{display:flex;flex-direction:column;gap:2px;min-width:60px}
.cart-qty-text{font-size:13px;font-weight:800;letter-spacing:-.3px}
.cart-amount-text{font-size:14px;font-weight:950;background:linear-gradient(90deg,#fff,#e0e7ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

.float-cart-meta{display:flex;flex-direction:column;gap:2px;font-size:10px;opacity:.85}
.cart-savings{background:rgba(34,197,94,.2);padding:2px 6px;border-radius:4px;font-weight:800;color:#dcfce7}
.cart-delivery{background:rgba(59,130,246,.2);padding:2px 6px;border-radius:4px;font-weight:700;color:#bfdbfe}

.cart-chevron{opacity:.7;transition:transform .25s}
.float-cart:hover .cart-chevron{transform:translateX(2px)}

@keyframes floatIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

@media(max-width:768px){
  .float-cart{gap:10px;padding:11px 14px}
  .cart-amount-text{font-size:13px}
  .float-cart-meta{gap:1px;font-size:9px}
}
@media(max-width:480px){
  .float-cart{gap:8px;padding:10px 12px;font-size:12px;bottom:16px;border-radius:40px}
  .float-cart-content{min-width:50px}
  .cart-qty-text{font-size:12px}
  .cart-amount-text{font-size:13px}
  .float-cart-meta{display:none}
  .cart-badge{font-size:9px;padding:1px 4px}
}

/* FOOTER */
.footer{background:linear-gradient(135deg,#111827,#1f2937);border-top:2px solid rgba(59,130,246,.1);margin-top:60px;position:relative;z-index:20;padding-bottom:100px}
.footer-main{padding:48px clamp(16px,4vw,48px)}

/* Footer Top - Brand & Newsletter */
.footer-top{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:40px;align-items:start}
.footer-brand-sec{max-width:380px}
.footer-brand{display:flex;align-items:flex-start;gap:12px;margin-bottom:8px}
.logo-mark-sm{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#fff;font-family:'DM Sans',sans-serif;flex-shrink:0}

.footer-newsletter h4{margin:0 0 8px 0}
.footer-newsletter input::placeholder{color:rgba(255,255,255,.4)}
.footer-newsletter input:focus{outline:none;border-color:#3b82f6;background:rgba(59,130,246,.1)}

/* Footer Links Grid */
.footer-links-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;margin-bottom:24px}
.footer-section h5{margin:0 0 12px 0}
.footer-section ul li{line-height:2.2}

/* Footer Bottom */
.footer-bottom{display:flex;align-items:center;justify-content:space-between;padding-top:24px;border-top:1px solid rgba(255,255,255,.05)}

@media(max-width:1024px){
  .footer-links-grid{grid-template-columns:repeat(2,1fr);gap:24px}
}
@media(max-width:768px){
  .footer-top{grid-template-columns:1fr;gap:24px}
  .footer-links-grid{grid-template-columns:1fr 1fr;gap:20px}
  .footer-bottom{flex-direction:column;gap:16px;align-items:flex-start;text-align:center}
  .footer-main{padding:36px clamp(16px,4vw,32px)}
}
@media(max-width:480px){
  .footer-top{margin-bottom:28px}
  .footer-links-grid{grid-template-columns:1fr;gap:16px;margin-bottom:18px}
  .footer-section h5{font-size:11px;margin-bottom:10px}
  .footer-section ul li{line-height:1.8;font-size:12px}
  .footer-newsletter{width:100%}
  .footer-newsletter button{width:100%}
  .footer-bottom{font-size:11px;gap:12px}
}

/* Mobile responsive */
@media(max-width:768px){
  .hero-art{display:none}
  .uh-pin-bar-inner{flex-direction:column;align-items:stretch;gap:10px}
  .uh-pin-bar-right{width:100%;justify-content:space-between}
  .hero-inner{flex-direction:column;gap:32px}
  .pin-row{flex-direction:column}
  .pin-inp-wrap{width:100%}
}
@media(max-width:480px){
  .hero-title{font-size:clamp(24px,6vw,32px)}
  .pin-inp{font-size:14px;padding:11px 14px 11px 36px}
  .pin-btn{padding:11px 16px;font-size:12px}
  .section-title{font-size:16px}
  .vendor-name{font-size:13px}
  .uh-pin-bar-inner{gap:8px;padding:10px 0}
  .hero-sub{font-size:14px;margin-bottom:20px}
}
`;

export default UrbexonHour;
