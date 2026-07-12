/**
 * AdminSettlements.jsx
 * Path: src/pages/AdminSettlements.jsx
 */

import { useEffect, useState, useCallback } from "react";
import { useSettlements } from "../hooks/useSettlements";
import {
    FiCheckCircle, FiAlertCircle, FiZap, FiCreditCard, FiDollarSign,
} from "react-icons/fi";
import {
    Button, Badge, Card, CardHeader, Table, Pagination,
    EmptyState, ErrorState, Modal, FormField, Input, Select,
} from "../components/ui";

const STATUS_TONE = {
    pending: "warning",
    processing: "info",
    paid: "success",
    on_hold: "neutral",
    cancelled: "danger",
};

const statusLabel = (status) => (status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
    const isErr = toast.type === "error";
    return (
        <div style={{
            position: "fixed", top: 20, right: 20, zIndex: 9999,
            background: isErr ? "var(--adm-danger-tint)" : "var(--adm-success-tint)",
            border: `1px solid ${isErr ? "var(--adm-danger)" : "var(--adm-success)"}`,
            color: isErr ? "var(--adm-danger)" : "var(--adm-success)",
            padding: "10px 16px", borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 600,
            boxShadow: "var(--adm-shadow-md)", display: "flex", alignItems: "center", gap: 8, maxWidth: 340,
        }}>
            {isErr ? <FiAlertCircle size={14} /> : <FiCheckCircle size={14} />}
            {toast.msg}
        </div>
    );
};

/* ── Mark Paid Modal ── */
const MarkPaidModal = ({ open, label, onConfirm, onClose, loading }) => {
    const [paymentRef, setPaymentRef] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Mark as paid"
            width={380}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="success" icon={FiCheckCircle} loading={loading} onClick={() => onConfirm({ paymentRef, paymentMethod })}>
                        Confirm paid
                    </Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>{label}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <FormField label="Payment method">
                    <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} disabled={loading}>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="upi">UPI</option>
                        <option value="cheque">Cheque</option>
                    </Select>
                </FormField>
                <FormField label="Payment reference (optional)">
                    <Input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="UTR / cheque no." disabled={loading} />
                </FormField>
            </div>
        </Modal>
    );
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const AdminSettlements = () => {
    const {
        settlements, loading, actionLoading, error,
        total, totalPages, currentPage,
        fetchSettlements, processSettlements,
        markSettlementPaid, markBatchPaid,
    } = useSettlements();
    const { toast, show: showToast } = useToast();

    const [filterStatus, setFilterStatus] = useState("");
    const [modal, setModal] = useState(null); // { type: "single"|"batch", id, label }
    const [processResult, setProcessResult] = useState(null);

    useEffect(() => { fetchSettlements(); }, []);

    const handleFilter = useCallback((status) => {
        setFilterStatus(status);
        fetchSettlements({ page: 1, status });
    }, [fetchSettlements]);

    const goToPage = useCallback((page) => {
        window.scrollTo(0, 0);
        fetchSettlements({ page, status: filterStatus });
    }, [fetchSettlements, filterStatus]);

    const handleProcess = useCallback(async () => {
        if (!window.confirm("Process all pending settlements into a new batch?")) return;
        const res = await processSettlements();
        if (res.success) {
            setProcessResult(res.data);
            showToast("success", `Batch ${res.data.batchId} created — ${res.data.totalSettlements} settlements`);
            fetchSettlements({ page: 1 });
        } else {
            showToast("error", res.message);
        }
    }, [processSettlements, fetchSettlements, showToast]);

    const handleMarkPaid = useCallback(async (payload) => {
        let res;
        if (modal.type === "batch") res = await markBatchPaid(modal.id, payload);
        else res = await markSettlementPaid(modal.id, payload);
        if (res.success) { showToast("success", "Marked as paid!"); setModal(null); }
        else showToast("error", res.message);
    }, [modal, markSettlementPaid, markBatchPaid, showToast]);

    // Group by batchId for batch actions
    const batches = settlements.reduce((acc, s) => {
        if (s.batchId) {
            if (!acc[s.batchId]) acc[s.batchId] = [];
            acc[s.batchId].push(s);
        }
        return acc;
    }, {});

    const filters = [
        { key: "", label: "All" },
        { key: "pending", label: "Pending" },
        { key: "processing", label: "Processing" },
        { key: "paid", label: "Paid" },
        { key: "on_hold", label: "On Hold" },
    ];

    const columns = [
        { key: "vendor", label: "Vendor" },
        { key: "order", label: "Order" },
        { key: "amount", label: "Amount" },
        { key: "commission", label: "Commission" },
        { key: "status", label: "Status" },
        { key: "actions", label: "Actions" },
    ];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)", width: "100%", minWidth: 0 }}>
            <Toast toast={toast} />
            <MarkPaidModal
                open={!!modal}
                label={modal?.label}
                onConfirm={handleMarkPaid}
                onClose={() => setModal(null)}
                loading={modal ? actionLoading === modal.id : false}
            />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Settlements</h1>
                    <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 3 }}>{total} total settlements</p>
                </div>
                <Button variant="primary" icon={FiZap} loading={actionLoading === "process"} onClick={handleProcess}>
                    Process pending
                </Button>
            </div>

            {/* Process Result Banner */}
            {processResult && (
                <div style={{ background: "var(--adm-primary-tint)", border: "1px solid var(--adm-primary)", borderRadius: "var(--adm-radius-md)", padding: "12px 16px", marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-primary)", margin: 0 }}>Batch: {processResult.batchId}</p>
                    <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", margin: 0 }}>{processResult.totalSettlements} settlements · {processResult.totalVendors} vendors</p>
                    <button onClick={() => setProcessResult(null)} aria-label="Dismiss" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--adm-muted)", cursor: "pointer", fontSize: 13 }}>✕</button>
                </div>
            )}

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 20, scrollbarWidth: "none" }}>
                {filters.map(({ key, label }) => {
                    const active = filterStatus === key;
                    return (
                        <button key={key} onClick={() => handleFilter(key)}
                            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, border: active ? "1px solid var(--adm-primary)" : "1px solid var(--adm-border)", background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)", color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)", cursor: "pointer", fontFamily: "inherit", borderRadius: "var(--adm-radius-md)", transition: "all .15s" }}>
                            {key && <span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--adm-${STATUS_TONE[key] === "neutral" ? "neutral" : STATUS_TONE[key]})` }} />}{label}
                        </button>
                    );
                })}
            </div>

            {error && <div style={{ marginBottom: 16 }}><ErrorState message={error} onRetry={() => fetchSettlements({ page: currentPage, status: filterStatus })} /></div>}

            {/* Settlements Table */}
            <Table
                columns={columns}
                rows={settlements}
                loading={loading && settlements.length === 0}
                empty={{ icon: FiDollarSign, title: "No settlements found" }}
                renderRow={(s, idx) => {
                    const isActing = actionLoading === s._id;
                    return (
                        <tr key={s._id}>
                            <td>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", margin: 0 }}>{s.vendorId?.shopName || "—"}</p>
                                <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>{s.vendorId?.ownerName || ""}</p>
                            </td>
                            <td>
                                <p style={{ fontSize: 12, fontFamily: "'Courier New',monospace", color: "var(--adm-text-primary)", margin: 0 }}>#{s.orderId?._id?.slice(-6).toUpperCase() || "—"}</p>
                                <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>₹{Number(s.orderAmount || 0).toLocaleString("en-IN")}</p>
                            </td>
                            <td>
                                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-success)", margin: 0 }}>₹{Number(s.vendorEarning || 0).toLocaleString("en-IN")}</p>
                            </td>
                            <td>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-danger)", margin: 0 }}>₹{Number(s.commissionAmount || 0).toLocaleString("en-IN")}</p>
                                <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>{s.commissionRate}%</p>
                            </td>
                            <td>
                                <Badge tone={STATUS_TONE[s.status] || "neutral"} dot>{statusLabel(s.status)}</Badge>
                            </td>
                            <td>
                                {(s.status === "pending" || s.status === "processing") && (
                                    <Button
                                        variant="success" size="sm" icon={FiCreditCard} loading={isActing}
                                        onClick={() => setModal({ type: "single", id: s._id, label: `Settlement for ${s.vendorId?.shopName}` })}
                                    >
                                        Mark paid
                                    </Button>
                                )}
                                {s.status === "paid" && (
                                    <span style={{ fontSize: 11, color: "var(--adm-success)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                        <FiCheckCircle size={11} /> Paid
                                        {s.paymentRef && <span style={{ fontSize: 10, color: "var(--adm-muted)" }}>· {s.paymentRef}</span>}
                                    </span>
                                )}
                            </td>
                        </tr>
                    );
                }}
            />

            {/* Batch Actions */}
            {Object.keys(batches).length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", marginBottom: 12 }}>Batch actions</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(batches).map(([batchId, items]) => {
                            const allProcessing = items.every(s => s.status === "processing");
                            const batchTotal = items.reduce((sum, s) => sum + s.vendorEarning, 0);
                            const isActing = actionLoading === batchId;
                            return (
                                <Card key={batchId} padded={false} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                    <div>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-primary)", fontFamily: "'Courier New',monospace", margin: 0 }}>{batchId}</p>
                                        <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>{items.length} settlements · ₹{batchTotal.toLocaleString("en-IN")} total</p>
                                    </div>
                                    {allProcessing && (
                                        <Button
                                            variant="success" size="sm" icon={FiCreditCard} loading={isActing}
                                            onClick={() => setModal({ type: "batch", id: batchId, label: `Batch ${batchId}` })}
                                        >
                                            Mark batch paid
                                        </Button>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--adm-border)", flexWrap: "wrap", gap: 12 }}>
                    <p style={{ fontSize: 13, color: "var(--adm-muted)", margin: 0 }}>Showing <b style={{ color: "var(--adm-text-primary)" }}>{(currentPage - 1) * PAGE_LIMIT + 1}–{Math.min(currentPage * PAGE_LIMIT, total)}</b> of <b style={{ color: "var(--adm-text-primary)" }}>{total}</b></p>
                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} disabled={loading} />
                </div>
            )}
        </div>
    );
};

export default AdminSettlements;
