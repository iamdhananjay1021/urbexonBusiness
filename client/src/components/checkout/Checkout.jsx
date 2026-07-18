/**
 * Checkout.jsx — v3 Complete Scratch Rewrite
 * ─────────────────────────────────────────────────────────
 * ✅ Full Tailwind CSS — zero inline <style> blocks
 * ✅ Premium light-mode UI — clean cards, Signal indigo accent
 * ✅ Standalone page (no MainLayout) — own minimal header
 * ✅ Mobile sticky CTA fixed bottom
 * ✅ All business logic 100% preserved from v2
 * ✅ Cormorant Garamond for headings via Tailwind font config
 *
 * AppRoutes.jsx me Checkout MainLayout ke BAHAR rakho:
 *   <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
 */
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
    FaArrowLeft, FaShieldAlt, FaTruck, FaCheckCircle,
    FaUser, FaMapMarkerAlt, FaClipboardList,
    FaPencilAlt, FaCreditCard, FaLock, FaRedo, FaMoneyBillWave,
    FaImage, FaSpinner, FaPlus, FaEdit, FaTrash,
    FaHome, FaBriefcase, FaBookmark, FaChevronDown, FaChevronUp,
    FaStar, FaShoppingCart, FaBolt, FaTag,
} from "react-icons/fa";
import { useState } from "react";
import { useCheckout } from "../../hooks/useCheckout";
import { validateCoupon } from "../../api/orderApi";
import BackButton from "../BackButton";
import PriceSummary from "./PriceSummary";
import AddressForm from "./AddressForm";
import SEO from "../SEO";

const fmt = n => Number(n || 0).toLocaleString("en-IN");

const LABEL_META = {
    Home: { icon: <FaHome size={9} />, cls: "bg-amber-50  text-amber-700  border-amber-200" },
    Work: { icon: <FaBriefcase size={9} />, cls: "bg-blue-50   text-blue-700   border-blue-200" },
    Other: { icon: <FaMapMarkerAlt size={9} />, cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

const STEPS = [
    { id: 1, label: "Contact", icon: <FaUser size={11} /> },
    { id: 2, label: "Address", icon: <FaMapMarkerAlt size={11} /> },
    { id: 3, label: "Payment", icon: <FaCreditCard size={11} /> },
];

/* ─── Small reusable atoms ─── */
const SectionCard = ({ children, className = "" }) => (
    <div className={`bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden mb-4 ${className}`}>
        {children}
    </div>
);

const CardHeader = ({ icon, title }) => (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100 bg-neutral-50/60">
        <div className="w-8 h-8 rounded-xl bg-accent-tint flex items-center justify-center text-accent shrink-0">
            {icon}
        </div>
        <h2 className="text-[15px] font-bold text-neutral-900 tracking-tight">{title}</h2>
    </div>
);

const FieldLabel = ({ children, optional }) => (
    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
        {children}
        {optional && <span className="normal-case tracking-normal text-neutral-300 font-normal text-[10px]">(optional)</span>}
    </label>
);

const Input = ({ className = "", ...props }) => (
    <input
        {...props}
        className={`w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl
                    text-sm text-neutral-900 outline-none transition-all duration-150
                    placeholder:text-neutral-300
                    focus:border-[var(--accent-primary)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)]
                    ${className}`}
    />
);

const ErrorBanner = ({ msg }) => msg ? (
    <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium mb-4">
        <span className="shrink-0 mt-0.5">⚠</span> {msg}
    </div>
) : null;

/* ─── Step Dot ─── */
const StepDot = ({ state, icon }) => {
    const base = "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all duration-300";
    if (state === "done") return <div className={`${base} bg-green-500 text-white`}><FaCheckCircle size={13} /></div>;
    if (state === "active") return <div className={`${base} bg-accent text-white shadow-[0_0_0_4px_rgba(79,70,229,0.2)]`}>{icon}</div>;
    return <div className={`${base} bg-neutral-100 text-neutral-400`}>{icon}</div>;
};

/* ─── Primary CTA Button ─── */
const CtaButton = ({ onClick, disabled, loading, loadingText, children, variant = "dark", className = "" }) => {
    const variants = {
        dark: "bg-neutral-900 hover:bg-neutral-800 text-white",
        orange: "bg-accent hover:bg-accent-hover text-white shadow-[0_4px_16px_rgba(79,70,229,0.35)] hover:shadow-[0_6px_22px_rgba(79,70,229,0.45)]",
        green: "bg-green-600 hover:bg-green-700 text-white",
        red: "bg-red-500 hover:bg-red-600 text-white",
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`w-full flex items-center justify-center gap-2.5
                        h-12 rounded-2xl text-sm font-bold tracking-wide
                        transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        active:scale-[0.98] hover:-translate-y-0.5
                        ${variants[variant]} ${className}`}>
            {loading
                ? <><FaSpinner size={13} className="animate-spin" /> {loadingText || "Loading…"}</>
                : children}
        </button>
    );
};

/* ═══════════════════════════════════════════════════
   MAIN CHECKOUT
═══════════════════════════════════════════════════ */
const Checkout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const buyNowItem = (() => {
        if (location.state?.buyNowItem) return location.state.buyNowItem;
        try {
            const stored = sessionStorage.getItem("ux_buy_now_item");
            if (stored) { const p = JSON.parse(stored); sessionStorage.removeItem("ux_buy_now_item"); return p; }
        } catch { /* malformed/missing sessionStorage buy-now item — falls through to null below */ }
        return null;
    })();
    const couponFromCart = location.state?.coupon || null;

    const ck = useCheckout(buyNowItem, couponFromCart);
    const {
        step, setStep, error, setError,
        contact, setContact,
        addresses, addrLoading, selectedAddrId, setSelectedAddrId, selectedAddress,
        showAddForm, setShowAddForm, editingAddr, setEditingAddr,
        savingAddr, deleteConfirmId, setDeleteConfirmId,
        paymentMethod, selectPaymentMethod, payState, loading,
        codStatus, codChecking, codAvailable, deliveryETA,
        shippingInfo,
        pricing, pricingLoading,
        deliveryType, setDeliveryType,
        mobileSummaryOpen, setMobileSummaryOpen,
        checkoutItems,
        coupon, setCoupon,
        handleContactContinue, handleAddressContinue,
        handleAddAddress, handleEditAddress, handleDeleteAddress, handleSetDefault,
        handleCOD, handlePayOnline,
    } = ck;

    const finalTotal = pricing?.finalTotal || 0;

    // BUG FIX: there was no way to apply/change/remove a coupon on this
    // page at all — `coupon` used to arrive read-only from Cart.jsx's nav
    // state, and "Buy Now" (which bypasses Cart entirely) had no coupon
    // affordance whatsoever. Self-contained apply/remove logic, same
    // pattern as Cart.jsx's working coupon UI.
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
                orderType: deliveryType === "URBEXON_HOUR" ? "urbexon_hour" : "ecommerce",
            });
            setCoupon(data);
            setCouponCode("");
        } catch (e) {
            setCouponErr(e.response?.data?.message || "Invalid coupon");
        } finally { setCouponApplying(false); }
    };

    const removeCoupon = () => { setCoupon(null); setCouponCode(""); setCouponErr(""); };

    /* ── Empty cart guard ── */
    if (!checkoutItems?.length) return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center">
                <FaShoppingCart size={24} className="text-neutral-400" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900">Your cart is empty</h2>
            <p className="text-sm text-neutral-500">Add items before checking out</p>
            <button onClick={() => navigate("/")}
                className="mt-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white
                           rounded-xl font-bold text-sm transition-colors">
                Continue Shopping
            </button>
        </div>
    );

    /* ── Mobile CTA content ── */
    const MobileCta = () => (
        <div className="fixed bottom-0 left-0 right-0 z-[200] bg-white border-t border-neutral-100
                        shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-4 py-3
                        pb-[calc(12px+env(safe-area-inset-bottom,0px))] md:hidden">
            {step === 1 && (
                <CtaButton onClick={handleContactContinue} variant="dark">
                    Continue to Address <FaArrowLeft size={10} className="rotate-180" />
                </CtaButton>
            )}
            {step === 2 && (
                <CtaButton onClick={handleAddressContinue} variant="dark">
                    Continue to Payment <FaArrowLeft size={10} className="rotate-180" />
                </CtaButton>
            )}
            {step === 3 && paymentMethod === "cod" && (
                <CtaButton onClick={handleCOD} loading={loading} loadingText="Placing Order…" variant="green">
                    <FaMoneyBillWave size={13} /> Place Order (COD) · ₹{fmt(finalTotal)}
                </CtaButton>
            )}
            {step === 3 && paymentMethod === "online" && (
                <CtaButton onClick={handlePayOnline} loading={loading} loadingText="Processing…"
                    variant={payState === "failed" ? "red" : "orange"}>
                    {payState === "failed"
                        ? <><FaRedo size={11} /> Retry · ₹{fmt(finalTotal)}</>
                        : <><FaLock size={11} /> Pay ₹{fmt(finalTotal)} Securely</>}
                </CtaButton>
            )}
            {step === 3 && !paymentMethod && (
                <button disabled
                    className="w-full h-12 rounded-2xl bg-neutral-200 text-neutral-400
                               text-sm font-bold cursor-not-allowed">
                    Select a Payment Method
                </button>
            )}
        </div>
    );

    return (
        <>
            <SEO title="Checkout — Urbexon" noindex />

            <div className="min-h-screen bg-canvas flex flex-col">

                {/* ════════════════════════════
                    HEADER — own, standalone
                ════════════════════════════ */}
                <header className="sticky top-0 z-50 bg-white border-b border-[var(--color-graphite-100)] h-14 flex items-center justify-between px-4 sm:px-6 shrink-0">
                    {/* Logo — same wordmark treatment as the global navbar */}
                    <Link to="/" className="no-underline flex items-center">
                        <span className="font-display text-[19px] font-extrabold text-primary tracking-[-0.025em] leading-none">
                            Urbexon
                        </span>
                    </Link>

                    {/* Stepper — center, desktop */}
                    <div className="hidden sm:flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
                        {STEPS.map((s, i) => {
                            const state = step > s.id ? "done" : step === s.id ? "active" : "pending";
                            return (
                                <div key={s.id} className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <StepDot state={state} icon={s.icon} />
                                        <span className={`text-[11px] font-semibold tracking-wide
                                            ${state === "done" ? "text-success" : state === "active" ? "text-accent" : "text-muted"}`}>
                                            {s.label}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`w-8 h-[1.5px] mx-1 rounded-full
                                            ${step > s.id ? "bg-[var(--icon-success)]" : "bg-[var(--color-graphite-200)]"}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Secure badge */}
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                        <FaShieldAlt size={10} className="text-[var(--icon-success)]" /> <span className="hidden sm:inline">Secure Checkout</span>
                    </div>
                </header>

                {/* Mobile step bar */}
                <div className="sm:hidden bg-white border-b border-neutral-100 px-4 py-2.5 flex items-center gap-2">
                    {STEPS.map((s, i) => {
                        const state = step > s.id ? "done" : step === s.id ? "active" : "pending";
                        return (
                            <div key={s.id} className="flex items-center gap-1.5 flex-1">
                                <StepDot state={state} icon={s.icon} />
                                <span className={`text-[10px] font-semibold
                                    ${state === "done" ? "text-green-500" : state === "active" ? "text-accent" : "text-neutral-400"}`}>
                                    {s.label}
                                </span>
                                {i < STEPS.length - 1 && (
                                    <div className={`flex-1 h-[1.5px] mx-1 rounded-full
                                        ${step > s.id ? "bg-green-400" : "bg-neutral-200"}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Mobile order total bar */}
                <div
                    className="md:hidden flex items-center justify-between px-4 py-2.5
                               bg-accent-tint border-b border-[var(--accent-primary-tint)] cursor-pointer"
                    onClick={() => setMobileSummaryOpen(o => !o)}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary-hover)]">
                        <FaTag size={10} /> Order Total
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[17px] font-bold text-[var(--accent-primary-hover)]">
                            {pricingLoading ? "…" : `₹${fmt(finalTotal)}`}
                        </span>
                        <span className="text-[10px] text-accent flex items-center gap-0.5">
                            {mobileSummaryOpen ? <FaChevronUp size={8} /> : <FaChevronDown size={8} />} Details
                        </span>
                    </div>
                </div>

                {/* Mobile accordion summary */}
                <div className={`md:hidden overflow-hidden transition-all duration-300 bg-accent-tint border-b border-[var(--accent-primary-tint)]
                                 ${mobileSummaryOpen ? "max-h-48" : "max-h-0"}`}>
                    <div className="px-4 py-3 flex flex-col gap-2">
                        <div className="flex justify-between text-xs text-neutral-600">
                            <span>Items ({checkoutItems.length})</span>
                            <span className="font-semibold">₹{fmt(pricing?.itemsTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-neutral-600">
                            <span>Delivery</span>
                            <span className={`font-semibold ${pricing?.deliveryCharge === 0 && paymentMethod !== "cod" ? "text-green-600" : ""}`}>
                                {pricing?.deliveryCharge === 0 && paymentMethod !== "cod" ? "FREE" : `₹${fmt(pricing?.deliveryCharge)}`}
                            </span>
                        </div>
                        <div className="h-px bg-accent-tint" />
                        <div className="flex justify-between">
                            <span className="text-sm font-bold text-neutral-900">Total</span>
                            <span className="text-[17px] font-bold text-[var(--accent-primary-hover)]">₹{fmt(finalTotal)}</span>
                        </div>
                    </div>
                </div>

                {/* ════════════════════════════
                    BODY
                ════════════════════════════ */}
                <div className="flex-1 pb-24 md:pb-10">
                    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

                        {/* Back button — BUG FIX: step 1 used to do a blind
                            navigate(-1) with no real-history guard, same class
                            of bug already fixed elsewhere via BackButton's
                            smart-back (a deep link/refresh straight onto
                            checkout had nothing to go back to and could exit
                            the site). onClick override handles the wizard's
                            own step-back behavior for step > 1. */}
                        <BackButton
                            onClick={() => {
                                if (step > 1) { setStep(step - 1); return; }
                                if (location.key !== "default") navigate(-1);
                                else navigate("/cart");
                            }}
                            label={step === 1 ? "Back to Cart" : `Back to ${STEPS[step - 2].label}`}
                            className="!text-neutral-500 hover:!text-neutral-900 mb-5 !normal-case !tracking-normal !text-sm"
                        />

                        <div className="flex gap-5 items-start">

                            {/* ══ MAIN COLUMN ══ */}
                            <div className="flex-1 min-w-0">

                                {/* ─────────────────────────────
                                    STEP 1 — Contact
                                ───────────────────────────── */}
                                {step === 1 && (
                                    <SectionCard>
                                        <CardHeader icon={<FaUser size={14} />} title="Contact Details" />
                                        <div className="p-5 flex flex-col gap-4">
                                            <div>
                                                <FieldLabel>Full Name</FieldLabel>
                                                <Input value={contact.name} placeholder="Rahul Verma"
                                                    onChange={e => { setContact(c => ({ ...c, name: e.target.value })); setError(""); }} />
                                            </div>
                                            <div>
                                                <FieldLabel>Mobile Number</FieldLabel>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2
                                                                     text-sm font-semibold text-neutral-500 pointer-events-none">
                                                        +91
                                                    </span>
                                                    <Input value={contact.phone} maxLength={10} placeholder="10-digit number"
                                                        onChange={e => { setContact(c => ({ ...c, phone: e.target.value })); setError(""); }}
                                                        className="pl-12" />
                                                </div>
                                            </div>
                                            <div>
                                                <FieldLabel optional>Email</FieldLabel>
                                                <Input type="email" value={contact.email} placeholder="rahul@email.com"
                                                    onChange={e => setContact(c => ({ ...c, email: e.target.value }))} />
                                                <p className="text-[10px] text-neutral-400 mt-1.5">
                                                    We'll send your order confirmation here
                                                </p>
                                            </div>
                                            <ErrorBanner msg={error} />
                                            <div className="hidden md:block">
                                                <CtaButton onClick={handleContactContinue} variant="dark">
                                                    Continue to Address <FaArrowLeft size={10} className="rotate-180" />
                                                </CtaButton>
                                            </div>
                                        </div>
                                    </SectionCard>
                                )}

                                {/* ─────────────────────────────
                                    STEP 2 — Address
                                ───────────────────────────── */}
                                {step === 2 && (
                                    <SectionCard>
                                        <CardHeader icon={<FaMapMarkerAlt size={14} />} title="Delivery Address" />
                                        <div className="p-5">
                                            {addrLoading ? (
                                                <div className="flex flex-col gap-3">
                                                    {[1, 2].map(i => (
                                                        <div key={i} className="h-20 bg-neutral-100 rounded-2xl animate-pulse" />
                                                    ))}
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Address list */}
                                                    <div className="flex flex-col gap-3 mb-4">
                                                        {addresses.map(addr => {
                                                            const lm = LABEL_META[addr.label] || LABEL_META.Other;
                                                            const isSelected = selectedAddrId === addr._id;
                                                            const isEditing = editingAddr?._id === addr._id;
                                                            return (
                                                                <div key={addr._id}
                                                                    onClick={() => { if (!editingAddr && !showAddForm) setSelectedAddrId(addr._id); }}
                                                                    className={`relative rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden
                                                                        ${isSelected
                                                                            ? "border-[var(--accent-primary)] bg-accent-tint/60 shadow-[0_0_0_3px_rgba(79,70,229,0.1)]"
                                                                            : "border-neutral-100 bg-white hover:border-neutral-300"}`}>

                                                                    {/* Selected tick */}
                                                                    {isSelected && !isEditing && (
                                                                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent
                                                                                        flex items-center justify-center">
                                                                            <FaCheckCircle size={11} className="text-white" />
                                                                        </div>
                                                                    )}

                                                                    <div className="p-4">
                                                                        {isEditing ? (
                                                                            <AddressForm initial={editingAddr}
                                                                                onSave={handleEditAddress}
                                                                                onCancel={() => setEditingAddr(null)}
                                                                                saving={savingAddr} />
                                                                        ) : (
                                                                            <>
                                                                                {/* Label chip */}
                                                                                <div className={`inline-flex items-center gap-1.5 text-[9px] font-black
                                                                                                 uppercase tracking-widest px-2 py-0.5 rounded-lg
                                                                                                 border mb-2.5 ${lm.cls}`}>
                                                                                    {lm.icon} {addr.label}
                                                                                    {addr.isDefault && (
                                                                                        <span className="ml-1 bg-green-100 text-green-700 px-1.5 rounded-md">
                                                                                            Default
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                <p className="text-sm font-bold text-neutral-900 mb-0.5">
                                                                                    {addr.name}
                                                                                    <span className="font-normal text-neutral-500 ml-1.5">{addr.phone}</span>
                                                                                </p>
                                                                                <p className="text-xs text-neutral-500 leading-relaxed">
                                                                                    {addr.house}, {addr.area},
                                                                                    {addr.landmark ? ` ${addr.landmark},` : ""} {addr.city}, {addr.state} — {addr.pincode}
                                                                                </p>

                                                                                {/* Actions */}
                                                                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-neutral-100 flex-wrap">
                                                                                    <button
                                                                                        onClick={e => { e.stopPropagation(); setEditingAddr(addr); setShowAddForm(false); }}
                                                                                        className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600
                                                                                                   hover:text-blue-700 transition-colors">
                                                                                        <FaEdit size={9} /> Edit
                                                                                    </button>
                                                                                    {!addr.isDefault && (
                                                                                        <button
                                                                                            onClick={e => { e.stopPropagation(); handleSetDefault(addr._id); }}
                                                                                            className="flex items-center gap-1.5 text-[11px] font-bold text-green-600
                                                                                                       hover:text-green-700 transition-colors">
                                                                                            <FaBookmark size={9} /> Set Default
                                                                                        </button>
                                                                                    )}
                                                                                    <div className="ml-auto">
                                                                                        {deleteConfirmId === addr._id ? (
                                                                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                                                <span className="text-[11px] font-bold text-red-500">Delete?</span>
                                                                                                <button onClick={() => handleDeleteAddress(addr._id)}
                                                                                                    className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-lg">
                                                                                                    Yes
                                                                                                </button>
                                                                                                <button onClick={() => setDeleteConfirmId(null)}
                                                                                                    className="text-[10px] font-bold bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-lg">
                                                                                                    No
                                                                                                </button>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <button
                                                                                                onClick={e => { e.stopPropagation(); setDeleteConfirmId(addr._id); }}
                                                                                                className="flex items-center gap-1.5 text-[11px] font-bold text-red-400
                                                                                                           hover:text-red-600 transition-colors">
                                                                                                <FaTrash size={9} /> Delete
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Add new address */}
                                                    {addresses.length < 5 && (
                                                        showAddForm ? (
                                                            <div className="border-2 border-dashed border-[var(--accent-primary)] bg-accent-tint/60 rounded-2xl p-4 mb-4">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-3 flex items-center gap-1.5">
                                                                    <FaPlus size={8} /> New Address
                                                                </p>
                                                                <AddressForm onSave={handleAddAddress} onCancel={() => setShowAddForm(false)} saving={savingAddr} />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setShowAddForm(true); setEditingAddr(null); }}
                                                                className="w-full flex items-center justify-center gap-2 py-3.5
                                                                           border-2 border-dashed border-neutral-200 rounded-2xl
                                                                           text-sm font-semibold text-neutral-500
                                                                           hover:border-[var(--accent-primary)] hover:text-accent
                                                                           transition-all duration-200 mb-4">
                                                                <FaPlus size={11} /> Add New Address
                                                                <span className="text-[11px] text-neutral-300 font-normal">({addresses.length}/5)</span>
                                                            </button>
                                                        )
                                                    )}

                                                    <ErrorBanner msg={error} />
                                                    <div className="hidden md:block">
                                                        <CtaButton onClick={handleAddressContinue} variant="dark">
                                                            Continue to Payment <FaArrowLeft size={10} className="rotate-180" />
                                                        </CtaButton>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </SectionCard>
                                )}

                                {/* ─────────────────────────────
                                    STEP 3 — Payment
                                ───────────────────────────── */}
                                {step === 3 && (
                                    <>
                                        {/* Order items */}
                                        <SectionCard>
                                            <CardHeader icon={<FaClipboardList size={14} />} title="Order Summary" />
                                            <div className="p-5 flex flex-col gap-4">
                                                {checkoutItems.map((item, idx) => (
                                                    <div key={item.cartKey || item._id || idx}
                                                        className="flex gap-3 pb-4 border-b border-neutral-100 last:border-0 last:pb-0">
                                                        {/* Image */}
                                                        <div className="w-14 h-14 rounded-xl border border-neutral-100 bg-neutral-50 overflow-hidden shrink-0 flex items-center justify-center">
                                                            {item.images?.[0]?.url || item.image
                                                                ? <img src={item.images?.[0]?.url || item.image} alt={item.name}
                                                                    className="w-full h-full object-contain p-1" />
                                                                : <span className="text-2xl">🎁</span>}
                                                        </div>
                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-neutral-900 truncate mb-0.5">{item.name}</p>
                                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                <span className="text-xs text-neutral-400">Qty: {Number(item.quantity) || 1}</span>
                                                                {item.selectedSize && (
                                                                    <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-lg">
                                                                        {item.selectedSize}
                                                                    </span>
                                                                )}
                                                                {item.selectedColor && (
                                                                    <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-lg">
                                                                        {item.selectedColor}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[15px] font-bold text-neutral-900">
                                                                ₹{fmt(Number(item.price) * (Number(item.quantity) || 1))}
                                                                {(Number(item.quantity) || 1) > 1 && (
                                                                    <span className="text-[11px] text-neutral-400 font-normal ml-1.5">
                                                                        (₹{fmt(item.price)} × {Number(item.quantity) || 1})
                                                                    </span>
                                                                )}
                                                            </p>
                                                            {/* Customization */}
                                                            {(item.customization?.text || item.customization?.imageUrl || item.customization?.note) && (
                                                                <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1.5 flex items-center gap-1">
                                                                        <FaPencilAlt size={7} /> Customization
                                                                    </p>
                                                                    {item.customization.text && (
                                                                        <p className="text-xs text-neutral-700 mb-1">{item.customization.text}</p>
                                                                    )}
                                                                    {item.customization.imageUrl && (
                                                                        <div className="flex items-center gap-2">
                                                                            <img src={item.customization.imageUrl} alt="custom"
                                                                                className="w-10 h-10 object-cover rounded-lg border border-amber-200" />
                                                                            <span className="text-[11px] text-amber-700 font-semibold">Image uploaded</span>
                                                                        </div>
                                                                    )}
                                                                    {item.customization.note && (
                                                                        <p className="text-xs text-neutral-500 mt-1">{item.customization.note}</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </SectionCard>

                                        {/* Delivering to */}
                                        {selectedAddress && (
                                            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 mb-4
                                                            flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                                                        <FaTruck size={12} className="text-green-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Delivering To</p>
                                                        <p className="text-sm font-bold text-neutral-900">{selectedAddress.name}
                                                            <span className="font-normal text-neutral-500 ml-1.5">{selectedAddress.phone}</span>
                                                        </p>
                                                        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                                                            {selectedAddress.house}, {selectedAddress.area},
                                                            {selectedAddress.landmark ? ` ${selectedAddress.landmark},` : ""} {selectedAddress.city}, {selectedAddress.state} — {selectedAddress.pincode}
                                                        </p>
                                                        {deliveryETA && (
                                                            <div className="inline-flex items-center gap-1.5 mt-1.5
                                                                            text-[10px] font-bold text-green-700
                                                                            bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg">
                                                                <FaTruck size={8} /> {deliveryETA}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button onClick={() => setStep(2)}
                                                    className="text-[11px] font-bold text-accent hover:text-[var(--accent-primary-hover)]
                                                               whitespace-nowrap shrink-0 transition-colors">
                                                    Change
                                                </button>
                                            </div>
                                        )}

                                        {/* Delivery mode */}
                                        <SectionCard>
                                            <CardHeader icon={<FaTruck size={14} />} title="Delivery Mode" />
                                            <div className="p-5">
                                                <button
                                                    onClick={() => setDeliveryType("ECOMMERCE_STANDARD")}
                                                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200
                                                        ${deliveryType === "ECOMMERCE_STANDARD"
                                                            ? "border-[var(--accent-primary)] bg-accent-tint/60 shadow-[0_0_0_3px_rgba(79,70,229,0.08)]"
                                                            : "border-neutral-100 bg-neutral-50 hover:border-neutral-300"}`}>
                                                    <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
                                                        <FaTruck size={14} className="text-white" />
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <p className="text-sm font-bold text-neutral-900 mb-0.5">Standard Delivery</p>
                                                        <p className="text-xs text-neutral-500">
                                                            {shippingInfo?.etd || "3–5 business days"}
                                                            {shippingInfo?.courier ? ` · ${shippingInfo.courier}` : " · Shiprocket managed"}
                                                        </p>
                                                    </div>
                                                    {deliveryType === "ECOMMERCE_STANDARD" && (
                                                        <FaCheckCircle size={18} className="text-accent shrink-0" />
                                                    )}
                                                </button>
                                            </div>
                                        </SectionCard>

                                        {/* Payment */}
                                        <SectionCard>
                                            <CardHeader icon={<FaCreditCard size={14} />} title="Choose Payment" />
                                            <div className="p-5 flex flex-col gap-3">

                                                {/* Online payment */}
                                                <button
                                                    onClick={() => selectPaymentMethod("online")}
                                                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left
                                                                transition-all duration-200
                                                                ${paymentMethod === "online"
                                                            ? "border-[var(--accent-primary)] bg-accent-tint/60 shadow-[0_0_0_3px_rgba(79,70,229,0.08)]"
                                                            : "border-neutral-100 bg-neutral-50 hover:border-neutral-300"}`}>
                                                    <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
                                                        <FaLock size={13} className="text-white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                            <span className="text-sm font-bold text-neutral-900">Pay Online</span>
                                                            {pricing?.deliveryCharge === 0 && paymentMethod === "online" && (
                                                                <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-lg">
                                                                    🚚 FREE Delivery
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-neutral-500">UPI · Cards · Net Banking · EMI</p>
                                                    </div>
                                                    {paymentMethod === "online" && (
                                                        <FaCheckCircle size={18} className="text-accent shrink-0" />
                                                    )}
                                                </button>

                                                {/* COD */}
                                                {codChecking ? (
                                                    <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border-2 border-neutral-100">
                                                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                                                            <FaSpinner size={13} className="text-neutral-400 animate-spin" />
                                                        </div>
                                                        <p className="text-sm text-neutral-400">Checking delivery options…</p>
                                                    </div>
                                                ) : codAvailable ? (
                                                    <button
                                                        onClick={() => selectPaymentMethod("cod")}
                                                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left
                                                                    transition-all duration-200
                                                                    ${paymentMethod === "cod"
                                                                ? "border-green-400 bg-green-50/50 shadow-[0_0_0_3px_rgba(22,163,74,0.08)]"
                                                                : "border-neutral-100 bg-neutral-50 hover:border-neutral-300"}`}>
                                                        <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center shrink-0">
                                                            <FaMoneyBillWave size={13} className="text-white" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="text-sm font-bold text-neutral-900">Cash on Delivery</span>
                                                                <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-lg">COD</span>
                                                            </div>
                                                            <p className="text-xs text-neutral-500">
                                                                Pay on arrival · +₹{fmt(pricing?.codCharge || 70)} delivery
                                                            </p>
                                                        </div>
                                                        {paymentMethod === "cod" && (
                                                            <FaCheckCircle size={18} className="text-green-500 shrink-0" />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border-2 border-neutral-100 opacity-60">
                                                        <div className="w-10 h-10 rounded-xl bg-neutral-200 flex items-center justify-center shrink-0">
                                                            <FaMoneyBillWave size={13} className="text-neutral-400" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-neutral-500 mb-0.5">Cash on Delivery</p>
                                                            <p className="text-xs text-neutral-400">Not available for your pincode</p>
                                                        </div>
                                                        <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg whitespace-nowrap">
                                                            Coming Soon
                                                        </span>
                                                    </div>
                                                )}

                                                {/* COD coming soon notice */}
                                                {codStatus === "coming_soon" && (
                                                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100
                                                                    rounded-xl px-4 py-3 text-xs text-amber-700 font-medium">
                                                        <FaStar size={10} className="shrink-0 mt-0.5 text-amber-500" />
                                                        COD is not yet available for your pincode. Use online payment for faster checkout!
                                                    </div>
                                                )}

                                                <ErrorBanner msg={error} />

                                                {!paymentMethod && (
                                                    <p className="text-center text-xs text-neutral-400 py-2">
                                                        Select a payment method above to continue
                                                    </p>
                                                )}

                                                {/* Desktop CTA */}
                                                <div className="hidden md:flex flex-col gap-2.5 mt-2">
                                                    {paymentMethod === "cod" && (
                                                        <CtaButton onClick={handleCOD} loading={loading} loadingText="Placing Order…" variant="green">
                                                            <FaMoneyBillWave size={13} /> Place Order (COD) · ₹{fmt(finalTotal)}
                                                        </CtaButton>
                                                    )}
                                                    {paymentMethod === "online" && (
                                                        <CtaButton onClick={handlePayOnline} loading={loading} loadingText="Processing…"
                                                            variant={payState === "failed" ? "red" : "orange"}>
                                                            {payState === "failed"
                                                                ? <><FaRedo size={11} /> Retry · ₹{fmt(finalTotal)}</>
                                                                : <><FaLock size={11} /> Pay ₹{fmt(finalTotal)} Securely</>}
                                                        </CtaButton>
                                                    )}
                                                    <p className="text-center text-[10px] text-neutral-400 flex items-center justify-center gap-1.5">
                                                        <FaShieldAlt size={9} /> Your order is 100% secure & encrypted
                                                    </p>
                                                </div>
                                            </div>
                                        </SectionCard>
                                    </>
                                )}
                            </div>

                            {/* ══ SIDEBAR — desktop only ══ */}
                            <div className="hidden md:block w-[280px] shrink-0 sticky top-[72px]">
                                {/* Coupon */}
                                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 mb-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                                        <FaTag size={12} className="text-accent" /> Coupon / Promo Code
                                    </div>
                                    {coupon ? (
                                        <div className="mt-2.5 bg-green-50 border border-green-100 rounded-xl px-3.5 py-2.5 flex justify-between items-center">
                                            <div>
                                                <div className="text-xs font-semibold text-green-700">✅ {coupon.code} applied!</div>
                                                <div className="text-xs text-green-700 font-semibold">You save ₹{fmt(coupon.discount)}</div>
                                            </div>
                                            <button onClick={removeCoupon} aria-label="Remove coupon" className="text-red-500 text-base">✕</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex gap-2 mt-2.5">
                                                <input
                                                    className="flex-1 min-w-0 px-3 py-2 border border-neutral-200 rounded-xl text-[13px] outline-none focus:border-[var(--accent-primary)] transition-colors"
                                                    placeholder="Enter coupon code"
                                                    value={couponCode}
                                                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                                    onKeyDown={e => e.key === "Enter" && applyCoupon()}
                                                />
                                                <button
                                                    onClick={applyCoupon}
                                                    disabled={couponApplying || !couponCode.trim()}
                                                    className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-xs font-bold transition-colors"
                                                >
                                                    {couponApplying ? "..." : "Apply"}
                                                </button>
                                            </div>
                                            {couponErr && <p className="text-xs text-red-500 mt-2">⚠️ {couponErr}</p>}
                                        </>
                                    )}
                                </div>

                                {/* Price summary */}
                                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden mb-3">
                                    <div className="flex items-center justify-between px-4 py-3 bg-neutral-900">
                                        <span className="text-sm font-bold text-white">Order Summary</span>
                                        <span className="text-[11px] text-neutral-500">
                                            {checkoutItems.length} item{checkoutItems.length !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        {pricingLoading ? (
                                            <div className="flex flex-col gap-2">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="h-4 bg-neutral-100 rounded-lg animate-pulse" />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2.5">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-neutral-500">Items total</span>
                                                    <span className="font-semibold text-neutral-900">₹{fmt(pricing?.itemsTotal)}</span>
                                                </div>
                                                {pricing?.discount > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-neutral-500">Discount</span>
                                                        <span className="font-semibold text-green-600">−₹{fmt(pricing.discount)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-neutral-500">Delivery</span>
                                                    <span className={`font-semibold ${pricing?.deliveryCharge === 0 && paymentMethod !== "cod" ? "text-green-600" : "text-neutral-900"}`}>
                                                        {pricing?.deliveryCharge === 0 && paymentMethod !== "cod" ? "FREE" : `₹${fmt(pricing?.deliveryCharge)}`}
                                                    </span>
                                                </div>
                                                {pricing?.couponDiscount > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-neutral-500">Coupon</span>
                                                        <span className="font-semibold text-green-600">−₹{fmt(pricing.couponDiscount)}</span>
                                                    </div>
                                                )}
                                                <div className="h-px bg-neutral-100" />
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-sm font-bold text-neutral-900">Total</span>
                                                    <span className="text-[22px] font-bold text-neutral-900">
                                                        ₹{fmt(finalTotal)}
                                                    </span>
                                                </div>
                                                {pricing?.savedTotal > 0 && (
                                                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-100
                                                                    rounded-xl px-3 py-2 text-xs font-semibold text-green-700">
                                                        🎉 You save ₹{fmt(pricing.savedTotal)} on this order
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Trust badges */}
                                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3">
                                        Why Urbexon?
                                    </p>
                                    <div className="flex flex-col gap-2.5">
                                        {[
                                            { icon: <FaShieldAlt size={11} className="text-green-600" />, label: "Safe & Secure Payment", bg: "bg-green-50" },
                                            { icon: <FaTruck size={11} className="text-blue-600" />, label: "Delivery Across India", bg: "bg-blue-50" },
                                            { icon: <FaMoneyBillWave size={11} className="text-green-600" />, label: "Cash on Delivery (COD)", bg: "bg-green-50" },
                                            { icon: <FaTag size={11} className="text-[var(--accent-primary-hover)]" />, label: "Verified & Authentic", bg: "bg-accent-tint" },
                                        ].map(({ icon, label, bg }) => (
                                            <div key={label} className="flex items-center gap-2.5">
                                                <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                                                    {icon}
                                                </div>
                                                <span className="text-xs font-medium text-neutral-600">{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile fixed CTA */}
                <MobileCta />
            </div>
        </>
    );
};

export default Checkout;