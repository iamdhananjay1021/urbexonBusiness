/**
 * UHTopSellers — "Top Rated Sellers" horizontal showcase for the Urbexon
 * Hour landing page.
 *
 * Real, area-scoped data only — GET /vendor/nearby?pincode=X&limit=10
 * (servicePincodes-matched, sorted server-side by rating/totalOrders).
 * No pincode → no fetch, nothing shown. There used to be a "no pincode"
 * fallback to /vendor/featured (global top-rated, any location) and the
 * backend's own /vendor/nearby had a further fallback to ALL vendors when
 * no local match was found — both removed: showing a vendor that doesn't
 * actually deliver to the visible pincode (e.g. an Akbarpur vendor to a
 * Lucknow visitor) is worse than showing nothing.
 *
 * Small session cache (same pattern as the rest of this session's fixes)
 * so switching pincode and back doesn't needlessly refetch.
 */
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import { FaStar, FaStore, FaChevronRight, FaChevronLeft } from "react-icons/fa";
import { getNearbyVendors } from "../../api/vendorApi";
import { imgUrl } from "../../utils/imageUrl";

const CACHE_TTL = 2 * 60 * 1000;
const sellersCache = new Map(); // pincode -> { vendors, ts }

const UHTopSellers = memo(({ pincode }) => {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(!!pincode);
    const scrollRef = useRef(null);
    const prevKeyRef = useRef("");

    const fetchSellers = useCallback(async () => {
        if (!pincode) { setVendors([]); setLoading(false); return; }
        if (prevKeyRef.current === pincode) return;
        prevKeyRef.current = pincode;

        const cached = sellersCache.get(pincode);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
            setVendors(cached.vendors);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data } = await getNearbyVendors({ pincode, limit: 10 });
            const list = data.vendors || data.data || (Array.isArray(data) ? data : []);
            setVendors(list);
            sellersCache.set(pincode, { vendors: list, ts: Date.now() });
        } catch {
            setVendors([]);
        } finally {
            setLoading(false);
        }
    }, [pincode]);

    useEffect(() => { fetchSellers(); }, [fetchSellers]);

    const scroll = (dir) => scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

    if (!loading && vendors.length === 0) return null;

    return (
        <div className="bg-white border-y border-default py-6">
            <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-hour-tint flex items-center justify-center text-[var(--accent-hour-hover)] flex-shrink-0">
                            <FaStore size={16} />
                        </div>
                        <div>
                            <div className="text-lg font-extrabold text-primary tracking-tight">Top Rated Sellers</div>
                            <div className="text-xs text-secondary font-medium">Highly rated vendors near you</div>
                        </div>
                    </div>
                    <div className="hidden sm:flex gap-1.5">
                        <button onClick={() => scroll(-1)} aria-label="Scroll left" className="w-8 h-8 rounded-full border border-default flex items-center justify-center text-secondary hover:bg-canvas transition-colors">
                            <FaChevronLeft size={11} />
                        </button>
                        <button onClick={() => scroll(1)} aria-label="Scroll right" className="w-8 h-8 rounded-full border border-default flex items-center justify-center text-secondary hover:bg-canvas transition-colors">
                            <FaChevronRight size={11} />
                        </button>
                    </div>
                </div>

                <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    {loading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="min-w-[170px] flex-shrink-0 bg-white border border-default rounded-2xl p-4 flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-full bg-[var(--color-graphite-100)] animate-pulse" />
                                <div className="w-24 h-3 bg-[var(--color-graphite-100)] rounded animate-pulse" />
                                <div className="w-16 h-2.5 bg-[var(--color-graphite-100)] rounded animate-pulse" />
                            </div>
                        ))
                        : vendors.map((v) => (
                            <button
                                key={v._id || v.shopSlug}
                                onClick={() => navigate(`/vendor/${v.shopSlug}`)}
                                className="min-w-[170px] flex-shrink-0 bg-white border border-default rounded-2xl p-4 flex flex-col items-center gap-2 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md hover:border-strong"
                            >
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-hour-tint border border-[var(--color-amber-100)] flex items-center justify-center flex-shrink-0">
                                    {v.shopLogo
                                        ? <img src={imgUrl.thumbnail(v.shopLogo)} alt={v.shopName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                        : <FaStore size={20} className="text-[var(--accent-hour-hover)]" />}
                                </div>
                                <div className="text-[13px] font-bold text-primary leading-tight line-clamp-1 w-full">{v.shopName}</div>
                                {v.shopCategory && <div className="text-[10.5px] text-muted -mt-1">{v.shopCategory}</div>}
                                <div className="flex items-center gap-1 text-[11px] font-bold text-secondary">
                                    <FaStar size={9} className="text-amber-500" /> {Number(v.rating || 0).toFixed(1)}
                                    {v.ratingCount > 0 && <span className="text-muted font-medium">({v.ratingCount})</span>}
                                </div>
                                {v.totalOrders > 0 && (
                                    <div className="text-[10px] text-muted font-medium">{v.totalOrders}+ orders</div>
                                )}
                                <span className="mt-1 w-full text-[11px] font-bold text-white bg-hour hover:bg-hour-hover rounded-lg py-1.5 transition-colors">
                                    Visit Store
                                </span>
                            </button>
                        ))
                    }
                </div>
            </div>
        </div>
    );
});

UHTopSellers.displayName = "UHTopSellers";
export default UHTopSellers;
