/**
 * UHCart.jsx — Urbexon Hour Cart (Flipkart Minutes style)
 * ─────────────────────────────────────────────────────────
 * • Dedicated UH cart page at /uh-cart
 * • Qty controls, remove, clear
 * • Price summary with delivery + platform fee
 * • Proceed to UH Checkout
 * All useCart hook usage, pricing math, and handlers preserved verbatim.
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { useCoupon } from "../hooks/useCoupon";
import CouponSuggestions from "../components/checkout/CouponSuggestions";
import {
    FiZap, FiTrash2, FiPlus, FiMinus,
    FiShoppingCart, FiClock, FiShield, FiTruck, FiTag,
} from "react-icons/fi";
import SEO from "../components/SEO";
import BackButton from "../components/BackButton";
import Card from "../design-system/Card";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import { EmptyState } from "../design-system/EmptyState";
import { cn } from "../design-system/utils/cn";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// BUG FIX: quantity was only ever capped at a hardcoded 99, regardless of
// how much stock the vendor actually had — a customer could raise the
// quantity above real availability in the cart UI and only find out it's
// rejected at checkout. Cap at whichever is lower.
const atStockLimit = (item) => {
    if (item.quantity >= 99) return true;
    if (item.stock != null && item.quantity >= Number(item.stock)) return true;
    return false;
};

/* Scoped: quiet entrance for cart rows + reduced-motion respect */
const PAGE_CSS = `
  .uhc-fade{animation:uhcFade .35s ease both}
  @keyframes uhcFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  @media (prefers-reduced-motion: reduce){.uhc-fade{animation:none}}
`;

const UHCart = () => {
    const navigate = useNavigate();
    const {
        uhItems, uhTotalQty, uhTotal,
        increment, decrement, removeItem, clearUH,
    } = useCart();

    const [clearing, setClearing] = useState(false);

    const handleClear = useCallback(() => {
        if (clearing) { clearUH(); setClearing(false); }
        else setClearing(true);
    }, [clearing, clearUH]);


    // BUG FIX: this page (the actual /uh-cart route every Urbexon Hour
    // link points to — Cart.jsx's UH tab at /cart is a different, rarely
    // reached page) had no coupon UI at all, unlike Cart.jsx which already
    // has a fully working one. Now the same shared hook Cart.jsx uses.
    const { couponCode, setCouponCode, couponData, couponErr, applying, applyCoupon, removeCoupon } =
        useCoupon({ orderTotal: uhTotal, orderType: "urbexon_hour" });
    const discount = couponData?.discount || 0;

    const deliveryCharge = uhTotal >= 499 ? 0 : 25;
    const platformFee = 11;
    const grandTotal = Math.max(0, uhTotal - discount) + deliveryCharge + platformFee;
    // BUG FIX: checkout had no client-side guard against an out-of-stock
    // item still sitting in the cart — the customer could tap "Proceed to
    // Checkout" and only discover the problem after landing on the
    // checkout page (or later, at order placement).
    const hasOutOfStockItems = uhItems.some((i) => i.inStock === false || Number(i.stock ?? 0) === 0);

    const goToCheckout = useCallback(() => {
        if (hasOutOfStockItems) return;
        navigate("/uh-checkout", { state: couponData ? { coupon: couponData } : undefined });
    }, [hasOutOfStockItems, navigate, couponData]);

    if (uhItems.length === 0) {
        return (
            <div className="min-h-screen bg-canvas pb-20">
                <SEO title="Urbexon Hour Cart" noindex />
                <EmptyState
                    icon={FiShoppingCart}
                    title="Your Urbexon Hour cart is empty"
                    description="Add items from Urbexon Hour for express delivery"
                    action={
                        <Link to="/urbexon-hour">
                            <Button variant="hour" icon={FiZap}>Browse Urbexon Hour</Button>
                        </Link>
                    }
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-graphite-50)] pb-24">
            <SEO title="Urbexon Hour Cart" noindex />
            <style>{PAGE_CSS}</style>

            {/* Header */}
            <div
                className="flex items-center gap-3 bg-surface/90 backdrop-blur-md px-[clamp(16px,3vw,40px)] py-3.5 border-b border-default sticky top-0 z-40"
                style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}
            >
                <BackButton variant="inline" fallback="/urbexon-hour" className="rounded-[var(--radius-md)] hover:bg-[var(--color-graphite-100)] active:scale-95" />
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-extrabold text-primary flex items-center gap-1.5">
                        <FiZap size={14} className="text-[var(--accent-hour)]" aria-hidden="true" /> Urbexon Hour Cart
                    </h1>
                    <span className="text-xs text-secondary font-medium">{uhTotalQty} item{uhTotalQty !== 1 ? "s" : ""}</span>
                </div>
                <button
                    onClick={handleClear}
                    onBlur={() => setClearing(false)}
                    className={cn(
                        "border rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all",
                        clearing
                            ? "bg-[var(--color-error-500)] text-white border-[var(--color-error-500)]"
                            : "border-default text-secondary hover:border-[var(--color-error-500)] hover:text-error"
                    )}
                >
                    {clearing ? "Confirm Clear?" : "Clear"}
                </button>
            </div>

            {/* Delivery banner */}
            <div className="flex items-center gap-2 flex-wrap bg-success-tint border-b border-[var(--color-success-100)] px-[clamp(16px,3vw,40px)] py-2.5 text-[13px] text-success">
                <FiTruck size={13} aria-hidden="true" />
                <span>Express delivery in <strong>45–120 mins</strong></span>
                {uhTotal < 499 && (
                    <span className="ml-auto text-xs text-success font-semibold">
                        Add {fmt(499 - uhTotal)} more for free delivery
                    </span>
                )}
            </div>

            <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_360px] gap-4 md:gap-5 p-4 md:p-6">
                {/* Items list */}
                <div className="flex flex-col gap-3">
                    {uhItems.map((item, idx) => {
                        const img = item.images?.[0]?.url || item.image?.url || item.image || "/placeholder.png";
                        const discount = item.mrp && item.mrp > item.price
                            ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
                            : 0;
                        const uniqueId = item.cartItemId || item._id;
                        const outOfStock = item.inStock === false || Number(item.stock ?? 0) === 0;
                        return (
                            <Card
                                key={uniqueId}
                                className="uhc-fade relative flex gap-4 rounded-2xl hover:shadow-md transition-shadow"
                                style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}
                            >
                                <img
                                    src={img} alt={item.name}
                                    className="w-[84px] h-[84px] rounded-[var(--radius-md)] object-cover flex-shrink-0 bg-canvas border border-default"
                                    loading="lazy"
                                    onError={(e) => { e.target.src = "/placeholder.png"; }}
                                />
                                <div className="flex-1 min-w-0">
                                    {item.brand && <div className="text-[10px] font-extrabold text-secondary uppercase tracking-wide mb-0.5">{item.brand}</div>}
                                    <div className="text-[13.5px] font-bold text-primary leading-snug mb-1 overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</div>

                                    {(item.selectedSize || item.selectedColor) && (
                                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                            {item.selectedSize && (
                                                <span className="text-[10px] font-semibold text-secondary bg-canvas border border-default rounded px-1.5 py-[1px]">Size: {item.selectedSize}</span>
                                            )}
                                            {item.selectedColor && (
                                                <span className="text-[10px] font-semibold text-secondary bg-canvas border border-default rounded px-1.5 py-[1px]">Color: {item.selectedColor}</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-baseline gap-1.5 mb-1">
                                        <span className="text-sm font-extrabold text-primary">{fmt(item.price)}</span>
                                        {item.mrp > item.price && (
                                            <span className="text-[11px] text-muted line-through">{fmt(item.mrp)}</span>
                                        )}
                                        {discount > 0 && (
                                            <span className="text-[10px] font-bold text-success">{discount}% off</span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-secondary font-medium">
                                        Total: <span className="font-bold text-primary">{fmt(item.price * item.quantity)}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end justify-between flex-shrink-0">
                                    <button
                                        onClick={() => removeItem(uniqueId, "urbexon_hour")}
                                        aria-label="Remove item"
                                        className="text-muted hover:text-error transition-colors p-1"
                                    >
                                        <FiTrash2 size={14} aria-hidden="true" />
                                    </button>
                                    <div className="flex items-center border border-default rounded-full overflow-hidden bg-canvas">
                                        <button
                                            onClick={() => {
                                                if (item.quantity <= 1) removeItem(uniqueId, "urbexon_hour");
                                                else decrement(uniqueId, "urbexon_hour");
                                            }}
                                            aria-label={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}
                                            className="w-8 h-8 hover:bg-[var(--color-graphite-100)] flex items-center justify-center text-primary transition-colors"
                                        >
                                            {item.quantity <= 1 ? <FiTrash2 size={11} aria-hidden="true" /> : <FiMinus size={11} aria-hidden="true" />}
                                        </button>
                                        <span className="w-8 text-center text-[13px] font-bold text-primary tabular-nums">{item.quantity}</span>
                                        <button
                                            onClick={() => increment(uniqueId, "urbexon_hour")}
                                            disabled={atStockLimit(item)}
                                            aria-label="Increase quantity"
                                            className="w-8 h-8 hover:bg-[var(--color-graphite-100)] flex items-center justify-center text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <FiPlus size={11} aria-hidden="true" />
                                        </button>
                                    </div>
                                    {atStockLimit(item) && (
                                        <span className="text-[10px] text-error font-semibold mt-1">Max stock reached</span>
                                    )}
                                </div>
                                {outOfStock && (
                                    // BUG FIX: this overlay used to block the whole card, including
                                    // the remove button underneath it — a customer with an out-of-
                                    // stock item had no way to get rid of it from this page short of
                                    // clearing the entire cart. The remove action now lives on the
                                    // overlay itself.
                                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2.5 rounded-2xl text-white font-bold text-[13px]">
                                        <span>⚠️ Out of Stock</span>
                                        <button
                                            onClick={() => removeItem(uniqueId, "urbexon_hour")}
                                            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/30 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
                                        >
                                            <FiTrash2 size={11} aria-hidden="true" /> Remove
                                        </button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}

                    <Link
                        to="/urbexon-hour"
                        className="flex items-center justify-center gap-1.5 p-3.5 bg-surface border-2 border-dashed border-strong rounded-2xl text-primary font-bold text-[13px] hover:bg-canvas hover:border-[var(--accent-hour)] hover:text-[var(--accent-hour)] transition-colors"
                    >
                        <FiPlus size={11} aria-hidden="true" /> Add more items
                    </Link>
                </div>

                {/* Coupon */}
                <Card className="h-fit hidden md:block rounded-2xl order-2 md:order-none">
                    <div className="flex items-center gap-2 font-bold text-sm text-primary">
                        <FiTag size={13} className="text-[var(--accent-hour)]" aria-hidden="true" />Coupon / Promo Code
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
                                <Button variant="hour" onClick={() => applyCoupon()} loading={applying}>Apply</Button>
                            </div>
                            {couponErr && <p className="text-xs text-error mt-2">⚠️ {couponErr}</p>}
                        </>
                    )}
                    <CouponSuggestions itemsTotal={uhTotal} orderMode="urbexon_hour" appliedCode={couponData?.code} onApply={(code) => applyCoupon(code)} />
                </Card>

                {/* Price Summary */}
                {/* BUG FIX: `top-[88px]` was a fixed guess at the sticky
                    header's rendered height — the header's own paddingTop
                    grows with env(safe-area-inset-top) on notched devices
                    (see the header's inline style above), but this offset
                    never accounted for that extra growth, so on a notched
                    phone this card could scroll up underneath (overlap) the
                    header instead of sitting flush below it. Adds the same
                    safe-area growth the header itself uses. */}
                <Card
                    className="h-fit md:sticky hidden md:block rounded-2xl"
                    style={{ top: "calc(88px + max(0px, env(safe-area-inset-top) - 14px))" }}
                >
                    <div className="text-sm font-extrabold text-primary mb-3.5">Price Details</div>
                    <div className="flex justify-between text-[13px] text-secondary mb-2">
                        <span>Items ({uhTotalQty})</span>
                        <span>{fmt(uhTotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-[13px] text-success font-semibold mb-2">
                            <span>Coupon Discount</span><span>−{fmt(discount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-[13px] text-secondary mb-2">
                        <span>Est. Delivery</span>
                        <span className={deliveryCharge === 0 ? "text-success font-bold" : ""}>
                            {deliveryCharge === 0 ? "FREE" : fmt(deliveryCharge)}
                        </span>
                    </div>
                    <div className="flex justify-between text-[13px] text-secondary mb-2">
                        <span>Platform fee</span>
                        <span>{fmt(platformFee)}</span>
                    </div>
                    <div className="border-t border-dashed border-default my-2.5" />
                    <div className="flex justify-between text-[15px] font-extrabold text-primary">
                        <span>Est. Total</span>
                        <span>{fmt(grandTotal)}</span>
                    </div>
                    <div className="text-[10px] text-muted mt-0.5 mb-3">
                        Final delivery & fees calculated at checkout
                    </div>

                    {hasOutOfStockItems ? (
                        <Alert variant="error" className="mb-3.5">
                            Remove out-of-stock items to continue
                        </Alert>
                    ) : (
                        <Alert variant="success" className="mb-3.5">
                            <span className="flex items-center gap-1.5"><FiClock size={12} aria-hidden="true" /> Delivery in <strong>45–120 mins</strong></span>
                        </Alert>
                    )}

                    <Button variant="hour" className="w-full" disabled={hasOutOfStockItems} onClick={goToCheckout}>
                        Proceed to Checkout
                    </Button>

                    <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-muted">
                        <FiShield size={11} aria-hidden="true" />
                        <span>Secure checkout · Safe payments</span>
                    </div>
                </Card>
            </div>

            {/* Mobile sticky CTA */}
            <div
                className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-default px-4 py-3 z-50 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
                style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
                <div className="flex flex-col min-w-0">
                    <span className="text-lg font-black text-primary leading-tight">{fmt(grandTotal)}</span>
                    <span className="text-[11px] text-secondary font-medium">{uhTotalQty} item{uhTotalQty !== 1 ? "s" : ""}</span>
                </div>
                <Button variant="hour" className="flex-shrink-0" disabled={hasOutOfStockItems} onClick={goToCheckout}>
                    Proceed to Checkout
                </Button>
            </div>
        </div>
    );
};

export default UHCart;