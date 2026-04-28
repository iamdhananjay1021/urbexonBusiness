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
                <div className="uhck-header-inner">
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <button className="uhck-back" onClick={() => navigate("/uh-cart")}>
                            <FaArrowLeft size={16} />
                        </button>
                        <div className="uhck-header-brand">
                            <i>Urbexon</i><span style={{ color: "#ffe500", marginLeft: 4 }}>Hour</span>
                        </div>
                    </div>
                    <div className="uhck-secure">
                        <FaShieldAlt size={14} /> 100% SECURE
                    </div>
                </div>
            </header>

            <div className="uhck-layout">
                {/* Main content */}
                <div className="uhck-main">
                    {error && <div className="uhck-error">{error}</div>}

                    {/* STEP 1: CONTACT DETAILS */}
                    <div className={`uhck-acc-card ${step === 1 ? "active" : ""}`}>
                        <div className="uhck-acc-head">
                            <div className="uhck-acc-title">
                                <span className="uhck-acc-num">1</span>
                                CONTACT DETAILS
                                {step > 1 && <FaCheckCircle size={16} className="uhck-acc-check" />}
                            </div>
                            {step > 1 && (
                                <button className="uhck-acc-change" onClick={() => setStep(1)}>CHANGE</button>
                            )}
                        </div>
                        {step > 1 && (
                            <div className="uhck-acc-summary">
                                <span style={{ fontWeight: 600, marginRight: 8 }}>{contact.name}</span>
                                +91 {contact.phone}
                            </div>
                        )}
                        {step === 1 && (
                            <div className="uhck-acc-body">
                                <div className="uhck-field-row">
                                    <div className="uhck-field">
                                        <input type="text" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Full Name" />
                                    </div>
                                    <div className="uhck-field">
                                        <input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile number" maxLength={10} inputMode="numeric" />
                                    </div>
                                </div>
                                <div className="uhck-field" style={{ maxWidth: 300, marginTop: 16 }}>
                                    <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email (Optional)" />
                                </div>
                                <button className="uhck-btn-primary" style={{ marginTop: 24 }} onClick={handleContactContinue}>CONTINUE</button>
                            </div>
                        )}
                    </div>

                    {/* STEP 2: DELIVERY ADDRESS */}
                    <div className={`uhck-acc-card ${step === 2 ? "active" : ""}`}>
                        <div className="uhck-acc-head">
                            <div className="uhck-acc-title">
                                <span className="uhck-acc-num">2</span>
                                DELIVERY ADDRESS
                                {step > 2 && <FaCheckCircle size={16} className="uhck-acc-check" />}
                            </div>
                            {step > 2 && (
                                <button className="uhck-acc-change" onClick={() => setStep(2)}>CHANGE</button>
                            )}
                        </div>
                        {step > 2 && selectedAddress && (
                            <div className="uhck-acc-summary">
                                <span style={{ fontWeight: 600, marginRight: 8 }}>{selectedAddress.name}</span>
                                {selectedAddress.house}, {selectedAddress.area}, {selectedAddress.city} - <span style={{ fontWeight: 600 }}>{selectedAddress.pincode}</span>
                            </div>
                        )}
                        {step === 2 && (
                            <div className="uhck-acc-body" style={{ background: "#f5faff" }}>
                                {addrLoading ? (
                                    <div className="uhck-loading"><FaSpinner className="uhck-spin" /> Loading addresses…</div>
                                ) : (
                                    <>
                                        {addresses.length > 0 && (
                                            <div className="uhck-addr-list">
                                                {addresses.map((addr) => (
                                                    <div key={addr._id} className={`uhck-addr ${selectedAddrId === addr._id ? "selected" : ""}`} onClick={() => setSelectedAddrId(addr._id)}>
                                                        <div className={`uhck-radio ${selectedAddrId === addr._id ? "on" : ""}`} />
                                                        <div className="uhck-addr-body">
                                                            <div className="uhck-addr-top">
                                                                <span className="uhck-addr-label">{addr.label}</span>
                                                                <span className="uhck-addr-name" style={{ fontWeight: 600, marginLeft: 8 }}>{addr.name}</span>
                                                                <span className="uhck-addr-phone" style={{ fontWeight: 600, marginLeft: 8 }}>{addr.phone}</span>
                                                            </div>
                                                            <div className="uhck-addr-line">{addr.house}, {addr.area}{addr.landmark ? `, ${addr.landmark}` : ""}, {addr.city}, {addr.state} - <span style={{ fontWeight: 600 }}>{addr.pincode}</span></div>

                                                            {selectedAddrId === addr._id && (
                                                                <button className="uhck-btn-primary" style={{ marginTop: 16 }} onClick={handleAddressContinue}>DELIVER HERE</button>
                                                            )}

                                                            <div className="uhck-addr-actions" style={{ marginTop: selectedAddrId === addr._id ? 16 : 8 }}>
                                                                <button onClick={(e) => { e.stopPropagation(); setEditingAddr(addr); setShowAddForm(true); }}>EDIT</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {!showAddForm ? (
                                            <button className="uhck-add-addr" onClick={() => { setEditingAddr(null); setShowAddForm(true); }}>
                                                <FaPlus size={11} style={{ marginRight: 6 }} /> Add a new address
                                            </button>
                                        ) : (
                                            <div style={{ background: "#fff", padding: 16, border: "1px solid #e0e0e0", marginTop: 16 }}>
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
                            </div>
                        )}
                    </div>

                    {/* STEP 3: ORDER SUMMARY */}
                    <div className={`uhck-acc-card ${step === 3 ? "active" : ""}`}>
                        <div className="uhck-acc-head">
                            <div className="uhck-acc-title">
                                <span className="uhck-acc-num">3</span>
                                ORDER SUMMARY
                                {step > 3 && <FaCheckCircle size={16} className="uhck-acc-check" />}
                            </div>
                            {step > 3 && (
                                <button className="uhck-acc-change" onClick={() => setStep(3)}>CHANGE</button>
                            )}
                        </div>
                        {step > 3 && (
                            <div className="uhck-acc-summary">
                                <b>{checkoutItems.length} Item{checkoutItems.length > 1 ? "s" : ""}</b>
                            </div>
                        )}
                        {step === 3 && (
                            <div className="uhck-acc-body" style={{ padding: 0 }}>
                                {checkoutItems.map((item) => (
                                    <div key={item._id} className="uhck-sum-item">
                                        <div className="uhck-sum-img-wrap">
                                            <img src={item.images?.[0]?.url || item.image?.url || item.image || "/placeholder.png"} alt={item.name} loading="lazy" />
                                        </div>
                                        <div className="uhck-sum-details">
                                            <div className="uhck-sum-name">{item.name}</div>
                                            <div className="uhck-sum-qty">Qty: {item.quantity}</div>
                                            <div className="uhck-sum-price-row">
                                                <span className="uhck-sum-price">{fmt(item.price * item.quantity)}</span>
                                                {item.mrp > item.price && <span className="uhck-sum-mrp">{fmt(item.mrp * item.quantity)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ padding: "16px 24px", background: "#f5faff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                    <span style={{ fontSize: 13, color: "#212121" }}>Order confirmation email will be sent to <b>{contact.email || "your email"}</b></span>
                                    <button className="uhck-btn-primary" onClick={() => setStep(4)}>CONTINUE</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* STEP 4: PAYMENT OPTIONS */}
                    <div className={`uhck-acc-card ${step === 4 ? "active" : ""}`}>
                        <div className="uhck-acc-head">
                            <div className="uhck-acc-title">
                                <span className="uhck-acc-num">4</span>
                                PAYMENT OPTIONS
                            </div>
                        </div>
                        {step === 4 && (
                            <div className="uhck-acc-body" style={{ padding: 0 }}>
                                <div className="uhck-pay-options">
                                    {/* Online */}
                                    <div className={`uhck-pay-row ${paymentMethod === "online" ? "active" : ""}`} onClick={() => selectPaymentMethod("online")}>
                                        <div className={`uhck-radio ${paymentMethod === "online" ? "on" : ""}`} />
                                        <div className="uhck-pay-info">
                                            <span className="uhck-pay-title">UPI, Wallets, Credit / Debit Card</span>
                                            <span className="uhck-pay-sub">Fast & Secure Payments</span>
                                        </div>
                                        {paymentMethod === "online" && (
                                            <div className="uhck-pay-action">
                                                <button className="uhck-btn-primary" onClick={handlePayOnline} disabled={loading || payState === "processing"}>
                                                    {loading || payState === "processing" ? "Processing..." : `PAY ${fmt(finalTotal)}`}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* COD */}
                                    <div className={`uhck-pay-row ${paymentMethod === "cod" ? "active" : ""} ${!codAvailable && !codChecking ? "disabled" : ""}`} onClick={() => codAvailable && selectPaymentMethod("cod")}>
                                        <div className={`uhck-radio ${paymentMethod === "cod" ? "on" : ""}`} />
                                        <div className="uhck-pay-info">
                                            <span className="uhck-pay-title">Cash on Delivery</span>
                                            {codChecking ? (
                                                <span className="uhck-pay-sub">Checking availability...</span>
                                            ) : codAvailable ? (
                                                <span className="uhck-pay-sub">Pay at your doorstep</span>
                                            ) : (
                                                <span className="uhck-pay-sub" style={{ color: "#ff6161" }}>Not available for this location</span>
                                            )}
                                        </div>
                                        {paymentMethod === "cod" && codAvailable && (
                                            <div className="uhck-pay-action">
                                                <button className="uhck-btn-primary" onClick={handleCOD} disabled={loading || payState === "processing"}>
                                                    {loading || payState === "processing" ? "Processing..." : `PLACE ORDER`}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Order Summary */}
                <div className="uhck-sidebar">
                    <div className="uhck-price-card">
                        <div className="uhck-price-title">PRICE DETAILS</div>
                        {pricingLoading ? (
                            <div className="uhck-loading" style={{ padding: 24 }}><FaSpinner className="uhck-spin" /> Calculating…</div>
                        ) : pricing ? (
                            <div className="uhck-price-body">
                                <div className="uhck-price-row">
                                    <span>Price ({checkoutItems.length} item{checkoutItems.length > 1 ? "s" : ""})</span>
                                    <span>{fmt(pricing.itemsTotal)}</span>
                                </div>
                                <div className="uhck-price-row">
                                    <span>Delivery Charges</span>
                                    <span style={{ color: pricing.deliveryCharge === 0 ? "#388e3c" : "#212121" }}>
                                        {pricing.deliveryCharge === 0 ? "FREE" : fmt(pricing.deliveryCharge)}
                                    </span>
                                </div>
                                <div className="uhck-price-row">
                                    <span>Platform Fee</span>
                                    <span>{fmt(pricing.platformFee)}</span>
                                </div>
                                {pricing.couponDiscount > 0 && (
                                    <div className="uhck-price-row" style={{ color: "#388e3c" }}>
                                        <span>Coupon Discount</span>
                                        <span>−{fmt(pricing.couponDiscount)}</span>
                                    </div>
                                )}
                                <div className="uhck-price-total">
                                    <span>Amount Payable</span>
                                    <span>{fmt(pricing.finalTotal)}</span>
                                </div>
                                {pricing.couponDiscount > 0 && (
                                    <div style={{ color: "#388e3c", fontSize: 13, fontWeight: 600, marginTop: 12 }}>
                                        Your Total Savings on this order {fmt(pricing.couponDiscount)}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, justifyContent: "center", color: "#878787", fontSize: 12, fontWeight: 600 }}>
                        <FaShieldAlt size={16} /> Safe and Secure Payments
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
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.uhck-root{min-height:100vh;background:#f1f3f6;font-family:'Roboto',sans-serif;padding-bottom:60px}

.uhck-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;text-align:center;gap:10px;font-family:'Roboto',sans-serif}
.uhck-empty h2{font-size:20px;font-weight:700;color:#212121}
.uhck-empty p{font-size:14px;color:#878787}
.uhck-btn-primary{background:#fb641b;color:#fff;border:none;padding:14px 32px;font-size:14px;font-weight:500;border-radius:2px;cursor:pointer;box-shadow:0 1px 2px 0 rgba(0,0,0,0.2);text-transform:uppercase;font-family:inherit}
.uhck-btn-primary:disabled{opacity:0.6;cursor:not-allowed}

.uhck-header{background:#2874f0;color:#fff;height:60px;display:flex;align-items:center;}
.uhck-header-inner{max-width:1100px;margin:0 auto;width:100%;padding:0 16px;display:flex;justify-content:space-between;align-items:center}
.uhck-back{background:none;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.uhck-header-brand{font-size:20px;letter-spacing:0.5px}
.uhck-secure{font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px;letter-spacing:0.5px}

.uhck-layout{max-width:1000px;margin:24px auto;display:grid;grid-template-columns:1fr 300px;gap:16px;padding:0 16px;align-items:start}
@media(max-width:860px){.uhck-layout{grid-template-columns:1fr;gap:12px}}

.uhck-main{display:flex;flex-direction:column;gap:16px}
.uhck-acc-card{background:#fff;border-radius:2px;box-shadow:0 1px 2px 0 rgba(0,0,0,0.2)}
.uhck-acc-head{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;background:#fff}
.uhck-acc-card.active .uhck-acc-head{background:#2874f0;color:#fff}
.uhck-acc-title{display:flex;align-items:center;gap:16px;font-size:16px;font-weight:500;color:#878787}
.uhck-acc-card.active .uhck-acc-title{color:#fff;font-weight:500}
.uhck-acc-num{width:24px;height:24px;background:#f0f0f0;color:#2874f0;display:flex;align-items:center;justify-content:center;border-radius:2px;font-size:13px;font-weight:500}
.uhck-acc-card.active .uhck-acc-num{background:#fff;color:#2874f0}
.uhck-acc-check{color:#2874f0;margin-left:8px}
.uhck-acc-change{background:#fff;color:#2874f0;border:1px solid #e0e0e0;padding:6px 16px;border-radius:2px;font-size:13px;font-weight:500;cursor:pointer;text-transform:uppercase}

.uhck-acc-summary{padding:0 24px 16px 64px;font-size:14px;color:#212121}
.uhck-acc-body{padding:16px 24px 24px 64px}
@media(max-width:600px){
    .uhck-acc-head{padding:14px 16px}
    .uhck-acc-summary{padding:0 16px 16px 56px}
    .uhck-acc-body{padding:16px 16px 24px 16px}
}

.uhck-field-row{display:flex;gap:16px;flex-wrap:wrap}
.uhck-field{flex:1;min-width:240px}
.uhck-field input{width:100%;padding:12px 16px;border:1px solid #e0e0e0;border-radius:2px;font-size:14px;outline:none;font-family:inherit;transition:border-color .2s}
.uhck-field input:focus{border-color:#2874f0}

.uhck-addr-list{display:flex;flex-direction:column;gap:12px}
.uhck-addr{display:flex;gap:16px;padding:16px;border:1px solid #e0e0e0;border-radius:2px;background:#fff;cursor:pointer;transition:background .2s}
.uhck-addr:hover{background:#f5faff}
.uhck-addr.selected{background:#f5faff}
.uhck-radio{width:18px;height:18px;border-radius:50%;border:2px solid #ccc;margin-top:2px;flex-shrink:0}
.uhck-radio.on{border:5px solid #2874f0}
.uhck-addr-body{flex:1}
.uhck-addr-top{margin-bottom:6px;font-size:14px;color:#212121}
.uhck-addr-label{background:#f0f0f0;color:#878787;font-size:10px;font-weight:500;padding:2px 6px;border-radius:2px;text-transform:uppercase}
.uhck-addr-line{font-size:14px;color:#212121;line-height:1.5}
.uhck-addr-actions button{background:none;border:none;color:#2874f0;font-size:13px;font-weight:500;cursor:pointer;text-transform:uppercase;font-family:inherit}

.uhck-add-addr{display:flex;align-items:center;gap:12px;padding:16px;background:#fff;border:1px solid #e0e0e0;color:#2874f0;font-size:14px;font-weight:500;cursor:pointer;border-radius:2px;width:100%;font-family:inherit}

.uhck-sum-item{display:flex;gap:16px;padding:24px;border-bottom:1px solid #f0f0f0}
.uhck-sum-img-wrap{width:80px;height:80px;flex-shrink:0;text-align:center}
.uhck-sum-img-wrap img{max-width:100%;max-height:100%;object-fit:contain}
.uhck-sum-details{flex:1}
.uhck-sum-name{font-size:14px;color:#212121;margin-bottom:8px;line-height:1.4}
.uhck-sum-qty{font-size:12px;color:#878787;margin-bottom:12px}
.uhck-sum-price-row{display:flex;align-items:center;gap:8px}
.uhck-sum-price{font-size:16px;font-weight:500;color:#212121}
.uhck-sum-mrp{font-size:14px;color:#878787;text-decoration:line-through}

.uhck-pay-options{display:flex;flex-direction:column}
.uhck-pay-row{display:flex;align-items:flex-start;gap:16px;padding:16px 24px;border-bottom:1px solid #f0f0f0;cursor:pointer}
.uhck-pay-row.disabled{opacity:0.5;cursor:not-allowed}
.uhck-pay-info{flex:1;display:flex;flex-direction:column;gap:4px}
.uhck-pay-title{font-size:15px;color:#212121}
.uhck-pay-sub{font-size:12px;color:#878787}
.uhck-pay-action{width:100%;margin-top:16px}

.uhck-sidebar{}
.uhck-price-card{background:#fff;border-radius:2px;box-shadow:0 1px 2px 0 rgba(0,0,0,0.2);position:sticky;top:16px}
.uhck-price-title{padding:14px 24px;border-bottom:1px solid #f0f0f0;font-size:16px;font-weight:500;color:#878787;text-transform:uppercase}
.uhck-price-body{padding:24px}
.uhck-price-row{display:flex;justify-content:space-between;font-size:15px;color:#212121;margin-bottom:16px}
.uhck-price-total{display:flex;justify-content:space-between;font-size:18px;font-weight:500;color:#212121;padding-top:16px;border-top:1px dashed #e0e0e0;margin-top:8px}

.uhck-error{background:#ffebe8;color:#ff6161;padding:12px 24px;font-size:14px;border-radius:2px;margin-bottom:16px}
.uhck-loading{display:flex;align-items:center;gap:10px;font-size:14px;color:#878787}
.uhck-spin{animation:uhck-sp .8s linear infinite}
@keyframes uhck-sp{to{transform:rotate(360deg)}}

.uhck-mobile-sum-toggle{display:none;position:fixed;bottom:0;left:0;right:0;background:#1a1740;color:#fff;padding:12px 16px;z-index:50;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;cursor:pointer}
@media(max-width:768px){.uhck-mobile-sum-toggle{display:flex}}
.uhck-mobile-summary{position:fixed;bottom:44px;left:0;right:0;background:#fff;border-top:1px solid #e8e4d9;padding:12px 16px;z-index:49;max-height:40vh;overflow-y:auto;box-shadow:0 -4px 16px rgba(0,0,0,.1)}
`;

export default UHCheckout;
