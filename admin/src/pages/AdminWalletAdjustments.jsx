/**
 * AdminWalletAdjustments.jsx — cross-vendor Approval Queue for manual
 * Vendor Wallet adjustments (maker-checker). Structural mirror of
 * AdminPayouts.jsx (summary cards + filter chips + Table + Pagination).
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as vendorApi from "../api/vendorApi";
import { useAdminAuth } from "../auth/AdminAuthContext";
import {
    FiCheckCircle, FiXCircle, FiRefreshCw, FiFilter, FiCreditCard,
} from "react-icons/fi";
import {
    Button, Badge, Card, Table, Pagination, Modal, FormField,
} from "../components/ui";

const STATUS_TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/* ── Reject modal (Reviewer Notes) ── */
const RejectModal = ({ request, onConfirm, onClose, loading }) => {
    const [notes, setNotes] = useState("");
    return (
        <Modal
            open
            onClose={onClose}
            title="Reject Adjustment"
            width={400}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="danger" icon={FiXCircle} loading={loading} onClick={() => onConfirm(notes)}>Reject</Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>
                {request.vendor?.shopName || "Vendor"} — {request.payload?.direction === "debit" ? "Debit" : "Credit"} {fmt(request.amount)}
            </p>
            <FormField label="Reviewer Notes (optional)">
                <textarea
                    value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for rejection..." rows={3}
                    className="adm-field-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
                    disabled={loading}
                />
            </FormField>
        </Modal>
    );
};

/* ── Approve confirmation modal ── */
const ApproveModal = ({ request, onConfirm, onClose, loading }) => (
    <Modal
        open
        onClose={onClose}
        title="Approve Adjustment"
        width={400}
        footer={(
            <>
                <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button variant="success" icon={FiCheckCircle} loading={loading} onClick={onConfirm}>Approve & Apply</Button>
            </>
        )}
    >
        <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", marginTop: 0 }}>
            Approve <strong>{request.payload?.direction === "debit" ? "debit" : "credit"}</strong> of{" "}
            <strong>{fmt(request.amount)}</strong> to <strong>{request.vendor?.shopName || "this vendor"}</strong>'s wallet?
        </p>
        <p style={{ fontSize: 12, color: "var(--adm-muted)" }}>Reason: {request.reason}</p>
        <p style={{ fontSize: 11, color: "var(--adm-warning)", background: "var(--adm-warning-tint)", padding: 10, borderRadius: "var(--adm-radius-sm)" }}>
            This will apply immediately and cannot be undone.
        </p>
    </Modal>
);

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const AdminWalletAdjustments = () => {
    const navigate = useNavigate();
    const { admin } = useAdminAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState("PENDING");
    const [toast, setToast] = useState(null);
    const [approveModal, setApproveModal] = useState(null);
    const [rejectModal, setRejectModal] = useState(null);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const fetchRequests = useCallback(async (opts = {}) => {
        setLoading(true);
        try {
            const nextPage = opts.page || page;
            const status = opts.status !== undefined ? opts.status : statusFilter;
            const params = { page: nextPage, limit: 20 };
            if (status) params.status = status;
            const { data } = await vendorApi.fetchWalletAdjustments(params);
            setRequests(data.requests || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setPage(nextPage);
        } catch {
            showToast("error", "Failed to load wallet adjustments");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, showToast]);

    useEffect(() => { fetchRequests(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const applyFilter = (status) => {
        setStatusFilter(status);
        fetchRequests({ status, page: 1 });
    };

    const goToPage = (p) => {
        const clamped = Math.min(totalPages, Math.max(1, p));
        fetchRequests({ page: clamped });
    };

    const handleApprove = async () => {
        const id = approveModal._id;
        setActionLoading(id);
        try {
            await vendorApi.approveWalletAdjustment(id);
            showToast("success", "Adjustment approved and applied");
            setApproveModal(null);
            fetchRequests();
        } catch (err) {
            showToast("error", err.response?.data?.message || "Failed to approve adjustment");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (reviewNotes) => {
        const id = rejectModal._id;
        setActionLoading(id);
        try {
            await vendorApi.rejectWalletAdjustment(id, { reviewNotes });
            showToast("success", "Adjustment rejected");
            setRejectModal(null);
            fetchRequests();
        } catch (err) {
            showToast("error", err.response?.data?.message || "Failed to reject adjustment");
        } finally {
            setActionLoading(null);
        }
    };

    const pendingCount = requests.filter((r) => r.status === "PENDING").length;

    const columns = [
        { key: "vendor", label: "Vendor" },
        { key: "direction", label: "Direction" },
        { key: "amount", label: "Amount" },
        { key: "reason", label: "Reason" },
        { key: "requestedBy", label: "Requested By" },
        { key: "status", label: "Status" },
        { key: "actions", label: "Actions" },
    ];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)", background: "var(--adm-bg)", minHeight: "100vh", padding: "32px 24px", boxSizing: "border-box" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
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

                {approveModal && <ApproveModal request={approveModal} onConfirm={handleApprove} onClose={() => setApproveModal(null)} loading={actionLoading === approveModal._id} />}
                {rejectModal && <RejectModal request={rejectModal} onConfirm={handleReject} onClose={() => setRejectModal(null)} loading={actionLoading === rejectModal._id} />}

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Wallet Adjustments</h1>
                        <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 3 }}>Maker-checker approval queue for manual vendor wallet credits/debits</p>
                    </div>
                    <Button variant="secondary" icon={FiRefreshCw} loading={loading} onClick={() => fetchRequests()}>Refresh</Button>
                </div>

                {/* Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                    <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Pending (this page)</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--adm-warning)" }}>{pendingCount}</div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Total requests</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--adm-primary)" }}>{total}</div>
                    </Card>
                </div>

                {/* Filters — Pending / Approved / Rejected tabs */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-muted)", display: "flex", alignItems: "center", gap: 4 }}><FiFilter size={12} /> Status:</span>
                    {[
                        { label: "Pending", value: "PENDING" },
                        { label: "Approved", value: "APPROVED" },
                        { label: "Rejected", value: "REJECTED" },
                        { label: "All", value: "" },
                    ].map((f) => {
                        const active = statusFilter === f.value;
                        return (
                            <button key={f.label} onClick={() => applyFilter(f.value)}
                                style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, border: active ? "1px solid var(--adm-primary)" : "1px solid var(--adm-border)", background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)", color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)", borderRadius: "var(--adm-radius-md)", cursor: "pointer", fontFamily: "inherit" }}>
                                {f.label}
                            </button>
                        );
                    })}
                </div>

                {/* Table */}
                <Table
                    columns={columns}
                    rows={requests}
                    loading={loading && requests.length === 0}
                    empty={{ icon: FiCreditCard, title: "No adjustment requests found" }}
                    renderRow={(r) => {
                        const isActing = actionLoading === r._id;
                        // Maker-checker UX: the requester cannot approve their
                        // own request — enforced authoritatively in
                        // vendorWalletService.js::manualAdjustment(); this is
                        // just a client-side convenience to avoid a round-trip
                        // 403.
                        const isSelfRequest = r.requestedBy?._id === admin?._id;
                        return (
                            <tr key={r._id}>
                                <td>
                                    <p
                                        style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-primary)", margin: 0, cursor: "pointer" }}
                                        onClick={() => r.vendor?._id && navigate(`/admin/vendors/${r.vendor._id}`)}
                                    >
                                        {r.vendor?.shopName || "Unknown vendor"}
                                    </p>
                                    <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>{fmtDateTime(r.createdAt)}</p>
                                </td>
                                <td>
                                    <Badge tone={r.payload?.direction === "debit" ? "danger" : "success"}>
                                        {r.payload?.direction === "debit" ? "Debit" : "Credit"}
                                    </Badge>
                                </td>
                                <td style={{ fontWeight: 700 }}>{fmt(r.amount)}</td>
                                <td style={{ fontSize: 12, color: "var(--adm-text-secondary)", maxWidth: 220 }}>{r.reason}</td>
                                <td style={{ fontSize: 12, color: "var(--adm-text-secondary)" }}>{r.requestedBy?.name || r.requestedBy?.email || "—"}</td>
                                <td><Badge tone={STATUS_TONE[r.status] || "neutral"} dot>{r.status}</Badge></td>
                                <td>
                                    {r.status === "PENDING" ? (
                                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                            <Button
                                                variant="success" size="sm" disabled={isActing || isSelfRequest}
                                                title={isSelfRequest ? "You requested this adjustment — another admin must approve it" : undefined}
                                                onClick={() => setApproveModal(r)}
                                            >
                                                Approve
                                            </Button>
                                            <Button variant="danger" size="sm" disabled={isActing} onClick={() => setRejectModal(r)}>Reject</Button>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: 11, color: "var(--adm-muted)" }}>
                                            {r.reviewedBy?.name ? `By ${r.reviewedBy.name}` : ""} {r.reviewedAt ? fmtDateTime(r.reviewedAt) : ""}
                                            {r.reviewNotes ? ` — ${r.reviewNotes}` : ""}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    }}
                />

                {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20 }}>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={goToPage} disabled={loading} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminWalletAdjustments;
