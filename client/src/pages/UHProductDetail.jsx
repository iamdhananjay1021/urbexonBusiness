/**
 * UHProductDetail.jsx — Urbexon Hour Product Detail (Signal migration)
 * ✅ Desktop: 2-column (image left, info right), scales up to xl screens
 * ✅ Tablet: balanced single-column with wider gallery
 * ✅ Mobile: single column, sticky bottom CTA, dot-indicator gallery
 * All useCart/useRecentlyViewed hook usage and fetch/handler logic preserved verbatim.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as productApi from "../api/productApi";
import * as reviewApi from "../api/reviewApi";
import { imgUrl, imgSrcSet } from "../utils/imageUrl";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../contexts/AuthContext";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import SEO, { JsonLd } from "../components/SEO";
import { UHDeliveryEstimate } from "../components/DeliveryEstimate";
import BackButton from "../components/BackButton";
import {
  FiArrowLeft, FiPlus, FiMinus, FiTrash2, FiShoppingCart,
  FiClock, FiStar, FiChevronRight, FiShare2, FiHome,
  FiShield, FiTruck, FiRotateCcw, FiZap, FiChevronLeft,
  FiChevronDown, FiChevronUp, FiLink, FiMapPin, FiCheck,
} from "react-icons/fi";
import { FaStar, FaRegStar } from "react-icons/fa";
import Card from "../design-system/Card";
import Button from "../design-system/Button";
import Badge from "../design-system/Badge";
import Loader from "../design-system/Loader";
import { EmptyState } from "../design-system/EmptyState";
import { cn } from "../design-system/utils/cn";
import { showToast } from "../utils/toast";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* Scoped styles: visible thin scrollbars + a quiet entrance fade (motion-safe) */
const PAGE_CSS = `
  .uhpd-scroll{scrollbar-width:thin;scrollbar-color:var(--color-graphite-300,#d4d8de) transparent}
  .uhpd-scroll::-webkit-scrollbar{height:6px}
  .uhpd-scroll::-webkit-scrollbar-track{background:transparent}
  .uhpd-scroll::-webkit-scrollbar-thumb{background:var(--color-graphite-300,#d4d8de);border-radius:10px}
  .uhpd-scroll::-webkit-scrollbar-thumb:hover{background:var(--color-graphite-400,#b4b9c2)}
  .uhpd-fade{animation:uhpdFade .4s ease both}
  @keyframes uhpdFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @media (prefers-reduced-motion: reduce){.uhpd-fade{animation:none}}
`;

/* ── Suggested Product Card ── */
const SuggestedCard = ({ product, onNavigate }) => {
  const { addItem, isInUHCart, uhItems, increment, decrement, removeItem } = useCart();
  const inCart = isInUHCart(product._id);
  const cartItem = uhItems.find((i) => i._id === product._id);
  const qty = cartItem?.quantity || 0;
  const discount = product.mrp && product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <Card interactive padding="none" onClick={() => onNavigate(product)} className="min-w-[152px] max-w-[168px] flex-shrink-0 overflow-hidden rounded-2xl">
      <div className="relative aspect-square bg-canvas">
        {discount > 0 && <Badge variant="error" className="absolute top-2 left-2">{discount}% OFF</Badge>}
        <img
          src={imgUrl.card(product.images?.[0]?.url || product.image?.url || "") || "/placeholder.png"}
          srcSet={imgSrcSet(product.images?.[0]?.url || product.image?.url, 400)}
          alt={product.name} loading="lazy" decoding="async"
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          onError={(e) => { e.target.src = "/placeholder.png"; }}
        />
      </div>
      <div className="p-3">
        <div className="text-xs font-bold text-primary leading-snug mb-1.5 line-clamp-2 min-h-[2.2em]">{product.name}</div>
        {product.prepTimeMinutes && (
          <div className="flex items-center gap-1 text-[10px] text-muted mb-1.5"><FiClock size={9} aria-hidden="true" /> {product.prepTimeMinutes} min</div>
        )}
        <div className="flex items-baseline gap-1.5 mb-2.5">
          <span className="text-sm font-extrabold text-primary">{fmt(product.price)}</span>
          {product.mrp > product.price && <span className="text-[11px] text-muted line-through">{fmt(product.mrp)}</span>}
        </div>
        {!inCart ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              addItem({ ...product, productType: "urbexon_hour" });
              if (navigator.vibrate) navigator.vibrate(10);
            }}
            className="w-full py-2 border-[1.5px] border-[var(--accent-primary)] text-accent font-extrabold text-xs rounded-[var(--radius-sm)] flex items-center justify-center gap-1.5 hover:bg-accent hover:text-white transition-colors"
          >
            <FiPlus size={10} aria-hidden="true" /> ADD
          </button>
        ) : (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-between border-[1.5px] border-[var(--accent-primary)] rounded-[var(--radius-sm)] overflow-hidden bg-accent-tint">
            <button onClick={() => qty <= 1 ? removeItem(product._id, "urbexon_hour") : decrement(product._id, "urbexon_hour")} className="w-8 h-8 flex items-center justify-center text-accent" aria-label="Decrease">
              {qty <= 1 ? <FiTrash2 size={9} aria-hidden="true" /> : <FiMinus size={9} aria-hidden="true" />}
            </button>
            <span className="flex-1 text-center text-[13px] font-extrabold text-accent">{qty}</span>
            <button onClick={() => increment(product._id, "urbexon_hour")} className="w-8 h-8 flex items-center justify-center text-accent" aria-label="Increase">
              <FiPlus size={9} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

/* ── Main Component ── */
const UHProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, isInUHCart, uhItems, increment, decrement, removeItem, uhTotalQty, uhTotal } = useCart();
  const { user } = useAuth();
  const { trackView } = useRecentlyViewed("urbexon_hour");

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");

  // null = not checked yet (don't block — backend still enforces this at
  // checkout regardless); false = the saved/checked pincode's area has no
  // Urbexon Hour service at all, so Add to Cart is disabled right here
  // instead of letting the user fill a cart that can never check out.
  const [deliveryAvailable, setDeliveryAvailable] = useState(null);
  const handleDeliveryResult = useCallback((r) => setDeliveryAvailable(r?.available ?? null), []);

  /* ── Reviews — reuses the SAME /reviews API the ecommerce
       ProductDetails.jsx page uses (Review docs are keyed by product _id
       regardless of productType, so this needed no backend changes). ── */
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const inCart = product ? isInUHCart(product._id) : false;
  const cartItem = product ? uhItems.find((i) => i._id === product._id) : null;
  const qty = cartItem?.quantity || 0;

  useEffect(() => {
    if (product) {
      if (product.colorVariants?.length > 0) setSelectedColor(product.colorVariants[0].name || product.colorVariants[0].color || "");
      if (product.sizes?.length > 0) setSelectedSize(product.sizes[0].size || "");
    }
  }, [product]);

  const activeVariant = useMemo(() => {
    if (!product?.colorVariants || !selectedColor) return null;
    return product.colorVariants.find(v => (v.name || v.color) === selectedColor);
  }, [product, selectedColor]);

  const displayPrice = activeVariant?.price > 0 ? activeVariant.price : product?.price;
  const displayMrp = activeVariant?.mrp > 0 ? activeVariant.mrp : product?.mrp;
  const displayImages = activeVariant?.images?.length > 0 ? activeVariant.images : product?.images;

  const discount = useMemo(() => {
    if (!displayMrp || displayMrp <= displayPrice) return 0;
    return Math.round(((displayMrp - displayPrice) / displayMrp) * 100);
  }, [displayPrice, displayMrp]);

  const images = useMemo(() => {
    if (!displayImages) return [{ url: "/placeholder.png" }];
    return displayImages.length ? displayImages : [{ url: "/placeholder.png" }];
  }, [displayImages]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setImgIdx(0);
      setShowFullDesc(false);
      try {
        const { data } = await productApi.getProductById(id);
        if (!cancelled) { setProduct(data); trackView(data); }
        try {
          const r = await productApi.getRelatedProducts(data._id || id);
          if (!cancelled) setRelated(Array.isArray(r.data) ? r.data : r.data.products || []);
        } catch { if (!cancelled) setRelated([]); }
      } catch { if (!cancelled) setProduct(null); }
      finally { if (!cancelled) setLoading(false); }
    };
    if (id) load();
    return () => { cancelled = true; };
  }, [id]);

  const handleAdd = useCallback(() => {
    if (!product) return;
    if (product.inStock === false || Number(product.stock ?? 0) === 0) {
      showToast("Item out of stock", "warning");
      return;
    }
    addItem({
      ...product,
      productType: "urbexon_hour",
      selectedColor,
      selectedSize,
      price: displayPrice,
      mrp: displayMrp,
      images: displayImages || product.images
    });
    if (navigator.vibrate) navigator.vibrate(10);
  }, [product, addItem, selectedColor, selectedSize, displayPrice, displayMrp, displayImages]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product?.name, url }); } catch { /* user cancelled native share sheet — expected, no action needed */ }
    } else {
      try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard write denied/unsupported — intentionally silent */ }
    }
  }, [product]);

  const fetchReviews = useCallback(async (pid) => {
    try {
      const { data } = await reviewApi.getReviews(pid);
      const list = Array.isArray(data) ? data : [];
      setReviews(list);
      const mine = user && list.find((r) => (r.user?._id || r.user) === user._id);
      // Always reset (not just when found) — otherwise navigating from a
      // product you'd rated 4 stars to one you haven't rated yet left the
      // old "4 stars, ..." pre-filled in this product's form.
      setMyRating(mine?.rating || 0);
      setMyComment(mine?.comment || "");
    } catch { setReviews([]); }
  }, [user]);

  useEffect(() => {
    if (product?._id) fetchReviews(product._id);
  }, [product?._id, fetchReviews]);

  const handleSubmitReview = useCallback(async (e) => {
    e.preventDefault();
    if (!myRating) { setReviewError("Please select a star rating"); return; }
    setSubmittingReview(true); setReviewError("");
    try {
      await reviewApi.submitReview(product._id, { rating: myRating, comment: myComment });
      await fetchReviews(product._id);
      // Pull the freshly-recalculated rating/numReviews so the badge near
      // the title updates without a full page reload.
      try {
        const { data } = await productApi.getProductById(product._id);
        setProduct((prev) => (prev ? { ...prev, rating: data.rating, numReviews: data.numReviews } : prev));
      } catch { /* rating badge just won't refresh until next visit — non-critical */ }
    } catch (err) {
      setReviewError(err.response?.data?.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  }, [myRating, myComment, product?._id, fetchReviews]);

  const handleDeleteReview = useCallback(async (reviewId) => {
    try {
      await reviewApi.deleteReview(reviewId);
      setMyRating(0); setMyComment("");
      await fetchReviews(product._id);
    } catch { /* delete failed — review list just stays as-is until retry */ }
  }, [product?._id, fetchReviews]);

  const navigateToProduct = useCallback((p) => {
    navigate(`/uh-product/${p.slug || p._id}`);
  }, [navigate]);

  const outOfStock = product && (product.inStock === false || Number(product.stock ?? 0) === 0);

  if (loading) return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <Loader size="lg" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-canvas">
      <EmptyState
        icon={FiZap}
        title="Product not found"
        action={<Button variant="primary" icon={FiArrowLeft} onClick={() => navigate("/urbexon-hour")}>Back to Urbexon Hour</Button>}
      />
    </div>
  );

  const highlights = product.highlightsArray?.length
    ? product.highlightsArray.map(h => [h.title, h.value])
    : product.highlights ? Object.entries(
      product.highlights instanceof Map ? Object.fromEntries(product.highlights) : product.highlights
    ) : [];

  return (
    <div className="min-h-screen bg-[var(--color-graphite-50)]">
      <style>{PAGE_CSS}</style>

      <SEO
        title={product.name}
        description={product.description?.slice(0, 160) || `Order ${product.name} with quick delivery on Urbexon Hour.`}
        path={`/uh-product/${id}`}
        image={product.images?.[0]?.url || ""}
        type="product"
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description?.slice(0, 300),
        image: product.images?.map(i => i.url) || [],
        offers: {
          "@type": "Offer",
          url: `https://www.urbexon.in/uh-product/${id}`,
          priceCurrency: "INR",
          price: product.price,
          availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      }} />

      {/* ── Top Nav ── */}
      <div
        className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md flex items-center justify-between px-4 py-3 border-b border-default"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <BackButton variant="inline" fallback="/urbexon-hour" className="rounded-[var(--radius-md)] hover:bg-[var(--color-graphite-100)] active:scale-95" />
        <div className="flex items-center gap-1.5 text-[15px] font-extrabold text-primary">
          <FiZap size={13} className="text-accent" aria-hidden="true" />
          <span>Urbexon Hour</span>
        </div>
        <button onClick={handleShare} title={copied ? "Link copied!" : "Share"} className="w-10 h-10 rounded-[var(--radius-md)] bg-canvas flex items-center justify-center text-secondary hover:bg-[var(--color-graphite-100)] active:scale-95 transition-all">
          {copied ? <FiLink size={14} className="text-success" aria-hidden="true" /> : <FiShare2 size={14} aria-hidden="true" />}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[420px_1fr] lg:grid-cols-[480px_1fr] md:max-w-[1160px] xl:max-w-[1280px] md:mx-auto md:pt-6 md:px-6 md:gap-6 md:items-start">

        {/* ── LEFT: Gallery ── */}
        <div className="bg-surface md:rounded-2xl md:overflow-hidden md:shadow-sm md:border md:border-default">
          <div className="md:sticky md:top-[84px]">
            <div className="relative aspect-square bg-canvas flex items-center justify-center overflow-hidden group">
              {images.map((img, i) => (
                <div key={i} className="w-full h-full flex items-center justify-center p-6" style={{ display: i === imgIdx ? "flex" : "none" }}>
                  <img
                    src={imgUrl.detail(img.url || img)}
                    srcSet={imgSrcSet(img.url || img, 800)}
                    alt={product.name}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding={i === 0 ? "sync" : "async"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    className="max-w-full max-h-full object-contain transition-transform duration-500 md:group-hover:scale-[1.06]"
                    onError={(e) => { e.target.src = "/placeholder.png"; }}
                  />
                </div>
              ))}

              {images.length > 1 && (
                <>
                  <button onClick={() => setImgIdx(i => i > 0 ? i - 1 : images.length - 1)} aria-label="Previous image" className="absolute top-1/2 -translate-y-1/2 left-3 w-9 h-9 rounded-full bg-surface/95 shadow-md flex items-center justify-center text-secondary hover:scale-105 active:scale-95 transition-transform z-10">
                    <FiChevronLeft size={13} aria-hidden="true" />
                  </button>
                  <button onClick={() => setImgIdx(i => i < images.length - 1 ? i + 1 : 0)} aria-label="Next image" className="absolute top-1/2 -translate-y-1/2 right-3 w-9 h-9 rounded-full bg-surface/95 shadow-md flex items-center justify-center text-secondary hover:scale-105 active:scale-95 transition-transform z-10">
                    <FiChevronRight size={13} aria-hidden="true" />
                  </button>
                  {/* image counter — mobile-friendly, replaces need for dots on larger screens */}
                  <span className="absolute bottom-3 right-3 z-10 bg-[#1c1917]/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                    {imgIdx + 1}/{images.length}
                  </span>
                </>
              )}

              {discount > 0 && <Badge variant="error" className="absolute top-3.5 left-3.5 z-10">{discount}% OFF</Badge>}
            </div>

            {/* Dot indicators — mobile only (thumbnails take over on desktop) */}
            {images.length > 1 && (
              <div className="flex md:hidden justify-center gap-1.5 py-3">
                {images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} aria-label={`Image ${i + 1}`} className={cn("h-2 rounded-full transition-all", i === imgIdx ? "w-5 bg-accent" : "w-2 bg-[var(--color-graphite-300)]")} />
                ))}
              </div>
            )}

            {/* Thumbnail strip — desktop only */}
            {images.length > 1 && (
              <div className="hidden md:flex gap-2 px-4 py-4 overflow-x-auto uhpd-scroll">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={cn("w-[64px] h-[64px] flex-shrink-0 rounded-[var(--radius-sm)] border-2 overflow-hidden p-1 transition-colors", i === imgIdx ? "border-[var(--accent-primary)]" : "border-default hover:border-[var(--color-graphite-300)]")}>
                    <img src={imgUrl.thumbnail(img.url || img)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain" onError={(e) => { e.target.src = "/placeholder.png"; }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Product Info ── */}
        <div className="uhpd-fade bg-surface px-4 py-5 mt-2 md:mt-0 md:rounded-2xl md:p-7 md:shadow-sm md:border md:border-default">

          {(product.brand || product.category) && (
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              {product.brand && <span className="text-[11px] font-extrabold text-accent uppercase tracking-wide">{product.brand}</span>}
              {product.brand && product.category && <span className="text-[var(--color-graphite-300)]">•</span>}
              {product.category && <span className="text-[11px] font-semibold text-secondary">{product.category}</span>}
            </div>
          )}

          <h1 className="text-[clamp(21px,3vw,29px)] font-extrabold text-primary leading-[1.2] mb-3 font-display tracking-tight">{product.name}</h1>

          <div className="flex items-center gap-x-3 gap-y-1.5 mb-3 flex-wrap text-xs text-secondary font-semibold">
            <div className="flex items-center gap-1 text-[13px] font-bold text-primary bg-warning-tint px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--color-warning-100)]">
              <FiStar size={11} className="text-[var(--color-warning-500)]" aria-hidden="true" />
              <span>{product.rating > 0 ? product.rating.toFixed(1) : "0"}</span>
              <span className="text-muted font-medium text-xs">({product.numReviews || 0})</span>
            </div>
            {product.prepTimeMinutes && (
              <span className="flex items-center gap-1"><FiClock size={11} aria-hidden="true" /> {product.prepTimeMinutes} min prep</span>
            )}
            {product.vendorId?.shopName && (
              <span className="flex items-center gap-1"><FiHome size={11} aria-hidden="true" /> {product.vendorId.shopName}</span>
            )}
            {product.vendorId?.city && (
              <span className="flex items-center gap-1 text-muted font-medium"><FiMapPin size={11} aria-hidden="true" /> {product.vendorId.city}</span>
            )}
          </div>

          <div className="flex items-baseline gap-2.5 mb-1 flex-wrap">
            <span className="text-[28px] font-extrabold text-primary tracking-tight">{fmt(displayPrice)}</span>
            {displayMrp > displayPrice && (
              <>
                <span className="text-sm text-muted line-through">{fmt(displayMrp)}</span>
                <span className="text-[11px] font-extrabold text-white bg-[var(--color-success-500,#16a34a)] px-2 py-0.5 rounded-full">
                  Save {fmt(displayMrp - displayPrice)}
                </span>
              </>
            )}
          </div>

          <p className="text-xs text-muted mb-5">Inclusive of all taxes (GST)</p>

          {/* Variants */}
          {product.colorVariants?.length > 0 && (
            <div className="mb-5">
              <h3 className="text-[13px] font-bold text-primary mb-2.5">
                Color{selectedColor && <span className="font-medium text-secondary">: {selectedColor}</span>}
              </h3>
              <div className="flex gap-2.5 flex-wrap">
                {product.colorVariants.map((v, i) => {
                  const cName = v.name || v.color;
                  const active = selectedColor === cName;
                  if (v.color) {
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedColor(cName); setImgIdx(0); }}
                        aria-label={cName}
                        title={cName}
                        className={cn(
                          "relative w-9 h-9 rounded-full flex items-center justify-center transition-all",
                          active ? "ring-2 ring-offset-2 ring-[var(--accent-primary)]" : "ring-1 ring-default hover:ring-[var(--color-graphite-300)]"
                        )}
                        style={{ background: v.color }}
                      >
                        {active && <FiCheck size={13} className="text-white drop-shadow" style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,.5))" }} aria-hidden="true" />}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedColor(cName); setImgIdx(0); }}
                      className={cn(
                        "px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold border transition-colors",
                        active ? "border-2 border-[var(--accent-primary)] bg-accent-tint text-accent" : "border-default text-secondary hover:border-[var(--color-graphite-300)]"
                      )}
                    >
                      {cName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {product.sizes?.length > 0 && (
            <div className="mb-5">
              <h3 className="text-[13px] font-bold text-primary mb-2.5">Size</h3>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map((s, i) => {
                  const active = selectedSize === s.size;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedSize(s.size)}
                      className={cn(
                        "min-w-[42px] h-10 px-3 rounded-[var(--radius-sm)] text-xs font-bold border transition-colors",
                        active ? "border-2 border-[var(--accent-primary)] bg-accent-tint text-accent" : "border-default text-secondary hover:border-[var(--color-graphite-300)]"
                      )}
                    >
                      {s.size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-5 rounded-[var(--radius-md)] border border-default bg-canvas p-3.5">
            <UHDeliveryEstimate vendorName={product.vendorId?.shopName} onResult={handleDeliveryResult} />
          </div>

          {/* CTA: Desktop */}
          <div className="hidden md:block mb-6">
            {deliveryAvailable === false ? (
              <div className="px-4 py-3 rounded-[var(--radius-md)] bg-error-tint border border-[var(--color-error-100)] text-sm font-semibold text-error text-center">
                Ordering is disabled — Urbexon Hour isn't available in your area yet.
              </div>
            ) : !inCart ? (
              <Button variant="hour" className="w-full" disabled={outOfStock} icon={FiShoppingCart} size="lg" onClick={handleAdd}>
                {outOfStock ? "Out of Stock" : "Add to Cart"}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center border-2 border-[var(--accent-primary)] rounded-[var(--radius-md)] overflow-hidden">
                  <button onClick={() => qty <= 1 ? removeItem(product._id, "urbexon_hour") : decrement(product._id, "urbexon_hour")} className="w-10 h-11 flex items-center justify-center text-accent hover:bg-accent-tint transition-colors" aria-label="Decrease">
                    {qty <= 1 ? <FiTrash2 size={12} aria-hidden="true" /> : <FiMinus size={12} aria-hidden="true" />}
                  </button>
                  <span className="w-10 text-center text-base font-extrabold text-accent">{qty}</span>
                  <button onClick={() => increment(product._id, "urbexon_hour")} className="w-10 h-11 flex items-center justify-center text-accent hover:bg-accent-tint transition-colors" aria-label="Increase">
                    <FiPlus size={12} aria-hidden="true" />
                  </button>
                </div>
                {uhTotalQty > 0 && (
                  <Button variant="hour" className="flex-1" onClick={() => navigate("/uh-cart")}>
                    {uhTotalQty} item{uhTotalQty > 1 ? "s" : ""} · {fmt(uhTotal)} <FiChevronRight size={10} className="ml-1" aria-hidden="true" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {product.description && (
            <div className="mb-5 pt-1 border-t border-default">
              <h3 className="text-[15px] font-bold text-primary mt-5 mb-2 font-display">About this product</h3>
              <div className={cn("text-sm text-secondary leading-relaxed", !showFullDesc && "line-clamp-3")}>
                {product.description}
              </div>
              {product.description.length > 200 && (
                <button onClick={() => setShowFullDesc(v => !v)} className="flex items-center gap-1 text-xs font-bold text-accent mt-2">
                  {showFullDesc ? <><FiChevronUp size={10} aria-hidden="true" /> Show less</> : <><FiChevronDown size={10} aria-hidden="true" /> Read more</>}
                </button>
              )}
            </div>
          )}

          {highlights.length > 0 && (
            <div className="mb-5">
              <h3 className="text-[15px] font-bold text-primary mb-2.5 font-display">Specifications</h3>
              <div className="border border-default rounded-[var(--radius-md)] overflow-hidden">
                {highlights.map(([k, v], i) => (
                  <div key={k} className={cn("flex px-4 py-2.5 gap-4 border-b border-default last:border-b-0", i % 2 === 1 && "bg-canvas/60")}>
                    <span className="flex-[0_0_130px] text-[13px] font-semibold text-secondary">{k}</span>
                    <span className="text-[13px] font-bold text-primary flex-1">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 border border-default rounded-[var(--radius-md)] overflow-hidden mb-5">
            {product.weight && <div className="flex flex-col gap-0.5 p-3 border-b border-r border-default"><span className="text-[10px] font-bold text-muted uppercase tracking-wide">Weight</span><span className="text-[13px] font-bold text-primary">{product.weight}</span></div>}
            {product.material && <div className="flex flex-col gap-0.5 p-3 border-b border-default"><span className="text-[10px] font-bold text-muted uppercase tracking-wide">Material</span><span className="text-[13px] font-bold text-primary">{product.material}</span></div>}
            {product.origin && <div className="flex flex-col gap-0.5 p-3 border-b border-r border-default"><span className="text-[10px] font-bold text-muted uppercase tracking-wide">Origin</span><span className="text-[13px] font-bold text-primary">{product.origin}</span></div>}
            {product.sku && <div className="flex flex-col gap-0.5 p-3 border-b border-default"><span className="text-[10px] font-bold text-muted uppercase tracking-wide">SKU</span><span className="text-[13px] font-bold text-primary">{product.sku}</span></div>}
            {product.maxOrderQty && <div className="flex flex-col gap-0.5 p-3 border-r border-default"><span className="text-[10px] font-bold text-muted uppercase tracking-wide">Max Order</span><span className="text-[13px] font-bold text-primary">{product.maxOrderQty} units</span></div>}
            {product.returnPolicy && <div className="flex flex-col gap-0.5 p-3"><span className="text-[10px] font-bold text-muted uppercase tracking-wide">Returns</span><span className="text-[13px] font-bold text-primary">{product.returnPolicy}</span></div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 border border-default rounded-[var(--radius-lg)] overflow-hidden">
            <div className="flex items-start gap-3 p-3.5 border-b sm:border-b-0 sm:border-r border-default">
              <span className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center flex-shrink-0"><FiShield size={16} className="text-accent" aria-hidden="true" /></span>
              <div><strong className="block text-[11px] font-extrabold text-primary">Quality Assured</strong><span className="block text-[10px] text-secondary font-medium mt-0.5">Checked before dispatch</span></div>
            </div>
            <div className="flex items-start gap-3 p-3.5 border-b sm:border-b-0 sm:border-r border-default">
              <span className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center flex-shrink-0"><FiTruck size={16} className="text-accent" aria-hidden="true" /></span>
              <div><strong className="block text-[11px] font-extrabold text-primary">Express Delivery</strong><span className="block text-[10px] text-secondary font-medium mt-0.5">45–120 mins</span></div>
            </div>
            <div className="flex items-start gap-3 p-3.5">
              <span className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center flex-shrink-0"><FiRotateCcw size={16} className="text-accent" aria-hidden="true" /></span>
              <div><strong className="block text-[11px] font-extrabold text-primary">Easy Returns</strong><span className="block text-[10px] text-secondary font-medium mt-0.5">{product.returnPolicy || "7 days return"}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reviews — dynamic, real user reviews via /reviews/:productId ── */}
      <div className="bg-surface mt-3 py-5 px-4 md:max-w-[1160px] xl:max-w-[1280px] md:mx-auto md:mt-5 md:rounded-2xl md:shadow-sm md:border md:border-default md:py-6 md:px-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-primary font-display">Ratings & Reviews</h3>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-primary bg-warning-tint px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--color-warning-100)]">
            <FiStar size={11} className="text-[var(--color-warning-500)]" aria-hidden="true" />
            {product.rating > 0 ? product.rating.toFixed(1) : "0"}
            <span className="text-muted font-medium">({product.numReviews || 0})</span>
          </div>
        </div>

        {user ? (
          <form onSubmit={handleSubmitReview} className="mb-6 pb-6 border-b border-default">
            <p className="text-[13px] font-bold text-primary mb-2">
              {reviews.some((r) => (r.user?._id || r.user) === user._id) ? "Update your rating" : "Rate this product"}
            </p>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMyRating(s)}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`${s} star${s > 1 ? "s" : ""}`}
                  className="bg-transparent border-none cursor-pointer p-0.5"
                >
                  {(hoverRating || myRating) >= s
                    ? <FaStar size={20} className="text-amber-400" aria-hidden="true" />
                    : <FaRegStar size={20} className="text-[var(--color-graphite-300)]" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <textarea
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              maxLength={500}
              placeholder="Share your experience with this product (optional)"
              className="w-full min-h-[64px] px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-default bg-canvas text-primary outline-none focus:border-[var(--accent-primary)] mb-2.5 resize-none"
            />
            {reviewError && <p className="text-xs text-error mb-2">{reviewError}</p>}
            <Button type="submit" variant="hour" size="sm" loading={submittingReview}>
              {submittingReview ? "Submitting…" : "Submit Review"}
            </Button>
          </form>
        ) : (
          <div className="mb-6 pb-6 border-b border-default">
            <button onClick={() => navigate("/login", { state: { from: `/uh-product/${id}` } })} className="text-[13px] font-bold text-accent bg-transparent border-none cursor-pointer p-0">
              Log in to write a review
            </button>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-muted">No reviews yet — be the first to review this product!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => {
              const isMine = user && (r.user?._id || r.user) === user._id;
              return (
                <div key={r._id} className="flex gap-3 pb-4 border-b border-default last:border-b-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-accent-tint flex items-center justify-center text-accent font-bold text-xs flex-shrink-0">
                    {(r.name || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[13px] font-bold text-primary">{r.name || "Anonymous"}</span>
                        <span className="inline-flex items-center gap-0.5 ml-2 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => s <= r.rating ? <FaStar key={s} size={10} /> : <FaRegStar key={s} size={10} className="text-[var(--color-graphite-300)]" />)}
                        </span>
                      </div>
                      {isMine && (
                        <button onClick={() => handleDeleteReview(r._id)} aria-label="Delete your review" className="text-muted hover:text-error bg-transparent border-none cursor-pointer p-1">
                          <FiTrash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {r.comment && <p className="text-[13px] text-secondary mt-1 leading-relaxed">{r.comment}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div className="bg-surface mt-3 py-5 md:max-w-[1160px] xl:max-w-[1280px] md:mx-auto md:mt-5 md:rounded-2xl md:shadow-sm md:border md:border-default md:py-6">
          <div className="flex items-center justify-between px-4 md:px-6 mb-3.5">
            <h3 className="text-[15px] font-bold text-primary font-display">You might also like</h3>
            <span className="text-xs text-muted font-semibold">{related.length} items</span>
          </div>
          <div className="flex gap-3 overflow-x-auto uhpd-scroll px-4 md:px-6 pb-2">
            {related.map((p) => (
              <SuggestedCard key={p._id || p.id} product={p} onNavigate={navigateToProduct} />
            ))}
          </div>
        </div>
      )}

      <div className="h-[90px]" />

      {/* ── Sticky Bottom Bar (mobile only) ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-default shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 px-4 py-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-3 max-w-[500px] mx-auto">
          <div className="flex flex-col flex-shrink-0">
            <span className="text-xl font-black text-primary leading-tight">{fmt(displayPrice)}</span>
            {displayMrp > displayPrice && <span className="text-xs text-muted line-through">{fmt(displayMrp)}</span>}
          </div>
          {deliveryAvailable === false ? (
            <div className="flex-1 px-3 py-2.5 rounded-[var(--radius-md)] bg-error-tint border border-[var(--color-error-100)] text-xs font-semibold text-error text-center">
              Not deliverable to your area
            </div>
          ) : !inCart ? (
            <Button variant="hour" className="flex-1" disabled={outOfStock} icon={FiShoppingCart} onClick={handleAdd}>
              {outOfStock ? "Out of Stock" : "Add to Cart"}
            </Button>
          ) : (
            <div className="flex-1 flex gap-2.5 items-center">
              <div className="flex items-center border-2 border-[var(--accent-primary)] rounded-[var(--radius-md)] overflow-hidden bg-surface">
                <button onClick={() => qty <= 1 ? removeItem(product._id, "urbexon_hour") : decrement(product._id, "urbexon_hour")} className="w-10 h-11 flex items-center justify-center text-accent" aria-label="Decrease">
                  {qty <= 1 ? <FiTrash2 size={11} aria-hidden="true" /> : <FiMinus size={11} aria-hidden="true" />}
                </button>
                <span className="w-10 text-center text-base font-black text-accent">{qty}</span>
                <button onClick={() => increment(product._id, "urbexon_hour")} className="w-10 h-11 flex items-center justify-center text-accent" aria-label="Increase">
                  <FiPlus size={11} aria-hidden="true" />
                </button>
              </div>
              {uhTotalQty > 0 && (
                <Button variant="hour" className="flex-1" onClick={() => navigate("/uh-cart")}>
                  {uhTotalQty} item{uhTotalQty > 1 ? "s" : ""} · {fmt(uhTotal)} <FiChevronRight size={10} className="ml-1" aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UHProductDetail;