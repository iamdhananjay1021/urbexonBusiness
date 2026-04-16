import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import api from "../api/axios";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../contexts/AuthContext";
import RelatedProductsSlider from "../components/RelatedProductsSlider";
import { imgUrl } from "../utils/imageUrl";
import {
    FaStar, FaRegStar, FaShoppingCart, FaBolt,
    FaTrash, FaCheckCircle, FaArrowLeft,
    FaUpload, FaTimes, FaPencilAlt, FaStickyNote,
    FaBell, FaTag, FaShare, FaWhatsapp,
    FaFacebook, FaInstagram, FaLink, FaTwitter,
    FaSearchPlus, FaChevronDown, FaChevronUp,
    FaShieldAlt, FaTruck, FaUndo,
} from "react-icons/fa";

/* ─── Helpers ───────────────────────────────────────────── */
const getMrp = (p) => {
    const v = p?.mrp ?? p?.originalPrice ?? p?.comparePrice ?? p?.compareAtPrice ?? null;
    if (!v && v !== 0) return null;
    const n = Number(v);
    return n > 0 ? n : null;
};

const StarRow = ({ value, size = 12 }) => (
    <span style={{ display: "inline-flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map(s => s <= value
            ? <FaStar key={s} size={size} style={{ color: "#ff9f00" }} />
            : <FaRegStar key={s} size={size} style={{ color: "#ccc" }} />)}
    </span>
);

/* ─── Share Modal ───────────────────────────────────────── */
const ShareModal = ({ product, onClose }) => {
    const [copied, setCopied] = useState(false);
    const url = window.location.href;
    const text = encodeURIComponent(`${product.name} — ₹${Number(product.price).toLocaleString("en-IN")}`);
    const enc = encodeURIComponent(url);

    const links = [
        { icon: <FaWhatsapp size={22} />, label: "WhatsApp", color: "#25D366", bg: "#f0fdf4", href: `https://wa.me/?text=${text}%20${enc}` },
        { icon: <FaFacebook size={22} />, label: "Facebook", color: "#1877F2", bg: "#eff6ff", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
        { icon: <FaTwitter size={22} />, label: "Twitter", color: "#000", bg: "#f5f5f5", href: `https://twitter.com/intent/tweet?text=${text}&url=${enc}` },
        { icon: <FaInstagram size={22} />, label: "Instagram", color: "#E1306C", bg: "#fff0f6", href: `https://www.instagram.com/` },
    ];

    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8vh 16px 0" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 380, borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.25)", maxHeight: "82vh", overflowY: "auto", animation: "mcSlideDown .22s ease" }}>
                <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#212121" }}>Share Product</span>
                    <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#f5f5f5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><FaTimes size={12} color="#666" /></button>
                </div>
                <div style={{ margin: "12px 20px", background: "#fafafa", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, border: "1px solid #f0f0f0" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, background: "#fff", border: "1px solid #eee", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {product.images?.[0]?.url
                            ? <img src={imgUrl.detail(product.images[0].url)} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                            : <span style={{ fontSize: 20 }}>🎁</span>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 13, color: "#212121", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</p>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#388e3c", marginTop: 2 }}>₹{Number(product.price).toLocaleString("en-IN")}</p>
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, padding: "4px 20px 16px" }}>
                    {links.map(({ icon, label, color, bg, href }) => (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none" }}>
                            <div style={{ width: 52, height: 52, borderRadius: 14, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#757575", textAlign: "center" }}>{label}</span>
                        </a>
                    ))}
                </div>
                <div style={{ margin: "0 20px 20px", display: "flex", alignItems: "center", gap: 8, background: "#f5f5f5", borderRadius: 8, padding: "8px 12px", border: "1px solid #e0e0e0" }}>
                    <span style={{ fontSize: 12, color: "#757575", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
                    <button
                        onClick={async () => {
                            try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
                        }}
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: copied ? "#e8f5e9" : "#2874f0", color: copied ? "#388e3c" : "#fff", transition: "all .2s" }}>
                        {copied ? <><FaCheckCircle size={10} /> Copied!</> : <><FaLink size={10} /> Copy</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Zoom Modal ────────────────────────────────────────── */
const ZoomModal = ({ src, alt, onClose }) => {
    useEffect(() => {
        const h = e => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    return (
        <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: "rgba(0,0,0,.94)", display: "flex", alignItems: "center", justifyContent: "center", width: "100vw", height: "100vh" }}>
            <button onClick={onClose} style={{ position: "fixed", top: 16, right: 16, width: 40, height: 40, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FaTimes size={16} color="#fff" />
            </button>
            <div onClick={e => e.stopPropagation()} style={{ width: "90vw", height: "85vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={src} alt={alt} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </div>
        </div>
    );
};

/* ─── Accordion ─────────────────────────────────────────── */
const Accordion = ({ title, icon, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 4, marginBottom: 8 }}>
            <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "none", border: "none", cursor: "pointer" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: "#212121" }}>{icon}{title}</span>
                {open ? <FaChevronUp size={12} color="#878787" /> : <FaChevronDown size={12} color="#878787" />}
            </button>
            {open && <div style={{ padding: "0 16px 16px", fontSize: 13, color: "#555", lineHeight: 1.8 }}>{children}</div>}
        </div>
    );
};

/* ─── Rating Bar ─────────────────────────────────────────── */
const RatingBar = ({ star, count, pct }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#878787", width: 8 }}>{star}</span>
        <FaStar size={9} style={{ color: "#ff9f00", flexShrink: 0 }} />
        <div style={{ flex: 1, height: 6, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#ff9f00", width: `${pct}%`, borderRadius: 4, transition: "width .6s" }} />
        </div>
        <span style={{ fontSize: 12, color: "#878787", width: 16, textAlign: "right" }}>{count}</span>
    </div>
);

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addItem, cartItems } = useCart();
    const { user } = useAuth();

    /* ── State ── */
    const [product, setProduct] = useState(null);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [activeImg, setActiveImg] = useState(0);
    const [imgZoomed, setImgZoomed] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [selectedSize, setSelectedSize] = useState("");
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

    /* ── Derived ── */
    const inCart = useMemo(() => cartItems.some(i => i._id === product?._id), [cartItems, product?._id]);
    const mrpValue = useMemo(() => product ? getMrp(product) : null, [product]);
    const hasDiscount = useMemo(() => mrpValue && mrpValue > Number(product?.price), [mrpValue, product?.price]);
    const savedAmount = useMemo(() => hasDiscount ? mrpValue - Number(product.price) : 0, [hasDiscount, mrpValue, product?.price]);
    const discountPct = useMemo(() => hasDiscount ? Math.round(((mrpValue - Number(product.price)) / mrpValue) * 100) : null, [hasDiscount, mrpValue, product?.price]);
    const avgRating = useMemo(() => product?.rating || 0, [product?.rating]);

    const ratingBars = useMemo(() => [5, 4, 3, 2, 1].map(star => ({
        star,
        count: reviews.filter(r => r.rating === star).length,
        pct: reviews.length ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100) : 0,
    })), [reviews]);

    const highlightEntries = useMemo(() => {
        if (!product?.highlights) return [];
        return product.highlights instanceof Map
            ? [...product.highlights.entries()]
            : Object.entries(product.highlights);
    }, [product?.highlights]);

    const allImages = useMemo(() => product?.images?.length ? product.images : [], [product?.images]);

    /* ── FIX: sizes is array of {size, stock} objects ── */
    const normalizedSizes = useMemo(() => {
        if (!product?.sizes?.length) return [];
        return product.sizes.map(s =>
            typeof s === "string" ? { size: s, stock: 1 } : s
        );
    }, [product?.sizes]);

    /* ── Fetch ── */
    const fetchReviews = useCallback(async (pid) => {
        try {
            const { data } = await api.get(`/reviews/${pid}`);
            setReviews(data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        if (!id) return;
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        (async () => {
            try {
                setLoading(true);
                setError("");
                setActiveImg(0);
                setSelectedSize("");

                const { data: prod } = await api.get(`/products/${id}`, { signal: ctrl.signal });
                setProduct(prod);

                const { data: related } = await api.get(`/products/${prod._id}/related`, { signal: ctrl.signal });
                setRelatedProducts(related);

                await fetchReviews(prod._id);
            } catch (err) {
                if (err.name !== "AbortError") setError("Failed to load product.");
            } finally {
                setLoading(false);
            }
        })();

        return () => ctrl.abort();
    }, [id, fetchReviews]);

    useEffect(() => {
        if (!user || !reviews.length) return;
        const mine = reviews.find(r => r.user === user._id || r.user?._id === user._id);
        if (mine) { setMyRating(mine.rating); setMyComment(mine.comment || ""); }
    }, [reviews, user]);

    useEffect(() => {
        if (user?.email) setNotifyEmail(user.email);
    }, [user]);

    /* ── Handlers ── */
    const handleCustomImageChange = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size / 1024 / 1024 > 5) return alert("Max 5MB");
        setCustomImagePreview(URL.createObjectURL(file));
        try {
            setUploadingImage(true);
            const fd = new FormData();
            fd.append("image", file);
            const { data } = await api.post("/uploads/custom-image", fd);
            setCustomImageUrl(data.url);
        } catch {
            alert("Upload failed.");
            setCustomImagePreview("");
        } finally {
            setUploadingImage(false);
        }
    }, []);

    const removeCustomImage = useCallback(() => {
        setCustomImagePreview("");
        setCustomImageUrl("");
    }, []);

    const getCustomization = useCallback(() => ({
        text: customText.trim(),
        imageUrl: customImageUrl,
        note: customNote.trim(),
    }), [customText, customImageUrl, customNote]);

    const handleAddToCart = useCallback(() => {
        if (normalizedSizes.length > 0 && !selectedSize) return alert("Please select a size!");
        addItem({ ...product, selectedSize, customization: getCustomization() });
        setAddedFlash(true);
        setTimeout(() => setAddedFlash(false), 1500);
    }, [product, selectedSize, normalizedSizes, addItem, getCustomization]);

    const handleBuyNow = useCallback(() => {
        if (normalizedSizes.length > 0 && !selectedSize) return alert("Please select a size!");
        navigate("/checkout", {
            state: { buyNowItem: { ...product, quantity: 1, selectedSize, customization: getCustomization() } },
        });
    }, [product, selectedSize, normalizedSizes, navigate, getCustomization]);

    const handleNotifyMe = useCallback(async () => {
        if (!notifyEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
            setNotifyError("Enter a valid email");
            return;
        }
        try {
            setNotifySubmitting(true);
            setNotifyError("");
            await api.post("/stock-notify/subscribe", {
                productId: product._id,
                email: notifyEmail.trim(),
            });
            setNotifySuccess(true);
            setShowNotifyInput(false);
            try { localStorage.setItem(`notify_${product._id}`, "1"); } catch { }
        } catch (err) {
            setNotifyError(err.response?.data?.message || "Something went wrong.");
        } finally {
            setNotifySubmitting(false);
        }
    }, [notifyEmail, product?._id]);

    const handleSubmitReview = useCallback(async (e) => {
        e.preventDefault();
        if (!myRating) return setReviewError("Select a rating first");
        try {
            setSubmitting(true);
            setReviewError("");
            await api.post(`/reviews/${product._id}`, { rating: myRating, comment: myComment });
            setReviewSuccess(true);
            await fetchReviews(product._id);
            const { data } = await api.get(`/products/${id}`);
            setProduct(data);
            setTimeout(() => setReviewSuccess(false), 2500);
        } catch (err) {
            setReviewError(err.response?.data?.message || "Failed to submit");
        } finally {
            setSubmitting(false);
        }
    }, [myRating, myComment, product?._id, fetchReviews, id]);

    const handleDeleteReview = useCallback(async (rid) => {
        try {
            await api.delete(`/reviews/${rid}`);
            await fetchReviews(product._id);
            setMyRating(0);
            setMyComment("");
        } catch { /* silent */ }
    }, [product?._id, fetchReviews]);

    /* ── Loading / Error states ── */
    if (loading) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f3f6" }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ width: 36, height: 36, border: "3px solid #2874f0", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ color: "#878787", fontSize: 13 }}>Loading…</p>
            </div>
        </div>
    );

    if (!product || error) return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f1f3f6" }}>
            <p style={{ color: "#878787", fontSize: 14 }}>{error || "Product not found"}</p>
            <button onClick={() => navigate("/")} style={{ padding: "10px 24px", background: "#2874f0", color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, cursor: "pointer" }}>
                Go Home
            </button>
        </div>
    );

    const heroUrl = imgUrl.detail(allImages[activeImg]?.url || "");

    return (
        <>
            {/* ── Global CSS ── */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap');
                @keyframes mcSlideDown { from{opacity:0;transform:translateY(-18px)} to{opacity:1;transform:translateY(0)} }
                @keyframes spin        { to{transform:rotate(360deg)} }

                /* ═══ BASE STYLES (DESKTOP) ═══ */
                .pd-tab { padding:12px 20px; font-size:13px; font-weight:600; border:none; background:none; cursor:pointer; border-bottom:3px solid transparent; color:#878787; white-space:nowrap; transition:all .2s; }
                .pd-tab.active { color:#2874f0; border-bottom-color:#2874f0; }
                .pd-tab:hover  { color:#2874f0; }

                .pd-size { min-width:52px; height:44px; padding:0 14px; border:1px solid #e0e0e0; font-size:13px; font-weight:600; cursor:pointer; background:#fff; border-radius:4px; transition:all .2s; color:#212121; }
                .pd-size:hover:not(:disabled) { border-color:#2874f0; color:#2874f0; }
                .pd-size.active { border:2px solid #212121; background:#fff; color:#212121; font-weight:700; }
                .pd-size.oos    { color:#ccc; cursor:not-allowed; background:#fafafa; text-decoration:line-through; }

                .pd-btn { display:flex; align-items:center; justify-content:center; gap:8px; height:52px; flex:1; font-size:14px; font-weight:700; border:none; border-radius:4px; cursor:pointer; transition:all .15s; text-transform:uppercase; letter-spacing:.04em; }
                .pd-btn:active { transform:scale(.98); }
                .pd-cart { background:#ff9f00; color:#fff; }
                .pd-cart:hover { background:#f09000; }
                .pd-cart.in-cart { background:#e8f5e9; color:#388e3c; }
                .pd-buy  { background:#fb641b; color:#fff; }
                .pd-buy:hover { background:#e55a10; }

                .pd-thumb { width:72px; height:72px; border:2px solid transparent; border-radius:4px; overflow:hidden; cursor:pointer; flex-shrink:0; background:#fafafa; transition:border-color .15s; }
                .pd-thumb.active { border-color:#2874f0; }
                .pd-thumb:hover  { border-color:#bbb; }

                .pd-share-btn { position:absolute; top:12px; right:12px; z-index:10; display:flex; align-items:center; gap:6px; background:rgba(255,255,255,.95); border:none; border-radius:20px; padding:7px 14px; font-size:11px; font-weight:700; color:#212121; box-shadow:0 2px 8px rgba(0,0,0,.18); cursor:pointer; transition:all .2s; }
                .pd-share-btn:hover { background:#fff; box-shadow:0 4px 16px rgba(0,0,0,.22); }

                .pd-trust { display:flex; align-items:center; gap:8px; padding:12px 0; font-size:12px; color:#555; border-bottom:1px solid #f0f0f0; }

                /* ═══ TABLET (1024px and below) ═══ */
                @media (max-width: 1024px) {
                    .pd-main-grid { grid-template-columns: 1fr 1.1fr !important; gap: 0 !important; }
                    .pd-img-wrap { padding: 20px 16px !important; }
                    .pd-info-wrap { padding: 20px 20px !important; }
                    h1.pd-title { font-size: 1.2rem !important; }
                    .pd-btn { height: 48px !important; font-size: 13px !important; }
                    .pd-thumb { width: 64px !important; height: 64px !important; }
                    .pd-size { min-width: 48px !important; height: 40px !important; padding: 0 12px !important; font-size: 12px !important; }
                }

                /* ═══ MEDIUM TABLET (768px) ═══ */
                @media (max-width: 768px) {
                    .pd-main-grid  { grid-template-columns: 1fr !important; gap: 0 !important; }
                    .pd-img-wrap {
                        border-radius: 0 !important;
                        border-left: none !important;
                        border-right: none !important;
                        border-bottom: 1px solid #f0f0f0 !important;
                        padding: 16px 14px !important;
                    }
                    .pd-info-wrap  { padding: 16px 14px !important; }
                    .pd-page-wrap  { padding: 0 !important; margin: 0 !important; border-radius: 0 !important; }
                    .pd-breadcrumb { padding: 10px 14px !important; }
                    
                    .pd-thumb { width: 56px !important; height: 56px !important; }
                    .pd-btn { height: 44px !important; font-size: 12px !important; gap: 6px !important; }
                    .pd-size { min-width: 44px !important; height: 36px !important; padding: 0 10px !important; font-size: 11px !important; }
                    
                    h1.pd-title { font-size: 1.1rem !important; }
                    .pd-share-btn { top: 10px !important; right: 10px !important; padding: 5px 12px !important; font-size: 10px !important; }
                    
                    .pd-tab { padding: 10px 16px !important; font-size: 12px !important; }
                    .pd-trust { font-size: 11px !important; gap: 6px !important; }
                }

                /* ═══ SMALL TABLET / LARGE PHONE (640px) ═══ */
                @media (max-width: 640px) {
                    .pd-main-grid { grid-template-columns: 1fr !important; }
                    .pd-img-wrap { padding: 12px 12px !important; }
                    .pd-info-wrap { padding: 12px 12px !important; }
                    .pd-page-wrap { margin: 0 !important; border-radius: 0 !important; }
                    
                    .pd-thumb { width: 50px !important; height: 50px !important; gap: 6px !important; }
                    .pd-btn { height: 42px !important; font-size: 11px !important; }
                    .pd-size { min-width: 40px !important; height: 34px !important; padding: 0 8px !important; font-size: 10px !important; }
                    
                    h1.pd-title { font-size: 1rem !important; line-height: 1.3 !important; }
                    .pd-breadcrumb { padding: 8px 12px !important; }
                    .pd-page-wrap { padding: 0 !important; }
                    
                    .pd-tab { padding: 8px 14px !important; font-size: 11px !important; }
                    .pd-trust { font-size: 10px !important; padding: 8px 0 !important; }
                    .pd-share-btn { padding: 4px 10px !important; font-size: 9px !important; }
                }

                /* ═══ PHONE (480px and below) ═══ */
                @media (max-width: 480px) {
                    .pd-main-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
                    .pd-img-wrap {
                        border-radius: 0 !important;
                        border: none !important;
                        padding: 10px 10px !important;
                        border-bottom: 1px solid #f0f0f0 !important;
                    }
                    .pd-info-wrap { padding: 10px 10px !important; }
                    .pd-page-wrap { padding: 0 !important; margin: 0 !important; border-radius: 0 !important; }
                    .pd-breadcrumb { padding: 8px 10px !important; font-size: 12px !important; }
                    
                    /* Typography Scaling */
                    h1.pd-title { font-size: 0.95rem !important; line-height: 1.25 !important; margin-bottom: 8px !important; }
                    .pd-category { font-size: 10px !important; margin-bottom: 4px !important; }
                    
                    /* Price Scaling */
                    .pd-price-large { font-size: 1.4rem !important; }
                    .pd-price-old { font-size: 0.9rem !important; }
                    .pd-price-off { font-size: 0.85rem !important; }
                    
                    /* Image Gallery */
                    .pd-hero-img { max-height: 300px !important; }
                    .pd-thumb { width: 45px !important; height: 45px !important; gap: 4px !important; }
                    .pd-thumb-wrap { gap: 6px !important; }
                    
                    /* Buttons */
                    .pd-btn { height: 40px !important; font-size: 10px !important; gap: 4px !important; padding: 0 8px !important; }
                    .pd-size { min-width: 36px !important; height: 32px !important; padding: 0 6px !important; font-size: 9px !important; }
                    
                    /* Tabs */
                    .pd-tab { padding: 8px 12px !important; font-size: 10px !important; }
                    .pd-tabs-wrap { padding-left: 10px !important; }
                    .pd-tab-content { padding: 16px 10px !important; }
                    
                    /* Trust strip */
                    .pd-trust { font-size: 9px !important; padding: 6px 0 !important; gap: 6px !important; }
                    
                    /* Share button */
                    .pd-share-btn { top: 8px !important; right: 8px !important; padding: 3px 8px !important; font-size: 8px !important; }
                    
                    /* Accordions */
                    .pd-accordion { margin-top: 12px !important; }
                }
            `}</style>

            <div style={{ background: "#f1f3f6", minHeight: "100vh" }}>

                {/* ── Breadcrumb ── */}
                <div className="pd-breadcrumb" style={{ background: "#fff", padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                    <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 6, color: "#2874f0", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                        <FaArrowLeft size={11} /> Back
                    </button>
                </div>

                {/* ── Main white card ── */}
                <div className="pd-page-wrap" style={{ maxWidth: 1100, margin: "12px auto", background: "#fff", borderRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
                    <div className="pd-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 0 }}>

                        {/* ══════════ LEFT — Images ══════════ */}
                        <div className="pd-img-wrap" style={{ borderRight: "1px solid #f0f0f0", padding: "24px 20px" }}>

                            {/* Main Image */}
                            <div style={{ position: "relative" }}>
                                {/* Badges */}
                                <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, display: "flex", flexDirection: "column", gap: 4 }}>
                                    {product.isCustomizable && (
                                        <span style={{ background: "#388e3c", color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 2 }}>✏ CUSTOM</span>
                                    )}
                                    {!product.inStock && (
                                        <span style={{ background: "#212121", color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 2 }}>SOLD OUT</span>
                                    )}
                                    {hasDiscount && (
                                        <span style={{ background: "#388e3c", color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 2 }}>{discountPct}% off</span>
                                    )}
                                </div>

                                {/* Share */}
                                <button className="pd-share-btn" onClick={e => { e.preventDefault(); e.stopPropagation(); setShareOpen(true); }}>
                                    <FaShare size={11} /> Share
                                </button>

                                {/* Hero image */}
                                <div
                                    className="pd-hero-img"
                                    style={{ aspectRatio: "3/4", background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 4, overflow: "hidden", cursor: "zoom-in", position: "relative", maxWidth: "100%", maxHeight: "600px" }}
                                    onClick={() => { if (!shareOpen) setImgZoomed(true); }}
                                >
                                    {heroUrl
                                        ? <img
                                            src={heroUrl}
                                            alt={product.name}
                                            loading="eager"
                                            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", transition: "transform .4s ease" }}
                                            onMouseEnter={e => e.target.style.transform = "scale(1.04)"}
                                            onMouseLeave={e => e.target.style.transform = "scale(1)"}
                                        />
                                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🎁</div>
                                    }
                                    {/* Zoom hint */}
                                    <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(255,255,255,.9)", borderRadius: 4, padding: "6px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                                        <FaSearchPlus size={12} color="#212121" />
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "#212121" }}>ZOOM</span>
                                    </div>
                                </div>
                            </div>

                            {/* Thumbnails */}
                            {allImages.length > 1 && (
                                <div className="pd-thumb-wrap" style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
                                    {allImages.map((img, i) => (
                                        <div key={i} className={`pd-thumb ${activeImg === i ? "active" : ""}`} onClick={() => setActiveImg(i)}>
                                            <img src={imgUrl.card(img.url)} alt={`${product.name} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ══════════ RIGHT — Info ══════════ */}
                        <div className="pd-info-wrap" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 0 }}>

                            {/* Category */}
                            {product.category && (
                                <p className="pd-category" style={{ fontSize: 11, color: "#878787", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
                                    {product.category.replace(/-/g, " ")}
                                </p>
                            )}

                            {/* Title */}
                            <h1 className="pd-title" style={{ fontSize: "1.35rem", fontWeight: 500, color: "#212121", lineHeight: 1.4, marginBottom: 10 }}>
                                {product.name}
                            </h1>

                            {/* Rating row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f0f0f0", flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#388e3c", color: "#fff", borderRadius: 3, padding: "2px 8px" }}>
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>{avgRating.toFixed(1)}</span>
                                    <FaStar size={10} />
                                </div>
                                <span style={{ fontSize: 13, color: "#878787" }}>{reviews.length} Ratings &amp; Reviews</span>
                            </div>

                            {/* Price */}
                            <div style={{ marginBottom: 4 }}>
                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 4 }}>
                                    <span className="pd-price-large" style={{ fontSize: "2rem", fontWeight: 700, color: "#212121", lineHeight: 1 }}>
                                        ₹{Number(product.price).toLocaleString("en-IN")}
                                    </span>
                                    {hasDiscount && <>
                                        <span className="pd-price-old" style={{ fontSize: "1rem", color: "#878787", textDecoration: "line-through" }}>₹{Number(mrpValue).toLocaleString("en-IN")}</span>
                                        <span className="pd-price-off" style={{ fontSize: "1rem", fontWeight: 700, color: "#388e3c" }}>{discountPct}% off</span>
                                    </>}
                                </div>
                                <p style={{ fontSize: 12, color: "#878787" }}>Inclusive of all taxes</p>
                                {hasDiscount && savedAmount > 0 && (
                                    <p style={{ fontSize: 13, color: "#388e3c", fontWeight: 600, marginTop: 4 }}>
                                        You save ₹{savedAmount.toLocaleString("en-IN")}
                                    </p>
                                )}
                            </div>

                            {/* Delivery */}
                            <p style={{ fontSize: 12, color: "#878787", marginTop: 6, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f0f0f0" }}>
                                🚚 Free delivery on orders above ₹499
                            </p>

                            {/* Stock */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                                {product.inStock ? (<>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#388e3c", display: "inline-block" }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#388e3c" }}>In Stock</span>
                                    {product.stock > 0 && product.stock <= 10 && (
                                        <span style={{ fontSize: 12, color: "#ff6161", fontWeight: 600, background: "#fff3f3", padding: "2px 8px", borderRadius: 3 }}>
                                            Only {product.stock} left
                                        </span>
                                    )}
                                </>) : (<>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff6161", display: "inline-block" }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#ff6161" }}>Out of Stock</span>
                                </>)}
                            </div>

                            {/* ── FIX: Sizes — properly handle {size, stock} objects ── */}
                            {normalizedSizes.length > 0 && (
                                <div style={{ marginBottom: 18 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: "#212121" }}>
                                            Size{selectedSize ? `: ${selectedSize}` : ""}
                                        </p>
                                        <button style={{ fontSize: 12, color: "#2874f0", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                                            Size Guide
                                        </button>
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {normalizedSizes.map(({ size, stock }) => {
                                            const isOos = stock === 0;
                                            return (
                                                <button
                                                    key={size}
                                                    disabled={isOos}
                                                    onClick={() => !isOos && setSelectedSize(size)}
                                                    className={`pd-size${selectedSize === size ? " active" : ""}${isOos ? " oos" : ""}`}
                                                    title={isOos ? "Out of stock" : ""}
                                                >
                                                    {size}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {!selectedSize && (
                                        <p style={{ fontSize: 12, color: "#ff6161", marginTop: 8, fontWeight: 600 }}>
                                            ↑ Please select a size to continue
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Customization */}
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
                                    <div style={{ border: "1px solid #ffe0b2", background: "#fffde7", borderRadius: 4, padding: 16, marginBottom: 18 }}>
                                        <p style={{ fontSize: 12, fontWeight: 800, color: "#e65100", marginBottom: 12, textTransform: "uppercase" }}>✏ Personalise Your Order</p>
                                        {extraPrice > 0 && (
                                            <p style={{ fontSize: 11, color: "#bf360c", marginBottom: 10, fontWeight: 600 }}>
                                                + ₹{extraPrice.toLocaleString("en-IN")} customization charge
                                            </p>
                                        )}
                                        {allowText && (
                                            <div style={{ marginBottom: 10 }}>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: "#bf360c", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                                                    <FaPencilAlt size={9} /> {textLabel}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={customText}
                                                    maxLength={textMaxLen}
                                                    onChange={e => setCustomText(e.target.value)}
                                                    placeholder={textPlaceholder}
                                                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ffe0b2", borderRadius: 4, fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}
                                                />
                                                {customText && (
                                                    <p style={{ fontSize: 10, color: "#bf360c", marginTop: 3, textAlign: "right" }}>{customText.length}/{textMaxLen}</p>
                                                )}
                                            </div>
                                        )}
                                        {allowImage && (
                                            <div style={{ marginBottom: 10 }}>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: "#bf360c", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                                                    <FaUpload size={9} /> {imageLabel}
                                                </label>
                                                {!customImagePreview ? (
                                                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 52, border: "1px dashed #ffb74d", borderRadius: 4, cursor: "pointer", background: "#fff8e1" }}>
                                                        {uploadingImage
                                                            ? <div style={{ width: 16, height: 16, border: "2px solid #ff9800", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                                                            : <><FaUpload color="#ff9800" size={12} /><span style={{ fontSize: 12, color: "#e65100", fontWeight: 600 }}>Click to upload</span></>
                                                        }
                                                        <input type="file" accept="image/*" onChange={handleCustomImageChange} style={{ display: "none" }} />
                                                    </label>
                                                ) : (
                                                    <div style={{ position: "relative", display: "inline-block" }}>
                                                        <img src={customImagePreview} alt="custom" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, border: "1px solid #ffe0b2" }} />
                                                        <button onClick={removeCustomImage} style={{ position: "absolute", top: -8, right: -8, width: 20, height: 20, background: "#f44336", color: "#fff", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                                            <FaTimes size={9} />
                                                        </button>
                                                        {customImageUrl && (
                                                            <span style={{ position: "absolute", bottom: 2, left: 2, background: "#4caf50", color: "#fff", fontSize: 8, fontWeight: 700, padding: "1px 4px" }}>✓</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {allowNote && (
                                            <div>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: "#bf360c", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                                                    <FaStickyNote size={9} /> {noteLabel}
                                                </label>
                                                <textarea
                                                    value={customNote}
                                                    onChange={e => setCustomNote(e.target.value)}
                                                    placeholder={notePlaceholder}
                                                    rows={2}
                                                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ffe0b2", borderRadius: 4, fontSize: 13, outline: "none", resize: "none", background: "#fff", boxSizing: "border-box" }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* ── CTA or Out of Stock ── */}
                            {product.inStock ? (
                                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                    <button
                                        onClick={handleAddToCart}
                                        className={`pd-btn pd-cart${inCart ? " in-cart" : ""}`}
                                        style={addedFlash ? { background: "#4caf50", color: "#fff" } : {}}
                                    >
                                        <FaShoppingCart size={16} />
                                        {inCart ? "In Cart ✔" : addedFlash ? "Added!" : "Add to Cart"}
                                    </button>
                                    <button onClick={handleBuyNow} className="pd-btn pd-buy">
                                        <FaBolt size={16} /> Buy Now
                                    </button>
                                </div>
                            ) : (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                                        <button disabled className="pd-btn" style={{ background: "#f0f0f0", color: "#bdbdbd", cursor: "not-allowed", flex: 1 }}>
                                            <FaShoppingCart size={16} /> Add to Cart
                                        </button>
                                        <button disabled className="pd-btn" style={{ background: "#f0f0f0", color: "#bdbdbd", cursor: "not-allowed", flex: 1 }}>
                                            <FaBolt size={16} /> Buy Now
                                        </button>
                                    </div>
                                    {notifySuccess ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#e8f5e9", border: "1px solid #c8e6c9", borderRadius: 4, padding: "10px 14px" }}>
                                            <FaCheckCircle color="#388e3c" size={16} />
                                            <div>
                                                <p style={{ fontWeight: 700, color: "#388e3c", fontSize: 13 }}>You're on the list!</p>
                                                <p style={{ fontSize: 12, color: "#388e3c", marginTop: 2 }}>We'll notify {notifyEmail} when back in stock.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ border: "1px solid #e0e0e0", borderRadius: 4, padding: 14 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                                <FaBell size={14} color="#878787" />
                                                <div>
                                                    <p style={{ fontWeight: 700, fontSize: 13, color: "#212121" }}>Notify When Available</p>
                                                    <p style={{ fontSize: 12, color: "#878787" }}>Get an email when back in stock</p>
                                                </div>
                                            </div>
                                            {showNotifyInput ? (
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <input
                                                        type="email"
                                                        value={notifyEmail}
                                                        onChange={e => { setNotifyEmail(e.target.value); setNotifyError(""); }}
                                                        placeholder="your@email.com"
                                                        style={{ flex: 1, padding: "10px 12px", border: "1px solid #e0e0e0", borderRadius: 4, fontSize: 13, outline: "none" }}
                                                    />
                                                    <button
                                                        onClick={handleNotifyMe}
                                                        disabled={notifySubmitting}
                                                        style={{ padding: "0 16px", background: "#2874f0", color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
                                                    >
                                                        {notifySubmitting ? "…" : "Notify Me"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setShowNotifyInput(true)}
                                                    style={{ width: "100%", padding: "10px 0", border: "1px solid #2874f0", color: "#2874f0", background: "#fff", borderRadius: 4, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                                                >
                                                    <FaBell size={12} /> Notify Me
                                                </button>
                                            )}
                                            {notifyError && <p style={{ fontSize: 12, color: "#f44336", marginTop: 6 }}>{notifyError}</p>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Trust strip */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                                <div className="pd-trust"><FaShieldAlt color="#388e3c" size={14} /> <strong>Secure</strong> 100% Secure Checkout</div>
                                <div className="pd-trust"><FaTruck color="#2874f0" size={14} /> <strong>Free</strong> Delivery on orders above ₹499</div>
                                <div className="pd-trust"><FaUndo color="#ff9f00" size={14} /> <strong>Easy</strong> Returns &amp; Exchanges</div>
                            </div>

                            {/* Accordions */}
                            <div className="pd-accordion" style={{ marginTop: 16 }}>
                                <Accordion title="Products Details & Description" icon={<FaTag size={13} color="#878787" />} defaultOpen={false}>
                                    {product.description || "No details available."}
                                </Accordion>
                                <Accordion title="Delivery & Return" icon={<FaTruck size={13} color="#878787" />} defaultOpen={false}>
                                    <p>• Free delivery on orders above ₹499</p>
                                    <p>• Standard delivery: 4–7 business days</p>
                                    <p>• Easy 7-day return policy</p>
                                    <p>• Exchange available on most products</p>
                                </Accordion>
                            </div>
                        </div>
                    </div>

                    {/* ── Tabs ── */}
                    <div style={{ borderTop: "1px solid #f0f0f0" }}>
                        <div className="pd-tabs-wrap" style={{ display: "flex", borderBottom: "1px solid #f0f0f0", overflowX: "auto", paddingLeft: 16 }}>
                            {[
                                { key: "description", label: "Description" },
                                ...(highlightEntries.length > 0 ? [{ key: "highlights", label: "Specifications" }] : []),
                                { key: "reviews", label: `Reviews (${reviews.length})` },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`pd-tab${activeTab === tab.key ? " active" : ""}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="pd-tab-content" style={{ padding: "24px 28px" }}>
                            {/* Description */}
                            {activeTab === "description" && (
                                <div style={{ maxWidth: 680 }}>
                                    {product.description
                                        ? <p style={{ fontSize: 14, color: "#444", lineHeight: 1.9 }}>{product.description}</p>
                                        : <p style={{ fontSize: 14, color: "#878787", fontStyle: "italic" }}>No description available.</p>
                                    }
                                </div>
                            )}

                            {/* Specifications */}
                            {activeTab === "highlights" && highlightEntries.length > 0 && (
                                <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 600 }}>
                                    <tbody>
                                        {highlightEntries.map(([k, v], i) => (
                                            <tr key={k} style={{ background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                                                <td style={{ padding: "10px 16px", fontSize: 13, color: "#878787", fontWeight: 600, width: "35%", borderBottom: "1px solid #f0f0f0" }}>{k}</td>
                                                <td style={{ padding: "10px 16px", fontSize: 13, color: "#212121", borderBottom: "1px solid #f0f0f0" }}>{v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* Reviews */}
                            {activeTab === "reviews" && (
                                <div style={{ maxWidth: 680 }}>
                                    {reviews.length > 0 && (
                                        <div style={{ display: "flex", gap: 40, marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #f0f0f0" }}>
                                            <div style={{ textAlign: "center", flexShrink: 0 }}>
                                                <p style={{ fontSize: "3rem", fontWeight: 700, color: "#212121", lineHeight: 1 }}>{avgRating.toFixed(1)}</p>
                                                <StarRow value={Math.round(avgRating)} size={14} />
                                                <p style={{ fontSize: 12, color: "#878787", marginTop: 6 }}>{reviews.length} ratings</p>
                                            </div>
                                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                                                {ratingBars.map(b => <RatingBar key={b.star} {...b} />)}
                                            </div>
                                        </div>
                                    )}

                                    {user ? (
                                        <form onSubmit={handleSubmitReview} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #f0f0f0" }}>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: "#212121", marginBottom: 12, textTransform: "uppercase" }}>Write a Review</p>
                                            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <button key={s} type="button" onClick={() => setMyRating(s)} style={{ fontSize: 26, background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                                                        {s <= myRating ? <FaStar style={{ color: "#ff9f00" }} /> : <FaRegStar style={{ color: "#ccc" }} />}
                                                    </button>
                                                ))}
                                            </div>
                                            <textarea
                                                value={myComment}
                                                onChange={e => setMyComment(e.target.value)}
                                                rows={3}
                                                placeholder="Share your experience…"
                                                style={{ width: "100%", border: "1px solid #e0e0e0", borderRadius: 4, padding: "10px 12px", fontSize: 13, marginBottom: 10, outline: "none", resize: "none", fontFamily: "'Roboto',sans-serif", boxSizing: "border-box" }}
                                            />
                                            {reviewError && <p style={{ color: "#f44336", fontSize: 12, marginBottom: 8 }}>{reviewError}</p>}
                                            {reviewSuccess && (
                                                <p style={{ color: "#388e3c", fontSize: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                                    <FaCheckCircle size={10} /> Review submitted!
                                                </p>
                                            )}
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                style={{ padding: "10px 24px", background: "#2874f0", color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}
                                            >
                                                {submitting ? "Submitting…" : "Submit Review"}
                                            </button>
                                        </form>
                                    ) : (
                                        <button
                                            onClick={() => navigate("/login")}
                                            style={{ marginBottom: 24, padding: "10px 24px", border: "1px solid #2874f0", color: "#2874f0", background: "#fff", borderRadius: 4, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                                        >
                                            Login to Write a Review
                                        </button>
                                    )}

                                    {reviews.length === 0 ? (
                                        <div style={{ textAlign: "center", padding: "40px 0", border: "1px dashed #e0e0e0", borderRadius: 4 }}>
                                            <p style={{ color: "#878787", fontSize: 14 }}>No reviews yet. Be the first!</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            {reviews.map(r => {
                                                const isOwn = user && (r.user === user._id || r.user?._id === user._id);
                                                return (
                                                    <div key={r._id} style={{ border: "1px solid #f0f0f0", borderRadius: 4, padding: 16 }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                                                <div style={{ width: 34, height: 34, background: "#2874f0", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                                                                    {r.name?.[0]?.toUpperCase() || "U"}
                                                                </div>
                                                                <div>
                                                                    <p style={{ fontWeight: 600, fontSize: 13, color: "#212121" }}>{r.name}</p>
                                                                    <StarRow value={r.rating} size={11} />
                                                                </div>
                                                            </div>
                                                            {isOwn && (
                                                                <button onClick={() => handleDeleteReview(r._id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: 4 }}>
                                                                    <FaTrash size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {r.comment && <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginTop: 6 }}>{r.comment}</p>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Related Products ── */}
                    {relatedProducts.length > 0 && (
                        <div style={{ borderTop: "1px solid #f0f0f0", padding: "24px 28px" }}>
                            <p style={{ fontSize: 11, fontWeight: 800, color: "#2874f0", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>You May Also Like</p>
                            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#212121", marginBottom: 20 }}>Similar Products</h2>
                            <RelatedProductsSlider products={relatedProducts} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modals ── */}
            {imgZoomed && <ZoomModal src={heroUrl} alt={product.name} onClose={() => setImgZoomed(false)} />}
            {shareOpen && <ShareModal product={product} onClose={() => setShareOpen(false)} />}
        </>
    );
};

export default ProductDetails;