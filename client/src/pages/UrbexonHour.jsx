/**
 * UrbexonHour.jsx — Production v5.2
 *
 * v5.1 → v5.2 CHANGES (visual polish only — zero logic/data changes)
 * ──────────────────────────────────────────────────────────────────────
 * - LocationBar: was a flat strip with only a translucent bottom border,
 *   so it visually fused with TrustStrip right below it. Now sits on its
 *   own elevated layer (shadow instead of border) so it reads as a
 *   distinct sticky-feeling band, matching the Navbar's own elevation.
 * - TrustStrip: cards had no resting shadow (only on hover) and tight
 *   vertical padding, so the whole row read as flat grey boxes crammed
 *   under the orange bar. Cards now carry a base shadow-sm, slightly
 *   larger icon chips, more internal padding, and the section itself
 *   got a bottom border to close it off cleanly before the hero starts.
 *
 * (v5.1 notes retained below)
 * ──────────────────────────────────────────────────────────────────────
 * Network dedup fixes:
 *   - Categories: the old 3-attempt retry loop against /categories
 *     (type=urbexon-hour, then productType=urbexon_hour, then
 *     productType=urbexon-hour) is gone. It duplicated work the Navbar
 *     was already doing. Both now read from the same shared, cached
 *     useCategories("urbexon_hour") hook — one network call, shared
 *     across every component that needs UH categories.
 *   - Banners: hero/mid banners never depend on pincode, but they were
 *     living in an effect keyed on `savedPincode?.code`, so they refired
 *     every time the pincode changed even though the response never
 *     changes. Moved to their own effect with an empty dependency array.
 *   - Homepage data: was being fetched from THREE places — an effect on
 *     mount, the same effect again on pincode change, and a third time
 *     inside checkPincodeInner's Promise.allSettled. Now it's fetched
 *     only where it actually needs to be: once with no pincode (so the
 *     page has something to show before a pincode is known), and once
 *     per confirmed pincode inside checkPincodeInner.
 *
 * (v5.0 notes retained below)
 * ──────────────────────────────────────────────────────────────────────
 * Brand consistency fix:
 *   Page previously used a violet/purple palette while claiming to
 *   "match UH Navbar" — but Navbar.jsx's actual UH accent is amber
 *   (#f59e0b), used for the "Hour" wordmark, the bolt icon, and the
 *   EXPRESS pill. Unified the whole page onto that amber system so the
 *   navbar → page handoff feels like one product, not two.
 *
 * Rendering / performance fixes:
 *   - Footer, skeleton grid, and the "Why shop here" grid were rebuilt
 *     inline on every render (including every keystroke in the pincode
 *     box). They're now standalone memoized components — Footer never
 *     re-renders after first paint.
 *   - Pincode input state used to live on the page component, so typing
 *     a single digit re-rendered the entire page (hero, trust strip,
 *     product grid, footer — everything). It now lives locally inside
 *     <PincodeHero>, which only reports the final value up via onCheck.
 *   - `renderCard={(p) => <ProductCard product={p} />}` was a fresh
 *     function on every render for every category section, defeating
 *     any memoization downstream. Replaced with stable module-level
 *     functions.
 *   - Removed dead state (`categories`, unused `showVendorGroups`) that
 *     triggered renders without ever being read.
 *   - `vendorGroups` is now computed with useMemo instead of being
 *     recomputed unconditionally on every render.
 */
import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import * as productApi from "../api/productApi";
import { fetchBanners } from "../api/bannerApi";
import * as pincodeApi from "../api/pincodeApi";
import { fetchCategorySubcategories } from "../api/categoryApi";
import { useAuth } from "../contexts/AuthContext";
import { useUHLocation } from "../contexts/UHLocationContext";
import { useCart } from "../hooks/useCart";
import { useCategories } from "../hooks/useCategories";
import {
    FaBolt, FaMapMarkerAlt, FaStore, FaShoppingCart,
    FaClock, FaStar, FaChevronRight, FaSearch, FaBell,
    FaTimes, FaFire, FaShieldAlt, FaLock, FaCheckCircle,
} from "react-icons/fa";
import NearbyShops from "../components/NearbyShops";
import UHProductSection from "../components/uh/UHProductSection";
import UHMidBanner from "../components/uh/UHMidBanner";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import UHBannerCarousel from "../components/uh/UHBannerCarousel";
import SEO from "../components/SEO";
import ProductCard from "../components/ProductCard";
import UHHero from "../components/uh/UHHero";
import UHTopSellers from "../components/uh/UHTopSellers";
import { imgUrl } from "../utils/imageUrl";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ── Session-lifetime caches — same pattern as Home.jsx's _homeCache.
     Without these, navigating away (e.g. to a product) and back to
     /urbexon-hour re-showed the skeleton and re-fetched banners + the
     whole pincode-scoped product/deal/homepage bundle from scratch every
     single time, which is what read as "products keep reloading." ── */
const BANNERS_CACHE_TTL = 5 * 60 * 1000; // banners rarely change
let _uhBannersCache = null; // { hero, mid, ts }

const BUNDLE_CACHE_TTL = 60 * 1000; // matches Productspage/Categorypage/Dealspage
const _uhBundleCache = new Map(); // pincode -> { pinData, products, deals, homepageData, savedPincodeData, ts }
const _uhSubcategoriesCache = new Map(); // slug -> { subcategories, ts }

/* Stable render-prop function — module scope, same reference every render */
const renderHiddenActionsCard = (p) => <ProductCard product={p} hideActions />;

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
    return (
        <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-hour-tint border-t border-[var(--color-amber-100)] text-[11px] font-bold text-[var(--accent-hour-hover)]">
            <FaClock size={9} /> {timeLeft}
        </div>
    );
});
LiveCountdown.displayName = "LiveCountdown";

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

/* ── Hero — owns local pincode-typing state so keystrokes don't
     re-render the parent page ── */
const PincodeHero = memo(({ loading, locationLoading, error, savedPincode, showBackLink, onCheck, onDetectLocation, onBackToSaved }) => {
    const [value, setValue] = useState("");

    const submit = () => {
        if (/^\d{6}$/.test(value.trim())) onCheck(value.trim());
    };

    return (
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--accent-hour)] via-[var(--accent-hour-hover)] to-[var(--color-error-500)]">
            <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.18'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
            />
            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 relative z-10">
                <div className="flex items-center gap-12 py-16 lg:py-20 justify-between">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-1.5 bg-white/20 border border-white/40 text-white text-[11px] font-bold tracking-wider uppercase px-3.5 py-1.5 rounded-full mb-4 backdrop-blur-sm">
                            <FaBolt size={10} /> 45–120 Min Delivery
                        </div>
                        <h1 className="text-[clamp(28px,5vw,48px)] font-extrabold leading-tight text-white mb-3 tracking-tight">
                            Express delivery<br />in <em className="not-italic bg-white text-transparent bg-clip-text">record time</em>
                        </h1>
                        <p className="text-base text-white/90 mb-7 max-w-[480px] leading-relaxed">
                            Products from local vendors, delivered fast right to your door.
                        </p>

                        <div className="max-w-[600px]">
                            <div className="flex gap-3 mb-3 flex-wrap">
                                <div className="flex-1 min-w-[200px] relative flex items-center">
                                    <FaSearch size={13} className="absolute left-3.5 text-muted pointer-events-none" />
                                    <input
                                        className="w-full pl-10 pr-4 py-3 bg-white rounded-xl text-[15px] font-semibold tracking-wider text-primary outline-none shadow-lg focus:shadow-xl focus:ring-2 focus:ring-white/60 transition-shadow placeholder:text-muted placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
                                        type="tel" inputMode="numeric" maxLength={6}
                                        placeholder="Enter 6-digit pincode"
                                        value={value}
                                        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        onKeyDown={(e) => { if (e.key === "Enter" && value.length === 6) submit(); }}
                                    />
                                </div>
                                <button
                                    className="px-7 py-3 bg-white text-[var(--accent-hour-hover)] font-extrabold text-[13px] rounded-xl border-none cursor-pointer shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                                    onClick={submit} disabled={loading || value.length !== 6}
                                >
                                    {loading ? <span className="w-3.5 h-3.5 border-2 border-[var(--color-amber-100)] border-t-amber-600 rounded-full animate-spin inline-block" /> : "Check"}
                                </button>
                            </div>
                            <button
                                className="bg-transparent border-none text-white/80 text-xs cursor-pointer flex items-center gap-1.5 px-3.5 py-2 font-semibold hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
                                onClick={onDetectLocation} disabled={locationLoading}
                            >
                                <FaMapMarkerAlt size={11} />
                                {locationLoading ? "Detecting location…" : "Use my current location"}
                            </button>
                            {showBackLink && savedPincode && (
                                <button
                                    className="block bg-transparent border-none text-white/80 text-xs cursor-pointer flex items-center gap-1.5 px-3.5 py-2 font-semibold hover:text-white hover:bg-white/10 rounded-lg transition-all mt-1"
                                    onClick={onBackToSaved}
                                >
                                    ← Back to {savedPincode.area || savedPincode.city || savedPincode.code}
                                </button>
                            )}
                            {error && <div className="text-white text-xs mt-2 font-medium bg-black/15 rounded-lg px-3 py-2 inline-block">{error}</div>}
                        </div>
                    </div>

                    <div className="hidden md:flex relative w-[clamp(120px,20vw,260px)] flex-shrink-0 h-[clamp(150px,20vw,260px)] items-center justify-center">
                        <div className="absolute w-52 h-52 rounded-full bg-white/10 -right-10 -top-8" />
                        <div className="absolute w-32 h-32 rounded-full bg-white/10 right-8 bottom-5" />
                        <span className="text-[clamp(80px,12vw,140px)] relative z-10 filter drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)] animate-bounce" style={{ animationDuration: "3s" }}>🛵</span>
                    </div>
                </div>
            </div>
        </div>
    );
});
PincodeHero.displayName = "PincodeHero";

/* ── Trust strip — 4 standalone feature cards. Now carries a resting
     shadow (not just on hover) and a touch more padding so the row
     reads as distinct elevated cards instead of flat grey blocks sitting
     directly under the LocationBar. Section closes with a bottom border
     so the boundary before the hero is intentional, not accidental. ── */
// const TrustStrip = memo(({ deliveryMin, deliveryMax, vendorCount }) => {
//     const items = [
//         { Icon: FaBolt, t: "45 Min Delivery", sub: `Lightning fast · ${deliveryMin}–${deliveryMax} min`, accent: "bg-hour-tint text-[var(--accent-hour-hover)]" },
//         { Icon: FaCheckCircle, t: "Fresh & Quality", sub: "100% verified products", accent: "bg-success-tint text-success" },
//         { Icon: FaStore, t: "Local Stores", sub: `${vendorCount || "0"} vendors near you`, accent: "bg-accent-tint text-accent" },
//         { Icon: FaLock, t: "Secure Payments", sub: "256-bit encrypted checkout", accent: "bg-info-tint text-info" },
//     ];
//     return (
//         <div className="bg-canvas py-5 sm:py-6 border-b border-default">
//             <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
//                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
//                     {items.map((f) => (
//                         <div
//                             key={f.t}
//                             className="flex items-center gap-3 bg-white border border-default rounded-2xl px-4 py-3.5 sm:py-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-strong"
//                         >
//                             <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${f.accent}`}>
//                                 <f.Icon size={18} />
//                             </div>
//                             <div className="min-w-0">
//                                 <div className="text-[13px] sm:text-[13.5px] font-extrabold text-primary tracking-tight truncate">{f.t}</div>
//                                 <div className="text-[11px] text-secondary mt-0.5 font-medium truncate">{f.sub}</div>
//                             </div>
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </div>
//     );
// });
// TrustStrip.displayName = "TrustStrip";

/* ── Skeleton — fully static, never needs to re-render after mount ── */
// const SkeletonGrid = memo(() => (
//     <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-5">
//         <div className="flex gap-4 mb-5">
//             {[1, 2, 3, 4].map(i => (
//                 <div key={i} className="flex flex-col items-center gap-2">
//                     <div className="w-14 h-14 rounded-2xl bg-[var(--color-graphite-200)] animate-pulse" />
//                     <div className="w-12 h-2.5 rounded bg-[var(--color-graphite-200)] animate-pulse" />
//                 </div>
//             ))}
//         </div>
//         <div className="h-5 w-36 rounded bg-[var(--color-graphite-200)] animate-pulse mb-4" />
//         <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
//             {[1, 2, 3, 4, 5, 6].map(i => (
//                 <div key={i} className="rounded-2xl border border-default overflow-hidden bg-white">
//                     <div className="aspect-square bg-[var(--color-graphite-200)] animate-pulse" />
//                     <div className="p-3 space-y-2">
//                         <div className="h-2.5 w-4/5 bg-[var(--color-graphite-200)] rounded animate-pulse" />
//                         <div className="h-2.5 w-1/2 bg-[var(--color-graphite-200)] rounded animate-pulse" />
//                         <div className="h-2.5 w-2/5 bg-[var(--color-graphite-200)] rounded animate-pulse" />
//                     </div>
//                 </div>
//             ))}
//         </div>
//     </div>
// ));
// SkeletonGrid.displayName = "SkeletonGrid";

/* ── Flash deal spotlight — single hero-style promo banner for the
     soonest-expiring real deal already fetched (uhDeals[0]). Presentation
     only, no new data source; the rest of uhDeals still renders in the
     FlashDeals scroll row below this. ── */
const FlashDealSpotlight = memo(({ deal }) => {
    const navigate = useNavigate();
    if (!deal) return null;

    const price = Number(deal.price || 0);
    const mrp = Number(deal.mrp || deal.originalPrice || deal.compareAtPrice || 0);
    const hasDisc = mrp > price && mrp > 0;
    const discPct = hasDisc ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const image = imgUrl.detail(deal.images?.[0]?.url || deal.image || "");
    const productUrl = `/uh-product/${deal.slug || deal._id}`;

    return (
        <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-5">
            <div
                onClick={() => navigate(productUrl)}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--color-error-500)] to-[var(--accent-hour-hover)] cursor-pointer group"
            >
                <div className="flex items-center gap-5 sm:gap-8 px-5 sm:px-8 py-5 sm:py-7">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-white flex-shrink-0 overflow-hidden shadow-lg">
                        {image
                            ? <img src={image} alt={deal.name} loading="eager" decoding="async" className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105" />
                            : <div className="w-full h-full flex items-center justify-center text-3xl">⚡</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full mb-2">
                            <FaFire size={9} /> Flash Deal
                        </div>
                        <div className="text-[15px] sm:text-lg font-extrabold text-white leading-snug line-clamp-1 mb-1.5">{deal.name}</div>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-lg sm:text-xl font-black text-white">{fmt(price)}</span>
                            {hasDisc && (
                                <>
                                    <span className="text-xs text-white/70 line-through">{fmt(mrp)}</span>
                                    <span className="text-[10px] font-bold text-[var(--accent-hour-hover)] bg-white px-1.5 py-0.5 rounded-md">{discPct}% OFF</span>
                                </>
                            )}
                        </div>
                        <LiveCountdown endsAt={deal.dealEndsAt} />
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); navigate(productUrl); }}
                        className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[var(--accent-hour-hover)] text-[13px] font-bold flex-shrink-0 hover:-translate-y-0.5 transition-all shadow-md"
                    >
                        Shop Now
                    </button>
                </div>
            </div>
        </div>
    );
});
FlashDealSpotlight.displayName = "FlashDealSpotlight";

/* ── Flash deals ── */
const FlashDeals = memo(({ deals }) => {
    if (!deals.length) return null;
    return (
        <div className="bg-white border-y border-default mt-4 py-6">
            <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                <div className="flex items-center gap-3.5 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-error-500)] to-[var(--accent-hour-hover)] flex items-center justify-center text-white text-xl shadow-lg shadow-md">
                        <FaFire size={16} />
                    </div>
                    <div>
                        <div className="text-xl font-extrabold text-primary tracking-tight">Flash Deals</div>
                        <div className="text-xs text-secondary mt-0.5 font-medium">
                            {deals.length} hot offer{deals.length !== 1 ? "s" : ""} — grab before they expire!
                        </div>
                    </div>
                </div>
                <div className="flex gap-3.5 overflow-x-auto pb-2.5 scrollbar-hide snap-x items-stretch">
                    {deals.map((p) => (
                        <div key={p._id || p.id} className="min-w-[180px] max-w-[200px] flex-shrink-0 snap-start flex flex-col self-stretch">
                            <ProductCard product={p} hideActions footer={<LiveCountdown endsAt={p.dealEndsAt} />} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});
FlashDeals.displayName = "FlashDeals";

/* ── Why shop here — static copy, only delivery window varies ── */
const WhySection = memo(({ deliveryMin, deliveryMax }) => {
    const items = [
        { Icon: FaStore, title: "Support Local", desc: "Every order helps local vendors & small businesses grow" },
        { Icon: FaClock, title: "Superfast Delivery", desc: `Get your order in ${deliveryMin}-${deliveryMax} minutes flat` },
        { Icon: FaShieldAlt, title: "Quality Promise", desc: "Every product is quality checked before dispatch" },
        { Icon: FaCheckCircle, title: "Best Prices", desc: "We match prices so you always get the best deal" },
    ];
    return (
        <div className="bg-gradient-to-br from-[var(--color-amber-100)] to-[var(--color-amber-100)] border-t border-[var(--color-amber-100)] py-6 mt-2">
            <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                <h3 className="text-[clamp(18px,3.5vw,22px)] font-extrabold text-primary text-center mb-5 tracking-tight">Why shop on Urbexon Hour?</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {items.map(item => (
                        <div
                            key={item.title}
                            className="bg-white border border-[var(--color-amber-100)] rounded-2xl px-4 py-4 text-center hover:-translate-y-1 hover:shadow-lg hover:border-[var(--color-amber-100)] transition-all relative overflow-hidden group"
                        >
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--accent-hour)] to-[var(--accent-hour-hover)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-hour-tint flex items-center justify-center text-[var(--accent-hour-hover)]">
                                <item.Icon size={18} />
                            </div>
                            <h4 className="text-sm font-extrabold text-primary mb-1.5 tracking-tight">{item.title}</h4>
                            <p className="text-xs text-secondary leading-relaxed font-medium">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});
WhySection.displayName = "WhySection";

/* ── Subcategory chips — shown when viewing a specific category
     (/urbexon-hour/:slug). This is the only UI that can set the
     `subcategory` query param the filtering logic already reads; it
     was dropped when the old CategoryBrowser instance was removed from
     this page (to kill a duplicate-category-rendering bug), which is
     why subcategory selection stopped working entirely. ── */
const SubcategoryChips = memo(({ subcategories, loading, activeSubcategory, onSelect }) => {
    if (!loading && subcategories.length === 0) return null;
    return (
        <div className="bg-white border-b border-default">
            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {loading ? (
                    [1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 w-24 rounded-full bg-[var(--color-graphite-100)] animate-pulse flex-shrink-0" />
                    ))
                ) : (
                    <>
                        <button
                            onClick={() => onSelect(null)}
                            className={`px-3.5 py-1.5 rounded-full border text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all
                                ${!activeSubcategory ? "bg-hour text-white border-hour" : "bg-white text-secondary border-default hover:border-strong"}`}
                        >
                            All
                        </button>
                        {subcategories.map((sub) => (
                            <button
                                key={sub.name}
                                onClick={() => onSelect(sub.name)}
                                className={`px-3.5 py-1.5 rounded-full border text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all
                                    ${activeSubcategory?.toLowerCase() === sub.name.toLowerCase() ? "bg-hour text-white border-hour" : "bg-white text-secondary border-default hover:border-strong"}`}
                            >
                                {sub.name}{sub.count > 0 && <span className="opacity-70"> ({sub.count})</span>}
                            </button>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
});
SubcategoryChips.displayName = "SubcategoryChips";

/* ── Vendor groups (category / search results view) ── */
const VendorProductGroups = memo(({ vendorGroups, filteredCount, loading, activeCategory, searchQuery, deliveryMin, deliveryMax, onShowAll }) => (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-4">
        {filteredCount === 0 && !loading && (
            <div className="py-20 text-center flex flex-col items-center gap-3.5">
                <FaStore size={40} className="text-[var(--color-graphite-200)]" />
                <div className="text-lg font-extrabold text-primary">
                    {activeCategory ? `No products in "${activeCategory}"` : searchQuery ? `No results for "${searchQuery}"` : "No products available yet"}
                </div>
                <div className="text-sm text-secondary">We are expanding fast. Check back soon!</div>
                <button
                    className="mt-4 px-6 py-2.5 bg-hour text-white font-bold text-sm rounded-xl border-none cursor-pointer hover:bg-hour-hover transition-colors"
                    onClick={onShowAll}
                >
                    Show all products
                </button>
            </div>
        )}

        {vendorGroups.map((group) => (
            <div key={group.vendorId} className="bg-white rounded-2xl border border-default mb-4 overflow-hidden transition-all hover:border-strong hover:shadow-md">
                <div className="flex items-center gap-3.5 px-5 py-4 bg-gradient-to-r from-[var(--color-graphite-50)] to-white border-b border-[var(--color-graphite-100)]">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-amber-100)] to-[var(--color-amber-100)] text-[var(--accent-hour-hover)] flex items-center justify-center flex-shrink-0 text-xl">
                        <FaStore size={18} />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-extrabold text-primary tracking-tight">{group.vendorName}</div>
                        <div className="flex items-center gap-2 text-xs text-secondary mt-1 font-medium flex-wrap">
                            <span className="flex items-center gap-1"><FaStar size={10} className="text-[var(--accent-hour)]" /> {(group.products[0]?.vendorId?.rating || 4.0).toFixed(1)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><FaClock size={10} /> {deliveryMin}–{deliveryMax} min</span>
                            <span>•</span>
                            <span>{group.products.length} items</span>
                        </div>
                    </div>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                    {group.products.map((p) => <ProductCard key={p._id || p.id} product={p} hideActions />)}
                </div>
            </div>
        ))}
    </div>
));
VendorProductGroups.displayName = "VendorProductGroups";

/* ── Floating cart ── */
const FloatingCart = memo(({ totalQty, total, savings, deliveryMin, deliveryMax, animating, onClick }) => (
    <button
        className={`fixed left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--accent-hour)] to-[var(--accent-hour-hover)] text-white border-none cursor-pointer flex items-center gap-3 px-5 py-3 rounded-full font-bold shadow-[0_8px_32px_rgba(245,158,11,0.35)] z-[610] whitespace-nowrap max-w-[calc(100vw-32px)] transition-all hover:-translate-x-1/2 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(245,158,11,0.45)] active:-translate-y-0.5 ${animating ? "scale-105" : ""}`}
        onClick={onClick}
        title={`${totalQty} item${totalQty !== 1 ? "s" : ""} • ${fmt(total)}`}
        style={{
            // Clears the mobile bottom nav (shares --bottom-nav-h, published
            // by Navbar.jsx — 0px on desktop where that bar doesn't render,
            // so this collapses back to the original 24px float there) plus
            // the device's safe-area inset for notched phones.
            bottom: "calc(var(--bottom-nav-h, 0px) + 24px + env(safe-area-inset-bottom, 0px))",
            transform: animating ? "translateX(-50%) scale(1.05)" : undefined,
        }}
    >
        <div className="relative flex items-center justify-center flex-shrink-0">
            <FaShoppingCart size={16} />
            <span className="absolute -top-2 -right-2 bg-white text-[var(--accent-hour-hover)] text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center border-2 border-[var(--accent-hour)] shadow">{totalQty}</span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-[60px]">
            <div className="text-xs font-bold opacity-90">{totalQty} item{totalQty !== 1 ? "s" : ""}</div>
            <div className="text-[15px] font-black tracking-tight">{fmt(total)}</div>
        </div>
        <div className="flex flex-col gap-0.5 text-[10px] opacity-90">
            {savings > 0 && <span className="bg-white/20 px-1.5 py-0.5 rounded font-bold">Save {fmt(savings)}</span>}
            <span className="bg-white/15 px-1.5 py-0.5 rounded font-bold">{deliveryMin}-{deliveryMax} min</span>
        </div>
        <FaChevronRight size={12} className="opacity-80 flex-shrink-0" />
    </button>
));
FloatingCart.displayName = "FloatingCart";

/* ── Not-in-area / waitlist cards ── */
const NotInAreaCard = memo(({ pincode }) => (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-6">
        <div className="bg-white border border-default rounded-2xl px-8 py-16 text-center flex flex-col items-center shadow-sm">
            <div className="text-5xl mb-4">📍</div>
            <div className="text-xl font-extrabold text-primary mb-2.5 tracking-tight">We are not in your area yet</div>
            <div className="text-sm text-secondary mb-6 leading-relaxed">
                Pincode <strong className="font-bold text-secondary">{pincode}</strong> is not covered. We are expanding fast!
            </div>
        </div>
    </div>
));
NotInAreaCard.displayName = "NotInAreaCard";

const WaitlistCard = memo(({ pinData, email, onEmailChange, onJoin, error }) => (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-6">
        <div className="bg-white border border-default rounded-2xl px-8 py-16 text-center flex flex-col items-center shadow-sm">
            <FaBell size={32} className="text-[var(--accent-hour)] mb-3" />
            <div className="text-xl font-extrabold text-primary mb-2.5">Launching soon in your area!</div>
            <div className="text-sm text-secondary mb-6 leading-relaxed max-w-md">
                {pinData.status === "coming_soon" ? "Be the first to know when we go live." : pinData.message}
            </div>
            <div className="flex gap-3 w-full max-w-[480px] flex-wrap">
                <input
                    type="email" placeholder="your@email.com" value={email} onChange={(e) => onEmailChange(e.target.value)}
                    className="flex-1 min-w-[200px] px-4 py-3 bg-canvas border border-strong rounded-xl text-[13px] text-primary outline-none focus:border-[var(--accent-hour)] focus:bg-white focus:ring-2 focus:ring-[var(--color-amber-100)] transition-all"
                />
                <button
                    onClick={onJoin}
                    className="px-5 py-3 bg-hour border-none rounded-xl text-white font-extrabold text-[13px] cursor-pointer hover:bg-hour-hover transition-colors hover:-translate-y-0.5 shadow-md whitespace-nowrap"
                >
                    Notify Me
                </button>
            </div>
            {error && <div className="text-error text-xs mt-2 font-medium">{error}</div>}
        </div>
    </div>
));
WaitlistCard.displayName = "WaitlistCard";

/* ── Footer — fully static after mount, never needs a re-render ── */
const SiteFooter = memo(() => (
    <footer className="bg-gradient-to-br from-[var(--color-graphite-900)] to-[var(--color-graphite-800)] border-t-2 border-[var(--color-graphite-700)] mt-6 pb-24">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                <div className="max-w-sm">
                    <div className="flex items-start gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-hour)] to-[var(--accent-hour-hover)] flex items-center justify-center font-black text-[13px] text-white flex-shrink-0">UX</div>
                        <div>
                            <div className="font-extrabold text-base text-white tracking-tight">URBEXON<em className="text-[var(--accent-hour)] not-italic ml-0.5">Hour</em></div>
                            <div className="text-[11px] text-muted mt-0.5 font-semibold">Express Delivery Service</div>
                        </div>
                    </div>
                    <p className="text-sm text-[var(--color-graphite-300)] mt-3 leading-relaxed">Fast, fresh & local products delivered to your doorstep in 45–120 minutes.</p>
                </div>
                <div>
                    <h4 className="text-xs font-black text-white mb-2.5 uppercase tracking-wider">Subscribe for Updates</h4>
                    <div className="flex gap-2 mt-2">
                        <input
                            type="email" placeholder="Your email"
                            className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-xs outline-none focus:border-[var(--accent-hour)] transition-colors placeholder:text-white/30"
                        />
                        <button className="px-4 py-2.5 bg-hour text-white border-none rounded-lg text-xs font-extrabold cursor-pointer hover:bg-hour-hover transition-colors whitespace-nowrap">Subscribe</button>
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
                                <li key={link}><a href="#" className="text-[13px] text-[var(--color-graphite-300)] no-underline hover:text-[var(--accent-hour)] transition-colors leading-loose">{link}</a></li>
                            ))}
                        </ul>
                    </div>
                ))}
                <div>
                    <h5 className="text-xs font-black text-white mb-3 uppercase tracking-wider">Follow Us</h5>
                    <div className="flex gap-2.5 flex-wrap">
                        {[{ label: "f", title: "Facebook" }, { label: "𝕏", title: "Twitter" }, { label: "📷", title: "Instagram" }, { label: "in", title: "LinkedIn" }].map(s => (
                            <a
                                key={s.title} href="#" title={s.title}
                                className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[var(--accent-hour)] no-underline hover:bg-hour hover:text-white hover:border-[var(--accent-hour)] transition-all text-sm"
                            >
                                {s.label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6" />
            <div className="flex items-center justify-between flex-wrap gap-4">
                <p className="text-xs text-secondary">© {new Date().getFullYear()} Urbexon Hour. All rights reserved. | Made with ❤️ for local communities</p>
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-secondary font-semibold uppercase tracking-wider">We Accept</span>
                    <div className="flex gap-2">
                        {["💳", "🏦", "📱", "₹"].map(ic => (
                            <span key={ic} className="text-base bg-white/10 px-2 py-1 rounded">{ic}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </footer>
));
SiteFooter.displayName = "SiteFooter";

/* ── Main page ── */
const UrbexonHour = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { slug } = useParams();
    const { user } = useAuth();
    const { setUhPincode: setUhLocationContext } = useUHLocation();
    const { uhTotalQty, uhTotal, uhItems } = useCart();
    const { recentlyViewed: uhRecentlyViewed } = useRecentlyViewed("urbexon_hour");

    /* Categories — shared/cached hook, no more page-local retry loop
       against /categories. Same cache Navbar reads from. */
    const { categories: rawApiCategories } = useCategories("urbexon_hour");
    const apiCategories = useMemo(
        () => rawApiCategories.filter(c => c.isActive !== false),
        [rawApiCategories]
    );

    const [pincode, setPincode] = useState(""); // last CONFIRMED pincode only
    const [pinData, setPinData] = useState(null);
    const [products, setProducts] = useState([]);
    // BUG FIX: search used to be a pure client-side .filter() over `products`
    // above, which is capped at 60 items (see checkPincodeInner) — any match
    // outside that first batch silently read as "0 results" even though it
    // existed in the catalog, AND the backend never saw the search term at
    // all, so it was invisible to /products/admin/search-analytics no matter
    // what was typed. Now backed by a real, debounced GET
    // /products/urbexon-hour?search=... call — same endpoint the category
    // rails use, which already logs analytics server-side.
    const [searchResults, setSearchResults] = useState(null); // null = no active backend search
    const [searchLoading, setSearchLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [error, setError] = useState("");
    const [waitlistEmail, setWaitlistEmail] = useState("");
    const [waitlistSuccess, setWaitlistSuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [savedPincode, setSavedPincode] = useState(() => {
        try { const stored = localStorage.getItem("uh_pincode"); if (stored) { const p = JSON.parse(stored); if (p?.code && /^\d{6}$/.test(p.code)) return p; } } catch { /* malformed/missing localStorage pincode — fall through to null */ }
        return null;
    });
    const [initialLoading, setInitialLoading] = useState(() => {
        try { const stored = localStorage.getItem("uh_pincode"); if (stored) { const p = JSON.parse(stored); if (p?.code) return true; } } catch { /* malformed/missing localStorage pincode — fall through to false */ }
        return false;
    });
    const [showPincodeEdit, setShowPincodeEdit] = useState(false);
    const searchQuery = searchParams.get("search") || "";
    const activeSubcategory = searchParams.get("subcategory") || "";
    const [uhDeals, setUhDeals] = useState([]);
    const [cartAnimating, setCartAnimating] = useState(false);
    const [heroBanners, setHeroBanners] = useState(() => (
        _uhBannersCache && Date.now() - _uhBannersCache.ts < BANNERS_CACHE_TTL ? _uhBannersCache.hero : []
    ));
    const [midBanners, setMidBanners] = useState(() => (
        _uhBannersCache && Date.now() - _uhBannersCache.ts < BANNERS_CACHE_TTL ? _uhBannersCache.mid : []
    ));
    const [subcategories, setSubcategories] = useState([]);
    const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
    const [homepageData, setHomepageData] = useState(null);

    const clearSearch = useCallback(() => {
        setSearchParams(prev => {
            prev.delete("search");
            prev.delete("subcategory");
            return prev;
        }, { replace: true });
    }, [setSearchParams]);

    const handleCategorySelect = useCallback((catName) => {
        if (!catName) {
            navigate("/urbexon-hour", { replace: true });
            return;
        }
        const matched = apiCategories.find(c => c.name === catName);
        const urlSlug = matched?.slug || catName.toLowerCase().replace(/\s+/g, "-");
        navigate(`/urbexon-hour/${urlSlug}`);
        setActiveCategory(catName);
    }, [apiCategories, navigate]);

    useEffect(() => {
        if (!slug) { setActiveCategory(null); return; }
        const decoded = decodeURIComponent(slug).toLowerCase().replace(/-/g, " ");
        const matched = apiCategories.find(c => c.slug?.toLowerCase() === slug.toLowerCase() ||
            c.name?.toLowerCase() === decoded ||
            c.name?.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase());
        setActiveCategory(matched ? matched.name : null);
    }, [slug, apiCategories]);

    /* Subcategories for the active category — this is the data source for
       SubcategoryChips, the only UI that can set `?subcategory=`. Cached
       per slug so revisiting the same category doesn't refetch a list that
       almost never changes. */
    useEffect(() => {
        if (!slug || !activeCategory) { setSubcategories([]); return; }

        const cached = _uhSubcategoriesCache.get(slug);
        if (cached && Date.now() - cached.ts < BANNERS_CACHE_TTL) {
            setSubcategories(cached.subcategories);
            return;
        }

        let cancelled = false;
        setSubcategoriesLoading(true);
        fetchCategorySubcategories(slug, { params: { type: "urbexon_hour", productType: "urbexon_hour" } })
            .then(({ data }) => {
                if (cancelled) return;
                const subs = data?.subcategories || [];
                setSubcategories(subs);
                _uhSubcategoriesCache.set(slug, { subcategories: subs, ts: Date.now() });
            })
            .catch(() => { if (!cancelled) setSubcategories([]); })
            .finally(() => { if (!cancelled) setSubcategoriesLoading(false); });
        return () => { cancelled = true; };
    }, [slug, activeCategory]);

    const handleSubcategorySelect = useCallback((name) => {
        setSearchParams(prev => {
            if (name) prev.set("subcategory", name);
            else prev.delete("subcategory");
            return prev;
        });
    }, [setSearchParams]);

    /* Banners — never depend on pincode, so they live in their own
       mount-only effect instead of refiring on every pincode change.
       Cached for BANNERS_CACHE_TTL so remounting the page (nav away/back)
       doesn't refetch banners that almost certainly haven't changed. */
    useEffect(() => {
        if (_uhBannersCache && Date.now() - _uhBannersCache.ts < BANNERS_CACHE_TTL) return;
        Promise.all([
            fetchBanners({ type: "urbexon_hour", placement: "hero" }).catch(() => ({ data: [] })),
            fetchBanners({ type: "urbexon_hour", placement: "mid" }).catch(() => ({ data: [] })),
        ]).then(([heroRes, midRes]) => {
            const hero = Array.isArray(heroRes.data) ? heroRes.data : [];
            const mid = Array.isArray(midRes.data) ? midRes.data : [];
            setHeroBanners(hero);
            setMidBanners(mid);
            _uhBannersCache = { hero, mid, ts: Date.now() };
        });
    }, []);

    /* Homepage data with no pincode yet — gives the page something to
       show before a pincode is resolved. Once a pincode is confirmed,
       checkPincodeInner below fetches the pincode-scoped version and
       that becomes the source of truth; this effect only needs to run
       once, before any pincode is known. */
    useEffect(() => {
        if (savedPincode?.code) return; // pincode-scoped fetch will happen in checkPincodeInner
        productApi.getUHHomepage()
            .then(({ data }) => setHomepageData(data)).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (uhTotalQty > 0) { setCartAnimating(true); const t = setTimeout(() => setCartAnimating(false), 600); return () => clearTimeout(t); }
    }, [uhTotalQty]);

    const checkPincodeInner = useCallback(async (code) => {
        const pc = code.trim();
        if (!/^\d{6}$/.test(pc)) return;

        // Restore the whole products/deals/homepage bundle for this pincode
        // instantly if we already fetched it recently — this is what makes
        // navigating away and back to /urbexon-hour (with the same pincode)
        // skip the skeleton and the full refetch entirely.
        const cached = _uhBundleCache.get(pc);
        if (cached && Date.now() - cached.ts < BUNDLE_CACHE_TTL) {
            setError("");
            setActiveCategory(null);
            setPinData(cached.pinData);
            setProducts(cached.products);
            setUhDeals(cached.deals);
            if (cached.homepageData) setHomepageData(cached.homepageData);
            if (cached.pinData?.available) {
                setSavedPincode(cached.savedPincodeData);
                setPincode(pc);
                setShowPincodeEdit(false);
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");
        setPinData(null);
        setProducts([]);
        setActiveCategory(null);
        try {
            const { data } = await pincodeApi.checkPincode(pc);
            setPinData(data);
            if (data.available) {
                const [pRes, dRes, hRes] = await Promise.allSettled([
                    productApi.getUHProducts({ pincode: pc, limit: 60, productType: "urbexon_hour" }),
                    productApi.getUHDeals({ limit: 12, pincode: pc, productType: "urbexon_hour" }),
                    productApi.getUHHomepage({ pincode: pc, productType: "urbexon_hour" }),
                ]);
                const prods = pRes.status === "fulfilled" ? (pRes.value.data.products || pRes.value.data || []) : [];
                const deals = dRes.status === "fulfilled" ? (dRes.value.data.products || []) : [];
                const hpData = hRes.status === "fulfilled" ? hRes.value.data : null;
                setProducts(prods);
                setUhDeals(deals);
                if (hpData) setHomepageData(hpData);
                const pincodeData = { code: pc, area: data.area || null, city: data.city || null, state: data.state || null };
                setUhLocationContext(pincodeData);
                setSavedPincode(pincodeData);
                setPincode(pc);
                setShowPincodeEdit(false);
                if (user) pincodeApi.saveUhPincode(pincodeData).catch(() => { });

                _uhBundleCache.set(pc, { pinData: data, products: prods, deals, homepageData: hpData, savedPincodeData: pincodeData, ts: Date.now() });
            }
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to check pincode. Please try again.");
        } finally { setLoading(false); }
    }, [user, setUhLocationContext]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            // Already have a fresh cached bundle for the saved pincode (e.g.
            // navigated to a product and hit Back)? Restore it instantly and
            // skip the /addresses/uh-pincode round-trip entirely — that GET
            // was firing on every single mount regardless, which is what made
            // the whole page (and every product in it) look like it was
            // reloading from scratch every time you came back to this route.
            if (savedPincode?.code) {
                const cached = _uhBundleCache.get(savedPincode.code);
                if (cached && Date.now() - cached.ts < BUNDLE_CACHE_TTL) {
                    await checkPincodeInner(savedPincode.code);
                    if (!cancelled) setInitialLoading(false);
                    return;
                }
            }

            let code = null;
            if (user) {
                try {
                    const { data } = await pincodeApi.getUhPincode();
                    if (data?.uhPincode?.code && !cancelled) {
                        const localStored = (() => { try { return JSON.parse(localStorage.getItem("uh_pincode") || "{}"); } catch { return {}; } })();
                        const merged = {
                            ...data.uhPincode,
                            area: data.uhPincode.area || localStored.area || null,
                            city: data.uhPincode.city || localStored.city || null,
                            state: data.uhPincode.state || localStored.state || null,
                        };
                        setSavedPincode(merged); code = merged.code;
                    }
                } catch { /* pincode lookup failed — fall through to saved/local pincode below */ }
            }
            if (!code && savedPincode?.code) code = savedPincode.code;
            if (code && !cancelled) await checkPincodeInner(code);
            if (!cancelled) setInitialLoading(false);
        };
        load();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const detectLocationTokenRef = useRef(0);

    // BUG FIX: this UH-specific geolocation flow was a separate, cruder
    // implementation from LocationContext.jsx's fetchAccurateLocation —
    // enableHighAccuracy:false explicitly told the browser to prefer
    // cell-tower/WiFi positioning over real GPS (routinely 1-5km off, easily
    // landing in a neighboring pincode), and maximumAge:300000 let it return
    // a position cached from up to 5 minutes ago instead of a fresh fix —
    // this combination is the direct cause of "GPS says 224122 but the app
    // resolves 224138". Also had no guard against an older detectLocation()
    // call's reverse-geocode response resolving after a newer one and
    // overwriting it with a stale pincode.
    const detectLocation = useCallback(async () => {
        const myToken = ++detectLocationTokenRef.current;
        setLocationLoading(true); setError("");
        try {
            if (!navigator.geolocation) { setError("Location not supported in your browser"); setLocationLoading(false); return; }
            navigator.geolocation.getCurrentPosition(
                async ({ coords: { latitude, longitude } }) => {
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`, { headers: { "Accept-Language": "en" } });
                        if (!res.ok) throw new Error("Geocoding failed");
                        const data = await res.json();
                        if (myToken !== detectLocationTokenRef.current) return; // a newer detectLocation() call has since superseded this one
                        let pc = data.address?.postcode;

                        // BUG FIX: don't trust the reverse geocoder's postcode
                        // blindly — cross-check the actual coordinates against
                        // our own serviceable-pincode DB and prefer that when
                        // a close match exists (this is what corrects e.g.
                        // "GPS is really in 224122" being mis-tagged 224138).
                        try {
                            const { data: nearest } = await pincodeApi.resolveNearestPincode(latitude, longitude);
                            if (myToken !== detectLocationTokenRef.current) return;
                            if (nearest?.found && nearest.code) pc = nearest.code;
                        } catch { /* non-fatal — fall back to the geocoder's own postcode */ }

                        if (pc && /^\d{6}$/.test(pc)) { await checkPincodeInner(pc); } else setError("Could not detect your pincode. Please enter it manually.");
                    } catch { if (myToken === detectLocationTokenRef.current) setError("Could not fetch location details. Please enter pincode manually."); }
                    finally { if (myToken === detectLocationTokenRef.current) setLocationLoading(false); }
                },
                (err) => {
                    if (myToken !== detectLocationTokenRef.current) return;
                    setLocationLoading(false);
                    if (err.code === 1) setError("Location permission denied. Please enter pincode manually.");
                    else if (err.code === 2) setError("Location unavailable. Please enter pincode manually.");
                    else setError("Location timeout. Please enter pincode manually.");
                },
                // enableHighAccuracy: request real GPS, not the coarse cell/WiFi
                // fallback. maximumAge: 0 forces a fresh fix instead of reusing
                // whatever position the browser last cached (which is what let
                // an old, possibly-different location silently get reused).
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        } catch { setLocationLoading(false); setError("Location detection failed. Please enter pincode manually."); }
    }, [checkPincodeInner]);

    const handleChangePincode = useCallback(() => {
        setShowPincodeEdit(true);
        setPinData(null);
        setProducts([]);
        setActiveCategory(null);
        setUhDeals([]);
    }, []);

    /* The old on-page amber LocationBar is gone — the pincode editor is now
       opened from the Navbar's "Deliver to" pill. When this page is already
       mounted the Navbar fires a window event; when it wasn't (user clicked
       the pill from /uh-cart etc.), the Navbar sets a one-shot sessionStorage
       flag we consume on mount. */
    useEffect(() => {
        const openEditor = () => {
            try { sessionStorage.removeItem("uh_open_pincode_edit"); } catch { /* storage unavailable */ }
            handleChangePincode();
            window.scrollTo({ top: 0, behavior: "smooth" });
        };
        let flagged = false;
        try { flagged = sessionStorage.getItem("uh_open_pincode_edit") === "1"; } catch { /* storage unavailable */ }
        if (flagged) openEditor();
        window.addEventListener("uh:change-pincode", openEditor);
        return () => window.removeEventListener("uh:change-pincode", openEditor);
    }, [handleChangePincode]);

    const backToSaved = useCallback(() => {
        if (savedPincode?.code) checkPincodeInner(savedPincode.code);
        setShowPincodeEdit(false);
    }, [savedPincode, checkPincodeInner]);

    const joinWaitlist = useCallback(async () => {
        if (!waitlistEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail)) { setError("Please enter a valid email address"); return; }
        try {
            await pincodeApi.joinPincodeWaitlist({ code: pincode, email: waitlistEmail });
            setWaitlistSuccess(true);
            setError("");
        } catch (err) { setError(err?.response?.data?.message || "Failed to join waitlist"); }
    }, [waitlistEmail, pincode]);

    const groupByVendor = (prods) => {
        const map = {};
        prods.forEach((p) => {
            const vid = typeof p.vendorId === "object" ? p.vendorId?._id : p.vendorId || "unknown";
            const vname = typeof p.vendorId === "object" ? p.vendorId?.shopName : p.vendorName || "Local Store";
            if (!map[vid]) map[vid] = { vendorId: vid, vendorName: vname ?? "Local Store", products: [] };
            map[vid].products.push(p);
        });
        return Object.values(map);
    };

    // Debounced backend search — see the searchResults state comment above.
    // Only fires once a pincode is confirmed (search only makes sense against
    // a servable catalog) and clears itself when the query is emptied.
    useEffect(() => {
        const q = searchQuery.trim();
        if (!q || !pincode) { setSearchResults(null); setSearchLoading(false); return; }
        let cancelled = false;
        setSearchLoading(true);
        const t = setTimeout(() => {
            productApi.getUHProducts({ pincode, search: q, limit: 60, productType: "urbexon_hour" })
                .then(({ data }) => { if (!cancelled) setSearchResults(data?.products || data || []); })
                .catch(() => { if (!cancelled) setSearchResults([]); })
                .finally(() => { if (!cancelled) setSearchLoading(false); });
        }, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [searchQuery, pincode]);

    const groupedCategories = useMemo(() => {
        if (searchQuery || activeCategory || !products.length) return {};
        const grouped = {};
        products.forEach(product => {
            const category = product.category || "Others";
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(product);
        });
        return grouped;
    }, [products, searchQuery, activeCategory]);

    const filteredProducts = useMemo(() => {
        // Prefer real backend search results once they've landed; until then
        // (or if the request failed), fall back to filtering whatever's
        // already loaded so the UI isn't blank during the debounce window.
        let prods = (searchQuery.trim() && searchResults !== null) ? searchResults : products;
        if (activeCategory) {
            const activeCatObject = apiCategories.find(c => c.name === activeCategory || c.slug?.toLowerCase() === slug?.toLowerCase() || c.name?.toLowerCase().replace(/\s+/g, "-") === slug?.toLowerCase());
            const activeCatName = activeCatObject?.name || activeCategory;
            const activeCatSlug = activeCatObject?.slug?.toLowerCase() || activeCatName?.toLowerCase().replace(/\s+/g, "-");
            if (activeCatName) {
                prods = prods.filter((p) => {
                    const productCategory = String(p.category || "").trim().toLowerCase();
                    const productCategorySlug = productCategory.replace(/\s+/g, "-");
                    return productCategory === activeCatName.toLowerCase()
                        || productCategorySlug === activeCatSlug
                        || productCategory === activeCatSlug
                        || productCategory === activeCatName.toLowerCase().replace(/\s+/g, "-");
                });
            }
        }
        if (activeSubcategory) prods = prods.filter((p) => p.subcategory === activeSubcategory || p.subcategory?.toLowerCase() === activeSubcategory.toLowerCase());
        if (searchQuery.trim() && searchResults === null) {
            const q = searchQuery.trim().toLowerCase();
            prods = prods.filter((p) => p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
        }
        return prods;
    }, [products, searchResults, activeCategory, activeSubcategory, searchQuery, apiCategories, slug]);

    const vendorGroups = useMemo(() => groupByVendor(filteredProducts), [filteredProducts]);
    const cartSavings = useMemo(() => calculateEstimatedSavings(uhItems), [uhItems]);
    const deliveryEta = useMemo(() => calculateEstimatedDeliveryTime(pinData), [pinData]);
    const hasActiveService = pinData?.available;
    const showHero = (!savedPincode?.code && !hasActiveService && !loading && !initialLoading) || showPincodeEdit;
    const showSkeleton = (loading || initialLoading) && savedPincode?.code && !showPincodeEdit;
    const onHomepage = !searchQuery && !activeCategory;

    useEffect(() => {
        if (searchQuery || activeCategory) window.scrollTo({ top: 0, behavior: "smooth" });
    }, [searchQuery, activeCategory]);

    const scrollToProducts = useCallback(() => {
        document.getElementById("uh-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    return (
        <div className="min-h-screen bg-canvas overflow-x-hidden antialiased">
            <SEO title="Urbexon Hour - Quick Delivery" description="Get groceries, essentials, and more delivered in minutes with Urbexon Hour." path="/urbexon-hour" />
            <main>

                {showHero && (
                    <PincodeHero
                        loading={loading}
                        locationLoading={locationLoading}
                        error={error}
                        savedPincode={savedPincode}
                        showBackLink={showPincodeEdit}
                        onCheck={checkPincodeInner}
                        onDetectLocation={detectLocation}
                        onBackToSaved={backToSaved}
                    />
                )}



                {/* {showSkeleton && <SkeletonGrid />} */}

                {hasActiveService && !showPincodeEdit && !searchQuery && !activeCategory && (
                    <>
                        <UHHero deliveryMin={deliveryEta.min} deliveryMax={deliveryEta.max} onShopNow={scrollToProducts} />

                        {heroBanners.length > 0 && (
                            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 pt-5">
                                <UHBannerCarousel banners={heroBanners} />
                            </div>
                        )}

                        <UHTopSellers pincode={pincode} />

                        <div id="uh-products">
                            <FlashDealSpotlight deal={uhDeals[0]} />
                            <FlashDeals deals={uhDeals.slice(1)} />

                            {Object.entries(groupedCategories).map(([category, items]) => (
                                <div className="max-w-[1280px] mx-auto px-4 lg:px-12" key={category}>
                                    <UHProductSection
                                        title={category}
                                        subtitle={`${items.length} Products`}
                                        products={items}
                                        renderCard={renderHiddenActionsCard}
                                    />
                                </div>
                            ))}
                        </div>

                        {midBanners.length > 0 && (
                            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-3">
                                <UHMidBanner banners={midBanners} />
                            </div>
                        )}

                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12">
                            <NearbyShops pincode={pincode} pincodeLabel={savedPincode?.area || savedPincode?.city || ""} maxResults={12} />
                        </div>

                        {uhRecentlyViewed.length > 0 && (
                            <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-3">
                                <UHProductSection title="Recently Viewed" subtitle="Continue where you left off" icon="🕐" products={uhRecentlyViewed.slice(0, 10)} renderCard={renderHiddenActionsCard} />
                            </div>
                        )}

                        <WhySection deliveryMin={deliveryEta.min} deliveryMax={deliveryEta.max} />
                    </>
                )}

                {activeCategory && !searchQuery && hasActiveService && !showPincodeEdit && (
                    <SubcategoryChips
                        subcategories={subcategories}
                        loading={subcategoriesLoading}
                        activeSubcategory={activeSubcategory}
                        onSelect={handleSubcategorySelect}
                    />
                )}

                {(searchQuery || activeSubcategory) && hasActiveService && !showPincodeEdit && (
                    <div className="bg-hour-tint border-b-2 border-[var(--accent-hour)] border-t border-[var(--color-amber-100)] mt-3 animate-[slideDown_0.3s_ease]">
                        <div className="max-w-[1280px] mx-auto px-4 lg:px-12 flex items-center gap-2 py-3">
                            <FaSearch size={13} className="text-[var(--accent-hour)] flex-shrink-0" />
                            <span className="text-[13px] text-[var(--accent-hour-hover)] font-medium flex-1 min-w-0 truncate">
                                {searchQuery && searchLoading
                                    ? "Searching…"
                                    : <>Found <strong className="font-bold">{filteredProducts.length}</strong> product{filteredProducts.length !== 1 ? "s" : ""} matching "<strong className="font-bold">{searchQuery || activeSubcategory}</strong>"</>}
                            </span>
                            <button
                                className="flex items-center gap-1.5 bg-error-tint border border-[var(--color-error-100)] text-error px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer hover:bg-error-tint transition-colors flex-shrink-0"
                                onClick={clearSearch}
                            >
                                <FaTimes size={12} /> Clear
                            </button>
                        </div>
                    </div>
                )}

                {pinData?.available && !onHomepage && (
                    <VendorProductGroups
                        vendorGroups={vendorGroups}
                        filteredCount={filteredProducts.length}
                        loading={loading}
                        activeCategory={activeCategory}
                        searchQuery={searchQuery}
                        deliveryMin={deliveryEta.min}
                        deliveryMax={deliveryEta.max}
                        onShowAll={() => { handleCategorySelect(null); clearSearch(); }}
                    />
                )}

                {pinData && !pinData.available && pinData.status === "not_found" && (
                    <NotInAreaCard pincode={pincode} />
                )}

                {pinData && !pinData.available && pinData.status !== "not_found" && !waitlistSuccess && (
                    <WaitlistCard
                        pinData={pinData}
                        email={waitlistEmail}
                        onEmailChange={setWaitlistEmail}
                        onJoin={joinWaitlist}
                        error={error}
                    />
                )}

                {waitlistSuccess && (
                    <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-6">
                        <div className="bg-success-tint border border-[var(--color-success-100)] rounded-2xl text-success font-bold text-sm text-center py-4 px-5">
                            ✅ You are on the waitlist! We will notify you when we launch in your area.
                        </div>
                    </div>
                )}

                <div className="h-20" />
            </main>

            {uhTotalQty > 0 && (
                <FloatingCart
                    totalQty={uhTotalQty}
                    total={uhTotal}
                    savings={cartSavings}
                    deliveryMin={deliveryEta.min}
                    deliveryMax={deliveryEta.max}
                    animating={cartAnimating}
                    onClick={() => navigate("/uh-cart")}
                />
            )}

            <SiteFooter />

            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display:none; }
                .scrollbar-hide { scrollbar-width: none; }
                @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
            `}</style>
        </div>
    );
};

export default UrbexonHour;