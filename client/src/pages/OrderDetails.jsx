/**
 * OrderDetails.jsx — Production Grade v4
 * ✅ Dual-mode: Ecommerce + Urbexon Hour
 * ✅ All order data: coupon, invoice#, timestamps, return, email, payment details
 * ✅ Responsive, accessible, premium animations
 * ✅ Live rider tracking + OTP + Shiprocket
 */

import { useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { useAuth } from "../contexts/AuthContext";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import SEO from "../components/SEO";
import {
    FaArrowLeft, FaBoxOpen, FaMapMarkerAlt, FaPhone, FaUser,
    FaShoppingBag, FaTimesCircle, FaGift, FaUndo, FaInfoCircle,
    FaSpinner, FaFileInvoice, FaCheckCircle, FaTruck, FaExternalLinkAlt,
    FaClock, FaBox, FaTruckMoving, FaHome, FaRupeeSign, FaEnvelope,
} from "react-icons/fa";
import LiveTrackingMap from "../components/LiveTrackingMap";

/* ─── Design Tokens ─────────────────────────────── */
const C = {
    bg: "#f8fafc", white: "#ffffff", border: "#e2e8f0", borderLight: "#f1f5f9",
    blue: "#2563eb", blueBg: "#eff6ff", blueMid: "#dbeafe",
    text: "#0f172a", sub: "#334155", muted: "#64748b", hint: "#94a3b8",
    green: "#10b981", greenBg: "#f0fdf4", greenMid: "#d1fae5",
    red: "#ef4444", redBg: "#fef2f2", redMid: "#fecaca",
    amber: "#f59e0b", amberBg: "#fffbeb", amberMid: "#fde68a",
    sky: "#0ea5e9", violet: "#7c3aed", violetBg: "#f5f3ff", violetMid: "#ede9fe",
    orange: "#f97316", orangeBg: "#fff7ed",
    shadow: "0 1px 3px rgba(0,0,0,.05)",
    shadowMd: "0 4px 12px rgba(0,0,0,.06)",
};

const STATUS = {
    PLACED: { label: "Order Placed", color: C.amber, bg: C.amberBg, icon: FaBox },
    CONFIRMED: { label: "Confirmed", color: C.blue, bg: C.blueBg, icon: FaCheckCircle },
    PACKED: { label: "Packed", color: C.violet, bg: C.violetBg, icon: FaBoxOpen },
    READY_FOR_PICKUP: { label: "Ready for Pickup", color: C.sky, bg: "#f0f9ff", icon: FaTruck },
    SHIPPED: { label: "Shipped", color: C.sky, bg: "#f0f9ff", icon: FaTruckMoving },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", color: C.orange, bg: C.orangeBg, icon: FaTruck },
    DELIVERED: { label: "Delivered", color: C.green, bg: C.greenBg, icon: FaHome },
    CANCELLED: { label: "Cancelled", color: C.red, bg: C.redBg, icon: FaTimesCircle },
    RETURN_REQUESTED: { label: "Return Requested", color: C.amber, bg: C.amberBg, icon: FaUndo },
    RETURN_APPROVED: { label: "Return Approved", color: C.green, bg: C.greenBg, icon: FaUndo },
    REPLACEMENT_REQUESTED: { label: "Replacement Requested", color: C.amber, bg: C.amberBg, icon: FaBox },
    REPLACEMENT_APPROVED: { label: "Replacement Approved", color: C.blue, bg: C.blueBg, icon: FaBox },
};

const REFUND_CFG = {
    REQUESTED: { label: "Refund Requested", color: C.amber, desc: "Under review — 1-2 business days." },
    PROCESSING: { label: "Refund Processing", color: C.blue, desc: "Being processed — please wait 24-48 hours." },
    PROCESSED: { label: "Refund Processed", color: C.green, desc: "Amount will reflect within 5-7 business days." },
    FAILED: { label: "Refund Failed", color: C.red, desc: "Issue encountered. Admin will retry." },
    REJECTED: { label: "Refund Rejected", color: C.red, desc: null },
};

const ECOM_FLOW = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const UH_RIDER_FLOW = ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const UH_SELF_FLOW = ["PLACED", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];
const CANCELLABLE = ["PLACED", "CONFIRMED"];

const getImg = (item) => item.images?.[0]?.url || item.image || null;
const inr = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

/* ─── Reusable ─────────────────────────────── */
const Card = ({ children, style, accent }) => (
    <div style={{ background: C.white, border: `1px solid ${accent || C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: C.shadow, ...style }}>{children}</div>
);
const Heading = ({ children, icon: Icon, color }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {Icon && <Icon size={14} color={color || C.blue} />}
        <h3 style={{ fontSize: 12, fontWeight: 800, color: C.sub, margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>{children}</h3>
    </div>
);
const Row = ({ label, value, bold, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: C.muted, padding: "5px 0" }}>
        <span>{label}</span>
        <span style={{ fontWeight: bold ? 700 : 600, color: color || C.text }}>{value}</span>
    </div>
);

/* ─── Shiprocket Tracking ───────────────────────── */
const ShiprocketCard = ({ orderId, shipping }) => {
    const [tracking, setTracking] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    if (!shipping?.awbCode) return null;
    const isMock = shipping.mock;

    const fetchTracking = async () => {
        try { setLoading(true); setErr(""); const { data } = await api.get(`/shiprocket/track/${orderId}`); setTracking(data); }
        catch (e) { setErr(e.response?.data?.message || "Tracking unavailable."); }
        finally { setLoading(false); }
    };

    return (
        <Card accent={C.blueMid} style={{ background: C.blueBg }}>
            <Heading icon={FaTruckMoving}>Shipment Tracking</Heading>
            {isMock && <div style={{ background: C.amberBg, border: `1px solid ${C.amberMid}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#92400e" }}>🔧 <b>Test shipment</b> — live tracking activates once Shiprocket is connected.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
                {[{ l: "AWB", v: shipping.awbCode, m: true }, { l: "Courier", v: shipping.courierName || "Standard" }, { l: "Shipment", v: shipping.shipmentId, m: true }].map(({ l, v, m }) => (
                    <div key={l} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px" }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: C.hint, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2, margin: 0 }}>{l}</p>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: m ? "'Courier New',monospace" : "inherit", wordBreak: "break-all", margin: 0 }}>{v || "—"}</p>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!isMock && <button onClick={fetchTracking} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: C.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {loading ? <FaSpinner size={10} className="od-spin" /> : <FaTruck size={10} />} {loading ? "Fetching…" : "Get Live Status"}
                </button>}
                {!isMock && shipping.trackingUrl && <a href={shipping.trackingUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: C.white, border: `1px solid ${C.border}`, color: C.blue, borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}><FaExternalLinkAlt size={9} /> Track</a>}
            </div>
            {err && <p style={{ fontSize: 12, color: C.red, background: C.redBg, padding: "8px 12px", borderRadius: 8, marginTop: 10 }}>{err}</p>}
            {tracking && !isMock && (
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>Current Status</p>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.sky, background: "#f0f9ff", border: "1px solid #bae6fd", padding: "2px 10px", borderRadius: 20 }}>{tracking.label || tracking.status}</span>
                    </div>
                    {tracking.activities?.slice(0, 5).map((act, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0" }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: i === 0 ? C.blue : C.border, marginTop: 5, flexShrink: 0 }} />
                            <div>
                                <p style={{ fontSize: 12, color: C.sub, fontWeight: i === 0 ? 600 : 400, margin: 0 }}>{act.activity}</p>
                                <p style={{ fontSize: 10, color: C.hint, margin: 0 }}>{act.location && `${act.location} · `}{fmtDate(act.date)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};

/* ═══════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════ */
const OrderDetails = () => {
    const { id } = useParams();
    const { token: authToken } = useAuth();

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
    const [showReturnForm, setShowReturnForm] = useState(false);
    const [returnReason, setReturnReason] = useState("");
    const [requestingReturn, setRequestingReturn] = useState(false);
    const [returnError, setReturnError] = useState("");
    const [showReplacementForm, setShowReplacementForm] = useState(false);
    const [replacementReason, setReplacementReason] = useState("");
    const [requestingReplacement, setRequestingReplacement] = useState(false);
    const [replacementError, setReplacementError] = useState("");
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [riderLocation, setRiderLocation] = useState(null);
    const [deliveryStatus, setDeliveryStatus] = useState(null);
    const [deliveryOtp, setDeliveryOtp] = useState(null);

    /* ── WebSocket ── */
    const { send: wsSend } = useWebSocket(authToken, {
        onMessage: (msg) => {
            const p = msg.payload;
            if ((msg.type === "order_status_updated" || msg.type === "order_status") && p?.orderId === id) {
                if (p.status) setOrder(prev => prev ? { ...prev, orderStatus: p.status } : prev);
                if (p.otp) setDeliveryOtp(p.otp);
            }
            if (msg.type === "rider_location" && p?.orderId === id) setRiderLocation({ lat: p.lat, lng: p.lng, riderName: p.riderName, at: p.at });
            if (msg.type === "delivery:status_update" && p?.orderId === id) setDeliveryStatus(p.status);
        },
        onConnect: () => { if (id) wsSend("join_room", { room: `order:${id}` }); },
    });

    /* ── Polling fallback ── */
    useEffect(() => {
        if (order?.orderStatus !== "OUT_FOR_DELIVERY" || riderLocation) return;
        const poll = async () => { try { const { data } = await api.get(`/delivery/orders/${id}/rider-location`); if (data.available && data.rider?.lat) setRiderLocation({ lat: data.rider.lat, lng: data.rider.lng, riderName: data.rider.name, at: data.rider.updatedAt }); } catch { } };
        poll(); const t = setInterval(poll, 15000); return () => clearInterval(t);
    }, [order?.orderStatus, id, riderLocation]);

    useOrderRealtime({ enabled: !!authToken, onStatusUpdate: (p) => { if (p?.orderId === id) setOrder(prev => prev ? { ...prev, orderStatus: p.status } : prev); } });

    useEffect(() => { if (!id) return; (async () => { try { setLoading(true); const { data } = await api.get(`/orders/${id}`); setOrder(data); if (data.deliveryOtp?.code) setDeliveryOtp(data.deliveryOtp.code); } catch { setError("Order not found."); } finally { setLoading(false); } })(); }, [id]);

    const handleCancel = async () => { try { setCancelling(true); setCancelError(""); const { data } = await api.patch(`/orders/${id}/cancel`); setOrder(data.order); setConfirmCancel(false); } catch (e) { setCancelError(e.response?.data?.message || "Failed to cancel"); } finally { setCancelling(false); } };
    const handleRefund = async () => { try { setRequestingRefund(true); setRefundError(""); const { data } = await api.post(`/payment/refund/${id}`, { reason: refundReason || "Requested by customer" }); setOrder(p => ({ ...p, refund: data.refund })); setShowRefundForm(false); } catch (e) { setRefundError(e.response?.data?.message || "Refund failed"); } finally { setRequestingRefund(false); } };
    const handleReturnRequest = async () => { try { setRequestingReturn(true); setReturnError(""); const { data } = await api.put(`/orders/${id}/return/request`, { reason: returnReason }); setOrder(p => ({ ...p, return: data.return, orderStatus: "RETURN_REQUESTED" })); setShowReturnForm(false); } catch (e) { setReturnError(e.response?.data?.message || "Return request failed"); } finally { setRequestingReturn(false); } };
    const handleReplacementRequest = async () => { try { setRequestingReplacement(true); setReplacementError(""); const { data } = await api.put(`/orders/${id}/replacement/request`, { reason: replacementReason }); setOrder(p => ({ ...p, replacement: data.replacement, orderStatus: "REPLACEMENT_REQUESTED" })); setShowReplacementForm(false); } catch (e) { setReplacementError(e.response?.data?.message || "Replacement request failed"); } finally { setRequestingReplacement(false); } };
    const handleDownload = async () => {
        try { setDownloadingInvoice(true); const res = await api.get(`/invoice/${id}/download`, { responseType: "blob" }); const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" })); const a = document.createElement("a"); a.href = url; a.setAttribute("download", order?.invoiceNumber ? `${order.invoiceNumber}.pdf` : `Urbexon_Invoice_${id.slice(-8).toUpperCase()}.pdf`); document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); }
        catch (e) { alert(e.response?.status === 403 ? "Access denied." : e.response?.status === 404 ? "Invoice not found." : "Download failed."); }
        finally { setDownloadingInvoice(false); }
    };

    /* ── Loading ── */
    if (loading) return (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif" }}>
            <style>{`@keyframes od-spin{to{transform:rotate(360deg)}}.od-spin{animation:od-spin .8s linear infinite}`}</style>
            <div style={{ textAlign: "center" }}>
                <div style={{ width: 40, height: 40, border: `3px solid ${C.blueMid}`, borderTopColor: C.blue, borderRadius: "50%", animation: "od-spin .8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ color: C.muted, fontSize: 14 }}>Loading order…</p>
            </div>
        </div>
    );
    if (!order) return (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter',sans-serif" }}>
            <FaBoxOpen size={44} color={C.hint} style={{ marginBottom: 18 }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Order Not Found</h2>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 22 }}>{error}</p>
            <Link to="/orders" style={{ padding: "10px 22px", background: C.blue, color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}><FaArrowLeft size={11} style={{ marginRight: 6 }} />Back to Orders</Link>
        </div>
    );

    /* ── Derived ── */
    const isUH = order.orderMode === "URBEXON_HOUR";
    const isVendorSelfDelivery = isUH && order.delivery?.provider === "VENDOR_SELF";
    const cfg = STATUS[order.orderStatus] || STATUS.PLACED;
    const flow = isUH ? (isVendorSelfDelivery ? UH_SELF_FLOW : UH_RIDER_FLOW) : ECOM_FLOW;
    const stepIdx = flow.indexOf(order.orderStatus);
    const isCancelled = order.orderStatus === "CANCELLED";
    const isDelivered = order.orderStatus === "DELIVERED";
    const pi = order.policyInfo || {};
    const canCancel = pi.canCancel ?? CANCELLABLE.includes(order.orderStatus);
    const isRazorpay = order.payment?.method === "RAZORPAY";
    const isPaid = order.payment?.status === "PAID";
    const refund = order.refund?.status && order.refund.status !== "NONE" ? REFUND_CFG[order.refund.status] : null;
    const canRefund = isCancelled && isRazorpay && isPaid && !refund;
    const canReturn = pi.canReturn ?? (isDelivered && (!order.return?.status || order.return.status === "NONE"));
    const canReplace = pi.canReplace ?? false;
    const hasShipping = !!order.shipping?.awbCode;
    const showInvoice = isDelivered || (isPaid && !isCancelled);
    const itemsTotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
    const couponDisc = order.coupon?.discount || 0;
    const accent = isUH ? C.violet : C.blue;
    const tl = order.statusTimeline || {};
    const timeline = [
        tl.placedAt && { l: "Placed", t: tl.placedAt },
        tl.confirmedAt && { l: "Confirmed", t: tl.confirmedAt },
        tl.packedAt && { l: "Packed", t: tl.packedAt },
        isUH && tl.readyForPickupAt && { l: "Ready", t: tl.readyForPickupAt },
        !isUH && tl.shippedAt && { l: "Shipped", t: tl.shippedAt },
        tl.outForDeliveryAt && { l: "Out for Delivery", t: tl.outForDeliveryAt },
        tl.deliveredAt && { l: "Delivered", t: tl.deliveredAt },
        tl.cancelledAt && { l: "Cancelled", t: tl.cancelledAt },
    ].filter(Boolean);

    return (
        <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter','DM Sans',-apple-system,sans-serif", color: C.text }}>
            <SEO title="Order Details" noindex />
            <style>{`
                @keyframes od-spin{to{transform:rotate(360deg)}}.od-spin{animation:od-spin .8s linear infinite}
                @keyframes od-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
                .od-f{animation:od-in .35s ease both}
                .od-btn{transition:all .15s;cursor:pointer}.od-btn:hover{transform:translateY(-1px);box-shadow:${C.shadowMd}}.od-btn:active{transform:scale(.98)}
                .od-back{text-decoration:none;display:inline-flex;align-items:center;gap:6px;color:${C.muted};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;transition:color .15s}.od-back:hover{color:${accent}}
                @media(max-width:640px){.od-g2{grid-template-columns:1fr!important}}
            `}</style>

            <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px clamp(14px, 4vw, 20px) 60px" }}>

                {/* Back */}
                <div className="od-f" style={{ marginBottom: 22 }}>
                    <Link to="/orders" className="od-back"><FaArrowLeft size={10} /> Back to Orders</Link>
                </div>

                {/* Header */}
                <div className="od-f" style={{ animationDelay: "30ms", marginBottom: 22 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <h1 style={{ fontSize: "clamp(22px, 5vw, 28px)", fontWeight: 800, margin: 0 }}>Order #{order._id.slice(-8).toUpperCase()}</h1>
                                {isUH && <span style={{ fontSize: 10, fontWeight: 800, color: C.violet, background: C.violetBg, border: `1px solid ${C.violetMid}`, padding: "2px 8px", borderRadius: 6 }}>⚡ HOUR</span>}
                            </div>
                            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                                {new Date(order.createdAt).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {order.invoiceNumber && <p style={{ fontSize: 11, color: C.hint, marginTop: 3, fontFamily: "'Courier New',monospace", margin: 0 }}>Invoice: {order.invoiceNumber}</p>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: cfg.bg, border: `1.5px solid ${cfg.color}25` }}>
                            <cfg.icon size={14} color={cfg.color} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                        </div>
                    </div>
                    {showInvoice && (
                        <div style={{ marginTop: 12 }}>
                            <button onClick={handleDownload} disabled={downloadingInvoice} className="od-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: C.white, border: `1.5px solid ${C.border}`, color: accent, borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                                {downloadingInvoice ? <FaSpinner size={11} className="od-spin" /> : <FaFileInvoice size={11} />} {downloadingInvoice ? "Downloading…" : "Download Invoice"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Cancelled */}
                {isCancelled && (
                    <div className="od-f" style={{ animationDelay: "50ms", marginBottom: 14 }}>
                        <Card accent={C.redMid} style={{ background: C.redBg }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 38, height: 38, background: C.redMid, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaTimesCircle size={16} color={C.red} /></div>
                                <div>
                                    <p style={{ fontWeight: 700, color: C.red, fontSize: 14, margin: 0, marginBottom: 2 }}>Order Cancelled</p>
                                    <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>{order.cancellationReason || "This order was cancelled."}</p>
                                    {tl.cancelledAt && <p style={{ fontSize: 11, color: C.hint, margin: 0, marginTop: 3 }}>on {fmtDate(tl.cancelledAt)}</p>}
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Refund status */}
                {refund && (
                    <div className="od-f" style={{ animationDelay: "60ms", marginBottom: 14 }}>
                        <Card accent={`${refund.color}40`}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                <FaUndo size={16} color={refund.color} style={{ marginTop: 2, flexShrink: 0 }} />
                                <div>
                                    <p style={{ fontWeight: 700, color: refund.color, fontSize: 14, margin: 0, marginBottom: 4 }}>{refund.label}</p>
                                    {refund.desc && <p style={{ fontSize: 12, color: C.muted, margin: 0, marginBottom: 4 }}>{refund.desc}</p>}
                                    {order.refund?.amount && <p style={{ fontSize: 14, fontWeight: 800, color: C.green, margin: 0 }}>₹{inr(order.refund.amount)}</p>}
                                    {order.refund?.rejectionReason && <p style={{ fontSize: 12, color: C.red, margin: 0, marginTop: 4 }}>Reason: {order.refund.rejectionReason}</p>}
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Tracking */}
                {!isCancelled && stepIdx >= 0 && (
                    <div className="od-f" style={{ animationDelay: "70ms", marginBottom: 14 }}>
                        <Card accent={`${accent}30`}>
                            <Heading icon={FaClock} color={accent}>Order Tracking</Heading>
                            <div style={{ position: "relative", marginBottom: 18 }}>
                                <div style={{ position: "absolute", left: "5%", right: "5%", top: 16, height: 3, background: C.borderLight, borderRadius: 2 }} />
                                <div style={{ position: "absolute", left: "5%", top: 16, height: 3, background: accent, borderRadius: 2, width: stepIdx > 0 ? `${(stepIdx / (flow.length - 1)) * 90}%` : "0%", transition: "width .6s ease" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
                                    {flow.map((step, i) => {
                                        const done = i <= stepIdx, active = i === stepIdx;
                                        const Icon = STATUS[step]?.icon || FaBox;
                                        return (
                                            <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                                                <div style={{ width: 34, height: 34, borderRadius: "50%", background: done ? (active ? accent : `${accent}18`) : C.borderLight, border: `2px solid ${done ? accent : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 0 0 5px ${accent}12` : "none", transition: "all .3s" }}>
                                                    {i < stepIdx ? <FaCheckCircle size={13} color={accent} /> : <Icon size={12} color={done ? "#fff" : C.hint} />}
                                                </div>
                                                <p style={{
                                                    fontSize: 9, fontWeight: done ? 700 : 500, color: done ? accent : C.hint, textAlign: "center", marginTop: 5, textTransform: "uppercase", letterSpacing: ".03em", maxWidth: 52, lineHeight: 1.25, marginTop: 5
                                                }}>{STATUS[step]?.label}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={{ padding: "9px 12px", background: cfg.bg, border: `1px solid ${cfg.color}20`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color }} />
                                <p style={{ fontSize: 13, fontWeight: 600, color: cfg.color, margin: 0 }}>
                                    {isDelivered ? "✓ Delivered Successfully" : order.orderStatus === "OUT_FOR_DELIVERY" ? "🛵 On the way" : cfg.label}
                                </p>
                            </div>
                            {timeline.length > 0 && (
                                <div style={{ marginTop: 12, borderTop: `1px solid ${C.borderLight}`, paddingTop: 10, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                                    {timeline.map((e, i) => <span key={i} style={{ fontSize: 11, color: C.muted }}><b style={{ color: C.sub }}>{e.l}:</b> {fmtDate(e.t)}</span>)}
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {/* Shiprocket (ecom) */}
                {!isUH && hasShipping && !isCancelled && <div className="od-f" style={{ animationDelay: "85ms", marginBottom: 14 }}><ShiprocketCard orderId={id} shipping={order.shipping} /></div>}

                {/* UH Express */}
                {isUH && !isCancelled && (
                    <div className="od-f" style={{ animationDelay: "85ms", marginBottom: 14 }}>
                        <Card accent={C.violetMid} style={{ background: C.violetBg }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 34, height: 34, background: C.violetMid, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚡</div>
                                <div>
                                    <p style={{ fontWeight: 800, fontSize: 14, color: C.violet, margin: 0 }}>Urbexon Hour Express</p>
                                    <p style={{ fontSize: 12, color: "#7c3aed", margin: 0 }}>Est: {order.delivery?.eta ? `${order.delivery.eta} min` : "45-120 min"}</p>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                                {[
                                    { l: "Delivery", v: order.delivery?.provider === "LOCAL_RIDER" ? "Local Rider" : order.delivery?.provider === "VENDOR_SELF" ? "Vendor" : "Express" },
                                    { l: "Distance", v: order.delivery?.distanceKm ? `${order.delivery.distanceKm.toFixed(1)} km` : "—" },
                                    { l: "ETA", v: order.delivery?.eta ? `${order.delivery.eta} min` : "45-120 min" },
                                ].map(({ l, v }) => (
                                    <div key={l} style={{ background: C.white, border: `1px solid ${C.violetMid}`, borderRadius: 8, padding: "8px", textAlign: "center" }}>
                                        <p style={{ fontSize: 9, fontWeight: 700, color: C.hint, textTransform: "uppercase", margin: 0, marginBottom: 2 }}>{l}</p>
                                        <p style={{ fontSize: 13, fontWeight: 800, color: C.violet, margin: 0 }}>{v}</p>
                                    </div>
                                ))}
                            </div>
                            {order.delivery?.riderName && (
                                <div style={{ marginTop: 10, padding: "8px 12px", background: C.white, borderRadius: 8, border: `1px solid ${C.violetMid}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div><p style={{ fontSize: 11, color: C.hint, margin: 0 }}>Delivery Partner</p><p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{order.delivery.riderName}</p></div>
                                    {order.delivery.riderPhone && <a href={`tel:${order.delivery.riderPhone}`} style={{ padding: "6px 14px", background: C.green, color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📞 Call</a>}
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {/* OTP */}
                {order.orderStatus === "OUT_FOR_DELIVERY" && deliveryOtp && (
                    <div className="od-f" style={{ animationDelay: "95ms", marginBottom: 14 }}>
                        <Card accent={C.amberMid} style={{ background: C.amberBg, textAlign: "center", padding: "20px" }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: ".06em", margin: 0, marginBottom: 6 }}>🔐 Delivery OTP</p>
                            <div style={{ fontSize: "clamp(26px,7vw,36px)", fontWeight: 900, color: C.text, letterSpacing: ".2em", fontFamily: "'Courier New',monospace" }}>{deliveryOtp}</div>
                            <p style={{ fontSize: 12, color: "#78350f", maxWidth: 300, margin: "8px auto 0", lineHeight: 1.4 }}>Share <strong>only after receiving</strong> your order.</p>
                        </Card>
                    </div>
                )}

                {/* Live Map */}
                {riderLocation && order.orderStatus === "OUT_FOR_DELIVERY" && (
                    <div className="od-f" style={{ animationDelay: "100ms", marginBottom: 14 }}>
                        <Card accent={C.blueMid} style={{ background: C.blueBg }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <Heading icon={FaTruck}>Live Location</Heading>
                                <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenBg, border: `1px solid ${C.greenMid}`, padding: "2px 8px", borderRadius: 20 }}>● LIVE</span>
                            </div>
                            <LiveTrackingMap riderLat={riderLocation.lat} riderLng={riderLocation.lng} riderName={riderLocation.riderName || "Partner"} destLat={order.latitude} destLng={order.longitude} destLabel={order.address || "Address"} height="clamp(170px,28vw,220px)" lastUpdated={riderLocation.at} />
                            <p style={{
                                fontSize: 10, color: C.hint, textAlign: "center", margin: 0, marginTop: 6
                            }}>Updated: {riderLocation.at ? new Date(riderLocation.at).toLocaleTimeString("en-IN") : "Just now"}</p>
                        </Card>
                    </div>
                )}

                {/* Delivery progress (UH rider steps) */}
                {order.delivery?.assignedTo && ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(order.orderStatus) && (() => {
                    const ds = deliveryStatus || order.delivery?.status;
                    const steps = [{ k: "ASSIGNED", l: "Assigned", e: "✓" }, { k: "ARRIVING_VENDOR", l: "To Store", e: "🏪" }, { k: "PICKED_UP", l: "Picked Up", e: "📦" }, { k: "OUT_FOR_DELIVERY", l: "On Way", e: "🛵" }];
                    const ci = steps.findIndex(s => s.k === ds);
                    return (
                        <div className="od-f" style={{ animationDelay: "105ms", marginBottom: 14 }}>
                            <Card><Heading>Delivery Progress</Heading>
                                <div style={{ display: "flex", gap: 4 }}>
                                    {steps.map((s, i) => <div key={s.k} style={{ flex: 1, padding: "7px 4px", textAlign: "center", background: i < ci ? C.greenBg : i === ci ? C.blueBg : C.bg, border: `1px solid ${i === ci ? C.blue : i < ci ? C.greenMid : C.border}`, borderRadius: 8, fontSize: 10, fontWeight: 700, color: i < ci ? C.green : i === ci ? C.blue : C.hint }}><div style={{ fontSize: 14, marginBottom: 2 }}>{s.e}</div>{s.l}</div>)}
                                </div>
                            </Card>
                        </div>
                    );
                })()}

                {/* Rider contact */}
                {order.orderStatus === "OUT_FOR_DELIVERY" && order.delivery?.riderPhone && !isUH && (
                    <div className="od-f" style={{ animationDelay: "110ms", marginBottom: 14 }}>
                        <Card style={{ background: C.greenBg, border: `1px solid ${C.greenMid}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                <div><p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", margin: 0, marginBottom: 2 }}>Delivery Partner</p><p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{order.delivery.riderName}</p></div>
                                <a href={`tel:${order.delivery.riderPhone}`} style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>📞 Call</a>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Items */}
                <div className="od-f" style={{ animationDelay: "120ms", marginBottom: 14 }}>
                    <Card>
                        <Heading icon={FaShoppingBag}>Ordered Items ({order.items.length})</Heading>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {order.items.map((item, i) => {
                                const img = getImg(item);
                                return (
                                    <div key={i} style={{ display: "flex", gap: 12, padding: 12, background: C.bg, borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
                                        <div style={{ width: 56, height: 56, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {img ? <img src={img} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }} loading="lazy" /> : <FaGift size={16} color={C.hint} />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontWeight: 700, fontSize: 13, margin: 0, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                                            <p style={{ fontSize: 12, color: C.muted, margin: 0, marginBottom: 4 }}>Qty: {item.qty} × ₹{inr(item.price)}</p>
                                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                {item.selectedSize && <span style={{ fontSize: 10, fontWeight: 700, background: C.amberBg, color: C.amber, padding: "1px 7px", borderRadius: 4, border: `1px solid ${C.amberMid}` }}>Size: {item.selectedSize}</span>}
                                                {item.customization?.text && <span style={{ fontSize: 10, fontWeight: 600, background: C.blueBg, color: C.blue, padding: "1px 7px", borderRadius: 4 }}>✏️ {item.customization.text}</span>}
                                                {item.customization?.note && <span style={{ fontSize: 10, fontWeight: 600, background: C.borderLight, color: C.sub, padding: "1px 7px", borderRadius: 4 }}>📝 {item.customization.note}</span>}
                                                {item.policy?.isReturnable === false && <span style={{ fontSize: 10, fontWeight: 700, background: C.redBg, color: C.red, padding: "1px 7px", borderRadius: 4, border: `1px solid ${C.redMid}` }}>Non-Returnable</span>}
                                                {item.policy?.isReturnable !== false && <span style={{ fontSize: 10, fontWeight: 700, background: C.greenBg, color: C.green, padding: "1px 7px", borderRadius: 4, border: `1px solid ${C.greenMid}` }}>{item.policy?.returnWindow || 7}-Day Return</span>}
                                                {item.policy?.isReplaceable && <span style={{ fontSize: 10, fontWeight: 700, background: C.blueBg, color: C.blue, padding: "1px 7px", borderRadius: 4, border: `1px solid ${C.blueMid}` }}>{item.policy?.replacementWindow || 7}-Day Replacement</span>}
                                                {item.policy?.isCancellable === false && <span style={{ fontSize: 10, fontWeight: 700, background: C.redBg, color: C.red, padding: "1px 7px", borderRadius: 4, border: `1px solid ${C.redMid}` }}>Non-Cancellable</span>}
                                            </div>
                                        </div>
                                        <p style={{ fontWeight: 800, fontSize: 14, color: accent, flexShrink: 0, margin: 0, alignSelf: "center" }}>₹{inr(item.qty * item.price)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* Price + Delivery Grid */}
                <div className="od-f od-g2" style={{ animationDelay: "140ms", marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Card>
                        <Heading icon={FaRupeeSign}>Price Summary</Heading>
                        <Row label="Items Total" value={`₹${inr(itemsTotal)}`} />
                        {couponDisc > 0 && <Row label={`Coupon${order.coupon?.code ? ` (${order.coupon.code})` : ""}`} value={`-₹${inr(couponDisc)}`} color={C.green} bold />}
                        {Number(order.platformFee) > 0 && <Row label="Platform Fee" value={`₹${inr(order.platformFee)}`} />}
                        <Row label="Delivery" value={Number(order.deliveryCharge) > 0 ? `₹${inr(order.deliveryCharge)}` : "FREE"} color={Number(order.deliveryCharge) > 0 ? C.text : C.green} />
                        <div style={{ height: 1, background: C.border, margin: "8px 0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>Total</span>
                            <span style={{ fontWeight: 900, fontSize: 18, color: accent }}>₹{inr(order.totalAmount)}</span>
                        </div>
                        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.borderLight}` }}>
                            <Row label="Payment" value={isRazorpay ? "💳 Online" : "💰 COD"} />
                            {isPaid && <Row label="Status" value="✅ Paid" color={C.green} />}
                            {order.payment?.paidAt && <Row label="Paid" value={fmtDate(order.payment.paidAt)} />}
                        </div>
                    </Card>
                    <Card>
                        <Heading icon={FaMapMarkerAlt}>Delivery Info</Heading>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {[
                                { icon: FaUser, bg: C.blueBg, c: C.blue, l: "Customer", v: order.customerName },
                                { icon: FaPhone, bg: C.greenBg, c: C.green, l: "Phone", v: order.phone, href: `tel:${order.phone}` },
                                order.email && { icon: FaEnvelope, bg: C.violetBg, c: C.violet, l: "Email", v: order.email },
                                { icon: FaMapMarkerAlt, bg: C.amberBg, c: C.amber, l: "Address", v: order.address, multi: true },
                            ].filter(Boolean).map(({ icon: I, bg, c, l, v, href, multi }) => (
                                <div key={l} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                    <div style={{ width: 30, height: 30, background: bg, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: multi ? 1 : 0 }}><I size={11} color={c} /></div>
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: 9, fontWeight: 700, color: C.hint, textTransform: "uppercase", margin: 0, marginBottom: 1 }}>{l}</p>
                                        {href ? <a href={href} style={{ fontSize: 13, fontWeight: 700, color: C.blue, textDecoration: "none" }}>{v}</a> : <p style={{ fontSize: 12, fontWeight: multi ? 500 : 700, color: C.text, margin: 0, lineHeight: 1.4 }}>{v || "—"}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Return */}
                {order.return?.status && order.return.status !== "NONE" && (
                    <div className="od-f" style={{ animationDelay: "160ms", marginBottom: 14 }}>
                        <Card accent={C.amberMid}>
                            <Heading icon={FaUndo} color={C.amber}>Return Request</Heading>
                            <Row label="Status" value={order.return.status.replace(/_/g, " ")} bold color={order.return.status === "APPROVED" ? C.green : order.return.status === "REJECTED" ? C.red : C.amber} />
                            {order.return.reason && <Row label="Reason" value={order.return.reason} />}
                            {order.return.requestedAt && <Row label="Requested" value={fmtDate(order.return.requestedAt)} />}
                            {order.return.refundAmount && <Row label="Refund" value={`₹${inr(order.return.refundAmount)}`} bold color={C.green} />}
                            {order.return.adminNote && <p style={{ fontSize: 12, color: C.muted, background: C.bg, padding: "8px 12px", borderRadius: 8, marginTop: 8, lineHeight: 1.4 }}>Admin: {order.return.adminNote}</p>}
                        </Card>
                    </div>
                )}

                {/* Cancel */}
                {canReturn && (
                    <div className="od-f" style={{ animationDelay: "170ms", marginBottom: 14 }}>
                        <Card accent={C.amberMid}>
                            <Heading icon={FaUndo} color={C.amber}>Request Return</Heading>
                            <p style={{
                                fontSize: 12, color: C.muted, lineHeight: 1.4, margin: 0, marginBottom: 12

                            }}>
                                {pi.returnDaysRemaining != null
                                    ? `You can request a return within ${Math.ceil(pi.returnDaysRemaining)} day${Math.ceil(pi.returnDaysRemaining) !== 1 ? "s" : ""} remaining (${pi.returnWindowDays}-day window).`
                                    : "You can request a return within the return window."}
                            </p>
                            {returnError && <p style={{ color: C.red, fontSize: 12, background: C.redBg, padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>{returnError}</p>}
                            {showReturnForm ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <textarea value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Why do you want to return? (required)" rows={3} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box", color: C.text }} />
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={handleReturnRequest} disabled={requestingReturn || !returnReason.trim()} className="od-btn" style={{ flex: 1, padding: 11, background: C.amber, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: !returnReason.trim() ? 0.5 : 1 }}>{requestingReturn ? "Submitting…" : "Submit Return"}</button>
                                        <button onClick={() => { setShowReturnForm(false); setReturnError(""); }} className="od-btn" style={{ padding: "11px 16px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setShowReturnForm(true)} className="od-btn" style={{ width: "100%", padding: 11, background: "transparent", border: `1.5px solid ${C.amberMid}`, color: C.amber, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}><FaUndo size={10} style={{ marginRight: 6 }} />Request Return</button>
                            )}
                        </Card>
                    </div>
                )}

                {/* Replacement Status */}
                {order.replacement?.status && order.replacement.status !== "NONE" && (
                    <div className="od-f" style={{ animationDelay: "165ms", marginBottom: 14 }}>
                        <Card accent={C.blueMid}>
                            <Heading icon={FaBox} color={C.blue}>Replacement Request</Heading>
                            <Row label="Status" value={order.replacement.status.replace(/_/g, " ")} bold color={order.replacement.status === "APPROVED" || order.replacement.status === "SHIPPED" ? C.green : order.replacement.status === "REJECTED" ? C.red : C.amber} />
                            {order.replacement.reason && <Row label="Reason" value={order.replacement.reason} />}
                            {order.replacement.requestedAt && <Row label="Requested" value={fmtDate(order.replacement.requestedAt)} />}
                            {order.replacement.trackingUrl && <Row label="Tracking" value={<a href={order.replacement.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontWeight: 700, fontSize: 12 }}>Track <FaExternalLinkAlt size={9} /></a>} />}
                            {order.replacement.adminNote && <p style={{ fontSize: 12, color: C.muted, background: C.bg, padding: "8px 12px", borderRadius: 8, marginTop: 8, lineHeight: 1.4 }}>Admin: {order.replacement.adminNote}</p>}
                        </Card>
                    </div>
                )}

                {/* Request Replacement */}
                {canReplace && (
                    <div className="od-f" style={{ animationDelay: "172ms", marginBottom: 14 }}>
                        <Card accent={C.blueMid}>
                            <Heading icon={FaBox} color={C.blue}>Request Replacement</Heading>
                            <p style={{
                                fontSize: 12, color: C.muted, lineHeight: 1.4, margin: 0, marginBottom: 12

                            }}>
                                {pi.replacementDaysRemaining != null
                                    ? `Request a replacement within ${Math.ceil(pi.replacementDaysRemaining)} day${Math.ceil(pi.replacementDaysRemaining) !== 1 ? "s" : ""} remaining (${pi.replacementWindowDays}-day window).`
                                    : "You can request a replacement for eligible items."}
                            </p>
                            {replacementError && <p style={{ color: C.red, fontSize: 12, background: C.redBg, padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>{replacementError}</p>}
                            {showReplacementForm ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <textarea value={replacementReason} onChange={e => setReplacementReason(e.target.value)} placeholder="Why do you need a replacement? (required)" rows={3} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box", color: C.text }} />
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={handleReplacementRequest} disabled={requestingReplacement || !replacementReason.trim()} className="od-btn" style={{ flex: 1, padding: 11, background: C.blue, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: !replacementReason.trim() ? 0.5 : 1 }}>{requestingReplacement ? "Submitting…" : "Submit Replacement"}</button>
                                        <button onClick={() => { setShowReplacementForm(false); setReplacementError(""); }} className="od-btn" style={{ padding: "11px 16px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setShowReplacementForm(true)} className="od-btn" style={{ width: "100%", padding: 11, background: "transparent", border: `1.5px solid ${C.blueMid}`, color: C.blue, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}><FaBox size={10} style={{ marginRight: 6 }} />Request Replacement</button>
                            )}
                        </Card>
                    </div>
                )}

                {/* Cancel */}
                {canCancel && !isCancelled && (
                    <div className="od-f" style={{ animationDelay: "180ms", marginBottom: 14 }}>
                        <Card accent={C.redMid}>
                            <Heading icon={FaTimesCircle} color={C.red}>Cancel Order</Heading>
                            <p style={{
                                fontSize: 12, color: C.muted, lineHeight: 1.4, margin: 0, marginBottom: 12

                            }}>
                                {pi.cancelWindowHours > 0
                                    ? `Cancel within ${Math.ceil(pi.cancelHoursRemaining || 0)} hour${Math.ceil(pi.cancelHoursRemaining || 0) !== 1 ? "s" : ""} remaining.`
                                    : "You can cancel since it hasn't been packed."}
                                {isRazorpay && isPaid && <span style={{ display: "block", marginTop: 4, color: C.amber, fontWeight: 600 }}>⚡ Refund will be auto-requested.</span>}
                            </p>
                            {cancelError && <p style={{ color: C.red, fontSize: 12, background: C.redBg, padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>{cancelError}</p>}
                            {confirmCancel ? (
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={handleCancel} disabled={cancelling} className="od-btn" style={{ flex: 1, padding: 11, background: C.red, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>{cancelling ? "Cancelling…" : "Yes, Cancel"}</button>
                                    <button onClick={() => { setConfirmCancel(false); setCancelError(""); }} className="od-btn" style={{ flex: 1, padding: 11, background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Keep</button>
                                </div>
                            ) : (
                                <button onClick={() => setConfirmCancel(true)} className="od-btn" style={{ width: "100%", padding: 11, background: "transparent", border: `1.5px solid ${C.redMid}`, color: C.red, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Cancel Order</button>
                            )}
                        </Card>
                    </div>
                )}

                {/* Refund */}
                {canRefund && (
                    <div className="od-f" style={{ animationDelay: "200ms", marginBottom: 14 }}>
                        <Card accent={C.blueMid}>
                            <Heading icon={FaUndo} color={C.blue}>Request Refund</Heading>
                            <div style={{ background: C.blueBg, border: `1px solid ${C.blueMid}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: C.muted, lineHeight: 1.4 }}><FaInfoCircle size={10} color={C.blue} style={{ marginRight: 4 }} />₹{inr(order.totalAmount)} refunded within 5-7 business days after approval.</div>
                            {refundError && <p style={{ color: C.red, fontSize: 12, background: C.redBg, padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>{refundError}</p>}
                            {showRefundForm ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Reason (optional)…" rows={3} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box", color: C.text }} />
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={handleRefund} disabled={requestingRefund} className="od-btn" style={{ flex: 1, padding: 11, background: C.blue, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>{requestingRefund ? "Submitting…" : "Submit"}</button>
                                        <button onClick={() => { setShowRefundForm(false); setRefundError(""); }} className="od-btn" style={{ padding: "11px 16px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setShowRefundForm(true)} className="od-btn" style={{ width: "100%", padding: 11, background: "transparent", border: `1.5px solid ${C.blueMid}`, color: C.blue, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}><FaUndo size={10} style={{ marginRight: 6 }} />Request Refund</button>
                            )}
                        </Card>
                    </div>
                )}

                {/* CTA */}
                <div className="od-f" style={{ animationDelay: "240ms" }}>
                    <Link to={isUH ? "/urbexon-hour" : "/"} className="od-btn" style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        width: "100%", padding: 14, background: accent, color: "#fff",
                        borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none",
                        boxShadow: `0 6px 16px ${accent}30`,
                    }}><FaShoppingBag size={14} /> Continue Shopping</Link>
                </div>
            </div>
        </div>
    );
};

export default OrderDetails;
