/**
 * UHCheckout.jsx — Urbexon Hour Express Checkout
 * ─────────────────────────────────────────────────
 * • Standalone checkout (no MainLayout)
 * • 4-step accordion: Contact → Address → Order Summary → Payment
 * • Pricing from backend only (via useUHCheckout hook)
 * • deliveryType = URBEXON_HOUR
 * • COD + Razorpay
 * All state/handlers below come from useUHCheckout() — untouched business logic.
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    FiArrowLeft, FiZap, FiMapPin, FiCheckCircle,
    FiHome, FiBriefcase, FiChevronDown, FiChevronUp, FiShield,
} from "react-icons/fi";
import { useUHCheckout } from "../hooks/useUHCheckout";
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
                    active ? "bg-white text-[var(--color-graphite-900)]" : "bg-[var(--color-graphite-100)] text-accent"
                )}>{num}</span>
                {title}
                {done && <FiCheckCircle size={16} className="text-accent" aria-hidden="true" />}
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

    const ck = useUHCheckout(buyNowItem);
    const {
        step, setStep, error,
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

    if (!checkoutItems || checkoutItems.length === 0) {
        return (
            <div className="min-h-screen bg-canvas">
                <SEO title="Urbexon Hour Checkout" noindex />
                <EmptyState
                    icon={FiZap}
                    title="No items for checkout"
                    description="Add items from Urbexon Hour first"
                    action={<Button variant="primary" onClick={() => navigate("/urbexon-hour")}>Browse Urbexon Hour</Button>}
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
                        <button onClick={() => navigate("/uh-cart")} aria-label="Back to cart" className="text-white">
                            <FiArrowLeft size={16} aria-hidden="true" />
                        </button>
                        <div className="text-xl tracking-wide font-display">
                            <i>Urbexon</i><span className="text-accent ml-1">Hour</span>
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
                        <Button variant="primary" className="mt-5" onClick={handleContactContinue}>Continue</Button>
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
                                                    selectedAddrId === addr._id ? "bg-accent-tint border-[var(--accent-primary)]" : "border-default hover:bg-canvas"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-[18px] h-[18px] rounded-full flex-shrink-0 mt-0.5",
                                                    selectedAddrId === addr._id ? "border-[5px] border-[var(--accent-primary)]" : "border-2 border-[var(--color-graphite-300)]"
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
                                                        <Button variant="primary" size="sm" className="mt-3" onClick={handleAddressContinue}>Deliver Here</Button>
                                                    )}
                                                    <div className={cn("mt-2", selectedAddrId === addr._id && "mt-3")}>
                                                        <button onClick={(e) => { e.stopPropagation(); setEditingAddr(addr); setShowAddForm(true); }} className="text-accent text-xs font-semibold uppercase">
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
                                        className="flex items-center justify-center gap-2 p-4 bg-surface border border-default rounded-[var(--radius-md)] text-accent text-sm font-semibold w-full"
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
                                <Button variant="primary" onClick={() => setStep(4)}>Continue</Button>
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
                                <div className={cn("w-[18px] h-[18px] rounded-full flex-shrink-0 mt-0.5", paymentMethod === "online" ? "border-[5px] border-[var(--accent-primary)]" : "border-2 border-[var(--color-graphite-300)]")} />
                                <div className="flex-1 flex flex-col gap-1">
                                    <span className="text-[15px] text-primary">UPI, Wallets, Credit / Debit Card</span>
                                    <span className="text-xs text-secondary">Fast & Secure Payments</span>
                                    {paymentMethod === "online" && (
                                        <Button variant="primary" className="mt-4" onClick={handlePayOnline} loading={loading || payState === "processing"}>
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
                                <div className={cn("w-[18px] h-[18px] rounded-full flex-shrink-0 mt-0.5", paymentMethod === "cod" ? "border-[5px] border-[var(--accent-primary)]" : "border-2 border-[var(--color-graphite-300)]")} />
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
                                        <Button variant="primary" className="mt-4" onClick={handleCOD} loading={loading || payState === "processing"}>
                                            {loading || payState === "processing" ? "Processing..." : "Place Order"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </StepCard>
                </div>

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
    });
    const [formError, setFormError] = useState("");

    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = () => {
        if (!form.name.trim()) return setFormError("Name required");
        if (!/^[6-9]\d{9}$/.test(form.phone)) return setFormError("Valid phone required");
        if (!form.house.trim()) return setFormError("House/flat required");
        if (!form.area.trim()) return setFormError("Area/street required");
        if (!form.city.trim()) return setFormError("City required");
        if (!form.state.trim()) return setFormError("State required");
        if (!/^\d{6}$/.test(form.pincode)) return setFormError("Valid 6-digit pincode required");
        setFormError("");
        onSave(form);
    };

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-base font-medium text-primary">{initial ? "Edit Address" : "Add New Address"}</h3>
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
                                form.label === l ? "border-[var(--accent-primary)] text-accent" : "border-default text-primary"
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
                <Button variant="primary" className="flex-1" onClick={handleSubmit} loading={saving}>
                    {initial ? "Update" : "Save Address"}
                </Button>
            </div>
        </div>
    );
};

export default UHCheckout;
