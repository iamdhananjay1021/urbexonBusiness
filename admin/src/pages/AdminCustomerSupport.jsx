/**
 * AdminCustomerSupport.jsx — Support ticket case management.
 *
 * Backend: backend/models/Ticket.js + controllers/admin/ticketController.js
 * (new — audited first, nothing equivalent existed; see PR notes). Reuses
 * the existing admin design system (Card, Table, Modal, FormField, Select,
 * StatusBadge, StatTile, Button) and the shared AdminWsContext socket for
 * realtime (admin:ticket_event) — falls back to a 30s poll only because
 * this is a brand new event type with no prior history to guarantee
 * delivery on a dropped connection.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/adminApi";
import { useAdminWsContext } from "../contexts/AdminWsContext";
import {
    Button, Card, CardHeader, Table, Modal, FormField, Select, SearchBar,
    StatusBadge, StatTile, EmptyState, ErrorState, Pagination,
} from "../components/ui";
import {
    FiInbox, FiClock, FiRefreshCw, FiCheckCircle, FiXCircle, FiAlertTriangle,
    FiSend, FiPaperclip, FiLock, FiStar, FiUsers, FiShoppingBag, FiTruck,
} from "react-icons/fi";

const POLL_MS = 30000;
const STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
const CATEGORIES = ["order", "payment", "delivery", "product", "vendor", "account", "payout", "subscription", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

const notify = (message, type = "success") => {
    window.dispatchEvent(new CustomEvent("api:error", { detail: { message, type } }));
};
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

/* SLA state badge for vendor tickets: red once escalated, amber while the
   first response is overdue but not yet escalated, nothing otherwise. */
const SlaBadge = ({ t }) => {
    if (["resolved", "closed"].includes(t.status)) return null;
    if (t.slaEscalated) {
        return <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "var(--adm-danger-tint, #fee2e2)", color: "var(--adm-danger, #b91c1c)" }}>ESCALATED</span>;
    }
    if (!t.firstResponseAt && t.slaFirstResponseDueAt && new Date(t.slaFirstResponseDueAt) < new Date()) {
        return <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "var(--adm-warning-tint, #fef3c7)", color: "var(--adm-warning, #92400e)" }}>SLA DUE</span>;
    }
    return null;
};

const CsatStars = ({ rating }) => rating ? (
    <span style={{ display: "inline-flex", gap: 1, verticalAlign: "middle" }}>
        {[1, 2, 3, 4, 5].map((n) => (
            <FiStar key={n} size={11} fill={rating >= n ? "#f59e0b" : "none"} color={rating >= n ? "#f59e0b" : "var(--adm-border)"} />
        ))}
    </span>
) : null;

/* ─── Ticket Detail Modal ─── */
const TicketDetailModal = ({ ticketId, onClose, onChanged }) => {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [admins, setAdmins] = useState([]);
    const [reply, setReply] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [files, setFiles] = useState([]);
    const [sending, setSending] = useState(false);
    const [canned, setCanned] = useState([]);

    const load = useCallback(async () => {
        if (!ticketId) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/admin/tickets/${ticketId}`);
            setTicket(data.ticket);
        } catch {
            notify("Failed to load ticket", "error");
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!ticketId) return;
        api.get("/auth/users?role=admin&limit=50").then(({ data }) => setAdmins(data.users || [])).catch(() => setAdmins([]));
        api.get("/admin/canned-responses?active=1").then(({ data }) => setCanned(data.responses || [])).catch(() => setCanned([]));
    }, [ticketId]);

    const runAction = async (fn, successMsg) => {
        try {
            await fn();
            notify(successMsg);
            await load();
            onChanged?.();
        } catch (err) {
            notify(err.response?.data?.message || "Action failed", "error");
        }
    };

    const sendReply = async () => {
        if (!reply.trim()) return;
        setSending(true);
        try {
            const form = new FormData();
            form.append("message", reply.trim());
            form.append("isInternalNote", isInternal);
            files.forEach((f) => form.append("attachments", f));
            await api.post(`/admin/tickets/${ticketId}/reply`, form, { headers: { "Content-Type": "multipart/form-data" } });
            setReply(""); setFiles([]); setIsInternal(false);
            notify(isInternal ? "Internal note added" : "Reply sent");
            await load();
            onChanged?.();
        } catch (err) {
            notify(err.response?.data?.message || "Failed to send", "error");
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal open={!!ticketId} onClose={onClose} title={ticket?.subject || "Ticket"} width={720}>
            {loading || !ticket ? (
                <EmptyState title="Loading…" />
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Header info + references */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "var(--adm-muted)" }}>
                        {ticket.requesterType === "vendor" ? (
                            <span>
                                <strong style={{ color: "var(--adm-primary)" }}>Vendor:</strong> {ticket.vendorShopName || ticket.vendorId?.shopName} · {ticket.vendorEmail || ticket.vendorId?.email} · {ticket.customerPhone || "—"}
                            </span>
                        ) : ticket.requesterType === "delivery" ? (
                            <span>
                                <strong style={{ color: "var(--adm-primary)" }}>Rider:</strong> {ticket.customerName} · {ticket.customerEmail} · {ticket.customerPhone || "—"}
                            </span>
                        ) : (
                            <span>{ticket.customerName} · {ticket.customerEmail} · {ticket.customerPhone || "—"}</span>
                        )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <StatusBadge status={ticket.status} />
                        <StatusBadge status={ticket.priority} />
                        {ticket.slaEscalated && !["resolved", "closed"].includes(ticket.status) && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 10, background: "var(--adm-danger-tint, #fee2e2)", color: "var(--adm-danger, #b91c1c)", alignSelf: "center" }}>SLA ESCALATED</span>
                        )}
                        {ticket.csat?.rating && (
                            <span style={{ alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--adm-muted)" }}>
                                CSAT: <CsatStars rating={ticket.csat.rating} />
                            </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--adm-muted)", alignSelf: "center" }}>Category: {ticket.category}</span>
                        {ticket.orderRef && <span style={{ fontSize: 11, color: "var(--adm-muted)", alignSelf: "center" }}>Order: #{(ticket.orderRef._id || ticket.orderRef).toString().slice(-6).toUpperCase()}</span>}
                        {ticket.vendorRef?.shopName && <span style={{ fontSize: 11, color: "var(--adm-muted)", alignSelf: "center" }}>Vendor: {ticket.vendorRef.shopName}</span>}
                        {ticket.deliveryRef?.name && <span style={{ fontSize: 11, color: "var(--adm-muted)", alignSelf: "center" }}>Rider: {ticket.deliveryRef.name}</span>}
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <FormField label="Status">
                            <Select value={ticket.status} onChange={(e) => runAction(() => api.patch(`/admin/tickets/${ticketId}/status`, { status: e.target.value }), "Status updated")}>
                                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                            </Select>
                        </FormField>
                        <FormField label="Priority">
                            <Select value={ticket.priority} onChange={(e) => runAction(() => api.patch(`/admin/tickets/${ticketId}/priority`, { priority: e.target.value }), "Priority updated")}>
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </Select>
                        </FormField>
                        <FormField label="Assigned Admin">
                            <Select value={ticket.assignedAdmin?._id || ""} onChange={(e) => {
                                const admin = admins.find((a) => a._id === e.target.value);
                                runAction(() => api.patch(`/admin/tickets/${ticketId}/assign`, { adminId: e.target.value, adminName: admin?.name }), "Ticket assigned");
                            }}>
                                <option value="">Unassigned</option>
                                {admins.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                            </Select>
                        </FormField>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                            {ticket.status !== "closed" ? (
                                <Button size="sm" variant="danger" icon={FiXCircle} onClick={() => runAction(() => api.patch(`/admin/tickets/${ticketId}/close`), "Ticket closed")}>Close</Button>
                            ) : (
                                <Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={() => runAction(() => api.patch(`/admin/tickets/${ticketId}/reopen`), "Ticket reopened")}>Reopen</Button>
                            )}
                        </div>
                    </div>

                    {/* Conversation thread */}
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-secondary)", marginBottom: 8 }}>Conversation</div>
                        <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 4 }}>
                            {(ticket.messages || []).map((m, i) => (
                                <div key={i} style={{
                                    alignSelf: m.sender === "admin" ? "flex-end" : "flex-start",
                                    maxWidth: "80%", padding: "8px 12px", borderRadius: 10,
                                    background: m.isInternalNote ? "var(--adm-warning-tint)" : m.sender === "admin" ? "var(--adm-primary-tint)" : "var(--adm-surface-alt)",
                                    border: `1px solid ${m.isInternalNote ? "var(--adm-warning)" : "var(--adm-border)"}`,
                                }}>
                                    <div style={{ fontSize: 10, color: "var(--adm-muted)", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                        {m.isInternalNote && <FiLock size={9} />}
                                        {m.sender === "vendor" && <span style={{ fontWeight: 800, color: "var(--adm-primary)" }}>VENDOR</span>}
                                        {m.sender === "delivery" && <span style={{ fontWeight: 800, color: "var(--adm-primary)" }}>RIDER</span>}
                                        {m.senderName || m.sender} · {fmtDate(m.createdAt)}
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--adm-text-primary)", whiteSpace: "pre-wrap" }}>{m.message}</div>
                                    {m.attachments?.length > 0 && (
                                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                            {m.attachments.map((a, j) => (
                                                <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--adm-primary)", display: "flex", alignItems: "center", gap: 3 }}>
                                                    <FiPaperclip size={10} /> {a.name || "attachment"}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Reply box */}
                    <div>
                        {canned.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                                <Select value="" onChange={(e) => {
                                    const c = canned.find((x) => x._id === e.target.value);
                                    // Insert into the textarea, never auto-send —
                                    // admin reviews/edits before hitting Send.
                                    if (c) setReply((prev) => (prev ? `${prev}\n\n${c.body}` : c.body));
                                }}>
                                    <option value="">📋 Insert canned response…</option>
                                    {[...canned].sort((a, b) => (a.category === ticket.category ? -1 : 0) - (b.category === ticket.category ? -1 : 0)).map((c) => (
                                        <option key={c._id} value={c._id}>{c.title}{c.category === ticket.category ? " ★" : ""}</option>
                                    ))}
                                </Select>
                            </div>
                        )}
                        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
                            placeholder="Type a reply…" className="adm-field-input"
                            style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} disabled={sending} />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <label style={{ fontSize: 12, color: "var(--adm-text-secondary)", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                                    <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} /> Internal note
                                </label>
                                <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} style={{ fontSize: 11 }} />
                            </div>
                            <Button size="sm" variant="primary" icon={FiSend} loading={sending} disabled={!reply.trim()} onClick={sendReply}>Send</Button>
                        </div>
                    </div>

                    {/* Activity Timeline */}
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-secondary)", marginBottom: 8 }}>Activity Timeline</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
                            {(ticket.activityLog || []).slice().reverse().map((a, i) => (
                                <div key={i} style={{ fontSize: 11.5, color: "var(--adm-muted)" }}>
                                    <strong style={{ color: "var(--adm-text-secondary)" }}>{a.actorName}</strong> {a.action.replace(/_/g, " ")} · {fmtDate(a.createdAt)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

/* ═══════════════════════════════════════════════════════════ MAIN ═══ */
const AdminCustomerSupport = () => {
    const [stats, setStats] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ status: "", category: "", priority: "", customer: "", orderId: "", search: "", dateFrom: "", dateTo: "" });
    // customer | vendor | delivery — partitions the queue via the
    // requesterType query param (backend maps "customer" to
    // $nin:["vendor","delivery"] so legacy tickets stay visible on the
    // customer tab).
    const [tab, setTab] = useState("customer");
    const [activeTicketId, setActiveTicketId] = useState(null);
    // Guest (not-logged-in) contact-form submissions — these never become
    // Tickets (no customerId to attach), so they're read from the existing
    // Contact model directly. GET/PATCH /api/contact already existed and
    // worked; nothing in admin/src ever called them before this.
    const [guestMessages, setGuestMessages] = useState([]);

    const { lastMessage } = useAdminWsContext();
    const debounceRef = useRef(null);
    const abortRef = useRef(null);

    const load = useCallback(async (pageArg = 1) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: pageArg, limit: 20, requesterType: tab });
            Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
            const [statsRes, listRes, contactRes] = await Promise.all([
                api.get(`/admin/tickets/stats?requesterType=${tab}`, { signal: controller.signal }),
                api.get(`/admin/tickets?${params.toString()}`, { signal: controller.signal }),
                api.get("/contact", { signal: controller.signal }),
            ]);
            setStats(statsRes.data.data);
            setTickets(listRes.data.tickets || []);
            setTotal(listRes.data.total || 0);
            setTotalPages(listRes.data.totalPages || 1);
            setPage(pageArg);
            setGuestMessages(Array.isArray(contactRes.data) ? contactRes.data : []);
            setError(null);
        } catch (err) {
            if (err.name === "CanceledError") return;
            setError("Failed to load tickets.");
        } finally {
            setLoading(false);
        }
    }, [filters, tab]);

    useEffect(() => { load(1); }, [load]);
    useEffect(() => {
        const t = setInterval(() => load(page), POLL_MS);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]);

    useEffect(() => {
        if (lastMessage?.type !== "admin:ticket_event") return;
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => load(page), 800);
        return () => clearTimeout(debounceRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastMessage]);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

    const markGuestRead = async (id) => {
        try {
            await api.patch(`/contact/${id}/read`);
            setGuestMessages((prev) => prev.map((m) => (m._id === id ? { ...m, isRead: true } : m)));
        } catch {
            notify("Failed to mark as read", "error");
        }
    };

    if (error && !stats) return <ErrorState message={error} onRetry={() => load(1)} />;

    return (
        <div style={{ fontFamily: "'DM Sans',-apple-system,sans-serif", background: "var(--adm-bg)", minHeight: "100vh", padding: "16px 16px 40px" }}>
            <div style={{ marginBottom: 18 }}>
                <h1 style={{ fontSize: "clamp(17px,3vw,21px)", fontWeight: 900, margin: 0, color: "var(--adm-text-primary)" }}>Support Center</h1>
                <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "3px 0 0" }}>Customer, vendor and delivery-partner support ticket queues</p>
            </div>

            {/* Customer / Vendor / Delivery tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {[["customer", "Customer Tickets", FiUsers], ["vendor", "Vendor Tickets", FiShoppingBag], ["delivery", "Delivery Tickets", FiTruck]].map(([val, label, Icon]) => (
                    <button key={val} onClick={() => setTab(val)} style={{
                        display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: "var(--adm-radius-md, 10px)",
                        border: `2px solid ${tab === val ? "var(--adm-primary)" : "var(--adm-border)"}`,
                        background: tab === val ? "var(--adm-primary-tint)" : "var(--adm-surface)",
                        color: tab === val ? "var(--adm-primary)" : "var(--adm-text-secondary)",
                        fontSize: 12.5, fontWeight: tab === val ? 800 : 600, cursor: "pointer", fontFamily: "inherit",
                    }}>
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {/* Dashboard */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
                <StatTile icon={FiInbox} label="Total Tickets" value={loading ? "…" : stats?.total ?? "—"} tone="primary" />
                <StatTile icon={FiInbox} label="Open" value={loading ? "…" : stats?.open ?? "—"} tone="info" />
                <StatTile icon={FiClock} label="In Progress" value={loading ? "…" : stats?.inProgress ?? "—"} tone="primary" />
                <StatTile icon={FiClock} label={tab === "vendor" ? "Awaiting Vendor" : tab === "delivery" ? "Awaiting Rider" : "Waiting Customer"} value={loading ? "…" : stats?.waitingCustomer ?? "—"} tone="warning" />
                <StatTile icon={FiCheckCircle} label="Resolved" value={loading ? "…" : stats?.resolved ?? "—"} tone="success" />
                <StatTile icon={FiXCircle} label="Closed" value={loading ? "…" : stats?.closed ?? "—"} tone="neutral" />
                <StatTile icon={FiAlertTriangle} label="High Priority" value={loading ? "…" : stats?.highPriority ?? "—"} tone="danger" />
                {tab !== "customer" && (
                    <>
                        <StatTile icon={FiAlertTriangle} label="SLA Breached" value={loading ? "…" : stats?.slaBreached ?? "—"} tone="danger" />
                        <StatTile icon={FiStar} label="Avg CSAT" value={loading ? "…" : stats?.avgCsat != null ? `${stats.avgCsat} ★ (${stats.csatCount})` : "—"} tone="success" />
                    </>
                )}
            </div>

            {/* Filters */}
            <Card style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                    <div style={{ minWidth: 220, flex: 1 }}>
                        <FormField label="Search">
                            <SearchBar value={filters.search} onChange={(v) => setFilter("search", v)} placeholder="Subject, customer name/email…" />
                        </FormField>
                    </div>
                    <FormField label="Status">
                        <Select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                            <option value="">All</option>
                            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                        </Select>
                    </FormField>
                    <FormField label="Category">
                        <Select value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
                            <option value="">All</option>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                    </FormField>
                    <FormField label="Priority">
                        <Select value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)}>
                            <option value="">All</option>
                            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </Select>
                    </FormField>
                    <FormField label="Order ID">
                        <input className="adm-field-input" value={filters.orderId} onChange={(e) => setFilter("orderId", e.target.value)} placeholder="Order ID" style={{ width: 140 }} />
                    </FormField>
                    <FormField label="From">
                        <input type="date" className="adm-field-input" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
                    </FormField>
                    <FormField label="To">
                        <input type="date" className="adm-field-input" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
                    </FormField>
                </div>
            </Card>

            {/* Ticket List */}
            <Card padded={false}>
                <CardHeader title="Tickets" action={<span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{total} total</span>} />
                <Table
                    columns={[
                        { key: "id", label: "Ticket ID" },
                        { key: "customer", label: tab === "vendor" ? "Vendor" : tab === "delivery" ? "Rider" : "Customer" },
                        { key: "subject", label: "Subject" },
                        { key: "category", label: "Category" }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" },
                        ...(tab !== "customer" ? [{ key: "sla", label: "SLA" }, { key: "csat", label: "CSAT" }] : []),
                        { key: "created", label: "Created" }, { key: "lastReply", label: "Last Reply" }, { key: "assigned", label: "Assigned" },
                    ]}
                    rows={tickets}
                    loading={loading}
                    empty={{ title: "No tickets found", description: "Try adjusting your filters." }}
                    renderRow={(t) => (
                        <tr key={t._id} className="db-row-hover" onClick={() => setActiveTicketId(t._id)}>
                            <td style={{ fontWeight: 700, fontSize: 12.5 }}>#{t._id.slice(-6).toUpperCase()}</td>
                            <td>
                                {t.requesterType === "vendor" ? (
                                    <>
                                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.vendorShopName || t.customerName}</div>
                                        <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>{t.vendorEmail || t.customerEmail}</div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.customerName}</div>
                                        <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>{t.customerEmail} · {t.customerPhone || "—"}</div>
                                    </>
                                )}
                            </td>
                            <td style={{ fontSize: 12.5, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</td>
                            <td style={{ fontSize: 12 }}>{t.category}</td>
                            <td><StatusBadge status={t.priority} /></td>
                            <td><StatusBadge status={t.status} /></td>
                            {tab !== "customer" && (
                                <>
                                    <td><SlaBadge t={t} /></td>
                                    <td><CsatStars rating={t.csat?.rating} /></td>
                                </>
                            )}
                            <td style={{ fontSize: 11.5, color: "var(--adm-muted)" }}>{fmtDate(t.createdAt)}</td>
                            <td style={{ fontSize: 11.5, color: "var(--adm-muted)" }}>{fmtDate(t.lastReplyAt)}</td>
                            <td style={{ fontSize: 12 }}>{t.assignedAdmin?.name || <span style={{ color: "var(--adm-muted)" }}>Unassigned</span>}</td>
                        </tr>
                    )}
                />
                {totalPages > 1 && (
                    <div style={{ padding: "12px 16px" }}>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => load(p)} disabled={loading} />
                    </div>
                )}
            </Card>

            {/* Guest (not-logged-in) contact-form submissions — these can't
                become Tickets (no account to attach them to), so they're
                shown read-only here instead of being invisible. Customer
                tab only — vendors always have accounts. */}
            {tab === "customer" && (
            <Card padded={false} style={{ marginTop: 14 }}>
                <CardHeader title="Guest Messages" action={<span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{guestMessages.filter((m) => !m.isRead).length} unread</span>} />
                <Table
                    columns={[
                        { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
                        { key: "subject", label: "Subject" }, { key: "message", label: "Message" }, { key: "created", label: "Received" }, { key: "actions", label: "" },
                    ]}
                    rows={guestMessages}
                    loading={loading}
                    empty={{ title: "No guest messages", description: "Contact-form submissions from logged-out visitors appear here." }}
                    renderRow={(m) => (
                        <tr key={m._id} style={{ opacity: m.isRead ? 0.6 : 1 }}>
                            <td style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</td>
                            <td style={{ fontSize: 12 }}>{m.email}</td>
                            <td style={{ fontSize: 12 }}>{m.phone || "—"}</td>
                            <td style={{ fontSize: 12 }}>{m.subject || "—"}</td>
                            <td style={{ fontSize: 12, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message}</td>
                            <td style={{ fontSize: 11.5, color: "var(--adm-muted)" }}>{fmtDate(m.createdAt)}</td>
                            <td>{!m.isRead && <Button size="sm" variant="secondary" onClick={() => markGuestRead(m._id)}>Mark Read</Button>}</td>
                        </tr>
                    )}
                />
            </Card>
            )}

            <TicketDetailModal ticketId={activeTicketId} onClose={() => setActiveTicketId(null)} onChanged={() => load(page)} />
        </div>
    );
};

export default AdminCustomerSupport;
