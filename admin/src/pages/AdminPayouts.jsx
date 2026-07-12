/**
 * AdminPayouts.jsx — Manage vendor + delivery payouts
 */
import { useState, useEffect, useCallback } from "react";
import adminApi from "../api/adminApi";
import {
    FiDollarSign, FiCheckCircle, FiXCircle,
    FiRefreshCw, FiFilter, FiCreditCard,
} from "react-icons/fi";
import {
    Button, Badge, Card, Table, Pagination,
    Modal, FormField, Input, Select,
} from "../components/ui";

const STATUS_TONE = {
    requested: "warning",
    approved: "info",
    processing: "primary",
    completed: "success",
    rejected: "danger",
};

const STATUS_LABEL = {
    requested: "Requested", approved: "Approved", processing: "Processing",
    completed: "Completed", rejected: "Rejected",
};

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ── Complete modal ── */
const CompleteModal = ({ payout, onConfirm, onClose, loading }) => {
    const [paymentRef, setPaymentRef] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
    const [note, setNote] = useState("");
    return (
        <Modal
            open
            onClose={onClose}
            title="Complete payout"
            width={400}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="success" icon={FiCheckCircle} loading={loading} onClick={() => onConfirm({ paymentRef, paymentMethod, note })}>
                        Mark paid
                    </Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>
                {payout.recipientName} — {fmt(payout.amount)}
            </p>
            {payout.bankDetails?.accountNumber && (
                <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--adm-text-secondary)" }}>
                    <strong>A/C:</strong> {payout.bankDetails.accountNumber} · <strong>IFSC:</strong> {payout.bankDetails.ifsc} · <strong>Bank:</strong> {payout.bankDetails.bankName}
                </div>
            )}
            {payout.bankDetails?.upiId && (
                <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--adm-text-secondary)" }}>
                    <strong>UPI:</strong> {payout.bankDetails.upiId}
                </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <FormField label="Payment method">
                    <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} disabled={loading}>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="upi">UPI</option>
                    </Select>
                </FormField>
                <FormField label="Payment reference (UTR/ID)">
                    <Input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Enter reference..." disabled={loading} />
                </FormField>
                <FormField label="Note (optional)">
                    <Input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Internal note..." disabled={loading} />
                </FormField>
            </div>
        </Modal>
    );
};

/* ── Reject modal ── */
const RejectModal = ({ payout, onConfirm, onClose, loading }) => {
    const [reason, setReason] = useState("");
    const trimmedReason = reason.trim();
    return (
        <Modal
            open
            onClose={onClose}
            title="Reject payout"
            width={380}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="danger" loading={loading} disabled={!trimmedReason} onClick={() => onConfirm(trimmedReason)}>Reject</Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>{payout.recipientName} — {fmt(payout.amount)}</p>
            <FormField label="Rejection reason" error={reason.length > 0 && trimmedReason.length === 0 ? "Reason can't be just whitespace." : undefined}>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this being rejected?" disabled={loading}
                    className="adm-field-input" style={{ width: "100%", boxSizing: "border-box", minHeight: 80, resize: "vertical", fontFamily: "inherit" }} />
            </FormField>
        </Modal>
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
            showToast("success", "Payout completed");
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

    const columns = [
        { key: "recipient", label: "Recipient" },
        { key: "type", label: "Type" },
        { key: "amount", label: "Amount" },
        { key: "bank", label: "Bank details" },
        { key: "status", label: "Status" },
        { key: "actions", label: "Actions" },
    ];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)", background: "var(--adm-bg)", minHeight: "100vh", padding: "32px 24px", boxSizing: "border-box" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                {/* Toast */}
                {toast && (
                    <div style={{
                        position: "fixed", top: 20, right: 20, zIndex: 9999,
                        background: toast.type === "error" ? "var(--adm-danger-tint)" : "var(--adm-success-tint)",
                        border: `1px solid ${toast.type === "error" ? "var(--adm-danger)" : "var(--adm-success)"}`,
                        color: toast.type === "error" ? "var(--adm-danger)" : "var(--adm-success)",
                        padding: "10px 16px", borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 600,
                        boxShadow: "var(--adm-shadow-md)", maxWidth: 340,
                    }}>
                        {toast.msg}
                    </div>
                )}

                {completeModal && <CompleteModal payout={completeModal} onConfirm={handleComplete} onClose={() => setCompleteModal(null)} loading={actionLoading === completeModal._id} />}
                {rejectModal && <RejectModal payout={rejectModal} onConfirm={handleReject} onClose={() => setRejectModal(null)} loading={actionLoading === rejectModal._id} />}

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Payouts</h1>
                        <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 3 }}>Manage vendor & delivery partner withdrawals</p>
                    </div>
                    <Button variant="secondary" icon={FiRefreshCw} loading={loading} onClick={() => fetchPayouts()}>Refresh</Button>
                </div>

                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                    <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Pending requests</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--adm-warning)" }}>{countRequested}</div>
                        <div style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginTop: 2 }}>{fmt(totalRequested)}</div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Total paid out</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--adm-success)" }}>{countCompleted}</div>
                        <div style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginTop: 2 }}>{fmt(totalCompleted)}</div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Total payouts</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--adm-primary)" }}>{total}</div>
                    </Card>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-muted)", display: "flex", alignItems: "center", gap: 4 }}><FiFilter size={12} /> Filter:</span>
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
                                style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, border: active ? "1px solid var(--adm-primary)" : "1px solid var(--adm-border)", background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)", color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)", borderRadius: "var(--adm-radius-md)", cursor: "pointer", fontFamily: "inherit" }}>
                                {f.label}
                            </button>
                        );
                    })}
                </div>

                {/* Table */}
                <Table
                    columns={columns}
                    rows={payouts}
                    loading={loading && payouts.length === 0}
                    empty={{ icon: FiDollarSign, title: "No payouts found" }}
                    renderRow={(p) => {
                        const isActing = actionLoading === p._id;
                        const bd = p.bankDetails || {};
                        return (
                            <tr key={p._id}>
                                <td>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", margin: 0 }}>{p.recipientName || "—"}</p>
                                    <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                                </td>
                                <td>
                                    <Badge tone={p.recipientType === "vendor" ? "primary" : "success"}>{p.recipientType === "vendor" ? "Vendor" : "Delivery"}</Badge>
                                </td>
                                <td style={{ fontWeight: 700, color: "var(--adm-success)" }}>{fmt(p.amount)}</td>
                                <td style={{ fontSize: 12, color: "var(--adm-text-secondary)" }}>
                                    {bd.accountNumber ? (
                                        <span>{bd.bankName} ••{bd.accountNumber.slice(-4)} · {bd.ifsc}</span>
                                    ) : bd.upiId ? (
                                        <span>UPI: {bd.upiId}</span>
                                    ) : <span style={{ color: "var(--adm-muted)" }}>No bank info</span>}
                                </td>
                                <td>
                                    <Badge tone={STATUS_TONE[p.status] || "neutral"} dot>{STATUS_LABEL[p.status] || p.status}</Badge>
                                </td>
                                <td>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                        {p.status === "requested" && (
                                            <>
                                                <Button variant="primary" size="sm" loading={isActing} onClick={() => handleApprove(p._id)}>Approve</Button>
                                                <Button variant="success" size="sm" onClick={() => setCompleteModal(p)} disabled={isActing}>Pay</Button>
                                                <Button variant="danger" size="sm" onClick={() => setRejectModal(p)} disabled={isActing}>Reject</Button>
                                            </>
                                        )}
                                        {p.status === "approved" && (
                                            <Button variant="success" size="sm" icon={FiCreditCard} disabled={isActing} onClick={() => setCompleteModal(p)}>Pay now</Button>
                                        )}
                                        {p.status === "completed" && (
                                            <span style={{ fontSize: 11, color: "var(--adm-success)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                                <FiCheckCircle size={11} /> Paid
                                                {p.paymentRef && <span style={{ fontSize: 10, color: "var(--adm-muted)" }}>· {p.paymentRef}</span>}
                                            </span>
                                        )}
                                        {p.status === "rejected" && (
                                            <span style={{ fontSize: 11, color: "var(--adm-danger)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                                <FiXCircle size={11} /> {p.rejectionReason || "Rejected"}
                                            </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20 }}>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={goToPage} disabled={loading} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPayouts;
