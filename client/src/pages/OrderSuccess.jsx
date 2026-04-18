import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import { imgUrl } from "../utils/imageUrl";
import {
    FaShoppingBag, FaClipboardList, FaWhatsapp,
    FaCheckCircle, FaMapMarkerAlt, FaPhone, FaUser,
    FaTruck, FaReceipt,
} from "react-icons/fa";
import SEO from "../components/SEO";

const OrderSuccess = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const paymentMethod = location.state?.paymentMethod || null;

    useEffect(() => {
        if (!id) { navigate("/orders"); return; }
        if (!user) { navigate("/login"); return; }
        const fetchOrder = async () => {
            try {
                setLoading(true);
                const { data } = await api.get(`/orders/${id}`);
                setOrder(data);
            } catch {
                setError("Order not found");
                setTimeout(() => navigate("/orders"), 2000);
            } finally { setLoading(false); }
        };
        fetchOrder();
    }, [id, user, navigate]);

    if (loading) return (
        <div style={{ minHeight: "100vh", background: "#f7f4ee", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
                <div style={{
                    width: 48, height: 48, border: "4px solid #e5d9c0",
                    borderTopColor: "#c9a84c", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite", margin: "0 auto 16px"
                }} />
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Processing your order...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );

    if (error || !order) return (
        <div style={{ minHeight: "100vh", background: "#f7f4ee", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#64748b", fontWeight: 600, marginBottom: 8 }}>Order not found</p>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Redirecting...</p>
        </div>
    );

    const isCOD = order.payment?.method === "COD" || paymentMethod === "COD";
    const cleanPhone = order.phone?.replace(/[^0-9]/g, "") || "";
    const finalPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const userWhatsApp = `https://wa.me/${finalPhone}?text=${encodeURIComponent(
        `✅ ORDER CONFIRMED\n\nHi ${order.customerName},\n\nOrder ID: #${order._id.slice(-8).toUpperCase()}\nTotal: ₹${order.totalAmount}\nPayment: ${isCOD ? "Cash on Delivery" : "Online Paid"}\n\nThank you for shopping with Urbexon💝`
    )}`;

    return (
        <div style={{
            minHeight: "100vh",
            background: "#f7f4ee",
            fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
            padding: "24px 16px 48px",
        }}>
            <SEO title="Order Confirmed" description="Your Urbexon order has been placed successfully!" noindex />
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .os-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e8e2d9;
                    overflow: hidden;
                    margin-bottom: 12px;
                    animation: fadeUp 0.4s ease both;
                }
                .os-card:nth-child(1) { animation-delay: 0.05s; }
                .os-card:nth-child(2) { animation-delay: 0.1s; }
                .os-card:nth-child(3) { animation-delay: 0.15s; }
                .os-card:nth-child(4) { animation-delay: 0.2s; }
                .os-card:nth-child(5) { animation-delay: 0.25s; }
                .os-card:nth-child(6) { animation-delay: 0.3s; }
                .os-btn-whatsapp {
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    width: 100%; padding: 14px;
                    background: #22c55e; color: #fff;
                    font-weight: 700; font-size: 14px;
                    border-radius: 8px; border: none;
                    text-decoration: none; cursor: pointer;
                    transition: background 0.2s, transform 0.1s;
                }
                .os-btn-whatsapp:hover { background: #16a34a; }
                .os-btn-whatsapp:active { transform: scale(0.98); }
                .os-btn-orders {
                    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
                    padding: 13px; background: #1a1740; color: #c9a84c;
                    font-weight: 700; font-size: 13px;
                    border-radius: 8px; text-decoration: none;
                    transition: background 0.2s;
                }
                .os-btn-orders:hover { background: #252060; }
                .os-btn-shop {
                    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
                    padding: 13px; background: #f1f5f9; color: #475569;
                    font-weight: 700; font-size: 13px;
                    border-radius: 8px; text-decoration: none;
                    transition: background 0.2s;
                }
                .os-btn-shop:hover { background: #e2e8f0; }
                .os-item-row:not(:last-child) { border-bottom: 1px solid #f8f9fa; }
            `}</style>

            <div style={{ maxWidth: 560, margin: "0 auto" }}>

                {/* ── Success Banner ── */}
                <div className="os-card">
                    <div style={{ height: 4, background: "linear-gradient(90deg, #c9a84c, #f0c060)" }} />
                    <div style={{ padding: "20px 20px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: "50%",
                            background: "#fef9ec", border: "2px solid #f0c060",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                            <FaCheckCircle size={26} color="#c9a84c" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 17, fontWeight: 800, color: "#1e293b", margin: 0 }}>
                                Order Placed Successfully! 🎉
                            </h1>
                            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                                Thank you, <strong style={{ color: "#1e293b" }}>{order.customerName}</strong>! Your order has been confirmed.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Order Summary ── */}
                <div className="os-card">
                    <div style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FaReceipt size={13} color="#c9a84c" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Order Summary</span>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#94a3b8" }}>
                            #{order._id.slice(-8).toUpperCase()}
                        </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                        {[
                            { label: "Order ID", value: `#${order._id.slice(-8).toUpperCase()}` },
                            { label: "Total", value: `₹${Number(order.totalAmount).toLocaleString("en-IN")}`, gold: true },
                            { label: "Payment", value: isCOD ? "COD" : "Online ✓" },
                        ].map(({ label, value, gold }, i) => (
                            <div key={i} style={{
                                padding: "14px 12px", textAlign: "center",
                                borderRight: i < 2 ? "1px solid #f1f5f9" : "none",
                            }}>
                                <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                    {label}
                                </div>
                                <div style={{ fontSize: gold ? 18 : 13, fontWeight: 800, color: gold ? "#c9a84c" : "#1e293b" }}>
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Delivery charge + breakdown */}
                    {(order.deliveryCharge !== undefined || order.platformFee !== undefined) && (
                        <div style={{ padding: "12px 20px", borderTop: "1px solid #f8f9fa", background: "#fafaf9" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                                    <span>Items Total</span>
                                    <span style={{ fontWeight: 600 }}>
                                        ₹{(Number(order.totalAmount) - Number(order.deliveryCharge || 0) - Number(order.platformFee || 0)).toLocaleString("en-IN")}
                                    </span>
                                </div>
                                {order.deliveryCharge > 0 && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                                        <span>Delivery</span>
                                        <span style={{ fontWeight: 600 }}>+₹{order.deliveryCharge}</span>
                                    </div>
                                )}
                                {order.platformFee > 0 && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                                        <span>Platform Fee</span>
                                        <span style={{ fontWeight: 600 }}>+₹{order.platformFee}</span>
                                    </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, color: "#1e293b", paddingTop: 6, borderTop: "1px dashed #e2e8f0" }}>
                                    <span>Grand Total</span>
                                    <span style={{ color: "#c9a84c" }}>₹{Number(order.totalAmount).toLocaleString("en-IN")}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Items ── */}
                <div className="os-card">
                    <div style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                        <FaShoppingBag size={13} color="#c9a84c" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                            Items Ordered ({order.items?.length || 0})
                        </span>
                    </div>
                    {order.items?.map((item, idx) => {
                        const rawImg = item.images?.[0]?.url || item.image || null;
                        const thumbImg = rawImg ? (imgUrl?.thumbnail ? imgUrl.thumbnail(rawImg) : rawImg) : null;
                        return (
                            <div key={idx} className="os-item-row" style={{ padding: "14px 20px", display: "flex", gap: 14, alignItems: "center" }}>
                                <div style={{
                                    width: 60, height: 60, borderRadius: 8,
                                    border: "1px solid #f1f5f9", background: "#f8f9fa",
                                    overflow: "hidden", flexShrink: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    {thumbImg ? (
                                        <img src={thumbImg} alt={item.name} loading="lazy"
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            onError={e => { e.target.style.display = "none"; }} />
                                    ) : (
                                        <span style={{ fontSize: 24 }}>🎁</span>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {item.name}
                                    </p>
                                    <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                                        Qty: {item.qty || item.quantity || 1} × ₹{Number(item.price).toLocaleString("en-IN")}
                                    </p>
                                    {item.customization?.text && (
                                        <span style={{
                                            display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700,
                                            color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a",
                                            padding: "2px 8px", borderRadius: 20,
                                        }}>
                                            ✏️ {item.customization.text}
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontWeight: 800, fontSize: 14, color: "#1e293b", flexShrink: 0, margin: 0 }}>
                                    ₹{((item.qty || item.quantity || 1) * item.price).toLocaleString("en-IN")}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* ── Delivery Info ── */}
                <div className="os-card">
                    <div style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                        <FaTruck size={13} color="#c9a84c" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Delivery Details</span>
                    </div>
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                        {[
                            { icon: <FaUser size={11} color="#c9a84c" />, text: order.customerName },
                            { icon: <FaPhone size={11} color="#c9a84c" />, text: order.phone },
                            { icon: <FaMapMarkerAlt size={11} color="#c9a84c" />, text: order.address },
                        ].map(({ icon, text }, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                <div style={{
                                    width: 28, height: 28, background: "#fef9ec",
                                    borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}>
                                    {icon}
                                </div>
                                <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.5, paddingTop: 5 }}>{text}</p>
                            </div>
                        ))}
                        {order.delivery?.eta && (
                            <div style={{
                                marginTop: 4, padding: "10px 14px",
                                background: "#f0fdf4", border: "1px solid #bbf7d0",
                                borderRadius: 8, fontSize: 12, color: "#166534", fontWeight: 600,
                            }}>
                                🕐 Estimated Delivery: {order.delivery.eta}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── CTAs ── */}
                <div className="os-card" style={{ padding: 16 }}>
                    <a href={userWhatsApp} target="_blank" rel="noreferrer" className="os-btn-whatsapp" style={{ marginBottom: 10 }}>
                        <FaWhatsapp size={16} /> Get WhatsApp Confirmation
                    </a>
                    <div style={{ display: "flex", gap: 10 }}>
                        <Link to="/orders" className="os-btn-orders">
                            <FaClipboardList size={13} /> My Orders
                        </Link>
                        <Link to="/" className="os-btn-shop">
                            <FaShoppingBag size={13} /> Shop More
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default OrderSuccess;