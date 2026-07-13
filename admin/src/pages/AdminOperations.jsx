/**
 * AdminOperations.jsx — Operations Control Center.
 *
 * Different from AdminDashboard.jsx (business/growth metrics) — this page
 * is the live ops-team screen: order-stage funnel, active fleet/vendor
 * status, refund/payment exceptions, the realtime event timeline, and
 * fast admin actions (assign/reassign rider, cancel order, suspend
 * rider/vendor, broadcast, restart scheduler).
 *
 * Reuses the existing shared AdminWsContext socket for realtime updates
 * (relevant admin:* / vendor:* / assignment:* / order:status:update
 * events feed the timeline and trigger a debounced summary refetch) — the
 * only polling is a 30s fallback safety net for the pieces of this page
 * that have no realtime event at all (scheduler status, assignment queue
 * snapshot, refund queue), matching the AdminMapDashboard.jsx precedent
 * of poll + WS-patch hybrid.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/adminApi";
import { useAdminWsContext } from "../contexts/AdminWsContext";
import {
    Button, Card, CardHeader, Table, Modal, FormField, Select,
    StatusBadge, StatTile, EmptyState, ErrorState,
} from "../components/ui";
import {
    FiPackage, FiClock, FiSearch, FiUserCheck, FiTruck, FiAlertTriangle,
    FiXCircle, FiRefreshCcw, FiHome, FiUsers, FiDollarSign, FiCreditCard,
    FiWifi, FiCpu, FiList, FiSend, FiPlay, FiSlash, FiActivity,
} from "react-icons/fi";

const POLL_MS = 30000;
const MAX_TIMELINE = 40;

// admin:order_event's `event` sub-field → human label, mapped onto the
// requested placed→delivered narrative. Built only from event types that
// are already broadcast today (services/orderEngine.js notifyOrderStakeholders
// / assignmentEngine.js / deliveryController.js) — no new WS events.
const EVENT_LABELS = {
    order_created: "Order placed",
    vendor_status_update: "Vendor updated order",
    delivery_status_update: "Delivery status changed",
    rider_assigned: "Rider assigned",
    picked_up: "Picked up",
    delivered: "Delivered",
    refund_requested: "Refund requested",
    return_requested: "Return requested",
    replacement_requested: "Replacement requested",
    order_status_updated: "Order status updated",
};
const WS_TYPE_LABELS = {
    "vendor:status_changed": "Vendor status changed",
    "assignment:no_riders": "No riders found for order",
    "order:status:update": "Assignment failed (rounds exhausted)",
    "admin:stale_assignment": "Rider assigned but not picked up (stale)",
    "admin:active_orders_drift": "Rider order-count drift corrected",
};
const RELEVANT_WS_TYPES = new Set([
    "admin:order_event", "vendor:status_changed", "assignment:no_riders",
    "order:status:update", "admin:stale_assignment", "admin:active_orders_drift",
]);

const notify = (message, type = "success") => {
    window.dispatchEvent(new CustomEvent("api:error", { detail: { message, type } }));
};

const timeAgo = (iso) => {
    if (!iso) return "";
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ─── Quick-action modals — one Modal per action, same pattern as
   AdminVendors.jsx's RejectModal/ApproveModal (Modal + FormField + a
   [secondary Cancel, primary/danger Confirm] footer). ─── */
const AssignRiderModal = ({ order, riders, onConfirm, onClose, loading }) => {
    const [riderId, setRiderId] = useState("");
    useEffect(() => { setRiderId(""); }, [order]);
    return (
        <Modal
            open={!!order}
            onClose={onClose}
            title={order?.delivery?.assignedTo ? "Reassign Rider" : "Assign Rider"}
            width={420}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" icon={FiUserCheck} loading={loading} disabled={!riderId}
                        onClick={() => onConfirm(riderId)}>
                        {order?.delivery?.assignedTo ? "Reassign" : "Assign"}
                    </Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>
                Order #{order?._id?.slice(-6)?.toUpperCase()} — {order?.customerName}
            </p>
            <FormField label="Online Rider *">
                <Select value={riderId} onChange={(e) => setRiderId(e.target.value)} disabled={loading}>
                    <option value="">Select a rider…</option>
                    {riders.map((r) => (
                        <option key={r._id} value={r._id}>
                            {r.name} — {r.vehicleType || "rider"} ({r.activeOrders || 0} active)
                        </option>
                    ))}
                </Select>
            </FormField>
            {riders.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--adm-danger)", marginTop: 8 }}>No riders are currently online.</p>
            )}
        </Modal>
    );
};

const CancelOrderModal = ({ order, onConfirm, onClose, loading }) => {
    const [reason, setReason] = useState("");
    useEffect(() => { setReason(""); }, [order]);
    return (
        <Modal
            open={!!order}
            onClose={onClose}
            title="Cancel Order"
            width={420}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Back</Button>
                    <Button variant="danger" icon={FiXCircle} loading={loading} disabled={!reason.trim()}
                        onClick={() => onConfirm(reason.trim())}>
                        Cancel Order
                    </Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>
                Order #{order?._id?.slice(-6)?.toUpperCase()} — {order?.customerName}
            </p>
            <FormField label="Reason *">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                    placeholder="Reason for cancellation…" className="adm-field-input"
                    style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }} disabled={loading} />
            </FormField>
        </Modal>
    );
};

const SuspendModal = ({ target, kind, onConfirm, onClose, loading }) => {
    const [reason, setReason] = useState("");
    useEffect(() => { setReason(""); }, [target]);
    const label = kind === "vendor" ? "Vendor" : "Rider";
    return (
        <Modal
            open={!!target}
            onClose={onClose}
            title={`Suspend ${label}`}
            width={420}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="danger" icon={FiSlash} loading={loading} disabled={!reason.trim()}
                        onClick={() => onConfirm(reason.trim())}>
                        Suspend {label}
                    </Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>
                {target?.name || target?.shopName}
            </p>
            <FormField label="Reason *">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                    placeholder={`Reason for suspending this ${label.toLowerCase()}…`} className="adm-field-input"
                    style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }} disabled={loading} />
            </FormField>
        </Modal>
    );
};

const BroadcastModal = ({ open, onConfirm, onClose, loading }) => {
    const [message, setMessage] = useState("");
    const [audience, setAudience] = useState("all");
    useEffect(() => { if (!open) setMessage(""); }, [open]);
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Broadcast Notification"
            width={440}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" icon={FiSend} loading={loading} disabled={!message.trim()}
                        onClick={() => onConfirm({ message: message.trim(), audience })}>
                        Send
                    </Button>
                </>
            )}
        >
            <FormField label="Audience">
                <Select value={audience} onChange={(e) => setAudience(e.target.value)} disabled={loading}>
                    <option value="all">Everyone connected</option>
                    <option value="admins">Admins only</option>
                </Select>
            </FormField>
            <FormField label="Message *">
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                    placeholder="Announcement message…" className="adm-field-input"
                    style={{ resize: "vertical", width: "100%", boxSizing: "border-box", marginTop: 12 }} disabled={loading} />
            </FormField>
        </Modal>
    );
};

const RestartSchedulerModal = ({ open, onConfirm, onClose, loading }) => (
    <Modal
        open={open}
        onClose={onClose}
        title="Restart Scheduler"
        width={400}
        footer={(
            <>
                <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button variant="danger" icon={FiRefreshCcw} loading={loading} onClick={onConfirm}>Restart</Button>
            </>
        )}
    >
        <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", margin: 0 }}>
            This stops and re-registers every cron job (order/payment/delivery automation). Jobs currently mid-run will be interrupted.
        </p>
    </Modal>
);

/* ═══════════════════════════════════════════════════════════ MAIN ═══ */
const AdminOperations = () => {
    const [summary, setSummary] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [mapData, setMapData] = useState(null);
    const [schedulerStats, setSchedulerStats] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [refunds, setRefunds] = useState([]);
    const [liveOrders, setLiveOrders] = useState([]);
    const [onlineRiders, setOnlineRiders] = useState([]);
    const [activeVendors, setActiveVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [events, setEvents] = useState([]);
    const [modal, setModal] = useState(null); // { type, ...payload }
    const [actionLoading, setActionLoading] = useState(false);

    const { lastMessage, connected } = useAdminWsContext();
    const debounceRef = useRef(null);

    const loadAll = useCallback(async () => {
        try {
            const [opsRes, dashRes, mapRes, schedRes, assignRes, refundRes, liveRes, ridersRes, vendorsRes] = await Promise.all([
                api.get("/admin/ops-summary"),
                api.get("/admin/dashboard"),
                api.get("/admin/map-data?days=1"),
                api.get("/admin/scheduler/status"),
                api.get("/admin/assignments/active"),
                api.get("/orders/admin/refunds"),
                api.get("/orders/admin/local-delivery?limit=10"),
                api.get("/admin/delivery-boys/online"),
                api.get("/admin/vendors?status=approved&limit=8"),
            ]);
            setSummary(opsRes.data);
            setDashboard(dashRes.data);
            setMapData(mapRes.data);
            setSchedulerStats(schedRes.data.data);
            setAssignments(assignRes.data.assignments || []);
            setRefunds(Array.isArray(refundRes.data) ? refundRes.data : []);
            setLiveOrders(liveRes.data.orders || []);
            setOnlineRiders(ridersRes.data.riders || []);
            setActiveVendors(vendorsRes.data.vendors || []);
            setError(null);
        } catch (err) {
            console.error("[AdminOperations] load failed", err);
            setError("Failed to load operations data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);
    useEffect(() => {
        const t = setInterval(loadAll, POLL_MS);
        return () => clearInterval(t);
    }, [loadAll]);

    useEffect(() => {
        if (!lastMessage || !RELEVANT_WS_TYPES.has(lastMessage.type)) return;
        setEvents((prev) => [{ ...lastMessage, _at: Date.now() }, ...prev].slice(0, MAX_TIMELINE));
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(loadAll, 800);
        return () => clearTimeout(debounceRef.current);
    }, [lastMessage, loadAll]);

    /* ── Quick actions ── */
    const runAction = async (fn, successMsg) => {
        setActionLoading(true);
        try {
            await fn();
            notify(successMsg, "success");
            setModal(null);
            loadAll();
        } catch (err) {
            notify(err.response?.data?.message || "Action failed", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const doAssign = (riderId) => runAction(
        () => api.post(`/admin/orders/${modal.order._id}/assign-rider`, { riderId }),
        modal.order?.delivery?.assignedTo ? "Rider reassigned" : "Rider assigned"
    );
    const doCancel = (reason) => runAction(
        () => api.put(`/orders/${modal.order._id}`, { orderStatus: "CANCELLED", reason }),
        "Order cancelled"
    );
    const doSuspend = (reason) => runAction(
        () => modal.kind === "vendor"
            ? api.patch(`/admin/vendors/${modal.target._id}/suspend`, { reason })
            : api.patch(`/admin/delivery/partners/${modal.target._id}/block`, { reason }),
        `${modal.kind === "vendor" ? "Vendor" : "Rider"} suspended`
    );
    const doBroadcast = ({ message, audience }) => runAction(
        () => api.post("/admin/broadcast", { message, audience }),
        "Broadcast sent"
    );
    const doRestartScheduler = () => runAction(
        () => api.post("/admin/scheduler/restart"),
        "Scheduler restarted"
    );

    if (error && !summary) return <ErrorState message={error} onRetry={loadAll} />;

    const o = summary?.orders || {};
    const v = summary?.vendors || {};
    const r = summary?.riders || {};
    const ws = summary?.websocket || {};
    const stats = dashboard?.stats || {};

    const tiles = [
        { icon: FiPackage, label: "Live Orders", value: o.live ?? "—", tone: "primary" },
        { icon: FiClock, label: "Waiting Vendor Acceptance", value: o.waitingVendorAcceptance ?? "—", tone: "warning" },
        { icon: FiSearch, label: "Searching Rider", value: o.searchingRider ?? "—", tone: "warning" },
        { icon: FiUserCheck, label: "Waiting Rider Acceptance", value: assignments.filter(a => a.pendingRiders > 0).length, tone: "warning" },
        { icon: FiTruck, label: "Active Deliveries", value: mapData?.totalActiveDeliveries ?? "—", tone: "info" },
        { icon: FiAlertTriangle, label: "Late Orders", value: o.lateOrders ?? "—", tone: "danger" },
        { icon: FiXCircle, label: "Cancelled Orders (today)", value: o.cancelledToday ?? "—", tone: "neutral" },
        { icon: FiRefreshCcw, label: "Refund Queue", value: refunds.length, tone: "warning" },
        { icon: FiHome, label: "Active Vendors", value: v.active ?? "—", tone: "success" },
        { icon: FiHome, label: "Offline Vendors", value: v.offline ?? "—", tone: "neutral" },
        { icon: FiUsers, label: "Active Riders", value: r.active ?? "—", tone: "success" },
        { icon: FiUsers, label: "Offline Riders", value: r.offline ?? "—", tone: "neutral" },
        { icon: FiDollarSign, label: "Revenue Today", value: fmt(stats.todayRevenue), tone: "success" },
        { icon: FiPackage, label: "Orders Today", value: stats.todayOrders ?? "—", tone: "primary" },
        { icon: FiCreditCard, label: "Failed Payments (today)", value: summary?.failedPayments?.count ?? "—", tone: "danger" },
        { icon: FiWifi, label: "WebSocket Connections", value: ws.connections ?? "—", tone: "info", sublabel: `${ws.users ?? 0} users · ${ws.rooms ?? 0} rooms` },
        { icon: FiCpu, label: "Scheduler Status", value: `${schedulerStats?.jobs?.filter(j => j.enabled).length ?? 0}/${schedulerStats?.total ?? 0}`, tone: "info", sublabel: "jobs active" },
        { icon: FiList, label: "Assignment Queue", value: assignments.length, tone: "warning" },
    ];

    return (
        <div style={{ fontFamily: "'DM Sans',-apple-system,sans-serif", background: "var(--adm-bg)", minHeight: "100vh", padding: "16px 16px 40px" }}>
            {/* ═══ HEADER ═══ */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: "clamp(17px,3vw,21px)", fontWeight: 900, margin: 0, color: "var(--adm-text-primary)", display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--adm-primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FiActivity size={15} color="var(--adm-primary)" />
                        </span>
                        Operations Control Center
                    </h1>
                    <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "3px 0 0 41px", fontWeight: 500 }}>
                        Live order pipeline, fleet status, and admin quick actions
                        {connected ? " · live" : " · reconnecting…"}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="secondary" size="sm" icon={FiRefreshCcw} onClick={loadAll}>Refresh Queue</Button>
                    <Button variant="secondary" size="sm" icon={FiSend} onClick={() => setModal({ type: "broadcast" })}>Broadcast</Button>
                    <Button variant="danger" size="sm" icon={FiPlay} onClick={() => setModal({ type: "restartScheduler" })}>Restart Scheduler</Button>
                </div>
            </div>

            {/* ═══ STAT TILES ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 18 }}>
                {tiles.map((t) => (
                    <StatTile key={t.label} icon={t.icon} label={t.label} value={loading ? "…" : t.value} tone={t.tone} sublabel={t.sublabel} />
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14, alignItems: "start" }}>
                {/* ═══ LEFT: Live Orders + Refund Queue + Assignment Queue ═══ */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                    <Card padded={false}>
                        <CardHeader title="Live Orders" action={<span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{liveOrders.length} shown</span>} />
                        <Table
                            columns={[
                                { key: "order", label: "Order" }, { key: "status", label: "Status" },
                                { key: "rider", label: "Rider" }, { key: "actions", label: "" },
                            ]}
                            rows={liveOrders}
                            loading={loading}
                            empty={{ title: "No live orders", description: "Nothing in the Urbexon Hour pipeline right now." }}
                            renderRow={(ord) => (
                                <tr key={ord._id}>
                                    <td>
                                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>#{ord._id.slice(-6).toUpperCase()}</div>
                                        <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>{ord.customerName}</div>
                                    </td>
                                    <td><StatusBadge status={ord.delivery?.status || ord.orderStatus} /></td>
                                    <td style={{ fontSize: 12 }}>{ord.delivery?.riderName || <span style={{ color: "var(--adm-muted)" }}>Unassigned</span>}</td>
                                    <td>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            <Button size="sm" variant="secondary" onClick={async () => {
                                                setModal({ type: "assign", order: ord });
                                            }}>
                                                {ord.delivery?.assignedTo ? "Reassign" : "Assign"}
                                            </Button>
                                            <Button size="sm" variant="danger" onClick={() => setModal({ type: "cancel", order: ord })}>Cancel</Button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        />
                    </Card>

                    <Card padded={false}>
                        <CardHeader title="Refund Queue" action={<span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{refunds.length} pending</span>} />
                        <Table
                            columns={[{ key: "order", label: "Order" }, { key: "amount", label: "Amount" }, { key: "requested", label: "Requested" }]}
                            rows={refunds.slice(0, 8)}
                            loading={loading}
                            empty={{ title: "No refunds pending" }}
                            renderRow={(rf) => (
                                <tr key={rf._id}>
                                    <td style={{ fontWeight: 700, fontSize: 12.5 }}>#{rf._id.slice(-6).toUpperCase()} — {rf.customerName}</td>
                                    <td style={{ fontSize: 12.5 }}>{fmt(rf.refund?.amount ?? rf.totalAmount)}</td>
                                    <td style={{ fontSize: 11.5, color: "var(--adm-muted)" }}>{timeAgo(rf.refund?.requestedAt)}</td>
                                </tr>
                            )}
                        />
                    </Card>

                    <Card padded={false}>
                        <CardHeader title="Assignment Queue" action={<span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{assignments.length} in flight</span>} />
                        <Table
                            columns={[{ key: "order", label: "Order" }, { key: "round", label: "Round" }, { key: "pending", label: "Pending / Total Riders" }]}
                            rows={assignments}
                            loading={loading}
                            empty={{ title: "Assignment queue is empty" }}
                            renderRow={(a) => (
                                <tr key={a.orderId}>
                                    <td style={{ fontWeight: 700, fontSize: 12.5 }}>#{String(a.orderId).slice(-6).toUpperCase()}</td>
                                    <td style={{ fontSize: 12.5 }}>{a.round}</td>
                                    <td style={{ fontSize: 12.5 }}>{a.pendingRiders} / {a.totalCandidates}</td>
                                </tr>
                            )}
                        />
                    </Card>
                </div>

                {/* ═══ RIGHT: Realtime Timeline + Fleet ═══ */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                    <Card padded={false}>
                        <CardHeader title="Realtime Timeline" action={<span style={{ fontSize: 11, color: "var(--adm-muted)" }}>newest first</span>} />
                        <div style={{ maxHeight: 420, overflowY: "auto", padding: "6px 0" }}>
                            {events.length === 0 ? (
                                <EmptyState title="Waiting for events…" description="Order lifecycle events will appear here in realtime." />
                            ) : events.map((e, i) => {
                                const sub = e.event ? EVENT_LABELS[e.event] : null;
                                const label = sub || WS_TYPE_LABELS[e.type] || e.type;
                                return (
                                    <div key={i} style={{ padding: "9px 16px", borderBottom: "1px solid var(--adm-border-soft)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--adm-text-primary)" }}>{label}</div>
                                            {e.orderId && <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>#{String(e.orderId).slice(-6).toUpperCase()} {e.status ? `→ ${e.status}` : ""}</div>}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: "var(--adm-muted)", whiteSpace: "nowrap" }}>{timeAgo(new Date(e._at).toISOString())}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    <Card padded={false}>
                        <CardHeader title="Online Riders" action={<span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{onlineRiders.length}</span>} />
                        <Table
                            columns={[{ key: "name", label: "Rider" }, { key: "active", label: "Active" }, { key: "actions", label: "" }]}
                            rows={onlineRiders.slice(0, 8)}
                            loading={loading}
                            empty={{ title: "No riders online" }}
                            renderRow={(rider) => (
                                <tr key={rider._id}>
                                    <td style={{ fontSize: 12.5, fontWeight: 700 }}>{rider.name}</td>
                                    <td style={{ fontSize: 12.5 }}>{rider.activeOrders || 0}</td>
                                    <td><Button size="sm" variant="danger" onClick={() => setModal({ type: "suspend", kind: "rider", target: rider })}>Suspend</Button></td>
                                </tr>
                            )}
                        />
                    </Card>

                    <Card padded={false}>
                        <CardHeader title="Active Vendors" action={<span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{activeVendors.length}</span>} />
                        <Table
                            columns={[{ key: "name", label: "Vendor" }, { key: "actions", label: "" }]}
                            rows={activeVendors.slice(0, 8)}
                            loading={loading}
                            empty={{ title: "No approved vendors" }}
                            renderRow={(vendor) => (
                                <tr key={vendor._id}>
                                    <td style={{ fontSize: 12.5, fontWeight: 700 }}>{vendor.shopName || vendor.name}</td>
                                    <td><Button size="sm" variant="danger" onClick={() => setModal({ type: "suspend", kind: "vendor", target: vendor })}>Suspend</Button></td>
                                </tr>
                            )}
                        />
                    </Card>

                    <Card padded={false}>
                        <CardHeader title="Scheduler Jobs" />
                        <Table
                            columns={[{ key: "name", label: "Job" }, { key: "status", label: "Status" }]}
                            rows={schedulerStats?.jobs || []}
                            loading={loading}
                            empty={{ title: "No jobs registered" }}
                            renderRow={(j) => (
                                <tr key={j.name}>
                                    <td style={{ fontSize: 12 }}>{j.name}</td>
                                    <td><StatusBadge status={j.enabled ? "active" : "disabled"} /></td>
                                </tr>
                            )}
                        />
                    </Card>
                </div>
            </div>

            {/* ═══ MODALS ═══ */}
            <AssignRiderModal
                order={modal?.type === "assign" ? modal.order : null}
                riders={onlineRiders}
                loading={actionLoading}
                onConfirm={doAssign}
                onClose={() => setModal(null)}
            />
            <CancelOrderModal
                order={modal?.type === "cancel" ? modal.order : null}
                loading={actionLoading}
                onConfirm={doCancel}
                onClose={() => setModal(null)}
            />
            <SuspendModal
                target={modal?.type === "suspend" ? modal.target : null}
                kind={modal?.kind}
                loading={actionLoading}
                onConfirm={doSuspend}
                onClose={() => setModal(null)}
            />
            <BroadcastModal
                open={modal?.type === "broadcast"}
                loading={actionLoading}
                onConfirm={doBroadcast}
                onClose={() => setModal(null)}
            />
            <RestartSchedulerModal
                open={modal?.type === "restartScheduler"}
                loading={actionLoading}
                onConfirm={doRestartScheduler}
                onClose={() => setModal(null)}
            />
        </div>
    );
};

export default AdminOperations;
