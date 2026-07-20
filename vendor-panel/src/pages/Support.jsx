/**
 * Support.jsx — vendor support ticket list + create.
 * Follows Subscription.jsx's page conventions (inline styles, local msg
 * banner, useCallback+Promise.all loader, early-return spinner/error).
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Modal from "../components/Modal";
import { FiPlus, FiLifeBuoy, FiPaperclip, FiChevronLeft, FiChevronRight } from "react-icons/fi";

const CATEGORIES = [
    ["order", "Orders"], ["payment", "Payments"], ["delivery", "Delivery"],
    ["product", "Products"], ["payout", "Payouts"], ["subscription", "Subscription"],
    ["account", "Account"], ["other", "Other"],
];
const PRIORITIES = [["low", "Low"], ["normal", "Normal"], ["high", "High"]];

const STATUS_STYLES = {
    open: { bg: "#dbeafe", color: "#1d4ed8", label: "Open" },
    in_progress: { bg: "#fef3c7", color: "#92400e", label: "In Progress" },
    waiting_customer: { bg: "#ede9fe", color: "#6d28d9", label: "Awaiting You" },
    resolved: { bg: "#d1fae5", color: "#065f46", label: "Resolved" },
    closed: { bg: "#f3f4f6", color: "#4b5563", label: "Closed" },
};

const StatusPill = ({ status }) => {
    const s = STATUS_STYLES[status] || STATUS_STYLES.open;
    return (
        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
            {s.label}
        </span>
    );
};

const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
    fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
};

const Support = () => {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState({ text: "", type: "" });
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ subject: "", category: "other", priority: "normal", message: "" });
    const [files, setFiles] = useState([]);
    const [creating, setCreating] = useState(false);

    const showMsg = (text, type = "info") => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: "", type: "" }), 5000);
    };

    const loadData = useCallback(async () => {
        try {
            const params = { page, limit: 10 };
            if (statusFilter) params.status = statusFilter;
            const { data } = await api.get("/vendor/tickets", { params });
            setTickets(data.tickets || []);
            setStats(data.stats || null);
            setTotalPages(data.totalPages || 1);
        } catch {
            setError("Failed to load support tickets");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => { loadData(); }, [loadData]);

    const pickFiles = (e) => {
        const picked = Array.from(e.target.files || []).slice(0, 3);
        const tooBig = picked.find((f) => f.size > 5 * 1024 * 1024);
        if (tooBig) { showMsg(`"${tooBig.name}" exceeds the 5 MB limit`, "error"); return; }
        setFiles(picked);
    };

    const createTicket = async () => {
        if (!form.subject.trim()) return showMsg("Subject is required", "error");
        if (!form.message.trim()) return showMsg("Please describe your issue", "error");
        setCreating(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            files.forEach((f) => fd.append("attachments", f));
            const { data } = await api.post("/vendor/tickets", fd, { headers: { "Content-Type": "multipart/form-data" } });
            setShowCreate(false);
            setForm({ subject: "", category: "other", priority: "normal", message: "" });
            setFiles([]);
            showMsg("Ticket created — our team will get back to you soon", "success");
            navigate(`/support/${data.ticket._id}`);
        } catch (err) {
            showMsg(err.response?.data?.message || "Failed to create ticket", "error");
        } finally {
            setCreating(false);
        }
    };

    if (loading) return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error && !tickets.length && !stats) return (
        <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>{error}</div>
    );

    const statTiles = [
        ["Total", stats?.total || 0, "#111827"],
        ["Open", stats?.open || 0, "#1d4ed8"],
        ["In Progress", stats?.in_progress || 0, "#92400e"],
        ["Resolved", (stats?.resolved || 0) + (stats?.closed || 0), "#065f46"],
    ];

    return (
        <div style={{ maxWidth: 1100 }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                        <FiLifeBuoy /> Support
                    </h1>
                    <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Raise and track support tickets with the Urbexon team</p>
                </div>
                <button onClick={() => setShowCreate(true)} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                    <FiPlus size={15} /> New Ticket
                </button>
            </div>

            {msg.text && (
                <div style={{
                    padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 600, animation: "fadeUp .3s ease",
                    background: msg.type === "success" ? "#d1fae5" : msg.type === "error" ? "#fee2e2" : "#dbeafe",
                    color: msg.type === "success" ? "#065f46" : msg.type === "error" ? "#b91c1c" : "#1d4ed8",
                }}>
                    {msg.text}
                </div>
            )}

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
                {statTiles.map(([label, value, color]) => (
                    <div key={label} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {[["", "All"], ...Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.label])].map(([val, label]) => (
                    <button key={val} onClick={() => { setStatusFilter(val); setPage(1); }} style={{
                        padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${statusFilter === val ? "#7c3aed" : "#e5e7eb"}`,
                        background: statusFilter === val ? "#f5f3ff" : "#fff",
                        color: statusFilter === val ? "#6d28d9" : "#6b7280",
                    }}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Ticket list */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                {tickets.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 50, color: "#9ca3af", fontSize: 13 }}>
                        No tickets yet. Facing an issue? Create your first ticket.
                    </div>
                ) : tickets.map((t) => (
                    <div key={t._id} onClick={() => navigate(`/support/${t._id}`)} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                        padding: "14px 20px", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                    }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#fafafa"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {t.subject}
                                {t.lastReplyBy === "admin" && !["resolved", "closed"].includes(t.status) && (
                                    <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#7c3aed" }}>● Support replied</span>
                                )}
                            </div>
                            <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3 }}>
                                #{t._id.slice(-6).toUpperCase()} · {CATEGORIES.find(([k]) => k === t.category)?.[1] || t.category} · {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                {t.priority !== "normal" && <span style={{ marginLeft: 6, color: t.priority === "urgent" ? "#b91c1c" : t.priority === "high" ? "#c2410c" : "#6b7280", fontWeight: 700 }}>· {t.priority.toUpperCase()}</span>}
                            </div>
                        </div>
                        <StatusPill status={t.status} />
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 18 }}>
                    <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: 8, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1, display: "flex" }}>
                        <FiChevronLeft size={15} />
                    </button>
                    <span style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 600 }}>Page {page} of {totalPages}</span>
                    <button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: 8, cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1, display: "flex" }}>
                        <FiChevronRight size={15} />
                    </button>
                </div>
            )}

            {/* Create modal */}
            <Modal open={showCreate} onClose={() => setShowCreate(false)} closeOnOverlayClick={!creating} title="New Support Ticket" width={520}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: "0 0 18px" }}>New Support Ticket</h2>

                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Subject</label>
                <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} maxLength={200} placeholder="Short summary of the issue" style={{ ...inputStyle, marginBottom: 14 }} disabled={creating} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Category</label>
                        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle} disabled={creating}>
                            {CATEGORIES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Priority</label>
                        <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} style={inputStyle} disabled={creating}>
                            {PRIORITIES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                    </div>
                </div>

                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Describe the issue</label>
                <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={5} maxLength={5000} placeholder="Include order IDs, dates, amounts — anything that helps us resolve this faster" style={{ ...inputStyle, resize: "vertical", marginBottom: 14 }} disabled={creating} />

                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <FiPaperclip size={13} /> Attachments <span style={{ fontWeight: 500, color: "#9ca3af" }}>(max 3 files, 5 MB each — JPG/PNG/WEBP/PDF)</span>
                </label>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pickFiles} disabled={creating} style={{ fontSize: 12, marginBottom: 4 }} />
                {files.length > 0 && (
                    <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>{files.map((f) => f.name).join(", ")}</div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                    <button onClick={() => setShowCreate(false)} disabled={creating} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                        Cancel
                    </button>
                    <button onClick={createTicket} disabled={creating} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: creating ? "default" : "pointer", opacity: creating ? 0.7 : 1 }}>
                        {creating ? "Creating…" : "Create Ticket"}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Support;
