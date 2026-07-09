/**
 * ProductDetails.jsx — v3 Premium Tailwind Rewrite
 * ─ Zero inline styles (except dynamic values like hex colors)
 * ─ Inter / system font · clean card layout · sticky sidebar
 * ─ All business logic 100% preserved
 */
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import api from "../api/axios";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../contexts/AuthContext";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import { imgUrl } from "../utils/imageUrl";
import SEO, { JsonLd } from "../components/SEO";
import DeliveryEstimate from "../components/DeliveryEstimate";
import {
    FaStar, FaRegStar, FaShoppingCart, FaBolt,
    FaTrash, FaCheckCircle, FaArrowLeft,
    FaUpload, FaTimes, FaPencilAlt, FaStickyNote,
    FaBell, FaTag, FaShare, FaWhatsapp,
    FaFacebook, FaInstagram, FaLink, FaTwitter,
    FaSearchPlus, FaChevronDown, FaChevronUp,
    FaShieldAlt, FaTruck, FaUndo, FaTimesCircle,
    FaFire, FaRegBookmark, FaBookmark, FaHeart,
} from "react-icons/fa";

/* ─── Helpers ─── */
const getMrp = (p) => {
    const v = p?.mrp ?? p?.originalPrice ?? p?.comparePrice ?? p?.compareAtPrice ?? null;
    if (!v && v !== 0) return null;
    const n = Number(v);
    return n > 0 ? n : null;
};

/* ─── Star Row ─── */
const StarRow = ({ value, size = 12 }) => (
    <span className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => s <= value
            ? <FaStar key={s} size={size} className="text-amber-400" />
            : <FaRegStar key={s} size={size} className="text-neutral-300" />)}
    </span>
);

/* ─── Rating Bar ─── */
const RatingBar = ({ star, count, pct }) => (
    <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 w-2 shrink-0">{star}</span>
        <FaStar size={9} className="text-amber-400 shrink-0" />
        <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-neutral-400 w-4 text-right shrink-0">{count}</span>
    </div>
);

/* ─── Accordion ─── */
const Accordion = ({ title, icon, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-neutral-100 rounded-xl mb-2 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3.5
                           bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
            >
                <span className="flex items-center gap-2.5 text-sm font-semibold text-neutral-800">
                    {icon}{title}
                </span>
                {open
                    ? <FaChevronUp size={11} className="text-neutral-400" />
                    : <FaChevronDown size={11} className="text-neutral-400" />}
            </button>
            {open && (
                <div className="px-4 pb-4 pt-3 text-sm text-neutral-600 leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
};

/* ─── Share Modal ─── */
const ShareModal = ({ product, onClose }) => {
    const [copied, setCopied] = useState(false);
    const url = window.location.href;
    const text = encodeURIComponent(`${product.name} — ₹${Number(product.price).toLocaleString("en-IN")}`);
    const enc = encodeURIComponent(url);
    const links = [
        { icon: <FaWhatsapp size={22} />, label: "WhatsApp", color: "#25D366", bg: "bg-green-50", href: `https://wa.me/?text=${text}%20${enc}` },
        { icon: <FaFacebook size={22} />, label: "Facebook", color: "#1877F2", bg: "bg-blue-50", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
        { icon: <FaTwitter size={22} />, label: "Twitter", color: "#000", bg: "bg-neutral-100", href: `https://twitter.com/intent/tweet?text=${text}&url=${enc}` },
        { icon: <FaInstagram size={22} />, label: "Instagram", color: "#E1306C", bg: "bg-pink-50", href: `https://www.instagram.com/` },
    ];
    return (
        <div onClick={onClose}
            className="fixed inset-0 z-[99999] bg-black/55 backdrop-blur-sm
                       flex items-start justify-center pt-[8vh] px-4">
            <div onClick={e => e.stopPropagation()}
                className="bg-white w-full max-w-sm rounded-2xl shadow-2xl max-h-[82vh] overflow-y-auto
                           animate-[slideDown_.22s_ease]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                    <span className="font-bold text-[15px] text-neutral-900">Share Product</span>
                    <button onClick={onClose}
                        className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center
                                   hover:bg-neutral-200 transition-colors">
                        <FaTimes size={11} className="text-neutral-500" />
                    </button>
                </div>
                {/* Product preview */}
                <div className="mx-5 my-3 bg-neutral-50 rounded-xl p-3 flex items-center gap-3 border border-neutral-100">
                    <div className="w-12 h-12 rounded-lg bg-white border border-neutral-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {product.images?.[0]?.url
                            ? <img src={imgUrl.detail(product.images[0].url)} alt={product.name}
                                className="w-full h-full object-contain p-1" loading="lazy" />
                            : <span className="text-xl">🎁</span>}
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-[13px] text-neutral-900 truncate">{product.name}</p>
                        <p className="font-bold text-[13px] text-green-600 mt-0.5">
                            ₹{Number(product.price).toLocaleString("en-IN")}
                        </p>
                    </div>
                </div>
                {/* Social links */}
                <div className="grid grid-cols-4 gap-2 px-5 pb-4">
                    {links.map(({ icon, label, color, bg, href }) => (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                            className="flex flex-col items-center gap-1.5 no-underline">
                            <div className={`w-13 h-13 w-[52px] h-[52px] rounded-[14px] ${bg} flex items-center justify-center`}
                                style={{ color }}>
                                {icon}
                            </div>
                            <span className="text-[10px] font-semibold text-neutral-500 text-center">{label}</span>
                        </a>
                    ))}
                </div>
                {/* Copy link */}
                <div className="mx-5 mb-5 flex items-center gap-2 bg-neutral-50 rounded-xl px-3 py-2.5 border border-neutral-100">
                    <span className="text-xs text-neutral-400 flex-1 truncate">{url}</span>
                    <button
                        onClick={async () => {
                            try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
                        }}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                    ${copied ? "bg-green-100 text-green-700" : "bg-orange-500 text-white hover:bg-orange-600"}`}>
                        {copied ? <><FaCheckCircle size={9} /> Copied!</> : <><FaLink size={9} /> Copy</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Zoom Modal ─── */
const ZoomModal = ({ src, alt, onClose }) => {
    useEffect(() => {
        const h = e => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);
    return (
        <div onClick={onClose}
            className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center">
            <button onClick={onClose}
                className="fixed top-4 right-4 w-10 h-10 bg-white/15 border border-white/25
                           rounded-lg flex items-center justify-center hover:bg-white/25 transition-colors">
                <FaTimes size={16} className="text-white" />
            </button>
            <div onClick={e => e.stopPropagation()} className="w-[90vw] h-[85vh] flex items-center justify-center">
                <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
            </div>
        </div>
    );
};

/* ─── Related Card — v3 ─── */
const RelatedCard = ({ rp }) => {
    const mrp = getMrp(rp);
    const price = Number(rp.price || 0);
    const hasDisc = mrp && mrp > price;
    const discPct = hasDisc ? Math.round(((mrp - price) / mrp) * 100) : null;
    const rating = rp.avgRating || rp.rating || 0;
    const numReviews = Number(rp.numReviews || 0);
    let stockNum = 0;
    if (rp.sizes?.length > 0) stockNum = rp.sizes.reduce((s, x) => s + (Number(x.stock) || 0), 0);
    else if (rp.colorVariants?.length > 0) stockNum = rp.colorVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    else stockNum = rp.inStock === true ? 10 : Number(rp.stock || 0);
    const isOOS = rp.inStock === false || stockNum <= 0;

    return (
        <Link to={`/products/${rp._id}`}
            className="no-underline shrink-0 flex flex-col bg-white rounded-2xl border border-neutral-100
                       overflow-hidden transition-all duration-250 shadow-sm
                       hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:-translate-y-1
                       w-[160px] sm:w-[180px]">
            {/* Image */}
            <div className="relative w-full aspect-square bg-neutral-50 overflow-hidden">
                {rp.images?.[0]?.url
                    ? <img src={imgUrl.card(rp.images[0].url)} alt={rp.name} loading="lazy"
                        className="w-full h-full object-contain p-3 transition-transform duration-300 hover:scale-105" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl">🎁</div>}
                {discPct && (
                    <span className="absolute top-2 left-2 bg-orange-500 text-white
                                     text-[10px] font-black px-1.5 py-0.5 rounded-lg">
                        {discPct}%
                    </span>
                )}
                {isOOS && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">Out of Stock</span>
                    </div>
                )}
            </div>
            {/* Body */}
            <div className="p-3 flex flex-col gap-1.5 flex-1">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider truncate">
                    {rp.category?.name || "Product"}
                </p>
                <p className="text-[12px] font-medium text-neutral-800 leading-snug line-clamp-2">
                    {rp.name}
                </p>
                {rating > 0 && (
                    <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 bg-green-600 text-white
                                         text-[10px] font-bold px-1.5 py-0.5 rounded">
                            <FaStar size={8} /> {rating.toFixed(1)}
                        </span>
                        {numReviews > 0 && (
                            <span className="text-[10px] text-neutral-400">({numReviews.toLocaleString()})</span>
                        )}
                    </div>
                )}
                <div className="mt-auto pt-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[14px] font-bold text-neutral-900">
                            ₹{price.toLocaleString("en-IN")}
                        </span>
                        {hasDisc && (
                            <span className="text-[11px] text-neutral-400 line-through">
                                ₹{mrp.toLocaleString("en-IN")}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-green-700
                                    bg-green-50 border border-green-100 rounded-lg px-2 py-1 w-fit">
                        <FaTruck size={8} /> Free Delivery
                    </div>
                </div>
            </div>
        </Link>
    );
};

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
    const fetchReviews = useCallback(async (pid) => {
        try { const { data } = await api.get(`/reviews/${pid}`); setReviews(data); } catch { }
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
                const { data: prod } = await api.get(`/products/${id}`, { signal: ctrl.signal });
                setProduct(prod);
                if (prod?.colorVariants?.length > 0) {
                    const def = prod.colorVariants.find(v => v.isDefault) || prod.colorVariants[0];
                    if (def?.name) setSelectedColor(def.name);
                }
                trackView(prod);
                const { data: related } = await api.get(`/products/${prod._id}/related`, { signal: ctrl.signal });
                setRelatedProducts(related);
                await fetchReviews(prod._id);
            } catch (err) {
                if (err.name !== "AbortError") setError("Failed to load product.");
            } finally { setLoading(false); }
        })();
        return () => ctrl.abort();
    }, [id, fetchReviews]);

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
        if (file.size / 1024 / 1024 > 5) return alert("Max 5MB");
        setCustomImagePreview(URL.createObjectURL(file));
        try {
            setUploadingImage(true);
            const fd = new FormData(); fd.append("image", file);
            const { data } = await api.post("/uploads/custom-image", fd);
            setCustomImageUrl(data.url);
        } catch { alert("Upload failed."); setCustomImagePreview(""); }
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

        if (normalizedSizes.length > 0 && !selectedSize) return alert("Please select a size!");
        if (product?.colorVariants?.length > 0 && !selectedColor) return alert("Please select a color!");
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
    }, [product, selectedSize, selectedColor, normalizedSizes, addItem, getCustomization, displayPrice, displayMrp, activeVariant]);

    const handleBuyNow = useCallback(() => {
        if (normalizedSizes.length > 0 && !selectedSize) return alert("Please select a size!");
        if (product?.colorVariants?.length > 0 && !selectedColor) return alert("Please select a color!");
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
        try { sessionStorage.setItem("ux_buy_now_item", JSON.stringify(buyNowItem)); } catch { }
        navigate("/checkout", { state: { buyNowItem } });
    }, [product, selectedSize, selectedColor, normalizedSizes, navigate, getCustomization, displayPrice, displayMrp, activeVariant]);

    const handleNotifyMe = useCallback(async () => {
        if (!notifyEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
            setNotifyError("Enter a valid email"); return;
        }
        try {
            setNotifySubmitting(true); setNotifyError("");
            await api.post("/stock-notify/subscribe", { productId: product._id, email: notifyEmail.trim() });
            setNotifySuccess(true); setShowNotifyInput(false);
            try { localStorage.setItem(`notify_${product._id}`, "1"); } catch { }
        } catch (err) { setNotifyError(err.response?.data?.message || "Something went wrong."); }
        finally { setNotifySubmitting(false); }
    }, [notifyEmail, product?._id]);

    const handleSubmitReview = useCallback(async (e) => {
        e.preventDefault();
        if (!myRating) return setReviewError("Select a rating first");
        try {
            setSubmitting(true); setReviewError("");
            await api.post(`/reviews/${product._id}`, { rating: myRating, comment: myComment });
            setReviewSuccess(true);
            await fetchReviews(product._id);
            const { data } = await api.get(`/products/${id}`);
            setProduct(data);
            setTimeout(() => setReviewSuccess(false), 2500);
        } catch (err) { setReviewError(err.response?.data?.message || "Failed to submit"); }
        finally { setSubmitting(false); }
    }, [myRating, myComment, product?._id, fetchReviews, id]);

    const handleDeleteReview = useCallback(async (rid) => {
        try {
            await api.delete(`/reviews/${rid}`);
            await fetchReviews(product._id);
            setMyRating(0); setMyComment("");
        } catch { }
    }, [product?._id, fetchReviews]);

    /* ── Loading ── */
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
            <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 rounded-full border-[3px] border-orange-500 border-t-transparent animate-spin" />
                <p className="text-neutral-400 text-sm">Loading product…</p>
            </div>
        </div>
    );

    if (!product || error) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-neutral-50">
            <p className="text-neutral-500 text-sm">{error || "Product not found"}</p>
            <button onClick={() => navigate("/")}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors">
                Go Home
            </button>
        </div>
    );

    const heroUrl = imgUrl.detail(allImages[activeImg]?.url || "");

    return (
        <>
            {product && (
                <>
                    <SEO title={product.name}
                        description={product.description?.slice(0, 160) || `Buy ${product.name} at best price on Urbexon.`}
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
                @keyframes slideDown { from{opacity:0;transform:translateY(-14px)} to{opacity:1;transform:translateY(0)} }
                @keyframes spin { to{transform:rotate(360deg)} }
                .thumb-scroll::-webkit-scrollbar { height:3px }
                .thumb-scroll::-webkit-scrollbar-thumb { background:#e5e5e5; border-radius:4px }
                .related-scroll::-webkit-scrollbar { height:4px }
                .related-scroll::-webkit-scrollbar-thumb { background:#e5e5e5; border-radius:4px }
            `}</style>

            <div className="bg-neutral-50 min-h-screen overflow-x-hidden"
                style={{ fontFamily: "'Inter','-apple-system','BlinkMacSystemFont','Segoe UI',sans-serif" }}>

                {/* ── Breadcrumb bar ── */}
                <div className="bg-white border-b border-neutral-100 px-4 py-2.5 sticky top-0 z-30">
                    <div className="max-w-6xl mx-auto flex items-center gap-2">
                        <button onClick={() => navigate(-1)}
                            className="flex items-center gap-1.5 text-orange-500 hover:text-orange-600
                                       text-sm font-semibold transition-colors bg-orange-50
                                       hover:bg-orange-100 px-3 py-1.5 rounded-lg">
                            <FaArrowLeft size={11} /> Back
                        </button>
                        {product.category && (
                            <span className="text-xs text-neutral-400 capitalize hidden sm:block">
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
                    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden mb-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

                            {/* ══ LEFT — Image Gallery ══ */}
                            <div className="border-b lg:border-b-0 lg:border-r border-neutral-100 p-4 sm:p-6">

                                {/* Hero image */}
                                <div className="relative aspect-square w-full max-w-[420px] mx-auto
                                                rounded-2xl overflow-hidden bg-neutral-50 cursor-zoom-in
                                                group border border-neutral-100"
                                    onClick={() => !shareOpen && setImgZoomed(true)}>

                                    {/* Badges */}
                                    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
                                        {product.isCustomizable && (
                                            <span className="bg-green-600 text-white text-[9px] font-black
                                                             px-2 py-0.5 rounded-md tracking-wide">✏ CUSTOM</span>
                                        )}
                                        {!variantInStock && (
                                            <span className="bg-neutral-800 text-white text-[9px] font-black
                                                             px-2 py-0.5 rounded-md">SOLD OUT</span>
                                        )}
                                        {hasDiscount && (
                                            <span className="bg-orange-500 text-white text-[10px] font-black
                                                             px-2 py-1 rounded-lg flex flex-col items-center leading-none">
                                                <span>{discountPct}%</span>
                                                <span className="text-[7px] opacity-80">OFF</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Share button */}
                                    <button
                                        onClick={e => { e.stopPropagation(); setShareOpen(true); }}
                                        className="absolute top-3 right-3 z-10 flex items-center gap-1.5
                                                   bg-white/90 backdrop-blur-sm border border-neutral-100
                                                   rounded-xl px-3 py-1.5 text-[11px] font-semibold text-neutral-600
                                                   shadow-sm hover:bg-white hover:shadow-md transition-all">
                                        <FaShare size={10} /> Share
                                    </button>

                                    {/* Main image */}
                                    {heroUrl
                                        ? <img src={heroUrl} alt={product.name} loading="eager"
                                            className="w-full h-full object-contain p-4
                                                       transition-transform duration-500
                                                       group-hover:scale-105" />
                                        : <div className="w-full h-full flex items-center justify-center text-6xl">🎁</div>}

                                    {/* Zoom hint */}
                                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5
                                                    bg-white/90 backdrop-blur-sm rounded-xl px-2.5 py-1.5
                                                    text-[10px] font-bold text-neutral-600 border border-neutral-100
                                                    opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <FaSearchPlus size={10} /> ZOOM
                                    </div>
                                </div>

                                {/* Thumbnails */}
                                {allImages.length > 1 && (
                                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 thumb-scroll">
                                        {allImages.map((img, i) => (
                                            <button key={i} onClick={() => setActiveImg(i)}
                                                className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden
                                                            border-2 transition-all duration-150
                                                            ${activeImg === i
                                                        ? "border-orange-400 shadow-[0_0_0_2px_rgba(249,115,22,0.2)]"
                                                        : "border-neutral-100 hover:border-neutral-300"}`}>
                                                <img src={imgUrl.card(img.url)} alt={`${product.name} ${i + 1}`}
                                                    className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ══ RIGHT — Product Info ══ */}
                            <div className="p-4 sm:p-6 flex flex-col gap-0 overflow-y-auto lg:max-h-[90vh]">

                                {/* Category */}
                                {product.category && (
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                                        {product.category.replace(/-/g, " ")}
                                    </p>
                                )}

                                {/* Product name */}
                                <h1 className="text-[1.2rem] sm:text-[1.35rem] font-semibold text-neutral-900
                                               leading-snug mb-3 tracking-tight">
                                    {product.name}
                                </h1>

                                {/* Rating row */}
                                <div className="flex items-center gap-2.5 flex-wrap mb-4 pb-4 border-b border-neutral-100">
                                    <div className="flex items-center gap-1.5 bg-green-600 text-white
                                                    px-2.5 py-1 rounded-lg">
                                        <span className="text-[13px] font-bold">{avgRating.toFixed(1)}</span>
                                        <FaStar size={10} />
                                    </div>
                                    <span className="text-sm text-neutral-500">
                                        {reviews.length} Ratings & Reviews
                                    </span>
                                    {product.brand && (
                                        <span className="ml-auto text-[11px] font-semibold text-neutral-400
                                                         bg-neutral-50 border border-neutral-100
                                                         px-2.5 py-1 rounded-lg">
                                            {product.brand}
                                        </span>
                                    )}
                                </div>

                                {/* Price block */}
                                <div className="mb-4">
                                    <div className="flex flex-wrap items-baseline gap-2.5 mb-1">
                                        <span className="text-[2rem] font-bold text-neutral-900 leading-none tracking-tight transition-all duration-200">
                                            ₹{displayPrice.toLocaleString("en-IN")}
                                        </span>
                                        {hasDiscount && (
                                            <>
                                                <span className="text-base text-neutral-400 line-through">
                                                    ₹{Number(displayMrp).toLocaleString("en-IN")}
                                                </span>
                                                <span className="text-base font-bold text-green-600">
                                                    {discountPct}% off
                                                </span>
                                            </>
                                        )}
                                        {activeVariant?.price != null && Number(activeVariant.price) > 0
                                            && Number(activeVariant.price) !== Number(product.price) && (
                                                <span className="text-[10px] font-bold text-violet-600
                                                                 bg-violet-50 border border-violet-100
                                                                 px-2 py-0.5 rounded-lg">
                                                    {activeVariant.name} price
                                                </span>
                                            )}
                                    </div>
                                    <p className="text-xs text-neutral-400">Inclusive of all taxes</p>
                                    {hasDiscount && savedAmount > 0 && (
                                        <div className="mt-2 inline-flex items-center gap-1.5
                                                        bg-green-50 border border-green-100
                                                        text-green-700 text-[12px] font-semibold
                                                        px-3 py-1.5 rounded-xl">
                                            🎉 You save ₹{savedAmount.toLocaleString("en-IN")}
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
                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                <span className="text-[13px] font-semibold text-green-600">In Stock</span>
                                            </div>
                                            {variantStock > 0 && variantStock <= 10 && (
                                                <span className="text-xs font-semibold text-red-500
                                                                 bg-red-50 border border-red-100
                                                                 px-2.5 py-1 rounded-lg">
                                                    Only {variantStock} left!
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-red-500" />
                                            <span className="text-[13px] font-semibold text-red-500">Out of Stock</span>
                                            {selectedColor && (
                                                <span className="text-xs text-neutral-400">for {selectedColor}</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ── Sizes ── */}
                                {normalizedSizes.length > 0 && (
                                    <div className="mb-5">
                                        <div className="flex items-center justify-between mb-2.5">
                                            <p className="text-sm font-semibold text-neutral-800">
                                                Size{selectedSize ? `: ${selectedSize}` : ""}
                                            </p>
                                            <button className="text-xs font-semibold text-orange-500 hover:text-orange-600">
                                                Size Guide
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {normalizedSizes.map(({ size, stock }) => {
                                                const isOos = stock === 0;
                                                return (
                                                    <button key={size} disabled={isOos}
                                                        onClick={() => !isOos && setSelectedSize(size)}
                                                        className={`min-w-[46px] h-10 px-3 rounded-xl text-[12px] font-semibold
                                                                    border-2 transition-all duration-150
                                                                    ${isOos
                                                                ? "border-neutral-100 text-neutral-300 cursor-not-allowed line-through"
                                                                : selectedSize === size
                                                                    ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                                                                    : "border-neutral-200 text-neutral-700 hover:border-neutral-400 bg-white"}`}>
                                                        {size}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {!selectedSize && (
                                            <p className="text-xs text-red-500 font-semibold mt-2">
                                                ↑ Please select a size to continue
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ── Color Variants ── */}
                                {product.colorVariants?.length > 0 && (
                                    <div className="mb-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <p className="text-sm font-semibold text-neutral-800">Color</p>
                                            {selectedColor && (
                                                <div className="flex items-center gap-1.5">
                                                    {activeVariant?.hex && (
                                                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-200 inline-block shrink-0"
                                                            style={{ background: activeVariant.hex }} />
                                                    )}
                                                    <span className="text-sm font-semibold text-neutral-800">: {selectedColor}</span>
                                                    {activeVariant?.price != null && Number(activeVariant.price) > 0
                                                        && Number(activeVariant.price) !== Number(product.price) && (
                                                            <span className="text-[11px] font-bold text-green-700
                                                                             bg-green-50 border border-green-100
                                                                             px-2 py-0.5 rounded-lg">
                                                                ₹{Number(activeVariant.price).toLocaleString("en-IN")}
                                                            </span>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2.5">
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
                                                        title={`${cName}${isVarOos ? " — Out of Stock" : ` (${vStock} left)`}`}
                                                        className={`relative flex items-center gap-2 px-3 py-2 rounded-xl
                                                                    border-2 transition-all duration-150 text-left min-h-[46px]
                                                                    ${isVarOos ? "opacity-40 cursor-not-allowed border-neutral-100 bg-white"
                                                                : isSelected
                                                                    ? "border-orange-400 bg-orange-50 shadow-[0_0_0_3px_rgba(249,115,22,0.15)]"
                                                                    : "border-neutral-200 bg-white hover:border-neutral-300 hover:-translate-y-0.5"}`}>
                                                        {thumb ? (
                                                            <img src={thumb} alt={cName}
                                                                className="w-8 h-8 object-cover rounded-lg border border-neutral-100 shrink-0" />
                                                        ) : variant.hex ? (
                                                            <span className="w-6 h-6 rounded-full border-2 border-neutral-200 shrink-0 inline-block"
                                                                style={{ background: variant.hex }} />
                                                        ) : null}
                                                        <div>
                                                            <div className={`text-[12px] font-semibold capitalize
                                                                             ${isSelected ? "text-orange-600" : "text-neutral-800"}`}>
                                                                {cName}
                                                            </div>
                                                            {variant.price != null && Number(variant.price) > 0
                                                                && Number(variant.price) !== Number(product.price) && (
                                                                    <div className="text-[11px] font-bold text-green-600">
                                                                        ₹{Number(variant.price).toLocaleString("en-IN")}
                                                                    </div>
                                                                )}
                                                            {isVarOos && (
                                                                <div className="text-[10px] text-red-400 font-semibold">Out of stock</div>
                                                            )}
                                                        </div>
                                                        {isSelected && (
                                                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500
                                                                             text-white rounded-full flex items-center justify-center
                                                                             text-[8px] font-black border-2 border-white">✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {!selectedColor && (
                                            <p className="text-xs text-red-500 font-semibold mt-2">
                                                ↑ Please select a color to continue
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
                                        <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 mb-5">
                                            <p className="text-[11px] font-black text-amber-700 uppercase tracking-wider mb-3">
                                                ✏ Personalise Your Order
                                            </p>
                                            {extraPrice > 0 && (
                                                <p className="text-xs font-semibold text-amber-600 mb-3">
                                                    + ₹{extraPrice.toLocaleString("en-IN")} customization charge
                                                </p>
                                            )}
                                            {allowText && (
                                                <div className="mb-3">
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-1.5">
                                                        <FaPencilAlt size={9} /> {textLabel}
                                                    </label>
                                                    <input type="text" value={customText} maxLength={textMaxLen}
                                                        onChange={e => setCustomText(e.target.value)}
                                                        placeholder={textPlaceholder}
                                                        className="w-full px-3 py-2 border border-amber-200 rounded-xl text-sm
                                                                   outline-none bg-white focus:border-amber-400 transition-colors" />
                                                    {customText && (
                                                        <p className="text-[10px] text-amber-600 mt-1 text-right">
                                                            {customText.length}/{textMaxLen}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {allowImage && (
                                                <div className="mb-3">
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-1.5">
                                                        <FaUpload size={9} /> {imageLabel}
                                                    </label>
                                                    {!customImagePreview ? (
                                                        <label className="flex items-center justify-center gap-2 w-full h-14
                                                                          border-2 border-dashed border-amber-300 rounded-xl
                                                                          cursor-pointer bg-white hover:bg-amber-50 transition-colors">
                                                            {uploadingImage
                                                                ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                                                : <><FaUpload size={12} className="text-amber-500" />
                                                                    <span className="text-xs text-amber-600 font-semibold">Click to upload</span></>}
                                                            <input type="file" accept="image/*"
                                                                onChange={handleCustomImageChange} className="hidden" />
                                                        </label>
                                                    ) : (
                                                        <div className="relative inline-block">
                                                            <img src={customImagePreview} alt="custom"
                                                                className="w-16 h-16 object-cover rounded-xl border border-amber-200" />
                                                            <button onClick={removeCustomImage}
                                                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white
                                                                           rounded-full flex items-center justify-center">
                                                                <FaTimes size={8} />
                                                            </button>
                                                            {customImageUrl && (
                                                                <span className="absolute bottom-1 left-1 bg-green-500 text-white
                                                                                 text-[8px] font-bold px-1 rounded">✓</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {allowNote && (
                                                <div>
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-1.5">
                                                        <FaStickyNote size={9} /> {noteLabel}
                                                    </label>
                                                    <textarea value={customNote} onChange={e => setCustomNote(e.target.value)}
                                                        placeholder={notePlaceholder} rows={2}
                                                        className="w-full px-3 py-2 border border-amber-200 rounded-xl text-sm
                                                                   outline-none resize-none bg-white focus:border-amber-400 transition-colors" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ── CTA Buttons ── */}
                                {variantInStock ? (
                                    <div className="flex gap-3 mb-5">
                                        <button onClick={handleAddToCart}
                                            className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl
                                                        text-sm font-bold transition-all duration-200
                                                        shadow-sm hover:shadow-md active:scale-[0.98]
                                                        ${addedFlash
                                                    ? "bg-green-500 text-white"
                                                    : inCart
                                                        ? "bg-green-50 border-2 border-green-400 text-green-700"
                                                        : "bg-amber-400 hover:bg-amber-500 text-neutral-900"}`}>
                                            <FaShoppingCart size={15} />
                                            {inCart ? "In Cart ✔" : addedFlash ? "Added! ✓" : "Add to Cart"}
                                        </button>
                                        <button onClick={handleBuyNow}
                                            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl
                                                       bg-gradient-to-r from-orange-500 to-rose-500
                                                       text-white text-sm font-bold
                                                       shadow-[0_4px_16px_rgba(249,115,22,0.35)]
                                                       hover:shadow-[0_6px_22px_rgba(249,115,22,0.45)]
                                                       hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200">
                                            <FaBolt size={14} /> Buy Now
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mb-5">
                                        <div className="flex gap-3 mb-3">
                                            <button disabled
                                                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl
                                                           bg-neutral-100 text-neutral-400 text-sm font-bold cursor-not-allowed">
                                                <FaShoppingCart size={15} /> Add to Cart
                                            </button>
                                            <button disabled
                                                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl
                                                           bg-neutral-100 text-neutral-400 text-sm font-bold cursor-not-allowed">
                                                <FaBolt size={14} /> Buy Now
                                            </button>
                                        </div>

                                        {notifySuccess ? (
                                            <div className="flex items-center gap-3 bg-green-50 border border-green-200
                                                            rounded-2xl p-4">
                                                <FaCheckCircle className="text-green-600 shrink-0" size={16} />
                                                <div>
                                                    <p className="font-bold text-green-700 text-sm">You're on the list!</p>
                                                    <p className="text-xs text-green-600 mt-0.5">
                                                        We'll notify {notifyEmail} when back in stock.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                                                        <FaBell size={13} className="text-orange-500" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-neutral-900">Notify When Available</p>
                                                        <p className="text-xs text-neutral-500">Get an email when back in stock</p>
                                                    </div>
                                                </div>
                                                {showNotifyInput ? (
                                                    <div className="flex gap-2">
                                                        <input type="email" value={notifyEmail}
                                                            onChange={e => { setNotifyEmail(e.target.value); setNotifyError(""); }}
                                                            placeholder="your@email.com"
                                                            className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl
                                                                       text-sm outline-none focus:border-orange-400 bg-white" />
                                                        <button onClick={handleNotifyMe} disabled={notifySubmitting}
                                                            className="px-4 bg-orange-500 hover:bg-orange-600 text-white
                                                                       rounded-xl font-bold text-sm disabled:opacity-60 transition-colors whitespace-nowrap">
                                                            {notifySubmitting ? "…" : "Notify Me"}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setShowNotifyInput(true)}
                                                        className="w-full py-2.5 border border-orange-300 text-orange-600 bg-white
                                                                   rounded-xl font-bold text-sm flex items-center justify-center gap-2
                                                                   hover:bg-orange-50 transition-colors">
                                                        <FaBell size={12} /> Notify Me
                                                    </button>
                                                )}
                                                {notifyError && (
                                                    <p className="text-xs text-red-500 mt-2">{notifyError}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Trust Strip ── */}
                                <div className="grid grid-cols-2 gap-2 mb-5">
                                    {[
                                        { icon: <FaShieldAlt size={13} className="text-green-600" />, label: "Secure Checkout", sub: "100% encrypted", bg: "bg-green-50 border-green-100" },
                                        { icon: <FaTruck size={13} className="text-blue-600" />, label: "Free Delivery", sub: "Orders above ₹499", bg: "bg-blue-50 border-blue-100" },
                                        { icon: <FaUndo size={13} className="text-amber-600" />, label: `${product.returnWindow || 7}-Day Returns`, sub: product.isReplaceable ? "Replacement available" : "Easy returns", bg: "bg-amber-50 border-amber-100" },
                                        { icon: <FaTag size={13} className="text-violet-600" />, label: "Best Price", sub: "Verified & authentic", bg: "bg-violet-50 border-violet-100" },
                                    ].map(({ icon, label, sub, bg }) => (
                                        <div key={label} className={`flex items-center gap-2.5 p-3 rounded-xl border ${bg}`}>
                                            <div className="shrink-0">{icon}</div>
                                            <div>
                                                <p className="text-[11px] font-bold text-neutral-800">{label}</p>
                                                <p className="text-[10px] text-neutral-500">{sub}</p>
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
                                            : <p className="text-red-500">• Non-returnable{product.nonReturnableReason ? ` — ${product.nonReturnableReason}` : ""}</p>}
                                        {product.isCancellable !== false
                                            ? <p>• Cancellable {product.cancelWindow > 0 ? `within ${product.cancelWindow} hours` : "before packing"}</p>
                                            : <p className="text-red-500">• Non-cancellable product</p>}
                                    </div>
                                </Accordion>
                            </div>
                        </div>
                    </div>

                    {/* ══ Tabs Card ══ */}
                    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden mb-4">
                        {/* Tab bar */}
                        <div className="flex border-b border-neutral-100 overflow-x-auto">
                            {[
                                { key: "description", label: "Description" },
                                ...(highlightEntries.length > 0 ? [{ key: "highlights", label: "Specifications" }] : []),
                                { key: "reviews", label: `Reviews (${reviews.length})` },
                            ].map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-150
                                                ${activeTab === tab.key
                                            ? "border-orange-500 text-orange-500 bg-orange-50/50"
                                            : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 sm:p-7">
                            {/* Description */}
                            {activeTab === "description" && (
                                <div className="max-w-2xl">
                                    {product.description
                                        ? <p className="text-sm text-neutral-600 leading-relaxed">{product.description}</p>
                                        : <p className="text-sm text-neutral-400 italic">No description available.</p>}
                                </div>
                            )}

                            {/* Specifications */}
                            {activeTab === "highlights" && highlightEntries.length > 0 && (
                                <div className="max-w-xl overflow-hidden rounded-xl border border-neutral-100">
                                    {highlightEntries.map(([k, v], i) => (
                                        <div key={k} className={`flex text-sm ${i % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
                                            <div className="w-2/5 px-4 py-3 font-semibold text-neutral-500 border-r border-neutral-100 break-words">
                                                {k}
                                            </div>
                                            <div className="flex-1 px-4 py-3 text-neutral-800 break-words">{v}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reviews */}
                            {activeTab === "reviews" && (
                                <div className="max-w-2xl">
                                    {reviews.length > 0 && (
                                        <div className="flex gap-8 mb-7 pb-7 border-b border-neutral-100 flex-wrap">
                                            <div className="text-center shrink-0">
                                                <p className="text-[3rem] font-bold text-neutral-900 leading-none">{avgRating.toFixed(1)}</p>
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
                                                        className="text-[26px] bg-none border-none cursor-pointer p-0.5 transition-transform hover:scale-110">
                                                        {s <= myRating
                                                            ? <FaStar className="text-amber-400" />
                                                            : <FaRegStar className="text-neutral-300" />}
                                                    </button>
                                                ))}
                                            </div>
                                            <textarea value={myComment} onChange={e => setMyComment(e.target.value)}
                                                rows={3} placeholder="Share your experience…"
                                                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm
                                                           outline-none resize-none focus:border-orange-400 transition-colors mb-3" />
                                            {reviewError && (
                                                <p className="text-red-500 text-xs mb-2">{reviewError}</p>
                                            )}
                                            {reviewSuccess && (
                                                <p className="text-green-600 text-xs mb-2 flex items-center gap-1">
                                                    <FaCheckCircle size={10} /> Review submitted!
                                                </p>
                                            )}
                                            <button type="submit" disabled={submitting}
                                                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white
                                                           rounded-xl font-bold text-sm disabled:opacity-60 transition-colors">
                                                {submitting ? "Submitting…" : "Submit Review"}
                                            </button>
                                        </form>
                                    ) : (
                                        <button onClick={() => navigate("/login")}
                                            className="mb-6 px-6 py-2.5 border border-orange-300 text-orange-500 bg-orange-50
                                                       rounded-xl font-bold text-sm hover:bg-orange-100 transition-colors">
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
                                                        className="border border-neutral-100 rounded-2xl p-4 bg-neutral-50/50">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-rose-400
                                                                                text-white flex items-center justify-center
                                                                                text-sm font-bold shrink-0">
                                                                    {r.name?.[0]?.toUpperCase() || "U"}
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-sm text-neutral-900">{r.name}</p>
                                                                    <StarRow value={r.rating} size={10} />
                                                                </div>
                                                            </div>
                                                            {isOwn && (
                                                                <button onClick={() => handleDeleteReview(r._id)}
                                                                    className="text-neutral-300 hover:text-red-400 transition-colors p-1">
                                                                    <FaTrash size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {r.comment && (
                                                            <p className="text-sm text-neutral-600 leading-relaxed mt-2">{r.comment}</p>
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
                        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5 sm:p-6">
                            <div className="mb-4">
                                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">
                                    ✨ Recommended For You
                                </p>
                                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                                    Similar Products
                                </h2>
                                <p className="text-xs text-neutral-400 mt-0.5">Customers also viewed these products</p>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 related-scroll">
                                {relatedProducts.map(rp => <RelatedCard key={rp._id} rp={rp} />)}
                            </div>
                        </div>
                    )}

                    {/* Mobile bottom spacer */}
                    <div className="h-20 sm:h-0" />
                </div>
            </div>

            {imgZoomed && <ZoomModal src={heroUrl} alt={product.name} onClose={() => setImgZoomed(false)} />}
            {shareOpen && <ShareModal product={product} onClose={() => setShareOpen(false)} />}
        </>
    );
};

export default ProductDetails;