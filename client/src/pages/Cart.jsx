/**
 * Cart.jsx — Production Ready v4.0
 * ✅ Dual cart: Ecommerce + Urbexon Hour (tabs when both have items)
 * ✅ Correct cartType dispatch for inc/dec/remove
 * ✅ Coupon validation from server
 * ✅ Out-of-stock items greyed out (not removed)
 * ✅ Beautiful responsive UI
 */
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useState, useMemo, useCallback, useEffect } from "react";
import SEO from "../components/SEO";
import {
  selectEcommerceItems,
  selectUHItems,
  selectEcommerceTotalItems,
  selectUHTotalItems,
  selectEcommerceTotalPrice,
  selectUHTotalPrice,
  incQty,
  decQty,
  removeFromCart,
  clearEcommerceCart,
  clearUHCart,
  clearCart,
} from "../features/cart/cartSlice";
import api from "../api/axios";
import { FaTrash, FaShoppingBag, FaBolt, FaTag, FaArrowRight, FaTimes, FaPlus, FaMinus, FaBan } from "react-icons/fa";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const CSS = `
*{box-sizing:border-box}
.cart-root{min-height:100vh;background:#f8fafc;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px clamp(12px,4vw,40px)}
.cart-inner{max-width:1100px;margin:0 auto}
.cart-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.cart-title{font-size:clamp(18px,3vw,24px);font-weight:800;color:#111827;letter-spacing:-.3px}
.cart-clear{background:none;border:1px solid #fecaca;color:#dc2626;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
.cart-clear:hover{background:#fef2f2;border-color:#f87171}
.cart-layout{display:grid;grid-template-columns:1fr 340px;gap:20px}
@media(max-width:860px){.cart-layout{grid-template-columns:1fr}}
.cart-items{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.cart-item{display:grid;grid-template-columns:80px 1fr auto auto;align-items:center;gap:12px;padding:16px;border-bottom:1px solid #f3f4f6;transition:background .15s}
.cart-item:last-child{border-bottom:none}
.cart-item:hover{background:#f9fafb}
.cart-img{width:80px;height:80px;object-fit:cover;border-radius:10px;background:#f3f4f6}
.cart-name{font-size:13px;font-weight:600;color:#111827;line-height:1.4;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cart-price{font-size:15px;font-weight:800;color:#111827}
.cart-mrp{font-size:11px;color:#94a3b8;text-decoration:line-through;margin-left:6px}
.cart-badge{display:inline-block;background:#f0fdf4;color:#16a34a;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;margin-top:4px}
.qty-box{display:flex;align-items:center;gap:0;border:1.5px solid #e5e7eb;border-radius:8px;overflow:hidden}
.qty-btn{width:30px;height:30px;border:none;background:#f9fafb;cursor:pointer;font-size:14px;color:#374151;display:flex;align-items:center;justify-content:center;transition:background .15s}
.qty-btn:hover{background:#e5e7eb}
.qty-num{width:36px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#111827;border-left:1.5px solid #e5e7eb;border-right:1.5px solid #e5e7eb}
.cart-rm{background:none;border:none;color:#cbd5e1;cursor:pointer;padding:6px;border-radius:6px;transition:color .15s}
.cart-rm:hover{color:#ef4444}
.cart-side{display:flex;flex-direction:column;gap:14px}
.coupon-box{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.coupon-row{display:flex;gap:8px;margin-top:10px}
.coupon-inp{flex:1;padding:10px 13px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;transition:border .15s;font-family:'Plus Jakarta Sans',sans-serif}
.coupon-inp:focus{border-color:#111827}
.coupon-btn{padding:10px 16px;background:#111827;border:none;color:#fff;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer;white-space:nowrap;font-family:'Plus Jakarta Sans',sans-serif;transition:background .15s}
.coupon-btn:hover{background:#374151}
.coupon-ok{color:#059669;font-size:12px;font-weight:600;margin-top:8px}
.coupon-err{color:#dc2626;font-size:12px;margin-top:8px}
.summary-box{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.sum-row{display:flex;justify-content:space-between;font-size:13px;color:#64748b;margin-bottom:10px}
.sum-row.total{font-size:16px;font-weight:800;color:#111827;border-top:1.5px solid #e5e7eb;padding-top:12px;margin-top:4px}
.sum-row.saving{color:#059669;font-weight:600}
.checkout-btn{width:100%;padding:14px;background:#111827;border:none;color:#fff;font-size:14px;font-weight:800;letter-spacing:.5px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;margin-top:4px;font-family:'Plus Jakarta Sans',sans-serif}
.checkout-btn:hover{background:#1e293b;box-shadow:0 6px 20px rgba(17,24,39,.15);transform:translateY(-1px)}
.empty-cart{text-align:center;padding:80px 20px}
.empty-icon{font-size:56px;margin-bottom:16px;opacity:.3}
.uh-badge{display:inline-flex;align-items:center;gap:5px;background:#fefce8;border:1px solid #fde68a;color:#92400e;font-size:10px;font-weight:700;padding:3px 10px;border-radius:12px;letter-spacing:.5px;text-transform:uppercase}
.cart-tab{padding:10px 20px;border:none;border-radius:8px 8px 0 0;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif}
.cart-tab.active{background:#fff;color:#111827;border:1px solid #e5e7eb;border-bottom:none}
.cart-tab:not(.active){background:#f3f4f6;color:#94a3b8}
.cart-item.oos{opacity:.55;position:relative;pointer-events:none}
.cart-item.oos .cart-img{filter:grayscale(.6)}
.cart-item.oos .qty-box,.cart-item.oos .cart-rm{pointer-events:auto}
.oos-badge{display:inline-flex;align-items:center;gap:4px;background:#fef2f2;color:#dc2626;font-size:10px;font-weight:700;padding:3px 9px;border-radius:6px;border:1px solid #fecaca;margin-top:5px;letter-spacing:.3px;text-transform:uppercase}
.oos-banner{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;color:#dc2626;font-size:13px;font-weight:600}
`;

const Cart = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const ecItems = useSelector(selectEcommerceItems);
  const uhItems = useSelector(selectUHItems);
  const ecCount = useSelector(selectEcommerceTotalItems);
  const uhCount = useSelector(selectUHTotalItems);
  const ecPrice = useSelector(selectEcommerceTotalPrice);
  const uhPrice = useSelector(selectUHTotalPrice);

  const hasEc = ecItems.length > 0;
  const hasUh = uhItems.length > 0;
  const hasBoth = hasEc && hasUh;

  // Active tab for dual cart
  const [activeTab, setActiveTab] = useState(hasUh && !hasEc ? "uh" : "ec");
  const isUH = activeTab === "uh";
  const activeItems = isUH ? uhItems : ecItems;
  const activeCount = isUH ? uhCount : ecCount;
  const activePrice = isUH ? uhPrice : ecPrice;
  const cartType = isUH ? "urbexon_hour" : "ecommerce";

  // Stock validation
  const [stockMap, setStockMap] = useState({});
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    const allItems = [...ecItems, ...uhItems];
    if (allItems.length === 0) return;
    const uniqueIds = [...new Set(allItems.map(i => i._id))];
    let cancelled = false;
    setStockLoading(true);
    Promise.all(
      uniqueIds.map(id =>
        api.get(`/products/${id}`).then(r => {
          const p = r.data?.product || r.data;
          return { id, stock: p?.stock ?? 0, inStock: p?.inStock !== false && (p?.stock ?? 0) > 0 };
        }).catch(() => ({ id, stock: -1, inStock: true }))
      )
    ).then(results => {
      if (cancelled) return;
      const map = {};
      results.forEach(r => { map[r.id] = r; });
      setStockMap(map);
    }).finally(() => { if (!cancelled) setStockLoading(false); });
    return () => { cancelled = true; };
  }, [ecItems.length, uhItems.length]);

  const isOOS = useCallback((item) => {
    const info = stockMap[item._id];
    if (!info || info.stock === -1) return false; // couldn't fetch, don't block
    return !info.inStock || info.stock === 0;
  }, [stockMap]);

  const inStockItems = useMemo(() => activeItems.filter(i => !isOOS(i)), [activeItems, isOOS]);
  const oosItems = useMemo(() => activeItems.filter(i => isOOS(i)), [activeItems, isOOS]);

  const inStockPrice = useMemo(() => inStockItems.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0), [inStockItems]);
  const inStockCount = useMemo(() => inStockItems.reduce((s, i) => s + (i.quantity || 0), 0), [inStockItems]);

  const [couponCode, setCouponCode] = useState("");
  const [couponData, setCouponData] = useState(null);
  const [couponErr, setCouponErr] = useState("");
  const [applying, setApplying] = useState(false);

  const discount = couponData?.discount || 0;

  const { delivery, platform, total } = useMemo(() => {
    const d = isUH ? 25 : (inStockPrice >= 499 ? 0 : 49);
    const p = 11;
    return { delivery: d, platform: p, total: inStockPrice - discount + d + p, estimated: true };
  }, [inStockPrice, discount, isUH]);

  const applyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    setApplying(true); setCouponErr(""); setCouponData(null);
    try {
      const { data } = await api.post("/coupons/validate", {
        code: couponCode.trim(),
        orderTotal: inStockPrice,
        orderType: isUH ? "urbexon_hour" : "ecommerce",
      });
      setCouponData(data);
    } catch (e) {
      setCouponErr(e.response?.data?.message || "Invalid coupon");
    } finally { setApplying(false); }
  }, [couponCode, inStockPrice, isUH]);

  const removeCoupon = () => { setCouponData(null); setCouponCode(""); setCouponErr(""); };

  // Switch tab resets coupon
  const switchTab = (tab) => { setActiveTab(tab); removeCoupon(); };

  // Reset coupon when cart total changes significantly (items added/removed)
  useEffect(() => {
    if (couponData && couponData.minOrderValue && inStockPrice < couponData.minOrderValue) {
      removeCoupon();
    }
  }, [inStockPrice]); // eslint-disable-line

  if (!hasEc && !hasUh) {
    return (
      <div className="cart-root">
        <style>{CSS}</style>
        <div className="empty-cart">
          <div className="empty-icon">🛒</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1740", marginBottom: 8 }}>Your cart is empty</h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Add some products to start shopping!</p>
          <button onClick={() => navigate("/")} style={{ padding: "12px 28px", background: "#1a1740", border: "none", color: "#c9a84c", fontWeight: 700, fontSize: 13, borderRadius: 8, cursor: "pointer" }}>
            Start Shopping →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-root">
      <SEO title="Cart" noindex />
      <style>{CSS}</style>

      <div className="cart-inner">
        <div className="cart-head">
          <div>
            {hasBoth && (
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                <button className={`cart-tab${activeTab === "ec" ? " active" : ""}`} onClick={() => switchTab("ec")}>
                  🛍 Store ({ecCount})
                </button>
                <button className={`cart-tab${activeTab === "uh" ? " active" : ""}`} onClick={() => switchTab("uh")}>
                  ⚡ Urbexon Hour ({uhCount})
                </button>
              </div>
            )}
            <h1 className="cart-title">
              {isUH ? <><span style={{ color: "#c9a84c" }}>⚡</span> Urbexon Hour Cart</> : "Shopping Cart"}
              <span style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginLeft: 8 }}>({activeCount} items)</span>
            </h1>
            {isUH && <div className="uh-badge" style={{ marginTop: 6 }}><FaBolt size={9} />Fast Delivery • 45-120 mins</div>}
          </div>
          <button className="cart-clear" onClick={() => dispatch(isUH ? clearUHCart() : clearEcommerceCart())}>
            <FaTimes size={11} style={{ marginRight: 4 }} />Clear Cart
          </button>
        </div>

        <div className="cart-layout">
          {/* LEFT — Items */}
          <div>
            {oosItems.length > 0 && (
              <div className="oos-banner">
                <FaBan size={14} />
                {oosItems.length} item{oosItems.length > 1 ? "s" : ""} in your cart {oosItems.length > 1 ? "are" : "is"} out of stock
              </div>
            )}
            <div className="cart-items">
              {activeItems.map((item, idx) => {
                const oos = isOOS(item);
                return (
                  <div key={`${item._id}-${idx}`} className={`cart-item${oos ? " oos" : ""}`}>
                    <Link to={`/products/${item.slug || item._id}`} style={{ pointerEvents: oos ? "none" : "auto" }}>
                      <img
                        className="cart-img"
                        src={item?.images?.[0]?.url || item?.image || "/placeholder.png"}
                        alt={item.name}
                        onError={e => { e.target.src = "/placeholder.png"; }}
                      />
                    </Link>
                    <div>
                      <Link to={`/products/${item.slug || item._id}`} style={{ pointerEvents: oos ? "none" : "auto" }}>
                        <div className="cart-name">{item.name}</div>
                      </Link>
                      <div>
                        <span className="cart-price" style={oos ? { color: "#94a3b8" } : {}}>{fmt(item.price)}</span>
                        {item.mrp > item.price && <span className="cart-mrp">{fmt(item.mrp)}</span>}
                      </div>
                      {item.selectedSize && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>Size: {item.selectedSize}</div>}
                      {item.productType === "urbexon_hour" && !oos && <div className="uh-badge" style={{ marginTop: 4 }}><FaBolt size={8} />Express</div>}
                      {oos && <div className="oos-badge"><FaBan size={9} />Out of Stock</div>}
                    </div>
                    {!oos ? (
                      <div className="qty-box">
                        <button className="qty-btn" onClick={() => dispatch(decQty({ id: item._id, cartType }))}><FaMinus size={10} /></button>
                        <span className="qty-num">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => dispatch(incQty({ id: item._id, cartType }))}><FaPlus size={10} /></button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textAlign: "center" }}>Unavailable</div>
                    )}
                    <button className="cart-rm" style={{ pointerEvents: "auto", opacity: 1 }} onClick={() => dispatch(removeFromCart({ id: item._id, cartType }))}>
                      <FaTrash size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — Summary */}
          <div className="cart-side">
            {/* Coupon */}
            <div className="coupon-box">
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, color: "#1a1740" }}>
                <FaTag size={13} color="#c9a84c" />Coupon / Promo Code
              </div>
              {couponData ? (
                <div style={{ marginTop: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="coupon-ok">✅ {couponData.code} applied!</div>
                    <div style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>You save {fmt(couponData.discount)}</div>
                  </div>
                  <button onClick={removeCoupon} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16 }}>✕</button>
                </div>
              ) : (
                <>
                  <div className="coupon-row">
                    <input
                      className="coupon-inp"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && applyCoupon()}
                    />
                    <button className="coupon-btn" onClick={applyCoupon} disabled={applying}>
                      {applying ? "..." : "Apply"}
                    </button>
                  </div>
                  {couponErr && <div className="coupon-err">⚠️ {couponErr}</div>}
                </>
              )}
            </div>

            {/* Price Summary */}
            <div className="summary-box">
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1740", marginBottom: 14 }}>Price Summary</div>
              <div className="sum-row"><span>Items ({inStockCount})</span><span>{fmt(inStockPrice)}</span></div>
              {discount > 0 && <div className="sum-row saving"><span>Coupon Discount</span><span>−{fmt(discount)}</span></div>}
              <div className="sum-row">
                <span>Delivery</span>
                <span style={delivery === 0 ? { color: "#059669", fontWeight: 600 } : {}}>{delivery === 0 ? "FREE" : fmt(delivery)}</span>
              </div>
              <div className="sum-row"><span>Platform Fee</span><span>{fmt(platform)}</span></div>
              {inStockPrice < 499 && !isUH && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#92400e", marginTop: 8 }}>
                  💡 Add {fmt(499 - inStockPrice)} more for FREE delivery!
                </div>
              )}
              <div className="sum-row total"><span>Est. Total</span><span>{fmt(total)}</span></div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>Final amount calculated at checkout</div>
              {discount > 0 && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#15803d", fontWeight: 600, marginTop: 8, textAlign: "center" }}>
                  🎉 You saved {fmt(discount)}!
                </div>
              )}
            </div>

            <button
              className="checkout-btn"
              disabled={inStockItems.length === 0}
              style={inStockItems.length === 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              onClick={() => navigate("/checkout", { state: couponData ? { coupon: couponData } : undefined })}
            >
              <FaShoppingBag size={14} />
              Proceed to Checkout
              <FaArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
