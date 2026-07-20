/**
 * ProductDetails.jsx — v5 · "Signal" redesign
 * ─ Styled with the Signal design-system tokens (tokens.css): indigo
 *   #4F46E5 primary, graphite/neutral grays, semantic success/error tints.
 *   No more orange/rose gradients — one accent, used consistently.
 * ─ Typography: Manrope headings (global h1–h4 rule; the old inline
 *   Inter font-family override on the wrapper was removed so it applies),
 *   32px title / 30px extrabold price hierarchy.
 * ─ Layout: gallery stays sticky on desktop; the info column now scrolls
 *   with the page (the old inner overflow-y-auto scrollbar is gone).
 * ─ Loading is a full layout-matching skeleton (no layout shift, no
 *   spinner), and the error state has a Retry button.
 * ─ Accordions expand smoothly via the CSS grid-rows transition (content
 *   stays mounted, so no logic/state change).
 * ─ All business logic, handlers, and API calls are 100% preserved from
 *   v4 (lazy modals, parallel fetches, memoized subcomponents, review
 *   submit lock — see v4 notes in git history).
 */
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo, useRef, Suspense, lazy, memo } from "react";
import * as productApi from "../api/productApi";
import * as reviewApi from "../api/reviewApi";
import { uploadCustomImage } from "../api/uploadApi";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../contexts/AuthContext";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import { imgUrl, imgSrcSet } from "../utils/imageUrl";
import { showToast } from "../utils/toast";
import SEO, { JsonLd } from "../components/SEO";
import DeliveryEstimate from "../components/DeliveryEstimate";
import BackButton from "./BackButton";
import ProductCard from "./ProductCard";
import {
    FaStar, FaRegStar, FaShoppingCart, FaBolt,
    FaTrash, FaCheckCircle,
    FaUpload, FaTimes, FaPencilAlt, FaStickyNote,
    FaBell, FaTag, FaShare,
    FaSearchPlus, FaChevronDown,
    FaShieldAlt, FaTruck, FaUndo,
} from "react-icons/fa";

/* ─── Code-split modals (only fetched when actually opened) ─── */
const ShareModal = lazy(() => import("./ShareModal"));
const ZoomModal = lazy(() => import("./ZoomModal"));

/* ─── Helpers ─── */
const getMrp = (p) => {
    const v = p?.mrp ?? p?.originalPrice ?? p?.comparePrice ?? p?.compareAtPrice ?? null;
    if (!v && v !== 0) return null;
    const n = Number(v);
    return n > 0 ? n : null;
};

/* ─── Star Row ─── */
const StarRow = memo(({ value, size = 12 }) => (
    <span className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => s <= value
            ? <FaStar key={s} size={size} className="text-amber-400" />
            : <FaRegStar key={s} size={size} className="text-neutral-300" />)}
    </span>
));

/* ─── Rating Bar ─── */
const RatingBar = memo(({ star, count, pct }) => (
    <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 w-2 shrink-0">{star}</span>
        <FaStar size={9} className="text-amber-400 shrink-0" />
        <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-neutral-400 w-4 text-right shrink-0">{count}</span>
    </div>
));

/* ─── Accordion — smooth grid-rows expand, content stays mounted ─── */
const Accordion = memo(({ title, icon, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-neutral-200/70 rounded-xl mb-2 overflow-hidden bg-white">
            <button
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className="w-full flex items-center justify-between px-4 py-3.5
                           bg-white hover:bg-neutral-50 transition-colors duration-200 text-left
                           focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus-ring)]"
            >
                <span className="flex items-center gap-2.5 text-[13px] sm:text-sm font-semibold text-neutral-800">
                    {icon}{title}
                </span>
                <FaChevronDown size={11}
                    className={`text-neutral-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-250 ease-out
                             ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                aria-hidden={!open}>
                <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-1 text-sm sm:text-[15px] text-neutral-700 leading-[1.7]">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
});

/* ─── Full-page skeleton — mirrors the real layout so nothing shifts
       when content arrives ─── */
const Sk = ({ className = "" }) => (
    <div className={`bg-neutral-100 rounded-lg animate-pulse ${className}`} />
);
const PageSkeleton = memo(() => (
    <div className="bg-canvas min-h-screen" aria-busy="true" aria-label="Loading product">
        <div className="bg-white border-b border-neutral-200/60 px-4 py-3">
            <div className="max-w-6xl mx-auto"><Sk className="h-5 w-40" /></div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="bg-white rounded-2xl shadow-[var(--shadow-xs)] border border-neutral-200/60 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Gallery side */}
                    <div className="p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-neutral-200/60">
                        <Sk className="aspect-square w-full max-w-[420px] mx-auto rounded-2xl" />
                        <div className="flex gap-2 mt-4 max-w-[420px] mx-auto">
                            {[0, 1, 2, 3].map(i => <Sk key={i} className="w-14 h-14 rounded-xl" />)}
                        </div>
                    </div>
                    {/* Info side */}
                    <div className="p-4 sm:p-6 flex flex-col gap-4">
                        <Sk className="h-3 w-24" />
                        <Sk className="h-8 w-4/5" />
                        <Sk className="h-6 w-48" />
                        <Sk className="h-10 w-56" />
                        <Sk className="h-16 w-full rounded-xl" />
                        <Sk className="h-4 w-32" />
                        <div className="flex gap-3 mt-2">
                            <Sk className="h-12 flex-1 rounded-xl" />
                            <Sk className="h-12 flex-1 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {[0, 1, 2, 3].map(i => <Sk key={i} className="h-14 rounded-xl" />)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
));

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addItem, cartItems } = useCart();
    const { trackView } = useRecentlyViewed("ecommerce");
    const { user } = useAuth();

    const [product, setProduct] = useState(null);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [activeImg, setActiveImg] = useState(0);
    const [imgZoomed, setImgZoomed] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [selectedSize, setSelectedSize] = useState("");
    const [selectedColor, setSelectedColor] = useState("");
    const [addedFlash, setAddedFlash] = useState(false);
    const [activeTab, setActiveTab] = useState("description");

    const [customText, setCustomText] = useState("");
    const [customNote, setCustomNote] = useState("");
    const [customImagePreview, setCustomImagePreview] = useState("");
    const [customImageUrl, setCustomImageUrl] = useState("");
    const [uploadingImage, setUploadingImage] = useState(false);

    const [myRating, setMyRating] = useState(0);
    const [myComment, setMyComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState("");
    const [reviewSuccess, setReviewSuccess] = useState(false);

    const [notifyEmail, setNotifyEmail] = useState("");
    const [notifySubmitting, setNotifySubmitting] = useState(false);
    const [notifySuccess, setNotifySuccess] = useState(false);
    const [notifyError, setNotifyError] = useState("");
    const [showNotifyInput, setShowNotifyInput] = useState(false);

    const abortRef = useRef(null);
    // Hard, synchronous guard against double-submitting a review. `submitting`
    // (state) is what disables the button visually, but state updates are
    // async/batched — two very fast clicks (or click + Enter) can both read
    // `submitting === false` before the re-render lands, firing two POSTs.
    // A ref flips synchronously on the same tick, so the second call bails
    // out immediately regardless of render timing.
    const reviewSubmitLockRef = useRef(false);

    /* ── Active Variant ── */
    const activeVariant = useMemo(() => {
        if (!selectedColor || !product?.colorVariants?.length) return null;
        return product.colorVariants.find(
            (v, idx) => (v.name || v.color || `Color ${idx + 1}`) === selectedColor
        ) || null;
    }, [product?.colorVariants, selectedColor]);

    const displayPrice = useMemo(() => {
        if (activeVariant?.price != null && Number(activeVariant.price) > 0)
            return Number(activeVariant.price);
        return product ? Number(product.price) : 0;
    }, [activeVariant, product?.price]);

    const baseMrp = useMemo(() => getMrp(product), [product]);
    const displayMrp = useMemo(() => {
        if (activeVariant?.mrp != null && Number(activeVariant.mrp) > 0)
            return Number(activeVariant.mrp);
        return baseMrp;
    }, [activeVariant, baseMrp]);

    const variantStock = useMemo(() => {
        if (activeVariant) return activeVariant.stock ?? 0;
        return product?.stock ?? 0;
    }, [activeVariant, product?.stock]);

    const variantInStock = useMemo(() => {
        if (product?.colorVariants?.length > 0 && selectedColor)
            return (activeVariant?.stock ?? 0) > 0;
        return product?.inStock ?? false;
    }, [activeVariant, selectedColor, product?.colorVariants, product?.inStock]);

    const currentCartItemId = product ? `${product._id}-${selectedSize || 'nosize'}-${selectedColor || 'nocolor'}` : null;
    const inCart = useMemo(() => cartItems.some(i => (i.cartItemId || i._id) === currentCartItemId), [cartItems, currentCartItemId]);

    const hasDiscount = useMemo(() => displayMrp && displayMrp > displayPrice, [displayMrp, displayPrice]);
    const savedAmount = useMemo(() => hasDiscount ? displayMrp - displayPrice : 0, [hasDiscount, displayMrp, displayPrice]);
    const discountPct = useMemo(() => hasDiscount ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100) : null, [hasDiscount, displayMrp, displayPrice]);

    // Derived from local `reviews` state — no need to ever refetch the
    // product just to get an up-to-date average rating / count.
    const avgRating = useMemo(() => {
        if (reviews?.length > 0) return reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
        return product?.rating || 0;
    }, [reviews, product?.rating]);

    const ratingBars = useMemo(() => [5, 4, 3, 2, 1].map(star => ({
        star,
        count: reviews.filter(r => r.rating === star).length,
        pct: reviews.length ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100) : 0,
    })), [reviews]);

    const highlightEntries = useMemo(() => {
        if (product?.highlightsArray?.length) return product.highlightsArray.map(h => [h.title, h.value]);
        if (!product?.highlights) return [];
        return product.highlights instanceof Map
            ? [...product.highlights.entries()]
            : Object.entries(product.highlights);
    }, [product?.highlights, product?.highlightsArray]);

    const allImages = useMemo(() => {
        if (!product) return [];
        if (selectedColor && product.colorVariants) {
            const variant = product.colorVariants.find((v, idx) =>
                (v.name || v.color || `Color ${idx + 1}`) === selectedColor);
            if (variant?.images?.length > 0) return variant.images;
        }
        return product.images?.length ? product.images : [];
    }, [product, selectedColor]);

    useEffect(() => { setActiveImg(0); }, [selectedColor]);

    const normalizedSizes = useMemo(() => {
        if (!product?.sizes?.length) return [];
        return product.sizes.map(s => typeof s === "string" ? { size: s, stock: 1 } : s);
    }, [product?.sizes]);

    /* ── Fetch ── */
    const fetchReviews = useCallback(async (pid, signal) => {
        try {
            const { data } = await reviewApi.getReviews(pid, signal ? { signal } : undefined);
            setReviews(data);
        } catch { /* review fetch failed/aborted — reviews list simply stays empty */ }
    }, []);

    useEffect(() => {
        if (!id) return;
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        (async () => {
            try {
                setLoading(true); setError(""); setActiveImg(0);
                setSelectedSize(""); setSelectedColor("");
                const { data: prod } = await productApi.getProductById(id, { signal: ctrl.signal });
                setProduct(prod);
                if (prod?.colorVariants?.length > 0) {
                    const def = prod.colorVariants.find(v => v.isDefault) || prod.colorVariants[0];
                    if (def?.name) setSelectedColor(def.name);
                }
                trackView(prod);

                // Related products and reviews don't depend on each other —
                // fetch them concurrently instead of one-after-another.
                const [relatedRes, reviewsRes] = await Promise.all([
                    productApi.getRelatedProducts(prod._id, { signal: ctrl.signal }),
                    reviewApi.getReviews(prod._id, { signal: ctrl.signal }),
                ]);
                setRelatedProducts(relatedRes.data);
                setReviews(reviewsRes.data);
            } catch (err) {
                if (err.name !== "AbortError") setError("Failed to load product.");
            } finally { setLoading(false); }
        })();
        return () => ctrl.abort();
    }, [id, trackView]);

    useEffect(() => {
        if (!user || !reviews.length) return;
        const mine = reviews.find(r => r.user === user._id || r.user?._id === user._id);
        if (mine) { setMyRating(mine.rating); setMyComment(mine.comment || ""); }
    }, [reviews, user]);

    useEffect(() => { if (user?.email) setNotifyEmail(user.email); }, [user]);

    /* ── Handlers ── */
    const handleCustomImageChange = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size / 1024 / 1024 > 5) return showToast("Max 5MB", "warning");
        setCustomImagePreview(URL.createObjectURL(file));
        try {
            setUploadingImage(true);
            const fd = new FormData(); fd.append("image", file);
            const { data } = await uploadCustomImage(fd);
            setCustomImageUrl(data.url);
        } catch { showToast("Upload failed.", "error"); setCustomImagePreview(""); }
        finally { setUploadingImage(false); }
    }, []);

    const removeCustomImage = useCallback(() => { setCustomImagePreview(""); setCustomImageUrl(""); }, []);

    const getCustomization = useCallback(() => ({
        text: customText.trim(), imageUrl: customImageUrl, note: customNote.trim(),
    }), [customText, customImageUrl, customNote]);

    const isUrbexonHourProduct =
        product?.productType === "urbexon_hour" ||
        !!product?.vendorId;

    const handleAddToCart = useCallback(() => {
        if (normalizedSizes.length > 0 && !selectedSize) return showToast("Please select a size!", "warning");
        if (product?.colorVariants?.length > 0 && !selectedColor) return showToast("Please select a color!", "warning");
        const cartItemId = `${product._id}-${selectedSize || 'nosize'}-${selectedColor || 'nocolor'}`;
        addItem({
            ...product,
            _id: cartItemId,
            productId: product._id,

            productType: isUrbexonHourProduct
                ? "urbexon_hour"
                : "ecommerce",

            price: displayPrice,
            mrp: displayMrp,

            images: activeVariant?.images?.length
                ? activeVariant.images
                : product.images,

            image:
                activeVariant?.images?.[0]?.url ||
                product.images?.[0]?.url ||
                "",

            selectedSize,
            selectedColor,
            customization: getCustomization(),
            cartItemId,
        });
        setAddedFlash(true); setTimeout(() => setAddedFlash(false), 1500);
    }, [product, selectedSize, selectedColor, normalizedSizes, addItem, getCustomization, displayPrice, displayMrp, activeVariant, isUrbexonHourProduct]);

    const handleBuyNow = useCallback(() => {
        if (normalizedSizes.length > 0 && !selectedSize) return showToast("Please select a size!", "warning");
        if (product?.colorVariants?.length > 0 && !selectedColor) return showToast("Please select a color!", "warning");
        const cartItemId = `${product._id}-${selectedSize || 'nosize'}-${selectedColor || 'nocolor'}`;
        const buyNowItem = {
            ...product,
            _id: cartItemId,
            productId: product._id,

            productType: isUrbexonHourProduct
                ? "urbexon_hour"
                : "ecommerce",

            price: displayPrice,
            mrp: displayMrp,

            images: activeVariant?.images?.length
                ? activeVariant.images
                : product.images,

            image:
                activeVariant?.images?.[0]?.url ||
                product.images?.[0]?.url ||
                "",

            quantity: 1,
            selectedSize,
            selectedColor,
            customization: getCustomization(),
            cartItemId,
        };
        try { sessionStorage.setItem("ux_buy_now_item", JSON.stringify(buyNowItem)); } catch { /* storage unavailable — buy-now still proceeds via navigation state */ }
        // BUG FIX: this route (/products/:id) can render an Urbexon Hour
        // product (e.g. via ?flow=uh from a vendor store) — buyNowItem was
        // already correctly tagged productType: "urbexon_hour" above, but
        // navigation always went to the ecommerce /checkout regardless,
        // running a UH order through the wrong checkout page entirely.
        // Same isUrbexonHourItem → checkoutUrl branch already used by
        // ProductCard.jsx's Buy Now button.
        navigate(isUrbexonHourProduct ? "/uh-checkout" : "/checkout", { state: { buyNowItem } });
    }, [product, selectedSize, selectedColor, normalizedSizes, navigate, getCustomization, displayPrice, displayMrp, activeVariant, isUrbexonHourProduct]);

    const handleNotifyMe = useCallback(async () => {
        if (!notifyEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
            setNotifyError("Enter a valid email"); return;
        }
        try {
            setNotifySubmitting(true); setNotifyError("");
            await productApi.subscribeStockNotify({ productId: product._id, email: notifyEmail.trim() });
            setNotifySuccess(true); setShowNotifyInput(false);
            try { localStorage.setItem(`notify_${product._id}`, "1"); } catch { /* storage unavailable — notify state still shown via React state above */ }
        } catch (err) { setNotifyError(err.response?.data?.message || "Something went wrong."); }
        finally { setNotifySubmitting(false); }
    }, [notifyEmail, product?._id]);

    const handleSubmitReview = useCallback(async (e) => {
        e.preventDefault();
        if (!myRating) return setReviewError("Select a rating first");
        // Synchronous guard — see comment on reviewSubmitLockRef above.
        if (reviewSubmitLockRef.current) return;
        reviewSubmitLockRef.current = true;
        try {
            setSubmitting(true); setReviewError("");
            await reviewApi.submitReview(product._id, { rating: myRating, comment: myComment });
            setReviewSuccess(true);
            // Only refresh reviews — avgRating/ratingBars are derived from
            // this state via useMemo, so a full product refetch isn't needed.
            await fetchReviews(product._id);
            setTimeout(() => setReviewSuccess(false), 2500);
        } catch (err) { setReviewError(err.response?.data?.message || "Failed to submit"); }
        finally { setSubmitting(false); reviewSubmitLockRef.current = false; }
    }, [myRating, myComment, product?._id, fetchReviews]);

    const handleDeleteReview = useCallback(async (rid) => {
        try {
            await reviewApi.deleteReview(rid);
            await fetchReviews(product._id);
            setMyRating(0); setMyComment("");
        } catch { /* review resubmit-fetch failed — form still resets, list just stays stale until next successful fetch */ }
    }, [product?._id, fetchReviews]);

    /* ── Loading — layout-matching skeleton, no spinner, no layout shift ── */
    if (loading) return <PageSkeleton />;

    /* ── Error / not found ── */
    if (!product || error) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-canvas px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-error-tint flex items-center justify-center">
                <FaTimes size={20} className="text-error" />
            </div>
            <div>
                <p className="text-base font-bold text-neutral-900 m-0">
                    {error ? "Something went wrong" : "Product not found"}
                </p>
                <p className="text-sm text-neutral-500 mt-1.5 m-0 max-w-[320px]">
                    {error || "This product may have been removed or the link is incorrect."}
                </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
                {error && (
                    <button onClick={() => window.location.reload()}
                        className="h-11 px-6 bg-accent text-white rounded-xl font-semibold text-sm
                                   hover:bg-accent-hover transition-colors duration-200 focus-ring-accent">
                        Try Again
                    </button>
                )}
                <button onClick={() => navigate("/")}
                    className={`h-11 px-6 rounded-xl font-semibold text-sm transition-colors duration-200 focus-ring-accent
                        ${error
                            ? "bg-white border border-neutral-300 text-neutral-800 hover:border-neutral-400"
                            : "bg-accent text-white hover:bg-accent-hover"}`}>
                    Go Home
                </button>
            </div>
        </div>
    );

    const rawHeroUrl = allImages[activeImg]?.url || "";
    const heroUrl = imgUrl.detail(rawHeroUrl);
    const heroSrcSet = imgSrcSet(rawHeroUrl, 800);

    return (
        <>
            {product && (
                <>
                    {/* Admin-defined SEO meta wins; falls back to name/description.
                        The SEO component appends " | Urbexon" itself, so a
                        metaTitle that already ends with it is de-duplicated. */}
                    <SEO
                        title={(product.seo?.metaTitle || product.name).replace(/\s*\|\s*Urbexon\s*$/i, "")}
                        description={product.seo?.metaDescription
                            || product.description?.slice(0, 160)
                            || `Buy ${product.name} at best price on Urbexon.`}
                        path={`/products/${id}`} image={product.images?.[0]?.url || ""} type="product" />
                    <JsonLd data={{
                        "@context": "https://schema.org", "@type": "Product",
                        name: product.name, description: product.description?.slice(0, 300),
                        image: product.images?.map(i => i.url) || [],
                        brand: { "@type": "Brand", name: product.brand || "Urbexon" },
                        offers: {
                            "@type": "Offer", url: `https://www.urbexon.in/products/${id}`,
                            priceCurrency: "INR", price: displayPrice,
                            availability: variantInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                        },
                        ...(product.avgRating > 0 && {
                            aggregateRating: { "@type": "AggregateRating", ratingValue: product.avgRating, reviewCount: product.reviewCount || 1 },
                        }),
                    }} />
                </>
            )}

            <style>{`
                .thumb-scroll::-webkit-scrollbar { height:3px }
                .thumb-scroll::-webkit-scrollbar-thumb { background:var(--color-graphite-200); border-radius:4px }
                .related-scroll::-webkit-scrollbar { height:4px }
                .related-scroll::-webkit-scrollbar-thumb { background:var(--color-graphite-200); border-radius:4px }
                @keyframes imgFade { from { opacity:0 } to { opacity:1 } }
            `}</style>

            {/* Body font comes from the global --font-body (Inter); headings pick
                up Manrope via the global h1–h4 rule now that no inline override
                is fighting them. */}
            {/* NOTE: no overflow-x-hidden here — an ancestor with overflow
                hidden becomes a scroll container and silently KILLS every
                position:sticky inside it (this is why the breadcrumb bar
                wasn't sticking). Horizontal safety is already handled
                globally on html/body, which browsers treat specially. */}
            <div className="bg-canvas min-h-screen">

                {/* ── Breadcrumb bar — sticks just below the fixed navbar ── */}
                <div className="bg-white border-b border-neutral-100 px-3 sm:px-4 py-2.5 sticky top-[var(--nav-h,0px)] z-30 shadow-[0_1px_2px_rgba(20,21,26,.04)]">
                    <div className="max-w-6xl mx-auto flex items-center gap-2">
                        <BackButton fallback="/" label="Back" className="!text-accent hover:!text-[var(--accent-primary-hover)] bg-accent-tint hover:!bg-accent-tint px-2.5 sm:px-3 py-1.5 rounded-lg normal-case tracking-normal text-[13px] sm:text-sm" />
                        {product.category && (
                            <span className="text-xs text-neutral-400 capitalize hidden sm:block truncate">
                                / {product.category.replace(/-/g, " ")}
                            </span>
                        )}
                        <span className="text-xs text-neutral-400 truncate hidden md:block max-w-xs">
                            / {product.name}
                        </span>
                    </div>
                </div>

                {/* ── Main container ── */}
                <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

                    {/* ══ Top Card: Image + Info ══ */}
                    <div className="bg-white rounded-2xl shadow-[var(--shadow-xs)] border border-neutral-200/60 overflow-hidden mb-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:items-start">

                            {/* ══ LEFT — Image Gallery ══ */}
                            <div className="border-b lg:border-b-0 lg:border-r border-neutral-100 p-3 sm:p-6
                                            lg:sticky lg:top-[calc(var(--nav-h,0px)+57px)] lg:self-start">

                                {/* Hero image */}
                                <div className="relative aspect-square w-full max-w-[320px] xs:max-w-[360px] sm:max-w-[420px] mx-auto
                                                rounded-2xl overflow-hidden bg-neutral-50 cursor-zoom-in
                                                group border border-neutral-100"
                                    onClick={() => !shareOpen && setImgZoomed(true)}>

                                    {/* Badges */}
                                    <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-10 flex flex-col gap-1.5">
                                        {product.isCustomizable && (
                                            <span className="bg-accent text-white text-[9px] font-bold
                                                             px-2 py-1 rounded-md tracking-[0.08em]">CUSTOMISABLE</span>
                                        )}
                                        {!variantInStock && (
                                            <span className="bg-neutral-800 text-white text-[9px] font-bold
                                                             px-2 py-1 rounded-md tracking-[0.08em]">SOLD OUT</span>
                                        )}
                                        {hasDiscount && (
                                            <span className="bg-[var(--icon-error)] text-white text-[10px] font-bold
                                                             px-2 py-1 rounded-md leading-none">
                                                {discountPct}% OFF
                                            </span>
                                        )}
                                    </div>

                                    {/* Share button */}
                                    <button
                                        onClick={e => { e.stopPropagation(); setShareOpen(true); }}
                                        aria-label="Share this product"
                                        className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10 flex items-center gap-1.5
                                                   bg-white/90 backdrop-blur-sm border border-neutral-100
                                                   rounded-xl px-2.5 sm:px-3 py-1.5 text-[11px] font-semibold text-neutral-600
                                                   shadow-sm hover:bg-white hover:shadow-md transition-all">
                                        <FaShare size={10} /> <span className="hidden xs:inline">Share</span>
                                    </button>

                                    {/* Main image */}
                                    {heroUrl
                                        ? <img key={heroUrl} src={heroUrl} srcSet={heroSrcSet}
                                            alt={allImages[activeImg]?.alt || product.name}
                                            loading="eager" decoding="sync" fetchPriority="high"
                                            className="w-full h-full object-contain p-3 sm:p-4
                                                       animate-[imgFade_0.25s_ease]
                                                       transition-transform duration-500
                                                       group-hover:scale-105" />
                                        : <div className="w-full h-full flex items-center justify-center text-6xl" aria-hidden="true">🎁</div>}

                                    {/* Zoom hint */}
                                    <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex items-center gap-1.5
                                                    bg-white/90 backdrop-blur-sm rounded-xl px-2.5 py-1.5
                                                    text-[10px] font-bold text-neutral-600 border border-neutral-100
                                                    opacity-0 group-hover:opacity-100 sm:transition-opacity duration-200
                                                    max-sm:opacity-100">
                                        <FaSearchPlus size={10} /> ZOOM
                                    </div>
                                </div>

                                {/* Thumbnails */}
                                {allImages.length > 1 && (
                                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 thumb-scroll
                                                    max-w-[320px] xs:max-w-[360px] sm:max-w-[420px] mx-auto">
                                        {allImages.map((img, i) => (
                                            <button key={i} onClick={() => setActiveImg(i)}
                                                aria-label={`View image ${i + 1} of ${allImages.length}`}
                                                className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden
                                                            border-2 transition-all duration-150
                                                            ${activeImg === i
                                                        ? "border-[var(--accent-primary)] shadow-[0_0_0_3px_var(--focus-ring)]"
                                                        : "border-neutral-200/70 hover:border-neutral-300"}`}>
                                                <img src={imgUrl.card(img.url)} alt={`${product.name} ${i + 1}`}
                                                    className="w-full h-full object-cover" loading="lazy" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ══ RIGHT — Product Info (scrolls with the page; the old
                                inner overflow-y-auto scrollbar was awkward UX) ══ */}
                            <div className="p-4 sm:p-6 flex flex-col gap-0">

                                {/* Category */}
                                {product.category && (
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                                        {product.category.replace(/-/g, " ")}
                                    </p>
                                )}

                                {/* Product name — Manrope via global heading rule */}
                                <h1 className="text-[20px] xs:text-[22px] sm:text-[26px] lg:text-[30px] font-bold text-neutral-900
                                               leading-[1.2] mb-3 tracking-[-0.015em] break-words">
                                    {product.name}
                                </h1>

                                {/* Rating row */}
                                <div className="flex items-center gap-2.5 flex-wrap mb-4 pb-4 border-b border-neutral-200/60">
                                    <div className="flex items-center gap-1.5 bg-[var(--icon-success)] text-white
                                                    px-2.5 py-1 rounded-lg">
                                        <span className="text-[13px] font-bold">{avgRating.toFixed(1)}</span>
                                        <FaStar size={10} />
                                    </div>
                                    <span className="text-sm text-neutral-600 font-medium">
                                        {reviews.length} Ratings &amp; Reviews
                                    </span>
                                    {product.brand && (
                                        <span className="ml-auto text-[11px] font-semibold text-neutral-500
                                                         bg-neutral-50 border border-neutral-200/70
                                                         px-2.5 py-1 rounded-lg">
                                            {product.brand}
                                        </span>
                                    )}
                                </div>

                                {/* Price block */}
                                <div className="mb-4">
                                    <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-1">
                                        <span className="text-[26px] sm:text-[30px] font-extrabold text-neutral-900 leading-none tracking-[-0.01em] transition-all duration-200">
                                            ₹{displayPrice.toLocaleString("en-IN")}
                                        </span>
                                        {hasDiscount && (
                                            <>
                                                <span className="text-sm sm:text-base text-neutral-400 line-through">
                                                    ₹{Number(displayMrp).toLocaleString("en-IN")}
                                                </span>
                                                <span className="text-sm sm:text-lg font-bold text-success">
                                                    {discountPct}% off
                                                </span>
                                            </>
                                        )}
                                        {activeVariant?.price != null && Number(activeVariant.price) > 0
                                            && Number(activeVariant.price) !== Number(product.price) && (
                                                <span className="text-[10px] font-bold text-accent
                                                                 bg-accent-tint
                                                                 px-2 py-0.5 rounded-md">
                                                    {activeVariant.name} price
                                                </span>
                                            )}
                                    </div>
                                    <p className="text-xs text-neutral-400">Inclusive of all taxes</p>
                                    {hasDiscount && savedAmount > 0 && (
                                        <div className="mt-2 inline-flex items-center gap-1.5
                                                        bg-success-tint
                                                        text-success text-[12px] font-semibold
                                                        px-3 py-1.5 rounded-lg">
                                            <FaCheckCircle size={11} /> You save ₹{savedAmount.toLocaleString("en-IN")}
                                        </div>
                                    )}
                                </div>

                                {/* Delivery */}
                                <div className="mb-4 pb-4 border-b border-neutral-100">
                                    <DeliveryEstimate productPrice={displayPrice} productWeight={product.weight || 500} />
                                </div>

                                {/* Stock indicator */}
                                <div className="flex items-center gap-2 mb-4 flex-wrap">
                                    {variantInStock ? (
                                        <>
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-[var(--icon-success)] animate-pulse" />
                                                <span className="text-[13px] font-semibold text-success">In Stock</span>
                                            </div>
                                            {variantStock > 0 && variantStock <= 10 && (
                                                <span className="text-xs font-semibold text-error
                                                                 bg-error-tint
                                                                 px-2.5 py-1 rounded-lg">
                                                    Only {variantStock} left!
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-[var(--icon-error)]" />
                                            <span className="text-[13px] font-semibold text-error">Out of Stock</span>
                                            {selectedColor && (
                                                <span className="text-xs text-neutral-400">for {selectedColor}</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ── Sizes ── */}
                                {normalizedSizes.length > 0 && (
                                    <div className="mb-5">
                                        <div className="flex items-center justify-between mb-2.5 gap-2">
                                            <p className="text-sm font-semibold text-neutral-800">
                                                Size{selectedSize ? `: ${selectedSize}` : ""}
                                            </p>
                                            <button className="text-xs font-semibold text-accent hover:text-[var(--accent-primary-hover)] transition-colors duration-200 shrink-0">
                                                Size Guide
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {normalizedSizes.map(({ size, stock }) => {
                                                const isOos = stock === 0;
                                                return (
                                                    <button key={size} disabled={isOos}
                                                        onClick={() => !isOos && setSelectedSize(size)}
                                                        aria-pressed={selectedSize === size}
                                                        className={`min-w-[44px] h-10 px-3 rounded-xl text-[12px] font-semibold
                                                                    border transition-all duration-200 focus-ring-accent
                                                                    ${isOos
                                                                ? "border-neutral-200/70 text-neutral-300 cursor-not-allowed line-through"
                                                                : selectedSize === size
                                                                    ? "border-[var(--accent-primary)] bg-accent text-white shadow-[0_1px_2px_rgba(20,21,26,.08)]"
                                                                    : "border-neutral-300 text-neutral-700 hover:border-neutral-400 bg-white"}`}>
                                                        {size}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {!selectedSize && (
                                            <p className="text-xs text-error font-semibold mt-2" role="alert">
                                                Please select a size to continue
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ── Color Variants ── */}
                                {product.colorVariants?.length > 0 && (
                                    <div className="mb-5">
                                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                                            <p className="text-sm font-semibold text-neutral-800">Color</p>
                                            {selectedColor && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {activeVariant?.hex && (
                                                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-200 inline-block shrink-0"
                                                            style={{ background: activeVariant.hex }} />
                                                    )}
                                                    <span className="text-sm font-semibold text-neutral-800">: {selectedColor}</span>
                                                    {activeVariant?.price != null && Number(activeVariant.price) > 0
                                                        && Number(activeVariant.price) !== Number(product.price) && (
                                                            <span className="text-[11px] font-bold text-success
                                                                             bg-success-tint
                                                                             px-2 py-0.5 rounded-md">
                                                                ₹{Number(activeVariant.price).toLocaleString("en-IN")}
                                                            </span>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 sm:gap-2.5">
                                            {product.colorVariants.map((variant, idx) => {
                                                const cName = variant.name || variant.color || `Color ${idx + 1}`;
                                                const thumb = variant.images?.[0]?.url;
                                                const isSelected = selectedColor === cName;
                                                const vStock = variant.stock ?? 0;
                                                const isVarOos = vStock === 0;
                                                return (
                                                    <button key={idx}
                                                        onClick={() => !isVarOos && setSelectedColor(cName)}
                                                        disabled={isVarOos}
                                                        aria-pressed={isSelected}
                                                        title={`${cName}${isVarOos ? " — Out of Stock" : ` (${vStock} left)`}`}
                                                        className={`relative flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl
                                                                    border transition-all duration-200 text-left min-h-[46px] focus-ring-accent
                                                                    ${isVarOos ? "opacity-40 cursor-not-allowed border-neutral-200/70 bg-white"
                                                                : isSelected
                                                                    ? "border-[var(--accent-primary)] bg-accent-tint shadow-[0_0_0_3px_var(--focus-ring)]"
                                                                    : "border-neutral-300 bg-white hover:border-neutral-400 hover:-translate-y-0.5"}`}>
                                                        {thumb ? (
                                                            <img src={thumb} alt={cName}
                                                                className="w-8 h-8 object-cover rounded-lg border border-neutral-100 shrink-0" loading="lazy" />
                                                        ) : variant.hex ? (
                                                            <span className="w-6 h-6 rounded-full border-2 border-neutral-200 shrink-0 inline-block"
                                                                style={{ background: variant.hex }} />
                                                        ) : null}
                                                        <div>
                                                            <div className={`text-[12px] font-semibold capitalize
                                                                             ${isSelected ? "text-accent" : "text-neutral-800"}`}>
                                                                {cName}
                                                            </div>
                                                            {variant.price != null && Number(variant.price) > 0
                                                                && Number(variant.price) !== Number(product.price) && (
                                                                    <div className="text-[11px] font-bold text-success">
                                                                        ₹{Number(variant.price).toLocaleString("en-IN")}
                                                                    </div>
                                                                )}
                                                            {isVarOos && (
                                                                <div className="text-[10px] text-error font-semibold">Out of stock</div>
                                                            )}
                                                        </div>
                                                        {isSelected && (
                                                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent
                                                                             text-white rounded-full flex items-center justify-center
                                                                             text-[8px] font-bold border-2 border-white">✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {!selectedColor && (
                                            <p className="text-xs text-error font-semibold mt-2" role="alert">
                                                Please select a color to continue
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ── Customization ── */}
                                {product.isCustomizable && (() => {
                                    const cfg = product.customizationConfig || {};
                                    const allowText = cfg.allowText !== false;
                                    const allowImage = cfg.allowImage !== false;
                                    const allowNote = cfg.allowNote !== false;
                                    const textLabel = cfg.textLabel || "Name / Message";
                                    const textPlaceholder = cfg.textPlaceholder || "e.g. Happy Birthday Rahul! 🎂";
                                    const textMaxLen = cfg.textMaxLength || 100;
                                    const imageLabel = cfg.imageLabel || "Upload Design";
                                    const noteLabel = cfg.noteLabel || "Special Instructions";
                                    const notePlaceholder = cfg.notePlaceholder || "e.g. White background, bold font...";
                                    const extraPrice = cfg.extraPrice || 0;
                                    return (
                                        <div className="border border-neutral-200/70 bg-neutral-50 rounded-xl p-4 mb-6">
                                            <p className="text-[11px] font-bold text-accent uppercase tracking-[0.12em] mb-3 flex items-center gap-1.5">
                                                <FaPencilAlt size={9} /> Personalise Your Order
                                            </p>
                                            {extraPrice > 0 && (
                                                <p className="text-xs font-semibold text-neutral-600 mb-3">
                                                    + ₹{extraPrice.toLocaleString("en-IN")} customization charge
                                                </p>
                                            )}
                                            {allowText && (
                                                <div className="mb-3">
                                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 mb-1.5">
                                                        <FaPencilAlt size={9} /> {textLabel}
                                                    </label>
                                                    <input type="text" value={customText} maxLength={textMaxLen}
                                                        onChange={e => setCustomText(e.target.value)}
                                                        placeholder={textPlaceholder}
                                                        className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm
                                                                   outline-none bg-white focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all duration-200" />
                                                    {customText && (
                                                        <p className="text-[10px] text-neutral-500 mt-1 text-right">
                                                            {customText.length}/{textMaxLen}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {allowImage && (
                                                <div className="mb-3">
                                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 mb-1.5">
                                                        <FaUpload size={9} /> {imageLabel}
                                                    </label>
                                                    {!customImagePreview ? (
                                                        <label className="flex items-center justify-center gap-2 w-full h-14
                                                                          border-2 border-dashed border-neutral-300 rounded-xl
                                                                          cursor-pointer bg-white hover:border-[var(--accent-primary)] hover:bg-accent-tint transition-colors duration-200">
                                                            {uploadingImage
                                                                ? <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                                                                : <><FaUpload size={12} className="text-accent" />
                                                                    <span className="text-xs text-accent font-semibold">Click to upload</span></>}
                                                            <input type="file" accept="image/*"
                                                                onChange={handleCustomImageChange} className="hidden" />
                                                        </label>
                                                    ) : (
                                                        <div className="relative inline-block">
                                                            <img src={customImagePreview} alt="custom"
                                                                className="w-16 h-16 object-cover rounded-xl border border-neutral-200" />
                                                            <button onClick={removeCustomImage} aria-label="Remove uploaded image"
                                                                className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--icon-error)] text-white
                                                                           rounded-full flex items-center justify-center">
                                                                <FaTimes size={8} />
                                                            </button>
                                                            {customImageUrl && (
                                                                <span className="absolute bottom-1 left-1 bg-[var(--icon-success)] text-white
                                                                                 text-[8px] font-bold px-1 rounded">✓</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {allowNote && (
                                                <div>
                                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 mb-1.5">
                                                        <FaStickyNote size={9} /> {noteLabel}
                                                    </label>
                                                    <textarea value={customNote} onChange={e => setCustomNote(e.target.value)}
                                                        placeholder={notePlaceholder} rows={2}
                                                        className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm
                                                                   outline-none resize-none bg-white focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all duration-200" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ── CTA Buttons — one system: equal height, radius, shadow, hover lift ── */}
                                {variantInStock ? (
                                    <div className="flex gap-3 mb-6">
                                        <button onClick={handleAddToCart}
                                            aria-label={inCart ? "Item is in cart" : "Add to cart"}
                                            className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl
                                                        text-[13px] sm:text-sm font-bold px-2 border
                                                        shadow-[0_1px_2px_rgba(20,21,26,.06)]
                                                        hover:shadow-[var(--shadow-sm)] hover:-translate-y-0.5
                                                        active:scale-[0.98] transition-all duration-200 focus-ring-accent
                                                        ${addedFlash
                                                    ? "bg-[var(--icon-success)] border-transparent text-white"
                                                    : inCart
                                                        ? "bg-success-tint border-[var(--icon-success)] text-success"
                                                        : "bg-white border-[var(--accent-primary)] text-accent hover:bg-accent-tint"}`}>
                                            <FaShoppingCart size={14} className="shrink-0" />
                                            <span className="truncate">{inCart ? "In Cart ✓" : addedFlash ? "Added ✓" : "Add to Cart"}</span>
                                        </button>
                                        <button onClick={handleBuyNow}
                                            aria-label="Buy now"
                                            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl
                                                       bg-accent border border-transparent
                                                       text-white text-[13px] sm:text-sm font-bold px-2
                                                       shadow-[0_1px_2px_rgba(20,21,26,.06)]
                                                       hover:bg-accent-hover hover:shadow-[var(--shadow-sm)] hover:-translate-y-0.5
                                                       active:scale-[0.98] transition-all duration-200 focus-ring-accent">
                                            <FaBolt size={13} className="shrink-0" /> <span className="truncate">Buy Now</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mb-6">
                                        <div className="flex gap-3 mb-3">
                                            <button disabled
                                                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl
                                                           bg-neutral-100 text-neutral-400 text-[13px] sm:text-sm font-bold cursor-not-allowed px-2">
                                                <FaShoppingCart size={14} /> <span className="truncate">Add to Cart</span>
                                            </button>
                                            <button disabled
                                                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl
                                                           bg-neutral-100 text-neutral-400 text-[13px] sm:text-sm font-bold cursor-not-allowed px-2">
                                                <FaBolt size={13} /> <span className="truncate">Buy Now</span>
                                            </button>
                                        </div>

                                        {notifySuccess ? (
                                            <div className="flex items-center gap-3 bg-success-tint
                                                            rounded-xl p-4">
                                                <FaCheckCircle className="text-[var(--icon-success)] shrink-0" size={16} />
                                                <div>
                                                    <p className="font-bold text-success text-sm">You're on the list!</p>
                                                    <p className="text-xs text-success mt-0.5 break-words">
                                                        We'll notify {notifyEmail} when back in stock.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border border-neutral-200/70 rounded-xl p-4 bg-neutral-50">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-8 h-8 rounded-lg bg-accent-tint flex items-center justify-center shrink-0">
                                                        <FaBell size={13} className="text-accent" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-neutral-900">Notify When Available</p>
                                                        <p className="text-xs text-neutral-500">Get an email when back in stock</p>
                                                    </div>
                                                </div>
                                                {showNotifyInput ? (
                                                    <div className="flex flex-col xs:flex-row gap-2">
                                                        <input type="email" value={notifyEmail}
                                                            onChange={e => { setNotifyEmail(e.target.value); setNotifyError(""); }}
                                                            placeholder="your@email.com"
                                                            aria-label="Email for stock notification"
                                                            className="flex-1 min-w-0 px-3 py-2.5 border border-neutral-300 rounded-xl
                                                                       text-sm outline-none bg-white
                                                                       focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all duration-200" />
                                                        <button onClick={handleNotifyMe} disabled={notifySubmitting}
                                                            className="px-4 py-2.5 xs:py-0 bg-accent hover:bg-accent-hover text-white
                                                                       rounded-xl font-bold text-sm disabled:opacity-60 transition-colors duration-200 whitespace-nowrap focus-ring-accent">
                                                            {notifySubmitting ? "…" : "Notify Me"}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setShowNotifyInput(true)}
                                                        className="w-full py-2.5 border border-[var(--accent-primary)] text-accent bg-white
                                                                   rounded-xl font-bold text-sm flex items-center justify-center gap-2
                                                                   hover:bg-accent-tint transition-colors duration-200 focus-ring-accent">
                                                        <FaBell size={12} /> Notify Me
                                                    </button>
                                                )}
                                                {notifyError && (
                                                    <p className="text-xs text-error mt-2" role="alert">{notifyError}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Trust Strip — one quiet tile style, semantic icon colors ── */}
                                <div className="grid grid-cols-2 gap-2 mb-6">
                                    {[
                                        { icon: <FaShieldAlt size={13} className="text-[var(--icon-success)]" />, label: "Secure Checkout", sub: "100% encrypted" },
                                        { icon: <FaTruck size={13} className="text-accent" />, label: "Free Delivery", sub: "Orders above ₹499" },
                                        { icon: <FaUndo size={13} className="text-[var(--icon-warning)]" />, label: `${product.returnWindow || 7}-Day Returns`, sub: product.isReplaceable ? "Replacement available" : "Easy returns" },
                                        { icon: <FaTag size={13} className="text-[var(--icon-info)]" />, label: "Best Price", sub: "Verified & authentic" },
                                    ].map(({ icon, label, sub }) => (
                                        <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl border border-neutral-200/70 bg-neutral-50">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200/70 flex items-center justify-center shrink-0">{icon}</div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold text-neutral-800 truncate">{label}</p>
                                                <p className="text-[10px] text-neutral-500 truncate">{sub}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Accordions ── */}
                                <Accordion title="Product Details" icon={<FaTag size={12} className="text-neutral-400" />} defaultOpen>
                                    {product.description || "No details available."}
                                </Accordion>
                                <Accordion title="Delivery & Return Policy" icon={<FaTruck size={12} className="text-neutral-400" />}>
                                    <div className="flex flex-col gap-1.5">
                                        <p>• Free delivery on orders above ₹499</p>
                                        <p>• Standard delivery: 4–7 business days</p>
                                        {product.isReturnable !== false
                                            ? <p>• {product.returnWindow || 7}-day return policy</p>
                                            : <p className="text-error">• Non-returnable{product.nonReturnableReason ? ` — ${product.nonReturnableReason}` : ""}</p>}
                                        {product.isCancellable !== false
                                            ? <p>• Cancellable {product.cancelWindow > 0 ? `within ${product.cancelWindow} hours` : "before packing"}</p>
                                            : <p className="text-error">• Non-cancellable product</p>}
                                    </div>
                                </Accordion>
                            </div>
                        </div>
                    </div>

                    {/* ══ Tabs Card ══ */}
                    <div className="bg-white rounded-2xl shadow-[var(--shadow-xs)] border border-neutral-200/60 overflow-hidden mb-4">
                        {/* Tab bar */}
                        <div className="flex border-b border-neutral-100 overflow-x-auto">
                            {[
                                { key: "description", label: "Description" },
                                ...(highlightEntries.length > 0 ? [{ key: "highlights", label: "Specifications" }] : []),
                                { key: "reviews", label: `Reviews (${reviews.length})` },
                            ].map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    aria-selected={activeTab === tab.key}
                                    className={`px-4 sm:px-5 py-3 sm:py-3.5 text-[13px] sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-150 shrink-0
                                                ${activeTab === tab.key
                                            ? "border-[var(--accent-primary)] text-accent"
                                            : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 sm:p-7">
                            {/* Description */}
                            {activeTab === "description" && (
                                <div className="max-w-2xl">
                                    {product.description
                                        ? <p className="text-sm sm:text-[15px] text-neutral-700 leading-[1.75] break-words">{product.description}</p>
                                        : <p className="text-sm text-neutral-400 italic">No description available.</p>}
                                </div>
                            )}

                            {/* Specifications */}
                            {activeTab === "highlights" && highlightEntries.length > 0 && (
                                <div className="max-w-xl overflow-hidden rounded-xl border border-neutral-100">
                                    {highlightEntries.map(([k, v], i) => (
                                        <div key={k} className={`flex text-sm sm:text-[15px] ${i % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
                                            <div className="w-2/5 px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-neutral-500 border-r border-neutral-100 break-words">
                                                {k}
                                            </div>
                                            <div className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-neutral-800 break-words">{v}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reviews */}
                            {activeTab === "reviews" && (
                                <div className="max-w-2xl">
                                    {reviews.length > 0 && (
                                        <div className="flex gap-6 sm:gap-8 mb-7 pb-7 border-b border-neutral-100 flex-wrap">
                                            <div className="text-center shrink-0">
                                                <p className="text-[2.5rem] sm:text-[3rem] font-bold text-neutral-900 leading-none">{avgRating.toFixed(1)}</p>
                                                <StarRow value={Math.round(avgRating)} size={14} />
                                                <p className="text-xs text-neutral-400 mt-1.5">{reviews.length} ratings</p>
                                            </div>
                                            <div className="flex-1 flex flex-col gap-2 justify-center min-w-[160px]">
                                                {ratingBars.map(b => <RatingBar key={b.star} {...b} />)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Write review */}
                                    {user ? (
                                        <form onSubmit={handleSubmitReview} className="mb-7 pb-7 border-b border-neutral-100">
                                            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                                                Write a Review
                                            </p>
                                            <div className="flex gap-1 mb-3">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <button key={s} type="button" onClick={() => setMyRating(s)}
                                                        aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
                                                        className="text-[24px] sm:text-[26px] bg-none border-none cursor-pointer p-0.5 transition-transform hover:scale-110">
                                                        {s <= myRating
                                                            ? <FaStar className="text-amber-400" />
                                                            : <FaRegStar className="text-neutral-300" />}
                                                    </button>
                                                ))}
                                            </div>
                                            <textarea value={myComment} onChange={e => setMyComment(e.target.value)}
                                                rows={3} placeholder="Share your experience…"
                                                className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm
                                                           outline-none resize-none bg-white
                                                           focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all duration-200 mb-3" />
                                            {reviewError && (
                                                <p className="text-error text-xs mb-2" role="alert">{reviewError}</p>
                                            )}
                                            {reviewSuccess && (
                                                <p className="text-success text-xs mb-2 flex items-center gap-1" role="status">
                                                    <FaCheckCircle size={10} /> Review submitted!
                                                </p>
                                            )}
                                            <button type="submit" disabled={submitting}
                                                className="w-full xs:w-auto h-11 px-6 bg-accent hover:bg-accent-hover text-white
                                                           rounded-xl font-bold text-sm disabled:opacity-60 transition-colors duration-200 focus-ring-accent">
                                                {submitting ? "Submitting…" : "Submit Review"}
                                            </button>
                                        </form>
                                    ) : (
                                        <button onClick={() => navigate("/login")}
                                            className="mb-6 w-full xs:w-auto h-11 px-6 border border-[var(--accent-primary)] text-accent bg-white
                                                       rounded-xl font-bold text-sm hover:bg-accent-tint transition-colors duration-200 focus-ring-accent">
                                            Login to Write a Review
                                        </button>
                                    )}

                                    {/* Review list */}
                                    {reviews.length === 0 ? (
                                        <div className="text-center py-10 border-2 border-dashed border-neutral-100 rounded-2xl">
                                            <p className="text-neutral-400 text-sm">No reviews yet. Be the first!</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {reviews.map(r => {
                                                const isOwn = user && (r.user === user._id || r.user?._id === user._id);
                                                return (
                                                    <div key={r._id}
                                                        className="border border-neutral-100 rounded-2xl p-3.5 sm:p-4 bg-neutral-50/50">
                                                        <div className="flex justify-between items-start gap-2 mb-2">
                                                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                                <div className="w-9 h-9 rounded-full bg-accent-tint
                                                                                text-accent flex items-center justify-center
                                                                                text-sm font-bold shrink-0">
                                                                    {r.name?.[0]?.toUpperCase() || "U"}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-sm text-neutral-900 truncate">{r.name}</p>
                                                                    <StarRow value={r.rating} size={10} />
                                                                </div>
                                                            </div>
                                                            {isOwn && (
                                                                <button onClick={() => handleDeleteReview(r._id)}
                                                                    aria-label="Delete your review"
                                                                    className="text-neutral-300 hover:text-error transition-colors duration-200 p-1 shrink-0">
                                                                    <FaTrash size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {r.comment && (
                                                            <p className="text-sm text-neutral-700 leading-[1.7] mt-2 break-words">{r.comment}</p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ══ Related Products ══ */}
                    {relatedProducts.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-[var(--shadow-xs)] border border-neutral-200/60 p-4 sm:p-6">
                            <div className="mb-4">
                                <p className="text-[10px] font-bold text-accent uppercase tracking-[0.14em] mb-1.5 pl-2.5 border-l-2 border-[var(--accent-primary)] leading-none">
                                    Recommended For You
                                </p>
                                <h2 className="text-lg sm:text-[22px] font-bold text-neutral-900 tracking-tight">
                                    Similar Products
                                </h2>
                                <p className="text-xs text-neutral-400 mt-0.5">Customers also viewed these products</p>
                            </div>
                            {/* Same card widths as Home's horizontal rows (New Arrivals etc.)
                                so the global card renders at identical proportions here. */}
                            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 related-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
                                {relatedProducts.map(rp => (
                                    <div key={rp._id} className="shrink-0 w-[180px] min-w-[180px] sm:w-[190px] sm:min-w-[190px] lg:w-[220px] lg:min-w-[220px]">
                                        <ProductCard product={rp} hideActions />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mobile bottom spacer */}
                    <div className="h-20 sm:h-0" />
                </div>
            </div>

            {/* Lazy-loaded modals — code is only downloaded when opened */}
            <Suspense fallback={null}>
                {imgZoomed && <ZoomModal src={heroUrl} alt={product.name} onClose={() => setImgZoomed(false)} />}
            </Suspense>
            <Suspense fallback={null}>
                {shareOpen && <ShareModal product={product} onClose={() => setShareOpen(false)} />}
            </Suspense>
        </>
    );
};

export default ProductDetails;