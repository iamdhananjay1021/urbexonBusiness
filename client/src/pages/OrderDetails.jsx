/**
 * OrderDetails.jsx — Professional Production Grade UI
 * ✅ Industry-standard design patterns
 * ✅ Enhanced tracking visualization
 * ✅ Premium animations & interactions
 * ✅ Responsive, accessible, production-ready
 */

import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import {
    FaArrowLeft, FaBoxOpen, FaMapMarkerAlt, FaPhone, FaUser,
    FaShoppingBag, FaTimesCircle, FaGift, FaUndo, FaInfoCircle,
    FaSpinner, FaFileInvoice, FaCheckCircle, FaTruck, FaExternalLinkAlt,
    FaClock, FaBox, FaTruckMoving, FaHome,
} from "react-icons/fa";
import LiveTrackingMap from "../components/LiveTrackingMap";

// ✨ Premium Color System
const C = {
    bg: "#f9fafb", bgLight: "#ffffff", border: "#e5e7eb", borderLight: "#f3f4f6",
    blue: "#2563eb", blueBg: "#eff6ff", blueMid: "#dbeafe", blueDark: "#1e40af",
    text: "#111827", sub: "#374151", muted: "#6b7280", hint: "#9ca3af",
    green: "#10b981", greenBg: "#f0fdf4", greenMid: "#dcfce7",
    red: "#ef4444", redBg: "#fef2f2", redMid: "#fecaca",
    amber: "#f59e0b", amberBg: "#fffbeb", amberMid: "#fde68a",
    sky: "#0ea5e9", violet: "#8b5cf6", orange: "#f97316",
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    shadowMd: "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)",
    shadowLg: "0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)",
};

const STATUS_CFG = {
    PLACED: { label: "Order Placed", color: C.amber, bg: C.amberBg, border: C.amberMid, icon: FaBox, accent: C.amber },
    CONFIRMED: { label: "Confirmed", color: C.blue, bg: C.blueBg, border: C.blueMid, icon: FaCheckCircle, accent: C.blue },
    PACKED: { label: "Packed", color: C.violet, bg: "#f5f3ff", border: "#ede9fe", icon: FaBoxOpen, accent: C.violet },
    READY_FOR_PICKUP: { label: "Ready for Pickup", color: C.sky, bg: "#f0f9ff", border: "#e0f2fe", icon: FaTruck, accent: C.sky },
    SHIPPED: { label: "Shipped", color: C.sky, bg: "#f0f9ff", border: "#e0f2fe", icon: FaTruckMoving, accent: C.sky },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", color: C.orange, bg: "#fff7ed", border: "#fed7aa", icon: FaTruck, accent: C.orange },
    DELIVERED: { label: "Delivered", color: C.green, bg: C.greenBg, border: C.greenMid, icon: FaHome, accent: C.green },
    CANCELLED: { label: "Cancelled", color: C.red, bg: C.redBg, border: C.redMid, icon: FaTimesCircle, accent: C.red },
};

const REFUND_STATUS = {
    NONE: null,
    REQUESTED: { label: "Refund Requested", color: C.amber, desc: "Under review. Will be processed within 1-2 business days." },
    PROCESSING: { label: "Refund Processing", color: C.blue, desc: "Being processed. Please wait 24-48 hours." },
    PROCESSED: { label: "Refund Processed", color: C.green, desc: "Amount will reflect within 5-7 business days." },
    FAILED: { label: "Refund Failed", color: C.red, desc: "There was an issue. Admin will retry shortly." },
    REJECTED: { label: "Refund Rejected", color: C.red, desc: null },
};

const FLOW_STEPS = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const UH_FLOW_STEPS = ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const CANCELLABLE = ["PLACED", "CONFIRMED"];
const getItemImage = (item) => item.images?.[0]?.url || item.image || null;

const Card = ({ children, style = {}, highlight = false }) => (
    <div style={{
        background: C.bgLight,
        border: `1px solid ${highlight ? C.blue : C.border}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: highlight ? `0 0 0 3px ${C.blueBg}, ${C.shadowMd}` : C.shadow,
        ...style
    }}>{children}</div>
);

const STitle = ({ children, icon: Icon }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {Icon && <Icon size={16} color={C.blue} style={{ minWidth: 16 }} />}
        <div style={{ width: Icon ? 0 : 3, height: 18, background: Icon ? "none" : C.blue, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}</h2>
    </div>
);

/* Shiprocket Tracking (user-facing) */
const ShiprocketTrackCard = ({ orderId, shipping }) => {
    const [tracking, setTracking] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const isMock = shipping?.mock;
    if (!shipping?.awbCode) return null;

    const fetchTracking = async () => {
        try { setLoading(true); setError(""); const { data } = await api.get(`/shiprocket/track/${orderId}`); setTracking(data); }
        catch (err) { setError(err.response?.data?.message || "Live tracking not available right now."); }
        finally { setLoading(false); }
    };

    return (
        <Card style={{ border: `1px solid ${C.blueMid}`, background: C.blueBg }}>
            <STitle>Shipment Tracking</STitle>
            {isMock && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>🔧</span>
                    <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
                        <b>Test shipment.</b> Real AWB tracking will be live once Shiprocket account is connected.
                    </p>
                </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 8, marginBottom: 14 }}>
                {[{ label: "Tracking ID (AWB)", value: shipping.awbCode, mono: true }, { label: "Courier Partner", value: shipping.courierName || "Standard" }, { label: "Shipment ID", value: shipping.shipmentId, mono: true }].map(({ label, value, mono }) => (
                    <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: C.hint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</p>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: mono ? "'Courier New',monospace" : "inherit", wordBreak: "break-all" }}>{value || "—"}</p>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!isMock && <button onClick={fetchTracking} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: C.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {loading ? <FaSpinner size={11} style={{ animation: "od-spin 0.8s linear infinite" }} /> : <FaTruck size={11} />}{loading ? "Fetching..." : "Get Live Status"}
                </button>}
                {!isMock && shipping.trackingUrl && <a href={shipping.trackingUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: C.white, border: `1px solid ${C.border}`, color: C.blue, borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" }}><FaExternalLinkAlt size={10} /> Track on Shiprocket</a>}
            </div>
            {error && <p style={{ fontSize: 12, color: C.red, background: "#fef2f2", padding: "8px 12px", borderRadius: 8, marginTop: 10 }}>{error}</p>}
            {tracking && !isMock && (
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Current Status</p>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.sky, background: "#f0f9ff", border: "1px solid #bae6fd", padding: "3px 10px", borderRadius: 20 }}>{tracking.label || tracking.status}</span>
                    </div>
                    {tracking.detail && <p style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{tracking.detail}</p>}
                    {tracking.activities?.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {tracking.activities.slice(0, 5).map((act, i) => (
                                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? C.blue : C.border, marginTop: 4, flexShrink: 0 }} />
                                    <div><p style={{ fontSize: 13, color: C.sub, fontWeight: i === 0 ? 600 : 400 }}>{act.activity}</p><p style={{ fontSize: 11, color: C.hint, marginTop: 1 }}>{act.location && `${act.location} · `}{new Date(act.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

/* MAIN */
const OrderDetails = () => {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cancelling, setCancelling] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [cancelError, setCancelError] = useState("");
    const [showRefundForm, setShowRefundForm] = useState(false);
    const [refundReason, setRefundReason] = useState("");
    const [requestingRefund, setRequestingRefund] = useState(false);
    const [refundError, setRefundError] = useState("");
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [liveStatus, setLiveStatus] = useState(null);
    const [riderLocation, setRiderLocation] = useState(null); // {lat, lng, riderName}
    const [deliveryStatus, setDeliveryStatus] = useState(null); // granular: ASSIGNED, ARRIVING_VENDOR, PICKED_UP, etc.
    const [deliveryOtp, setDeliveryOtp] = useState(null); // OTP for delivery confirmation

    // ── Get auth token for WebSocket ──────────────────────────
    const authToken = (() => { try { return JSON.parse(localStorage.getItem("auth") || "{}")?.token; } catch { return null; } })();

    // ── WebSocket: real-time order updates ───────────────────
    const { send: wsSend } = useWebSocket(authToken, {
        onMessage: (msg) => {
            if (msg.type === "order_status_updated" && msg.payload?.orderId === id) {
                setLiveStatus(msg.payload.status);
                setOrder(prev => prev ? { ...prev, orderStatus: msg.payload.status } : prev);
            }
            // Delivery controller sends "order_status" with OTP
            if (msg.type === "order_status" && msg.payload?.orderId === id) {
                if (msg.payload.status) {
                    setLiveStatus(msg.payload.status);
                    setOrder(prev => prev ? { ...prev, orderStatus: msg.payload.status } : prev);
                }
                if (msg.payload.otp) {
                    setDeliveryOtp(msg.payload.otp);
                }
            }
            if (msg.type === "rider_location" && msg.payload?.orderId === id) {
                setRiderLocation({
                    lat: msg.payload.lat,
                    lng: msg.payload.lng,
                    riderName: msg.payload.riderName,
                    at: msg.payload.at,
                });
            }
            // Granular delivery status (from assignment engine)
            if (msg.type === "delivery:status_update" && msg.payload?.orderId === id) {
                setDeliveryStatus(msg.payload.status);
            }
        },
        onConnect: () => {
            // Join order room for targeted updates
            if (id) wsSend("join_room", { room: `order:${id}` });
        },
    });

    // ── Polling fallback: fetch rider location if WS has no data ──
    useEffect(() => {
        if (order?.orderStatus !== "OUT_FOR_DELIVERY" || riderLocation) return;
        const poll = async () => {
            try {
                const { data } = await api.get(`/delivery/orders/${id}/rider-location`);
                if (data.available && data.rider?.lat) {
                    setRiderLocation({
                        lat: data.rider.lat, lng: data.rider.lng,
                        riderName: data.rider.name, at: data.rider.updatedAt,
                    });
                }
            } catch { /* silent */ }
        };
        poll();
        const t = setInterval(poll, 15000);
        return () => clearInterval(t);
    }, [order?.orderStatus, id, riderLocation]);

    // ── SSE fallback: also listen via EventSource ─────────────
    useOrderRealtime({
        enabled: !!authToken,
        onStatusUpdate: (payload) => {
            if (payload?.orderId === id) {
                setLiveStatus(payload.status);
                setOrder(prev => prev ? { ...prev, orderStatus: payload.status } : prev);
            }
        },
    });

    useEffect(() => {
        if (!id) return;
        (async () => { try { setLoading(true); const { data } = await api.get(`/orders/${id}`); setOrder(data); if (data.deliveryOtp?.code) setDeliveryOtp(data.deliveryOtp.code); } catch { setError("Order not found or you don't have access."); } finally { setLoading(false); } })();
    }, [id]);

    const handleCancel = async () => {
        try { setCancelling(true); setCancelError(""); const { data } = await api.patch(`/orders/${id}/cancel`); setOrder(data.order); setConfirmCancel(false); }
        catch (err) { setCancelError(err.response?.data?.message || "Failed to cancel order"); } finally { setCancelling(false); }
    };

    const handleRefundRequest = async () => {
        try { setRequestingRefund(true); setRefundError(""); const { data } = await api.post(`/payment/refund/${id}`, { reason: refundReason || "Requested by customer" }); setOrder(prev => ({ ...prev, refund: data.refund })); setShowRefundForm(false); }
        catch (err) { setRefundError(err.response?.data?.message || "Failed to submit refund request"); } finally { setRequestingRefund(false); }
    };

    // ✅ FIXED: Correct route /api/invoice/:orderId/download
    const handleDownloadInvoice = async () => {
        try {
            setDownloadingInvoice(true);
            const response = await api.get(`/invoice/${id}/download`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
            const link = document.createElement("a"); link.href = url;
            link.setAttribute("download", `Urbexon_Invoice_${id.slice(-8).toUpperCase()}.pdf`);
            document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
        } catch (err) {
            const s = err.response?.status;
            if (s === 403) alert("Access denied.");
            else if (s === 404) alert("Invoice not found. Please contact support.");
            else alert("Failed to download invoice.");
        } finally { setDownloadingInvoice(false); }
    };

    if (loading) return (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
            <style>{`
                @keyframes od-spin { to { transform: rotate(360deg); } }
                @keyframes od-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
            <div style={{ textAlign: "center" }}>
                <div style={{ width: 48, height: 48, border: `3px solid ${C.blueMid}`, borderTopColor: C.blue, borderRadius: "50%", animation: "od-spin 0.8s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ color: C.muted, fontSize: 14, fontWeight: 500 }}>Loading your order details...</p>
            </div>
        </div>
    );

    if (!order) return (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
            <div style={{ width: 80, height: 80, background: C.blueBg, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: C.shadow }}>
                <FaBoxOpen size={40} color={C.blue} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8, textAlign: "center" }}>Order Not Found</h2>
            <p style={{ color: C.muted, fontSize: 15, marginBottom: 28, textAlign: "center", maxWidth: 320 }}>{error || "Unable to load order details. Please check your order ID and try again."}</p>
            <Link to="/orders" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", background: C.blue, color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: C.shadowMd }}>
                <FaArrowLeft size={13} /> Back to Orders
            </Link>
        </div>
    );

    const cfg = STATUS_CFG[order?.orderStatus] || STATUS_CFG.PLACED;
    const isUH = order?.orderMode === "URBEXON_HOUR";
    const activeFlowSteps = isUH ? UH_FLOW_STEPS : FLOW_STEPS;
    const stepIdx = activeFlowSteps.indexOf(order?.orderStatus);
    const isCancelled = order?.orderStatus === "CANCELLED";
    const isDelivered = order?.orderStatus === "DELIVERED";
    const isShipped = ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order?.orderStatus);
    const canCancel = CANCELLABLE.includes(order?.orderStatus);
    const isRazorpay = order?.payment?.method === "RAZORPAY";
    const isPaid = order?.payment?.status === "PAID";
    const refundStatus = order?.refund?.status || "NONE";
    const refundInfo = REFUND_STATUS[refundStatus] || null;
    const canRequestRefund = isCancelled && isRazorpay && isPaid && refundStatus === "NONE";
    const hasShipping = !!order?.shipping?.awbCode;
    const showInvoiceBtn = (isDelivered || (isPaid && !isCancelled));

    return (
        <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: C.text }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes od-spin { to { transform: rotate(360deg); } }
                @keyframes od-fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes od-slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes od-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes od-shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
                .od-anim { animation: od-fadeUp 0.5s ease forwards; opacity: 0; }
                .od-item { animation: od-slideIn 0.35s ease forwards; }
                .od-btn { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
                .od-btn:hover { transform: translateY(-2px); box-shadow: ${C.shadowLg}; }
                .od-btn:active { transform: scale(0.98); }
                .od-back { transition: color 0.15s; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; color: ${C.muted}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
                .od-back:hover { color: ${C.blue}; }
                button:disabled { cursor: not-allowed; opacity: 0.6; }
            `}</style>

            <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px clamp(16px, 4vw, 20px) 60px" }}>

                {/* Navigation */}
                <div className="od-anim" style={{ marginBottom: 28 }}>
                    <Link to="/orders" className="od-back">
                        <FaArrowLeft size={10} /> Back to Orders
                    </Link>
                </div>

                {/* Header */}
                <div className="od-anim" style={{ marginBottom: 28, animationDelay: "50ms" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
                        <div>
                            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0, marginBottom: 12 }}>Order #{order._id.slice(-8).toUpperCase()}</h1>
                            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{new Date(order.createdAt).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: STATUS_CFG[order?.orderStatus]?.bg, border: `2px solid ${STATUS_CFG[order?.orderStatus]?.accent}`, boxShadow: C.shadow }}>
                            {(() => {
                                const Icon = STATUS_CFG[order?.orderStatus]?.icon;
                                return Icon ? <Icon size={16} color={STATUS_CFG[order?.orderStatus]?.accent} /> : null;
                            })()}
                            <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_CFG[order?.orderStatus]?.accent }}>{STATUS_CFG[order?.orderStatus]?.label}</span>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{showInvoiceBtn && <button onClick={handleDownloadInvoice} disabled={downloadingInvoice} className="od-btn" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: C.bgLight, border: `1.5px solid ${C.border}`, color: C.blue, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                        {downloadingInvoice ? <FaSpinner size={12} style={{ animation: "od-spin 0.8s linear infinite" }} /> : <FaFileInvoice size={12} />}
                        {downloadingInvoice ? "Downloading..." : "Download Invoice"}
                    </button>}</div>
                </div>

                {/* Cancelled Alert */}
                {isCancelled && <div className="od-anim" style={{ animationDelay: "80ms", marginBottom: 16 }}>
                    <Card style={{ border: `2px solid ${C.red}`, background: C.redBg, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 44, height: 44, background: C.redMid, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <FaTimesCircle size={20} color={C.red} />
                            </div>
                            <div>
                                <p style={{ fontWeight: 700, color: C.red, fontSize: 15, marginBottom: 4 }}>Order Cancelled</p>
                                <p style={{ color: C.muted, fontSize: 13 }}>{order.cancellationReason || "This order has been cancelled."}</p>
                            </div>
                        </div>
                    </Card>
                </div>}

                {/* Refund Status */}
                {refundInfo && <div className="od-anim" style={{ animationDelay: "100ms", marginBottom: 16 }}>
                    <Card style={{ border: `1.5px solid ${refundInfo.color}`, background: `${refundInfo.color}08` }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                            <FaUndo size={18} color={refundInfo.color} style={{ marginTop: 2, flexShrink: 0 }} />
                            <div>
                                <p style={{ fontWeight: 700, color: refundInfo.color, fontSize: 15, marginBottom: 6 }}>{refundInfo.label}</p>
                                {refundInfo.desc && <p style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{refundInfo.desc}</p>}
                                {refundStatus === "PROCESSED" && order.refund?.amount && <p style={{ fontSize: 14, fontWeight: 800, color: C.green }}>₹{Number(order.refund.amount).toLocaleString("en-IN")} refunded</p>}
                            </div>
                        </div>
                    </Card>
                </div>}

                {/* Premium Tracking Timeline */}
                {!isCancelled && stepIdx >= 0 && (
                    <div className="od-anim" style={{ animationDelay: "120ms", marginBottom: 18 }}>
                        <Card highlight>
                            <STitle icon={FaClock}>Order Tracking</STitle>
                            <div style={{ position: "relative" }}>
                                {/* Progress Bar */}
                                <div style={{ position: "absolute", left: "5%", right: "5%", top: 20, height: 3, background: C.borderLight, borderRadius: 2, zIndex: 0 }} />
                                <div style={{
                                    position: "absolute", left: "5%", top: 20, height: 3, background: `linear-gradient(90deg, ${isUH ? "#8b5cf6" : C.blue}, ${isUH ? "#a78bfa" : "#60a5fa"})`,
                                    borderRadius: 2, zIndex: 1, width: stepIdx > 0 ? `${(stepIdx / (activeFlowSteps.length - 1)) * 90}%` : "0%",
                                    transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
                                }} />

                                {/* Steps */}
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
                                    {activeFlowSteps.map((step, i) => {
                                        const done = i <= stepIdx, active = i === stepIdx;
                                        const StepIcon = STATUS_CFG[step]?.icon || FaBox;
                                        return (
                                            <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: "50%",
                                                    background: done ? (active ? STATUS_CFG[step]?.accent : STATUS_CFG[step]?.border) : C.borderLight,
                                                    border: `2.5px solid ${STATUS_CFG[step]?.accent || C.border}`,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    boxShadow: active ? `0 0 0 8px ${STATUS_CFG[step]?.bg}` : C.shadow,
                                                    transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                                    transform: active ? "scale(1.15)" : "scale(1)"
                                                }}>
                                                    {i < stepIdx ? <FaCheckCircle size={18} color={STATUS_CFG[step]?.accent} /> : <StepIcon size={16} color={done ? "#fff" : C.hint} />}
                                                </div>
                                                <p style={{ fontSize: 11, fontWeight: done ? 700 : 500, color: done ? STATUS_CFG[step]?.accent : C.hint, textAlign: "center", lineHeight: 1.3, textTransform: "uppercase", letterSpacing: "0.04em", maxWidth: 60 }}>
                                                    {STATUS_CFG[step]?.label.split(" ").slice(0, 2).join("\n")}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Status Card */}
                            <div style={{ marginTop: 24, padding: "12px 16px", background: STATUS_CFG[order?.orderStatus]?.bg, border: `1.5px solid ${STATUS_CFG[order?.orderStatus]?.accent}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_CFG[order?.orderStatus]?.accent, animation: "od-pulse 2s ease-in-out infinite" }} />
                                <p style={{ fontSize: 14, fontWeight: 600, color: STATUS_CFG[order?.orderStatus]?.accent, margin: 0 }}>
                                    {isDelivered ? "✓ Delivered Successfully!" : order.orderStatus === "OUT_FOR_DELIVERY" ? "🛵 Out for delivery today" : isShipped ? `📦 Shipped via ${order.shipping?.courierName || "courier"}` : STATUS_CFG[order?.orderStatus]?.label}
                                </p>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Shiprocket — ecommerce only */}
                {!isUH && hasShipping && !isCancelled && <div className="od-anim" style={{ animationDelay: "130ms", marginBottom: 14 }}><ShiprocketTrackCard orderId={id} shipping={order.shipping} /></div>}

                {/* Urbexon Hour Express Info */}
                {isUH && !isCancelled && !isDelivered && (
                    <div className="od-anim" style={{ animationDelay: "130ms", marginBottom: 14 }}>
                        <Card style={{ border: "1px solid #ddd6fe", background: "#faf5ff" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 38, height: 38, background: "#ede9fe", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
                                <div>
                                    <p style={{ fontWeight: 800, fontSize: 14, color: "#5b21b6" }}>Urbexon Hour Express</p>
                                    <p style={{ fontSize: 12, color: "#7c3aed" }}>Estimated delivery: 45-120 minutes</p>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                <div style={{ background: "#fff", border: "1px solid #ede9fe", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                                    <p style={{ fontSize: 9, fontWeight: 700, color: C.hint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Delivery</p>
                                    <p style={{ fontSize: 13, fontWeight: 800, color: "#5b21b6" }}>{order.delivery?.provider === "LOCAL_RIDER" ? "Local Rider" : order.delivery?.provider === "VENDOR_SELF" ? "Vendor" : "Express"}</p>
                                </div>
                                <div style={{ background: "#fff", border: "1px solid #ede9fe", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                                    <p style={{ fontSize: 9, fontWeight: 700, color: C.hint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Distance</p>
                                    <p style={{ fontSize: 13, fontWeight: 800, color: "#5b21b6" }}>{order.delivery?.distanceKm ? `${order.delivery.distanceKm.toFixed(1)} km` : "—"}</p>
                                </div>
                                <div style={{ background: "#fff", border: "1px solid #ede9fe", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                                    <p style={{ fontSize: 9, fontWeight: 700, color: C.hint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>ETA</p>
                                    <p style={{ fontSize: 13, fontWeight: 800, color: "#5b21b6" }}>{order.delivery?.eta ? `${order.delivery.eta} min` : "45-120 min"}</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Delivery OTP — shown to customer when OUT_FOR_DELIVERY */}
                {order?.orderStatus === "OUT_FOR_DELIVERY" && deliveryOtp && (
                    <div className="od-anim" style={{ animationDelay: "135ms", marginBottom: 14 }}>
                        <Card style={{ border: "2px dashed #f59e0b", background: "#fffbeb", textAlign: "center", padding: "24px 20px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                🔐 Delivery OTP
                            </div>
                            <div style={{ fontSize: "clamp(28px, 8vw, 40px)", fontWeight: 900, color: "#1e293b", letterSpacing: "0.3em", fontFamily: "'Courier New', monospace", margin: "10px 0", wordBreak: "break-all" }}>
                                {deliveryOtp}
                            </div>
                            <p style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6, maxWidth: 340, margin: "0 auto" }}>
                                Share this OTP with the delivery partner to confirm delivery. <strong>Do not share before receiving your order.</strong>
                            </p>
                        </Card>
                    </div>
                )}

                {/* Items Section */}
                <div className="od-anim" style={{ animationDelay: "180ms", marginBottom: 18 }}>
                    <Card>
                        <STitle icon={FaShoppingBag}>Ordered Items ({order.items.length})</STitle>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {order.items.map((item, idx) => {
                                const img = getItemImage(item);
                                return (
                                    <div key={idx} className="od-item" style={{
                                        animationDelay: `${180 + idx * 50}ms`,
                                        display: "flex", alignItems: "center", gap: 12,
                                        background: C.bgLight, borderRadius: 14, padding: 14,
                                        border: `1.5px solid ${C.border}`, transition: "all 0.3s",
                                        cursor: "pointer"
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = C.blue}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                                        <div style={{ width: 64, height: 64, background: C.bgLight, border: `1.5px solid ${C.borderLight}`, borderRadius: 12, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {img ? <img src={img} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} /> : <FaGift size={20} color={C.hint} />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontWeight: 700, fontSize: 14, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{item.name}</p>
                                            <p style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}><span style={{ fontWeight: 600, color: C.text }}>Qty:</span> {item.qty} × <span style={{ fontWeight: 700, color: C.blue }}>₹{item.price.toLocaleString("en-IN")}</span></p>
                                            {item.selectedSize && <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, background: C.amberBg, color: C.amber, padding: "3px 11px", borderRadius: 99, border: `1px solid ${C.amberMid}`, textTransform: "uppercase" }}>Size: {item.selectedSize}</span>}
                                        </div>
                                        <p style={{ fontWeight: 800, fontSize: 16, color: C.blue, flexShrink: 0 }}>₹{(item.qty * item.price).toLocaleString("en-IN")}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* Grid: Pricing + Delivery */}
                <div className="od-anim od-grid" style={{ animationDelay: "220ms", marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <Card>
                        <STitle icon={FaBox}>Price Summary</STitle>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted }}>
                                <span>Items Total</span>
                                <span style={{ fontWeight: 700, color: C.text }}>₹{order.items.reduce((s, i) => s + i.price * i.qty, 0).toLocaleString("en-IN")}</span>
                            </div>
                            {Number(order.platformFee) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted }}>
                                <span>Platform Fee</span>
                                <span style={{ fontWeight: 700, color: C.text }}>₹{Number(order.platformFee).toLocaleString("en-IN")}</span>
                            </div>}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted }}>
                                <span>Delivery Charge</span>
                                {Number(order.deliveryCharge) > 0 ? <span style={{ fontWeight: 700, color: C.text }}>₹{Number(order.deliveryCharge).toLocaleString("en-IN")}</span> : <span style={{ fontWeight: 700, color: C.green }}>FREE ✓</span>}
                            </div>
                            <div style={{ height: 1.5, background: C.border, margin: "8px 0" }} />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>Total Amount</span>
                                <span style={{ fontWeight: 900, fontSize: 18, color: C.blue }}>₹{Number(order.totalAmount).toLocaleString("en-IN")}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, paddingTop: 8, marginTop: 8, borderTop: `1px solid ${C.border}` }}>
                                <span>Payment Method</span>
                                <span style={{ fontWeight: 700, color: C.text }}>{isRazorpay ? "💳 Online Paid" : "💰 Cash on Delivery"}</span>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <STitle icon={FaMapMarkerAlt}>Delivery Info</STitle>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 36, height: 36, background: C.blueBg, border: `1.5px solid ${C.blueMid}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: C.blue, flexShrink: 0 }}>
                                    <FaUser size={14} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", margin: 0 }}>Customer</p>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{order.customerName}</p>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 36, height: 36, background: C.greenBg, border: `1.5px solid ${C.greenMid}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: C.green, flexShrink: 0 }}>
                                    <FaPhone size={14} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", margin: 0 }}>Phone</p>
                                    <a href={`tel:${order.phone}`} style={{ fontSize: 13, fontWeight: 700, color: C.blue, textDecoration: "none", margin: 0 }}>{order.phone}</a>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                <div style={{ width: 36, height: 36, background: C.amberBg, border: `1.5px solid ${C.amberMid}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: C.amber, flexShrink: 0, marginTop: 2 }}>
                                    <FaMapMarkerAlt size={14} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", margin: 0, marginBottom: 2 }}>Address</p>
                                    <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.4 }}>{order.address}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Live Rider Location — shows when OUT_FOR_DELIVERY via WebSocket */}
                {riderLocation && order?.orderStatus === "OUT_FOR_DELIVERY" && (
                    <div className="od-anim" style={{ animationDelay: "200ms", marginBottom: 14 }}>
                        <Card style={{ border: `1px solid ${C.blueMid}`, background: C.blueBg }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <STitle style={{ color: C.blue }}>🛵 Rider Live Location</STitle>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#dcfce7", border: "1px solid #86efac", padding: "3px 10px", borderRadius: 20, animation: "pulse 2s infinite" }}>LIVE</span>
                            </div>
                            <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}"}</style>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏍️</div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{riderLocation.riderName || "Delivery Partner"}</div>
                                    <div style={{ fontSize: 11, color: C.muted }}>
                                        {(deliveryStatus || order?.delivery?.status) === "ARRIVING_VENDOR" ? "Heading to store" :
                                            (deliveryStatus || order?.delivery?.status) === "PICKED_UP" ? "Picked up your order" :
                                                "On the way to you"}
                                    </div>
                                </div>
                            </div>

                            <LiveTrackingMap
                                riderLat={riderLocation.lat}
                                riderLng={riderLocation.lng}
                                riderName={riderLocation.riderName || "Delivery Partner"}
                                destLat={order?.latitude}
                                destLng={order?.longitude}
                                destLabel={order?.address || "Delivery Address"}
                                height="clamp(180px, 30vw, 240px)"
                                lastUpdated={riderLocation.at}
                            />

                            <div style={{ marginTop: 10, fontSize: 11, color: C.muted, textAlign: "center" }}>
                                Last updated: {riderLocation.at ? new Date(riderLocation.at).toLocaleTimeString("en-IN") : "Just now"}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Delivery Status Tracker — granular rider progress */}
                {order?.delivery?.assignedTo && ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(order?.orderStatus) && (() => {
                    const ds = deliveryStatus || order?.delivery?.status;
                    const steps = [
                        { key: "ASSIGNED", label: "Rider Assigned", icon: "✓" },
                        { key: "ARRIVING_VENDOR", label: "Heading to Store", icon: "🏪" },
                        { key: "PICKED_UP", label: "Order Picked Up", icon: "📦" },
                        { key: "OUT_FOR_DELIVERY", label: "On the Way", icon: "🛵" },
                    ];
                    const currentIdx = steps.findIndex(s => s.key === ds);
                    return (
                        <div className="od-anim" style={{ animationDelay: "220ms", marginBottom: 14 }}>
                            <Card>
                                <STitle>Delivery Progress</STitle>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {steps.map((step, i) => (
                                        <div key={step.key} style={{
                                            flex: 1, minWidth: 70, padding: "8px 6px", textAlign: "center",
                                            background: i < currentIdx ? "#d1fae5" : i === currentIdx ? C.blueBg : "#f8fafc",
                                            border: `1px solid ${i === currentIdx ? C.blue : i < currentIdx ? "#86efac" : C.border}`,
                                            borderRadius: 8, fontSize: 10, fontWeight: 700,
                                            color: i < currentIdx ? "#065f46" : i === currentIdx ? C.blue : C.hint,
                                        }}>
                                            <div style={{ fontSize: 16, marginBottom: 2 }}>{step.icon}</div>
                                            {step.label}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    );
                })()}

                {/* Rider contact info when OUT_FOR_DELIVERY */}
                {order?.orderStatus === "OUT_FOR_DELIVERY" && order?.delivery?.riderPhone && (
                    <div style={{ marginBottom: 14 }}>
                        <Card style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 2 }}>Your Delivery Partner</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{order.delivery.riderName}</div>
                                </div>
                                <a
                                    href={`tel:${order.delivery.riderPhone}`}
                                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#16a34a", border: "none", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none" }}
                                >
                                    📞 Call Rider
                                </a>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Cancel */}
                {canCancel && (
                    <div className="od-anim" style={{ animationDelay: "240ms", marginBottom: 14 }}>
                        <Card style={{ border: "1px solid #fecaca" }}>
                            <STitle>Cancel Order</STitle>
                            <p style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>You can cancel this order since it hasn't been packed yet.{isRazorpay && isPaid && <span style={{ display: "block", marginTop: 6, color: C.amber, fontWeight: 600, fontSize: 12 }}>⚡ Refund will be automatically requested after cancellation.</span>}</p>
                            {cancelError && <p style={{ color: C.red, fontSize: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{cancelError}</p>}
                            {confirmCancel ? (
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={handleCancel} disabled={cancelling} className="od-btn" style={{ flex: 1, padding: "12px", background: C.red, color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                        {cancelling ? <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "od-spin 0.8s linear infinite", display: "inline-block" }} />Cancelling...</> : "Yes, Cancel Order"}
                                    </button>
                                    <button onClick={() => { setConfirmCancel(false); setCancelError(""); }} className="od-btn" style={{ flex: 1, padding: "12px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Keep Order</button>
                                </div>
                            ) : (
                                <button onClick={() => setConfirmCancel(true)} className="od-btn" style={{ width: "100%", padding: "12px", background: "transparent", border: "2px solid #fecaca", color: C.red, borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Cancel Order</button>
                            )}
                        </Card>
                    </div>
                )}

                {/* Refund */}
                {canRequestRefund && (
                    <div className="od-anim" style={{ animationDelay: "270ms", marginBottom: 14 }}>
                        <Card style={{ border: `1px solid ${C.blueMid}` }}>
                            <STitle>Request Refund</STitle>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: C.blueBg, border: `1px solid ${C.blueMid}`, borderRadius: 10, padding: "11px 14px", marginBottom: 14 }}>
                                <FaInfoCircle size={12} color={C.blue} style={{ marginTop: 1, flexShrink: 0 }} />
                                <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Your payment of <b style={{ color: C.blue }}>₹{Number(order.totalAmount).toLocaleString("en-IN")}</b> will be refunded within <b style={{ color: C.blue }}>5-7 business days</b> after admin approval.</p>
                            </div>
                            {refundError && <p style={{ color: C.red, fontSize: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{refundError}</p>}
                            {showRefundForm ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Reason for refund (optional)..." rows={3} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.text, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} />
                                    <div style={{ display: "flex", gap: 10 }}>
                                        <button onClick={handleRefundRequest} disabled={requestingRefund} className="od-btn" style={{ flex: 1, padding: "12px", background: C.blue, color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                            {requestingRefund ? <><FaSpinner size={11} style={{ animation: "od-spin 0.8s linear infinite" }} />Submitting...</> : <><FaUndo size={11} />Submit Request</>}
                                        </button>
                                        <button onClick={() => { setShowRefundForm(false); setRefundError(""); }} className="od-btn" style={{ padding: "12px 20px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setShowRefundForm(true)} className="od-btn" style={{ width: "100%", padding: "12px", background: "transparent", border: `2px solid ${C.blueMid}`, color: C.blue, borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                    <FaUndo size={11} /> Request Refund
                                </button>
                            )}
                        </Card>
                    </div>
                )}

                {/* CTA */}
                <div className="od-anim" style={{ animationDelay: "340ms" }}>
                    <Link to="/" className="od-btn" style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                        width: "100%", padding: "16px", background: C.blue, color: "#fff",
                        borderRadius: 14, fontWeight: 700, fontSize: 15, textDecoration: "none",
                        boxShadow: `0 8px 20px ${C.blue}30`, transition: "all 0.3s"
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                        <FaShoppingBag size={16} /> Continue Shopping
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default OrderDetails;