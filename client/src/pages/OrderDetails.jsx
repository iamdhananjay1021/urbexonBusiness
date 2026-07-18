/**
 * OrderDetails.jsx — Signal migration
 * Dual-mode: Ecommerce + Urbexon Hour. All WebSocket listeners, polling,
 * handlers, and derived-value logic below are byte-for-byte preserved from
 * the original — only the presentation layer (inline styles → tokens/design
 * system components) has changed.
 */

import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { useLiveTracking } from "../hooks/useLiveTracking";
import { useAuth } from "../contexts/AuthContext";
import { useParams, Link } from "react-router-dom";
import * as orderApi from "../api/orderApi";
import { getRiderLocationForOrder } from "../api/deliveryApi";
import { requestRefund } from "../api/paymentApi";
import SEO from "../components/SEO";
import {
    FiArrowLeft, FiPackage, FiMapPin, FiPhone, FiUser,
    FiShoppingBag, FiXCircle, FiGift, FiRotateCcw, FiInfo,
    FiFileText, FiCheckCircle, FiTruck, FiExternalLink,
    FiClock, FiBox, FiDollarSign, FiMail,
} from "react-icons/fi";
import LiveTrackingMap from "../components/LiveTrackingMap";
import BackButton from "../components/BackButton";
import Card from "../design-system/Card";
import Button from "../design-system/Button";
import Loader from "../design-system/Loader";
import { cn } from "../design-system/utils/cn";

/* ─── Status Config (with icons) — tokens instead of hex ────── */
const STATUS = {
    PLACED: { label: "Order Placed", color: "text-[var(--color-warning-700)]", bg: "bg-warning-tint", dot: "bg-[var(--color-warning-500)]", icon: FiShoppingBag },
    CONFIRMED: { label: "Confirmed", color: "text-info", bg: "bg-info-tint", dot: "bg-[var(--color-info-500)]", icon: FiCheckCircle },
    PACKED: { label: "Packed", color: "text-accent", bg: "bg-accent-tint", dot: "bg-accent", icon: FiBox },
    READY_FOR_PICKUP: { label: "Ready", color: "text-[var(--color-warning-700)]", bg: "bg-warning-tint", dot: "bg-[var(--color-warning-500)]", icon: FiBox },
    SHIPPED: { label: "Shipped", color: "text-accent", bg: "bg-accent-tint", dot: "bg-accent", icon: FiTruck },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-[var(--accent-hour-hover)]", bg: "bg-hour-tint", dot: "bg-hour", icon: FiTruck },
    DELIVERED: { label: "Delivered", color: "text-success", bg: "bg-success-tint", dot: "bg-[var(--color-success-500)]", icon: FiCheckCircle },
    CANCELLED: { label: "Cancelled", color: "text-error", bg: "bg-error-tint", dot: "bg-[var(--color-error-500)]", icon: FiXCircle },
    RETURN_REQUESTED: { label: "Return Requested", color: "text-[var(--color-warning-700)]", bg: "bg-warning-tint", dot: "bg-[var(--color-warning-500)]", icon: FiRotateCcw },
    REPLACEMENT_REQUESTED: { label: "Replacement Requested", color: "text-info", bg: "bg-info-tint", dot: "bg-[var(--color-info-500)]", icon: FiBox },
};

/* ─── Order Flow Arrays ─────────────────────────── */
const ECOM_FLOW = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const UH_RIDER_FLOW = ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const UH_SELF_FLOW = ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP", "DELIVERED"];

/* ─── Other Constants ───────────────────────────── */
const REFUND_CFG = {
    REQUESTED: { label: "Refund Requested", color: "text-[var(--color-warning-700)]", desc: "Under review — 1-2 business days." },
    PROCESSING: { label: "Refund Processing", color: "text-info", desc: "Being processed — please wait 24-48 hours." },
    PROCESSED: { label: "Refund Processed", color: "text-success", desc: "Amount will reflect within 5-7 business days." },
    FAILED: { label: "Refund Failed", color: "text-error", desc: "Issue encountered. Admin will retry." },
    REJECTED: { label: "Refund Rejected", color: "text-error", desc: null },
};

const CANCELLABLE = ["PLACED", "CONFIRMED"];

/* ─── Helpers ───────────────────────────────────── */
const getImg = (item) => item.images?.[0]?.url || item.image || null;
const inr = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

/* ─── Reusable Sub-components (page-local, token-based) ────── */
const Heading = ({ icon: Icon, className = "text-primary", children }) => (
    <div className="flex items-center gap-1.5 mb-3">
        {Icon && <Icon size={13} className={className} aria-hidden="true" />}
        <p className={cn("text-[11px] font-extrabold uppercase tracking-wide", className)}>{children}</p>
    </div>
);

const Row = ({ label, value, bold = false, className }) => (
    <div className="flex justify-between items-center py-1">
        <span className="text-xs text-muted">{label}</span>
        <span className={cn("text-xs", bold ? "font-bold" : "font-medium", className || "text-primary")}>{value}</span>
    </div>
);

/* ─── Vendor Rating Card (Urbexon Hour, post-delivery) ───────
   Real, dynamic vendor rating — submits to PUT /orders/:id/review,
   which recalculates Vendor.rating/ratingCount server-side immediately. ── */
const VendorRatingCard = ({ orderId, vendor, existingReview, onSubmitted }) => {
    const [rating, setRating] = useState(existingReview?.rating || 0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState(existingReview?.comment || "");
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState("");
    const [done, setDone] = useState(!!existingReview?.rating);

    const submit = async () => {
        if (!rating) { setErr("Please select a star rating"); return; }
        setSubmitting(true); setErr("");
        try {
            const { data } = await orderApi.submitOrderReview(orderId, { rating, comment });
            setDone(true);
            onSubmitted?.(data.review);
        } catch (e) {
            setErr(e.response?.data?.message || "Failed to submit rating");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card accent className="mb-3.5 border-[var(--color-amber-100)] bg-hour-tint">
            <Heading icon={FiPackage} className="text-[var(--accent-hour-hover)]">
                Rate {vendor?.shopName || "This Vendor"}
            </Heading>
            <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                    <button
                        key={s}
                        type="button"
                        disabled={done}
                        onClick={() => setRating(s)}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="bg-transparent border-none cursor-pointer p-0.5 disabled:cursor-default"
                        aria-label={`${s} star${s > 1 ? "s" : ""}`}
                    >
                        <span className={cn("text-2xl leading-none", (hoverRating || rating) >= s ? "text-amber-400" : "text-[var(--color-graphite-200)]")}>★</span>
                    </button>
                ))}
            </div>
            {!done && (
                <>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        maxLength={500}
                        placeholder="How was your experience with this vendor? (optional)"
                        className="w-full min-h-[64px] px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--color-amber-100)] bg-surface text-primary outline-none focus:border-[var(--accent-hour)] mb-2.5 resize-none"
                    />
                    {err && <p className="text-xs text-error mb-2">{err}</p>}
                    <Button variant="hour" size="sm" loading={submitting} onClick={submit}>
                        {submitting ? "Submitting…" : "Submit Rating"}
                    </Button>
                </>
            )}
            {done && <p className="text-xs font-semibold text-[var(--accent-hour-hover)]">Thanks for rating your order! 🎉</p>}
        </Card>
    );
};

/* ─── Shiprocket Tracking Card ──────────────────── */
const ShiprocketCard = ({ orderId, shipping }) => {
    const [tracking, setTracking] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    if (!shipping?.awbCode) return null;
    const isMock = shipping.mock;

    const fetchTracking = async () => {
        try {
            setLoading(true); setErr("");
            const { data } = await orderApi.trackShiprocketOrder(orderId);
            setTracking(data);
        } catch (e) {
            setErr(e.response?.data?.message || "Tracking unavailable.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card accent className="border-[var(--color-info-100)]">
            <Heading icon={FiTruck} className="text-info">Shipment Tracking</Heading>
            {isMock && (
                <div className="bg-info-tint border border-[var(--color-info-100)] rounded-[var(--radius-sm)] px-3 py-2 mb-3 text-xs text-secondary">
                    🔧 <b>Test shipment</b> — live tracking activates once Shiprocket is connected.
                </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2 mb-3">
                {[{ l: "AWB", v: shipping.awbCode, m: true }, { l: "Courier", v: shipping.courierName || "Standard" }, { l: "Shipment ID", v: shipping.shipmentId, m: true }].map(({ l, v, m }) => (
                    <div key={l} className="border border-[var(--color-graphite-100)] rounded-[var(--radius-sm)] px-2.5 py-2">
                        <p className="text-[10px] font-bold text-muted uppercase mb-0.5">{l}</p>
                        <p className={cn("text-[13px] font-semibold text-primary break-all", m && "font-mono")}>{v || "—"}</p>
                    </div>
                ))}
            </div>
            <div className="flex gap-2 flex-wrap">
                {!isMock && (
                    <Button variant="primary" size="sm" icon={FiTruck} loading={loading} onClick={fetchTracking}>
                        {loading ? "Fetching…" : "Get Live Status"}
                    </Button>
                )}
                {!isMock && shipping.trackingUrl && (
                    <a href={shipping.trackingUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" icon={FiExternalLink}>Track</Button>
                    </a>
                )}
            </div>
            {err && (
                <div className="mt-2.5 bg-error-tint border border-[var(--color-error-100)] rounded-[var(--radius-sm)] px-3 py-2 text-xs text-error">{err}</div>
            )}
            {tracking && !isMock && (
                <div className="border border-[var(--color-graphite-100)] rounded-[var(--radius-md)] px-3.5 py-3 mt-3">
                    <div className="flex justify-between mb-2">
                        <p className="text-[13px] font-semibold text-primary">Current Status</p>
                        <span className="text-[11px] font-bold bg-info-tint text-info px-2.5 py-0.5 rounded-full">{tracking.label || tracking.status}</span>
                    </div>
                    {tracking.activities?.slice(0, 5).map((act, i) => (
                        <div key={i} className={cn("flex gap-2.5 items-start py-1.5", i > 0 && "border-t border-[var(--color-graphite-100)]")}>
                            <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", i === 0 ? "bg-[var(--color-info-500)]" : "bg-[var(--color-graphite-300)]")} />
                            <div>
                                <p className={cn("text-[13px] text-primary", i === 0 && "font-semibold")}>{act.activity}</p>
                                <p className="text-[11px] text-muted">{act.location && `${act.location} · `}{fmtDate(act.date)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
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
    const [deliveryStatus, setDeliveryStatus] = useState(null);
    const [deliveryOtp, setDeliveryOtp] = useState(null);
    const [wsMessage, setWsMessage] = useState(null);

    /* ── WebSocket ──
       BUG FIX: "order_status_updated"/"order_status" used to be handled
       here AND by useOrderRealtime's SSE stream below — the backend emits
       both for every status change (orderController.js), so this page
       was calling setOrder twice per transition. useOrderRealtime already
       owns this exclusively (same pattern MyOrders.jsx uses); WS here is
       now only for the event types SSE doesn't carry at all.

       BUG FIX 2: the "order_status" event type (distinct from
       "order_status_updated") was never handled at all. This is the ONLY
       event deliveryController.js's pickupOrder() sends the delivery OTP
       through — Order.deliveryOtp.code is `select: false` on the schema,
       so the initial GET on page load never carries it, and there is no
       other channel that does. Without this handler, deliveryOtp stayed
       null forever even once the order reached OUT_FOR_DELIVERY. */
    const { send: wsSend } = useWebSocket(authToken, {
        onMessage: (msg) => {
            const p = msg.payload;
            if (msg.type === "rider_location" && p?.orderId === id) setWsMessage(msg);
            if (msg.type === "delivery:status_update" && p?.orderId === id) {
                setDeliveryStatus(p.status);
            }
            if (msg.type === "order_status" && p?.orderId === id) {
                if (p.otp) setDeliveryOtp(p.otp);
                if (p.status) setOrder(prev => prev ? { ...prev, orderStatus: p.status } : prev);
            }
        },
        onConnect: () => { if (id) wsSend("join_room", { room: `order:${id}` }); },
    });

    // BUG FIX: this used to only track rider location once OUT_FOR_DELIVERY
    // — the rider's location is now tracked continuously from the moment
    // they accept (delivery-panel reports GPS whenever online, not just
    // mid-delivery), so there's real data to show during "Heading to
    // Store" too. Live tracking now runs for the whole assigned window via
    // the canonical useLiveTracking hook (WS-primary + polling fallback,
    // same one used by vendor-panel/admin/delivery-panel) instead of this
    // page's own hand-rolled poll+WS-merge logic.
    const isRiderAssigned = !!order?.delivery?.assignedTo && !["DELIVERED", "CANCELLED"].includes(order?.orderStatus);

    // BUG FIX: these two were previously passed to useLiveTracking as
    // inline arrow functions, i.e. a brand-new function reference on every
    // render. Inside useLiveTracking, `poll` is a useCallback that depends
    // on `fetchLocation`, and the effect that schedules the 15s interval
    // depends on `poll` — so a new fetchLocation/joinRoom every render
    // re-ran that effect and fired `poll()` immediately, every time,
    // instead of waiting out the interval. Each successful poll updates
    // state → re-renders this component → creates new fetchLocation/
    // joinRoom again → repeats. That's what produced 220+ /rider-location
    // requests firing every ~500-800ms instead of every 15s. Memoizing
    // these on [id]/[wsSend, id] keeps their identity stable across
    // renders that don't actually change the order or socket.
    const joinRoom = useCallback(() => wsSend("join_room", { room: `order:${id}` }), [wsSend, id]);
    const fetchLocation = useCallback(async () => (await getRiderLocationForOrder(id)).data, [id]);

    const tracking = useLiveTracking({
        orderId: id,
        enabled: isRiderAssigned,
        wsMessage,
        joinRoom,
        fetchLocation,
    });

    useOrderRealtime({
        enabled: !!authToken,
        onStatusUpdate: (p) => {
            if (p?.orderId === id) setOrder(prev => prev ? { ...prev, orderStatus: p.status } : prev);
        },
    });

    /* ── Fetch order ── */
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setLoading(true);
                const { data } = await orderApi.getOrderById(id);
                setOrder(data);
                if (data.deliveryOtp?.code) setDeliveryOtp(data.deliveryOtp.code);
            } catch {
                setError("Order not found.");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    /* ── Handlers ── */
    const handleCancel = async () => {
        try {
            setCancelling(true); setCancelError("");
            const { data } = await orderApi.cancelOrder(id);
            setOrder(data.order);
            setConfirmCancel(false);
        } catch (e) {
            setCancelError(e.response?.data?.message || "Failed to cancel");
        } finally {
            setCancelling(false);
        }
    };

    const handleRefund = async () => {
        try {
            setRequestingRefund(true); setRefundError("");
            const { data } = await requestRefund(id, { reason: refundReason || "Requested by customer" });
            setOrder(p => ({ ...p, refund: data.refund }));
            setShowRefundForm(false);
        } catch (e) {
            setRefundError(e.response?.data?.message || "Refund failed");
        } finally {
            setRequestingRefund(false);
        }
    };

    const handleReturnRequest = async () => {
        try {
            setRequestingReturn(true); setReturnError("");
            const { data } = await orderApi.requestReturn(id, { reason: returnReason });
            setOrder(p => ({ ...p, return: data.return, orderStatus: "RETURN_REQUESTED" }));
            setShowReturnForm(false);
        } catch (e) {
            setReturnError(e.response?.data?.message || "Return request failed");
        } finally {
            setRequestingReturn(false);
        }
    };

    const handleReplacementRequest = async () => {
        try {
            setRequestingReplacement(true); setReplacementError("");
            const { data } = await orderApi.requestReplacement(id, { reason: replacementReason });
            setOrder(p => ({ ...p, replacement: data.replacement, orderStatus: "REPLACEMENT_REQUESTED" }));
            setShowReplacementForm(false);
        } catch (e) {
            setReplacementError(e.response?.data?.message || "Replacement request failed");
        } finally {
            setRequestingReplacement(false);
        }
    };

    const handleDownload = async () => {
        try {
            setDownloadingInvoice(true);
            const res = await orderApi.downloadInvoice(id, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            const a = document.createElement("a");
            a.href = url;
            a.setAttribute("download", order?.invoiceNumber ? `${order.invoiceNumber}.pdf` : `Urbexon_Invoice_${id.slice(-8).toUpperCase()}.pdf`);
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            alert(
                e.response?.status === 403 ? "Access denied." :
                    e.response?.status === 404 ? "Invoice not found." :
                        "Download failed."
            );
        } finally {
            setDownloadingInvoice(false);
        }
    };

    /* ── Loading state ── */
    if (loading) return (
        <div className="min-h-screen bg-canvas flex items-center justify-center">
            <div className="text-center">
                <Loader size="lg" className="mb-3" />
                <p className="text-muted text-sm">Loading order…</p>
            </div>
        </div>
    );

    /* ── Error / not found state ── */
    if (!order) return (
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6">
            <FiPackage size={44} className="text-[var(--color-graphite-300)] mb-4" aria-hidden="true" />
            <h2 className="text-xl font-extrabold text-primary mb-1.5">Order Not Found</h2>
            <p className="text-secondary text-sm mb-5">{error}</p>
            <Link to="/orders">
                <Button variant="primary" icon={FiArrowLeft}>Back to Orders</Button>
            </Link>
        </div>
    );

    /* ── Derived values ── */
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
    const itemsTotal = order.items.reduce((s, i) => s + i.price * (i.qty || 1), 0);
    const couponDisc = order.coupon?.discount || 0;
    const accentClass = isUH ? "text-accent" : "text-info";
    const accentBg = isUH ? "bg-accent" : "bg-[var(--color-info-500)]";
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
        <div className="min-h-screen bg-canvas">
            <SEO title="Order Details" noindex />

            <div className="max-w-[680px] mx-auto px-[clamp(14px,4vw,20px)] pt-7 pb-16">

                {/* Back */}
                <div className="mb-5">
                    <BackButton fallback="/orders" label="Back to Orders" />
                </div>

                {/* Header */}
                <div className="mb-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-[clamp(22px,5vw,28px)] font-extrabold text-primary font-display">
                                    Order #{order._id.slice(-8).toUpperCase()}
                                </h1>
                                {isUH && (
                                    <span className="text-[10px] font-extrabold text-accent bg-accent-tint border border-[var(--accent-primary-tint)] px-2 py-0.5 rounded-[var(--radius-sm)]">
                                        ⚡ HOUR
                                    </span>
                                )}
                            </div>
                            <p className="text-[13px] text-secondary">
                                {new Date(order.createdAt).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                {" at "}
                                {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {order.invoiceNumber && (
                                <p className="text-[11px] text-muted mt-0.5 font-mono">Invoice: {order.invoiceNumber}</p>
                            )}
                        </div>
                        <div className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-md)]", cfg.bg)}>
                            <cfg.icon size={14} className={cfg.color} aria-hidden="true" />
                            <span className={cn("text-xs font-bold", cfg.color)}>{cfg.label}</span>
                        </div>
                    </div>
                    {showInvoice && (
                        <div className="mt-3">
                            <Button variant="secondary" size="sm" icon={FiFileText} loading={downloadingInvoice} onClick={handleDownload}>
                                {downloadingInvoice ? "Downloading…" : "Download Invoice"}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Cancelled Banner */}
                {isCancelled && (
                    <Card accent className="mb-3.5 border-[var(--color-error-100)] bg-error-tint">
                        <div className="flex items-center gap-3">
                            <div className="w-[38px] h-[38px] bg-[var(--color-error-100)] rounded-full flex items-center justify-center flex-shrink-0">
                                <FiXCircle size={16} className="text-error" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="font-semibold text-error text-sm mb-0.5">Order Cancelled</p>
                                <p className="text-secondary text-xs">{order.cancellationReason || "This order was cancelled."}</p>
                                {tl.cancelledAt && <p className="text-[11px] text-muted mt-0.5">on {fmtDate(tl.cancelledAt)}</p>}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Refund Status */}
                {refund && (
                    <Card accent className="mb-3.5">
                        <div className="flex items-start gap-3">
                            <FiRotateCcw size={16} className={cn("mt-0.5 flex-shrink-0", refund.color)} aria-hidden="true" />
                            <div>
                                <p className={cn("font-semibold text-sm mb-1", refund.color)}>{refund.label}</p>
                                {refund.desc && <p className="text-xs text-secondary mb-1">{refund.desc}</p>}
                                {order.refund?.amount && <p className="text-sm font-extrabold text-success">₹{inr(order.refund.amount)}</p>}
                                {order.refund?.rejectionReason && <p className="text-xs text-error mt-1">Reason: {order.refund.rejectionReason}</p>}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Order Tracking Stepper */}
                {!isCancelled && stepIdx >= 0 && (
                    <Card accent className="mb-3.5">
                        <Heading icon={FiClock} className={accentClass}>Order Tracking</Heading>
                        <div className="relative mb-4.5">
                            <div className="absolute left-[5%] right-[5%] top-4 h-[3px] bg-[var(--color-graphite-100)] rounded-full" />
                            <div
                                className={cn("absolute left-[5%] top-4 h-[3px] rounded-full transition-all duration-500", accentBg)}
                                style={{ width: stepIdx > 0 ? `${(stepIdx / (flow.length - 1)) * 90}%` : "0%" }}
                            />
                            <div className="flex justify-between relative z-[2]">
                                {flow.map((step, i) => {
                                    const done = i <= stepIdx, active = i === stepIdx;
                                    const Icon = STATUS[step]?.icon || FiBox;
                                    return (
                                        <div key={step} className="flex flex-col items-center flex-1">
                                            <div className={cn(
                                                "w-[34px] h-[34px] rounded-full border-2 flex items-center justify-center transition-all",
                                                done ? cn(accentBg, "border-transparent") : "bg-[var(--color-graphite-100)] border-default",
                                                active && "ring-4 ring-[var(--accent-primary-tint)]"
                                            )}>
                                                {i < stepIdx
                                                    ? <FiCheckCircle size={13} className="text-white" aria-hidden="true" />
                                                    : <Icon size={12} className={done ? "text-white" : "text-muted"} aria-hidden="true" />}
                                            </div>
                                            <p className={cn("text-[9px] text-center mt-1.5 uppercase tracking-wide max-w-[52px] leading-tight", done ? cn("font-bold", accentClass) : "font-medium text-muted")}>
                                                {STATUS[step]?.label}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className={cn("px-3 py-2.5 rounded-[var(--radius-sm)] flex items-center gap-2", cfg.bg)}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                            <p className={cn("text-[13px] font-semibold", cfg.color)}>
                                {isDelivered ? "✓ Delivered Successfully" : order.orderStatus === "OUT_FOR_DELIVERY" ? "🛵 On the way" : cfg.label}
                            </p>
                        </div>
                        {timeline.length > 0 && (
                            <div className="mt-3 border-t border-[var(--color-graphite-100)] pt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
                                {timeline.map((e, i) => (
                                    <span key={i} className="text-[11px] text-muted">
                                        <b className="text-secondary">{e.l}:</b> {fmtDate(e.t)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </Card>
                )}

                {/* Shiprocket (ecom only) */}
                {!isUH && hasShipping && !isCancelled && (
                    <div className="mb-3.5"><ShiprocketCard orderId={id} shipping={order.shipping} /></div>
                )}

                {/* Urbexon Hour Express Card */}
                {isUH && !isCancelled && (
                    <Card accent className="mb-3.5 border-[var(--accent-primary-tint)] bg-accent-tint">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-[34px] h-[34px] bg-accent-tint rounded-full flex items-center justify-center text-[15px]">⚡</div>
                            <div>
                                <p className="font-extrabold text-sm text-accent">Urbexon Hour Express</p>
                                <p className="text-xs text-accent">Est: {order.delivery?.eta ? `${order.delivery.eta} min` : "45-120 min"}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { l: "Delivery", v: order.delivery?.provider === "LOCAL_RIDER" ? "Local Rider" : order.delivery?.provider === "VENDOR_SELF" ? "Vendor" : "Express" },
                                { l: "Distance", v: order.delivery?.distanceKm ? `${order.delivery.distanceKm.toFixed(1)} km` : "—" },
                                { l: "ETA", v: order.delivery?.eta ? `${order.delivery.eta} min` : "45-120 min" },
                            ].map(({ l, v }) => (
                                <div key={l} className="bg-surface border border-[var(--accent-primary-tint)] rounded-[var(--radius-sm)] p-2 text-center">
                                    <p className="text-[9px] font-bold text-muted uppercase mb-0.5">{l}</p>
                                    <p className="text-[13px] font-extrabold text-accent">{v}</p>
                                </div>
                            ))}
                        </div>
                        {order.delivery?.riderName && (
                            <div className="mt-2.5 px-3 py-2 bg-surface rounded-[var(--radius-sm)] border border-[var(--accent-primary-tint)] flex justify-between items-center">
                                <div>
                                    <p className="text-[11px] text-muted">Delivery Partner</p>
                                    <p className="text-[13px] font-bold text-primary">{order.delivery.riderName}</p>
                                </div>
                                {order.delivery.riderPhone && (
                                    <a href={`tel:${order.delivery.riderPhone}`}>
                                        <Button variant="success" size="sm">📞 Call</Button>
                                    </a>
                                )}
                            </div>
                        )}
                    </Card>
                )}

                {/* Vendor rating (Urbexon Hour, once delivered) */}
                {isUH && isDelivered && order.vendorId && (
                    <VendorRatingCard
                        orderId={id}
                        vendor={order.vendorId}
                        existingReview={order.review}
                        onSubmitted={(review) => setOrder((prev) => ({ ...prev, review }))}
                    />
                )}

                {/* Delivery OTP */}
                {order.orderStatus === "OUT_FOR_DELIVERY" && deliveryOtp && (
                    <Card accent className="mb-3.5 border-[var(--color-warning-100)] bg-warning-tint text-center" padding="lg">
                        <p className="text-[11px] font-bold text-[var(--color-warning-700)] uppercase tracking-wide mb-1.5">🔐 Delivery OTP</p>
                        <div className="text-[clamp(26px,7vw,36px)] font-black text-primary tracking-[.2em] font-mono">{deliveryOtp}</div>
                        <p className="text-xs text-[var(--color-warning-700)] max-w-[300px] mx-auto mt-2 leading-snug">
                            Share <strong>only after receiving</strong> your order.
                        </p>
                    </Card>
                )}

                {/* Live Rider Map — BUG FIX: used to only show once
                    OUT_FOR_DELIVERY; now shows for the whole assigned
                    window (rider location is tracked continuously from
                    acceptance, not just the last leg). */}
                {tracking.riderPos && isRiderAssigned && (
                    <Card accent className="mb-3.5 border-[var(--color-info-100)] bg-info-tint">
                        <div className="flex justify-between items-center mb-2.5">
                            <Heading icon={FiTruck}>Live Location</Heading>
                            {/* BUG FIX: this badge used to always say "LIVE" regardless
                                of whether the location was actually current — now
                                reflects the backend's freshness check. */}
                            {tracking.stale ? (
                                <span className="text-[10px] font-bold text-error bg-error-tint border border-[var(--color-error-100)] px-2 py-0.5 rounded-full">● RECONNECTING</span>
                            ) : (
                                <span className="text-[10px] font-bold text-success bg-success-tint border border-[var(--color-success-100)] px-2 py-0.5 rounded-full">● LIVE</span>
                            )}
                        </div>
                        <LiveTrackingMap
                            riderLat={tracking.riderPos[0]}
                            riderLng={tracking.riderPos[1]}
                            riderName={tracking.riderName || "Partner"}
                            vendorLat={tracking.vendorPos?.[0]}
                            vendorLng={tracking.vendorPos?.[1]}
                            vendorLabel={order.vendorId?.shopName || "Pickup Point"}
                            destLat={order.latitude}
                            destLng={order.longitude}
                            destLabel={order.address || "Address"}
                            leg={tracking.leg}
                            distanceKm={tracking.distanceKm}
                            etaText={tracking.etaText}
                            speedKmph={tracking.speedKmph}
                            headingDeg={tracking.headingDeg}
                            status={deliveryStatus || order.delivery?.status}
                            height="clamp(170px,28vw,220px)"
                            lastUpdated={tracking.lastUpdated}
                            stale={!!tracking.stale}
                        />
                        <p className="text-[10px] text-muted text-center mt-1.5">
                            Updated: {tracking.lastUpdated ? new Date(tracking.lastUpdated).toLocaleTimeString("en-IN") : "Just now"}
                        </p>
                    </Card>
                )}

                {/* Delivery Progress (UH rider steps) */}
                {order.delivery?.assignedTo && ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(order.orderStatus) && (() => {
                    const ds = deliveryStatus || order.delivery?.status;
                    const steps = [
                        { k: "ASSIGNED", l: "Assigned", e: "✓" },
                        { k: "ARRIVING_VENDOR", l: "To Store", e: "🏪" },
                        { k: "PICKED_UP", l: "Picked Up", e: "📦" },
                        { k: "OUT_FOR_DELIVERY", l: "On Way", e: "🛵" },
                    ];
                    const ci = steps.findIndex(s => s.k === ds);
                    return (
                        <Card className="mb-3.5">
                            <Heading>Delivery Progress</Heading>
                            <div className="flex gap-1">
                                {steps.map((s, i) => (
                                    <div key={s.k} className={cn(
                                        "flex-1 py-1.5 px-1 text-center rounded-[var(--radius-sm)] border text-[10px] font-bold",
                                        i < ci ? "bg-success-tint border-[var(--color-success-100)] text-success" : i === ci ? "bg-info-tint border-[var(--color-info-500)] text-info" : "bg-canvas border-default text-muted"
                                    )}>
                                        <div className="text-sm mb-0.5">{s.e}</div>
                                        {s.l}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    );
                })()}

                {/* Rider Contact (ecom) */}
                {order.orderStatus === "OUT_FOR_DELIVERY" && order.delivery?.riderPhone && !isUH && (
                    <Card className="mb-3.5 bg-success-tint border-[var(--color-success-100)]">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                                <p className="text-xs font-bold text-success mb-0.5">Delivery Partner</p>
                                <p className="text-sm font-bold text-primary">{order.delivery.riderName}</p>
                            </div>
                            <a href={`tel:${order.delivery.riderPhone}`}>
                                <Button variant="success" size="sm">📞 Call</Button>
                            </a>
                        </div>
                    </Card>
                )}

                {/* Items List */}
                <Card className="mb-3.5">
                    <Heading icon={FiShoppingBag}>Ordered Items ({order.items.length})</Heading>
                    <div className="flex flex-col gap-2">
                        {order.items.map((item, i) => {
                            const img = getImg(item);
                            return (
                                <div key={item._id || i} className="flex gap-3 p-3 bg-canvas rounded-[var(--radius-md)] border border-[var(--color-graphite-100)]">
                                    <div className="w-14 h-14 bg-surface border border-default rounded-[var(--radius-sm)] overflow-hidden flex items-center justify-center flex-shrink-0">
                                        {img
                                            ? <img src={img} alt={item.name} className="w-full h-full object-contain p-0.5" loading="lazy" />
                                            : <FiGift size={16} className="text-muted" aria-hidden="true" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[13px] text-primary mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</p>
                                        <p className="text-xs text-muted mb-1">Qty: {item.qty || 1} × ₹{inr(item.price)}</p>
                                        <div className="flex gap-1 flex-wrap">
                                            {item.selectedSize && <span className="text-[10px] font-bold bg-warning-tint text-[var(--color-warning-700)] px-1.5 py-0.5 rounded border border-[var(--color-warning-100)]">Size: {item.selectedSize}</span>}
                                            {item.selectedColor && <span className="text-[10px] font-bold bg-info-tint text-info px-1.5 py-0.5 rounded border border-[var(--color-info-100)]">Color: {item.selectedColor}</span>}
                                            {item.customization?.text && <span className="text-[10px] font-semibold bg-info-tint text-info px-1.5 py-0.5 rounded">✏️ {item.customization.text}</span>}
                                            {item.customization?.note && <span className="text-[10px] font-semibold bg-[var(--color-graphite-100)] text-secondary px-1.5 py-0.5 rounded">📝 {item.customization.note}</span>}
                                            {item.policy?.isReturnable === false
                                                ? <span className="text-[10px] font-bold bg-error-tint text-error px-1.5 py-0.5 rounded border border-[var(--color-error-100)]">Non-Returnable</span>
                                                : <span className="text-[10px] font-bold bg-success-tint text-success px-1.5 py-0.5 rounded border border-[var(--color-success-100)]">{item.policy?.returnWindow || 7}-Day Return</span>}
                                            {item.policy?.isReplaceable && <span className="text-[10px] font-bold bg-info-tint text-info px-1.5 py-0.5 rounded border border-[var(--color-info-100)]">{item.policy?.replacementWindow || 7}-Day Replacement</span>}
                                            {item.policy?.isCancellable === false && <span className="text-[10px] font-bold bg-error-tint text-error px-1.5 py-0.5 rounded border border-[var(--color-error-100)]">Non-Cancellable</span>}
                                        </div>
                                    </div>
                                    <p className={cn("font-extrabold text-sm flex-shrink-0 self-center", accentClass)}>₹{inr((item.qty || 1) * item.price)}</p>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Price + Delivery Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3.5">
                    <Card>
                        <Heading icon={FiDollarSign}>Price Summary</Heading>
                        <Row label="Items Total" value={`₹${inr(itemsTotal)}`} />
                        {couponDisc > 0 && <Row label={`Coupon${order.coupon?.code ? ` (${order.coupon.code})` : ""}`} value={`-₹${inr(couponDisc)}`} className="text-success" bold />}
                        {Number(order.platformFee) > 0 && <Row label="Platform Fee" value={`₹${inr(order.platformFee)}`} />}
                        <Row label="Delivery" value={Number(order.deliveryCharge) > 0 ? `₹${inr(order.deliveryCharge)}` : "FREE"} className={Number(order.deliveryCharge) > 0 ? "text-primary" : "text-success"} />
                        <div className="h-px bg-default my-2" />
                        <div className="flex justify-between items-center">
                            <span className="font-extrabold text-sm text-primary">Total</span>
                            <span className={cn("font-black text-lg", accentClass)}>₹{inr(order.totalAmount)}</span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-[var(--color-graphite-100)]">
                            <Row label="Payment" value={isRazorpay ? "💳 Online" : "💰 COD"} />
                            {isPaid && <Row label="Status" value="✅ Paid" className="text-success" />}
                            {order.payment?.paidAt && <Row label="Paid" value={fmtDate(order.payment.paidAt)} />}
                        </div>
                    </Card>
                    <Card>
                        <Heading icon={FiMapPin}>Delivery Info</Heading>
                        <div className="flex flex-col gap-2.5">
                            {[
                                { icon: FiUser, bg: "bg-info-tint", c: "text-info", l: "Customer", v: order.customerName },
                                { icon: FiPhone, bg: "bg-success-tint", c: "text-success", l: "Phone", v: order.phone, href: `tel:${order.phone}` },
                                order.email && { icon: FiMail, bg: "bg-accent-tint", c: "text-accent", l: "Email", v: order.email },
                                { icon: FiMapPin, bg: "bg-warning-tint", c: "text-[var(--color-warning-700)]", l: "Address", v: order.address, multi: true },
                            ].filter(Boolean).map(({ icon: I, bg, c, l, v, href, multi }) => ( // eslint-disable-line no-unused-vars -- I is rendered as <I/> below; false positive without eslint-plugin-react's jsx-uses-vars
                                <div key={l} className="flex items-start gap-2">
                                    <div className={cn("w-[30px] h-[30px] rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0", bg, multi && "mt-0.5")}>
                                        <I size={11} className={c} aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-bold text-muted uppercase mb-0.5">{l}</p>
                                        {href
                                            ? <a href={href} className="text-[13px] font-bold text-info">{v}</a>
                                            : <p className={cn("text-xs text-primary leading-snug", multi ? "font-medium" : "font-bold")}>{v || "—"}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Return Status */}
                {order.return?.status && order.return.status !== "NONE" && (
                    <Card accent className="mb-3.5">
                        <Heading icon={FiRotateCcw} className="text-[var(--color-warning-700)]">Return Request</Heading>
                        <Row label="Status" value={order.return.status.replace(/_/g, " ")} bold className={order.return.status === "APPROVED" ? "text-success" : order.return.status === "REJECTED" ? "text-error" : "text-[var(--color-warning-700)]"} />
                        {order.return.reason && <Row label="Reason" value={order.return.reason} />}
                        {order.return.requestedAt && <Row label="Requested" value={fmtDate(order.return.requestedAt)} />}
                        {order.return.refundAmount && <Row label="Refund" value={`₹${inr(order.return.refundAmount)}`} bold className="text-success" />}
                        {order.return.adminNote && <p className="text-xs text-secondary bg-canvas px-3 py-2 rounded-[var(--radius-sm)] mt-2 leading-snug">Admin: {order.return.adminNote}</p>}
                    </Card>
                )}

                {/* Return Request Form */}
                {canReturn && (
                    <Card accent className="mb-3.5">
                        <Heading icon={FiRotateCcw} className="text-[var(--color-warning-700)]">Request Return</Heading>
                        <p className="text-xs text-secondary leading-snug mb-3">
                            {pi.returnDaysRemaining != null
                                ? `You can request a return within ${Math.ceil(pi.returnDaysRemaining)} day${Math.ceil(pi.returnDaysRemaining) !== 1 ? "s" : ""} remaining (${pi.returnWindowDays}-day window).`
                                : "You can request a return within the return window."}
                        </p>
                        {returnError && <p className="text-error text-xs bg-error-tint px-3 py-2 rounded-[var(--radius-sm)] mb-2.5">{returnError}</p>}
                        {showReturnForm ? (
                            <div className="flex flex-col gap-2.5">
                                <textarea
                                    value={returnReason} onChange={e => setReturnReason(e.target.value)}
                                    placeholder="Why do you want to return? (required)" rows={3}
                                    className="w-full bg-canvas border border-default rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] outline-none resize-none text-primary focus-ring-accent"
                                />
                                <div className="flex gap-2">
                                    <Button variant="primary" className="flex-1" disabled={!returnReason.trim()} loading={requestingReturn} onClick={handleReturnRequest}>Submit Return</Button>
                                    <Button variant="secondary" onClick={() => { setShowReturnForm(false); setReturnError(""); }}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full" icon={FiRotateCcw} onClick={() => setShowReturnForm(true)}>Request Return</Button>
                        )}
                    </Card>
                )}

                {/* Replacement Status */}
                {order.replacement?.status && order.replacement.status !== "NONE" && (
                    <Card accent className="mb-3.5">
                        <Heading icon={FiBox} className="text-info">Replacement Request</Heading>
                        <Row label="Status" value={order.replacement.status.replace(/_/g, " ")} bold className={["APPROVED", "SHIPPED"].includes(order.replacement.status) ? "text-success" : order.replacement.status === "REJECTED" ? "text-error" : "text-[var(--color-warning-700)]"} />
                        {order.replacement.reason && <Row label="Reason" value={order.replacement.reason} />}
                        {order.replacement.requestedAt && <Row label="Requested" value={fmtDate(order.replacement.requestedAt)} />}
                        {order.replacement.trackingUrl && (
                            <Row label="Tracking" value={<a href={order.replacement.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-info font-bold text-xs inline-flex items-center gap-1">Track <FiExternalLink size={9} aria-hidden="true" /></a>} />
                        )}
                        {order.replacement.adminNote && <p className="text-xs text-secondary bg-canvas px-3 py-2 rounded-[var(--radius-sm)] mt-2 leading-snug">Admin: {order.replacement.adminNote}</p>}
                    </Card>
                )}

                {/* Request Replacement Form */}
                {canReplace && (
                    <Card accent className="mb-3.5">
                        <Heading icon={FiBox} className="text-info">Request Replacement</Heading>
                        <p className="text-xs text-secondary leading-snug mb-3">
                            {pi.replacementDaysRemaining != null
                                ? `Request a replacement within ${Math.ceil(pi.replacementDaysRemaining)} day${Math.ceil(pi.replacementDaysRemaining) !== 1 ? "s" : ""} remaining (${pi.replacementWindowDays}-day window).`
                                : "You can request a replacement for eligible items."}
                        </p>
                        {replacementError && <p className="text-error text-xs bg-error-tint px-3 py-2 rounded-[var(--radius-sm)] mb-2.5">{replacementError}</p>}
                        {showReplacementForm ? (
                            <div className="flex flex-col gap-2.5">
                                <textarea
                                    value={replacementReason} onChange={e => setReplacementReason(e.target.value)}
                                    placeholder="Why do you need a replacement? (required)" rows={3}
                                    className="w-full bg-canvas border border-default rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] outline-none resize-none text-primary focus-ring-accent"
                                />
                                <div className="flex gap-2">
                                    <Button variant="primary" className="flex-1" disabled={!replacementReason.trim()} loading={requestingReplacement} onClick={handleReplacementRequest}>Submit Replacement</Button>
                                    <Button variant="secondary" onClick={() => { setShowReplacementForm(false); setReplacementError(""); }}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full" icon={FiBox} onClick={() => setShowReplacementForm(true)}>Request Replacement</Button>
                        )}
                    </Card>
                )}

                {/* Cancel Order */}
                {canCancel && !isCancelled && (
                    <Card accent className="mb-3.5 border-[var(--color-error-100)]">
                        <Heading icon={FiXCircle} className="text-error">Cancel Order</Heading>
                        <p className="text-xs text-secondary leading-snug mb-3">
                            {pi.cancelWindowHours > 0
                                ? `Cancel within ${Math.ceil(pi.cancelHoursRemaining || 0)} hour${Math.ceil(pi.cancelHoursRemaining || 0) !== 1 ? "s" : ""} remaining.`
                                : "You can cancel since it hasn't been packed."}
                            {isRazorpay && isPaid && (
                                <span className="block mt-1 text-[var(--color-warning-700)] font-semibold">⚡ Refund will be auto-requested.</span>
                            )}
                        </p>
                        {cancelError && <p className="text-error text-xs bg-error-tint px-3 py-2 rounded-[var(--radius-sm)] mb-2.5">{cancelError}</p>}
                        {confirmCancel ? (
                            <div className="flex gap-2">
                                <Button variant="danger" className="flex-1" loading={cancelling} onClick={handleCancel}>Yes, Cancel</Button>
                                <Button variant="secondary" className="flex-1" onClick={() => { setConfirmCancel(false); setCancelError(""); }}>Keep</Button>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full !border-[var(--color-error-500)] !text-error" onClick={() => setConfirmCancel(true)}>Cancel Order</Button>
                        )}
                    </Card>
                )}

                {/* Refund Request */}
                {canRefund && (
                    <Card accent className="mb-3.5">
                        <Heading icon={FiRotateCcw} className="text-info">Request Refund</Heading>
                        <div className="bg-info-tint border border-[var(--color-info-100)] rounded-[var(--radius-sm)] px-3 py-2 mb-3 text-xs text-secondary leading-snug">
                            <FiInfo size={10} className="inline text-info mr-1" aria-hidden="true" />
                            ₹{inr(order.totalAmount)} refunded within 5-7 business days after approval.
                        </div>
                        {refundError && <p className="text-error text-xs bg-error-tint px-3 py-2 rounded-[var(--radius-sm)] mb-2.5">{refundError}</p>}
                        {showRefundForm ? (
                            <div className="flex flex-col gap-2.5">
                                <textarea
                                    value={refundReason} onChange={e => setRefundReason(e.target.value)}
                                    placeholder="Reason (optional)…" rows={3}
                                    className="w-full bg-canvas border border-default rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] outline-none resize-none text-primary focus-ring-accent"
                                />
                                <div className="flex gap-2">
                                    <Button variant="primary" className="flex-1" loading={requestingRefund} onClick={handleRefund}>Submit</Button>
                                    <Button variant="secondary" onClick={() => { setShowRefundForm(false); setRefundError(""); }}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full" icon={FiRotateCcw} onClick={() => setShowRefundForm(true)}>Request Refund</Button>
                        )}
                    </Card>
                )}

                {/* Continue Shopping CTA */}
                <Link to={isUH ? "/urbexon-hour" : "/"}>
                    <Button variant={isUH ? "hour" : "primary"} className="w-full" icon={FiShoppingBag}>Continue Shopping</Button>
                </Link>
            </div>
        </div>
    );
};

export default OrderDetails;