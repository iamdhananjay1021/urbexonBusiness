/**
 * Cart.jsx — Production Ready v4.0 (Signal design system migration)
 * ✅ Dual cart: Ecommerce + Urbexon Hour (tabs when both have items)
 * ✅ Correct cartType dispatch for inc/dec/remove
 * ✅ Coupon validation from server
 * ✅ Out-of-stock items greyed out (not removed)
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
  incQty,
  decQty,
  removeFromCart,
  clearEcommerceCart,
  clearUHCart,
} from "../features/cart/cartSlice";
import { getProductById } from "../api/productApi";
import { useCoupon } from "../hooks/useCoupon";
import CouponSuggestions from "../components/checkout/CouponSuggestions";
import { FiTrash2, FiShoppingBag, FiZap, FiTag, FiArrowRight, FiX, FiPlus, FiMinus, FiSlash } from "react-icons/fi";
import BackButton from "../components/BackButton";
import Card from "../design-system/Card";
import Button from "../design-system/Button";
import Badge from "../design-system/Badge";
import Alert from "../design-system/Alert";
import Tabs from "../design-system/Tabs";
import { EmptyState } from "../design-system/EmptyState";
import { cn } from "../design-system/utils/cn";
import { imgUrl } from "../utils/imageUrl";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Add padding-bottom for mobile bottom navbar
const MOBILE_BOTTOM_NAV_HEIGHT = 80; // Assuming 56px nav + some extra space

const Cart = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const ecItems = useSelector(selectEcommerceItems);
  const uhItems = useSelector(selectUHItems);
  const ecCount = useSelector(selectEcommerceTotalItems);
  const uhCount = useSelector(selectUHTotalItems);

  const hasEc = ecItems.length > 0;
  const hasUh = uhItems.length > 0;
  const hasBoth = hasEc && hasUh;

  // Active tab for dual cart
  const [activeTab, setActiveTab] = useState(hasUh && !hasEc ? "uh" : "ec");
  const isUH = activeTab === "uh";
  const activeItems = isUH ? uhItems : ecItems;
  const activeCount = isUH ? uhCount : ecCount;
  const cartType = isUH ? "urbexon_hour" : "ecommerce";

  // Auto-switch tab if the active cart becomes empty but the other cart still has items
  useEffect(() => {
    if (activeTab === "ec" && !hasEc && hasUh) {
      setActiveTab("uh");
    } else if (activeTab === "uh" && !hasUh && hasEc) {
      setActiveTab("ec");
    }
  }, [hasEc, hasUh, activeTab]);

  // Stock validation
  const [stockMap, setStockMap] = useState({});
  const [, setStockLoading] = useState(false);

  const itemIdsString = useMemo(() => {
    const allItems = [...ecItems, ...uhItems];
    return [...new Set(allItems.map(i => i.productId || i._id))].sort().join(',');
  }, [ecItems, uhItems]);

  useEffect(() => {
    if (!itemIdsString) {
      setStockMap({});
      return;
    }
    const uniqueIds = itemIdsString.split(',');
    let cancelled = false;
    setStockLoading(true);
    Promise.all(
      uniqueIds.map(id =>
        getProductById(id).then(r => {
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
  }, [itemIdsString]);

  const isOOS = useCallback((item) => {
    const info = stockMap[item.productId || item._id];
    if (!info || info.stock === -1) return false; // couldn't fetch, don't block
    return !info.inStock || info.stock === 0;
  }, [stockMap]);

  const inStockItems = useMemo(() => activeItems.filter(i => !isOOS(i)), [activeItems, isOOS]);
  const oosItems = useMemo(() => activeItems.filter(i => isOOS(i)), [activeItems, isOOS]);

  const inStockPrice = useMemo(() => inStockItems.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0), [inStockItems]);
  const inStockCount = useMemo(() => inStockItems.reduce((s, i) => s + (i.quantity || 0), 0), [inStockItems]);

  const orderMode = isUH ? "urbexon_hour" : "ecommerce";
  const { couponCode, setCouponCode, couponData, couponErr, applying, applyCoupon, removeCoupon } =
    useCoupon({ orderTotal: inStockPrice, orderType: orderMode });

  const discount = couponData?.discount || 0;

  const { delivery, platform, total } = useMemo(() => {
    const d = isUH ? 25 : (inStockPrice >= 499 ? 0 : 49);
    const p = 11;
    const itemsTotal = Math.max(0, inStockPrice - discount);
    return { delivery: d, platform: p, total: itemsTotal + d + p, estimated: true };
  }, [inStockPrice, discount, isUH]);

  // Switch tab resets coupon
  const switchTab = (tab) => { setActiveTab(tab); removeCoupon(); };

  if (!hasEc && !hasUh) {
    return (
      <div className="min-h-screen bg-canvas px-[clamp(12px,4vw,40px)] pt-6" style={{ paddingBottom: MOBILE_BOTTOM_NAV_HEIGHT }}>
        <SEO title="Cart" noindex />
        <div className="max-w-[1100px] mx-auto pb-5">
          <BackButton variant="inline" fallback="/" />
        </div>
        <EmptyState
          icon={FiShoppingBag}
          title="Your cart is empty"
          description="Add some products to start shopping!"
          action={<Button variant="primary" onClick={() => navigate("/")}>Start Shopping →</Button>}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas px-[clamp(12px,4vw,40px)] py-6" style={{ paddingBottom: MOBILE_BOTTOM_NAV_HEIGHT }}>
      <SEO title="Cart" noindex />

      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-start gap-4">
            <BackButton variant="inline" fallback="/" className={hasBoth ? "mt-2.5" : "mt-1"} />
            <div>
              {hasBoth && (
                <Tabs
                  className="mb-2.5 border-b-0"
                  tabs={[
                    { value: "ec", label: `🛍 Store (${ecCount})` },
                    { value: "uh", label: `⚡ Urbexon Hour (${uhCount})` },
                  ]}
                  active={activeTab}
                  onChange={switchTab}
                />
              )}
              <h1 className="text-[clamp(18px,3vw,24px)] font-extrabold text-primary tracking-tight">
                {isUH ? <><span className="text-accent">⚡</span> Urbexon Hour Cart</> : "Shopping Cart"}
                <span className="text-[13px] font-medium text-muted ml-2">({activeCount} items)</span>
              </h1>
              {isUH && (
                <Badge variant="hour" className="mt-1.5 gap-1">
                  <FiZap size={9} aria-hidden="true" />Fast Delivery • 45-120 mins
                </Badge>
              )}
            </div>
          </div>
          <button
            onClick={() => dispatch(isUH ? clearUHCart() : clearEcommerceCart())}
            className="border border-[var(--color-error-100)] text-error px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-bold hover:bg-error-tint transition-colors flex items-center gap-1"
          >
            <FiX size={11} aria-hidden="true" />Clear Cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          {/* LEFT — Items */}
          <div>
            {oosItems.length > 0 && (
              <Alert variant="error" className="mb-3.5">
                {oosItems.length} item{oosItems.length > 1 ? "s" : ""} in your cart {oosItems.length > 1 ? "are" : "is"} out of stock
              </Alert>
            )}
            <Card padding="none" className="overflow-hidden">
              {activeItems.map((item, idx) => {
                const oos = isOOS(item);
                const uniqueId = item.cartItemId || item._id;
                return (
                  <div
                    key={`${uniqueId}-${idx}`}
                    className={cn(
                      "grid grid-cols-[80px_1fr_auto_auto] items-center gap-3 p-4 transition-colors duration-150",
                      idx < activeItems.length - 1 && "border-b border-default",
                      oos ? "opacity-55 relative" : "hover:bg-canvas"
                    )}
                  >
                    <Link to={`/products/${item.slug || item.productId || item._id}`} className={oos ? "pointer-events-none" : ""}>
                      <img
                        className={cn("w-20 h-20 object-cover rounded-[var(--radius-md)] bg-canvas", oos && "grayscale-[.6]")}
                        src={imgUrl.thumbnail(item?.images?.[0]?.url || item?.image || "/placeholder.png")}
                        alt={item.name}
                        loading="lazy"
                        onError={e => { e.target.src = "/placeholder.png"; }}
                      />
                    </Link>
                    <div className="min-w-0">
                      <Link to={`/products/${item.slug || item.productId || item._id}`} className={oos ? "pointer-events-none" : ""}>
                        <div className="text-[13px] font-semibold text-primary leading-snug mb-1 line-clamp-2">{item.name}</div>
                      </Link>
                      <div>
                        <span className={cn("text-[15px] font-extrabold", oos ? "text-muted" : "text-primary")}>{fmt(item.price)}</span>
                        {item.mrp > item.price && <span className="text-[11px] text-muted line-through ml-1.5">{fmt(item.mrp)}</span>}
                      </div>
                      {item.selectedSize && <div className="text-[11px] text-muted mt-0.5">Size: {item.selectedSize}</div>}
                      {item.selectedColor && <div className="text-[11px] text-muted mt-0.5">Color: {item.selectedColor}</div>}
                      {item.productType === "urbexon_hour" && !oos && (
                        <Badge variant="hour" className="mt-1 gap-1"><FiZap size={8} aria-hidden="true" />Express</Badge>
                      )}
                      {oos && (
                        <Badge variant="error" className="mt-1 gap-1"><FiSlash size={9} aria-hidden="true" />Out of Stock</Badge>
                      )}
                    </div>
                    {!oos ? (
                      <div className="flex items-center border border-default rounded-[var(--radius-sm)] overflow-hidden">
                        <button
                          className="w-[30px] h-[30px] bg-canvas hover:bg-[var(--color-graphite-100)] flex items-center justify-center text-secondary transition-colors"
                          onClick={() => dispatch(decQty({ id: uniqueId, cartType }))}
                          aria-label="Decrease quantity"
                        >
                          <FiMinus size={10} aria-hidden="true" />
                        </button>
                        <span className="w-9 h-[30px] flex items-center justify-center text-[13px] font-bold text-primary border-x border-default">
                          {item.quantity}
                        </span>
                        <button
                          className="w-[30px] h-[30px] bg-canvas hover:bg-[var(--color-graphite-100)] flex items-center justify-center text-secondary transition-colors"
                          onClick={() => dispatch(incQty({ id: uniqueId, cartType }))}
                          aria-label="Increase quantity"
                        >
                          <FiPlus size={10} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted font-semibold text-center">Unavailable</div>
                    )}
                    <button
                      className="text-muted hover:text-[var(--color-error-500)] p-1.5 rounded-[var(--radius-sm)] transition-colors"
                      onClick={() => dispatch(removeFromCart({ id: uniqueId, cartType }))}
                      aria-label="Remove item"
                    >
                      <FiTrash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </Card>
          </div>

          {/* RIGHT — Summary */}
          <div className="flex flex-col gap-3.5">
            {/* Coupon */}
            <Card>
              <div className="flex items-center gap-2 font-bold text-sm text-primary">
                <FiTag size={13} className="text-accent" aria-hidden="true" />Coupon / Promo Code
              </div>
              {couponData ? (
                <div className="mt-2.5 bg-success-tint border border-[var(--color-success-100)] rounded-[var(--radius-sm)] px-3.5 py-2.5 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-semibold text-success">✅ {couponData.code} applied!</div>
                    <div className="text-xs text-success font-semibold">You save {fmt(couponData.discount)}</div>
                  </div>
                  <button onClick={removeCoupon} aria-label="Remove coupon" className="text-[var(--color-error-500)] text-base">✕</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mt-2.5">
                    <input
                      className="flex-1 px-3.5 py-2.5 border border-default rounded-[var(--radius-sm)] text-[13px] outline-none focus-ring-accent focus:border-[var(--accent-primary)] transition-colors"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && applyCoupon()}
                    />
                    <Button variant="primary" onClick={() => applyCoupon()} loading={applying}>Apply</Button>
                  </div>
                  {couponErr && <p className="text-xs text-error mt-2">⚠️ {couponErr}</p>}
                </>
              )}
              <CouponSuggestions itemsTotal={inStockPrice} orderMode={orderMode} appliedCode={couponData?.code} onApply={(code) => applyCoupon(code)} />
            </Card>

            {/* Price Summary */}
            <Card>
              <div className="font-extrabold text-[15px] text-primary mb-3.5">Price Summary</div>
              <div className="flex justify-between text-[13px] text-secondary mb-2.5"><span>Items ({inStockCount})</span><span>{fmt(inStockPrice)}</span></div>
              {discount > 0 && <div className="flex justify-between text-[13px] text-success font-semibold mb-2.5"><span>Coupon Discount</span><span>−{fmt(discount)}</span></div>}
              <div className="flex justify-between text-[13px] text-secondary mb-2.5">
                <span>Delivery</span>
                <span className={delivery === 0 ? "text-success font-semibold" : ""}>{delivery === 0 ? "FREE" : fmt(delivery)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-secondary mb-2.5"><span>Platform Fee</span><span>{fmt(platform)}</span></div>
              {inStockPrice < 499 && !isUH && (
                <Alert variant="warning" className="mt-2">💡 Add {fmt(499 - inStockPrice)} more for FREE delivery!</Alert>
              )}
              <div className="flex justify-between text-base font-extrabold text-primary border-t border-default pt-3 mt-1">
                <span>Est. Total</span><span>{fmt(total)}</span>
              </div>
              <div className="text-[10px] text-muted mt-0.5">Final amount calculated at checkout</div>
              {discount > 0 && (
                <div className="bg-success-tint border border-[var(--color-success-100)] rounded-[var(--radius-sm)] px-3 py-2 text-xs text-success font-semibold mt-2 text-center">
                  🎉 You saved {fmt(discount)}!
                </div>
              )}
            </Card>

            <Button
              variant="primary"
              className="w-full"
              disabled={inStockItems.length === 0}
              // BUG FIX: this always sent the user to the ecommerce checkout,
              // even while viewing the Urbexon Hour tab of this same page
              // (Cart.jsx is a shared dual-cart page — `isUH`/`activeItems`
              // above already track which tab is active for every other
              // computation here; the checkout button was the one place
              // that never checked it).
              onClick={() => navigate(isUH ? "/uh-checkout" : "/checkout", { state: couponData ? { coupon: couponData } : undefined })}
              icon={FiShoppingBag}
            >
              Proceed to Checkout <FiArrowRight size={12} className="ml-1" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
