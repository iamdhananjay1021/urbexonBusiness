/**
 * PriceSummary.jsx
 * ✅ Shows server-calculated prices only
 * ✅ Never calculates prices locally
 */

import { memo } from "react";
import { FaTruck, FaShieldAlt, FaCheckCircle, FaTag, FaMoneyBillWave } from "react-icons/fa";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

const PriceSummary = memo(({ pricing, paymentMethod, checkoutItems, pricingLoading }) => {
    if (!pricing && !pricingLoading) return null;

    const {
        itemsTotal = 0,
        deliveryCharge = 0,
        platformFee = 0,
        couponDiscount = 0,
        coupon = null,
        finalTotal = 0,
        amountForFreeDelivery = 0,
        freeDeliveryThreshold = 499,
        deliveryType = "ECOMMERCE_STANDARD",
        deliveryETA = "",
        deliveryProvider = "",
    } = pricing || {};

    const isFreeDelivery = deliveryCharge === 0 && paymentMethod !== "cod";

    return (
        <div className="ck-price-box">
            <div className="ck-price-header">
                <span className="ck-price-title">Price Details</span>
                <span className="ck-price-count">
                    {checkoutItems?.length || 0} item{checkoutItems?.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="ck-price-body">
                {pricingLoading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[70, 50, 60, 80].map((w, i) => (
                            <div key={i} className="ck-price-skel" style={{ width: `${w}%` }} />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="ck-price-row">
                            <span>Items Total</span>
                            <span className="ck-price-val">₹{fmt(itemsTotal)}</span>
                        </div>
                        <div className="ck-price-row">
                            <span className="ck-price-row-label">
                                <FaTruck size={11} /> Delivery
                                {paymentMethod === "cod" && <span className="ck-price-sub">(COD)</span>}
                            </span>
                            {isFreeDelivery
                                ? <span className="ck-free">FREE</span>
                                : <span className="ck-price-val">₹{fmt(deliveryCharge)}</span>}
                        </div>
                        {platformFee > 0 && (
                            <div className="ck-price-row">
                                <span><FaShieldAlt size={11} /> Platform Fee</span>
                                <span className="ck-price-val">₹{fmt(platformFee)}</span>
                            </div>
                        )}
                        {couponDiscount > 0 && (
                            <div className="ck-price-row" style={{ color: "#15803d" }}>
                                <span><FaTag size={11} /> Coupon{coupon?.code ? ` (${coupon.code})` : ""}</span>
                                <span className="ck-price-val">-₹{fmt(couponDiscount)}</span>
                            </div>
                        )}
                        <div className="ck-price-divider" />
                        <div className="ck-price-total-row">
                            <span className="ck-price-total-lbl">Total</span>
                            <span className="ck-price-total-val">₹{fmt(finalTotal)}</span>
                        </div>

                        <div className="ck-chip ck-chip-muted" style={{ marginTop: 8 }}>
                            <FaTruck size={10} />
                            <span>{deliveryType === "URBEXON_HOUR" ? "Urbexon Hour" : "E-commerce Standard"} · {deliveryETA || "ETA pending"}</span>
                        </div>
                        {deliveryProvider && (
                            <div className="ck-chip ck-chip-muted">
                                <FaShieldAlt size={10} />
                                <span>Provider: {deliveryProvider.replaceAll("_", " ")}</span>
                            </div>
                        )}

                        {/* Contextual chips */}
                        {paymentMethod === "online" && isFreeDelivery && (
                            <div className="ck-chip ck-chip-green">
                                <FaCheckCircle size={10} />
                                <span>🎉 Free delivery on this order!</span>
                            </div>
                        )}
                        {paymentMethod === "online" && !isFreeDelivery && amountForFreeDelivery > 0 && (
                            <div className="ck-chip ck-chip-gold">
                                <FaTag size={10} />
                                <span>Add ₹{fmt(amountForFreeDelivery)} more for free delivery</span>
                            </div>
                        )}
                        {paymentMethod === "cod" && (
                            <div className="ck-chip ck-chip-muted">
                                <FaMoneyBillWave size={10} />
                                <span>₹{fmt(deliveryCharge)} delivery charge on COD</span>
                            </div>
                        )}
                        {!paymentMethod && amountForFreeDelivery > 0 && (
                            <div className="ck-chip ck-chip-gold">
                                <FaTruck size={10} />
                                <span>Free delivery on online payment above ₹{fmt(freeDeliveryThreshold)}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
});

PriceSummary.displayName = "PriceSummary";
export default PriceSummary;