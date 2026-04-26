/**
 * OrderDetail.jsx - Vendor Order Detail View
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { FiArrowLeft, FiPackage, FiUser, FiMapPin, FiClock, FiTruck } from "react-icons/fi";

const STATUS_CFG = {
    PLACED: { bg: "#fef3c7", c: "#92400e", l: "Pending" },
    CONFIRMED: { bg: "#dbeafe", c: "#1d4ed8", l: "Processing" },
    PACKED: { bg: "#ede9fe", c: "#5b21b6", l: "Packed" },
    READY_FOR_PICKUP: { bg: "#e0f2fe", c: "#075985", l: "Ready for Pickup" },
    SHIPPED: { bg: "#f0f9ff", c: "#0369a1", l: "Shipped" },
    OUT_FOR_DELIVERY: { bg: "#ffedd5", c: "#c2410c", l: "Out for Delivery" },
    DELIVERED: { bg: "#d1fae5", c: "#065f46", l: "Delivered" },
    CANCELLED: { bg: "#fee2e2", c: "#b91c1c", l: "Cancelled" },
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const isVendorSelfDelivery = (order) => order?.orderMode === "URBEXON_HOUR" && order?.delivery?.provider === "VENDOR_SELF";
const isLocalRiderDelivery = (order) => order?.orderMode === "URBEXON_HOUR" && order?.delivery?.provider === "LOCAL_RIDER";

const OrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deliveryOtp, setDeliveryOtp] = useState("");

    const loadOrder = async () => {
        try {
            const { data } = await api.get(`/vendor/orders/${id}`);
            setError("");
            setOrder(data.order || data);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load order");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrder();
    }, [id]);

    const updateStatus = async (status, extra = {}) => {
        try {
            await api.patch(`/vendor/orders/${id}/status`, { status, ...extra });
            if (status === "DELIVERED") setDeliveryOtp("");
            await loadOrder();
        } catch (err) {
            alert(err.response?.data?.message || "Failed to update status");
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
                <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div style={{ maxWidth: 600, margin: "40px auto", textAlign: "center", padding: 40 }}>
                <FiPackage size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
                <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>{error || "Order not found"}</p>
                <button onClick={() => navigate("/orders")} style={{ padding: "10px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    Back to Orders
                </button>
            </div>
        );
    }

    const s = STATUS_CFG[order.orderStatus] || { bg: "#f3f4f6", c: "#374151", l: order.orderStatus };
    const items = order.items || [];
    const subtotal = order.vendorSummary?.subtotal ?? order.pricing?.finalAmount ?? order.totalAmount;
    const selfDelivery = isVendorSelfDelivery(order);
    const riderDelivery = isLocalRiderDelivery(order);

    return (
        <div style={{ maxWidth: 800 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <button onClick={() => navigate("/orders")} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", border: "none", borderRadius: 10, cursor: "pointer" }}>
                    <FiArrowLeft size={16} color="#374151" />
                </button>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>
                        Order #{order._id?.slice(-6)?.toUpperCase()}
                    </h1>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                        {new Date(order.createdAt).toLocaleString("en-IN")}
                    </p>
                </div>
                <span style={{ marginLeft: "auto", background: s.bg, color: s.c, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {s.l}
                </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <FiUser size={14} color="#7c3aed" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1 }}>Customer</span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{order.customer?.name || order.customerName || "Guest"}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{order.customer?.phone || order.customerPhone || ""}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{order.customer?.email || ""}</p>
                </div>

                <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <FiMapPin size={14} color="#7c3aed" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1 }}>Shipping</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>
                        {order.address || "Address not available"}
                        {(order.city || order.state || order.pincode) && (
                            <>
                                <br />
                                {[order.city, order.state].filter(Boolean).join(", ")}
                                {order.pincode ? ` - ${order.pincode}` : ""}
                            </>
                        )}
                    </p>
                </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <FiPackage size={14} color="#7c3aed" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1 }}>Items ({items.length})</span>
                </div>
                {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                        {item.image ? (
                            <img src={item.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
                        ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f3f4f6" }} />
                        )}
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{item.name || item.productName || "Product"}</p>
                            {item.selectedSize && <span style={{ fontSize: 11, color: "#9ca3af" }}>Size: {item.selectedSize}</span>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{fmt(item.price)}</p>
                            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Qty: {item.qty || item.quantity || 1}</p>
                        </div>
                    </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14, marginTop: 10, borderTop: "2px solid #f3f4f6" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Vendor Total</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>{fmt(subtotal)}</span>
                </div>
            </div>

            {order.delivery && (
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <FiTruck size={14} color="#7c3aed" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1 }}>Delivery</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                        {order.delivery.provider && <div><span style={{ color: "#9ca3af" }}>Provider: </span><strong>{order.delivery.provider}</strong></div>}
                        {order.delivery.status && <div><span style={{ color: "#9ca3af" }}>Status: </span><strong>{order.delivery.status}</strong></div>}
                        {order.delivery.distanceKm && <div><span style={{ color: "#9ca3af" }}>Distance: </span><strong>{order.delivery.distanceKm} km</strong></div>}
                        <div><span style={{ color: "#9ca3af" }}>Mode: </span><strong>{selfDelivery ? "Vendor Self Delivery" : riderDelivery ? "Delivery Partner" : "Standard Delivery"}</strong></div>
                        {order.delivery.riderName && <div><span style={{ color: "#9ca3af" }}>Rider: </span><strong>{order.delivery.riderName}</strong></div>}
                    </div>
                </div>
            )}

            {order.statusTimeline && Object.keys(order.statusTimeline).length > 0 && (
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <FiClock size={14} color="#7c3aed" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1 }}>Timeline</span>
                    </div>
                    {Object.entries(order.statusTimeline)
                        .filter(([, v]) => v)
                        .sort(([, a], [, b]) => new Date(a) - new Date(b))
                        .map(([key, val]) => (
                            <div key={key} style={{ display: "flex", gap: 12, alignItems: "center", padding: "6px 0" }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }} />
                                <div style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{key.replace(/([A-Z])/g, " $1").replace(/^./, (v) => v.toUpperCase())}</div>
                                <div style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{new Date(val).toLocaleString("en-IN")}</div>
                            </div>
                        ))}
                </div>
            )}

            {selfDelivery && order.orderStatus === "OUT_FOR_DELIVERY" && (
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <FiTruck size={14} color="#16a34a" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: 1 }}>Complete Self Delivery</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#6b7280", marginTop: 0, marginBottom: 12 }}>
                        Customer app par jo delivery OTP dikh raha hai, usi OTP se delivery close hogi.
                    </p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={deliveryOtp}
                            onChange={(e) => setDeliveryOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="Enter delivery OTP"
                            style={{ flex: 1, minWidth: 220, padding: "10px 12px", border: "1.5px solid #d1d5db", borderRadius: 10, fontSize: 13, outline: "none" }}
                        />
                        <button
                            onClick={() => updateStatus("DELIVERED", { otp: deliveryOtp })}
                            disabled={!deliveryOtp.trim()}
                            style={{ padding: "10px 20px", background: "#d1fae5", color: "#065f46", border: "none", borderRadius: 10, cursor: deliveryOtp.trim() ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 13, opacity: deliveryOtp.trim() ? 1 : 0.6 }}
                        >
                            Mark Delivered
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {order.orderStatus === "PLACED" && (
                    <button onClick={() => updateStatus("CONFIRMED")} style={{ padding: "10px 20px", background: "#dbeafe", color: "#1d4ed8", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        Confirm Order
                    </button>
                )}
                {order.orderStatus === "CONFIRMED" && (
                    <button onClick={() => updateStatus("PACKED")} style={{ padding: "10px 20px", background: "#ede9fe", color: "#5b21b6", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        Mark Packed
                    </button>
                )}
                {order.orderStatus === "PACKED" && riderDelivery && (
                    <button onClick={() => updateStatus("READY_FOR_PICKUP")} style={{ padding: "10px 20px", background: "#e0f2fe", color: "#075985", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        Ready for Pickup
                    </button>
                )}
                {order.orderStatus === "PACKED" && selfDelivery && (
                    <button onClick={() => updateStatus("OUT_FOR_DELIVERY")} style={{ padding: "10px 20px", background: "#ffedd5", color: "#c2410c", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        Start Self Delivery
                    </button>
                )}
                {order.orderStatus === "READY_FOR_PICKUP" && selfDelivery && (
                    <button onClick={() => updateStatus("OUT_FOR_DELIVERY")} style={{ padding: "10px 20px", background: "#ffedd5", color: "#c2410c", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        Start Self Delivery
                    </button>
                )}
            </div>
        </div>
    );
};

export default OrderDetail;
