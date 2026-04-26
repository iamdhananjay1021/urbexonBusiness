/**
 * UHCheckout.jsx — Urbexon Hour Express Checkout
 * ─────────────────────────────────────────────────
 * • Standalone checkout (no MainLayout)
 * • 3-step: Contact → Address → Payment
 * • Pricing from backend only
 * • deliveryType = URBEXON_HOUR
 * • COD + Razorpay
 */

import { useNavigate } from "react-router-dom";
import {
    FaArrowLeft, FaBolt, FaUser, FaMapMarkerAlt, FaCreditCard,
    FaCheckCircle, FaLock, FaMoneyBillWave, FaSpinner,
    FaPlus, FaEdit, FaTrash, FaHome, FaBriefcase, FaClock,
    FaChevronDown, FaChevronUp, FaShieldAlt,
} from "react-icons/fa";
import { useUHCheckout } from "../hooks/useUHCheckout";
import SEO from "../components/SEO";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const STEPS = [
    { id: 1, label: "Contact", icon: <FaUser size={11} /> },
    { id: 2, label: "Address", icon: <FaMapMarkerAlt size={11} /> },
    { id: 3, label: "Payment", icon: <FaCreditCard size={11} /> },
];

const LABEL_ICONS = { Home: <FaHome size={10} />, Work: <FaBriefcase size={10} />, Other: <FaMapMarkerAlt size={10} /> };

const UHCheckout = () => {
    const navigate = useNavigate();
    const ck = useUHCheckout();
    const {
        step, setStep, error, setError,
        contact, setContact,
        addresses, addrLoading, selectedAddrId, setSelectedAddrId, selectedAddress,
        showAddForm, setShowAddForm, editingAddr, setEditingAddr,
        savingAddr, deleteConfirmId, setDeleteConfirmId,
        paymentMethod, selectPaymentMethod, payState, loading,
        codStatus, codChecking, codAvailable,
        pricing, pricingLoading,
        mobileSummaryOpen, setMobileSummaryOpen,
        checkoutItems,
        handleContactContinue, handleAddressContinue,
        handleAddAddress, handleEditAddress, handleDeleteAddress, handleSetDefault,
        handleCOD, handlePayOnline,
    } = ck;

    const finalTotal = pricing?.finalTotal || 0;

    if (!checkoutItems || checkoutItems.length === 0) {
        return (
            <div className="uhck-root">
                <style>{CSS}</style>
                <div className="uhck-empty">
                    <FaBolt size={40} style={{ color: "#f59e0b" }} />
                    <h2>No items for checkout</h2>
                    <p>Add items from Urbexon Hour first</p>
                    <button className="uhck-btn-primary" onClick={() => navigate("/urbexon-hour")}>
                        Browse Urbexon Hour
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="uhck-root">
            <SEO title="Urbexon Hour Checkout" noindex />
            <style>{CSS}</style>

            {/* Header */}
            <header className="uhck-header">
                <button className="uhck-back" onClick={() => navigate("/uh-cart")}>
                    <FaArrowLeft size={14} />
                </button>
                <div className="uhck-header-brand">
                    <FaBolt size={12} className="uhck-bolt" />
                    <span>Urbexon Hour Checkout</span>
                </div>
                <div className="uhck-secure">
                    <FaLock size={10} /> Secure
                </div>
            </header>

            {/* Steps */}
            <div className="uhck-steps">
                {STEPS.map((s) => (
                    <div
                        key={s.id}
                        className={`uhck-step${step === s.id ? " active" : ""}${step > s.id ? " done" : ""}`}
                        onClick={() => step > s.id && setStep(s.id)}
                    >
                        <div className="uhck-step-circle">
                            {step > s.id ? <FaCheckCircle size={14} /> : s.icon}
                        </div>
                        <span className="uhck-step-label">{s.label}</span>
                    </div>
                ))}
            </div>

            <div className="uhck-layout">
                {/* Main content */}
                <div className="uhck-main">
                    {error && <div className="uhck-error">{error}</div>}

                    {/* STEP 1: Contact */}
                    {step === 1 && (
                        <div className="uhck-card">
                            <h2 className="uhck-card-title"><FaUser size={13} /> Contact Details</h2>
                            <div className="uhck-field">
                                <label>Full Name</label>
                                <input
                                    type="text" value={contact.name}
                                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                                    placeholder="Your full name"
                                    maxLength={100}
                                />
                            </div>
                            <div className="uhck-field">
                                <label>Phone Number</label>
                                <div className="uhck-phone-row">
                                    <span className="uhck-prefix">+91</span>
                                    <input
                                        type="tel" value={contact.phone}
                                        onChange={(e) => setContact({ ...contact, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                                        placeholder="10-digit mobile number"
                                        maxLength={10} inputMode="numeric"
                                    />
                                </div>
                            </div>
                            <div className="uhck-field">
                                <label>Email <span className="uhck-opt">(optional)</span></label>
                                <input
                                    type="email" value={contact.email}
                                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                                    placeholder="your@email.com"
                                />
                            </div>
                            <button className="uhck-btn-primary" onClick={handleContactContinue}>
                                Continue to Address
                            </button>
                        </div>
                    )}

                    {/* STEP 2: Address */}
                    {step === 2 && (
                        <div className="uhck-card">
                            <h2 className="uhck-card-title"><FaMapMarkerAlt size={13} /> Delivery Address</h2>
                            <div className="uhck-eta-banner">
                                <FaClock size={12} />
                                <span>Express delivery: <strong>45–120 mins</strong></span>
                            </div>

                            {addrLoading ? (
                                <div className="uhck-loading"><FaSpinner className="uhck-spin" /> Loading addresses…</div>
                            ) : (
                                <>
                                    {addresses.length > 0 && (
                                        <div className="uhck-addr-list">
                                            {addresses.map((addr) => (
                                                <div
                                                    key={addr._id}
                                                    className={`uhck-addr${selectedAddrId === addr._id ? " selected" : ""}`}
                                                    onClick={() => setSelectedAddrId(addr._id)}
                                                >
                                                    <div className="uhck-addr-radio">
                                                        <div className={`uhck-radio${selectedAddrId === addr._id ? " on" : ""}`} />
                                                    </div>
                                                    <div className="uhck-addr-body">
                                                        <div className="uhck-addr-top">
                                                            <span className="uhck-addr-label">
                                                                {LABEL_ICONS[addr.label] || LABEL_ICONS.Other} {addr.label}
                                                            </span>
                                                            {addr.isDefault && <span className="uhck-badge">Default</span>}
                                                        </div>
                                                        <div className="uhck-addr-name">{addr.name} · {addr.phone}</div>
                                                        <div className="uhck-addr-line">
                                                            {addr.house}, {addr.area}
                                                            {addr.landmark ? `, ${addr.landmark}` : ""}
                                                            , {addr.city}, {addr.state} - {addr.pincode}
                                                        </div>
                                                        <div className="uhck-addr-actions">
                                                            <button onClick={(e) => { e.stopPropagation(); setEditingAddr(addr); setShowAddForm(true); }}>
                                                                <FaEdit size={10} /> Edit
                                                            </button>
                                                            {!addr.isDefault && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleSetDefault(addr._id); }}>
                                                                    Set Default
                                                                </button>
                                                            )}
                                                            {deleteConfirmId === addr._id ? (
                                                                <button className="uhck-del-confirm" onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr._id); }}>
                                                                    Confirm Delete
                                                                </button>
                                                            ) : (
                                                                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(addr._id); }}>
                                                                    <FaTrash size={10} /> Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!showAddForm ? (
                                        <button className="uhck-add-addr" onClick={() => { setEditingAddr(null); setShowAddForm(true); }}>
                                            <FaPlus size={11} /> Add New Address
                                        </button>
                                    ) : (
                                        <AddressFormInline
                                            initial={editingAddr}
                                            saving={savingAddr}
                                            onSave={(form) => editingAddr ? handleEditAddress(form) : handleAddAddress(form)}
                                            onCancel={() => { setShowAddForm(false); setEditingAddr(null); }}
                                        />
                                    )}

                                    <button
                                        className="uhck-btn-primary"
                                        onClick={handleAddressContinue}
                                        disabled={!selectedAddress}
                                    >
                                        Continue to Payment
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Payment */}
                    {step === 3 && (
                        <div className="uhck-card">
                            <h2 className="uhck-card-title"><FaCreditCard size={13} /> Payment Method</h2>

                            {/* Delivery summary */}
                            <div className="uhck-delivery-info">
                                <div className="uhck-di-row">
                                    <FaMapMarkerAlt size={11} />
                                    <span>{selectedAddress?.name} · {selectedAddress?.house}, {selectedAddress?.city} - {selectedAddress?.pincode}</span>
                                    <button className="uhck-change" onClick={() => setStep(2)}>Change</button>
                                </div>
                                <div className="uhck-di-row">
                                    <FaClock size={11} />
                                    <span>Express: <strong>45–120 mins</strong></span>
                                </div>
                            </div>

                            {/* Payment options */}
                            <div className="uhck-pay-options">
                                <div
                                    className={`uhck-pay-opt${paymentMethod === "online" ? " active" : ""}`}
                                    onClick={() => selectPaymentMethod("online")}
                                >
                                    <div className={`uhck-radio${paymentMethod === "online" ? " on" : ""}`} />
                                    <FaCreditCard size={14} />
                                    <div>
                                        <div className="uhck-pay-title">Pay Online</div>
                                        <div className="uhck-pay-sub">UPI, Cards, Net Banking, Wallets</div>
                                    </div>
                                    <span className="uhck-recommended">Recommended</span>
                                </div>
                                {codChecking ? (
                                    <div className="uhck-pay-opt" style={{ opacity: 0.6 }}>
                                        <FaSpinner size={14} className="uhck-spin" />
                                        <div>
                                            <div className="uhck-pay-title">Checking COD…</div>
                                        </div>
                                    </div>
                                ) : codAvailable ? (
                                    <div
                                        className={`uhck-pay-opt${paymentMethod === "cod" ? " active" : ""}`}
                                        onClick={() => selectPaymentMethod("cod")}
                                    >
                                        <div className={`uhck-radio${paymentMethod === "cod" ? " on" : ""}`} />
                                        <FaMoneyBillWave size={14} />
                                        <div>
                                            <div className="uhck-pay-title">Cash on Delivery</div>
                                            <div className="uhck-pay-sub">Pay when your order arrives</div>
                                        </div>
                                    </div>
                                ) : codStatus === "coming_soon" ? (
                                    <div className="uhck-pay-opt" style={{ opacity: 0.5, cursor: "default" }}>
                                        <FaMoneyBillWave size={14} />
                                        <div>
                                            <div className="uhck-pay-title" style={{ color: "var(--muted, #78716c)" }}>Cash on Delivery</div>
                                            <div className="uhck-pay-sub">Coming soon to your area</div>
                                        </div>
                                    </div>
                                ) : codStatus ? (
                                    <div className="uhck-pay-opt" style={{ opacity: 0.5, cursor: "default" }}>
                                        <FaMoneyBillWave size={14} />
                                        <div>
                                            <div className="uhck-pay-title" style={{ color: "var(--muted, #78716c)" }}>Cash on Delivery</div>
                                            <div className="uhck-pay-sub">Not available for your pincode</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={`uhck-pay-opt${paymentMethod === "cod" ? " active" : ""}`}
                                        onClick={() => selectPaymentMethod("cod")}
                                    >
                                        <div className={`uhck-radio${paymentMethod === "cod" ? " on" : ""}`} />
                                        <FaMoneyBillWave size={14} />
                                        <div>
                                            <div className="uhck-pay-title">Cash on Delivery</div>
                                            <div className="uhck-pay-sub">Pay when your order arrives</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pricing */}
                            {pricingLoading ? (
                                <div className="uhck-loading"><FaSpinner className="uhck-spin" /> Calculating…</div>
                            ) : pricing && (
                                <div className="uhck-pricing">
                                    <div className="uhck-pr-row"><span>Items Total</span><span>{fmt(pricing.itemsTotal)}</span></div>
                                    <div className="uhck-pr-row">
                                        <span>Delivery</span>
                                        <span className={pricing.deliveryCharge === 0 ? "uhck-free" : ""}>
                                            {pricing.deliveryCharge === 0 ? "FREE" : fmt(pricing.deliveryCharge)}
                                        </span>
                                    </div>
                                    <div className="uhck-pr-row"><span>Platform Fee</span><span>{fmt(pricing.platformFee)}</span></div>
                                    {pricing.couponDiscount > 0 && (
                                        <div className="uhck-pr-row uhck-discount">
                                            <span>Coupon Discount</span><span>-{fmt(pricing.couponDiscount)}</span>
                                        </div>
                                    )}
                                    <div className="uhck-pr-divider" />
                                    <div className="uhck-pr-row uhck-pr-total">
                                        <span>Total</span><span>{fmt(pricing.finalTotal)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Place order */}
                            {paymentMethod && (
                                <button
                                    className="uhck-btn-primary"
                                    onClick={paymentMethod === "cod" ? handleCOD : handlePayOnline}
                                    disabled={loading || payState === "processing"}
                                >
                                    {loading || payState === "processing" ? (
                                        <><FaSpinner className="uhck-spin" /> Processing…</>
                                    ) : (
                                        `Place Order — ${fmt(finalTotal)}`
                                    )}
                                </button>
                            )}

                            {payState === "failed" && (
                                <div className="uhck-error" style={{ marginTop: 10 }}>
                                    Payment failed. Please try again.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar: Order Summary */}
                <div className="uhck-sidebar">
                    <div className="uhck-side-card">
                        <div className="uhck-side-title">
                            <FaBolt size={12} className="uhck-bolt" /> Order Summary
                        </div>
                        {checkoutItems.map((item) => (
                            <div key={item._id} className="uhck-side-item">
                                <img
                                    src={item.images?.[0]?.url || item.image?.url || item.image || "/placeholder.png"}
                                    alt={item.name} className="uhck-side-img"
                                    loading="lazy"
                                    onError={(e) => { e.target.src = "/placeholder.png"; }}
                                />
                                <div className="uhck-side-item-info">
                                    <div className="uhck-side-item-name">{item.name}</div>
                                    <div className="uhck-side-item-qty">Qty: {item.quantity}</div>
                                </div>
                                <div className="uhck-side-item-price">{fmt(item.price * item.quantity)}</div>
                            </div>
                        ))}
                        <div className="uhck-side-total">
                            <span>Total</span>
                            <span>{fmt(finalTotal)}</span>
                        </div>
                        <div className="uhck-side-eta">
                            <FaClock size={11} /> 45–120 min delivery
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile order summary toggle */}
            <div className="uhck-mobile-sum-toggle" onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}>
                <span>{checkoutItems.length} item{checkoutItems.length > 1 ? "s" : ""} · {fmt(finalTotal)}</span>
                {mobileSummaryOpen ? <FaChevronDown size={12} /> : <FaChevronUp size={12} />}
            </div>
            {mobileSummaryOpen && (
                <div className="uhck-mobile-summary">
                    {checkoutItems.map((item) => (
                        <div key={item._id} className="uhck-side-item">
                            <img
                                src={item.images?.[0]?.url || item.image || "/placeholder.png"}
                                alt={item.name} className="uhck-side-img"
                                loading="lazy"
                                onError={(e) => { e.target.src = "/placeholder.png"; }}
                            />
                            <div className="uhck-side-item-info">
                                <div className="uhck-side-item-name">{item.name}</div>
                                <div className="uhck-side-item-qty">Qty: {item.quantity} · {fmt(item.price * item.quantity)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
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
        <div className="uhck-addr-form">
            <h3>{initial ? "Edit Address" : "Add New Address"}</h3>
            {formError && <div className="uhck-error">{formError}</div>}
            <div className="uhck-addr-labels">
                {["Home", "Work", "Other"].map((l) => (
                    <button key={l} className={`uhck-label-chip${form.label === l ? " active" : ""}`} onClick={() => update("label", l)}>
                        {LABEL_ICONS[l]} {l}
                    </button>
                ))}
            </div>
            <div className="uhck-form-grid">
                <div className="uhck-field"><label>Name</label><input value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={100} /></div>
                <div className="uhck-field"><label>Phone</label><input value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} inputMode="numeric" /></div>
                <div className="uhck-field full"><label>House / Flat / Building</label><input value={form.house} onChange={(e) => update("house", e.target.value)} maxLength={200} /></div>
                <div className="uhck-field full"><label>Area / Street / Colony</label><input value={form.area} onChange={(e) => update("area", e.target.value)} maxLength={200} /></div>
                <div className="uhck-field"><label>Landmark</label><input value={form.landmark} onChange={(e) => update("landmark", e.target.value)} maxLength={100} placeholder="Optional" /></div>
                <div className="uhck-field"><label>City</label><input value={form.city} onChange={(e) => update("city", e.target.value)} maxLength={100} /></div>
                <div className="uhck-field"><label>State</label><input value={form.state} onChange={(e) => update("state", e.target.value)} maxLength={100} /></div>
                <div className="uhck-field"><label>Pincode</label><input value={form.pincode} onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} inputMode="numeric" /></div>
            </div>
            <div className="uhck-form-btns">
                <button className="uhck-btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="uhck-btn-primary" onClick={handleSubmit} disabled={saving}>
                    {saving ? <><FaSpinner className="uhck-spin" /> Saving…</> : (initial ? "Update" : "Save Address")}
                </button>
            </div>
        </div>
    );
};

/* ── CSS ─────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.uhck-root{min-height:100vh;background:#f1f5f9;font-family:'DM Sans',sans-serif}

.uhck-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;text-align:center;gap:10px}
.uhck-empty h2{font-size:20px;font-weight:700;color:#1e293b}
.uhck-empty p{font-size:14px;color:#64748b}

.uhck-header{display:flex;align-items:center;gap:12px;background:#1a1740;color:#fff;padding:14px clamp(16px,3vw,40px)}
.uhck-back{background:none;border:none;color:#fff;cursor:pointer;padding:6px}
.uhck-header-brand{flex:1;font-size:15px;font-weight:800;display:flex;align-items:center;gap:6px}
.uhck-bolt{color:#f59e0b}
.uhck-secure{display:flex;align-items:center;gap:4px;font-size:11px;color:rgba(255,255,255,.6)}

.uhck-steps{display:flex;justify-content:center;gap:0;background:#fff;padding:14px 24px;border-bottom:1px solid #e8e4d9}
.uhck-step{display:flex;align-items:center;gap:6px;padding:6px 16px;cursor:default;opacity:.4;transition:opacity .15s}
.uhck-step.active,.uhck-step.done{opacity:1;cursor:pointer}
.uhck-step-circle{width:28px;height:28px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px}
.uhck-step.active .uhck-step-circle{background:#1a1740;color:#fff}
.uhck-step.done .uhck-step-circle{background:#059669;color:#fff}
.uhck-step-label{font-size:12px;font-weight:600;color:#1e293b}
@media(max-width:480px){.uhck-step-label{display:none}}

.uhck-layout{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 340px;gap:16px;padding:16px clamp(16px,3vw,40px)}
@media(max-width:768px){.uhck-layout{grid-template-columns:1fr}.uhck-sidebar{display:none}}

.uhck-main{display:flex;flex-direction:column;gap:12px}
.uhck-card{background:#fff;border:1px solid #e8e4d9;border-radius:10px;padding:20px}
.uhck-card-title{font-size:15px;font-weight:800;color:#1e293b;display:flex;align-items:center;gap:8px;margin-bottom:16px}

.uhck-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.uhck-field label{font-size:12px;font-weight:600;color:#475569}
.uhck-field input{padding:11px 12px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:14px;color:#1e293b;outline:none;font-family:'DM Sans',sans-serif;transition:border-color .15s}
.uhck-field input:focus{border-color:#1a1740}
.uhck-opt{font-weight:400;color:#94a3b8}
.uhck-phone-row{display:flex;gap:0}
.uhck-prefix{display:flex;align-items:center;padding:11px 10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-right:none;border-radius:7px 0 0 7px;font-size:13px;font-weight:600;color:#64748b}
.uhck-phone-row input{border-radius:0 7px 7px 0;flex:1}

.uhck-error{background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 12px;font-size:12px;color:#dc2626;font-weight:500;margin-bottom:10px}

.uhck-btn-primary{width:100%;padding:14px;background:#1a1740;color:#fff;border:none;border-radius:8px;font-weight:800;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px}
.uhck-btn-primary:hover{background:#252060}
.uhck-btn-primary:disabled{opacity:.5;cursor:not-allowed}
.uhck-btn-secondary{padding:10px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;font-size:13px;font-weight:600;color:#475569;cursor:pointer;font-family:'DM Sans',sans-serif}

.uhck-loading{display:flex;align-items:center;gap:8px;padding:20px;justify-content:center;font-size:13px;color:#64748b}
.uhck-spin{animation:uhck-sp .7s linear infinite}
@keyframes uhck-sp{to{transform:rotate(360deg)}}

.uhck-eta-banner{display:flex;align-items:center;gap:6px;background:#ecfdf5;border-radius:6px;padding:8px 10px;margin-bottom:14px;font-size:12px;color:#065f46}

.uhck-addr-list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.uhck-addr{display:flex;gap:12px;padding:12px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:border-color .15s}
.uhck-addr.selected{border-color:#1a1740;background:#faf9ff}
.uhck-addr-radio{padding-top:2px}
.uhck-radio{width:18px;height:18px;border-radius:50%;border:2px solid #d1d5db;transition:all .15s}
.uhck-radio.on{border-color:#1a1740;border-width:5px}
.uhck-addr-body{flex:1;min-width:0}
.uhck-addr-top{display:flex;align-items:center;gap:6px;margin-bottom:3px}
.uhck-addr-label{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#1a1740;text-transform:uppercase;letter-spacing:.3px}
.uhck-badge{font-size:9px;background:#ecfdf5;color:#059669;padding:2px 6px;border-radius:4px;font-weight:700}
.uhck-addr-name{font-size:13px;font-weight:600;color:#1e293b;margin-bottom:2px}
.uhck-addr-line{font-size:12px;color:#64748b;line-height:1.4}
.uhck-addr-actions{display:flex;gap:10px;margin-top:6px}
.uhck-addr-actions button{background:none;border:none;font-size:11px;color:#64748b;cursor:pointer;display:flex;align-items:center;gap:3px;font-family:'DM Sans',sans-serif;font-weight:600;padding:0}
.uhck-addr-actions button:hover{color:#1a1740}
.uhck-del-confirm{color:#ef4444!important}

.uhck-add-addr{display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border:1.5px dashed #c9a84c;border-radius:8px;background:none;color:#1a1740;font-weight:700;font-size:13px;cursor:pointer;width:100%;font-family:'DM Sans',sans-serif;margin-bottom:12px}

.uhck-addr-form{padding:14px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px}
.uhck-addr-form h3{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:10px}
.uhck-addr-labels{display:flex;gap:6px;margin-bottom:12px}
.uhck-label-chip{display:flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;color:#475569}
.uhck-label-chip.active{background:#1a1740;color:#fff;border-color:#1a1740}
.uhck-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.uhck-form-grid .full{grid-column:1/-1}
@media(max-width:480px){.uhck-form-grid{grid-template-columns:1fr}}
.uhck-form-btns{display:flex;gap:8px;margin-top:12px;justify-content:flex-end}

.uhck-delivery-info{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px}
.uhck-di-row{display:flex;align-items:center;gap:8px;font-size:12px;color:#475569;margin-bottom:4px}
.uhck-di-row:last-child{margin-bottom:0}
.uhck-change{background:none;border:none;color:#2563eb;font-size:11px;font-weight:700;cursor:pointer;margin-left:auto;font-family:'DM Sans',sans-serif}

.uhck-pay-options{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.uhck-pay-opt{display:flex;align-items:center;gap:10px;padding:14px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:border-color .15s}
.uhck-pay-opt.active{border-color:#1a1740;background:#faf9ff}
.uhck-pay-title{font-size:13px;font-weight:700;color:#1e293b}
.uhck-pay-sub{font-size:11px;color:#64748b}
.uhck-recommended{margin-left:auto;font-size:10px;background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:10px;font-weight:700}

.uhck-pricing{margin-bottom:12px}
.uhck-pr-row{display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:6px}
.uhck-free{color:#16a34a;font-weight:700}
.uhck-discount{color:#16a34a}
.uhck-pr-divider{border-top:1px dashed #e8e4d9;margin:8px 0}
.uhck-pr-total{font-size:15px;font-weight:800;color:#1e293b}

.uhck-sidebar{}
.uhck-side-card{background:#fff;border:1px solid #e8e4d9;border-radius:10px;padding:16px;position:sticky;top:16px}
.uhck-side-title{font-size:14px;font-weight:800;color:#1e293b;display:flex;align-items:center;gap:6px;margin-bottom:12px}
.uhck-side-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9}
.uhck-side-item:last-of-type{border-bottom:none}
.uhck-side-img{width:48px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0}
.uhck-side-item-info{flex:1;min-width:0}
.uhck-side-item-name{font-size:12px;font-weight:600;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.uhck-side-item-qty{font-size:11px;color:#64748b}
.uhck-side-item-price{font-size:13px;font-weight:700;color:#1e293b;flex-shrink:0}
.uhck-side-total{display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:#1e293b;padding-top:10px;border-top:1px dashed #e8e4d9;margin-top:8px}
.uhck-side-eta{display:flex;align-items:center;gap:6px;background:#ecfdf5;border-radius:6px;padding:7px 10px;margin-top:10px;font-size:11px;color:#065f46;font-weight:600}

.uhck-mobile-sum-toggle{display:none;position:fixed;bottom:0;left:0;right:0;background:#1a1740;color:#fff;padding:12px 16px;z-index:50;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;cursor:pointer}
@media(max-width:768px){.uhck-mobile-sum-toggle{display:flex}}
.uhck-mobile-summary{position:fixed;bottom:44px;left:0;right:0;background:#fff;border-top:1px solid #e8e4d9;padding:12px 16px;z-index:49;max-height:40vh;overflow-y:auto;box-shadow:0 -4px 16px rgba(0,0,0,.1)}
`;

export default UHCheckout;
