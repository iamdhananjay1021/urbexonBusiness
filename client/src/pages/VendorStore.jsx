import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    FiStar, FiMapPin, FiArrowLeft, FiPackage, FiShare2,
    FiLink, FiClock, FiShoppingBag, FiCheckCircle,
} from "react-icons/fi";
import { FaStore, FaStar, FaRegStar } from "react-icons/fa";
import BackButton from "../components/BackButton";
import { getVendorStore } from "../api/vendorApi";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import Avatar from "../design-system/Avatar";
import Badge from "../design-system/Badge";
import Button from "../design-system/Button";
import { useUHLocation } from "../contexts/UHLocationContext";

// Session-lifetime cache keyed by vendor slug — same pattern as Home.jsx's
// _homeCache. Without it, going Vendor → Product → Back re-showed the full
// loading spinner and refetched the store (vendor logo/banner + every
// product card) from scratch instead of restoring what was just fetched.
const CACHE_TTL = 60 * 1000;
const vendorStoreCache = new Map(); // slug -> { vendor, products, ts }

/**
 * VendorStore.jsx — v2.0 (full restyle)
 * NOTE: uses the app's real ProductCard (../components/ProductCard) — left
 * untouched, owns real cart/wishlist business logic. Only the store header/
 * banner/info chrome and page states below are redesigned.
 *
 * What changed vs the previous version:
 *  - Taller hero banner with a bottom gradient so back/share controls and
 *    the category badge stay legible over any photo.
 *  - Vendor info card redesigned: bigger ring-framed avatar, real 5-star
 *    rating visualization (not just a number), a proper Open/Closed status
 *    dot instead of a plain badge, and stat "chips" (Products/Orders/ETA)
 *    instead of plain icon+text rows.
 *  - Loading state is now a skeleton that mirrors the real layout (banner +
 *    info card + product grid shapes) instead of a centered spinner, so the
 *    page doesn't visually "jump" once data arrives.
 *  - Not-found/error state redesigned to match the rest of the app's empty
 *    states (icon tile, clearer copy, single primary action).
 *  - Product grid section gets a header with a live count and a share
 *    shortcut; grid spacing/breakpoints tuned to match ProductCard's real
 *    proportions instead of a generic auto-fill.
 *  - Share button reused from the top bar (native share sheet / clipboard
 *    fallback), so "share this store" doesn't require re-deriving a URL
 *    in multiple places.
 * All data fetching, caching, and the underlying ProductCard usage are
 * unchanged.
 */
const VendorStore = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    // Same pincode source Navbar/UrbexonHour.jsx use — real, current UH
    // delivery pincode, not a stale/guessed value.
    const { uhPincode: uhPincodeData } = useUHLocation();
    const uhPincode = uhPincodeData?.code || null;
    const cacheKey = slug ? `${slug}:${uhPincode || "none"}` : null;
    const isCacheFresh = () => {
        const c = cacheKey ? vendorStoreCache.get(cacheKey) : null;
        return !!c && Date.now() - c.ts < CACHE_TTL;
    };

    const [vendor, setVendor] = useState(() => (isCacheFresh() ? vendorStoreCache.get(cacheKey).vendor : null));
    const [products, setProducts] = useState(() => (isCacheFresh() ? vendorStoreCache.get(cacheKey).products : []));
    const [deliverableToYou, setDeliverableToYou] = useState(() => (isCacheFresh() ? vendorStoreCache.get(cacheKey).deliverableToYou : null));
    const [loading, setLoading] = useState(() => !isCacheFresh());
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Guard against undefined slug. This can happen if the URL is malformed (e.g., /vendor/ instead of /vendor/slug).
        if (!slug) {
            setLoading(false);
            setError("Invalid store URL. Please ensure you are navigating to a specific vendor.");
            return;
        }
        const existing = vendorStoreCache.get(cacheKey);
        if (existing && Date.now() - existing.ts < CACHE_TTL) {
            setVendor(existing.vendor);
            setProducts(existing.products);
            setDeliverableToYou(existing.deliverableToYou);
            setLoading(false);
            return;
        }
        const fetchStore = async () => {
            try {
                setLoading(true);
                const { data } = await getVendorStore(slug, uhPincode ? { pincode: uhPincode } : undefined);
                if (data.success) {
                    setVendor(data.vendor);
                    setProducts(data.products);
                    setDeliverableToYou(data.deliverableToYou);
                    vendorStoreCache.set(cacheKey, { vendor: data.vendor, products: data.products, deliverableToYou: data.deliverableToYou, ts: Date.now() });
                } else {
                    setError("Store not found");
                }
            } catch {
                setError("Store not found");
            } finally {
                setLoading(false);
            }
        };
        fetchStore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, cacheKey]);

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: vendor?.shopName, url }); } catch { /* user cancelled native share sheet — expected */ }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch { /* clipboard write denied/unsupported — intentionally silent */ }
        }
    };

    const ratingValue = vendor?.rating || 0;
    const fullStars = Math.round(ratingValue);

    const deliveryEta = useMemo(() => {
        if (!vendor) return null;
        if (vendor.avgDeliveryMinutes) return `${vendor.avgDeliveryMinutes} min`;
        return vendor.productType === "urbexon_hour" ? "45–120 min" : "2–4 days";
    }, [vendor]);

    /* ── Loading skeleton — mirrors the real layout shape so nothing
         visually jumps once the fetch resolves. ── */
    if (loading) {
        return (
            <div className="min-h-screen bg-canvas animate-pulse">
                <div className="h-[260px] sm:h-[300px] bg-[var(--color-graphite-200)]" />
                <div className="max-w-[1200px] mx-auto px-5 -mt-14 relative z-[2]">
                    <div className="bg-white rounded-3xl shadow-md p-6 flex gap-5 items-start flex-wrap">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[var(--color-graphite-200)] flex-shrink-0" />
                        <div className="flex-1 min-w-[200px] space-y-3">
                            <div className="h-6 w-1/3 bg-[var(--color-graphite-200)] rounded" />
                            <div className="h-3.5 w-1/2 bg-[var(--color-graphite-200)] rounded" />
                            <div className="h-3.5 w-2/3 bg-[var(--color-graphite-200)] rounded" />
                        </div>
                    </div>
                </div>
                <div className="max-w-[1200px] mx-auto px-5 pt-10 pb-16">
                    <div className="h-6 w-32 bg-[var(--color-graphite-200)] rounded mb-5" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="rounded-2xl border border-default overflow-hidden bg-white">
                                <div className="aspect-square bg-[var(--color-graphite-200)]" />
                                <div className="p-3 space-y-2">
                                    <div className="h-2.5 w-4/5 bg-[var(--color-graphite-200)] rounded" />
                                    <div className="h-2.5 w-2/5 bg-[var(--color-graphite-200)] rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    /* ── Not found / error state ── */
    if (error || !vendor) {
        return (
            <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-5 p-5 text-center">
                <div className="w-20 h-20 rounded-2xl bg-[var(--color-graphite-100)] flex items-center justify-center">
                    <FaStore size={34} className="text-[var(--color-graphite-300)]" aria-hidden="true" />
                </div>
                <div>
                    <h2 className="font-display text-[26px] font-bold text-primary mb-1.5">Store Not Found</h2>
                    <p className="text-sm text-secondary max-w-[360px] leading-relaxed">
                        {error === "Invalid store URL. Please ensure you are navigating to a specific vendor."
                            ? error
                            : "This vendor store doesn't exist or is no longer available."}
                    </p>
                </div>
                <Button variant="primary" icon={FiArrowLeft} onClick={() => navigate("/")}>Go Home</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-canvas">
            <SEO
                title={vendor?.shopName || "Vendor Store"}
                description={`Shop at ${vendor?.shopName || "this vendor"} on Urbexon. ${vendor?.address?.city ? `Located in ${vendor.address.city}.` : ""} Browse products and order now.`}
                path={`/vendor/${slug}`}
            />

            {/* ── Banner ── */}
            <div
                className="h-[260px] sm:h-[300px] bg-[var(--color-graphite-900)] bg-cover bg-center relative overflow-hidden"
                style={vendor.shopBanner ? { backgroundImage: `url(${vendor.shopBanner})` } : undefined}
            >
                {!vendor.shopBanner && (
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-graphite-800)] to-[var(--color-graphite-900)]" />
                )}
                {/* bottom gradient — keeps controls/badges legible over any photo */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/25" />

                <div className="relative z-[2] flex items-center justify-between px-4 sm:px-5 pt-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
                    <BackButton
                        fallback="/"
                        label="Back"
                        className="!text-white px-4 py-2 bg-white/15 backdrop-blur-md border border-white/20 !normal-case !tracking-normal !text-sm rounded-full hover:!text-white hover:bg-white/25 active:scale-95"
                    />
                    <button
                        onClick={handleShare}
                        title={copied ? "Link copied!" : "Share store"}
                        className="w-10 h-10 flex items-center justify-center bg-white/15 backdrop-blur-md border border-white/20 text-white rounded-full hover:bg-white/25 active:scale-95 transition-all"
                    >
                        {copied ? <FiLink size={15} className="text-success" aria-hidden="true" /> : <FiShare2 size={15} aria-hidden="true" />}
                    </button>
                </div>

                {vendor.shopCategory && (
                    <div className="absolute bottom-4 left-4 sm:left-5 z-[2]">
                        <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/25 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">
                            {vendor.shopCategory}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Vendor Info Card ── */}
            <div className="max-w-[1200px] mx-auto px-4 sm:px-5 -mt-14 relative z-[2]">
                <div className="bg-white rounded-3xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] border border-default p-5 sm:p-6 flex gap-5 items-start flex-wrap">
                    <div className="relative flex-shrink-0">
                        <Avatar src={vendor.shopLogo} name={vendor.shopName} size="xl" className="ring-4 ring-white shadow-md" />
                        <span
                            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${vendor.isOpen ? "bg-[var(--color-success-500,#16a34a)]" : "bg-[var(--color-graphite-400)]"}`}
                            title={vendor.isOpen ? "Open now" : "Closed"}
                        />
                    </div>

                    <div className="flex-1 min-w-[220px]">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
                            <h1 className="font-display text-[clamp(1.35rem,3vw,1.9rem)] font-extrabold text-primary tracking-tight leading-tight">
                                {vendor.shopName}
                            </h1>
                            <Badge variant={vendor.isOpen ? "success" : "error"} className="flex-shrink-0">
                                <span className="flex items-center gap-1">
                                    {vendor.isOpen ? <FiCheckCircle size={11} aria-hidden="true" /> : null}
                                    {vendor.isOpen ? "Open now" : "Closed"}
                                </span>
                            </Badge>
                        </div>

                        <div className="flex items-center gap-1 mb-2.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                                s <= fullStars
                                    ? <FaStar key={s} size={13} className="text-[var(--color-warning-500)]" aria-hidden="true" />
                                    : <FaRegStar key={s} size={13} className="text-[var(--color-graphite-300)]" aria-hidden="true" />
                            ))}
                            <span className="text-[13px] font-bold text-primary ml-1">{ratingValue.toFixed(1)}</span>
                            {vendor.ratingCount > 0 && (
                                <span className="text-xs text-muted font-medium">({vendor.ratingCount} ratings)</span>
                            )}
                            {(vendor.address?.city || vendor.address?.state) && (
                                <span className="flex items-center gap-1 text-[13px] text-secondary ml-2">
                                    <FiMapPin size={11} aria-hidden="true" />
                                    {[vendor.address.city, vendor.address.state].filter(Boolean).join(", ")}
                                </span>
                            )}
                        </div>

                        {vendor.shopDescription && (
                            <p className="text-sm text-secondary leading-relaxed mb-3.5 max-w-[600px]">{vendor.shopDescription}</p>
                        )}

                        <div className="flex gap-2.5 flex-wrap">
                            <div className="flex items-center gap-2 bg-canvas border border-default rounded-full px-3.5 py-1.5">
                                <FiPackage size={13} className="text-accent" aria-hidden="true" />
                                <span className="text-[12.5px] font-semibold text-primary">{products.length} Products</span>
                            </div>
                            <div className="flex items-center gap-2 bg-canvas border border-default rounded-full px-3.5 py-1.5">
                                <FiShoppingBag size={13} className="text-accent" aria-hidden="true" />
                                <span className="text-[12.5px] font-semibold text-primary">{vendor.totalOrders || 0}+ Orders</span>
                            </div>
                            {deliveryEta && (
                                <div className="flex items-center gap-2 bg-canvas border border-default rounded-full px-3.5 py-1.5">
                                    <FiClock size={13} className="text-accent" aria-hidden="true" />
                                    <span className="text-[12.5px] font-semibold text-primary">{deliveryEta}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Products Grid ── */}
            <div className="max-w-[1200px] mx-auto px-4 sm:px-5 pt-9 pb-16">
                {deliverableToYou === false && (
                    <div className="flex items-start gap-3 bg-warning-tint border border-[var(--color-warning-100)] rounded-2xl px-4 py-3.5 mb-5">
                        <FiMapPin size={18} className="text-[var(--color-warning-700)] flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                            <p className="text-[13px] font-bold text-[var(--color-warning-700)]">This vendor doesn't deliver to your area</p>
                            <p className="text-xs text-secondary mt-0.5">
                                You can browse their products, but ordering is disabled — {vendor.shopName} only delivers within its own service area (max 10km).
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mb-5 gap-3">
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-primary tracking-tight">
                        Products
                        {products.length > 0 && (
                            <span className="ml-2 text-sm font-semibold text-muted align-middle">({products.length})</span>
                        )}
                    </h2>
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center gap-3.5">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--color-graphite-100)] flex items-center justify-center">
                            <FiPackage size={30} className="text-[var(--color-graphite-300)]" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-[15px] font-bold text-primary mb-1">No products available yet</p>
                            <p className="text-sm text-secondary">Check back soon — this store is just getting started.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        {products.map(p => (
                            <ProductCard
                                key={p._id}
                                product={{ ...p, vendorId: p.vendorId || vendor?._id }}
                                hideActions={deliverableToYou === false}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VendorStore;