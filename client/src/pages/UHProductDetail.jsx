/**
 * UHProductDetail.jsx — Production-Ready | Urbexon Hour
 * ✅ Desktop: 2-column (image left, info right)
 * ✅ Mobile: single column, fully responsive
 * ✅ Clean professional UI
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useCart } from "../hooks/useCart";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import SEO, { JsonLd } from "../components/SEO";
import { UHDeliveryEstimate } from "../components/DeliveryEstimate";
import {
  FaArrowLeft, FaPlus, FaMinus, FaTrash, FaShoppingCart,
  FaClock, FaStar, FaChevronRight, FaShareAlt, FaStore,
  FaShieldAlt, FaTruck, FaUndo, FaBolt, FaChevronLeft,
  FaChevronDown, FaChevronUp, FaLink, FaMapMarkerAlt,
} from "react-icons/fa";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ── Suggested Product Card ── */
const SuggestedCard = ({ product, onNavigate }) => {
  const { addItem, isInUHCart, uhItems, increment, decrement, removeItem } = useCart();
  const inCart = isInUHCart(product._id);
  const cartItem = uhItems.find((i) => i._id === product._id);
  const qty = cartItem?.quantity || 0;
  const discount = product.mrp && product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <div className="uhd-sug-card" onClick={() => onNavigate(product)}>
      <div className="uhd-sug-img-wrap">
        {discount > 0 && <span className="uhd-sug-disc">{discount}%</span>}
        <img
          src={product.images?.[0]?.url || product.image?.url || "/placeholder.png"}
          alt={product.name} loading="lazy"
          onError={(e) => { e.target.src = "/placeholder.png"; }}
        />
      </div>
      <div className="uhd-sug-body">
        <div className="uhd-sug-name">{product.name}</div>
        {product.prepTimeMinutes && (
          <div className="uhd-sug-prep"><FaClock size={8} /> {product.prepTimeMinutes} min</div>
        )}
        <div className="uhd-sug-price-row">
          <span className="uhd-sug-price">{fmt(product.price)}</span>
          {product.mrp > product.price && <span className="uhd-sug-mrp">{fmt(product.mrp)}</span>}
        </div>
        {!inCart ? (
          <button className="uhd-sug-add" onClick={(e) => {
            e.stopPropagation();
            addItem({ ...product, productType: "urbexon_hour" });
            if (navigator.vibrate) navigator.vibrate(10);
          }}><FaPlus size={9} /> ADD</button>
        ) : (
          <div className="uhd-sug-stepper" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => qty <= 1 ? removeItem(product._id, "urbexon_hour") : decrement(product._id, "urbexon_hour")}>
              {qty <= 1 ? <FaTrash size={8} /> : <FaMinus size={8} />}
            </button>
            <span>{qty}</span>
            <button onClick={() => increment(product._id, "urbexon_hour")}><FaPlus size={8} /></button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Main Component ── */
const UHProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, isInUHCart, uhItems, increment, decrement, removeItem, uhTotalQty, uhTotal } = useCart();
  const { trackView } = useRecentlyViewed("urbexon_hour");

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [copied, setCopied] = useState(false);

  const inCart = product ? isInUHCart(product._id) : false;
  const cartItem = product ? uhItems.find((i) => i._id === product._id) : null;
  const qty = cartItem?.quantity || 0;

  const discount = useMemo(() => {
    if (!product?.mrp || product.mrp <= product.price) return 0;
    return Math.round(((product.mrp - product.price) / product.mrp) * 100);
  }, [product]);

  const images = useMemo(() => {
    if (!product) return [];
    const imgs = product.images?.length ? product.images : (product.image ? [product.image] : []);
    return imgs.length ? imgs : [{ url: "/placeholder.png" }];
  }, [product]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setImgIdx(0);
      setShowFullDesc(false);
      try {
        const { data } = await api.get(`/products/${id}`);
        if (!cancelled) { setProduct(data); trackView(data); }
        try {
          const r = await api.get(`/products/${data._id || id}/related`);
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
      alert("❌ Item out of stock");
      return;
    }
    addItem({ ...product, productType: "urbexon_hour" });
    if (navigator.vibrate) navigator.vibrate(10);
  }, [product, addItem]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product?.name, url }); } catch { }
    } else {
      try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
    }
  }, [product]);

  const navigateToProduct = useCallback((p) => {
    navigate(`/uh-product/${p.slug || p._id}`);
  }, [navigate]);

  if (loading) return (
    <div className="uhd-root"><style>{CSS}</style>
      <div className="uhd-loading"><div className="uhd-spinner" /><p>Loading product…</p></div>
    </div>
  );

  if (!product) return (
    <div className="uhd-root"><style>{CSS}</style>
      <div className="uhd-not-found">
        <div style={{ fontSize: 48 }}>😕</div>
        <h2>Product not found</h2>
        <button className="uhd-back-btn" onClick={() => navigate("/urbexon-hour")}>
          <FaArrowLeft size={12} /> Back to Urbexon Hour
        </button>
      </div>
    </div>
  );

  const highlights = product.highlightsArray?.length
    ? product.highlightsArray.map(h => [h.title, h.value])
    : product.highlights ? Object.entries(
      product.highlights instanceof Map ? Object.fromEntries(product.highlights) : product.highlights
    ) : [];

  return (
    <div className="uhd-root">
      {product && (
        <>
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
        </>
      )}
      <style>{CSS}</style>

      {/* ── Top Nav ── */}
      <div className="uhd-topnav">
        <button className="uhd-nav-btn" onClick={() => navigate(-1)}><FaArrowLeft size={16} /></button>
        <div className="uhd-nav-title">
          <FaBolt size={13} className="uhd-bolt" />
          <span>Urbexon Hour</span>
        </div>
        <div className="uhd-nav-right">
          <button className="uhd-nav-btn" onClick={handleShare} title={copied ? "Link copied!" : "Share"}>
            {copied ? <FaLink size={14} /> : <FaShareAlt size={14} />}
          </button>
        </div>
      </div>

      {/* ── Main Layout: 2-col on desktop ── */}
      <div className="uhd-layout">

        {/* ── LEFT: Gallery ── */}
        <div className="uhd-left">
          <div className="uhd-gallery-sticky">
            <div className="uhd-gallery-main">
              {images.map((img, i) => (
                <div key={i} className="uhd-gallery-slide"
                  style={{ display: i === imgIdx ? "flex" : "none" }}>
                  <img src={img.url || img} alt={product.name}
                    loading="lazy"
                    onError={(e) => { e.target.src = "/placeholder.png"; }} />
                </div>
              ))}
              {images.length > 1 && (
                <>
                  <button className="uhd-gallery-arr left"
                    onClick={() => setImgIdx(i => i > 0 ? i - 1 : images.length - 1)}>
                    <FaChevronLeft size={13} />
                  </button>
                  <button className="uhd-gallery-arr right"
                    onClick={() => setImgIdx(i => i < images.length - 1 ? i + 1 : 0)}>
                    <FaChevronRight size={13} />
                  </button>
                </>
              )}
              {discount > 0 && <span className="uhd-disc-badge">{discount}% OFF</span>}
            </div>

            {/* Dots */}
            {images.length > 1 && (
              <div className="uhd-gallery-dots">
                {images.map((_, i) => (
                  <button key={i} className={`uhd-dot ${i === imgIdx ? "active" : ""}`}
                    onClick={() => setImgIdx(i)} />
                ))}
              </div>
            )}

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="uhd-thumbs">
                {images.map((img, i) => (
                  <button key={i} className={`uhd-thumb ${i === imgIdx ? "active" : ""}`}
                    onClick={() => setImgIdx(i)}>
                    <img src={img.url || img} alt=""
                      loading="lazy"
                      onError={(e) => { e.target.src = "/placeholder.png"; }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Product Info ── */}
        <div className="uhd-right">

          {/* Brand + Category */}
          {(product.brand || product.category) && (
            <div className="uhd-meta-row">
              {product.brand && <span className="uhd-brand">{product.brand}</span>}
              {product.category && <span className="uhd-cat">{product.category}</span>}
            </div>
          )}

          {/* Name */}
          <h1 className="uhd-name">{product.name}</h1>

          {/* Rating + Prep + Vendor */}
          <div className="uhd-sub-row">
            {product.rating > 0 && (
              <div className="uhd-rating">
                <FaStar size={11} className="uhd-star" />
                <span>{product.rating.toFixed(1)}</span>
                {product.numReviews > 0 && <span className="uhd-reviews">({product.numReviews})</span>}
              </div>
            )}
            {product.prepTimeMinutes && (
              <div className="uhd-prep-tag"><FaClock size={11} /> {product.prepTimeMinutes} min prep</div>
            )}
            {product.vendorId?.shopName && (
              <div className="uhd-vendor-tag"><FaStore size={10} /> {product.vendorId.shopName}</div>
            )}
          </div>

          {/* Express Delivery Estimate */}
          <UHDeliveryEstimate vendorName={product.vendorId?.shopName} />

          {/* Price */}
          <div className="uhd-price-block">
            <span className="uhd-price">{fmt(product.price)}</span>
            {product.mrp > product.price && (
              <>
                <span className="uhd-mrp">{fmt(product.mrp)}</span>
                <span className="uhd-save">Save {fmt(product.mrp - product.price)}</span>
              </>
            )}
          </div>

          {/* Inclusive of taxes */}
          <p className="uhd-tax-note">Inclusive of all taxes (GST)</p>

          {/* ── CTA: Desktop ── */}
          <div className="uhd-cta-desktop">
            {!inCart ? (
              <button className="uhd-cta-add" onClick={handleAdd}>
                <FaShoppingCart size={16} /> Add to Cart
              </button>
            ) : (
              <div className="uhd-cta-row">
                <div className="uhd-cta-stepper">
                  <button onClick={() => qty <= 1 ? removeItem(product._id, "urbexon_hour") : decrement(product._id, "urbexon_hour")}>
                    {qty <= 1 ? <FaTrash size={12} /> : <FaMinus size={12} />}
                  </button>
                  <span>{qty}</span>
                  <button onClick={() => increment(product._id, "urbexon_hour")}><FaPlus size={12} /></button>
                </div>
                {uhTotalQty > 0 && (
                  <button className="uhd-cta-checkout" onClick={() => navigate("/uh-cart")}>
                    {uhTotalQty} item{uhTotalQty > 1 ? "s" : ""} · {fmt(uhTotal)} <FaChevronRight size={10} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="uhd-section">
              <h3 className="uhd-section-title">About this product</h3>
              <div className={`uhd-desc-text ${showFullDesc ? "expanded" : ""}`}>
                {product.description}
              </div>
              {product.description.length > 200 && (
                <button className="uhd-desc-toggle" onClick={() => setShowFullDesc(v => !v)}>
                  {showFullDesc ? <><FaChevronUp size={10} /> Show less</> : <><FaChevronDown size={10} /> Read more</>}
                </button>
              )}
            </div>
          )}

          {/* Specifications */}
          {highlights.length > 0 && (
            <div className="uhd-section">
              <h3 className="uhd-section-title">Specifications</h3>
              <div className="uhd-specs-grid">
                {highlights.map(([k, v]) => (
                  <div key={k} className="uhd-spec-item">
                    <span className="uhd-spec-key">{k}</span>
                    <span className="uhd-spec-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Details */}
          <div className="uhd-details-grid">
            {product.weight && <div className="uhd-detail-item"><span className="uhd-detail-key">Weight</span><span className="uhd-detail-val">{product.weight}</span></div>}
            {product.material && <div className="uhd-detail-item"><span className="uhd-detail-key">Material</span><span className="uhd-detail-val">{product.material}</span></div>}
            {product.origin && <div className="uhd-detail-item"><span className="uhd-detail-key">Origin</span><span className="uhd-detail-val">{product.origin}</span></div>}
            {product.sku && <div className="uhd-detail-item"><span className="uhd-detail-key">SKU</span><span className="uhd-detail-val">{product.sku}</span></div>}
            {product.maxOrderQty && <div className="uhd-detail-item"><span className="uhd-detail-key">Max Order</span><span className="uhd-detail-val">{product.maxOrderQty} units</span></div>}
            {product.returnPolicy && <div className="uhd-detail-item"><span className="uhd-detail-key">Returns</span><span className="uhd-detail-val">{product.returnPolicy}</span></div>}
          </div>

          {/* Trust badges */}
          <div className="uhd-trust">
            <div className="uhd-trust-item">
              <FaShieldAlt size={20} className="uhd-trust-ic" />
              <div><strong>Quality Assured</strong><span>Checked before dispatch</span></div>
            </div>
            <div className="uhd-trust-item">
              <FaTruck size={20} className="uhd-trust-ic" />
              <div><strong>Express Delivery</strong><span>45–120 mins</span></div>
            </div>
            <div className="uhd-trust-item">
              <FaUndo size={20} className="uhd-trust-ic" />
              <div><strong>Easy Returns</strong><span>{product.returnPolicy || "7 days return"}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Suggested Products ── */}
      {related.length > 0 && (
        <div className="uhd-suggested">
          <div className="uhd-sug-header">
            <h3 className="uhd-section-title">You might also like</h3>
            <span className="uhd-sug-count">{related.length} items</span>
          </div>
          <div className="uhd-sug-scroll">
            {related.map((p) => (
              <SuggestedCard key={p._id} product={p} onNavigate={navigateToProduct} />
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 90 }} />

      {/* ── Sticky Bottom Bar (mobile only) ── */}
      <div className="uhd-bottom-bar">
        <div className="uhd-bottom-inner">
          <div className="uhd-bottom-price">
            <span className="uhd-bottom-amount">{fmt(product.price)}</span>
            {product.mrp > product.price && <span className="uhd-bottom-mrp">{fmt(product.mrp)}</span>}
          </div>
          {!inCart ? (
            <button className="uhd-bottom-add" onClick={handleAdd}>
              <FaShoppingCart size={14} /> Add to Cart
            </button>
          ) : (
            <div className="uhd-bottom-stepper-wrap">
              <div className="uhd-bottom-stepper">
                <button onClick={() => qty <= 1 ? removeItem(product._id, "urbexon_hour") : decrement(product._id, "urbexon_hour")}>
                  {qty <= 1 ? <FaTrash size={11} /> : <FaMinus size={11} />}
                </button>
                <span>{qty}</span>
                <button onClick={() => increment(product._id, "urbexon_hour")}><FaPlus size={11} /></button>
              </div>
              {uhTotalQty > 0 && (
                <button className="uhd-bottom-checkout" onClick={() => navigate("/uh-cart")}>
                  {uhTotalQty} item{uhTotalQty > 1 ? "s" : ""} · {fmt(uhTotal)} <FaChevronRight size={10} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════
   CSS — Production Ready
   ══════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.uhd-root {
  min-height: 100vh;
  background: #f1f5f9;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #1a202c;
}

/* ── Loading / Not Found ── */
.uhd-loading {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 60vh; gap: 14px;
  color: #64748b; font-size: 14px;
}
.uhd-spinner {
  width: 36px; height: 36px;
  border: 3px solid #e2e8f0; border-top: 3px solid #2563eb;
  border-radius: 50%; animation: uhdspin .7s linear infinite;
}
@keyframes uhdspin { to { transform: rotate(360deg); } }
.uhd-not-found {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 60vh; gap: 16px;
  text-align: center; padding: 24px;
}
.uhd-not-found h2 { font-size: 20px; font-weight: 800; color: #1f2937; }
.uhd-back-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px; background: #2563eb; color: #fff;
  border: none; border-radius: 10px; font-weight: 700;
  font-size: 13px; cursor: pointer; font-family: inherit;
}

/* ── Top Nav ── */
.uhd-topnav {
  position: sticky; top: 0; z-index: 40; background: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 6px rgba(0,0,0,.06);
}
.uhd-nav-btn {
  width: 40px; height: 40px; border-radius: 10px; border: none;
  background: #f8fafc; cursor: pointer; display: flex;
  align-items: center; justify-content: center; color: #374151;
  transition: background .15s;
}
.uhd-nav-btn:hover { background: #e5e7eb; }
.uhd-nav-title {
  display: flex; align-items: center; gap: 7px;
  font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -.2px;
}
.uhd-bolt { color: #2563eb; }
.uhd-nav-right { display: flex; gap: 8px; }

/* ── Main 2-column Layout ── */
.uhd-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}

@media (min-width: 900px) {
  .uhd-layout {
    grid-template-columns: 460px 1fr;
    gap: 0;
    align-items: start;
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 24px 0;
  }
}

/* ── LEFT: Gallery ── */
.uhd-left {
  background: #fff;
}

@media (min-width: 900px) {
  .uhd-left {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,.06);
  }
  .uhd-gallery-sticky {
    position: sticky;
    top: 72px;  /* below topnav */
  }
}

.uhd-gallery-main {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #f8fafc;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}

.uhd-gallery-slide {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.uhd-gallery-slide img {
  max-width: 100%; max-height: 100%;
  object-fit: contain;
}
.uhd-gallery-arr {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 38px; height: 38px; border-radius: 50%; border: none;
  background: rgba(255,255,255,.95); box-shadow: 0 2px 10px rgba(0,0,0,.12);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: #374151; z-index: 5; transition: all .2s;
}
.uhd-gallery-arr:hover { box-shadow: 0 4px 16px rgba(0,0,0,.18); }
.uhd-gallery-arr.left { left: 12px; }
.uhd-gallery-arr.right { right: 12px; }
.uhd-disc-badge {
  position: absolute; top: 14px; left: 14px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff; font-size: 12px; font-weight: 800;
  padding: 5px 11px; border-radius: 8px; z-index: 5;
  letter-spacing: .2px;
}
.uhd-gallery-dots {
  display: flex; justify-content: center; gap: 6px; padding: 12px 0 8px;
}
.uhd-dot {
  width: 8px; height: 8px; border-radius: 50%;
  border: none; background: #d1d5db; cursor: pointer;
  transition: all .2s; padding: 0;
}
.uhd-dot.active { background: #2563eb; width: 22px; border-radius: 4px; }
.uhd-thumbs {
  display: flex; gap: 8px; padding: 0 16px 16px;
  overflow-x: auto; scrollbar-width: none;
}
.uhd-thumbs::-webkit-scrollbar { display: none; }
.uhd-thumb {
  width: 60px; height: 60px; flex-shrink: 0;
  border-radius: 10px; border: 2px solid #e5e7eb;
  overflow: hidden; cursor: pointer; padding: 0;
  background: #fff; transition: border-color .2s;
}
.uhd-thumb.active { border-color: #2563eb; }
.uhd-thumb img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }

/* ── RIGHT: Info ── */
.uhd-right {
  background: #fff;
  padding: 20px 16px 24px;
  margin-top: 8px;
}

@media (min-width: 900px) {
  .uhd-right {
    margin-top: 0;
    margin-left: 16px;
    border-radius: 16px;
    padding: 28px 28px 32px;
    box-shadow: 0 2px 12px rgba(0,0,0,.06);
  }
}

.uhd-meta-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px; flex-wrap: wrap;
}
.uhd-brand {
  font-size: 11px; font-weight: 800; color: #4f46e5;
  text-transform: uppercase; letter-spacing: .7px;
}
.uhd-cat {
  font-size: 11px; font-weight: 600; color: #64748b;
  background: #f1f5f9; padding: 3px 10px; border-radius: 5px;
}
.uhd-name {
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 900; color: #0f172a;
  line-height: 1.25; margin-bottom: 10px;
  letter-spacing: -.4px;
}
.uhd-sub-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 10px; flex-wrap: wrap;
}
.uhd-rating {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 700; color: #1f2937;
  background: #fffbeb; padding: 4px 10px;
  border-radius: 6px; border: 1px solid #fde68a;
}
.uhd-star { color: #f59e0b; }
.uhd-reviews { color: #9ca3af; font-weight: 500; font-size: 12px; }
.uhd-prep-tag {
  display: flex; align-items: center; gap: 4px;
  font-size: 12px; color: #64748b; font-weight: 600;
}
.uhd-vendor-tag {
  display: flex; align-items: center; gap: 4px;
  font-size: 12px; color: #2563eb; font-weight: 600;
}
.uhd-location-tag {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #16a34a; font-weight: 600;
  margin-bottom: 14px;
}

/* Price */
.uhd-price-block {
  display: flex; align-items: baseline; gap: 10px;
  margin-bottom: 4px; flex-wrap: wrap;
}
.uhd-price { font-size: 32px; font-weight: 900; color: #0f172a; }
.uhd-mrp {
  font-size: 17px; color: #9ca3af;
  text-decoration: line-through; font-weight: 500;
}
.uhd-save {
  font-size: 13px; font-weight: 700; color: #16a34a;
  background: #dcfce7; padding: 4px 10px; border-radius: 6px;
}
.uhd-tax-note {
  font-size: 11px; color: #94a3b8; margin-bottom: 16px; font-weight: 500;
}

/* Delivery */
.uhd-delivery-badge {
  display: flex; align-items: center; gap: 10px;
  background: #f0fdf4; border: 1px solid #86efac;
  border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;
  font-size: 13px; color: #166534; font-weight: 600;
}
.uhd-delivery-badge strong { font-weight: 800; }

/* Desktop CTA */
.uhd-cta-desktop { display: none; }
@media (min-width: 900px) {
  .uhd-cta-desktop { display: block; margin-bottom: 24px; }
}
.uhd-cta-add {
  width: 100%; padding: 16px 24px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border: none; border-radius: 12px; color: #fff;
  font-weight: 800; font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  font-family: inherit; transition: all .2s;
  box-shadow: 0 4px 14px rgba(37,99,235,.35);
}
.uhd-cta-add:hover {
  box-shadow: 0 6px 20px rgba(37,99,235,.45);
  transform: translateY(-1px);
}
.uhd-cta-row { display: flex; align-items: center; gap: 12px; }
.uhd-cta-stepper {
  display: flex; align-items: center;
  border: 2px solid #2563eb; border-radius: 12px; overflow: hidden;
}
.uhd-cta-stepper button {
  width: 44px; height: 48px; border: none; background: transparent;
  color: #2563eb; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  font-size: 14px; transition: background .15s;
}
.uhd-cta-stepper button:hover { background: #eff6ff; }
.uhd-cta-stepper span {
  width: 44px; text-align: center;
  font-size: 17px; font-weight: 900; color: #2563eb;
}
.uhd-cta-checkout {
  flex: 1; padding: 14px 16px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border: none; border-radius: 12px; color: #fff;
  font-weight: 800; font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-family: inherit; transition: all .2s;
  box-shadow: 0 4px 14px rgba(37,99,235,.3);
  white-space: nowrap;
}

/* Sections */
.uhd-section { margin-bottom: 22px; }
.uhd-section-title {
  font-size: 15px; font-weight: 800; color: #0f172a;
  margin-bottom: 12px; letter-spacing: -.2px;
}
.uhd-desc-text {
  font-size: 14px; color: #475569; line-height: 1.75;
  max-height: 78px; overflow: hidden; transition: max-height .35s ease;
}
.uhd-desc-text.expanded { max-height: 2000px; }
.uhd-desc-toggle {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; color: #2563eb; font-weight: 700;
  background: none; border: none; cursor: pointer;
  padding: 6px 0; font-family: inherit;
}

/* Specs */
.uhd-specs-grid {
  border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;
}
.uhd-spec-item {
  display: flex; padding: 11px 16px;
  border-bottom: 1px solid #f3f4f6; gap: 16px;
}
.uhd-spec-item:last-child { border-bottom: none; }
.uhd-spec-key { flex: 0 0 130px; font-size: 13px; font-weight: 600; color: #64748b; }
.uhd-spec-val { font-size: 13px; font-weight: 700; color: #1f2937; flex: 1; }

/* Details */
.uhd-details-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  border: 1px solid #e5e7eb; border-radius: 10px;
  overflow: hidden; margin-bottom: 22px;
}
.uhd-detail-item {
  display: flex; flex-direction: column; gap: 3px;
  padding: 12px 14px; border-bottom: 1px solid #f3f4f6;
  border-right: 1px solid #f3f4f6;
}
.uhd-detail-item:nth-child(even) { border-right: none; }
.uhd-detail-item:nth-last-child(-n+2) { border-bottom: none; }
.uhd-detail-key {
  font-size: 10px; font-weight: 700; color: #94a3b8;
  text-transform: uppercase; letter-spacing: .5px;
}
.uhd-detail-val { font-size: 13px; font-weight: 700; color: #1f2937; }

/* Trust */
.uhd-trust {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 0; border: 1px solid #e5e7eb; border-radius: 12px;
  overflow: hidden; margin-bottom: 8px;
}
.uhd-trust-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 14px 12px; border-right: 1px solid #f3f4f6;
}
.uhd-trust-item:last-child { border-right: none; }
.uhd-trust-ic { color: #2563eb; flex-shrink: 0; margin-top: 1px; }
.uhd-trust-item strong {
  display: block; font-size: 11px; font-weight: 800;
  color: #0f172a; letter-spacing: .1px;
}
.uhd-trust-item span {
  display: block; font-size: 10px; color: #64748b;
  font-weight: 500; margin-top: 2px;
}

/* Suggested */
.uhd-suggested {
  background: #fff;
  margin-top: 12px;
  padding: 20px 0;
}
@media (min-width: 900px) {
  .uhd-suggested {
    max-width: 1200px;
    margin: 16px auto 0;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,.06);
    padding: 24px 0;
  }
  .uhd-sug-header {
    padding: 0 24px;
  }
  .uhd-sug-scroll {
    padding: 0 24px 12px;
  }
}
.uhd-sug-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; margin-bottom: 14px;
}
.uhd-sug-count { font-size: 12px; color: #94a3b8; font-weight: 600; }
.uhd-sug-scroll {
  display: flex; gap: 12px; overflow-x: auto;
  padding: 0 16px 8px; scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.uhd-sug-scroll::-webkit-scrollbar { display: none; }
.uhd-sug-card {
  min-width: 150px; max-width: 165px; flex-shrink: 0;
  scroll-snap-align: start; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 12px;
  overflow: hidden; cursor: pointer; transition: all .2s;
}
.uhd-sug-card:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 14px rgba(37,99,235,.1);
  transform: translateY(-2px);
}
.uhd-sug-img-wrap {
  position: relative; aspect-ratio: 1;
  background: #f8fafc; overflow: hidden;
}
.uhd-sug-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
.uhd-sug-disc {
  position: absolute; top: 6px; left: 6px;
  background: #ef4444; color: #fff;
  font-size: 9px; font-weight: 800;
  padding: 2px 6px; border-radius: 4px;
}
.uhd-sug-body { padding: 10px; }
.uhd-sug-name {
  font-size: 12px; font-weight: 700; color: #1f2937;
  line-height: 1.3; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; margin-bottom: 4px;
}
.uhd-sug-prep {
  display: flex; align-items: center; gap: 3px;
  font-size: 10px; color: #94a3b8; margin-bottom: 4px;
}
.uhd-sug-price-row {
  display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px;
}
.uhd-sug-price { font-size: 14px; font-weight: 800; color: #0f172a; }
.uhd-sug-mrp { font-size: 11px; color: #9ca3af; text-decoration: line-through; }
.uhd-sug-add {
  width: 100%; padding: 7px;
  background: #fff; border: 1.5px solid #2563eb;
  color: #2563eb; font-weight: 700; font-size: 12px;
  border-radius: 7px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  gap: 4px; transition: all .2s; font-family: inherit;
}
.uhd-sug-add:hover { background: #2563eb; color: #fff; }
.uhd-sug-stepper {
  display: flex; align-items: center; justify-content: space-between;
  border: 1.5px solid #2563eb; border-radius: 7px; overflow: hidden;
}
.uhd-sug-stepper button {
  width: 28px; height: 28px; border: none; background: transparent;
  color: #2563eb; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.uhd-sug-stepper span {
  flex: 1; text-align: center;
  font-size: 13px; font-weight: 800; color: #2563eb;
}

/* ── Sticky Bottom Bar (MOBILE only) ── */
.uhd-bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #fff; border-top: 1px solid #e5e7eb;
  box-shadow: 0 -4px 20px rgba(0,0,0,.08);
  z-index: 50; padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
@media (min-width: 900px) {
  .uhd-bottom-bar { display: none; }  /* hide on desktop — CTA is inline */
}
.uhd-bottom-inner {
  display: flex; align-items: center; gap: 12px;
  max-width: 500px; margin: 0 auto;
}
.uhd-bottom-price { display: flex; flex-direction: column; }
.uhd-bottom-amount { font-size: 20px; font-weight: 900; color: #0f172a; }
.uhd-bottom-mrp { font-size: 12px; color: #9ca3af; text-decoration: line-through; }
.uhd-bottom-add {
  flex: 1; padding: 14px 20px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border: none; border-radius: 12px; color: #fff;
  font-weight: 800; font-size: 15px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-family: inherit; transition: all .2s;
  box-shadow: 0 4px 12px rgba(37,99,235,.3);
}
.uhd-bottom-stepper-wrap { flex: 1; display: flex; gap: 10px; align-items: center; }
.uhd-bottom-stepper {
  display: flex; align-items: center;
  border: 2px solid #2563eb; border-radius: 10px; overflow: hidden; background: #fff;
}
.uhd-bottom-stepper button {
  width: 40px; height: 44px; border: none; background: transparent;
  color: #2563eb; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; transition: background .15s;
}
.uhd-bottom-stepper button:hover { background: #eff6ff; }
.uhd-bottom-stepper span {
  width: 40px; text-align: center;
  font-size: 16px; font-weight: 900; color: #2563eb;
}
.uhd-bottom-checkout {
  flex: 1; padding: 12px 14px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border: none; border-radius: 10px; color: #fff;
  font-weight: 800; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-family: inherit; transition: all .2s;
  box-shadow: 0 4px 12px rgba(37,99,235,.3); white-space: nowrap;
}

/* ── Mobile Tweaks ── */
@media (max-width: 480px) {
  .uhd-trust { grid-template-columns: 1fr; }
  .uhd-trust-item { border-right: none; border-bottom: 1px solid #f3f4f6; }
  .uhd-trust-item:last-child { border-bottom: none; }
  .uhd-details-grid { grid-template-columns: 1fr; }
  .uhd-detail-item { border-right: none; }
  .uhd-detail-item:nth-last-child(-n+2) { border-bottom: 1px solid #f3f4f6; }
  .uhd-detail-item:last-child { border-bottom: none; }
  .uhd-name { font-size: 20px; }
  .uhd-price { font-size: 26px; }
}
`;

export default UHProductDetail;