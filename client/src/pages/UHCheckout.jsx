/**
 * UHCheckout.jsx — Urbexon Hour Express Checkout
 * ─────────────────────────────────────────────────
 * • Standalone checkout (no MainLayout)
 * • 4-step accordion: Contact → Address → Order Summary → Payment
 * • Pricing from backend only (via useUHCheckout hook)
 * • deliveryType = URBEXON_HOUR
 * • COD + Razorpay
 * All state/handlers below come from useUHCheckout() — untouched business logic.
 *
 * UI FIX (this pass) — off-brand accent color
 * ──────────────────────────────────────────────────────────────────────
 * This page was using the generic ecommerce accent (text-accent,
 * bg-accent-tint, border-[var(--accent-primary)], Button variant="primary")
 * everywhere — the same purple/indigo used on the regular Urbexon store.
 * Every other Urbexon Hour screen (Navbar's UH mode, UrbexonHour.jsx,
 * UHProductDetail.jsx) uses the amber Hour brand color instead
 * (var(--accent-hour) / var(--accent-hour-hover) / bg-hour-tint, and
 * Button variant="hour" for primary actions). This checkout had never been
 * switched over, so the "Hour" wordmark, Continue/Pay/Place Order buttons,
 * selected radio circles, and selected-address highlight all rendered in
 * the wrong brand color instead of matching the rest of the Hour funnel.
 * Fix: swapped every generic accent reference in this file for its Hour
 * equivalent. No layout, markup structure, or logic was touched.
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    FiZap, FiMapPin, FiCheckCircle,
    FiHome, FiBriefcase, FiChevronDown, FiChevronUp, FiShield, FiTag,
} from "react-icons/fi";
import { useUHCheckout } from "../hooks/useUHCheckout";
import { validateCoupon } from "../api/orderApi";
import { resolveNearestPincode } from "../api/pincodeApi";
import BackButton from "../components/BackButton";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import Loader from "../design-system/Loader";
import { EmptyState } from "../design-system/EmptyState";
import { cn } from "../design-system/utils/cn";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const LABEL_ICONS = { Home: FiHome, Work: FiBriefcase, Other: FiMapPin };

/* ── Accordion step shell ── */
const StepCard = ({ num, title, active, done, summary, onChange, children }) => (
    <Card padding="none" className="overflow-hidden">
        <div className={cn("flex items-center justify-between px-5 py-3.5", active && "bg-[var(--color-graphite-900)]")}>
            <div className={cn("flex items-center gap-3 text-sm font-bold uppercase tracking-wide", active ? "text-white" : "text-secondary")}>
                <span className={cn(
                    "w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-xs font-bold",
                    active ? "bg-white text-[var(--color-graphite-900)]" : "bg-[var(--color-graphite-100)] text-[var(--accent-hour-hover)]"
                )}>{num}</span>
                {title}
                {done && <FiCheckCircle size={16} className="text-[var(--accent-hour-hover)]" aria-hidden="true" />}
            </div>
            {done && onChange && (
                <button onClick={onChange} className={cn("border rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold", active ? "border-white/30 text-white" : "border-default text-secondary")}>
                    CHANGE
                </button>
            )}
        </div>
        {done && summary && !active && (
            <div className="px-5 pb-3.5 text-sm text-primary">{summary}</div>
        )}
        {active && <div className="px-5 pb-5">{children}</div>}
    </Card>
);

const UHCheckout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // BUG FIX: mirrors Checkout.jsx's exact buyNowItem read (nav state,
    // falling back to sessionStorage so a hard refresh doesn't lose it) —
    // this page never read either, so a UH "Buy Now" landed here with the
    // item silently dropped.
    const buyNowItem = (() => {
        if (location.state?.buyNowItem) return location.state.buyNowItem;
        try {
            const stored = sessionStorage.getItem("ux_buy_now_item");
            if (stored) { const p = JSON.parse(stored); sessionStorage.removeItem("ux_buy_now_item"); return p; }
        } catch { /* malformed/missing sessionStorage buy-now item — falls through to null below */ }
        return null;
    })();

    // BUG FIX: this page never read a coupon forwarded from UHCart.jsx's
    // `navigate("/uh-checkout", { state: { coupon } })`, and the hook never
    // accepted/stored/forwarded one either (see useUHCheckout.js) — a
    // coupon applied on the cart page was silently dropped by the time the
    // order was placed. Mirrors Checkout.jsx's exact couponFromCart read.
    const couponFromCart = location.state?.coupon || null;

    const ck = useUHCheckout(buyNowItem, couponFromCart);
    const {
        step, setStep, error,
        coupon, setCoupon,
        contact, setContact,
        addresses, addrLoading, selectedAddrId, setSelectedAddrId, selectedAddress,
        showAddForm, setShowAddForm, editingAddr, setEditingAddr,
        savingAddr,
        paymentMethod, selectPaymentMethod, payState, loading,
        codChecking, codAvailable,
        pricing, pricingLoading,
        mobileSummaryOpen, setMobileSummaryOpen,
        checkoutItems,
        handleContactContinue, handleAddressContinue,
        handleAddAddress, handleEditAddress,
        handleCOD, handlePayOnline,
    } = ck;

    const finalTotal = pricing?.finalTotal || 0;

    // BUG FIX: no coupon input UI existed anywhere on this page. Same
    // self-contained apply/remove pattern as Cart.jsx / Checkout.jsx.
    const [couponCode, setCouponCode] = useState("");
    const [couponApplying, setCouponApplying] = useState(false);
    const [couponErr, setCouponErr] = useState("");

    const applyCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponApplying(true); setCouponErr("");
        try {
            const { data } = await validateCoupon({
                code: couponCode.trim(),
                orderTotal: pricing?.itemsTotal || 0,
                orderType: "urbexon_hour",
            });
            setCoupon(data);
            setCouponCode("");
        } catch (e) {
            setCouponErr(e.response?.data?.message || "Invalid coupon");
        } finally { setCouponApplying(false); }
    };

    const removeCoupon = () => { setCoupon(null); setCouponCode(""); setCouponErr(""); };

    // BUG FIX: the header back-arrow used to unconditionally exit straight
    // to /uh-cart no matter which step the customer was on — misclicking it
    // on Address/Summary/Payment discarded all progress in one tap instead
    // of stepping back one screen at a time (the Flipkart/Amazon-style
    // convention this checkout otherwise follows via each step's own
    // "CHANGE" button). Only step 1 has nowhere earlier in the funnel to
    // go, so that's the only case that still leaves checkout — and even
    // then, prefer real in-app history over a hardcoded route when one
    // exists (location.key === "default" means this page was opened
    // directly — refresh/deep link — so there's nothing to go back to).
    const handleBack = () => {
        if (step > 1) { setStep(step - 1); return; }
        if (location.key !== "default") navigate(-1);
        else navigate("/uh-cart");
    };

    if (!checkoutItems || checkoutItems.length === 0) {
        return (
            <div className="min-h-screen bg-canvas">
                <SEO title="Urbexon Hour Checkout" noindex />
                <EmptyState
                    icon={FiZap}
                    title="No items for checkout"
                    description="Add items from Urbexon Hour first"
                    action={<Button variant="hour" onClick={() => navigate("/urbexon-hour")}>Browse Urbexon Hour</Button>}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-canvas pb-16">
            <SEO title="Urbexon Hour Checkout" noindex />

            {/* Header */}
            <header className="bg-[var(--color-graphite-900)] text-white h-[60px] flex items-center">
                <div className="max-w-[1100px] mx-auto w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <BackButton
                            variant="inline"
                            onClick={handleBack}
                            aria-label={step > 1 ? "Back to previous step" : "Back to cart"}
                            className="!bg-transparent !border-transparent !text-white !shadow-none hover:!text-white/80 !w-auto !h-auto"
                        />
                        {/* BUG FIX: rendered the "Urbexon Hour" wordmark with
                            its own one-off styling — italic, title-case
                            "Hour", and --accent-hour-hover (one shade darker
                            amber) — while the main site Navbar's Hour toggle
                            (Navbar.jsx) uses non-italic, uppercase "HOUR" in
                            the actual --accent-hour token. Same brand, same
                            funnel, two different-looking logos. Matches
                            Navbar's token/casing/tracking now. */}
                        <div className="text-xl font-display flex items-baseline gap-1 tracking-[-0.5px]">
                            <span>Urbexon</span>
                            <span className="text-[13px] font-semibold text-[var(--accent-hour)] tracking-wide uppercase">Hour</span>
                        </div>
                    </div>
                    <div className="text-xs font-semibold flex items-center gap-1.5 tracking-wide">
                        <FiShield size={14} aria-hidden="true" /> 100% SECURE
                    </div>
                </div>
            </header>

            <div className="max-w-[1000px] mx-auto mt-6 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 px-4 items-start">
                {/* Main content */}
                <div className="flex flex-col gap-4">
                    {error && <Alert variant="error">{error}</Alert>}

                    {/* STEP 1: CONTACT DETAILS */}
                    <StepCard
                        num={1} title="Contact Details" active={step === 1} done={step > 1}
                        summary={<><span className="font-semibold mr-2">{contact.name}</span>+91 {contact.phone}</>}
                        onChange={() => setStep(1)}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Full Name" />
                            <Input
                                type="tel" value={contact.phone}
                                onChange={(e) => setContact({ ...contact, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                                placeholder="10-digit mobile number" maxLength={10} inputMode="numeric"
                            />
                        </div>
                        <div className="max-w-[300px] mt-4">
                            <Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email (Optional)" />
                        </div>
                        <Button variant="hour" className="mt-5" onClick={handleContactContinue}>Continue</Button>
                    </StepCard>

                    {/* STEP 2: DELIVERY ADDRESS */}
                    <StepCard
                        num={2} title="Delivery Address" active={step === 2} done={step > 2}
                        summary={selectedAddress && (
                            <><span className="font-semibold mr-2">{selectedAddress.name}</span>{selectedAddress.house}, {selectedAddress.area}, {selectedAddress.city} - <span className="font-semibold">{selectedAddress.pincode}</span></>
                        )}
                        onChange={() => setStep(2)}
                    >
                        {addrLoading ? (
                            <div className="flex items-center gap-2.5 text-sm text-secondary py-4"><Loader size="sm" /> Loading addresses…</div>
                        ) : (
                            <>
                                {addresses.length > 0 && (
                                    <div className="flex flex-col gap-3 mb-4">
                                        {addresses.map((addr) => (
                                            <div
                                                key={addr._id}
                                                onClick={() => setSelectedAddrId(addr._id)}
                                                className={cn(
                                                    "flex gap-4 p-4 border rounded-[var(--radius-md)] cursor-pointer transition-colors",
                                                    selectedAddrId === addr._id ? "bg-hour-tint border-[var(--accent-hour)]" : "border-default hover:bg-canvas"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-[18px] h-[18px] rounded-full flex-shrink-0 mt-0.5",
                                                    selectedAddrId === addr._id ? "border-[5px] border-[var(--accent-hour)]" : "border-2 border-[var(--color-graphite-300)]"
                                                )} />
                                                <div className="flex-1">
                                                    <div className="mb-1.5 text-sm">
                                                        <span className="bg-[var(--color-graphite-100)] text-secondary text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase">{addr.label}</span>
                                                        <span className="font-semibold ml-2">{addr.name}</span>
                                                        <span className="font-semibold ml-2">{addr.phone}</span>
                                                    </div>
                                                    <div className="text-sm text-primary leading-relaxed">
                                                        {addr.house}, {addr.area}{addr.landmark ? `, ${addr.landmark}` : ""}, {addr.city}, {addr.state} - <span className="font-semibold">{addr.pincode}</span>
                                                    </div>
                                                    {selectedAddrId === addr._id && (
                                                        <Button variant="hour" size="sm" className="mt-3" onClick={handleAddressContinue}>Deliver Here</Button>
                                                    )}
                                                    <div className={cn("mt-2", selectedAddrId === addr._id && "mt-3")}>
                                                        <button onClick={(e) => { e.stopPropagation(); setEditingAddr(addr); setShowAddForm(true); }} className="text-[var(--accent-hour-hover)] text-xs font-semibold uppercase">
                                                            Edit
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!showAddForm ? (
                                    <button
                                        onClick={() => { setEditingAddr(null); setShowAddForm(true); }}
                                        className="flex items-center justify-center gap-2 p-4 bg-surface border border-default rounded-[var(--radius-md)] text-[var(--accent-hour-hover)] text-sm font-semibold w-full"
                                    >
                                        + Add a new address
                                    </button>
                                ) : (
                                    <div className="bg-surface p-4 border border-default rounded-[var(--radius-md)] mt-4">
                                        <AddressFormInline
                                            initial={editingAddr}
                                            saving={savingAddr}
                                            onSave={(form) => editingAddr ? handleEditAddress(form) : handleAddAddress(form)}
                                            onCancel={() => { setShowAddForm(false); setEditingAddr(null); }}
                                        />
                                    </div>
                                )}

                                {/* BUG FIX: the only way to advance used to be the "Deliver
                                    Here" button rendered PER-CARD, conditioned on
                                    selectedAddrId === addr._id — a single point of failure
                                    if that state didn't line up (e.g. right after adding a
                                    fresh address). This button is always visible whenever a
                                    valid address is selected, independent of any per-card
                                    render condition. */}
                                {!showAddForm && selectedAddress && (
                                    <Button variant="hour" className="w-full mt-4" onClick={handleAddressContinue}>
                                        Deliver to this address
                                    </Button>
                                )}
                            </>
                        )}
                    </StepCard>

                    {/* STEP 3: ORDER SUMMARY */}
                    <StepCard
                        num={3} title="Order Summary" active={step === 3} done={step > 3}
                        summary={<b>{checkoutItems.length} Item{checkoutItems.length > 1 ? "s" : ""}</b>}
                        onChange={() => setStep(3)}
                    >
                        <div className="-mx-5">
                            {checkoutItems.map((item, idx) => {
                                const uniqueId = item.cartItemId || `${item._id}-${idx}`;
                                return (
                                    <div key={uniqueId} className="flex gap-4 px-5 py-4 border-b border-default">
                                        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                                            <img src={item.images?.[0]?.url || item.image?.url || item.image || "/placeholder.png"} alt={item.name} loading="lazy" className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm text-primary mb-2 leading-snug">{item.name}</div>
                                            {item.selectedSize && <div className="text-[11px] text-secondary mb-0.5">Size: {item.selectedSize}</div>}
                                            {item.selectedColor && <div className="text-[11px] text-secondary mb-0.5">Color: {item.selectedColor}</div>}
                                            <div className="text-xs text-secondary mb-3">Qty: {item.quantity}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-base font-semibold text-primary">{fmt(item.price * item.quantity)}</span>
                                                {item.mrp > item.price && <span className="text-sm text-muted line-through">{fmt(item.mrp * item.quantity)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="px-5 py-4 bg-canvas flex justify-between items-center flex-wrap gap-3">
                                <span className="text-[13px] text-primary">Order confirmation email will be sent to <b>{contact.email || "your email"}</b></span>
                                <Button variant="hour" onClick={() => setStep(4)}>Continue</Button>
                            </div>
                        </div>
                    </StepCard>

                    {/* STEP 4: PAYMENT OPTIONS */}
                    <StepCard num={4} title="Payment Options" active={step === 4} done={false}>
                        <div className="-mx-5 flex flex-col">
                            {/* Online */}
                            <div
                                onClick={() => selectPaymentMethod("online")}
                                className="flex items-start gap-4 px-5 py-4 border-b border-default cursor-pointer"
                            >
                                <div className={cn("w-[18px] h-[18px] rounded-full flex-shrink-0 mt-0.5", paymentMethod === "online" ? "border-[5px] border-[var(--accent-hour)]" : "border-2 border-[var(--color-graphite-300)]")} />
                                <div className="flex-1 flex flex-col gap-1">
                                    <span className="text-[15px] text-primary">UPI, Wallets, Credit / Debit Card</span>
                                    <span className="text-xs text-secondary">Fast & Secure Payments</span>
                                    {paymentMethod === "online" && (
                                        <Button variant="hour" className="mt-4" onClick={handlePayOnline} loading={loading || payState === "processing"}>
                                            {loading || payState === "processing" ? "Processing..." : `Pay ${fmt(finalTotal)}`}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* COD */}
                            <div
                                onClick={() => codAvailable && selectPaymentMethod("cod")}
                                className={cn("flex items-start gap-4 px-5 py-4 cursor-pointer", (!codAvailable && !codChecking) && "opacity-50 pointer-events-none")}
                            >
                                <div className={cn("w-[18px] h-[18px] rounded-full flex-shrink-0 mt-0.5", paymentMethod === "cod" ? "border-[5px] border-[var(--accent-hour)]" : "border-2 border-[var(--color-graphite-300)]")} />
                                <div className="flex-1 flex flex-col gap-1">
                                    <span className="text-[15px] text-primary">Cash on Delivery</span>
                                    {codChecking ? (
                                        <span className="text-xs text-secondary">Checking availability...</span>
                                    ) : codAvailable ? (
                                        <span className="text-xs text-secondary">Pay at your doorstep</span>
                                    ) : (
                                        <span className="text-xs text-error">Not available for this location</span>
                                    )}
                                    {paymentMethod === "cod" && codAvailable && (
                                        <Button variant="hour" className="mt-4" onClick={handleCOD} loading={loading || payState === "processing"}>
                                            {loading || payState === "processing" ? "Processing..." : "Place Order"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </StepCard>
                </div>

                {/* Coupon — BUG FIX: no coupon input existed anywhere on
                    this page; pricing already had a display-only
                    `couponDiscount` row below with nothing to ever populate
                    it. */}
                <Card padding="none" className="sticky top-4 hidden md:block mb-3">
                    <div className="p-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-primary">
                            <FiTag size={13} className="text-[var(--accent-hour)]" aria-hidden="true" /> Coupon / Promo Code
                        </div>
                        {coupon ? (
                            <div className="mt-2.5 bg-success-tint border border-[var(--color-success-100)] rounded-[var(--radius-sm)] px-3.5 py-2.5 flex justify-between items-center">
                                <div>
                                    <div className="text-xs font-semibold text-success">✅ {coupon.code} applied!</div>
                                    <div className="text-xs text-success font-semibold">You save {fmt(coupon.discount)}</div>
                                </div>
                                <button onClick={removeCoupon} aria-label="Remove coupon" className="text-[var(--color-error-500)] text-base">✕</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-2 mt-2.5">
                                    <input
                                        className="flex-1 min-w-0 px-3 py-2 border border-default rounded-[var(--radius-sm)] text-[13px] outline-none focus:border-[var(--accent-hour)] transition-colors"
                                        placeholder="Enter coupon code"
                                        value={couponCode}
                                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                        onKeyDown={e => e.key === "Enter" && applyCoupon()}
                                    />
                                    <Button variant="hour" onClick={applyCoupon} loading={couponApplying}>Apply</Button>
                                </div>
                                {couponErr && <p className="text-xs text-error mt-2">⚠️ {couponErr}</p>}
                            </>
                        )}
                    </div>
                </Card>

                {/* Sidebar: Order Summary */}
                <Card padding="none" className="sticky top-4 hidden md:block">
                    <div className="px-5 py-3.5 border-b border-default text-sm font-semibold text-secondary uppercase">Price Details</div>
                    {pricingLoading ? (
                        <div className="p-5 flex items-center gap-2.5 text-sm text-secondary"><Loader size="sm" /> Calculating…</div>
                    ) : pricing ? (
                        <div className="p-5">
                            <div className="flex justify-between text-sm text-primary mb-4">
                                <span>Price ({checkoutItems.length} item{checkoutItems.length > 1 ? "s" : ""})</span>
                                <span>{fmt(pricing.itemsTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-primary mb-4">
                                <span>Delivery Charges</span>
                                <span className={pricing.deliveryCharge === 0 ? "text-success" : ""}>
                                    {pricing.deliveryCharge === 0 ? "FREE" : fmt(pricing.deliveryCharge)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-primary mb-4">
                                <span>Platform Fee</span>
                                <span>{fmt(pricing.platformFee)}</span>
                            </div>
                            {pricing.couponDiscount > 0 && (
                                <div className="flex justify-between text-sm text-success mb-4">
                                    <span>Coupon Discount</span>
                                    <span>−{fmt(pricing.couponDiscount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-semibold text-primary pt-4 border-t border-dashed border-default mt-1">
                                <span>Amount Payable</span>
                                <span>{fmt(pricing.finalTotal)}</span>
                            </div>
                            {pricing.couponDiscount > 0 && (
                                <div className="text-success text-[13px] font-semibold mt-3">
                                    Your Total Savings on this order {fmt(pricing.couponDiscount)}
                                </div>
                            )}
                        </div>
                    ) : null}
                    <div className="flex items-center gap-2 mt-4 justify-center text-secondary text-xs font-semibold pb-6">
                        <FiShield size={16} aria-hidden="true" /> Safe and Secure Payments
                    </div>
                </Card>

                {/* Mobile order summary toggle */}
                <button
                    onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
                    className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-graphite-900)] text-white px-4 py-3 z-50 flex justify-between items-center text-[13px] font-bold"
                >
                    <span>{checkoutItems.length} item{checkoutItems.length > 1 ? "s" : ""} · {fmt(finalTotal)}</span>
                    {mobileSummaryOpen ? <FiChevronDown size={12} aria-hidden="true" /> : <FiChevronUp size={12} aria-hidden="true" />}
                </button>
                {mobileSummaryOpen && (
                    <div className="md:hidden fixed bottom-11 left-0 right-0 bg-surface border-t border-default px-4 py-3 z-40 max-h-[40vh] overflow-y-auto shadow-lg">
                        {checkoutItems.map((item, idx) => (
                            <div key={item.cartItemId || `${item._id}-${idx}`} className="flex gap-3 mb-3">
                                <img src={item.images?.[0]?.url || item.image || "/placeholder.png"} alt={item.name} loading="lazy" className="w-10 h-10 object-contain" onError={(e) => { e.target.src = "/placeholder.png"; }} />
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-primary mb-1">{item.name}</div>
                                    <div className="text-[11px] text-secondary">Qty: {item.quantity} · {fmt(item.price * item.quantity)}</div>
                                </div>
                            </div>
                        ))}

                        {/* Coupon — mobile parity for the desktop card above */}
                        <div className="border-t border-default pt-3 mt-1">
                            {coupon ? (
                                <div className="bg-success-tint border border-[var(--color-success-100)] rounded-[var(--radius-sm)] px-3 py-2 flex justify-between items-center">
                                    <span className="text-xs font-semibold text-success">✅ {coupon.code} · saved {fmt(coupon.discount)}</span>
                                    <button onClick={removeCoupon} aria-label="Remove coupon" className="text-[var(--color-error-500)] text-sm">✕</button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 min-w-0 px-3 py-2 border border-default rounded-[var(--radius-sm)] text-[13px] outline-none focus:border-[var(--accent-hour)] transition-colors"
                                        placeholder="Coupon code"
                                        value={couponCode}
                                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                        onKeyDown={e => e.key === "Enter" && applyCoupon()}
                                    />
                                    <Button variant="hour" onClick={applyCoupon} loading={couponApplying}>Apply</Button>
                                </div>
                            )}
                            {couponErr && <p className="text-xs text-error mt-1.5">⚠️ {couponErr}</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ── Inline Address Form ──────────────────────────────── */
const AddressFormInline = ({ initial, saving, onSave, onCancel }) => {
    const [form, setForm] = useState({
        label: initial?.label || "Home",
        name: initial?.name || "",
        phone: initial?.phone || "",
        house: initial?.house || "",
        area: initial?.area || "",
        landmark: initial?.landmark || "",
        city: initial?.city || "",
        state: initial?.state || "",
        pincode: initial?.pincode || "",
        lat: initial?.lat ?? null,
        lng: initial?.lng ?? null,
    });
    const [formError, setFormError] = useState("");
    // BUG FIX: this form had no way to capture GPS coordinates at all —
    // unlike the ecommerce checkout's AddressForm, every address saved here
    // went to the backend with lat/lng null, so Urbexon Hour's own distance/
    // ETA/serviceability engine had nothing to compute a real distance from
    // for orders using a freshly-added address. Mirrors AddressForm.jsx's
    // exact GPS + backend-pincode-authority pattern.
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsMsg, setGpsMsg] = useState("");

    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleGPS = () => {
        if (!navigator.geolocation) { setGpsMsg("Location not supported"); return; }
        setGpsLoading(true); setGpsMsg("");
        navigator.geolocation.getCurrentPosition(
            async ({ coords: { latitude, longitude } }) => {
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                        { headers: { "User-Agent": "Urbexon/2.0" } }
                    );
                    const data = await res.json();
                    const addr = data.address || {};
                    let pin = addr.postcode || "";

                    // Backend is the single source of truth for the final
                    // pincode — only ever corrects the guess, never blocks.
                    try {
                        const { data: nearest } = await resolveNearestPincode(latitude, longitude);
                        if (nearest?.success && nearest.found && nearest.code) pin = nearest.code;
                    } catch { /* fall back to reverse-geocoder's postcode */ }

                    setForm((f) => ({
                        ...f,
                        area: addr.suburb || addr.neighbourhood || addr.road || f.area,
                        city: addr.city || addr.town || addr.village || f.city,
                        state: addr.state || f.state,
                        pincode: pin || f.pincode,
                        lat: latitude, lng: longitude,
                    }));
                    setGpsMsg(`📍 ${addr.city || addr.town || "Location"} detected`);
                } catch { setGpsMsg("Could not fetch address details"); }
                setGpsLoading(false);
            },
            () => { setGpsMsg("Location permission denied"); setGpsLoading(false); },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) return setFormError("Name required");
        if (!/^[6-9]\d{9}$/.test(form.phone)) return setFormError("Valid phone required");
        if (!form.house.trim()) return setFormError("House/flat required");
        if (!form.area.trim()) return setFormError("Area/street required");
        if (!form.city.trim()) return setFormError("City required");
        if (!form.state.trim()) return setFormError("State required");
        if (!/^\d{6}$/.test(form.pincode)) return setFormError("Valid 6-digit pincode required");

        // ✅ FIX: Ensure GPS coordinates are captured before saving
        // If user hasn't clicked "Use my location", capture it automatically for accurate distance calculation
        let finalForm = { ...form };
        if (!finalForm.lat || !finalForm.lng) {
            if (navigator.geolocation) {
                try {
                    const coords = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(
                            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
                            (err) => reject(err),
                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
                        );
                    });
                    finalForm = { ...finalForm, ...coords };
                } catch (err) {
                    // Silent fail - location capture is optional but recommended
                    console.warn("[AddressForm] GPS auto-capture failed:", err.message);
                }
            }
        }

        setFormError("");
        onSave(finalForm);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium text-primary">{initial ? "Edit Address" : "Add New Address"}</h3>
                <button
                    type="button" onClick={handleGPS} disabled={gpsLoading}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-hour-hover)] border border-[var(--accent-hour)] rounded-full px-3 py-1.5 disabled:opacity-50"
                >
                    <FiMapPin size={11} aria-hidden="true" />
                    {gpsLoading ? "Detecting…" : "Use my location"}
                </button>
            </div>
            {gpsMsg && (
                <p className={cn("text-xs font-medium -mt-1", gpsMsg.startsWith("📍") ? "text-success" : "text-error")}>{gpsMsg}</p>
            )}
            {formError && <Alert variant="error">{formError}</Alert>}
            <div className="flex gap-3 mb-2">
                {["Home", "Work", "Other"].map((l) => {
                    const Icon = LABEL_ICONS[l];
                    return (
                        <button
                            key={l}
                            onClick={() => update("label", l)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-sm)] text-[13px] font-medium uppercase border",
                                form.label === l ? "border-[var(--accent-hour)] text-[var(--accent-hour-hover)]" : "border-default text-primary"
                            )}
                        >
                            <Icon size={10} aria-hidden="true" /> {l}
                        </button>
                    );
                })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Name" value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={100} />
                <Input label="Phone" value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} inputMode="numeric" />
                <div className="sm:col-span-2">
                    <Input label="House / Flat / Building" value={form.house} onChange={(e) => update("house", e.target.value)} maxLength={200} />
                </div>
                <div className="sm:col-span-2">
                    <Input label="Area / Street / Colony" value={form.area} onChange={(e) => update("area", e.target.value)} maxLength={200} />
                </div>
                <Input label="Landmark" value={form.landmark} onChange={(e) => update("landmark", e.target.value)} maxLength={100} placeholder="Optional" />
                <Input label="City" value={form.city} onChange={(e) => update("city", e.target.value)} maxLength={100} />
                <Input label="State" value={form.state} onChange={(e) => update("state", e.target.value)} maxLength={100} />
                <Input label="Pincode" value={form.pincode} onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} inputMode="numeric" />
            </div>
            <div className="flex gap-4 mt-2">
                <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
                <Button variant="hour" className="flex-1" onClick={handleSubmit} loading={saving}>
                    {initial ? "Update" : "Save Address"}
                </Button>
            </div>
        </div>
    );
};

export default UHCheckout;