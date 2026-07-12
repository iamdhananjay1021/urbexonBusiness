/**
 * AdminOrders.jsx — Production Ready v4.0 (split-view redesign)
 * ✅ 3-panel layout: Order list | Order detail | Items & Timeline (matches provided reference)
 * ✅ Fixes carried over from v3.1 (WS single-connection, force-assign, live tracking, etc.)
 * ✅ New fixes in this pass — see "FIX v4.0" comments below
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/adminApi";
import { imgUrl } from "../utils/imageUrl";
import {
    FiRefreshCw, FiUser, FiPhone, FiMapPin, FiPackage,
    FiChevronDown, FiX, FiCheckCircle, FiClock,
    FiFileText, FiRotateCcw, FiTruck, FiAlertCircle,
    FiExternalLink, FiPrinter, FiCalendar, FiNavigation,
    FiInfo, FiLoader, FiUserPlus, FiCreditCard, FiClipboard,
} from "react-icons/fi";
// FIX v4.0: FiUserPlus used to be imported in a second, separate
// `import` statement lower in the file — two import statements for the
// same module is dead weight and an easy spot for future duplicate
// imports to sneak in. Merged into the single top-level import above.
import { FaWhatsapp } from "react-icons/fa";
import AdminTrackingMap from "../components/AdminTrackingMap";
import { useAdminWsContext } from "../contexts/AdminWsContext";
import { Modal, Button, Select, EmptyState, StatusBadge, Pagination, SearchBar, Skeleton } from "../components/ui";

const STATUS_CONFIG = {
    PLACED: { label: "Placed", color: "var(--adm-warning)", bg: "#fef3c7" },
    CONFIRMED: { label: "Confirmed", color: "var(--adm-primary)", bg: "var(--adm-primary-tint)" },
    PACKED: { label: "Packed", color: "#8b5cf6", bg: "#f5f3ff" },
    READY_FOR_PICKUP: { label: "Ready for Pickup", color: "#854d0e", bg: "#fef9c3" },
    SHIPPED: { label: "Shipped", color: "var(--adm-info)", bg: "#f0f9ff" },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "var(--adm-warning)", bg: "#fff7ed" },
    DELIVERED: { label: "Delivered", color: "var(--adm-success)", bg: "#f0fdf4" },
    CANCELLED: { label: "Cancelled", color: "var(--adm-danger)", bg: "#fef2f2" },
    RETURN_REQUESTED: { label: "Return Requested", color: "#b45309", bg: "#fffbeb" },
    REPLACEMENT_REQUESTED: { label: "Replacement Requested", color: "#7c3aed", bg: "#f5f3ff" },
    REPLACEMENT_APPROVED: { label: "Replacement Approved", color: "#059669", bg: "#ecfdf5" },
};

const FLOW = {
    PLACED: "CONFIRMED", CONFIRMED: "PACKED", PACKED: "SHIPPED",
    SHIPPED: "OUT_FOR_DELIVERY", OUT_FOR_DELIVERY: "DELIVERED",
};
const UH_FLOW = {
    PLACED: "CONFIRMED", CONFIRMED: "PACKED", PACKED: "READY_FOR_PICKUP",
    READY_FOR_PICKUP: "OUT_FOR_DELIVERY", OUT_FOR_DELIVERY: "DELIVERED",
};
const FLOW_STEPS = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const UH_FLOW_STEPS = ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const PAGE_LIMIT = 20;

const useToast = () => {
    const [toast, setToast] = useState(null);
    const show = useCallback((type, msg, duration = 4000) => {
        setToast({ type, msg, id: Date.now() });
        setTimeout(() => setToast(null), duration);
    }, []);
    return { toast, show };
};

const Toast = ({ toast }) => {
    if (!toast) return null;
    const colors = {
        error: { bg: "#fef2f2", border: "#fecaca", color: "var(--adm-danger)" },
        success: { bg: "#f0fdf4", border: "#bbf7d0", color: "var(--adm-success)" },
        info: { bg: "#eff6ff", border: "#bfdbfe", color: "var(--adm-primary)" },
    };
    const c = colors[toast.type] || colors.info;
    const Icon = toast.type === "error" ? FiAlertCircle : toast.type === "success" ? FiCheckCircle : FiInfo;
    return (
        <div style={{
            position: "fixed", top: 20, right: 20, zIndex: 9999,
            background: c.bg, border: `1px solid ${c.border}`, color: c.color,
            padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,.1)", display: "flex", alignItems: "center", gap: 8,
            maxWidth: "calc(100vw - 40px)", animation: "ao-fadeUp .2s ease",
        }}>
            <Icon size={14} /> {toast.msg}
        </div>
    );
};

/* ── Shared button styles (FIX v4.0: every action button in the detail
   panel now comes from ONE style function instead of each button
   hand-rolling its own inline style object with slightly different
   padding/gap/radius — this is what "structured line" of buttons means:
   same height, same gap, same radius, laid out in a labelled row). ── */
const actionBtnStyle = (variant = "neutral", disabled = false) => {
    const variants = {
        primary: { background: "var(--adm-primary)", color: "#fff", border: "none" },
        neutral: { background: "var(--adm-surface)", color: "var(--adm-text-secondary)", border: "1px solid var(--adm-border)" },
        danger: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
        success: { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" },
        warning: { background: "var(--adm-warning)", color: "#fff", border: "none" },
        warningOutline: { background: "#fff", color: "var(--adm-warning)", border: "1px solid var(--adm-warning)" },
    };
    return {
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "9px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
        opacity: disabled ? 0.65 : 1, whiteSpace: "nowrap", textDecoration: "none",
        ...variants[variant],
    };
};

/* Small labelled wrapper so every action group in the detail panel reads
   as one visual "line" instead of loose buttons floating in a div. */
const ActionRow = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
        {label && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--adm-muted)", marginBottom: 8 }}>{label}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
);

/* ── Shiprocket Panel ── */
const ShiprocketPanel = ({ order, onOrderUpdate, globalToast }) => {
    const shipping = order.shipping || {};
    const hasShipment = !!shipping?.shipmentId;
    const isMock = shipping?.mock;
    const [creating, setCreating] = useState(false);
    const [scheduling, setScheduling] = useState(false);
    const [loadingLabel, setLoadingLabel] = useState(false);
    const [loadingManifest, setLoadingManifest] = useState(false);
    const [tracking, setTracking] = useState(null);
    const [loadingTrack, setLoadingTrack] = useState(false);
    const [weight, setWeight] = useState(500);
    const [cancelling, setCancelling] = useState(false);

    const createShipment = async () => {
        try {
            setCreating(true);
            const { data } = await api.post(`/shiprocket/create/${order._id}`, { weight });
            onOrderUpdate(order._id, {
                ...order,
                shipping: { shipmentId: String(data.shipment_id), awbCode: data.awb_code, courierName: data.courier_name, trackingUrl: data.tracking_url, labelUrl: data.label_url || "", status: "CREATED", mock: data.mock },
                orderStatus: ["CONFIRMED", "PACKED"].includes(order.orderStatus) ? "SHIPPED" : order.orderStatus,
            });
            globalToast("success", `Shipment created! AWB: ${data.awb_code}`);
        } catch (err) { globalToast("error", err.response?.data?.message || "Failed to create shipment"); }
        finally { setCreating(false); }
    };

    const schedulePickup = async () => {
        try { setScheduling(true); await api.post(`/shiprocket/pickup/${order._id}`); globalToast("success", "Pickup scheduled!"); }
        catch (err) { globalToast("error", err.response?.data?.message || "Failed to schedule pickup"); }
        finally { setScheduling(false); }
    };

    const openLabel = async () => {
        try {
            setLoadingLabel(true);
            const { data } = await api.get(`/shiprocket/label/${order._id}`);
            if (data.mock || !data.label_url || data.label_url.includes("mock")) { globalToast("info", "Label available once Shiprocket is connected."); return; }
            window.open(data.label_url, "_blank");
        } catch (err) { globalToast("error", err.response?.data?.message || "Failed to get label"); }
        finally { setLoadingLabel(false); }
    };

    const openManifest = async () => {
        try {
            setLoadingManifest(true);
            const { data } = await api.get(`/shiprocket/manifest/${order._id}`);
            if (data.mock || !data.manifest_url || data.manifest_url.includes("mock")) { globalToast("info", "Manifest available once Shiprocket is connected."); return; }
            window.open(data.manifest_url, "_blank");
        } catch (err) { globalToast("error", err.response?.data?.message || "Failed to get manifest"); }
        finally { setLoadingManifest(false); }
    };

    const fetchTracking = async () => {
        try { setLoadingTrack(true); const { data } = await api.get(`/shiprocket/track/${order._id}`); setTracking(data); }
        catch (err) { globalToast("error", err.response?.data?.message || "Tracking not available"); }
        finally { setLoadingTrack(false); }
    };

    const cancelSR = async () => {
        if (!window.confirm("Cancel this Shiprocket shipment?")) return;
        try {
            setCancelling(true);
            await api.post(`/shiprocket/cancel/${order._id}`);
            onOrderUpdate(order._id, { ...order, shipping: { ...shipping, status: "CANCELLED" } });
            globalToast("success", "Shipment cancelled");
        } catch (err) { globalToast("error", err.response?.data?.message || "Failed to cancel shipment"); }
        finally { setCancelling(false); }
    };

    return (
        <div style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FiTruck size={14} color="var(--adm-muted)" />
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Shipping Information</p>
                    {isMock && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--adm-warning)", background: "#fef3c7", padding: "1px 7px", borderRadius: 4, border: "1px solid #fde68a" }}>MOCK MODE</span>}
                </div>
                {hasShipment && shipping?.trackingUrl && !isMock && (
                    <a href={shipping.trackingUrl} target="_blank" rel="noreferrer" style={actionBtnStyle("neutral")}>
                        <FiExternalLink size={11} /> Track
                    </a>
                )}
            </div>

            {!hasShipment && ["CONFIRMED", "PACKED"].includes(order.orderStatus) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fffbeb", border: "1px solid #fde68a", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>
                    <FiInfo size={13} color={"var(--adm-warning)"} />
                    <p style={{ fontSize: 12, color: "#92400e", fontWeight: 500, margin: 0 }}>Order is <b>{STATUS_CONFIG[order.orderStatus]?.label}</b>. Create shipment to assign AWB.</p>
                </div>
            )}

            {hasShipment ? (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginBottom: 12 }}>
                        {[
                            { label: "AWB Code", value: shipping.awbCode || "Generating…", mono: true },
                            { label: "Courier", value: shipping.courierName || "Standard" },
                            { label: "Shipment ID", value: shipping.shipmentId || "—", mono: true },
                            { label: "Status", value: shipping.status || "CREATED" },
                        ].map(({ label, value, mono }) => (
                            <div key={label} style={{ background: "var(--adm-bg)", border: `1px solid var(--adm-border)`, borderRadius: 8, padding: "8px 10px" }}>
                                <p style={{ fontSize: 9, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</p>
                                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-primary)", fontFamily: mono ? "'Courier New',monospace" : "inherit", wordBreak: "break-all", margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>
                    <ActionRow>
                        <button onClick={schedulePickup} disabled={scheduling} style={actionBtnStyle("primary", scheduling)}>
                            {scheduling ? <FiLoader size={11} style={{ animation: "ao-spin .8s linear infinite" }} /> : <FiCalendar size={11} />}
                            {scheduling ? "Scheduling…" : "Schedule Pickup"}
                        </button>
                        <button onClick={openLabel} disabled={loadingLabel} style={actionBtnStyle("neutral", loadingLabel)}>
                            {loadingLabel ? <FiLoader size={11} style={{ animation: "ao-spin .8s linear infinite" }} /> : <FiPrinter size={11} />}
                            Label {isMock && <span style={{ fontSize: 9, color: "var(--adm-muted)" }}>(Mock)</span>}
                        </button>
                        <button onClick={openManifest} disabled={loadingManifest} style={actionBtnStyle("neutral", loadingManifest)}>
                            {loadingManifest ? <FiLoader size={11} style={{ animation: "ao-spin .8s linear infinite" }} /> : <FiFileText size={11} />}
                            Manifest {isMock && <span style={{ fontSize: 9, color: "var(--adm-muted)" }}>(Mock)</span>}
                        </button>
                        <button onClick={fetchTracking} disabled={loadingTrack} style={actionBtnStyle("neutral", loadingTrack)}>
                            {loadingTrack ? <FiLoader size={11} style={{ animation: "ao-spin .8s linear infinite" }} /> : <FiNavigation size={11} />}
                            Live Track
                        </button>
                        {shipping.status !== "CANCELLED" && (
                            <button onClick={cancelSR} disabled={cancelling} style={actionBtnStyle("danger", cancelling)}>
                                {cancelling ? <FiLoader size={11} style={{ animation: "ao-spin .8s linear infinite" }} /> : <FiX size={11} />}
                                {cancelling ? "Cancelling…" : "Cancel Shipment"}
                            </button>
                        )}
                    </ActionRow>
                    {tracking && (
                        <div style={{ background: "var(--adm-bg)", border: `1px solid var(--adm-border)`, borderRadius: 10, padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Live Status</p>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-info)", background: "#f0f9ff", padding: "2px 8px", borderRadius: 6 }}>{tracking.label || tracking.status}</span>
                            </div>
                            {tracking.detail && <p style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginBottom: 6 }}>{tracking.detail}</p>}
                            {isMock && <p style={{ fontSize: 11, color: "var(--adm-warning)", fontStyle: "italic", margin: 0 }}>Mock tracking — real data after Shiprocket connection</p>}
                        </div>
                    )}
                </>
            ) : (
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-text-secondary)", whiteSpace: "nowrap" }}>Weight (g):</label>
                            <input type="number" value={weight} onChange={e => setWeight(Math.max(100, Number(e.target.value)))} min={100} step={50}
                                style={{ width: 80, padding: "6px 10px", background: "var(--adm-bg)", border: `1px solid var(--adm-border)`, borderRadius: 7, fontSize: 12, color: "var(--adm-text-primary)", outline: "none", fontFamily: "inherit" }} />
                        </div>
                        <button onClick={createShipment} disabled={creating} style={actionBtnStyle("primary", creating)}>
                            {creating ? <FiLoader size={11} style={{ animation: "ao-spin .8s linear infinite" }} /> : <FiTruck size={11} />}
                            {creating ? "Creating…" : "Create Shipment"}
                        </button>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 6, marginBottom: 0 }}>Create shipment after order is CONFIRMED or PACKED.</p>
                </div>
            )}
        </div>
    );
};

/* ── Refund Card ── */
const RefundCard = ({ order, onRefundUpdate, globalToast }) => {
    const [processing, setProcessing] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectNote, setRejectNote] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);
    const refund = order.refund;
    if (!refund || refund.status === "NONE") return null;
    const sc = { REQUESTED: "var(--adm-warning)", PROCESSING: "var(--adm-primary)", PROCESSED: "var(--adm-success)", REJECTED: "var(--adm-danger)", FAILED: "var(--adm-danger)" }[refund.status] || "var(--adm-muted)";

    const handleApprove = async () => {
        try { setProcessing(true); await api.put(`/orders/${order._id}/refund/process`, { action: "approve" }); onRefundUpdate(order._id, { ...order, refund: { ...refund, status: "PROCESSED" } }); globalToast("success", "Refund approved!"); }
        catch (err) { globalToast("error", err.response?.data?.message || "Refund failed"); }
        finally { setProcessing(false); }
    };
    const handleReject = async () => {
        try { setRejecting(true); await api.put(`/orders/${order._id}/refund/process`, { action: "reject", rejectionReason: rejectNote }); onRefundUpdate(order._id, { ...order, refund: { ...refund, status: "REJECTED" } }); setShowRejectInput(false); globalToast("success", "Refund rejected."); }
        catch (err) { globalToast("error", err.response?.data?.message || "Reject failed"); }
        finally { setRejecting(false); }
    };

    return (
        <div style={{ background: `${sc}08`, border: `1px solid ${sc}25`, padding: "12px 14px", borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: sc, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5 }}>
                    <FiRotateCcw size={10} /> Refund · {refund.status}
                </span>
                <span style={{ fontWeight: 800, fontSize: 14, color: sc }}>₹{Number(refund.amount || order.totalAmount).toLocaleString("en-IN")}</span>
            </div>
            {refund.reason && <p style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginBottom: 6 }}>Reason: {refund.reason}</p>}
            {refund.status === "REQUESTED" && (
                showRejectInput ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input type="text" value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Rejection reason (optional)"
                            style={{ width: "100%", padding: "8px 10px", background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 6, color: "var(--adm-text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                        <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={handleReject} disabled={rejecting} style={{ ...actionBtnStyle("danger", rejecting), flex: 1 }}>{rejecting ? "…" : "Confirm Reject"}</button>
                            <button onClick={() => setShowRejectInput(false)} style={{ ...actionBtnStyle("neutral"), flex: "0 0 auto" }}>Back</button>
                        </div>
                    </div>
                ) : (
                    <ActionRow>
                        <button onClick={handleApprove} disabled={processing} style={{ ...actionBtnStyle("success", processing), flex: 1 }}>{processing ? "Processing…" : "Approve Refund"}</button>
                        <button onClick={() => setShowRejectInput(true)} style={{ ...actionBtnStyle("danger"), flex: 1 }}>Reject</button>
                    </ActionRow>
                )
            )}
        </div>
    );
};

const CustomizationCard = ({ customization }) => {
    const hasText = customization?.text?.trim(), hasImage = customization?.imageUrl?.trim(), hasNote = customization?.note?.trim();
    if (!hasText && !hasImage && !hasNote) return null;
    return (
        <div style={{ marginTop: 10, background: "#fef3c7", border: "1px solid #fde68a", padding: "10px 12px", borderRadius: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#92400e", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Customization Required</p>
            {hasText && <p style={{ fontSize: 12, color: "var(--adm-text-primary)", margin: "0 0 2px" }}><span style={{ color: "#d97706", fontWeight: 700 }}>Print: </span>{customization.text}</p>}
            {hasNote && <p style={{ fontSize: 12, color: "var(--adm-text-secondary)", margin: "2px 0 0" }}><span style={{ color: "#d97706", fontWeight: 700 }}>Note: </span>{customization.note}</p>}
            {hasImage && <a href={customization.imageUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 6 }}>
                <img src={customization.imageUrl} alt="custom" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 7, border: "1px solid #fde68a" }} />
            </a>}
        </div>
    );
};

/* Compact info tile used in the customer-info grid and the payment-summary card */
const InfoTile = ({ icon: Icon, label, value }) => (
    <div style={{ background: "var(--adm-bg)", border: `1px solid var(--adm-border)`, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
        {Icon && <Icon size={13} color={"var(--adm-muted)"} style={{ marginTop: 2, flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, color: "var(--adm-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--adm-text-secondary)", fontWeight: 500, marginTop: 1, wordBreak: "break-word" }}>{value ?? "—"}</div>
        </div>
    </div>
);

/* ── Order Progress stepper — FIX v4.0: current-step index is computed
   ONCE outside the .map() instead of calling flowSteps.indexOf(...)
   again on every single step (was 6 redundant lookups per render for a
   6-step flow). ── */
const OrderProgress = ({ order, flowSteps }) => {
    const stepIdx = flowSteps.indexOf(order.orderStatus);
    return (
        <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--adm-muted)", marginBottom: 10 }}>Order Progress</p>
            <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
                {flowSteps.map((step, idx) => {
                    const done = idx <= stepIdx, active = idx === stepIdx;
                    return (
                        <div key={step} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 26, height: 26, borderRadius: "50%", background: done ? (active ? "var(--adm-primary)" : "#dbeafe") : "var(--adm-border-soft)", border: `2px solid ${done ? "var(--adm-primary)" : "var(--adm-border)"}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 0 0 3px var(--adm-primary-tint)` : "none" }}>
                                    {done ? <FiCheckCircle size={12} color={active ? "#fff" : "var(--adm-primary)"} /> : <FiClock size={10} color={"var(--adm-muted)"} />}
                                </div>
                                <span className="ao-progress-label" style={{ fontSize: 8, fontWeight: 600, color: done ? "var(--adm-primary)" : "var(--adm-muted)", textAlign: "center", maxWidth: 48, lineHeight: 1.3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                    {STATUS_CONFIG[step]?.label.split(" ")[0]}
                                </span>
                            </div>
                            {idx < flowSteps.length - 1 && <div style={{ width: 20, height: 2, background: idx < stepIdx ? "var(--adm-primary)" : "var(--adm-border)", margin: "0 2px", marginBottom: 16, borderRadius: 2 }} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* Left-column list row — compact, no duplicated detail info (that all
   lives in the detail panel now, so the list card doesn't repeat it). */
const OrderListRow = ({ order, active, onClick, onDownload, downloading }) => {
    const cfg = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.PLACED;
    return (
        <div onClick={onClick} className="ao-list-row"
            style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                border: active ? `1px solid var(--adm-primary)` : `1px solid var(--adm-border)`,
                background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)", marginBottom: 8,
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FiPackage size={14} color={cfg.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--adm-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                        #{order._id.slice(-6).toUpperCase()}
                        <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "1px 6px", borderRadius: 4 }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--adm-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
                        {order.customerName} · {order.phone}
                    </div>
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: "var(--adm-success)" }}>₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}</span>
                <button onClick={onDownload} disabled={downloading}
                    style={{ padding: "3px 8px", background: "var(--adm-surface-alt)", border: `1px solid var(--adm-border)`, borderRadius: 6, fontSize: 10, fontWeight: 700, color: "var(--adm-text-secondary)", cursor: "pointer" }}>
                    {downloading ? <FiLoader size={9} style={{ animation: "ao-spin .8s linear infinite" }} /> : "PDF"}
                </button>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════ */
const AdminOrders = () => {
    const location = useLocation();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [filterStatus, setFilterStatus] = useState("ALL");
    // FIX v4.0: replaces the old `expandedId` accordion-toggle with
    // `selectedId`, since the layout is now a persistent split view
    // (list stays visible, detail renders alongside it) rather than an
    // expand/collapse-in-place row.
    const [selectedId, setSelectedId] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [orderMode, setOrderMode] = useState("ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [forceAssignOrderId, setForceAssignOrderId] = useState(null);
    const [onlineRiders, setOnlineRiders] = useState([]);
    const [loadingRiders, setLoadingRiders] = useState(false);
    const [selectedRiderId, setSelectedRiderId] = useState("");
    const [assigningRider, setAssigningRider] = useState(false);

    const [activeAssignments, setActiveAssignments] = useState([]);

    const [wsMessage, setWsMessage] = useState(null);
    const liveRefreshTimer = useRef(null);
    const { send: wsSend, lastMessage: adminWsMessage, connected: adminWsConnected } = useAdminWsContext();

    useEffect(() => {
        const msg = adminWsMessage;
        if (msg?.type === "rider_location") { setWsMessage(msg); return; }
        if (msg?.type === "admin:order_event") {
            clearTimeout(liveRefreshTimer.current);
            liveRefreshTimer.current = setTimeout(() => {
                fetchOrders({ page: currentPage, status: filterStatus, search: searchQuery, mode: orderMode });
            }, 800);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adminWsMessage, currentPage, filterStatus, searchQuery, orderMode]);

    const { toast, show: showToast } = useToast();
    const toastSuccess = useCallback((msg) => showToast("success", msg), [showToast]);
    const toastError = useCallback((msg) => showToast("error", msg), [showToast]);
    const toastInfo = useCallback((msg) => showToast("info", msg, 5000), [showToast]);
    const globalToast = useCallback((type, msg) => {
        if (type === "info") toastInfo(msg); else if (type === "success") toastSuccess(msg); else toastError(msg);
    }, [toastInfo, toastSuccess, toastError]);

    const fetchOrders = useCallback(async ({ page = 1, status = "ALL", search = "", mode = "ALL" } = {}) => {
        try {
            setError(""); setLoading(true);
            const params = { page, limit: PAGE_LIMIT };
            if (status && status !== "ALL") params.status = status;
            if (mode && mode !== "ALL") params.orderMode = mode;
            if (search.trim()) params.search = search.trim();
            const { data } = await api.get("/orders", { params });
            const list = Array.isArray(data?.orders) ? data.orders : Array.isArray(data) ? data : [];
            setOrders(list);
            setTotalOrders(data?.total || list.length);
            setTotalPages(data?.totalPages || 1);
            setCurrentPage(data?.page || page);
        } catch (err) {
            setError(err.response?.status === 403 ? "Access denied." : "Failed to load orders. Please refresh.");
            setOrders([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    useEffect(() => {
        const pollActiveAssignments = () => {
            api.get("/admin/assignments/active")
                .then(({ data }) => setActiveAssignments(data?.assignments || []))
                .catch(() => { });
        };
        pollActiveAssignments();
        const interval = setInterval(pollActiveAssignments, 8000);
        return () => clearInterval(interval);
    }, []);

    const openForceAssign = useCallback(async (orderId) => {
        setForceAssignOrderId(orderId);
        setSelectedRiderId("");
        setLoadingRiders(true);
        try {
            const { data } = await api.get("/admin/delivery-boys/online");
            setOnlineRiders(data?.riders || []);
        } catch {
            setOnlineRiders([]);
        } finally {
            setLoadingRiders(false);
        }
    }, []);

    const closeForceAssign = useCallback(() => {
        setForceAssignOrderId(null);
        setOnlineRiders([]);
        setSelectedRiderId("");
    }, []);

    const submitForceAssign = useCallback(async () => {
        if (!forceAssignOrderId || !selectedRiderId) return;
        setAssigningRider(true);
        try {
            const { data } = await api.post(`/admin/orders/${forceAssignOrderId}/assign-rider`, { riderId: selectedRiderId });
            globalToast("success", data?.message || "Rider assigned");
            closeForceAssign();
            fetchOrders({ page: currentPage, status: filterStatus, search: searchQuery, mode: orderMode });
        } catch (err) {
            globalToast("error", err.response?.data?.message || "Failed to assign rider");
        } finally {
            setAssigningRider(false);
        }
    }, [forceAssignOrderId, selectedRiderId, globalToast, closeForceAssign, fetchOrders, currentPage, filterStatus, searchQuery, orderMode]);

    // Auto-select if ?expand=orderId in URL (from dashboard click)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const expandId = params.get("expand");
        if (expandId) setSelectedId(expandId);
    }, [location.search]);

    // Keep selection valid: if the current page no longer contains the
    // selected order, fall back to the first row instead of showing a
    // blank detail panel.
    useEffect(() => {
        if (orders.length === 0) { setSelectedId(null); return; }
        if (!orders.some(o => o._id === selectedId)) setSelectedId(orders[0]._id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orders]);

    const goToPage = useCallback((page) => {
        window.scrollTo(0, 0);
        fetchOrders({ page, status: filterStatus, search: searchQuery, mode: orderMode });
    }, [fetchOrders, filterStatus, searchQuery, orderMode]);

    const handleFilterChange = useCallback((key) => {
        setFilterStatus(key); setCurrentPage(1);
        fetchOrders({ page: 1, status: key, search: searchQuery, mode: orderMode });
    }, [fetchOrders, searchQuery, orderMode]);

    const handleSearch = useCallback((value) => {
        setSearchQuery(value); setFilterStatus("ALL"); setCurrentPage(1);
        fetchOrders({ page: 1, status: "ALL", search: value, mode: orderMode });
    }, [fetchOrders, orderMode]);

    const clearSearch = useCallback(() => {
        setSearchInput(""); setSearchQuery("");
        fetchOrders({ page: 1, status: filterStatus, search: "", mode: orderMode });
    }, [fetchOrders, filterStatus, orderMode]);

    const refreshOrders = useCallback(async () => {
        setRefreshing(true);
        await fetchOrders({ page: currentPage, status: filterStatus, search: searchQuery, mode: orderMode });
        setRefreshing(false);
    }, [fetchOrders, currentPage, filterStatus, searchQuery, orderMode]);

    const handleModeChange = useCallback((mode) => {
        setOrderMode(mode); setCurrentPage(1); setFilterStatus("ALL");
        fetchOrders({ page: 1, status: "ALL", search: searchQuery, mode });
    }, [fetchOrders, searchQuery]);

    const handleOrderUpdate = useCallback((orderId, updatedOrder) => {
        setOrders(prev => prev.map(o => o._id === orderId ? updatedOrder : o));
    }, []);

    const updateStatus = useCallback(async (orderId, nextStatus) => {
        if (!nextStatus) return;
        try {
            setUpdatingId(orderId);
            const { data: updated } = await api.put(`/orders/${orderId}`, { orderStatus: nextStatus });
            if (updated?._id) { setOrders(prev => prev.map(o => o._id === orderId ? updated : o)); }
            else { setOrders(prev => prev.map(o => o._id === orderId ? { ...o, orderStatus: nextStatus } : o)); }
            toastSuccess(`Order marked as ${STATUS_CONFIG[nextStatus]?.label}`);
        } catch (err) { toastError(err.response?.data?.message || err.response?.data?.error || "Failed to update status"); }
        finally { setUpdatingId(null); }
    }, [toastSuccess, toastError]);

    const handleDownloadInvoice = useCallback(async (orderId, e) => {
        e?.stopPropagation?.();
        try {
            setDownloadingId(orderId);
            const response = await api.get(`/invoice/${orderId}/download`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
            const link = document.createElement("a");
            link.href = url; link.setAttribute("download", `Urbexon_Invoice_${orderId.slice(-8).toUpperCase()}.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
            window.URL.revokeObjectURL(url);
            toastSuccess("Invoice downloaded!");
        } catch (err) {
            toastError(err.response?.status === 404
                ? "Invoice route not found — verify /api/invoice is mounted in server.js"
                : err.response?.data?.message || "Failed to download invoice");
        } finally { setDownloadingId(null); }
    }, [toastSuccess, toastError]);

    const filters = [
        { key: "ALL", label: "All" },
        ...FLOW_STEPS.map(s => ({ key: s, label: STATUS_CONFIG[s]?.label, dot: STATUS_CONFIG[s]?.color })),
        { key: "READY_FOR_PICKUP", label: "Ready for Pickup", dot: STATUS_CONFIG.READY_FOR_PICKUP.color },
        { key: "CANCELLED", label: "Cancelled", dot: STATUS_CONFIG.CANCELLED.color },
    ];

    const selectedOrder = useMemo(() => orders.find(o => o._id === selectedId) || null, [orders, selectedId]);

    if (loading && orders.length === 0) return (
        <div style={{ padding: 4 }}>
            <Skeleton height={28} width={160} radius={6} style={{ marginBottom: 16 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                        <Skeleton width={36} height={36} radius={9} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                            <Skeleton height={13} width="40%" />
                            <Skeleton height={11} width="60%" />
                        </div>
                        <Skeleton height={22} width={80} radius={99} />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)", width: "100%", minWidth: 0 }}>
            <style>{`
                @keyframes ao-spin    { to { transform: rotate(360deg); } }
                @keyframes ao-fadeUp  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
                .ao-list-row { transition: border-color .15s, background .15s; }
                .ao-list-row:hover { border-color: #93c5fd !important; }
                .ao-filter { transition: all .15s; cursor: pointer; }
                .ao-filter:hover { border-color: #93c5fd !important; color: #1d4ed8 !important; }
                .ao-panel { animation: ao-fadeUp .2s ease; }
                button:disabled { cursor: not-allowed; }
                .ao-split { display: grid; grid-template-columns: 320px 1fr 300px; gap: 16px; align-items: start; }
                @media (max-width: 1100px) {
                    .ao-split { grid-template-columns: 280px 1fr; }
                    .ao-summary-col { grid-column: 1 / -1; }
                }
                @media (max-width: 780px) {
                    .ao-split { grid-template-columns: 1fr; }
                    .ao-list-col.ao-has-selection { display: none; }
                }
            `}</style>

            <Toast toast={toast} />

            {activeAssignments.length > 0 && (
                <div style={{
                    marginBottom: 16, padding: "10px 14px", borderRadius: 10,
                    background: "var(--adm-primary-tint)", border: `1px solid #dbeafe`,
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                }}>
                    <FiNavigation size={13} color={"var(--adm-primary)"} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-primary)" }}>
                        {activeAssignments.length} order{activeAssignments.length > 1 ? "s" : ""} searching for a rider right now
                    </span>
                    <span style={{ fontSize: 12, color: "var(--adm-muted)" }}>
                        {activeAssignments.map((a) => `#${String(a.orderId).slice(-6).toUpperCase()} (round ${a.round}, ${a.pendingRiders} offered)`).join(" · ")}
                    </span>
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", margin: 0, letterSpacing: "-0.3px" }}>Orders</h1>
                        <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 3 }}>{totalOrders} total orders</p>
                    </div>
                    <button onClick={refreshOrders} disabled={refreshing} style={actionBtnStyle("neutral", refreshing)}>
                        <FiRefreshCw size={13} style={{ animation: refreshing ? "ao-spin .8s linear infinite" : "none" }} />
                        {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
                <SearchBar
                    value={searchInput}
                    onChange={(v) => { setSearchInput(v); if (v === "") clearSearch(); }}
                    placeholder="Search by Order ID, Customer, Phone…"
                    onSubmit={handleSearch}
                />
            </div>

            {/* Order Mode Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {[
                    { key: "ALL", label: "All Orders" },
                    { key: "ECOMMERCE", label: "Ecommerce", color: "var(--adm-primary)" },
                    { key: "URBEXON_HOUR", label: "Urbexon Hour", color: "var(--adm-warning)" },
                ].map(({ key, label, color }) => {
                    const active = orderMode === key;
                    return (
                        <button key={key} onClick={() => handleModeChange(key)}
                            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", borderBottom: active ? `3px solid ${color || "var(--adm-primary)"}` : "3px solid transparent", background: active ? (color ? `${color}10` : "var(--adm-primary-tint)") : "transparent", color: active ? (color || "var(--adm-primary)") : "var(--adm-text-secondary)", cursor: "pointer", fontFamily: "inherit", borderRadius: "8px 8px 0 0", transition: "all .15s" }}>
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16, scrollbarWidth: "none" }}>
                {filters.map(({ key, label, dot }) => {
                    const active = filterStatus === key;
                    return (
                        <button key={key} onClick={() => handleFilterChange(key)} className="ao-filter"
                            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", fontSize: 12, fontWeight: 600, border: active ? `1px solid var(--adm-primary)` : `1px solid var(--adm-border)`, background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)", color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)", cursor: "pointer", fontFamily: "inherit", borderRadius: 8 }}>
                            {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />}
                            {label}
                        </button>
                    );
                })}
            </div>

            {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "var(--adm-danger)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <FiAlertCircle size={13} /> {error}
                </div>
            )}

            {orders.length === 0 && !loading ? (
                <EmptyState icon={FiPackage} title="No orders found" description="Try adjusting your filters or search." />
            ) : (
                <div className="ao-split">
                    {/* ── Column 1: Order list ── */}
                    <div className={`ao-list-col ${selectedId ? "ao-has-selection" : ""}`}>
                        {orders.map((order) => (
                            <OrderListRow
                                key={order._id}
                                order={order}
                                active={selectedId === order._id}
                                onClick={() => setSelectedId(order._id)}
                                onDownload={(e) => handleDownloadInvoice(order._id, e)}
                                downloading={downloadingId === order._id}
                            />
                        ))}
                        {totalPages > 1 && (
                            <div style={{ marginTop: 8 }}>
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
                            </div>
                        )}
                    </div>

                    {/* ── Column 2 + 3: Detail + Summary ── */}
                    {selectedOrder ? (() => {
                        const order = selectedOrder;
                        const cfg = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.PLACED;
                        const isUH = order.orderMode === "URBEXON_HOUR";
                        const flowMap = isUH ? UH_FLOW : FLOW;
                        const flowSteps = isUH ? UH_FLOW_STEPS : FLOW_STEPS;
                        const next = flowMap[order.orderStatus];
                        const isCancelled = order.orderStatus === "CANCELLED";
                        const isDelivered = order.orderStatus === "DELIVERED";
                        const isUpdating = updatingId === order._id;

                        return (
                            <>
                                {/* Column 2: Order detail */}
                                <div className="ao-panel" style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 12, padding: 18 }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                                        <div>
                                            <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: 0 }}>Order ID</p>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                                                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>#{order._id.slice(-6).toUpperCase()}</h2>
                                                <StatusBadge status={order.orderStatus} />
                                                {isUH && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--adm-warning)", background: "#fff7ed", padding: "2px 7px", borderRadius: 4, border: "1px solid #fed7aa" }}>URBEXON HOUR</span>}
                                            </div>
                                            {order.createdAt && (
                                                <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 4 }}>
                                                    Placed on {new Date(order.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            )}
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--adm-success)", margin: 0 }}>₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}</p>
                                            <button onClick={(e) => handleDownloadInvoice(order._id, e)} disabled={downloadingId === order._id} style={{ ...actionBtnStyle("neutral"), marginTop: 6 }}>
                                                {downloadingId === order._id ? <FiLoader size={12} style={{ animation: "ao-spin .8s linear infinite" }} /> : <FiFileText size={12} />}
                                                PDF Invoice
                                            </button>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--adm-muted)", marginBottom: 8 }}>Customer Information</p>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 16 }}>
                                        <InfoTile icon={FiUser} label="Name" value={order.customerName} />
                                        <InfoTile icon={FiPhone} label="Phone" value={order.phone} />
                                        <InfoTile icon={FiMapPin} label="Address" value={order.address} />
                                    </div>

                                    {isUH ? (
                                        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                                <FiTruck size={14} color="var(--adm-warning)" />
                                                <div>
                                                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-warning)", margin: 0 }}>Urbexon Hour — Local Delivery</p>
                                                    <p style={{ fontSize: 10, color: "var(--adm-muted)", margin: 0 }}>Express 45–120 min delivery</p>
                                                </div>
                                            </div>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
                                                {[
                                                    { label: "Provider", value: order.delivery?.provider?.replace(/_/g, " ") || "Pending" },
                                                    { label: "Rider", value: order.delivery?.riderName || "Not assigned" },
                                                    { label: "Rider Phone", value: order.delivery?.riderPhone || "—" },
                                                    { label: "ETA", value: order.delivery?.eta || "45–120 min" },
                                                    { label: "Distance", value: order.delivery?.distanceKm ? `${order.delivery.distanceKm} km` : "—" },
                                                    { label: "Delivery Status", value: order.delivery?.status?.replace(/_/g, " ") || "—" },
                                                ].map(({ label, value }) => (
                                                    <div key={label} style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 8, padding: "8px 10px" }}>
                                                        <p style={{ fontSize: 9, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</p>
                                                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>{value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {!order.delivery?.assignedTo && !isDelivered && !isCancelled && (
                                                <ActionRow>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await api.post(`/admin/orders/${order._id}/start-assignment`);
                                                                globalToast("success", "Assignment engine started — searching for riders");
                                                                fetchOrders({ page: currentPage, status: filterStatus, search: searchQuery, mode: orderMode });
                                                            } catch (err) { globalToast("error", err.response?.data?.message || "Failed to start assignment"); }
                                                        }}
                                                        style={actionBtnStyle("warning")}
                                                    >
                                                        <FiNavigation size={12} /> Start Auto-Assign
                                                    </button>
                                                    <button onClick={() => openForceAssign(order._id)} style={actionBtnStyle("warningOutline")}>
                                                        <FiUserPlus size={12} /> Force Assign Rider
                                                    </button>
                                                </ActionRow>
                                            )}

                                            {!!order.delivery?.assignedTo && !["DELIVERED", "CANCELLED"].includes(order.orderStatus) && (
                                                <div style={{ marginTop: 12 }}>
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-warning)" }}>🗺️ Live Rider Tracking</span>
                                                        <span style={{ fontSize: 9, fontWeight: 700, color: "#059669", background: "#dcfce7", border: "1px solid #86efac", padding: "2px 8px", borderRadius: 12 }}>LIVE</span>
                                                    </div>
                                                    <AdminTrackingMap
                                                        orderId={order._id}
                                                        riderName={order.delivery?.riderName || "Rider"}
                                                        destLat={order.latitude}
                                                        destLng={order.longitude}
                                                        destLabel={order.address || "Customer"}
                                                        vendorLabel={order.vendorId?.shopName || "Pickup Point"}
                                                        height={180}
                                                        api={api}
                                                        wsMessage={wsMessage}
                                                        wsSend={wsSend}
                                                        wsConnected={adminWsConnected}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <ShiprocketPanel order={order} onOrderUpdate={handleOrderUpdate} globalToast={globalToast} />
                                    )}

                                    <OrderProgress order={order} flowSteps={flowSteps} />

                                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--adm-muted)", marginBottom: 8 }}>Order Actions</p>
                                    <ActionRow>
                                        {!isCancelled && next && (
                                            <button onClick={() => updateStatus(order._id, next)} disabled={isUpdating} style={actionBtnStyle("primary", isUpdating)}>
                                                {isUpdating ? <FiLoader size={12} style={{ animation: "ao-spin .8s linear infinite" }} /> : <FiTruck size={13} />}
                                                {isUpdating ? "Updating…" : `Mark as ${STATUS_CONFIG[next]?.label}`}
                                            </button>
                                        )}
                                        {!isCancelled && !isDelivered && (
                                            <button onClick={() => updateStatus(order._id, "CANCELLED")} disabled={isUpdating} style={actionBtnStyle("danger", isUpdating)}>
                                                <FiX size={13} /> Cancel Order
                                            </button>
                                        )}
                                        {isDelivered && <span style={{ ...actionBtnStyle("success"), cursor: "default" }}><FiCheckCircle size={13} /> Delivered</span>}
                                        {isCancelled && <span style={{ color: "var(--adm-danger)", fontWeight: 700, fontSize: 12.5, padding: "9px 4px" }}>Order Cancelled</span>}
                                        {!isCancelled && (
                                            <a href={`https://wa.me/91${order.phone}?text=${encodeURIComponent(`Hi ${order.customerName}! Your order #${order._id.slice(-6).toUpperCase()} is now ${cfg.label}. Thank you for shopping with UrbeXon!`)}`}
                                                target="_blank" rel="noreferrer" style={actionBtnStyle("success")}>
                                                <FaWhatsapp size={14} /> WhatsApp
                                            </a>
                                        )}
                                    </ActionRow>

                                    {order.refund?.status && order.refund.status !== "NONE" && (
                                        <RefundCard order={order} onRefundUpdate={handleOrderUpdate} globalToast={globalToast} />
                                    )}
                                </div>

                                {/* Column 3: Items, Payment, Timeline */}
                                <div className="ao-summary-col" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                    <div className="ao-panel" style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 12, padding: 16 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                                            <FiPackage size={13} color="var(--adm-muted)" />
                                            <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>Order Items</p>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {order.items?.map((item, idx) => (
                                                <div key={idx} style={{ background: "var(--adm-bg)", border: `1px solid var(--adm-border)`, borderRadius: 10, padding: 10 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <div style={{ width: 42, height: 42, background: "var(--adm-surface-alt)", border: `1px solid var(--adm-border)`, borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                            {item.image
                                                                ? <img src={imgUrl.thumbnail(item.image)} alt={item.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} onError={e => { e.target.style.display = "none"; }} />
                                                                : <FiPackage size={14} color={"var(--adm-muted)"} />}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontWeight: 600, fontSize: 12.5, color: "var(--adm-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{item.name}</p>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                                                                <span style={{ fontSize: 11, color: "var(--adm-text-secondary)" }}>Qty: {item.qty}</span>
                                                                {item.selectedSize && <span style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#d97706", fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>{item.selectedSize}</span>}
                                                            </div>
                                                        </div>
                                                        <p style={{ fontWeight: 700, fontSize: 13, color: "var(--adm-text-primary)", flexShrink: 0, margin: 0 }}>₹{(item.price * item.qty).toLocaleString("en-IN")}</p>
                                                    </div>
                                                    <CustomizationCard customization={item.customization} />
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: `1px solid var(--adm-border)` }}>
                                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--adm-text-secondary)" }}>Total Amount</span>
                                            <span style={{ fontWeight: 800, fontSize: 18, color: "var(--adm-success)" }}>₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}</span>
                                        </div>
                                    </div>

                                    <div className="ao-panel" style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 12, padding: 16 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                                            <FiCreditCard size={13} color="var(--adm-muted)" />
                                            <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>Payment Summary</p>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {[
                                                { label: "Payment Method", value: order.paymentMethod || "Cash on Delivery" },
                                                { label: "Order Type", value: order.paymentMethod === "ONLINE" ? "Prepaid" : "COD" },
                                                { label: "Amount Paid", value: `₹${Number(order.amountPaid || (order.paymentMethod === "ONLINE" ? order.totalAmount : 0) || 0).toLocaleString("en-IN")}` },
                                                { label: "Due Amount", value: `₹${Number(order.dueAmount ?? (order.paymentMethod === "ONLINE" ? 0 : order.totalAmount) ?? 0).toLocaleString("en-IN")}` },
                                            ].map(({ label, value }) => (
                                                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                                                    <span style={{ color: "var(--adm-muted)" }}>{label}</span>
                                                    <span style={{ fontWeight: 700, color: "var(--adm-text-primary)" }}>{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {Array.isArray(order.timeline) && order.timeline.length > 0 && (
                                        <div className="ao-panel" style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 12, padding: 16 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                                                <FiClipboard size={13} color="var(--adm-muted)" />
                                                <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>Order Timeline</p>
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                                {order.timeline.map((t, idx) => (
                                                    <div key={idx} style={{ display: "flex", gap: 10 }}>
                                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--adm-primary)", flexShrink: 0, marginTop: 3 }} />
                                                            {idx < order.timeline.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--adm-border)", marginTop: 2 }} />}
                                                        </div>
                                                        <div style={{ paddingBottom: 2 }}>
                                                            <p style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>{t.label || t.status}</p>
                                                            {t.timestamp && <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>{new Date(t.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                    })() : (
                        <div className="ao-panel" style={{ gridColumn: "2 / -1", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "var(--adm-muted)", fontSize: 13 }}>
                            Select an order to see details
                        </div>
                    )}
                </div>
            )}

            {/* Force Assign Rider modal */}
            <Modal
                open={!!forceAssignOrderId}
                onClose={closeForceAssign}
                title="Force Assign Rider"
                footer={
                    <>
                        <Button variant="secondary" onClick={closeForceAssign}>Cancel</Button>
                        <Button
                            variant="primary"
                            icon={FiUserPlus}
                            loading={assigningRider}
                            disabled={!selectedRiderId}
                            onClick={submitForceAssign}
                        >
                            Assign
                        </Button>
                    </>
                }
            >
                {loadingRiders ? (
                    <p style={{ fontSize: 13, color: "var(--adm-muted)" }}>Loading online riders…</p>
                ) : onlineRiders.length === 0 ? (
                    <EmptyState
                        icon={FiTruck}
                        title="No riders online"
                        description="No approved delivery partners are currently online to assign."
                    />
                ) : (
                    <Select value={selectedRiderId} onChange={(e) => setSelectedRiderId(e.target.value)}>
                        <option value="">Select a rider…</option>
                        {onlineRiders.map((r) => (
                            <option key={r._id} value={r._id}>
                                {r.name} — {r.phone}{r.activeOrders ? ` (${r.activeOrders} active)` : ""}
                            </option>
                        ))}
                    </Select>
                )}
            </Modal>
        </div>
    );
};

export default AdminOrders;