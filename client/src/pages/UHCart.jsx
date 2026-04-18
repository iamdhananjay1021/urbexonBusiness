/**
 * UHCart.jsx — Urbexon Hour Cart (Flipkart Minutes style)
 * ─────────────────────────────────────────────────────────
 * • Dedicated UH cart page at /uh-cart
 * • Qty controls, remove, clear
 * • Price summary with delivery + platform fee
 * • Proceed to UH Checkout
 */

import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import {
    FaBolt, FaTrash, FaPlus, FaMinus, FaArrowLeft,
    FaShoppingCart, FaClock, FaShieldAlt, FaTruck,
} from "react-icons/fa";
import SEO from "../components/SEO";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

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

    const deliveryCharge = uhTotal >= 499 ? 0 : 25;
    const platformFee = 11;
    const grandTotal = uhTotal + deliveryCharge + platformFee;

    if (uhItems.length === 0) {
        return (
            <div className="uhc-root">
                <style>{CSS}</style>
                <div className="uhc-empty">
                    <FaShoppingCart size={48} className="uhc-empty-ic" />
                    <h2>Your Urbexon Hour cart is empty</h2>
                    <p>Add items from Urbexon Hour for express delivery</p>
                    <Link to="/urbexon-hour" className="uhc-shop-btn">
                        <FaBolt size={12} /> Browse Urbexon Hour
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="uhc-root">
            <SEO title="Urbexon Hour Cart" noindex />
            <style>{CSS}</style>

            {/* Header */}
            <div className="uhc-header">
                <button className="uhc-back" onClick={() => navigate(-1)}>
                    <FaArrowLeft size={14} />
                </button>
                <div className="uhc-header-text">
                    <h1>
                        <FaBolt size={14} className="uhc-bolt" /> Urbexon Hour Cart
                    </h1>
                    <span className="uhc-count">{uhTotalQty} item{uhTotalQty !== 1 ? "s" : ""}</span>
                </div>
                <button
                    className={`uhc-clear${clearing ? " confirm" : ""}`}
                    onClick={handleClear}
                    onBlur={() => setClearing(false)}
                >
                    {clearing ? "Confirm Clear?" : "Clear"}
                </button>
            </div>

            {/* Delivery banner */}
            <div className="uhc-delivery-banner">
                <FaTruck size={13} />
                <span>Express delivery in <strong>45–120 mins</strong></span>
                {uhTotal < 499 && (
                    <span className="uhc-free-hint">
                        Add {fmt(499 - uhTotal)} more for free delivery
                    </span>
                )}
            </div>

            <div className="uhc-layout">
                {/* Items list */}
                <div className="uhc-items">
                    {uhItems.map((item) => {
                        const img = item.images?.[0]?.url || item.image?.url || item.image || "/placeholder.png";
                        const discount = item.mrp && item.mrp > item.price
                            ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
                            : 0;
                        return (
                            <div key={item._id} className="uhc-item">
                                <img
                                    src={img} alt={item.name}
                                    className="uhc-item-img"
                                    onError={(e) => { e.target.src = "/placeholder.png"; }}
                                />
                                <div className="uhc-item-body">
                                    {item.brand && <div className="uhc-item-brand">{item.brand}</div>}
                                    <div className="uhc-item-name">{item.name}</div>
                                    <div className="uhc-item-price-row">
                                        <span className="uhc-item-price">{fmt(item.price)}</span>
                                        {item.mrp > item.price && (
                                            <span className="uhc-item-mrp">{fmt(item.mrp)}</span>
                                        )}
                                        {discount > 0 && (
                                            <span className="uhc-item-disc">{discount}% off</span>
                                        )}
                                    </div>
                                    <div className="uhc-item-total">
                                        Total: {fmt(item.price * item.quantity)}
                                    </div>
                                </div>
                                <div className="uhc-item-actions">
                                    <div className="uhc-qty">
                                        <button
                                            onClick={() => {
                                                if (item.quantity <= 1) removeItem(item._id, "urbexon_hour");
                                                else decrement(item._id, "urbexon_hour");
                                            }}
                                            className="uhc-qty-btn"
                                        >
                                            {item.quantity <= 1 ? <FaTrash size={10} /> : <FaMinus size={10} />}
                                        </button>
                                        <span className="uhc-qty-val">{item.quantity}</span>
                                        <button
                                            onClick={() => increment(item._id, "urbexon_hour")}
                                            className="uhc-qty-btn"
                                            disabled={item.quantity >= 99}
                                        >
                                            <FaPlus size={10} />
                                        </button>
                                    </div>
                                    <button
                                        className="uhc-remove"
                                        onClick={() => removeItem(item._id, "urbexon_hour")}
                                    >
                                        <FaTrash size={10} /> Remove
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <Link to="/urbexon-hour" className="uhc-add-more">
                        <FaPlus size={11} /> Add more items
                    </Link>
                </div>

                {/* Price Summary */}
                <div className="uhc-summary">
                    <div className="uhc-summary-title">Price Details</div>
                    <div className="uhc-row">
                        <span>Items ({uhTotalQty})</span>
                        <span>{fmt(uhTotal)}</span>
                    </div>
                    <div className="uhc-row">
                        <span>Delivery</span>
                        <span className={deliveryCharge === 0 ? "uhc-free" : ""}>
                            {deliveryCharge === 0 ? "FREE" : fmt(deliveryCharge)}
                        </span>
                    </div>
                    <div className="uhc-row">
                        <span>Platform fee</span>
                        <span>{fmt(platformFee)}</span>
                    </div>
                    <div className="uhc-divider" />
                    <div className="uhc-row uhc-total-row">
                        <span>Total</span>
                        <span>{fmt(grandTotal)}</span>
                    </div>

                    <div className="uhc-eta">
                        <FaClock size={12} />
                        <span>Delivery in <strong>45–120 mins</strong></span>
                    </div>

                    <button
                        className="uhc-checkout-btn"
                        onClick={() => navigate("/uh-checkout")}
                    >
                        Proceed to Checkout — {fmt(grandTotal)}
                    </button>

                    <div className="uhc-trust">
                        <FaShieldAlt size={11} />
                        <span>Secure checkout · Safe payments</span>
                    </div>
                </div>
            </div>

            {/* Mobile sticky CTA */}
            <div className="uhc-mobile-cta">
                <div className="uhc-mobile-total">
                    <span className="uhc-mobile-amt">{fmt(grandTotal)}</span>
                    <span className="uhc-mobile-items">{uhTotalQty} item{uhTotalQty !== 1 ? "s" : ""}</span>
                </div>
                <button
                    className="uhc-mobile-btn"
                    onClick={() => navigate("/uh-checkout")}
                >
                    Proceed to Checkout
                </button>
            </div>
        </div>
    );
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
.uhc-root{min-height:100vh;background:#f8fafc;font-family:'DM Sans',sans-serif;padding-bottom:80px}

.uhc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:24px}
.uhc-empty-ic{color:#cbd5e1;margin-bottom:16px}
.uhc-empty h2{font-size:20px;font-weight:700;color:#111827;margin-bottom:6px}
.uhc-empty p{font-size:14px;color:#64748b;margin-bottom:20px}
.uhc-shop-btn{display:inline-flex;align-items:center;gap:6px;padding:12px 24px;background:#111827;color:#fff;border-radius:10px;font-weight:700;font-size:13px;text-decoration:none;transition:all .15s;font-family:'DM Sans',sans-serif}
.uhc-shop-btn:hover{background:#1e293b;transform:translateY(-1px);box-shadow:0 4px 12px rgba(17,24,39,.12)}

.uhc-header{display:flex;align-items:center;gap:12px;background:#fff;padding:14px clamp(16px,3vw,40px);border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:10;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.uhc-back{background:none;border:none;cursor:pointer;color:#111827;padding:6px}
.uhc-header-text{flex:1}
.uhc-header-text h1{font-size:16px;font-weight:800;color:#111827;display:flex;align-items:center;gap:6px}
.uhc-bolt{color:#c9a84c}
.uhc-count{font-size:12px;color:#64748b;font-weight:500}
.uhc-clear{background:none;border:1px solid #e5e7eb;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;color:#64748b;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
.uhc-clear:hover{border-color:#ef4444;color:#ef4444}
.uhc-clear.confirm{background:#ef4444;color:#fff;border-color:#ef4444}

.uhc-delivery-banner{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#ecfdf5;border-bottom:1px solid #bbf7d0;padding:10px clamp(16px,3vw,40px);font-size:13px;color:#065f46}
.uhc-free-hint{margin-left:auto;font-size:11px;color:#059669;font-weight:600}

.uhc-layout{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 360px;gap:16px;padding:16px clamp(16px,3vw,40px)}
@media(max-width:768px){.uhc-layout{grid-template-columns:1fr;gap:12px;padding:12px 16px}}

.uhc-items{display:flex;flex-direction:column;gap:8px}

.uhc-item{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;display:flex;gap:14px;transition:box-shadow .15s;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.uhc-item:hover{box-shadow:0 4px 12px rgba(0,0,0,.06)}
.uhc-item-img{width:80px;height:80px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#f3f4f6}
.uhc-item-body{flex:1;min-width:0}
.uhc-item-brand{font-size:10px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px}
.uhc-item-name{font-size:13px;font-weight:600;color:#111827;line-height:1.35;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.uhc-item-price-row{display:flex;align-items:baseline;gap:6px;margin-bottom:2px}
.uhc-item-price{font-size:14px;font-weight:800;color:#111827}
.uhc-item-mrp{font-size:11px;color:#94a3b8;text-decoration:line-through}
.uhc-item-disc{font-size:10px;font-weight:700;color:#16a34a}
.uhc-item-total{font-size:11px;color:#64748b}

.uhc-item-actions{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0}
.uhc-qty{display:flex;align-items:center;gap:0;border:1.5px solid #e5e7eb;border-radius:8px;overflow:hidden}
.uhc-qty-btn{width:30px;height:30px;border:none;background:#f9fafb;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#111827;transition:background .15s}
.uhc-qty-btn:hover{background:#e5e7eb}
.uhc-qty-btn:disabled{opacity:.3;cursor:not-allowed}
.uhc-qty-val{width:32px;text-align:center;font-size:13px;font-weight:700;color:#111827}
.uhc-remove{background:none;border:none;font-size:10px;color:#ef4444;cursor:pointer;display:flex;align-items:center;gap:3px;font-family:'DM Sans',sans-serif;font-weight:600}

.uhc-add-more{display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;background:#fff;border:1.5px dashed #d1d5db;border-radius:12px;color:#111827;font-weight:700;font-size:13px;text-decoration:none;transition:all .15s;font-family:'DM Sans',sans-serif}
.uhc-add-more:hover{background:#f9fafb;border-color:#111827}

.uhc-summary{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;height:fit-content;position:sticky;top:72px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.uhc-summary-title{font-size:14px;font-weight:800;color:#111827;margin-bottom:14px}
.uhc-row{display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:8px}
.uhc-free{color:#16a34a;font-weight:700}
.uhc-divider{border-top:1px dashed #e5e7eb;margin:10px 0}
.uhc-total-row{font-size:15px;font-weight:800;color:#111827}
.uhc-eta{display:flex;align-items:center;gap:6px;background:#ecfdf5;border-radius:8px;padding:8px 10px;margin:14px 0;font-size:12px;color:#065f46}
.uhc-checkout-btn{width:100%;padding:14px;background:#111827;color:#fff;border:none;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
.uhc-checkout-btn:hover{background:#1e293b;box-shadow:0 6px 20px rgba(17,24,39,.15);transform:translateY(-1px)}
.uhc-trust{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;font-size:11px;color:#94a3b8}

.uhc-mobile-cta{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;padding:12px 16px;z-index:50;align-items:center;justify-content:space-between;box-shadow:0 -4px 16px rgba(0,0,0,.06)}
@media(max-width:768px){.uhc-mobile-cta{display:flex}.uhc-summary{display:none}}
.uhc-mobile-total{display:flex;flex-direction:column}
.uhc-mobile-amt{font-size:16px;font-weight:800;color:#111827}
.uhc-mobile-items{font-size:11px;color:#64748b}
.uhc-mobile-btn{padding:12px 24px;background:#111827;color:#fff;border:none;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
.uhc-mobile-btn:hover{background:#1e293b}
`;

export default UHCart;
