/**
 * AdminVendorDetail.jsx
 * Path: src/pages/AdminVendorDetail.jsx
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as vendorApi from "../api/vendorApi";
import { useAdminAuth } from "../auth/AdminAuthContext";
import {
    FiArrowLeft, FiShoppingBag, FiCheckCircle,
    FiXCircle, FiPauseCircle, FiAlertCircle,
    FiExternalLink, FiRefreshCw, FiCreditCard, FiEye,
    FiDownload, FiPlus, FiClock, FiTrendingUp, FiTrendingDown,
} from "react-icons/fi";
import {
    Button, StatusBadge, Card, CardHeader, ErrorState,
    Skeleton, Modal, FormField, Input, Select,
    Table, Pagination, StatTile,
} from "../components/ui";

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const WALLET_TX_TYPE_LABELS = {
    opening_balance: "Opening Balance",
    settlement_credit: "Settlement Credit",
    withdrawal_debit: "Withdrawal",
    manual_credit: "Manual Credit",
    manual_debit: "Manual Debit",
    refund_adjustment: "Refund Adjustment",
    chargeback: "Chargeback",
};
const isCreditType = (type) => ["opening_balance", "settlement_credit", "manual_credit"].includes(type);

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

const InfoRow = ({ label, value }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--adm-text-secondary)" }}>{value || "—"}</p>
    </div>
);

/* ── Reject Modal ── */
const RejectModal = ({ open, onConfirm, onClose, loading }) => {
    const [reason, setReason] = useState("");
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Reject Vendor"
            width={400}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="danger" icon={FiXCircle} loading={loading} disabled={!reason.trim()} onClick={() => reason.trim() && onConfirm(reason)}>
                        Reject
                    </Button>
                </>
            )}
        >
            <FormField label="Reason *">
                <textarea
                    value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for rejection..." rows={3}
                    className="adm-field-input"
                    style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
                    disabled={loading}
                />
            </FormField>
        </Modal>
    );
};

/* ── Transaction Detail Modal (reused Modal-as-drawer, per "no duplicate
     UI libraries" rule — the admin design system has no Drawer primitive) ── */
const TransactionDetailModal = ({ txn, onClose }) => (
    <Modal open={!!txn} onClose={onClose} title="Transaction Detail" width={560}>
        {txn && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <InfoRow label="Date" value={fmtDateTime(txn.createdAt)} />
                    <InfoRow label="Type" value={WALLET_TX_TYPE_LABELS[txn.type] || txn.type} />
                    <InfoRow label="Amount" value={`${isCreditType(txn.type) ? "+" : "-"}${fmtMoney(txn.amount)}`} />
                    <InfoRow label="Balance After" value={fmtMoney(txn.balanceAfter)} />
                    <InfoRow label="Reference" value={txn.referenceType ? `${txn.referenceType}: ${txn.referenceId}` : "—"} />
                    <InfoRow label="Created By" value={txn.createdBy ? txn.createdBy : "System"} />
                </div>
                <InfoRow label="Description" value={txn.description} />
                <div style={{ paddingTop: 10, borderTop: "1px solid var(--adm-border)" }}>
                    <InfoRow label="Transaction ID" value={txn._id} />
                </div>
            </div>
        )}
    </Modal>
);

/* ── Manual Adjustment Modal — two-step: form then confirmation.
     Backend's createWalletAdjustmentRequest only accepts a single "reason"
     string (see walletAdjustmentController.js) — Reason + Description are
     concatenated client-side rather than modifying the backend contract. ── */
const CreateAdjustmentModal = ({ open, onClose, onSubmit, loading, vendorName }) => {
    const [step, setStep] = useState(1);
    const [direction, setDirection] = useState("credit");
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [description, setDescription] = useState("");

    useEffect(() => {
        if (open) { setStep(1); setDirection("credit"); setAmount(""); setReason(""); setDescription(""); }
    }, [open]);

    const amountNum = Number(amount);
    const valid = amountNum > 0 && reason.trim().length > 0;

    const combinedReason = description.trim() ? `${reason.trim()} — ${description.trim()}` : reason.trim();

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Create Manual Adjustment"
            width={460}
            footer={step === 1 ? (
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" disabled={!valid} onClick={() => setStep(2)}>Review</Button>
                </>
            ) : (
                <>
                    <Button variant="secondary" onClick={() => setStep(1)} disabled={loading}>Back</Button>
                    <Button
                        variant={direction === "credit" ? "success" : "danger"}
                        loading={loading}
                        onClick={() => onSubmit({ direction, amount: amountNum, reason: combinedReason })}
                    >
                        Confirm {direction === "credit" ? "Credit" : "Debit"}
                    </Button>
                </>
            )}
        >
            {step === 1 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <FormField label="Direction *">
                        <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
                            <option value="credit">Credit (add funds)</option>
                            <option value="debit">Debit (deduct funds)</option>
                        </Select>
                    </FormField>
                    <FormField label="Amount (₹) *">
                        <Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                    </FormField>
                    <FormField label="Reason *">
                        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Refund correction" maxLength={200} />
                    </FormField>
                    <FormField label="Description">
                        <textarea
                            value={description} onChange={(e) => setDescription(e.target.value)}
                            placeholder="Additional detail (optional)" rows={3}
                            className="adm-field-input"
                            style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
                        />
                    </FormField>
                    <p style={{ fontSize: 11, color: "var(--adm-muted)" }}>
                        This will be submitted for approval. It will not take effect until another admin approves it.
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ fontSize: 13, color: "var(--adm-text-secondary)" }}>
                        You are about to request a <strong style={{ color: "var(--adm-text-primary)" }}>{direction}</strong> of{" "}
                        <strong style={{ color: "var(--adm-text-primary)" }}>{fmtMoney(amountNum)}</strong> to <strong>{vendorName}</strong>'s wallet.
                    </p>
                    <InfoRow label="Reason" value={combinedReason} />
                    <p style={{ fontSize: 11, color: "var(--adm-warning)", background: "var(--adm-warning-tint)", padding: 10, borderRadius: "var(--adm-radius-sm)" }}>
                        This request requires approval from a different admin (maker-checker) before it takes effect.
                    </p>
                </div>
            )}
        </Modal>
    );
};

/* ── Wallet Tab — Wallet Summary, Ledger Table (+ filters/pagination/export),
     Pending Adjustments mini-list. Reuses Table/Pagination/StatTile — no
     new table/pagination/stat primitives introduced. ── */
const WalletTab = ({
    vendor, walletData, walletLoading, walletError,
    walletPageNum, setWalletPageNum,
    walletTypeFilter, setWalletTypeFilter,
    walletDateFrom, setWalletDateFrom,
    walletDateTo, setWalletDateTo,
    walletSearch, setWalletSearch,
    walletRefFilter, setWalletRefFilter,
    pendingAdjustments, onSelectTxn, onOpenAdjustModal, onExportCsv, onRetry,
}) => {
    const transactions = walletData?.transactions || [];
    const summary = walletData?.summary || { totalCredited: 0, totalDebited: 0, transactionCount: 0 };
    const lastTxn = transactions[0];

    // Search / Reference filters have no backend query-param support (see
    // vendorWalletService.js::getHistory) — applied client-side over the
    // already-loaded page rather than modifying the backend contract.
    const visibleRows = transactions.filter((t) => {
        if (walletRefFilter && t.referenceType !== walletRefFilter) return false;
        if (walletSearch.trim()) {
            const q = walletSearch.trim().toLowerCase();
            const haystack = `${t.description || ""} ${t.referenceId || ""} ${WALLET_TX_TYPE_LABELS[t.type] || t.type}`.toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });

    if (walletError) {
        return <ErrorState message={walletError} onRetry={onRetry} />;
    }

    return (
        <div>
            {/* Wallet Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                <StatTile icon={FiCreditCard} tone="primary" label="Current Balance" value={walletLoading && !walletData ? "…" : fmtMoney(walletData?.walletBalance)} />
                <StatTile icon={FiTrendingUp} tone="success" label="Lifetime Credits" value={walletLoading && !walletData ? "…" : fmtMoney(summary.totalCredited)} />
                <StatTile icon={FiTrendingDown} tone="danger" label="Lifetime Debits" value={walletLoading && !walletData ? "…" : fmtMoney(summary.totalDebited)} />
                <StatTile icon={FiClock} tone="warning" label="Last Transaction" value={lastTxn ? fmtDateTime(lastTxn.createdAt) : "—"} sublabel={lastTxn ? (WALLET_TX_TYPE_LABELS[lastTxn.type] || lastTxn.type) : undefined} />
                <StatTile icon={FiAlertCircle} tone={pendingAdjustments.length ? "warning" : "primary"} label="Pending Adjustments" value={pendingAdjustments.length} />
            </div>

            {/* Pending Adjustments mini-list */}
            {pendingAdjustments.length > 0 && (
                <Card padded={false} style={{ marginBottom: 20 }}>
                    <CardHeader title="Pending Adjustments" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 20px 16px" }}>
                        {pendingAdjustments.map((r) => (
                            <div key={r._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid var(--adm-border)" }}>
                                <span>
                                    <strong style={{ color: r.payload?.direction === "debit" ? "var(--adm-danger)" : "var(--adm-success)" }}>
                                        {r.payload?.direction === "debit" ? "Debit" : "Credit"} {fmtMoney(r.amount)}
                                    </strong>
                                    {" — "}{r.reason}
                                </span>
                                <span style={{ color: "var(--adm-muted)" }}>Requested by {r.requestedBy?.name || "Admin"} · {fmtDateTime(r.createdAt)}</span>
                            </div>
                        ))}
                        <p style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 4 }}>
                            Review and approve/reject these in the Wallet Adjustments queue.
                        </p>
                    </div>
                </Card>
            )}

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
                <FormField label="Type">
                    <Select value={walletTypeFilter} onChange={(e) => { setWalletTypeFilter(e.target.value); setWalletPageNum(1); }} style={{ minWidth: 160 }}>
                        <option value="">All Types</option>
                        {Object.entries(WALLET_TX_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </Select>
                </FormField>
                <FormField label="Reference">
                    <Select value={walletRefFilter} onChange={(e) => setWalletRefFilter(e.target.value)} style={{ minWidth: 140 }}>
                        <option value="">All References</option>
                        <option value="Settlement">Settlement</option>
                        <option value="Payout">Payout</option>
                        <option value="ApprovalRequest">Approval Request</option>
                    </Select>
                </FormField>
                <FormField label="From">
                    <Input type="date" value={walletDateFrom} onChange={(e) => { setWalletDateFrom(e.target.value); setWalletPageNum(1); }} />
                </FormField>
                <FormField label="To">
                    <Input type="date" value={walletDateTo} onChange={(e) => { setWalletDateTo(e.target.value); setWalletPageNum(1); }} />
                </FormField>
                <FormField label="Search">
                    <Input type="text" placeholder="Description, type, reference…" value={walletSearch} onChange={(e) => setWalletSearch(e.target.value)} style={{ minWidth: 200 }} />
                </FormField>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                    <Button variant="secondary" icon={FiDownload} onClick={onExportCsv}>Export CSV</Button>
                    <Button variant="primary" icon={FiPlus} onClick={onOpenAdjustModal}>Create Adjustment</Button>
                </div>
            </div>

            {/* Ledger Table */}
            <Table
                loading={walletLoading}
                columns={[
                    { key: "date", label: "Date" },
                    { key: "type", label: "Type" },
                    { key: "amount", label: "Amount" },
                    { key: "balanceAfter", label: "Balance After" },
                    { key: "reference", label: "Reference" },
                    { key: "description", label: "Description" },
                    { key: "createdBy", label: "Created By" },
                    { key: "actions", label: "" },
                ]}
                rows={visibleRows}
                empty={{ icon: FiCreditCard, title: "No transactions", description: "No wallet transactions match the current filters." }}
                renderRow={(t) => (
                    <tr key={t._id}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(t.createdAt)}</td>
                        <td>{WALLET_TX_TYPE_LABELS[t.type] || t.type}</td>
                        <td style={{ fontWeight: 700, color: isCreditType(t.type) ? "var(--adm-success)" : "var(--adm-danger)" }}>
                            {isCreditType(t.type) ? "+" : "-"}{fmtMoney(t.amount)}
                        </td>
                        <td>{fmtMoney(t.balanceAfter)}</td>
                        <td style={{ fontSize: 12 }}>{t.referenceType ? `${t.referenceType}` : "—"}</td>
                        <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.description}>{t.description || "—"}</td>
                        <td>{t.createdBy ? "Admin" : "System"}</td>
                        <td>
                            <Button variant="secondary" size="sm" icon={FiEye} onClick={() => onSelectTxn(t)}>View</Button>
                        </td>
                    </tr>
                )}
            />
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                <Pagination currentPage={walletPageNum} totalPages={walletData?.totalPages || 1} onPageChange={setWalletPageNum} disabled={walletLoading} />
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const AdminVendorDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast, show: showToast } = useToast();

    const { admin } = useAdminAuth();
    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [approveCommission, setApproveCommission] = useState(18);
    const [error, setError] = useState("");
    const [rejectOpen, setRejectOpen] = useState(false);
    const [docNoteInputs, setDocNoteInputs] = useState({});
    const [docUpdating, setDocUpdating] = useState({});

    // ── Wallet tab ──
    const [page, setPage] = useState("overview");
    const [walletLoaded, setWalletLoaded] = useState(false);
    const [walletData, setWalletData] = useState(null);
    const [walletLoading, setWalletLoading] = useState(false);
    const [walletError, setWalletError] = useState("");
    const [walletPageNum, setWalletPageNum] = useState(1);
    const [walletTypeFilter, setWalletTypeFilter] = useState("");
    const [walletDateFrom, setWalletDateFrom] = useState("");
    const [walletDateTo, setWalletDateTo] = useState("");
    const [walletSearch, setWalletSearch] = useState("");
    const [walletRefFilter, setWalletRefFilter] = useState("");
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [adjustModalOpen, setAdjustModalOpen] = useState(false);
    const [adjustLoading, setAdjustLoading] = useState(false);

    const [pendingAdjustments, setPendingAdjustments] = useState([]);

    const loadWallet = useCallback(async (pageNum = walletPageNum) => {
        setWalletLoading(true);
        setWalletError("");
        try {
            const params = { page: pageNum, limit: 20 };
            if (walletTypeFilter) params.type = walletTypeFilter;
            if (walletDateFrom) params.dateFrom = walletDateFrom;
            if (walletDateTo) params.dateTo = walletDateTo;
            const [{ data }, { data: adjData }] = await Promise.all([
                vendorApi.fetchVendorWallet(id, params),
                // listWalletAdjustments has no vendorId filter param (see
                // walletAdjustmentController.js) — filtered client-side
                // below since the backend contract can't be modified.
                vendorApi.fetchWalletAdjustments({ status: "PENDING", limit: 50 }),
            ]);
            setWalletData(data);
            setPendingAdjustments((adjData.requests || []).filter((r) => String(r.targetId) === String(id)));
            setWalletLoaded(true);
        } catch (err) {
            setWalletError(err.response?.data?.message || "Failed to load wallet");
        } finally {
            setWalletLoading(false);
        }
    }, [id, walletPageNum, walletTypeFilter, walletDateFrom, walletDateTo]);

    useEffect(() => {
        if (page === "wallet" && !walletLoaded) loadWallet(1);
    }, [page, walletLoaded, loadWallet]);

    useEffect(() => {
        if (page === "wallet" && walletLoaded) loadWallet(walletPageNum);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletPageNum, walletTypeFilter, walletDateFrom, walletDateTo]);

    // Admin panel has no dedicated wallet-export endpoint (only the vendor's
    // own exportMyWalletTransactions exists) — building the CSV client-side
    // from an already-permitted read keeps this within "reuse backend
    // exactly as implemented" without adding a new route.
    const handleExportCsv = useCallback(async () => {
        try {
            const params = { page: 1, limit: 500 };
            if (walletTypeFilter) params.type = walletTypeFilter;
            if (walletDateFrom) params.dateFrom = walletDateFrom;
            if (walletDateTo) params.dateTo = walletDateTo;
            const { data } = await vendorApi.fetchVendorWallet(id, params);
            const rows = data.transactions || [];
            const header = ["Date", "Type", "Amount", "Balance After", "Reference Type", "Reference ID", "Description", "Created By"];
            const csvRows = rows.map((t) => [
                new Date(t.createdAt).toISOString(),
                WALLET_TX_TYPE_LABELS[t.type] || t.type,
                `${isCreditType(t.type) ? "+" : "-"}${t.amount}`,
                t.balanceAfter,
                t.referenceType || "",
                t.referenceId || "",
                (t.description || "").replace(/"/g, '""'),
                t.createdBy ? "Admin" : "System",
            ]);
            const csv = [header, ...csvRows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `wallet-ledger-${vendor?.shopName || id}-${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            showToast("error", err.response?.data?.message || "Failed to export ledger");
        }
    }, [id, walletTypeFilter, walletDateFrom, walletDateTo, vendor, showToast]);

    const handleCreateAdjustment = useCallback(async ({ direction, amount, reason }) => {
        setAdjustLoading(true);
        try {
            await vendorApi.createWalletAdjustment({ vendorId: id, direction, amount, reason });
            showToast("success", "Adjustment request submitted for approval");
            setAdjustModalOpen(false);
            loadWallet(walletPageNum);
        } catch (err) {
            showToast("error", err.response?.data?.message || "Failed to submit adjustment");
        } finally {
            setAdjustLoading(false);
        }
    }, [id, showToast, loadWallet, walletPageNum]);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const { data } = await vendorApi.fetchVendorById(id);
                setVendor(data.vendor);
            } catch (err) {
                setError(err.response?.data?.message || "Failed to load vendor");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const handleAction = useCallback(async (type, payload = {}, successMessage) => {
        setActionLoading(type);
        try {
            let res;
            if (type === "approve") res = await vendorApi.approveVendor(id, payload);
            if (type === "reject") res = await vendorApi.rejectVendor(id, payload);
            if (type === "suspend") res = await vendorApi.suspendVendor(id, payload);
            setVendor(res.data.vendor);
            showToast("success", successMessage || `Vendor ${type}d successfully`);
            if (type === "reject") setRejectOpen(false);
        } catch (err) {
            showToast("error", err.response?.data?.message || `Failed to ${type}`);
        } finally {
            setActionLoading(null);
        }
    }, [id, showToast]);

    // KYC VERIFICATION FIX: direct adaptation of AdminDeliveryBoys.jsx's
    // DocModal handleDocAction for the vendor document set — same request
    // shape, same admin-facing per-document review pattern.
    const handleDocAction = useCallback(async (docKey, status) => {
        setDocUpdating((p) => ({ ...p, [docKey]: true }));
        try {
            const { data } = await vendorApi.updateVendorDocStatus(id, {
                docKey, status, note: docNoteInputs[docKey] || "",
            });
            if (data?.vendor) setVendor(data.vendor);
            showToast("success", `${docKey.replace(/([A-Z])/g, " $1")} marked ${status}`);
        } catch (err) {
            showToast("error", err.response?.data?.message || "Failed to update document status");
        } finally {
            setDocUpdating((p) => ({ ...p, [docKey]: false }));
        }
    }, [id, docNoteInputs, showToast]);

    if (loading) return (
        <div style={{ fontFamily: "var(--adm-font-sans)" }}>
            <Card padded>
                <Skeleton height={48} style={{ marginBottom: 16 }} />
                <Skeleton height={16} width="60%" style={{ marginBottom: 10 }} />
                <Skeleton height={16} width="40%" />
            </Card>
        </div>
    );

    if (error || !vendor) return (
        <div style={{ padding: "40px 20px" }}>
            <ErrorState message={error || "Vendor not found"} onRetry={() => navigate("/admin/vendors")} />
        </div>
    );

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)" }}>
            <style>{`
                @media(max-width:768px){.avd-grid{grid-template-columns:1fr!important;}.avd-inner{grid-template-columns:1fr!important;}}
                @media(max-width:480px){.avd-grid{gap:12px!important;}}
            `}</style>
            <Toast toast={toast} />
            <RejectModal
                open={rejectOpen}
                onConfirm={(reason) => handleAction("reject", { reason })}
                onClose={() => setRejectOpen(false)}
                loading={actionLoading === "reject"}
            />

            {/* Back + Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                <Button variant="secondary" size="sm" icon={FiArrowLeft} onClick={() => navigate("/admin/vendors")}>Back</Button>
                {vendor.shopLogo ? (
                    <img src={vendor.shopLogo} alt={vendor.shopName} style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", border: "1px solid var(--adm-border)" }} />
                ) : (
                    <div style={{ width: 48, height: 48, background: "var(--adm-surface-alt)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FiShoppingBag size={20} color="var(--adm-muted)" />
                    </div>
                )}
                <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>{vendor.shopName}</h1>
                        <StatusBadge status={vendor.status} />
                    </div>
                    <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 2 }}>{vendor.ownerName} · {vendor.email}</p>
                </div>
            </div>

            {/* Overview / Wallet tabs — mirrors AdminCoupons.jsx's tab-strip style */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--adm-border)", overflowX: "auto" }}>
                {[{ key: "overview", label: "Overview" }, { key: "wallet", label: "Wallet" }].map((t) => (
                    <button
                        key={t.key} type="button" onClick={() => setPage(t.key)}
                        style={{
                            padding: "8px 14px", background: "none", border: "none",
                            borderBottom: `2px solid ${page === t.key ? "var(--adm-primary)" : "transparent"}`,
                            color: page === t.key ? "var(--adm-primary)" : "var(--adm-text-secondary)",
                            fontWeight: page === t.key ? 700 : 500, fontSize: 12.5, cursor: "pointer",
                            whiteSpace: "nowrap", fontFamily: "inherit",
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {page === "overview" && (
            <>
            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
                {(vendor.status === "pending" || vendor.status === "under_review") && (
                    <>
                        <FormField label="Commission %">
                            <Input type="number" min={0} max={50} value={approveCommission} onChange={e => setApproveCommission(Number(e.target.value))} style={{ width: 80 }} />
                        </FormField>
                        <Button variant="success" icon={FiCheckCircle} loading={actionLoading === "approve"} onClick={() => handleAction("approve", { commissionRate: approveCommission, plan: "starter" })}>
                            Approve Vendor
                        </Button>
                        <Button variant="danger" icon={FiXCircle} disabled={actionLoading === "reject"} onClick={() => setRejectOpen(true)}>
                            Reject
                        </Button>
                    </>
                )}
                {vendor.status === "approved" && (
                    <Button variant="secondary" icon={FiPauseCircle} loading={actionLoading === "suspend"} onClick={() => handleAction("suspend", { reason: "Suspended by admin" })}>
                        Suspend
                    </Button>
                )}
                {vendor.status === "suspended" && (
                    // Reuses the same approve endpoint the pending→approved
                    // flow calls — its atomic guard and notification wording
                    // already handle suspended→approved correctly (see
                    // vendorApproval.js::approveVendor); only this button
                    // was missing.
                    <Button variant="success" icon={FiRefreshCw} loading={actionLoading === "approve"} onClick={() => handleAction("approve", {}, "Vendor reactivated successfully")}>
                        Reactivate
                    </Button>
                )}
            </div>

            <div className="avd-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Shop Info */}
                <Card padded={false}>
                    <CardHeader title="Shop Info" />
                    <div style={{ padding: "16px 20px 20px" }}>
                        <div className="avd-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <InfoRow label="Shop Name" value={vendor.shopName} />
                            <InfoRow label="Category" value={vendor.shopCategory} />
                            <InfoRow label="Business Type" value={vendor.businessType} />
                            <InfoRow label="Delivery Mode" value={vendor.deliveryMode} />
                            <InfoRow label="GST Number" value={vendor.gstNumber} />
                            <InfoRow label="PAN Number" value={vendor.panNumber} />
                        </div>
                        {vendor.shopDescription && (
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--adm-border)" }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Description</p>
                                <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", lineHeight: 1.6 }}>{vendor.shopDescription}</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Owner Info */}
                <Card padded={false}>
                    <CardHeader title="Owner Info" />
                    <div className="avd-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "16px 20px 20px" }}>
                        <InfoRow label="Owner" value={vendor.ownerName} />
                        <InfoRow label="Phone" value={vendor.phone} />
                        <InfoRow label="WhatsApp" value={vendor.whatsapp} />
                        <InfoRow label="Email" value={vendor.email} />
                        <InfoRow label="Address" value={[vendor.address?.line1, vendor.address?.city, vendor.address?.pincode].filter(Boolean).join(", ")} />
                    </div>
                </Card>

                {/* Commission + Subscription */}
                <Card padded={false}>
                    <CardHeader title="Commission & Subscription" />
                    <div className="avd-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: "16px 20px 20px" }}>
                        <InfoRow label="Commission" value={`${vendor.commissionRate}%`} />
                        <InfoRow label="Override" value={vendor.commissionOverride ? "Yes" : "No"} />
                        <InfoRow label="Plan" value={vendor.subscription?.plan} />
                        <InfoRow label="Sub Active" value={vendor.subscription?.isActive ? "Yes" : "No"} />
                        <InfoRow label="Expires" value={vendor.subscription?.expiryDate ? new Date(vendor.subscription.expiryDate).toLocaleDateString("en-IN") : "—"} />
                    </div>
                </Card>

                {/* Stats */}
                <Card padded={false}>
                    <CardHeader title="Stats" />
                    <div className="avd-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "16px 20px 20px" }}>
                        <InfoRow label="Total Orders" value={vendor.totalOrders} />
                        <InfoRow label="Total Revenue" value={`₹${Number(vendor.totalRevenue || 0).toLocaleString("en-IN")}`} />
                        <InfoRow label="Total Earnings" value={`₹${Number(vendor.totalEarnings || 0).toLocaleString("en-IN")}`} />
                        <InfoRow label="Pending Settlement" value={`₹${Number(vendor.pendingSettlement || 0).toLocaleString("en-IN")}`} />
                        <InfoRow label="Rating" value={`${vendor.rating} / 5 (${vendor.ratingCount} reviews)`} />
                    </div>
                </Card>
            </div>

            {/* Service Pincodes */}
            {vendor.servicePincodes?.length > 0 && (
                <Card padded={false} style={{ marginTop: 16 }}>
                    <CardHeader title="Service Pincodes" />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "16px 20px 20px" }}>
                        {vendor.servicePincodes.map(p => (
                            <span key={p} style={{ fontSize: 12, fontWeight: 600, background: "var(--adm-primary-tint)", color: "var(--adm-primary)", border: "1px solid var(--adm-border)", padding: "4px 12px", borderRadius: "var(--adm-radius-sm)", fontFamily: "'Courier New',monospace" }}>{p}</span>
                        ))}
                    </div>
                </Card>
            )}

            {/* KYC Documents — per-document verify/reject, mirrors
                AdminDeliveryBoys.jsx's DocModal review block */}
            {vendor.documents && Object.values(vendor.documents).some(Boolean) && (
                <Card padded={false} style={{ marginTop: 16 }}>
                    <CardHeader title="KYC Documents" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 20px 20px" }}>
                        {Object.entries(vendor.documents).map(([key, url]) => {
                            if (!url) return null;
                            const status = vendor.documentStatus?.[key] || "pending";
                            const note = vendor.documentNotes?.[key] || "";
                            const busy = docUpdating[key];
                            const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

                            return (
                                <div key={key} style={{ border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
                                    <a href={url} target="_blank" rel="noreferrer" style={{ width: 72, height: 72, borderRadius: "var(--adm-radius-sm)", overflow: "hidden", border: "1px solid var(--adm-border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--adm-surface-alt)" }}>
                                        {/\.(jpe?g|png|webp)(\?|$)/i.test(url) ? (
                                            <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                                        ) : (
                                            <FiExternalLink size={18} color="var(--adm-muted)" />
                                        )}
                                    </a>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{label}</span>
                                            <StatusBadge status={status} />
                                        </div>
                                        {note && <div style={{ fontSize: 11, color: "var(--adm-text-secondary)", marginBottom: 6 }}>Note: {note}</div>}
                                        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--adm-primary)", fontWeight: 600, textDecoration: "none" }}>
                                            Open full size ↗
                                        </a>
                                        <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                            {status !== "verified" && (
                                                <Button variant="success" size="sm" loading={busy} onClick={() => handleDocAction(key, "verified")}>Verify</Button>
                                            )}
                                            {status !== "rejected" && (
                                                <Button variant="danger" size="sm" loading={busy} onClick={() => handleDocAction(key, "rejected")}>Reject</Button>
                                            )}
                                            {status !== "pending" && (
                                                <Button variant="secondary" size="sm" loading={busy} onClick={() => handleDocAction(key, "pending")}>Reset</Button>
                                            )}
                                        </div>
                                        {status !== "verified" && (
                                            <input
                                                type="text" placeholder="Reviewer note (optional)"
                                                value={docNoteInputs[key] || ""}
                                                onChange={(e) => setDocNoteInputs((p) => ({ ...p, [key]: e.target.value }))}
                                                style={{ marginTop: 6, width: "100%", padding: "5px 10px", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-sm)", fontSize: 11, outline: "none", boxSizing: "border-box" }}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Bank Details */}
            {(vendor.bankDetails?.accountNumber || vendor.bankDetails?.upiId || vendor.bankDetails?.accountHolder || vendor.bankDetails?.ifsc || vendor.bankDetails?.bankName) && (
                <Card padded={false} style={{ marginTop: 16 }}>
                    <CardHeader title="Bank Details" />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 14, padding: "16px 20px 20px" }}>
                        <InfoRow label="Account Holder" value={vendor.bankDetails?.accountHolder} />
                        <InfoRow label="Account Number" value={vendor.bankDetails?.accountNumber} />
                        <InfoRow label="IFSC" value={vendor.bankDetails?.ifsc} />
                        <InfoRow label="Bank" value={vendor.bankDetails?.bankName} />
                        <InfoRow label="UPI ID" value={vendor.bankDetails?.upiId} />
                    </div>
                </Card>
            )}
            </>
            )}

            {page === "wallet" && (
                <WalletTab
                    vendor={vendor}
                    walletData={walletData}
                    walletLoading={walletLoading}
                    walletError={walletError}
                    walletPageNum={walletPageNum}
                    setWalletPageNum={setWalletPageNum}
                    walletTypeFilter={walletTypeFilter}
                    setWalletTypeFilter={setWalletTypeFilter}
                    walletDateFrom={walletDateFrom}
                    setWalletDateFrom={setWalletDateFrom}
                    walletDateTo={walletDateTo}
                    setWalletDateTo={setWalletDateTo}
                    walletSearch={walletSearch}
                    setWalletSearch={setWalletSearch}
                    walletRefFilter={walletRefFilter}
                    setWalletRefFilter={setWalletRefFilter}
                    pendingAdjustments={pendingAdjustments}
                    onSelectTxn={setSelectedTxn}
                    onOpenAdjustModal={() => setAdjustModalOpen(true)}
                    onExportCsv={handleExportCsv}
                    onRetry={() => loadWallet(walletPageNum)}
                />
            )}

            <TransactionDetailModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />
            <CreateAdjustmentModal
                open={adjustModalOpen}
                onClose={() => setAdjustModalOpen(false)}
                onSubmit={handleCreateAdjustment}
                loading={adjustLoading}
                vendorName={vendor.shopName}
            />
        </div>
    );
};

export default AdminVendorDetail;
