/**
 * Support.jsx — delivery partner support ticket list + create.
 * Mobile-first, follows the panel's G-theme/inline-style conventions
 * (Earnings.jsx is the pattern source). Backend: /api/delivery/tickets.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { G } from "../utils/theme";

const CATEGORIES = [
    ["order", "Order Issue"], ["delivery", "Delivery Issue"], ["payout", "Payout / Earnings"],
    ["account", "Account"], ["other", "Other"],
];
const PRIORITIES = [["low", "Low"], ["normal", "Normal"], ["high", "High"]];

const STATUS_STYLES = {
    open: { bg: G.blue50, color: G.blue600, label: "Open" },
    in_progress: { bg: G.amber50, color: G.amber600, label: "In Progress" },
    waiting_customer: { bg: "#ede9fe", color: "#6d28d9", label: "Awaiting You" },
    resolved: { bg: G.green50, color: G.green600, label: "Resolved" },
    closed: { bg: G.borderLight, color: G.textSub, label: "Closed" },
};

const inputStyle = {
    width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${G.border}`,
    fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box", outline: "none", background: G.white,
};

const Support = () => {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ subject: "", category: "other", priority: "normal", message: "" });
    const [files, setFiles] = useState([]);
    const [creating, setCreating] = useState(false);

    const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(""), 4000); };

    const load = useCallback(async () => {
        try {
            const params = { limit: 30 };
            if (statusFilter) params.status = statusFilter;
            const { data } = await api.get("/delivery/tickets", { params });
            setTickets(data.tickets || []);
            setStats(data.stats || null);
        } catch { }
        finally { setLoading(false); }
    }, [statusFilter]);

    useEffect(() => { load(); }, [load]);

    const pickFiles = (e) => {
        const picked = Array.from(e.target.files || []).slice(0, 3);
        const tooBig = picked.find((f) => f.size > 5 * 1024 * 1024);
        if (tooBig) { showMsg(`❌ "${tooBig.name}" is over 5 MB`); return; }
        setFiles(picked);
    };

    const createTicket = async () => {
        if (!form.subject.trim()) return showMsg("❌ Subject is required");
        if (!form.message.trim()) return showMsg("❌ Please describe your issue");
        setCreating(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            files.forEach((f) => fd.append("attachments", f));
            const { data } = await api.post("/delivery/tickets", fd, { headers: { "Content-Type": "multipart/form-data" } });
            setShowCreate(false);
            setForm({ subject: "", category: "other", priority: "normal", message: "" });
            setFiles([]);
            navigate(`/support/${data.ticket._id}`);
        } catch (err) {
            showMsg(`❌ ${err.response?.data?.message || "Failed to create ticket"}`);
        } finally {
            setCreating(false);
        }
    };

    if (loading) return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${G.green100}`, borderTopColor: G.brand, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    return (
        <div style={{ padding: "18px var(--px) 24px" }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h1 className="ud-page-title" style={{ fontSize: 20, fontWeight: 800, color: G.text, margin: 0 }}>🎧 Support</h1>
                <button onClick={() => setShowCreate(true)} style={{
                    background: G.brand, color: G.white, border: "none", borderRadius: 10,
                    padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                    + New Ticket
                </button>
            </div>

            {msg && (
                <div style={{ padding: "11px 14px", borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600, background: G.amber50, color: G.amber600, animation: "fadeUp .3s ease" }}>
                    {msg}
                </div>
            )}

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[["Open", (stats?.open || 0) + (stats?.in_progress || 0) + (stats?.waiting_customer || 0), G.blue600],
                ["Resolved", (stats?.resolved || 0) + (stats?.closed || 0), G.green600],
                ["Total", stats?.total || 0, G.text]].map(([label, val, color]) => (
                    <div key={label} style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                        <div className="ud-stat-val" style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
                        <div style={{ fontSize: 11, color: G.textSub, marginTop: 2 }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Filter chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
                {[["", "All"], ...Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.label])].map(([val, label]) => (
                    <button key={val} onClick={() => setStatusFilter(val)} style={{
                        padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                        border: `1px solid ${statusFilter === val ? G.brand : G.border}`,
                        background: statusFilter === val ? G.green50 : G.white,
                        color: statusFilter === val ? G.green600 : G.textSub,
                    }}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Ticket cards */}
            {tickets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: G.textMuted, fontSize: 13, background: G.white, border: `1px dashed ${G.border}`, borderRadius: 14 }}>
                    No tickets yet. Facing an issue with orders, payouts, or your account? Raise a ticket.
                </div>
            ) : tickets.map((t) => {
                const s = STATUS_STYLES[t.status] || STATUS_STYLES.open;
                return (
                    <div key={t._id} className="ud-order-card" onClick={() => navigate(`/support/${t._id}`)} style={{
                        background: G.white, border: `1px solid ${G.border}`, borderRadius: 14,
                        padding: "14px 16px", marginBottom: 10, cursor: "pointer",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {t.subject}
                                </div>
                                <div style={{ fontSize: 11, color: G.textMuted, marginTop: 3 }}>
                                    #{t._id.slice(-6).toUpperCase()} · {CATEGORIES.find(([k]) => k === t.category)?.[1] || t.category} · {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </div>
                            </div>
                            <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
                                {s.label}
                            </span>
                        </div>
                        {t.lastReplyBy === "admin" && !["resolved", "closed"].includes(t.status) && (
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: G.brand, marginTop: 6 }}>● Support replied — tap to view</div>
                        )}
                    </div>
                );
            })}

            {/* Create modal (bottom sheet style) */}
            {showCreate && (
                <div onClick={() => !creating && setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: G.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "22px 20px 28px", maxHeight: "88vh", overflowY: "auto", animation: "fadeUp .25s ease" }}>
                        <h2 style={{ fontSize: 17, fontWeight: 800, color: G.text, margin: "0 0 16px" }}>New Support Ticket</h2>

                        <label style={{ fontSize: 12, fontWeight: 700, color: G.textSub, display: "block", marginBottom: 6 }}>Subject</label>
                        <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} maxLength={200} placeholder="Short summary of the issue" style={{ ...inputStyle, marginBottom: 12 }} disabled={creating} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: G.textSub, display: "block", marginBottom: 6 }}>Category</label>
                                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle} disabled={creating}>
                                    {CATEGORIES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: G.textSub, display: "block", marginBottom: 6 }}>Priority</label>
                                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} style={inputStyle} disabled={creating}>
                                    {PRIORITIES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                </select>
                            </div>
                        </div>

                        <label style={{ fontSize: 12, fontWeight: 700, color: G.textSub, display: "block", marginBottom: 6 }}>Describe the issue</label>
                        <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={4} maxLength={5000} placeholder="Include order IDs, dates, amounts…" style={{ ...inputStyle, resize: "vertical", marginBottom: 12 }} disabled={creating} />

                        <label style={{ fontSize: 12, fontWeight: 700, color: G.textSub, display: "block", marginBottom: 6 }}>
                            📎 Attachments <span style={{ fontWeight: 500, color: G.textMuted }}>(max 3, 5 MB each)</span>
                        </label>
                        <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pickFiles} disabled={creating} style={{ fontSize: 12, marginBottom: 4 }} />
                        {files.length > 0 && <div style={{ fontSize: 11, color: G.textSub, marginBottom: 4 }}>{files.map((f) => f.name).join(", ")}</div>}

                        <button onClick={createTicket} disabled={creating} style={{
                            width: "100%", marginTop: 16, padding: "13px", background: G.brand, color: G.white,
                            border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: creating ? 0.7 : 1,
                        }}>
                            {creating ? "Creating…" : "Create Ticket"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Support;
