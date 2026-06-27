/**
 * UHCheckout.jsx — Urbexon Hour Express Checkout
 * ─────────────────────────────────────────────────
 * • Standalone checkout (no MainLayout)
 * • 3-step: Contact → Address → Payment
 * • Pricing from backend only
 * • deliveryType = URBEXON_HOUR
 * • COD + Razorpay
 */

import { useState } from "react";
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
                                {checkoutItems.map((item, idx) => {
                                    const uniqueId = item.cartItemId || `${item._id}-${idx}`;
                                    return (
                                        <div key={uniqueId} className="uhck-sum-item" style={{ display: "flex", gap: "16px", padding: "24px", borderBottom: "1px solid #f0f0f0" }}>
                                            <div className="uhck-sum-img-wrap" style={{ width: "80px", height: "80px", flexShrink: 0, textAlign: "center" }}>
                                                <img src={item.images?.[0]?.url || item.image?.url || item.image || "/placeholder.png"} alt={item.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                                            </div>
                                            <div className="uhck-sum-details" style={{ flex: 1 }}>
                                                <div className="uhck-sum-name" style={{ fontSize: "14px", color: "#212121", marginBottom: "8px", lineHeight: "1.4" }}>{item.name}</div>
                                                {item.selectedSize && <div style={{ fontSize: 11, color: "#878787", marginBottom: 2 }}>Size: {item.selectedSize}</div>}
                                                {item.selectedColor && <div style={{ fontSize: 11, color: "#878787", marginBottom: 2 }}>Color: {item.selectedColor}</div>}
                                                <div className="uhck-sum-qty" style={{ fontSize: "12px", color: "#878787", marginBottom: "12px" }}>Qty: {item.quantity}</div>
                                                <div className="uhck-sum-price-row" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span className="uhck-sum-price" style={{ fontSize: "16px", fontWeight: 500, color: "#212121" }}>{fmt(item.price * item.quantity)}</span>
                                                    {item.mrp > item.price && <span className="uhck-sum-mrp" style={{ fontSize: "14px", color: "#878787", textDecoration: "line-through" }}>{fmt(item.mrp * item.quantity)}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
                                <div className="uhck-pay-options" style={{ display: "flex", flexDirection: "column" }}>
                                    {/* Online */}
                                    <div className={`uhck-pay-row ${paymentMethod === "online" ? "active" : ""}`} style={{ display: "flex", alignItems: "flex-start", gap: "16px", padding: "16px 24px", borderBottom: "1px solid #f0f0f0", cursor: "pointer" }} onClick={() => selectPaymentMethod("online")}>
                                        <div className={`uhck-radio ${paymentMethod === "online" ? "on" : ""}`} style={{ width: "18px", height: "18px", borderRadius: "50%", border: paymentMethod === "online" ? "5px solid #2874f0" : "2px solid #ccc", marginTop: "2px", flexShrink: 0 }} />
                                        <div className="uhck-pay-info" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                                            <span className="uhck-pay-title" style={{ fontSize: "15px", color: "#212121" }}>UPI, Wallets, Credit / Debit Card</span>
                                            <span className="uhck-pay-sub" style={{ fontSize: "12px", color: "#878787" }}>Fast & Secure Payments</span>
                                            {paymentMethod === "online" && (
                                                <div className="uhck-pay-action" style={{ width: "100%", marginTop: "16px" }}>
                                                    <button className="uhck-btn-primary" onClick={handlePayOnline} disabled={loading || payState === "processing"}>
                                                        {loading || payState === "processing" ? "Processing..." : `PAY ${fmt(finalTotal)}`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* COD */}
                                    <div className={`uhck-pay-row ${paymentMethod === "cod" ? "active" : ""} ${!codAvailable && !codChecking ? "disabled" : ""}`} style={{ display: "flex", alignItems: "flex-start", gap: "16px", padding: "16px 24px", borderBottom: "1px solid #f0f0f0", cursor: "pointer", opacity: (!codAvailable && !codChecking) ? 0.5 : 1 }} onClick={() => codAvailable && selectPaymentMethod("cod")}>
                                        <div className={`uhck-radio ${paymentMethod === "cod" ? "on" : ""}`} style={{ width: "18px", height: "18px", borderRadius: "50%", border: paymentMethod === "cod" ? "5px solid #2874f0" : "2px solid #ccc", marginTop: "2px", flexShrink: 0 }} />
                                        <div className="uhck-pay-info" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                                            <span className="uhck-pay-title" style={{ fontSize: "15px", color: "#212121" }}>Cash on Delivery</span>
                                            {codChecking ? (
                                                <span className="uhck-pay-sub" style={{ fontSize: "12px", color: "#878787" }}>Checking availability...</span>
                                            ) : codAvailable ? (
                                                <span className="uhck-pay-sub" style={{ fontSize: "12px", color: "#878787" }}>Pay at your doorstep</span>
                                            ) : (
                                                <span className="uhck-pay-sub" style={{ color: "#ff6161", fontSize: "12px" }}>Not available for this location</span>
                                            )}
                                            {paymentMethod === "cod" && codAvailable && (
                                                <div className="uhck-pay-action" style={{ width: "100%", marginTop: "16px" }}>
                                                    <button className="uhck-btn-primary" onClick={handleCOD} disabled={loading || payState === "processing"}>
                                                        {loading || payState === "processing" ? "Processing..." : `PLACE ORDER`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Order Summary */}
                <div className="uhck-sidebar" style={{ background: "#fff", borderRadius: "2px", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.2)", position: "sticky", top: "16px" }}>
                    <div className="uhck-price-card">
                        <div className="uhck-price-title" style={{ padding: "14px 24px", borderBottom: "1px solid #f0f0f0", fontSize: "16px", fontWeight: 500, color: "#878787", textTransform: "uppercase" }}>PRICE DETAILS</div>
                        {pricingLoading ? (
                            <div className="uhck-loading" style={{ padding: 24, display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#878787" }}><FaSpinner className="uhck-spin" style={{ animation: "uhck-sp .8s linear infinite" }} /> Calculating…</div>
                        ) : pricing ? (
                            <div className="uhck-price-body" style={{ padding: "24px" }}>
                                <div className="uhck-price-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: "#212121", marginBottom: "16px" }}>
                                    <span>Price ({checkoutItems.length} item{checkoutItems.length > 1 ? "s" : ""})</span>
                                    <span>{fmt(pricing.itemsTotal)}</span>
                                </div>
                                <div className="uhck-price-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: "#212121", marginBottom: "16px" }}>
                                    <span>Delivery Charges</span>
                                    <span style={{ color: pricing.deliveryCharge === 0 ? "#388e3c" : "#212121" }}>
                                        {pricing.deliveryCharge === 0 ? "FREE" : fmt(pricing.deliveryCharge)}
                                    </span>
                                </div>
                                <div className="uhck-price-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: "#212121", marginBottom: "16px" }}>
                                    <span>Platform Fee</span>
                                    <span>{fmt(pricing.platformFee)}</span>
                                </div>
                                {pricing.couponDiscount > 0 && (
                                    <div className="uhck-price-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: "#388e3c", marginBottom: "16px" }}>
                                        <span>Coupon Discount</span>
                                        <span>−{fmt(pricing.couponDiscount)}</span>
                                    </div>
                                )}
                                <div className="uhck-price-total" style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 500, color: "#212121", paddingTop: "16px", borderTop: "1px dashed #e0e0e0", marginTop: "8px" }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, justifyContent: "center", color: "#878787", fontSize: 12, fontWeight: 600, paddingBottom: "24px" }}>
                        <FaShieldAlt size={16} /> Safe and Secure Payments
                    </div>
                </div>

                {/* Mobile order summary toggle */}
                <div className="uhck-mobile-sum-toggle" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, background: "#1a1740", color: "#fff", padding: "12px 16px", zIndex: 50, justifyContent: "space-between", alignItems: "center", fontSize: "13px", fontWeight: 700, cursor: "pointer" }} onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}>
                    <span>{checkoutItems.length} item{checkoutItems.length > 1 ? "s" : ""} · {fmt(finalTotal)}</span>
                    {mobileSummaryOpen ? <FaChevronDown size={12} /> : <FaChevronUp size={12} />}
                </div>
                {mobileSummaryOpen && (
                    <div className="uhck-mobile-summary" style={{ position: "fixed", bottom: "44px", left: 0, right: 0, background: "#fff", borderTop: "1px solid #e8e4d9", padding: "12px 16px", zIndex: 49, maxHeight: "40vh", overflowY: "auto", boxShadow: "0 -4px 16px rgba(0,0,0,.1)" }}>
                        {checkoutItems.map((item, idx) => (
                            <div key={item.cartItemId || `${item._id}-${idx}`} className="uhck-side-item" style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                                <img src={item.images?.[0]?.url || item.image || "/placeholder.png"} alt={item.name} className="uhck-side-img" loading="lazy" style={{ width: "40px", height: "40px", objectFit: "contain" }} onError={(e) => { e.target.src = "/placeholder.png"; }} />
                                <div className="uhck-side-item-info" style={{ flex: 1 }}>
                                    <div className="uhck-side-item-name" style={{ fontSize: "12px", fontWeight: 500, color: "#212121", marginBottom: "4px" }}>{item.name}</div>
                                    <div className="uhck-side-item-qty" style={{ fontSize: "11px", color: "#878787" }}>Qty: {item.quantity} · {fmt(item.price * item.quantity)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ── In Form ──────────────────────────────── */
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
        <div className="uhck-addr-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 500, margin: 0 }}>{initial ? "Edit Address" : "Add New Address"}</h3>
            {formError && <div className="uhck-error" style={{ background: "#ffebe8", color: "#ff6161", padding: "12px 24px", fontSize: "14px", borderRadius: "2px" }}>{formError}</div>}
            <div className="uhck-addr-labels" style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
                {["Home", "Work", "Other"].map((l) => (
                    <button key={l} className={`uhck-label-chip${form.label === l ? " active" : ""}`} onClick={() => update("label", l)} style={{ background: form.label === l ? "#fff" : "#fff", color: form.label === l ? "#2874f0" : "#212121", border: form.label === l ? "1px solid #2874f0" : "1px solid #e0e0e0", padding: "6px 16px", borderRadius: "2px", fontSize: "13px", fontWeight: 500, cursor: "pointer", textTransform: "uppercase" }}>
                        {LABEL_ICONS[l]} {l}
                    </button>
                ))}
            </div>
            <div className="uhck-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="uhck-field" style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12px", color: "#878787", fontWeight: 500 }}>Name</label><input value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={100} style={{ padding: "12px 16px", border: "1px solid #e0e0e0", borderRadius: "2px", fontSize: "14px", outline: "none" }} /></div>
                <div className="uhck-field" style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12px", color: "#878787", fontWeight: 500 }}>Phone</label><input value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} inputMode="numeric" style={{ padding: "12px 16px", border: "1px solid #e0e0e0", borderRadius: "2px", fontSize: "14px", outline: "none" }} /></div>
                <div className="uhck-field full" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12px", color: "#878787", fontWeight: 500 }}>House / Flat / Building</label><input value={form.house} onChange={(e) => update("house", e.target.value)} maxLength={200} style={{ padding: "12px 16px", border: "1px solid #e0e0e0", borderRadius: "2px", fontSize: "14px", outline: "none" }} /></div>
                <div className="uhck-field full" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12px", color: "#878787", fontWeight: 500 }}>Area / Street / Colony</label><input value={form.area} onChange={(e) => update("area", e.target.value)} maxLength={200} style={{ padding: "12px 16px", border: "1px solid #e0e0e0", borderRadius: "2px", fontSize: "14px", outline: "none" }} /></div>
                <div className="uhck-field" style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12px", color: "#878787", fontWeight: 500 }}>Landmark</label><input value={form.landmark} onChange={(e) => update("landmark", e.target.value)} maxLength={100} placeholder="Optional" style={{ padding: "12px 16px", border: "1px solid #e0e0e0", borderRadius: "2px", fontSize: "14px", outline: "none" }} /></div>
                <div className="uhck-field" style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12px", color: "#878787", fontWeight: 500 }}>City</label><input value={form.city} onChange={(e) => update("city", e.target.value)} maxLength={100} style={{ padding: "12px 16px", border: "1px solid #e0e0e0", borderRadius: "2px", fontSize: "14px", outline: "none" }} /></div>
                <div className="uhck-field" style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12px", color: "#878787", fontWeight: 500 }}>State</label><input value={form.state} onChange={(e) => update("state", e.target.value)} maxLength={100} style={{ padding: "12px 16px", border: "1px solid #e0e0e0", borderRadius: "2px", fontSize: "14px", outline: "none" }} /></div>
                <div className="uhck-field" style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12px", color: "#878787", fontWeight: 500 }}>Pincode</label><input value={form.pincode} onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} inputMode="numeric" style={{ padding: "12px 16px", border: "1px solid #e0e0e0", borderRadius: "2px", fontSize: "14px", outline: "none" }} /></div>
            </div>
            <div className="uhck-form-btns" style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                <button className="uhck-btn-secondary" style={{ flex: 1, padding: "14px", background: "#fff", border: "1px solid #e0e0e0", color: "#212121", fontWeight: 500, cursor: "pointer" }} onClick={onCancel}>Cancel</button>
                <button className="uhck-btn-primary" style={{ flex: 1, padding: "14px", background: "#fb641b", color: "#fff", border: "none", fontWeight: 500, cursor: "pointer" }} onClick={handleSubmit} disabled={saving}>
                    {saving ? <><FaSpinner className="uhck-spin" style={{ animation: "uhck-sp .8s linear infinite" }} /> Saving…</> : (initial ? "Update" : "Save Address")}
                </button>
            </div>
        </div>
    );
};

/* ── CSS ───────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
.uhck-root { min-height: 100vh; background: #f1f3f6; font-family: 'Roboto', sans-serif; padding-bottom: 60px; }
.uhck-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 70vh; text-align: center; gap: 10px; }
.uhck-empty h2 { font-size: 20px; font-weight: 500; color: #212121; }
.uhck-empty p { font-size: 14px; color: #878787; }
.uhck-btn-primary { background: #fb641b; color: #fff; border: none; padding: 14px 32px; font-size: 14px; font-weight: 500; border-radius: 2px; cursor: pointer; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.2); text-transform: uppercase; font-family: inherit; }
.uhck-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.uhck-header { background: #2874f0; color: #fff; height: 60px; display: flex; align-items: center; }
.uhck-header-inner { max-width: 1100px; margin: 0 auto; width: 100%; padding: 0 16px; display: flex; justify-content: space-between; align-items: center; }
.uhck-back { background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.uhck-header-brand { font-size: 20px; letter-spacing: 0.5px; font-weight: 500; }
.uhck-secure { font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px; }
.uhck-layout { max-width: 1000px; margin: 24px auto; display: grid; grid-template-columns: 1fr 300px; gap: 16px; padding: 0 16px; align-items: start; }
@media(max-width: 860px) { .uhck-layout { grid-template-columns: 1fr; gap: 12px; } }
.uhck-main { display: flex; flex-direction: column; gap: 16px; }
.uhck-acc-card { background: #fff; border-radius: 2px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.2); }
.uhck-acc-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; background: #fff; }
.uhck-acc-card.active .uhck-acc-head { background: #2874f0; color: #fff; }
.uhck-acc-title { display: flex; align-items: center; gap: 16px; font-size: 16px; font-weight: 500; color: #878787; text-transform: uppercase; }
.uhck-acc-card.active .uhck-acc-title { color: #fff; }
.uhck-acc-num { width: 24px; height: 24px; background: #f0f0f0; color: #2874f0; display: flex; align-items: center; justify-content: center; border-radius: 2px; font-size: 13px; font-weight: 500; }
.uhck-acc-card.active .uhck-acc-num { background: #fff; color: #2874f0; }
.uhck-acc-check { color: #2874f0; margin-left: 8px; }
.uhck-acc-change { background: #fff; color: #2874f0; border: 1px solid #e0e0e0; padding: 6px 16px; border-radius: 2px; font-size: 13px; font-weight: 500; cursor: pointer; text-transform: uppercase; }
.uhck-acc-summary { padding: 0 24px 16px 64px; font-size: 14px; color: #212121; }
.uhck-acc-body { padding: 16px 24px 24px 64px; }
@media(max-width: 600px) { .uhck-acc-head { padding: 14px 16px; } .uhck-acc-summary { padding: 0 16px 16px 56px; } .uhck-acc-body { padding: 16px 16px 24px 16px; } }
.uhck-field-row { display: flex; gap: 16px; flex-wrap: wrap; }
.uhck-field { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 4px; }
.uhck-field input { width: 100%; padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 2px; font-size: 14px; outline: none; font-family: inherit; transition: border-color .2s; }
.uhck-field input:focus { border-color: #2874f0; }
.uhck-addr-list { display: flex; flex-direction: column; gap: 12px; }
.uhck-addr { display: flex; gap: 16px; padding: 16px; border: 1px solid #e0e0e0; border-radius: 2px; background: #fff; cursor: pointer; transition: background .2s; }
.uhck-addr:hover { background: #f5faff; }
.uhck-addr.selected { background: #f5faff; }
.uhck-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #ccc; margin-top: 2px; flex-shrink: 0; }
.uhck-radio.on { border: 5px solid #2874f0; }
.uhck-addr-body { flex: 1; }
.uhck-addr-top { margin-bottom: 6px; font-size: 14px; color: #212121; }
.uhck-addr-label { background: #f0f0f0; color: #878787; font-size: 10px; font-weight: 500; padding: 2px 6px; border-radius: 2px; text-transform: uppercase; }
.uhck-addr-line { font-size: 14px; color: #212121; line-height: 1.5; }
.uhck-addr-actions button { background: none; border: none; color: #2874f0; font-size: 13px; font-weight: 500; cursor: pointer; text-transform: uppercase; font-family: inherit; }
.uhck-add-addr { display: flex; align-items: center; gap: 12px; padding: 16px; background: #fff; border: 1px solid #e0e0e0; color: #2874f0; font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 2px; width: 100%; font-family: inherit; margin-top: 16px; }
.uhck-error { background: #ffebe8; color: #ff6161; padding: 12px 24px; font-size: 14px; border-radius: 2px; margin-bottom: 16px; }
.uhck-loading { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #878787; }
@keyframes uhck-sp { to { transform: rotate(360deg); } }
.uhck-spin { animation: uhck-sp .8s linear infinite; }
@media(max-width: 768px) { .uhck-mobile-sum-toggle { display: flex !important; } }
`;

export default UHCheckout;
