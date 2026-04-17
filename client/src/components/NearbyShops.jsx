/**
 * NearbyShops.jsx — Production v3
 * ────────────────────────────────
 * ✅ Works WITHOUT geolocation — uses pincode fallback → all-vendor fallback
 * ✅ Accepts `pincode` prop from UrbexonHour (already knows user's pincode)
 * ✅ Optional geolocation for distance display
 * ✅ Dynamic categories extracted from vendor response
 * ✅ Responsive: 1-col mobile, 2-col tablet, 3-col desktop
 * ✅ Only used in UrbexonHour (removed from Home)
 *
 * Props:
 *   pincode     = string      (6-digit, passed from UH page)
 *   maxResults  = number      (default 20)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import {
    FaMapMarkerAlt, FaStar, FaStore, FaMotorcycle,
    FaClock, FaChevronRight, FaLocationArrow, FaSpinner,
    FaBolt, FaShoppingBag,
} from "react-icons/fa";

/* ── Palette ── */
const C = {
    bg: "#faf9f6", card: "#ffffff", border: "#eae6de", borderLight: "#f3f0e8",
    text: "#1a1a2e", sub: "#3d3d56", muted: "#78788c", hint: "#a3a3b5",
    green: "#22c55e", greenBg: "#f0fdf4",
    amber: "#f59e0b",
    blue: "#3b82f6", blueBg: "#eff6ff",
    violet: "#7c3aed", violetBg: "#f5f3ff",
    grad: "linear-gradient(135deg, #1a1040 0%, #2d1b69 100%)",
    pill: "#7c3aed", pillText: "#fff",
};

const CSS = `
@keyframes ns-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes ns-fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes ns-spin{to{transform:rotate(360deg)}}
.ns-sk{background:linear-gradient(90deg,#f0ede5 25%,#e8e4d9 50%,#f0ede5 75%);background-size:200% 100%;animation:ns-shimmer 1.4s infinite;border-radius:8px}
.ns-fade{animation:ns-fadeUp .4s ease both}
.ns-spin{animation:ns-spin .7s linear infinite}
.ns-card{transition:transform .2s ease,box-shadow .2s ease;cursor:pointer;text-decoration:none;color:inherit}
.ns-card:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(26,26,46,.1)}
.ns-pill{transition:all .18s ease;cursor:pointer;user-select:none;white-space:nowrap}
.ns-pill:hover{transform:scale(1.04)}
.ns-scroll::-webkit-scrollbar{display:none}
@media(max-width:900px){.ns-grid{grid-template-columns:repeat(2,1fr)!important}}
@media(max-width:540px){.ns-grid{grid-template-columns:1fr!important}}
`;

const NearbyShops = ({ pincode, pincodeLabel = '', maxResults = 20 }) => {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [userLoc, setUserLoc] = useState(null); // optional geo for distance
    const [locLabel, setLocLabel] = useState("");
    const prevFetchRef = useRef("");
    const geoTriedRef = useRef(false);

    /* ── Try silent geo detection (no prompt, just use saved) ── */
    useEffect(() => {
        if (geoTriedRef.current) return;
        geoTriedRef.current = true;
        try {
            const saved = localStorage.getItem("user_location_v1");
            if (saved) {
                const d = JSON.parse(saved);
                if (d?.location?.latitude && d?.location?.longitude) {
                    setUserLoc(d.location);
                    setLocLabel(d.label || "");
                }
            }
        } catch { /* ignore */ }
    }, []);

    /* ── Fetch vendors ── */
    const fetchNearby = useCallback(async () => {
        const key = `${pincode || ""},${userLoc?.latitude || ""},${activeCategory || ""}`;
        if (prevFetchRef.current === key) return;
        prevFetchRef.current = key;

        try {
            setLoading(true);
            const params = { limit: maxResults };
            if (pincode) params.pincode = pincode;
            if (userLoc?.latitude && userLoc?.longitude) {
                params.lat = userLoc.latitude;
                params.lng = userLoc.longitude;
                params.radius = 25;
            }
            if (activeCategory) params.category = activeCategory;

            const { data } = await api.get("/vendor/nearby", { params });
            const list = data.vendors || [];
            setVendors(list);

            // Extract categories from all vendors on first load
            if (!activeCategory && list.length > 0) {
                const cats = [...new Set(list.map(v => v.shopCategory).filter(Boolean))].sort();
                setCategories(cats);
            }
        } catch {
            setVendors([]);
        } finally {
            setLoading(false);
        }
    }, [pincode, userLoc?.latitude, userLoc?.longitude, activeCategory, maxResults]);

    useEffect(() => { fetchNearby(); }, [fetchNearby]);

    const handleCategory = (cat) => {
        prevFetchRef.current = "";
        setActiveCategory(cat === activeCategory ? null : cat);
    };

    /* ── Don't render if loading initially and no data yet ── */
    if (!loading && vendors.length === 0 && !activeCategory) return null;

    return (
        <section style={{ padding: "clamp(20px,4vw,36px) 0" }}>
            <style>{CSS}</style>

            {/* ════ HEADER ════ */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FaBolt size={14} color="#fbbf24" />
                        </div>
                        <h2 style={{ fontSize: "clamp(16px,3.5vw,22px)", fontWeight: 800, margin: 0, color: C.text }}>
                            Stores Near You
                        </h2>
                    </div>
                    {(locLabel || pincode) && (
                        <p style={{ fontSize: 12, color: C.muted, margin: 0, paddingLeft: 44 }}>
                            {(pincodeLabel || locLabel) && <><FaMapMarkerAlt size={9} color={C.violet} style={{ marginRight: 3 }} />{pincodeLabel || locLabel}</>}
                            {!pincodeLabel && !locLabel && pincode && <><FaMapMarkerAlt size={9} color={C.violet} style={{ marginRight: 3 }} />Pincode {pincode}</>}
                            {vendors.length > 0 && <span style={{ color: C.hint }}> · {vendors.length} store{vendors.length !== 1 ? "s" : ""}</span>}
                        </p>
                    )}
                </div>
            </div>

            {/* ════ CATEGORY PILLS ════ */}
            {categories.length > 0 && (
                <div className="ns-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, scrollbarWidth: "none" }}>
                    <button className="ns-pill" onClick={() => handleCategory(null)} style={{
                        padding: "7px 16px", borderRadius: 22, fontSize: 12, fontWeight: 800, fontFamily: "inherit",
                        background: !activeCategory ? C.pill : C.card,
                        color: !activeCategory ? C.pillText : C.sub,
                        border: `1.5px solid ${!activeCategory ? C.pill : C.border}`,
                        letterSpacing: ".02em",
                    }}>All</button>
                    {categories.map(cat => {
                        const active = activeCategory === cat;
                        return (
                            <button key={cat} className="ns-pill" onClick={() => handleCategory(cat)} style={{
                                padding: "7px 16px", borderRadius: 22, fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                                background: active ? C.pill : C.card,
                                color: active ? C.pillText : C.sub,
                                border: `1.5px solid ${active ? C.pill : C.border}`,
                            }}>{cat}</button>
                        );
                    })}
                </div>
            )}

            {/* ════ SKELETON ════ */}
            {loading && (
                <div className="ns-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, overflow: "hidden" }}>
                            <div className="ns-sk" style={{ height: 6, borderRadius: 0 }} />
                            <div style={{ padding: 14 }}>
                                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                                    <div className="ns-sk" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div className="ns-sk" style={{ width: "65%", height: 13, marginBottom: 7 }} />
                                        <div className="ns-sk" style={{ width: "40%", height: 10 }} />
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 5 }}>
                                    <div className="ns-sk" style={{ width: 55, height: 20, borderRadius: 5 }} />
                                    <div className="ns-sk" style={{ width: 65, height: 20, borderRadius: 5 }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ════ VENDOR GRID ════ */}
            {!loading && vendors.length > 0 && (
                <div className="ns-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    {vendors.map((v, idx) => (
                        <Link to={`/vendor/${v.shopSlug || v._id}`} key={v._id} className="ns-card ns-fade" style={{
                            background: C.card, borderRadius: 14, overflow: "hidden",
                            border: `1px solid ${C.borderLight}`, animationDelay: `${idx * 40}ms`,
                        }}>
                            {/* Top accent bar */}
                            <div style={{ height: 4, background: C.grad }} />

                            <div style={{ padding: "12px 14px 14px" }}>
                                {/* Shop info row */}
                                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                                        background: C.violetBg, display: "flex", alignItems: "center", justifyContent: "center",
                                        border: `1.5px solid ${C.border}`,
                                    }}>
                                        {v.shopLogo
                                            ? <img src={v.shopLogo} alt={v.shopName} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                                            : <FaStore size={16} color={C.violet} />
                                        }
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontWeight: 700, fontSize: 13, margin: 0, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.shopName}</p>
                                        <p style={{ fontSize: 11, color: C.muted, margin: "2px 0 0" }}>
                                            {v.shopCategory || "General Store"}
                                            {v.address?.city && <span> · {v.address.city}</span>}
                                        </p>
                                    </div>
                                    <FaChevronRight size={10} color={C.hint} style={{ flexShrink: 0 }} />
                                </div>

                                {/* Badges */}
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                                    {v.rating > 0 && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#15803d", background: C.greenBg, padding: "2px 8px", borderRadius: 5, border: "1px solid #bbf7d0" }}>
                                            <FaStar size={8} color={C.amber} /> {v.rating.toFixed(1)}{v.ratingCount > 0 && <span style={{ fontWeight: 500, color: C.hint }}> ({v.ratingCount})</span>}
                                        </span>
                                    )}
                                    {v.distanceKm != null && v.distanceKm > 0 && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: C.blue, background: C.blueBg, padding: "2px 8px", borderRadius: 5, border: "1px solid #bfdbfe" }}>
                                            <FaMotorcycle size={8} /> {v.distanceKm} km
                                        </span>
                                    )}
                                    {v.preparationTime > 0 && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: C.muted, background: C.borderLight, padding: "2px 8px", borderRadius: 5 }}>
                                            <FaClock size={7} /> {v.preparationTime} min
                                        </span>
                                    )}
                                    {!v.isOpen && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fef2f2", padding: "2px 8px", borderRadius: 5, border: "1px solid #fecaca" }}>
                                            Closed
                                        </span>
                                    )}
                                </div>

                                {/* Footer */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${C.borderLight}` }}>
                                    <span style={{ fontSize: 10, color: Number(v.freeDeliveryAbove) > 0 ? C.muted : "#15803d", fontWeight: Number(v.freeDeliveryAbove) > 0 ? 500 : 700 }}>
                                        {Number(v.freeDeliveryAbove) > 0 ? `Free above ₹${v.freeDeliveryAbove}` : "✓ Free Delivery"}
                                    </span>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: C.violet }}>
                                        <FaBolt size={7} /> Express
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* ════ EMPTY STATE (only when actively filtered) ════ */}
            {!loading && vendors.length === 0 && activeCategory && (
                <div style={{
                    textAlign: "center", padding: "36px 20px", background: C.card,
                    borderRadius: 14, border: `1px solid ${C.border}`,
                }}>
                    <div style={{ width: 52, height: 52, background: C.borderLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                        <FaStore size={20} color={C.hint} />
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 5, color: C.text }}>No stores found</h3>
                    <p style={{ fontSize: 12, color: C.muted, maxWidth: 300, margin: "0 auto 14px", lineHeight: 1.5 }}>
                        No "{activeCategory}" stores available. Try a different category.
                    </p>
                    <button onClick={() => handleCategory(null)} style={{
                        padding: "8px 18px", background: C.violet, color: "#fff",
                        border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>Show All</button>
                </div>
            )}
        </section>
    );
};

export default NearbyShops;
