/**
 * AdminRefundReturn.jsx
 * Renders flush inside Admin.jsx's zero-padding main area.
 * Manages its own sticky header + scrollable content.
 */
import { useEffect, useState, useCallback } from "react";
import api from "../api/adminApi";
import {
    FaSync, FaUser, FaPhone, FaMapMarkerAlt,
    FaCheckCircle, FaBan, FaMoneyBillWave, FaUndo,
    FaExclamationTriangle, FaSpinner, FaChevronDown,
    FaChevronUp, FaFlag, FaBoxOpen, FaExchangeAlt,
} from "react-icons/fa";

/* ─── Status config ─── */
const REFUND_CFG = {
    NONE: { cls: "badge-neutral", label: "None" },
    REQUESTED: { cls: "badge-amber", label: "Requested" },
    PROCESSING: { cls: "badge-blue", label: "Processing" },
    PROCESSED: { cls: "badge-green", label: "Processed" },
    REJECTED: { cls: "badge-red", label: "Rejected" },
    FAILED: { cls: "badge-rose", label: "Failed" },
};
const RETURN_CFG = {
    NONE: { cls: "badge-neutral", label: "None" },
    REQUESTED: { cls: "badge-amber", label: "Requested" },
    APPROVED: { cls: "badge-green", label: "Approved" },
    REJECTED: { cls: "badge-red", label: "Rejected" },
    PICKED_UP: { cls: "badge-blue", label: "Picked Up" },
    REFUNDED: { cls: "badge-violet", label: "Refunded" },
};

const STYLES = `
    .rr-root {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        height: calc(100vh - 54px); /* full viewport minus topbar */
        background: #f8fafc;
    }

    /* Sticky page header */
    .rr-header {
        background: #fff;
        border-bottom: 1px solid #e2e8f0;
        padding: 16px 24px 0;
        flex-shrink: 0;
        position: sticky;
        top: 0;
        z-index: 10;
    }
    .rr-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
    }
    .rr-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
    .rr-sub   { font-size: 12px; color: #94a3b8; margin: 3px 0 0; }

    .rr-refresh {
        display: flex; align-items: center; gap: 6px;
        padding: 7px 14px;
        font-size: 12px; font-weight: 600; color: #475569;
        background: #f1f5f9; border: 1px solid #e2e8f0;
        border-radius: 8px; cursor: pointer; white-space: nowrap;
        transition: background 0.15s;
        font-family: inherit;
    }
    .rr-refresh:hover:not(:disabled) { background: #e2e8f0; }
    .rr-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Tabs */
    .rr-tabs { display: flex; gap: 4px; }
    .rr-tab {
        display: flex; align-items: center; gap: 7px;
        padding: 9px 16px;
        font-size: 13px; font-weight: 600;
        border: none; border-bottom: 2px solid transparent;
        background: none; cursor: pointer; color: #64748b;
        transition: all 0.15s; font-family: inherit;
        border-radius: 8px 8px 0 0;
    }
    .rr-tab:hover { color: #1e293b; background: #f8fafc; }
    .rr-tab.active { color: #2563eb; border-bottom-color: #2563eb; background: #eff6ff; }
    .rr-tab-count {
        font-size: 11px; font-weight: 700;
        padding: 1px 7px; border-radius: 20px;
        background: #e2e8f0; color: #64748b;
    }
    .rr-tab.active .rr-tab-count { background: #dbeafe; color: #2563eb; }

    /* Scrollable content */
    .rr-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
    }

    /* Cards */
    .rr-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        overflow: hidden;
        margin-bottom: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .rr-card.failed { border-color: #fecdd3; }
    .rr-card.flagged { border-color: #fecdd3; }

    .rr-card-header {
        display: flex; align-items: center; gap: 14px;
        padding: 14px 18px;
        cursor: pointer; border: none; background: none;
        width: 100%; text-align: left;
        transition: background 0.12s;
    }
    .rr-card-header:hover { background: #f8fafc; }
    .rr-card.flagged .rr-card-header:hover { background: #fff1f2; }

    .rr-icon-wrap {
        width: 38px; height: 38px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
    }
    .rr-icon-amber  { background: #fffbeb; border: 1px solid #fde68a; color: #d97706; }
    .rr-icon-violet { background: #f5f3ff; border: 1px solid #ddd6fe; color: #7c3aed; }
    .rr-icon-rose   { background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48; }

    .rr-card-info { flex: 1; min-width: 0; }
    .rr-card-name { font-weight: 600; font-size: 14px; color: #1e293b; }
    .rr-card-sub  { font-size: 12px; color: #94a3b8; margin-top: 2px;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .rr-card-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .rr-amount { font-weight: 700; font-size: 14px; color: #10b981; }
    .rr-chevron { color: #cbd5e1; }

    /* Expanded body */
    .rr-card-body {
        border-top: 1px solid #f1f5f9;
        padding: 16px 18px;
    }

    .rr-info-box {
        background: #f8fafc;
        border: 1px solid #f1f5f9;
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 14px;
        display: flex; flex-direction: column; gap: 7px;
        font-size: 13px;
    }
    .rr-info-row { display: flex; align-items: flex-start; gap: 8px; color: #475569; }
    .rr-info-row svg { color: #f59e0b; margin-top: 2px; flex-shrink: 0; }
    .rr-info-meta { font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.6; }

    /* Items list */
    .rr-items-label {
        font-size: 11px; font-weight: 700; color: #94a3b8;
        letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px;
    }
    .rr-item-row {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 0;
        border-bottom: 1px solid #f1f5f9;
    }
    .rr-item-row:last-child { border-bottom: none; }
    .rr-item-img { width: 36px; height: 36px; border-radius: 8px; object-fit: contain; border: 1px solid #f1f5f9; background: #f8fafc; flex-shrink: 0; }
    .rr-item-name { font-size: 13px; font-weight: 500; color: #1e293b; }
    .rr-item-qty  { font-size: 12px; color: #94a3b8; }
    .rr-item-price { font-size: 13px; font-weight: 600; color: #334155; margin-left: auto; flex-shrink: 0; }

    /* Actions */
    .rr-textarea, .rr-input {
        width: 100%;
        padding: 9px 12px;
        font-size: 13px;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
        background: #fff;
        resize: none;
    }
    .rr-textarea:focus, .rr-input:focus {
        border-color: #93c5fd;
        box-shadow: 0 0 0 3px rgba(147,197,253,0.25);
    }
    .rr-label { font-size: 12px; font-weight: 600; color: #64748b; display: block; margin-bottom: 5px; }

    .rr-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    .rr-btn {
        display: flex; align-items: center; justify-content: center; gap: 7px;
        padding: 10px;
        border-radius: 9px; border: none; cursor: pointer;
        font-size: 13px; font-weight: 600; font-family: inherit;
        transition: opacity 0.15s, filter 0.15s;
    }
    .rr-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .rr-btn:not(:disabled):hover { filter: brightness(0.94); }
    .rr-btn-green  { background: #10b981; color: #fff; }
    .rr-btn-red    { background: #ef4444; color: #fff; }
    .rr-btn-orange { background: #f97316; color: #fff; grid-column: 1 / -1; }

    /* Badges */
    .badge {
        display: inline-flex; align-items: center;
        font-size: 11px; font-weight: 700;
        padding: 2px 8px; border-radius: 20px;
    }
    .badge-neutral { background: #f1f5f9; color: #64748b; }
    .badge-amber   { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-blue    { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-green   { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-red     { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-rose    { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
    .badge-violet  { background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe; }

    /* Flag chips */
    .rr-flag-chip {
        font-size: 11px; font-weight: 600;
        background: #fff1f2; color: #be123c;
        border: 1px solid #fecdd3;
        padding: 3px 10px; border-radius: 8px;
    }

    /* Empty state */
    .rr-empty {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 80px 24px; text-align: center;
    }
    .rr-empty-icon {
        width: 56px; height: 56px; border-radius: 14px;
        background: #f1f5f9; display: flex; align-items: center;
        justify-content: center; color: #cbd5e1; margin-bottom: 14px;
    }
    .rr-empty-text { font-size: 14px; font-weight: 600; color: #64748b; }
    .rr-empty-sub  { font-size: 12px; color: #94a3b8; margin-top: 4px; }

    /* Loader */
    .rr-loader {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 80px 0; gap: 12px;
    }
    .rr-spin {
        width: 32px; height: 32px;
        border: 3px solid #fde68a;
        border-top-color: #f59e0b;
        border-radius: 50%;
        animation: rr-spin 0.7s linear infinite;
    }
    @keyframes rr-spin { to { transform: rotate(360deg); } }

    /* Fraud flag row */
    .rr-flag-row { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }

    /* Responsive */
    @media (max-width: 600px) {
        .rr-header  { padding: 14px 14px 0; }
        .rr-body    { padding: 14px; }
        .rr-card-header { padding: 12px 14px; }
        .rr-card-body   { padding: 12px 14px; }
        .rr-btn-row { grid-template-columns: 1fr; }
        .rr-btn-orange { grid-column: 1; }
    }
`;

/* ─── Badge ─── */
const Badge = ({ cfg }) => <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;

/* ─── Card header button ─── */
const CardHead = ({ iconCls, icon, title, badge, sub, amount, open, onClick }) => (
    <button className="rr-card-header" onClick={onClick}>
        <div className={`rr-icon-wrap ${iconCls}`}>{icon}</div>
        <div className="rr-card-info">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="rr-card-name">{title}</span>
                {badge}
            </div>
            <div className="rr-card-sub">{sub}</div>
        </div>
        <div className="rr-card-right">
            <span className="rr-amount">{amount}</span>
            <span className="rr-chevron">
                {open ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
            </span>
        </div>
    </button>
);

/* ══════════════════════════════════════
   REFUND CARD
══════════════════════════════════════ */
const RefundCard = ({ order, onAction }) => {
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const refund = order.refund || {};
    const cfg = REFUND_CFG[refund.status] || REFUND_CFG.NONE;
    const isPending = refund.status === "REQUESTED";
    const isFailed = refund.status === "FAILED";

    const doAction = async (action) => {
        if (action === "approve" && !window.confirm(`Approve refund of ₹${Number(refund.amount).toLocaleString("en-IN")}?`)) return;
        try { setBusy(true); await api.put(`/orders/${order._id}/refund/process`, { action, adminNote: note }); onAction(); }
        catch (e) { alert(e.response?.data?.message || "Action failed"); }
        finally { setBusy(false); }
    };
    const doRetry = async () => {
        if (!window.confirm("Retry this failed refund?")) return;
        try { setRetrying(true); await api.put(`/orders/${order._id}/refund/retry`); onAction(); }
        catch (e) { alert(e.response?.data?.message || "Retry failed"); }
        finally { setRetrying(false); }
    };

    return (
        <div className={`rr-card${isFailed ? " failed" : ""}`}>
            <CardHead
                iconCls="rr-icon-amber"
                icon={<FaMoneyBillWave size={15} />}
                title={order.customerName}
                badge={<Badge cfg={cfg} />}
                sub={`#${order._id.slice(-8).toUpperCase()} · ${order.payment?.method || "—"}`}
                amount={`₹${Number(refund.amount || 0).toLocaleString("en-IN")}`}
                open={open}
                onClick={() => setOpen(o => !o)}
            />
            {open && (
                <div className="rr-card-body">
                    <div className="rr-info-box">
                        <div className="rr-info-row"><FaUser size={11} />{order.customerName}</div>
                        <div className="rr-info-row"><FaPhone size={11} />{order.phone}</div>
                        <div className="rr-info-meta">
                            <b>Reason:</b> {refund.reason || "—"}<br />
                            <b>Requested:</b> {refund.requestedAt ? new Date(refund.requestedAt).toLocaleString("en-IN") : "—"}
                            {refund.razorpayRefundId && <><br /><span style={{ color: "#10b981", fontWeight: 600 }}>Refund ID: {refund.razorpayRefundId}</span></>}
                        </div>
                    </div>

                    {(isPending || isFailed) && (
                        <>
                            <textarea className="rr-textarea" rows={2} placeholder="Admin note (optional)"
                                value={note} onChange={e => setNote(e.target.value)} />
                            <div className="rr-btn-row">
                                {isFailed ? (
                                    <button className="rr-btn rr-btn-orange" onClick={doRetry} disabled={retrying}>
                                        {retrying ? <FaSpinner className="rr-spin-sm" size={12} style={{ animation: "rr-spin 0.7s linear infinite" }} /> : "🔁"}
                                        Retry Refund
                                    </button>
                                ) : (
                                    <>
                                        <button className="rr-btn rr-btn-green" onClick={() => doAction("approve")} disabled={busy}>
                                            {busy ? <FaSpinner size={12} style={{ animation: "rr-spin 0.7s linear infinite" }} /> : <FaCheckCircle size={12} />}
                                            Approve
                                        </button>
                                        <button className="rr-btn rr-btn-red" onClick={() => doAction("reject")} disabled={busy}>
                                            <FaBan size={12} /> Reject
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

/* ══════════════════════════════════════
   RETURN CARD
══════════════════════════════════════ */
const ReturnCard = ({ order, onAction }) => {
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const [refundAmt, setRefundAmt] = useState("");
    const [busy, setBusy] = useState(false);
    const ret = order.return || {};
    const cfg = RETURN_CFG[ret.status] || RETURN_CFG.NONE;
    const isPending = ret.status === "REQUESTED";

    const doAction = async (action) => {
        try {
            setBusy(true);
            await api.put(`/orders/${order._id}/return/process`, {
                action, adminNote: note,
                refundAmount: refundAmt ? Number(refundAmt) : order.totalAmount,
            });
            onAction();
        } catch (e) { alert(e.response?.data?.message || "Action failed"); }
        finally { setBusy(false); }
    };

    return (
        <div className="rr-card">
            <CardHead
                iconCls="rr-icon-violet"
                icon={<FaUndo size={14} />}
                title={order.customerName}
                badge={<Badge cfg={cfg} />}
                sub={`#${order._id.slice(-8).toUpperCase()} · Delivered`}
                amount={`₹${Number(order.totalAmount || 0).toLocaleString("en-IN")}`}
                open={open}
                onClick={() => setOpen(o => !o)}
            />
            {open && (
                <div className="rr-card-body">
                    <div className="rr-info-box">
                        <div className="rr-info-row"><FaUser size={11} />{order.customerName}</div>
                        <div className="rr-info-row"><FaPhone size={11} />{order.phone}</div>
                        <div className="rr-info-row"><FaMapMarkerAlt size={11} /><span style={{ fontSize: 12 }}>{order.address}</span></div>
                        <div className="rr-info-meta">
                            <b>Reason:</b> {ret.reason || "—"}<br />
                            <b>Requested:</b> {ret.requestedAt ? new Date(ret.requestedAt).toLocaleString("en-IN") : "—"}
                        </div>
                        {ret.images?.length > 0 && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                                {ret.images.map((img, i) => (
                                    <a key={i} href={img} target="_blank" rel="noreferrer">
                                        <img src={img} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {order.items?.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                            <div className="rr-items-label">Items to Return</div>
                            {order.items.map((item, i) => (
                                <div key={i} className="rr-item-row">
                                    {item.image && <img src={item.image} alt={item.name} className="rr-item-img" />}
                                    <div>
                                        <div className="rr-item-name">{item.name}</div>
                                        <div className="rr-item-qty">Qty: {item.qty}</div>
                                    </div>
                                    <span className="rr-item-price">₹{(item.price * item.qty).toLocaleString("en-IN")}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {isPending && (
                        <>
                            <div style={{ marginBottom: 10 }}>
                                <label className="rr-label">Refund Amount (₹)</label>
                                <input type="number" className="rr-input"
                                    placeholder={`Default: ₹${order.totalAmount}`}
                                    value={refundAmt} onChange={e => setRefundAmt(e.target.value)} />
                            </div>
                            <textarea className="rr-textarea" rows={2} placeholder="Admin note (optional)"
                                value={note} onChange={e => setNote(e.target.value)} />
                            <div className="rr-btn-row">
                                <button className="rr-btn rr-btn-green" onClick={() => doAction("approve")} disabled={busy}>
                                    {busy ? <FaSpinner size={12} style={{ animation: "rr-spin 0.7s linear infinite" }} /> : <FaCheckCircle size={12} />}
                                    Approve
                                </button>
                                <button className="rr-btn rr-btn-red" onClick={() => doAction("reject")} disabled={busy}>
                                    <FaBan size={12} /> Reject
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

/* ══════════════════════════════════════
   FLAGGED CARD
══════════════════════════════════════ */
const FlaggedCard = ({ order }) => {
    const [open, setOpen] = useState(false);
    const flagCount = order.payment?.flagReasons?.length || 0;

    return (
        <div className="rr-card flagged">
            <CardHead
                iconCls="rr-icon-rose"
                icon={<FaFlag size={13} />}
                title={order.customerName}
                badge={
                    <span className="badge badge-rose">{flagCount} flag{flagCount !== 1 ? "s" : ""}</span>
                }
                sub={`#${order._id.slice(-8).toUpperCase()} · ${new Date(order.createdAt).toLocaleDateString("en-IN")}`}
                amount={`₹${Number(order.totalAmount || 0).toLocaleString("en-IN")}`}
                open={open}
                onClick={() => setOpen(o => !o)}
            />
            {open && (
                <div className="rr-card-body" style={{ background: "#fff8f8" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
                        <div>
                            <div className="rr-items-label">Customer</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{order.customerName}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>{order.phone}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, wordBreak: "break-word" }}>{order.address}</div>
                        </div>
                        <div>
                            <div className="rr-items-label">Payment</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{order.payment?.method}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>{order.payment?.status}</div>
                            {order.payment?.ip && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>IP: {order.payment.ip}</div>}
                        </div>
                    </div>
                    <div className="rr-items-label">Fraud Flags</div>
                    <div className="rr-flag-row">
                        {order.payment?.flagReasons?.map((r, i) => (
                            <span key={i} className="rr-flag-chip">{r.replace(/_/g, " ")}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ══════════════════════════════════════
   EMPTY / LOADER
══════════════════════════════════════ */
const Empty = ({ icon, text }) => (
    <div className="rr-empty">
        <div className="rr-empty-icon">{icon}</div>
        <div className="rr-empty-text">{text}</div>
        <div className="rr-empty-sub">Check back later</div>
    </div>
);

const Loader = () => (
    <div className="rr-loader">
        <div className="rr-spin" />
        <span style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</span>
    </div>
);

/* ══════════════════════════════════════
   REPLACEMENT CARD
══════════════════════════════════════ */
const REPL_CFG = {
    REQUESTED: { cls: "badge-amber", label: "Requested" },
    APPROVED: { cls: "badge-green", label: "Approved" },
    REJECTED: { cls: "badge-red", label: "Rejected" },
    SHIPPED: { cls: "badge-blue", label: "Shipped" },
    DELIVERED: { cls: "badge-green", label: "Delivered" },
};

const ReplacementCard = ({ order, onAction }) => {
    const [processing, setProcessing] = useState(false);
    const [adminNote, setAdminNote] = useState("");
    const repl = order.replacement || {};
    const cfg = REPL_CFG[repl.status] || REPL_CFG.REQUESTED;

    const handle = async (action) => {
        try {
            setProcessing(true);
            await api.put(`/orders/${order._id}/replacement/process`, { action, adminNote });
            onAction();
        } catch (err) { alert(err.response?.data?.message || "Failed"); }
        finally { setProcessing(false); }
    };

    return (
        <div className="rr-card">
            <div className="rr-card-header">
                <div>
                    <span className="rr-order-id">#{order._id?.slice(-8).toUpperCase()}</span>
                    <span className={`rr-badge ${cfg.cls}`}>{cfg.label}</span>
                </div>
                <span className="rr-date">{new Date(repl.requestedAt || order.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="rr-card-body">
                <div className="rr-meta-row">
                    <span><FaUser size={10} /> {order.customerName}</span>
                    <span><FaPhone size={10} /> {order.phone}</span>
                </div>
                {repl.reason && <div className="rr-reason">Reason: {repl.reason}</div>}
                {repl.images?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {repl.images.map((img, i) => (
                            <a key={i} href={img} target="_blank" rel="noreferrer">
                                <img src={img} alt="proof" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} />
                            </a>
                        ))}
                    </div>
                )}
                {repl.status === "REQUESTED" && (
                    <div style={{ marginTop: 10 }}>
                        <input placeholder="Admin note (optional)" value={adminNote} onChange={e => setAdminNote(e.target.value)}
                            style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, marginBottom: 8, fontFamily: "inherit" }} />
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => handle("approve")} disabled={processing}
                                className="rr-action-btn" style={{ background: "#059669", color: "#fff" }}>
                                {processing ? <FaSpinner size={10} className="rr-spin-icon" /> : <FaCheckCircle size={10} />} Approve
                            </button>
                            <button onClick={() => handle("reject")} disabled={processing}
                                className="rr-action-btn" style={{ background: "#dc2626", color: "#fff" }}>
                                {processing ? <FaSpinner size={10} className="rr-spin-icon" /> : <FaBan size={10} />} Reject
                            </button>
                        </div>
                    </div>
                )}
                {repl.status === "APPROVED" && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <button onClick={() => handle("ship")} disabled={processing}
                            className="rr-action-btn" style={{ background: "#2563eb", color: "#fff" }}>
                            Mark Shipped
                        </button>
                    </div>
                )}
                {repl.adminNote && <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>Admin: {repl.adminNote}</div>}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════
   MAIN
══════════════════════════════════════ */
const TABS = [
    { id: "refunds", label: "Refunds", icon: <FaMoneyBillWave size={12} /> },
    { id: "returns", label: "Returns", icon: <FaUndo size={12} /> },
    { id: "replacements", label: "Replacements", icon: <FaExchangeAlt size={12} /> },
    { id: "flagged", label: "Flagged", icon: <FaExclamationTriangle size={12} /> },
];

const AdminRefundReturn = () => {
    const [tab, setTab] = useState("refunds");
    const [refunds, setRefunds] = useState([]);
    const [returns, setReturns] = useState([]);
    const [replacements, setReplacements] = useState([]);
    const [flagged, setFlagged] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const [r1, r2, r3, r4] = await Promise.all([
                api.get("/orders/admin/refunds"),
                api.get("/orders/admin/returns"),
                api.get("/orders/admin/flagged"),
                api.get("/orders/admin/replacements").catch(() => ({ data: [] })),
            ]);
            setRefunds(Array.isArray(r1.data) ? r1.data : []);
            setReturns(Array.isArray(r2.data) ? r2.data : []);
            setFlagged(Array.isArray(r3.data) ? r3.data : []);
            setReplacements(Array.isArray(r4.data) ? r4.data : []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setSyncing(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const counts = { refunds: refunds.length, returns: returns.length, replacements: replacements.length, flagged: flagged.length };

    return (
        <div className="rr-root">
            <style>{STYLES}</style>

            {/* Sticky header */}
            <div className="rr-header">
                <div className="rr-header-top">
                    <div>
                        <h1 className="rr-title">Refunds, Returns &amp; Replacements</h1>
                        <p className="rr-sub">Manage refunds, returns, replacements &amp; fraud alerts</p>
                    </div>
                    <button
                        className="rr-refresh"
                        onClick={() => { setSyncing(true); fetchAll(); }}
                        disabled={syncing}
                    >
                        <FaSync size={11} style={syncing ? { animation: "rr-spin 0.7s linear infinite" } : {}} />
                        {syncing ? "Syncing…" : "Refresh"}
                    </button>
                </div>

                {/* Tabs */}
                <div className="rr-tabs">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            className={`rr-tab${tab === t.id ? " active" : ""}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon}
                            {t.label}
                            <span className="rr-tab-count">{counts[t.id]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable content */}
            <div className="rr-body">
                {loading ? <Loader /> : (
                    <>
                        {tab === "refunds" && (
                            refunds.length === 0
                                ? <Empty icon={<FaMoneyBillWave size={22} />} text="No pending refund requests" />
                                : refunds.map(o => <RefundCard key={o._id} order={o} onAction={fetchAll} />)
                        )}
                        {tab === "returns" && (
                            returns.length === 0
                                ? <Empty icon={<FaBoxOpen size={22} />} text="No pending return requests" />
                                : returns.map(o => <ReturnCard key={o._id} order={o} onAction={fetchAll} />)
                        )}
                        {tab === "replacements" && (
                            replacements.length === 0
                                ? <Empty icon={<FaExchangeAlt size={22} />} text="No pending replacement requests" />
                                : replacements.map(o => <ReplacementCard key={o._id} order={o} onAction={fetchAll} />)
                        )}
                        {tab === "flagged" && (
                            flagged.length === 0
                                ? <Empty icon={<FaFlag size={22} />} text="No flagged orders" />
                                : flagged.map(o => <FlaggedCard key={o._id} order={o} />)
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminRefundReturn;