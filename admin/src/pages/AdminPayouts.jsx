/**
 * AdminPayouts.jsx — Manage vendor + delivery payouts
 */
import { useState, useEffect, useCallback } from "react";
import adminApi from "../api/adminApi";
import {
    FiDollarSign, FiCheckCircle, FiXCircle, FiLoader,
    FiRefreshCw, FiFilter, FiCreditCard,
} from "react-icons/fi";

const T = {
    bg: "#f8fafc", white: "#ffffff", surfaceAlt: "#f1f5f9",
    border: "#e2e8f0", borderLight: "#f1f5f9",
    blue: "#2563eb", blueBg: "#eff6ff", blueMid: "#dbeafe",
    text: "#1e293b", sub: "#334155", muted: "#475569", hint: "#94a3b8",
    green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#8b5cf6",
};

const STATUS_CONFIG = {
    requested: { label: "Requested", color: T.amber, bg: "#fef3c7" },
    approved: { label: "Approved", color: T.blue, bg: T.blueBg },
    processing: { label: "Processing", color: T.violet, bg: "#f5f3ff" },
    completed: { label: "Completed", color: T.green, bg: "#f0fdf4" },
    rejected: { label: "Rejected", color: T.red, bg: "#fef2f2" },
};

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ── Modal ── */
const CompleteModal = ({ payout, onConfirm, onClose, loading }) => {
    const [paymentRef, setPaymentRef] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
    const [note, setNote] = useState("");
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: T.white, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Complete payout</h3>
                <p style={{ fontSize: 13, color: T.hint, marginBottom: 16 }}>
                    {payout.recipientName} — {fmt(payout.amount)}
                </p>
                {payout.bankDetails?.accountNumber && (
                    <div style={{ background: T.surfaceAlt, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: T.sub }}>
                        <strong>A/C:</strong> {payout.bankDetails.accountNumber} · <strong>IFSC:</strong> {payout.bankDetails.ifsc} · <strong>Bank:</strong> {payout.bankDetails.bankName}
                    </div>
                )}
                {payout.bankDetails?.upiId && (
                    <div style={{ background: T.surfaceAlt, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: T.sub }}>
                        <strong>UPI:</strong> {payout.bankDetails.upiId}
                    </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Payment method</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} disabled={loading}
                            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.text, background: T.white, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="upi">UPI</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Payment reference (UTR/ID)</label>
                        <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Enter reference..." disabled={loading}
                            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Note (optional)</label>
                        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Internal note..." disabled={loading}
                            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button onClick={() => onConfirm({ paymentRef, paymentMethod, note })} disabled={loading}
                        style={{ flex: 1, padding: "10px", background: T.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {loading ? <FiLoader size={13} style={{ animation: "ap-spin .8s linear infinite" }} /> : <FiCheckCircle size={13} />}
                        Mark paid
                    </button>
                    <button onClick={onClose} disabled={loading}
                        style={{ padding: "10px 18px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.muted, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

/* ── Reject Modal ── */
const RejectModal = ({ payout, onConfirm, onClose, loading }) => {
    const [reason, setReason] = useState("");
    const trimmedReason = reason.trim();
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: T.white, borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T.red, marginBottom: 4 }}>Reject payout</h3>
                <p style={{ fontSize: 13, color: T.hint, marginBottom: 16 }}>{payout.recipientName} — {fmt(payout.amount)}</p>
                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Rejection reason</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this being rejected?" disabled={loading}
                        style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", minHeight: 80, resize: "vertical", boxSizing: "border-box" }} />
                    {reason.length > 0 && trimmedReason.length === 0 && (
                        <p style={{ fontSize: 11, color: T.red, marginTop: 4 }}>Reason can't be just whitespace.</p>
                    )}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button onClick={() => onConfirm(trimmedReason)} disabled={loading || !trimmedReason}
                        style={{ flex: 1, padding: "10px", background: T.red, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (loading || !trimmedReason) ? "not-allowed" : "pointer", opacity: (loading || !trimmedReason) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {loading ? <FiLoader size={13} style={{ animation: "ap-spin .8s linear infinite" }} /> : "Reject"}
                    </button>
                    <button onClick={onClose} disabled={loading}
                        style={{ padding: "10px 18px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.muted, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const AdminPayouts = () => {
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [summary, setSummary] = useState({});
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterType, setFilterType] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [toast, setToast] = useState(null);
    const [completeModal, setCompleteModal] = useState(null);
    const [rejectModal, setRejectModal] = useState(null);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const fetchPayouts = useCallback(async (opts = {}) => {
        setLoading(true);
        try {
            const nextPage = opts.page || page;
            const params = new URLSearchParams();
            if (opts.type || filterType) params.set("type", opts.type || filterType);
            if (opts.status || filterStatus) params.set("status", opts.status || filterStatus);
            params.set("page", nextPage);
            const { data } = await adminApi.get(`/admin/payouts?${params}`);
            setPayouts(data.payouts || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setSummary(data.summary || {});
            setPage(nextPage);
        } catch { showToast("error", "Failed to load payouts"); }
        finally { setLoading(false); }
    }, [filterType, filterStatus, page, showToast]);

    useEffect(() => { fetchPayouts(); }, []);

    const handleApprove = async (id) => {
        setActionLoading(id);
        try {
            await adminApi.patch(`/admin/payouts/${id}/approve`);
            showToast("success", "Payout approved");
            fetchPayouts();
        } catch { showToast("error", "Failed to approve"); }
        finally { setActionLoading(null); }
    };

    const handleComplete = async (payload) => {
        setActionLoading(completeModal._id);
        try {
            await adminApi.patch(`/admin/payouts/${completeModal._id}/complete`, payload);
            showToast("success", "Payout completed ✓");
            setCompleteModal(null);
            fetchPayouts();
        } catch { showToast("error", "Failed to complete"); }
        finally { setActionLoading(null); }
    };

    const handleReject = async (reason) => {
        setActionLoading(rejectModal._id);
        try {
            await adminApi.patch(`/admin/payouts/${rejectModal._id}/reject`, { reason });
            showToast("success", "Payout rejected");
            setRejectModal(null);
            fetchPayouts();
        } catch { showToast("error", "Failed to reject"); }
        finally { setActionLoading(null); }
    };

    const applyFilter = (type, status) => {
        setFilterType(type); setFilterStatus(status);
        fetchPayouts({ type, status, page: 1 });
    };

    const goToPage = (p) => {
        const clamped = Math.min(totalPages, Math.max(1, p));
        fetchPayouts({ page: clamped });
    };

    // Summary stats
    const totalRequested = summary.requested?.total || 0;
    const totalCompleted = summary.completed?.total || 0;
    const countRequested = summary.requested?.count || 0;
    const countCompleted = summary.completed?.count || 0;

    return (
        <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: T.text, background: T.bg, minHeight: "100vh", padding: "32px 24px", boxSizing: "border-box" }}>
            <style>{`
                @keyframes ap-spin{to{transform:rotate(360deg)}}
                @keyframes ap-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
                .ap-row{animation:ap-fadeUp .3s ease forwards;transition:border-color .15s;}
                .ap-row:hover{border-color:#bfdbfe !important;}
                button:disabled{cursor:not-allowed;}
                @media (max-width: 640px){
                    .ap-page{padding:20px 14px !important;}
                }
            `}</style>

            <div className="ap-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
                {/* Toast */}
                {toast && (
                    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.type === "error" ? "#fef2f2" : "#f0fdf4", border: `1px solid ${toast.type === "error" ? "#fecaca" : "#bbf7d0"}`, color: toast.type === "error" ? T.red : T.green, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", maxWidth: 340 }}>
                        {toast.msg}
                    </div>
                )}

                {completeModal && <CompleteModal payout={completeModal} onConfirm={handleComplete} onClose={() => setCompleteModal(null)} loading={actionLoading === completeModal._id} />}
                {rejectModal && <RejectModal payout={rejectModal} onConfirm={handleReject} onClose={() => setRejectModal(null)} loading={actionLoading === rejectModal._id} />}

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Payouts</h1>
                        <p style={{ fontSize: 13, color: T.hint, marginTop: 3 }}>Manage vendor & delivery partner withdrawals</p>
                    </div>
                    <button onClick={() => fetchPayouts()} disabled={loading}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", color: T.muted, opacity: loading ? 0.6 : 1 }}>
                        <FiRefreshCw size={13} style={loading ? { animation: "ap-spin .8s linear infinite" } : undefined} /> Refresh
                    </button>
                </div>

                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                    {[
                        { label: "Pending requests", value: countRequested, sub: fmt(totalRequested), color: T.amber },
                        { label: "Total paid out", value: countCompleted, sub: fmt(totalCompleted), color: T.green },
                        { label: "Total payouts", value: total, color: T.blue },
                    ].map((c, i) => (
                        <div key={i} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.hint, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{c.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                            {c.sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{c.sub}</div>}
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.hint, display: "flex", alignItems: "center", gap: 4 }}><FiFilter size={12} /> Filter:</span>
                    {[
                        { label: "All", type: "", status: "" },
                        { label: "Vendors", type: "vendor", status: "" },
                        { label: "Delivery", type: "delivery", status: "" },
                        { label: "Requested", type: "", status: "requested" },
                        { label: "Completed", type: "", status: "completed" },
                        { label: "Rejected", type: "", status: "rejected" },
                    ].map(f => {
                        const active = filterType === f.type && filterStatus === f.status;
                        return (
                            <button key={f.label} onClick={() => applyFilter(f.type, f.status)}
                                style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, border: active ? `1px solid ${T.blue}` : `1px solid ${T.border}`, background: active ? T.blueBg : T.white, color: active ? T.blue : T.muted, borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                                {f.label}
                            </button>
                        );
                    })}
                </div>

                {/* Table */}
                <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, overflowX: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 1fr 100px 160px", gap: 8, padding: "10px 20px", background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`, minWidth: 650 }}>
                        {["Recipient", "Type", "Amount", "Bank details", "Status", "Actions"].map(h => (
                            <p key={h} style={{ fontSize: 10, fontWeight: 700, color: T.hint, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>{h}</p>
                        ))}
                    </div>

                    {loading && payouts.length === 0 ? (
                        <div style={{ padding: "52px 0", textAlign: "center" }}>
                            <FiLoader size={20} style={{ color: T.blue, animation: "ap-spin .8s linear infinite" }} />
                        </div>
                    ) : payouts.length === 0 ? (
                        <div style={{ padding: "52px 0", textAlign: "center" }}>
                            <FiDollarSign size={28} style={{ color: T.hint, marginBottom: 8 }} />
                            <p style={{ color: T.hint, fontSize: 14, margin: 0 }}>No payouts found</p>
                        </div>
                    ) : payouts.map((p, idx) => {
                        const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.requested;
                        const isActing = actionLoading === p._id;
                        const bd = p.bankDetails || {};
                        return (
                            <div key={p._id} className="ap-row"
                                style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 1fr 100px 160px", gap: 8, padding: "14px 20px", borderBottom: idx < payouts.length - 1 ? `1px solid ${T.borderLight}` : "none", alignItems: "center", animationDelay: `${idx * 15}ms`, minWidth: 650 }}>

                                {/* Recipient */}
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: T.sub, margin: 0 }}>{p.recipientName || "—"}</p>
                                    <p style={{ fontSize: 11, color: T.hint, margin: "2px 0 0" }}>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                                </div>

                                {/* Type */}
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: p.recipientType === "vendor" ? "#f5f3ff" : "#ecfdf5", color: p.recipientType === "vendor" ? T.violet : T.green, width: "fit-content" }}>
                                    {p.recipientType === "vendor" ? "Vendor" : "Delivery"}
                                </span>

                                {/* Amount */}
                                <p style={{ fontSize: 14, fontWeight: 700, color: T.green, margin: 0 }}>{fmt(p.amount)}</p>

                                {/* Bank details */}
                                <div style={{ fontSize: 11, color: T.muted }}>
                                    {bd.accountNumber ? (
                                        <span>{bd.bankName} ••{bd.accountNumber.slice(-4)} · {bd.ifsc}</span>
                                    ) : bd.upiId ? (
                                        <span>UPI: {bd.upiId}</span>
                                    ) : <span style={{ color: T.hint }}>No bank info</span>}
                                </div>

                                {/* Status */}
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "3px 10px", borderRadius: 99, width: "fit-content" }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />{cfg.label}
                                </span>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {p.status === "requested" && (
                                        <>
                                            <button onClick={() => handleApprove(p._id)} disabled={isActing}
                                                style={{ padding: "5px 10px", background: T.blue, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", opacity: isActing ? 0.6 : 1 }}>
                                                {isActing ? "…" : "Approve"}
                                            </button>
                                            <button onClick={() => setCompleteModal(p)} disabled={isActing}
                                                style={{ padding: "5px 10px", background: T.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", opacity: isActing ? 0.6 : 1 }}>
                                                Pay
                                            </button>
                                            <button onClick={() => setRejectModal(p)} disabled={isActing}
                                                style={{ padding: "5px 10px", background: "#fee2e2", color: T.red, border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", opacity: isActing ? 0.6 : 1 }}>
                                                Reject
                                            </button>
                                        </>
                                    )}
                                    {p.status === "approved" && (
                                        <button onClick={() => setCompleteModal(p)} disabled={isActing}
                                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: T.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", opacity: isActing ? 0.6 : 1 }}>
                                            <FiCreditCard size={10} />Pay now
                                        </button>
                                    )}
                                    {p.status === "completed" && (
                                        <span style={{ fontSize: 11, color: T.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                            <FiCheckCircle size={11} /> Paid
                                            {p.paymentRef && <span style={{ fontSize: 10, color: T.hint }}>· {p.paymentRef}</span>}
                                        </span>
                                    )}
                                    {p.status === "rejected" && (
                                        <span style={{ fontSize: 11, color: T.red, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                            <FiXCircle size={11} /> {p.rejectionReason || "Rejected"}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20 }}>
                        <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                            style={{ padding: "6px 12px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.muted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
                        <span style={{ fontSize: 13, color: T.muted }}>Page {page} of {totalPages}</span>
                        <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                            style={{ padding: "6px 12px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.muted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}>Next →</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPayouts;