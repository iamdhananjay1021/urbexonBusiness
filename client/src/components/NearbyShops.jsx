/**
 * NearbyShops.jsx — Production v4.0
 * ────────────────────────────────
 * ✅ Waits for a resolved pincode before fetching (no wasted no-pincode call)
 * ✅ Accepts `pincode` prop from UrbexonHour (already knows user's pincode)
 * ✅ Optional geolocation for distance display
 * ✅ Dynamic categories extracted from vendor response
 * ✅ Responsive: 1-col mobile, 2-col tablet, 3/4-col desktop
 * ✅ Only used in UrbexonHour (removed from Home)
 *
 * Props:
 *   pincode     = string      (6-digit, passed from UH page)
 *   maxResults  = number      (default 20)
 *
 * v4.0 — visual-only pass: swapped the old inline-style violet/purple look
 * for Tailwind + the amber UH accent (matches Navbar/ProductCard), and
 * moved from plain fade-in to a staggered rise-and-settle so the grid feels
 * less like a table dump and more like a considered list. Fetch/handler
 * logic is untouched from v3.1.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getNearbyVendors } from "../api/vendorApi";
import { imgUrl } from "../utils/imageUrl";
import {
    FaMapMarkerAlt, FaStar, FaStore, FaMotorcycle,
    FaClock, FaChevronRight, FaBolt,
} from "react-icons/fa";

const CSS = `
@keyframes ns-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes ns-rise { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
.ns-sk { background: linear-gradient(90deg,#f1efe9 25%,#e8e4d9 50%,#f1efe9 75%); background-size: 200% 100%; animation: ns-shimmer 1.4s infinite; border-radius: 8px; }
.ns-card { animation: ns-rise .45s cubic-bezier(.22,1,.36,1) both; }
.ns-card:hover .ns-card-img { transform: scale(1.05); }
.ns-scroll::-webkit-scrollbar { display: none; }
`;

const NearbyShops = ({ pincode, pincodeLabel = "", maxResults = 20, linkBase = "/vendor/" }) => {
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

    /* ── Fetch vendors ──
       Bails out until a pincode is actually known — avoids a wasted
       no-pincode "fallback" request immediately followed by a second
       request once the real pincode prop arrives. */
    const fetchNearby = useCallback(async () => {
        if (!pincode) return;

        const key = `${pincode},${userLoc?.latitude || ""},${activeCategory || ""}`;
        if (prevFetchRef.current === key) return;
        prevFetchRef.current = key;

        try {
            setLoading(true);
            const params = { limit: maxResults, pincode };
            if (userLoc?.latitude && userLoc?.longitude) {
                params.lat = userLoc.latitude;
                params.lng = userLoc.longitude;
                params.radius = 25;
            }
            if (activeCategory) params.category = activeCategory;

            const { data } = await getNearbyVendors(params);
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
        <section className="py-6 sm:py-8">
            <style>{CSS}</style>

            {/* ════ HEADER ════ */}
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-500/30 flex-shrink-0">
                            <FaBolt size={14} className="text-white" />
                        </div>
                        <h2 className="text-[clamp(16px,3.5vw,22px)] font-extrabold text-primary tracking-tight">
                            Stores Near You
                        </h2>
                    </div>
                    {(locLabel || pincode) && (
                        <p className="text-xs text-muted pl-[46px] flex items-center gap-1">
                            {(pincodeLabel || locLabel) ? (
                                <><FaMapMarkerAlt size={9} className="text-amber-500" /> {pincodeLabel || locLabel}</>
                            ) : pincode ? (
                                <><FaMapMarkerAlt size={9} className="text-amber-500" /> Pincode {pincode}</>
                            ) : null}
                            {vendors.length > 0 && <span className="text-[var(--color-graphite-300)]"> · {vendors.length} store{vendors.length !== 1 ? "s" : ""}</span>}
                        </p>
                    )}
                </div>
            </div>

            {/* ════ CATEGORY PILLS ════ */}
            {categories.length > 0 && (
                <div className="ns-scroll flex gap-2 overflow-x-auto pb-4">
                    <button
                        onClick={() => handleCategory(null)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
                            ${!activeCategory ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-secondary border-default hover:border-strong"}`}
                    >
                        All
                    </button>
                    {categories.map(cat => {
                        const active = activeCategory === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => handleCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all
                                    ${active ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-secondary border-default hover:border-strong"}`}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ════ SKELETON ════ */}
            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-default overflow-hidden">
                            <div className="ns-sk h-1.5 rounded-none" />
                            <div className="p-4">
                                <div className="flex gap-3 items-center mb-3">
                                    <div className="ns-sk w-11 h-11 rounded-xl flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="ns-sk w-2/3 h-3.5 mb-2" />
                                        <div className="ns-sk w-2/5 h-2.5" />
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    <div className="ns-sk w-14 h-5 rounded-md" />
                                    <div className="ns-sk w-16 h-5 rounded-md" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ════ VENDOR GRID ════ */}
            {!loading && vendors.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {vendors.map((v, idx) => (
                        <Link
                            to={`${linkBase}${v.shopSlug || v._id}`}
                            key={v._id}
                            className="ns-card group bg-white rounded-2xl overflow-hidden border border-default no-underline text-inherit transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-strong"
                            style={{ animationDelay: `${Math.min(idx, 10) * 45}ms` }}
                        >
                            {/* Top accent bar */}
                            <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

                            <div className="p-3.5">
                                {/* Shop info row */}
                                <div className="flex gap-2.5 items-center mb-2.5">
                                    <div className="ns-card-img w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-hour-tint border border-[var(--color-amber-100)] flex items-center justify-center transition-transform duration-300">
                                        {v.shopLogo
                                            ? <img src={imgUrl.thumbnail(v.shopLogo)} alt={v.shopName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                            : <FaStore size={16} className="text-[var(--accent-hour-hover)]" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[13px] text-primary truncate leading-tight">{v.shopName}</p>
                                        <p className="text-[11px] text-muted mt-0.5 truncate">
                                            {v.shopCategory || "General Store"}
                                            {v.address?.city && <span> · {v.address.city}</span>}
                                        </p>
                                    </div>
                                    <FaChevronRight size={10} className="text-[var(--color-graphite-300)] flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                </div>

                                {/* Badges */}
                                <div className="flex gap-1.5 flex-wrap mb-2.5">
                                    {v.rating > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success bg-success-tint px-2 py-0.5 rounded-md">
                                            <FaStar size={8} className="text-amber-500" /> {v.rating.toFixed(1)}
                                            {v.ratingCount > 0 && <span className="font-medium text-muted"> ({v.ratingCount})</span>}
                                        </span>
                                    )}
                                    {v.distanceKm != null && v.distanceKm > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-info bg-info-tint px-2 py-0.5 rounded-md">
                                            <FaMotorcycle size={8} /> {v.distanceKm} km
                                        </span>
                                    )}
                                    {v.preparationTime > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-secondary bg-[var(--color-graphite-50)] px-2 py-0.5 rounded-md">
                                            <FaClock size={7} /> {v.preparationTime} min
                                        </span>
                                    )}
                                    {!v.isOpen && (
                                        <span className="inline-flex items-center text-[10px] font-bold text-error bg-error-tint px-2 py-0.5 rounded-md">
                                            Closed
                                        </span>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-2 border-t border-default">
                                    <span className={`text-[10px] font-semibold ${Number(v.freeDeliveryAbove) > 0 ? "text-muted" : "text-success font-bold"}`}>
                                        {Number(v.freeDeliveryAbove) > 0 ? `Free above ₹${v.freeDeliveryAbove}` : "✓ Free Delivery"}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--accent-hour-hover)]">
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
                <div className="text-center py-9 px-5 bg-white rounded-2xl border border-default">
                    <div className="w-13 h-13 bg-[var(--color-graphite-50)] rounded-full flex items-center justify-center mx-auto mb-3.5">
                        <FaStore size={20} className="text-[var(--color-graphite-300)]" />
                    </div>
                    <h3 className="font-extrabold text-base text-primary mb-1">No stores found</h3>
                    <p className="text-xs text-muted max-w-[300px] mx-auto mb-3.5 leading-relaxed">
                        No "{activeCategory}" stores available. Try a different category.
                    </p>
                    <button
                        onClick={() => handleCategory(null)}
                        className="px-4.5 py-2 bg-hour text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-hour-hover transition-colors"
                    >
                        Show All
                    </button>
                </div>
            )}
        </section>
    );
};

export default NearbyShops;
