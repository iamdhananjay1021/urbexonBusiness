/**
 * VendorStoreDropdown — Navbar control that surfaces real, registered
 * vendors near the user's pincode so they can jump straight to a vendor's
 * store and buy directly from them.
 *
 * Real, area-scoped data only — GET /vendor/nearby?pincode=X&limit=8 (same
 * endpoint NearbyShops.jsx/UHTopSellers.jsx use). No pincode → no fetch;
 * the panel shows a "set your location" prompt instead. There used to be
 * a fallback to /vendor/featured (global top-rated, any location) — removed,
 * since surfacing a vendor that doesn't actually deliver to the user is
 * worse than surfacing nothing.
 *
 * Fetches lazily on first open (not on Navbar mount) so this doesn't add
 * another always-on request, and caches per pincode for a couple of
 * minutes so reopening it doesn't refetch.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaStore, FaChevronRight, FaStar, FaMapMarkerAlt } from "react-icons/fa";
import { getNearbyVendors } from "../api/vendorApi";
import { imgUrl } from "../utils/imageUrl";

const CACHE_TTL = 2 * 60 * 1000;
const vendorDropdownCache = new Map(); // pincode -> { vendors, ts }

const VendorStoreDropdown = ({ pincode, pincodeLabel, variant = "desktop" }) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(false);
    const rootRef = useRef(null);
    const isMobile = variant === "mobile";

    const fetchVendors = useCallback(async () => {
        if (!pincode) { setVendors([]); return; }
        const cached = vendorDropdownCache.get(pincode);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
            setVendors(cached.vendors);
            return;
        }
        setLoading(true);
        try {
            const { data } = await getNearbyVendors({ pincode, limit: 8 });
            const list = data.vendors || data.data || (Array.isArray(data) ? data : []);
            setVendors(list);
            vendorDropdownCache.set(pincode, { vendors: list, ts: Date.now() });
        } catch {
            setVendors([]);
        } finally {
            setLoading(false);
        }
    }, [pincode]);

    const handleOpen = () => {
        if (!open) fetchVendors();
        setOpen((s) => !s);
    };

    useEffect(() => {
        if (!open) return undefined;
        const onOutside = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
        const onEscape = (e) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", onOutside);
        document.addEventListener("keydown", onEscape);
        return () => {
            document.removeEventListener("mousedown", onOutside);
            document.removeEventListener("keydown", onEscape);
        };
    }, [open]);

    const goToStore = (slug) => {
        setOpen(false);
        navigate(`/vendor/${slug}`);
    };

    const panelClassName = isMobile
        ? "fixed left-2 right-2 top-[3.9rem] max-h-[min(28rem,calc(100vh-5rem))] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[950] overflow-hidden flex flex-col animate-[fadeDown_0.15s_ease]"
        : "absolute right-0 top-[calc(100%+8px)] w-[300px] max-h-[24rem] bg-white rounded-2xl border border-gray-100 shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-[800] overflow-hidden flex flex-col animate-[dropDown_0.18s_ease]";

    return (
        <div className="relative flex-shrink-0" ref={rootRef}>
            <button
                type="button"
                onClick={handleOpen}
                aria-expanded={open}
                aria-label="Nearby vendor stores"
                className={isMobile
                    ? "w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                    : "flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-all whitespace-nowrap"}
            >
                <FaStore size={isMobile ? 17 : 15} className="text-[var(--accent-hour,#f2a93b)]" />
                {!isMobile && <span className="hidden xl:inline">Vendors</span>}
            </button>

            {open && (
                <div className={panelClassName}>
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
                        <div className="text-[13px] font-bold text-gray-900">
                            {pincode ? "Vendors Near You" : "Vendor Stores"}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                            {pincode
                                ? <><FaMapMarkerAlt size={9} /> {pincodeLabel || `Pincode ${pincode}`}</>
                                : "Set your delivery location to see vendors near you"}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-2.5 w-2/3 bg-gray-100 rounded animate-pulse" />
                                            <div className="h-2 w-1/3 bg-gray-100 rounded animate-pulse" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : vendors.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <FaStore size={22} className="text-gray-300 mx-auto mb-2" />
                                <p className="text-xs font-semibold text-gray-500">
                                    {pincode ? "No vendors deliver to your area yet" : "Set your delivery location first"}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {pincode ? "We're expanding — check back soon!" : "So we can show vendors that actually deliver to you"}
                                </p>
                            </div>
                        ) : (
                            vendors.map((v) => (
                                <button
                                    key={v._id || v.shopSlug}
                                    onClick={() => goToStore(v.shopSlug)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-transparent border-none cursor-pointer text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                                >
                                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                                        {v.shopLogo
                                            ? <img src={imgUrl.thumbnail(v.shopLogo)} alt={v.shopName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                            : <FaStore size={14} className="text-amber-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12.5px] font-semibold text-gray-800 truncate">{v.shopName}</div>
                                        <div className="flex items-center gap-1.5 text-[10.5px] text-gray-400 mt-0.5">
                                            {v.rating > 0 && (
                                                <span className="flex items-center gap-0.5 text-gray-500 font-medium">
                                                    <FaStar size={8} className="text-amber-500" /> {Number(v.rating).toFixed(1)}
                                                </span>
                                            )}
                                            {v.shopCategory && <span className="truncate">{v.shopCategory}</span>}
                                        </div>
                                    </div>
                                    <FaChevronRight size={10} className="text-gray-300 flex-shrink-0" />
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorStoreDropdown;
