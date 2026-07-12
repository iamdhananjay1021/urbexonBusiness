/**
 * AdminRefundReturn.jsx
 * Renders flush inside Admin.jsx's zero-padding main area.
 * Manages its own sticky header + scrollable content.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/adminApi";
import {
    FaSync, FaUser, FaPhone, FaMapMarkerAlt,
    FaCheckCircle, FaBan, FaMoneyBillWave, FaUndo,
    FaExclamationTriangle, FaChevronDown,
    FaChevronUp, FaFlag, FaBoxOpen, FaExchangeAlt, FaTruck,
} from "react-icons/fa";
import {
    Button, Badge, StatusBadge, Card, EmptyState, ErrorState,
    Skeleton, FormField, Input,
} from "../components/ui";
import { useAdminWsContext } from "../contexts/AdminWsContext";

/* icon-wrap tone per underlying status, so the icon reflects state at a
   glance — the statuses themselves now resolve through the shared
   StatusBadge STATUS_MAP instead of the three local *_CFG color objects
   that used to live here. */
const iconToneForStatus = (status) => {
    if (["FAILED", "REJECTED"].includes(status)) return "danger";
    if (["PROCESSED", "APPROVED", "REFUNDED", "DELIVERED"].includes(status)) return "success";
    if (["PROCESSING", "PICKED_UP", "SHIPPED"].includes(status)) return "info";
    return "warning";
};

/* ─── Icon wrap ─── */
const IconWrap = ({ tone, children }) => (
    <div style={{
        width: 38, height: 38, borderRadius: "var(--adm-radius-md)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        background: `var(--adm-${tone}-tint)`,
        border: `1px solid var(--adm-${tone})`,
        color: `var(--adm-${tone})`,
    }}>
        {children}
    </div>
);

/* ─── Card header button (clickable, expand/collapse) ─── */
const CardHead = ({ iconTone, icon, title, badge, sub, amount, open, onClick }) => (
    <button
        onClick={onClick}
        style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 18px", cursor: "pointer", border: "none", background: "none",
            width: "100%", textAlign: "left", fontFamily: "inherit",
        }}
    >
        <IconWrap tone={iconTone}>{icon}</IconWrap>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--adm-text-primary)" }}>{title}</span>
                {badge}
            </div>
            <div style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--adm-success)" }}>{amount}</span>
            <span style={{ color: "var(--adm-border)" }}>
                {open ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
            </span>
        </div>
    </button>
);

const InfoBox = ({ children }) => (
    <div style={{
        background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border-soft)",
        borderRadius: "var(--adm-radius-md)", padding: 14, marginBottom: 14,
        display: "flex", flexDirection: "column", gap: 7, fontSize: 13,
    }}>
        {children}
    </div>
);

const InfoRow = ({ icon, children }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--adm-text-secondary)" }}>
        <span style={{ color: "var(--adm-warning)", marginTop: 2, flexShrink: 0 }}>{icon}</span>
        {children}
    </div>
);

const ItemsLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{children}</div>
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
    const isPending = refund.status === "REQUESTED";
    const isFailed = refund.status === "FAILED";
    const busyAny = busy || retrying;

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
        <Card padded={false} style={isFailed ? { borderColor: "var(--adm-danger)", marginBottom: 10 } : { marginBottom: 10 }}>
            <CardHead
                iconTone={iconToneForStatus(refund.status)}
                icon={<FaMoneyBillWave size={15} />}
                title={order.customerName}
                badge={<StatusBadge status={refund.status || "NONE"} />}
                sub={`#${order._id.slice(-8).toUpperCase()} · ${order.payment?.method || "—"}`}
                amount={`₹${Number(refund.amount || 0).toLocaleString("en-IN")}`}
                open={open}
                onClick={() => setOpen(o => !o)}
            />
            {open && (
                <div style={{ borderTop: "1px solid var(--adm-border-soft)", padding: "16px 18px" }}>
                    <InfoBox>
                        <InfoRow icon={<FaUser size={11} />}>{order.customerName}</InfoRow>
                        <InfoRow icon={<FaPhone size={11} />}>{order.phone}</InfoRow>
                        <div style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
                            <b>Reason:</b> {refund.reason || "—"}<br />
                            <b>Requested:</b> {refund.requestedAt ? new Date(refund.requestedAt).toLocaleString("en-IN") : "—"}
                            {refund.razorpayRefundId && <><br /><span style={{ color: "var(--adm-success)", fontWeight: 600 }}>Refund ID: {refund.razorpayRefundId}</span></>}
                            {isFailed && refund.failureReason && <><br /><span style={{ color: "var(--adm-danger)", fontWeight: 600 }}>Failure reason: {refund.failureReason}</span></>}
                        </div>
                    </InfoBox>

                    {(isPending || isFailed) && (
                        <>
                            <FormField>
                                <textarea className="adm-field-input" rows={2} placeholder="Admin note (optional)"
                                    style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
                                    value={note} onChange={e => setNote(e.target.value)} disabled={busyAny} />
                            </FormField>
                            <div style={{ display: "grid", gridTemplateColumns: isFailed ? "1fr" : "1fr 1fr", gap: 10, marginTop: 12 }}>
                                {isFailed ? (
                                    <Button variant="primary" icon={FaSync} loading={retrying} disabled={busyAny} onClick={doRetry}>Retry Refund</Button>
                                ) : (
                                    <>
                                        <Button variant="success" icon={FaCheckCircle} loading={busy} disabled={busyAny} onClick={() => doAction("approve")}>Approve</Button>
                                        <Button variant="danger" icon={FaBan} disabled={busyAny} onClick={() => doAction("reject")}>Reject</Button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </Card>
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
    const isPending = ret.status === "REQUESTED";

    const doAction = async (action) => {
        if (action === "approve" && !window.confirm(`Approve return & refund ₹${refundAmt ? Number(refundAmt).toLocaleString("en-IN") : Number(order.totalAmount).toLocaleString("en-IN")}?`)) return;
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
        <Card padded={false} style={{ marginBottom: 10 }}>
            <CardHead
                iconTone={iconToneForStatus(ret.status)}
                icon={<FaUndo size={14} />}
                title={order.customerName}
                badge={<StatusBadge status={ret.status || "NONE"} />}
                sub={`#${order._id.slice(-8).toUpperCase()} · Delivered`}
                amount={`₹${Number(order.totalAmount || 0).toLocaleString("en-IN")}`}
                open={open}
                onClick={() => setOpen(o => !o)}
            />
            {open && (
                <div style={{ borderTop: "1px solid var(--adm-border-soft)", padding: "16px 18px" }}>
                    <InfoBox>
                        <InfoRow icon={<FaUser size={11} />}>{order.customerName}</InfoRow>
                        <InfoRow icon={<FaPhone size={11} />}>{order.phone}</InfoRow>
                        <InfoRow icon={<FaMapMarkerAlt size={11} />}><span style={{ fontSize: 12 }}>{order.address}</span></InfoRow>
                        <div style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
                            <b>Reason:</b> {ret.reason || "—"}<br />
                            <b>Requested:</b> {ret.requestedAt ? new Date(ret.requestedAt).toLocaleString("en-IN") : "—"}
                        </div>
                        {ret.images?.length > 0 && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                                {ret.images.map((img, i) => (
                                    <a key={i} href={img} target="_blank" rel="noreferrer">
                                        <img src={img} alt="" style={{ width: 52, height: 52, borderRadius: "var(--adm-radius-sm)", objectFit: "cover", border: "1px solid var(--adm-border)" }} />
                                    </a>
                                ))}
                            </div>
                        )}
                    </InfoBox>

                    {order.items?.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                            <ItemsLabel>Items to Return</ItemsLabel>
                            {order.items.map((item, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < order.items.length - 1 ? "1px solid var(--adm-border-soft)" : "none" }}>
                                    {item.image && <img src={item.image} alt={item.name} style={{ width: 36, height: 36, borderRadius: "var(--adm-radius-sm)", objectFit: "contain", border: "1px solid var(--adm-border-soft)", background: "var(--adm-surface-alt)", flexShrink: 0 }} />}
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--adm-text-primary)" }}>{item.name}</div>
                                        <div style={{ fontSize: 12, color: "var(--adm-muted)" }}>Qty: {item.qty}</div>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-secondary)", marginLeft: "auto", flexShrink: 0 }}>₹{(item.price * item.qty).toLocaleString("en-IN")}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {isPending && (
                        <>
                            <FormField label="Refund Amount (₹)">
                                <Input type="number" disabled={busy}
                                    placeholder={`Default: ₹${order.totalAmount}`}
                                    value={refundAmt} onChange={e => setRefundAmt(e.target.value)} />
                            </FormField>
                            <FormField>
                                <textarea className="adm-field-input" rows={2} placeholder="Admin note (optional)"
                                    style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
                                    value={note} onChange={e => setNote(e.target.value)} disabled={busy} />
                            </FormField>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                                <Button variant="success" icon={FaCheckCircle} loading={busy} onClick={() => doAction("approve")}>Approve</Button>
                                <Button variant="danger" icon={FaBan} disabled={busy} onClick={() => doAction("reject")}>Reject</Button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </Card>
    );
};

/* ══════════════════════════════════════
   FLAGGED CARD
══════════════════════════════════════ */
const FlaggedCard = ({ order }) => {
    const [open, setOpen] = useState(false);
    const flagCount = order.payment?.flagReasons?.length || 0;

    return (
        <Card padded={false} style={{ borderColor: "var(--adm-danger)", marginBottom: 10 }}>
            <CardHead
                iconTone="danger"
                icon={<FaFlag size={13} />}
                title={order.customerName}
                badge={<Badge tone="danger">{flagCount} flag{flagCount !== 1 ? "s" : ""}</Badge>}
                sub={`#${order._id.slice(-8).toUpperCase()} · ${new Date(order.createdAt).toLocaleDateString("en-IN")}`}
                amount={`₹${Number(order.totalAmount || 0).toLocaleString("en-IN")}`}
                open={open}
                onClick={() => setOpen(o => !o)}
            />
            {open && (
                <div style={{ borderTop: "1px solid var(--adm-border-soft)", padding: "16px 18px", background: "var(--adm-danger-tint)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
                        <div>
                            <ItemsLabel>Customer</ItemsLabel>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)" }}>{order.customerName}</div>
                            <div style={{ fontSize: 12, color: "var(--adm-text-secondary)" }}>{order.phone}</div>
                            <div style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2, wordBreak: "break-word" }}>{order.address}</div>
                        </div>
                        <div>
                            <ItemsLabel>Payment</ItemsLabel>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)" }}>{order.payment?.method}</div>
                            <div style={{ fontSize: 12, color: "var(--adm-text-secondary)" }}>{order.payment?.status}</div>
                            {order.payment?.ip && <div style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>IP: {order.payment.ip}</div>}
                        </div>
                    </div>
                    <ItemsLabel>Fraud Flags</ItemsLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                        {order.payment?.flagReasons?.map((r, i) => (
                            <Badge key={i} tone="danger">{r.replace(/_/g, " ")}</Badge>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
};

/* ══════════════════════════════════════
   REPLACEMENT CARD
══════════════════════════════════════ */
const ReplacementCard = ({ order, onAction }) => {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [adminNote, setAdminNote] = useState("");
    const repl = order.replacement || {};
    const isRequested = repl.status === "REQUESTED";
    const isApproved = repl.status === "APPROVED";
    const isShipped = repl.status === "SHIPPED";

    const handle = async (action, confirmMsg) => {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        try {
            setBusy(true);
            await api.put(`/orders/${order._id}/replacement/process`, { action, adminNote });
            onAction();
        } catch (err) { alert(err.response?.data?.message || "Action failed"); }
        finally { setBusy(false); }
    };

    return (
        <Card padded={false} style={{ marginBottom: 10 }}>
            <CardHead
                iconTone={iconToneForStatus(repl.status)}
                icon={<FaExchangeAlt size={14} />}
                title={order.customerName}
                badge={<StatusBadge status={repl.status || "REQUESTED"} />}
                sub={`#${order._id?.slice(-8).toUpperCase() || "—"} · ${repl.reason ? repl.reason : "Replacement"}`}
                amount={`₹${Number(order.totalAmount || 0).toLocaleString("en-IN")}`}
                open={open}
                onClick={() => setOpen(o => !o)}
            />
            {open && (
                <div style={{ borderTop: "1px solid var(--adm-border-soft)", padding: "16px 18px" }}>
                    <InfoBox>
                        <InfoRow icon={<FaUser size={11} />}>{order.customerName}</InfoRow>
                        <InfoRow icon={<FaPhone size={11} />}>{order.phone}</InfoRow>
                        {order.address && (
                            <InfoRow icon={<FaMapMarkerAlt size={11} />}><span style={{ fontSize: 12 }}>{order.address}</span></InfoRow>
                        )}
                        <div style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
                            <b>Reason:</b> {repl.reason || "—"}<br />
                            <b>Requested:</b> {(repl.requestedAt || order.updatedAt) ? new Date(repl.requestedAt || order.updatedAt).toLocaleString("en-IN") : "—"}
                            {repl.adminNote && <><br /><b>Admin note:</b> {repl.adminNote}</>}
                        </div>
                    </InfoBox>

                    {repl.images?.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                            <ItemsLabel>Proof Images</ItemsLabel>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {repl.images.map((img, i) => (
                                    <a key={i} href={img} target="_blank" rel="noreferrer">
                                        <img src={img} alt="proof" style={{ width: 52, height: 52, borderRadius: "var(--adm-radius-sm)", objectFit: "cover", border: "1px solid var(--adm-border)" }} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {isRequested && (
                        <>
                            <FormField>
                                <textarea className="adm-field-input" rows={2} placeholder="Admin note (optional)"
                                    style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
                                    value={adminNote} onChange={e => setAdminNote(e.target.value)} disabled={busy} />
                            </FormField>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                                <Button variant="success" icon={FaCheckCircle} loading={busy} onClick={() => handle("approve")}>Approve</Button>
                                <Button variant="danger" icon={FaBan} disabled={busy} onClick={() => handle("reject")}>Reject</Button>
                            </div>
                        </>
                    )}

                    {isApproved && (
                        <div style={{ marginTop: 12 }}>
                            <Button variant="primary" icon={FaTruck} loading={busy} onClick={() => handle("ship")} style={{ width: "100%" }}>Mark Shipped</Button>
                        </div>
                    )}

                    {isShipped && (
                        <div style={{ marginTop: 12 }}>
                            <Button variant="success" icon={FaCheckCircle} loading={busy} onClick={() => handle("deliver", "Confirm this replacement has been delivered?")} style={{ width: "100%" }}>Mark Delivered</Button>
                        </div>
                    )}
                </div>
            )}
        </Card>
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

const TAB_EMPTY = {
    refunds: { icon: FaMoneyBillWave, text: "No pending refund requests" },
    returns: { icon: FaBoxOpen, text: "No pending return requests" },
    replacements: { icon: FaExchangeAlt, text: "No pending replacement requests" },
    flagged: { icon: FaFlag, text: "No flagged orders" },
};

const AdminRefundReturn = () => {
    const [tab, setTab] = useState("refunds");
    const [refunds, setRefunds] = useState([]);
    const [returns, setReturns] = useState([]);
    const [replacements, setReplacements] = useState([]);
    const [flagged, setFlagged] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
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
        } catch (e) {
            console.error(e);
            setError(e.response?.data?.message || "Couldn't load data. Check your connection and try again.");
        }
        finally { setLoading(false); setSyncing(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // BUG FIX: this page never refreshed on its own — a customer's return/
    // replacement/refund request only ever surfaced via the notification
    // bell's 5-minute poll (or a manual click of the sync button), so a
    // brand new request could sit unseen in this exact queue for minutes.
    // admin:order_event is now broadcast by orderController.js's
    // requestReturn/requestReplacement and Paymentcontroller.js's
    // requestRefund (via notifyOrderStakeholders) the instant a customer
    // submits one — this mirrors the same listen-and-refetch pattern
    // already used in AdminOrders.jsx.
    const { lastMessage: adminWsMessage } = useAdminWsContext();
    const liveRefreshTimer = useRef(null);
    useEffect(() => {
        if (adminWsMessage?.type !== "admin:order_event") return;
        clearTimeout(liveRefreshTimer.current);
        liveRefreshTimer.current = setTimeout(() => fetchAll(), 800);
        return () => clearTimeout(liveRefreshTimer.current);
    }, [adminWsMessage, fetchAll]);

    const counts = { refunds: refunds.length, returns: returns.length, replacements: replacements.length, flagged: flagged.length };
    const lists = { refunds, returns, replacements, flagged };

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", display: "flex", flexDirection: "column", height: "calc(100vh - 54px)", background: "var(--adm-bg)" }}>
            {/* Sticky header */}
            <div style={{ background: "var(--adm-surface)", borderBottom: "1px solid var(--adm-border)", padding: "18px 24px 0", flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: "var(--adm-radius-md)", background: "var(--adm-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-text-on-accent)", flexShrink: 0, boxShadow: "var(--adm-shadow-md)" }}>
                            <FaExchangeAlt size={17} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 19, fontWeight: 800, color: "var(--adm-text-primary)", margin: 0, letterSpacing: "-0.01em" }}>Refunds, Returns &amp; Replacements</h1>
                            <p style={{ fontSize: 12.5, color: "var(--adm-muted)", margin: "3px 0 0" }}>Manage refunds, returns, replacements &amp; fraud alerts</p>
                        </div>
                    </div>
                    <Button variant="primary" icon={FaSync} loading={syncing} onClick={() => { setSyncing(true); fetchAll(); }}>
                        {syncing ? "Syncing…" : "Refresh"}
                    </Button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 3, overflowX: "auto", scrollbarWidth: "none", background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: 4, marginBottom: 16, width: "fit-content", maxWidth: "100%" }}>
                    {TABS.map(t => {
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 7,
                                    padding: "8px 15px", fontSize: 12.5, fontWeight: 600,
                                    border: "none", background: active ? "var(--adm-surface)" : "transparent",
                                    cursor: "pointer", color: active ? "var(--adm-text-primary)" : "var(--adm-text-secondary)",
                                    transition: "all 0.15s", fontFamily: "inherit",
                                    borderRadius: "var(--adm-radius-sm)", whiteSpace: "nowrap", flexShrink: 0,
                                    boxShadow: active ? "var(--adm-shadow-sm)" : "none",
                                }}
                            >
                                {t.icon}
                                {t.label}
                                <span style={{
                                    fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: "var(--adm-radius-full)",
                                    background: active ? "var(--adm-primary-tint)" : "var(--adm-border)",
                                    color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)",
                                }}>{counts[t.id]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                {error && (
                    <div style={{ marginBottom: 12 }}>
                        <ErrorState message={error} onRetry={fetchAll} />
                    </div>
                )}
                {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Card key={i} padded><Skeleton height={44} /></Card>
                        ))}
                    </div>
                ) : (
                    lists[tab].length === 0 ? (
                        <EmptyState
                            icon={TAB_EMPTY[tab].icon}
                            title={TAB_EMPTY[tab].text}
                            description="New requests will show up here automatically"
                            action={<Button variant="secondary" size="sm" icon={FaSync} onClick={fetchAll}>Check again</Button>}
                        />
                    ) : (
                        <>
                            {tab === "refunds" && refunds.map(o => <RefundCard key={o._id} order={o} onAction={fetchAll} />)}
                            {tab === "returns" && returns.map(o => <ReturnCard key={o._id} order={o} onAction={fetchAll} />)}
                            {tab === "replacements" && replacements.map(o => <ReplacementCard key={o._id} order={o} onAction={fetchAll} />)}
                            {tab === "flagged" && flagged.map(o => <FlaggedCard key={o._id} order={o} />)}
                        </>
                    )
                )}
            </div>
        </div>
    );
};

export default AdminRefundReturn;
