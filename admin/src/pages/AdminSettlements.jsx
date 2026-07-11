/**
 * AdminSettlements.jsx
 * Path: src/pages/AdminSettlements.jsx
 */

import { useEffect, useState, useCallback } from "react";
import { useSettlements } from "../hooks/useSettlements";
import {
    FiDollarSign, FiCheckCircle, FiAlertCircle, FiLoader,
    FiZap, FiCreditCard,
} from "react-icons/fi";

const T = {
    bg: "#f8fafc", white: "#ffffff", surfaceAlt: "#f1f5f9",
    border: "#e2e8f0", borderLight: "#f1f5f9",
    blue: "#2563eb", blueBg: "#eff6ff", blueMid: "#dbeafe",
    text: "#1e293b", sub: "#334155", muted: "#475569", hint: "#94a3b8",
    green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#8b5cf6",
};

const STATUS_CONFIG = {
    pending: { label: "Pending", color: T.amber, bg: "#fef3c7" },
    processing: { label: "Processing", color: T.blue, bg: T.blueBg },
    paid: { label: "Paid", color: T.green, bg: "#f0fdf4" },
    on_hold: { label: "On Hold", color: T.violet, bg: "#f5f3ff" },
    cancelled: { label: "Cancelled", color: T.red, bg: "#fef2f2" },
};

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
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: isErr ? "#fef2f2" : "#f0fdf4", border: `1px solid ${isErr ? "#fecaca" : "#bbf7d0"}`, color: isErr ? T.red : T.green, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 8, maxWidth: 340, animation: "as-fadeUp .2s ease" }}>
            {isErr ? <FiAlertCircle size={14} /> : <FiCheckCircle size={14} />}
            {toast.msg}
        </div>
    );
};

/* ── Mark Paid Modal ── */
const MarkPaidModal = ({ label, onConfirm, onClose, loading }) => {
    const [paymentRef, setPaymentRef] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: T.white, borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Mark as paid</h3>
                <p style={{ fontSize: 13, color: T.hint, marginBottom: 20 }}>{label}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 5 }}>Payment method</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} disabled={loading}
                            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.text, background: T.white, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="upi">UPI</option>
                            <option value="cheque">Cheque</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 5 }}>Payment reference (optional)</label>
                        <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="UTR / cheque no." disabled={loading}
                            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.text, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                    <button onClick={() => onConfirm({ paymentRef, paymentMethod })} disabled={loading}
                        style={{ flex: 1, padding: "10px", background: T.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {loading ? <FiLoader size={13} style={{ animation: "as-spin 0.8s linear infinite" }} /> : <FiCheckCircle size={13} />}
                        Confirm paid
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

    const getPageNumbers = () => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, "…", totalPages];
        if (currentPage >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages];
    };

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
        { key: "pending", label: "Pending", dot: T.amber },
        { key: "processing", label: "Processing", dot: T.blue },
        { key: "paid", label: "Paid", dot: T.green },
        { key: "on_hold", label: "On Hold", dot: T.violet },
    ];

    if (loading && settlements.length === 0) return (
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ width: 36, height: 36, border: `3px solid ${T.blueMid}`, borderTopColor: T.blue, borderRadius: "50%", animation: "as-spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ color: T.hint, fontSize: 13 }}>Loading settlements...</p>
            </div>
            <style>{`@keyframes as-spin{to{transform:rotate(360deg)}} @keyframes as-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
        </div>
    );

    return (
        <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: T.text, background: T.bg, minHeight: "100vh", padding: "32px 24px", boxSizing: "border-box" }}>
            <style>{`
                @keyframes as-spin{to{transform:rotate(360deg)}}
                @keyframes as-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
                .as-card{transition:border-color .18s,box-shadow .18s;}
                .as-card:hover{border-color:#bfdbfe !important;box-shadow:0 2px 12px rgba(37,99,235,0.07) !important;}
                .as-row{animation:as-fadeUp .3s ease forwards;}
                .as-btn:hover:not(:disabled){filter:brightness(0.95);}
                button:disabled{cursor:not-allowed;}
                @media (max-width: 640px){
                    .as-page{padding:20px 14px !important;}
                }
            `}</style>

            <div className="as-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
                <Toast toast={toast} />
                {modal && <MarkPaidModal label={modal.label} onConfirm={handleMarkPaid} onClose={() => setModal(null)} loading={actionLoading === modal.id} />}

                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Settlements</h1>
                        <p style={{ fontSize: 13, color: T.hint, marginTop: 3 }}>{total} total settlements</p>
                    </div>
                    <button className="as-btn" onClick={handleProcess} disabled={actionLoading === "process"}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: actionLoading === "process" ? "not-allowed" : "pointer", opacity: actionLoading === "process" ? 0.7 : 1 }}>
                        {actionLoading === "process" ? <FiLoader size={13} style={{ animation: "as-spin 0.8s linear infinite" }} /> : <FiZap size={13} />}
                        Process pending
                    </button>
                </div>

                {/* Process Result Banner */}
                {processResult && (
                    <div style={{ background: T.blueBg, border: `1px solid ${T.blueMid}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: T.blue, margin: 0 }}>Batch: {processResult.batchId}</p>
                        <p style={{ fontSize: 13, color: T.sub, margin: 0 }}>{processResult.totalSettlements} settlements · {processResult.totalVendors} vendors</p>
                        <button onClick={() => setProcessResult(null)} aria-label="Dismiss" style={{ marginLeft: "auto", background: "none", border: "none", color: T.hint, cursor: "pointer", fontSize: 13 }}>✕</button>
                    </div>
                )}

                {/* Filter Tabs */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 20, scrollbarWidth: "none" }}>
                    {filters.map(({ key, label, dot }) => {
                        const active = filterStatus === key;
                        return (
                            <button key={key} onClick={() => handleFilter(key)}
                                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, border: active ? `1px solid ${T.blue}` : `1px solid ${T.border}`, background: active ? T.blueBg : T.white, color: active ? T.blue : T.muted, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, transition: "all .15s" }}>
                                {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />}{label}
                            </button>
                        );
                    })}
                </div>

                {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: T.red, padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

                {/* Settlements Table */}
                <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, overflowX: "auto" }}>
                    {/* Head */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 120px 130px", gap: 12, padding: "10px 20px", background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`, minWidth: 700 }}>
                        {["Vendor", "Order", "Amount", "Commission", "Status", "Actions"].map(h => (
                            <p key={h} style={{ fontSize: 10, fontWeight: 700, color: T.hint, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>{h}</p>
                        ))}
                    </div>

                    {settlements.length === 0 && !loading ? (
                        <div style={{ padding: "52px 0", textAlign: "center" }}>
                            <FiDollarSign size={28} style={{ color: T.hint, marginBottom: 10 }} />
                            <p style={{ color: T.hint, fontSize: 14, margin: 0 }}>No settlements found</p>
                        </div>
                    ) : settlements.map((s, idx) => {
                        const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                        const isActing = actionLoading === s._id;

                        return (
                            <div key={s._id} className="as-card as-row"
                                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 120px 130px", gap: 12, padding: "14px 20px", borderBottom: idx < settlements.length - 1 ? `1px solid ${T.borderLight}` : "none", alignItems: "center", animationDelay: `${idx * 20}ms`, minWidth: 700 }}>

                                {/* Vendor */}
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: T.sub, margin: 0 }}>{s.vendorId?.shopName || "—"}</p>
                                    <p style={{ fontSize: 11, color: T.hint, margin: "2px 0 0" }}>{s.vendorId?.ownerName || ""}</p>
                                </div>

                                {/* Order */}
                                <div>
                                    <p style={{ fontSize: 12, fontFamily: "'Courier New',monospace", color: T.sub, margin: 0 }}>#{s.orderId?._id?.slice(-6).toUpperCase() || "—"}</p>
                                    <p style={{ fontSize: 11, color: T.hint, margin: "2px 0 0" }}>₹{Number(s.orderAmount || 0).toLocaleString("en-IN")}</p>
                                </div>

                                {/* Vendor Earning */}
                                <p style={{ fontSize: 14, fontWeight: 700, color: T.green, margin: 0 }}>₹{Number(s.vendorEarning || 0).toLocaleString("en-IN")}</p>

                                {/* Commission */}
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: T.red, margin: 0 }}>₹{Number(s.commissionAmount || 0).toLocaleString("en-IN")}</p>
                                    <p style={{ fontSize: 11, color: T.hint, margin: "2px 0 0" }}>{s.commissionRate}%</p>
                                </div>

                                {/* Status */}
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "3px 10px", borderRadius: 99, width: "fit-content" }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />{cfg.label}
                                </span>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: 6 }}>
                                    {(s.status === "pending" || s.status === "processing") && (
                                        <button className="as-btn" disabled={isActing} onClick={() => setModal({ type: "single", id: s._id, label: `Settlement for ${s.vendorId?.shopName}` })}
                                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: T.green, color: "#fff", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", opacity: isActing ? 0.7 : 1 }}>
                                            {isActing ? <FiLoader size={10} style={{ animation: "as-spin 0.8s linear infinite" }} /> : <FiCreditCard size={10} />}
                                            Mark paid
                                        </button>
                                    )}
                                    {s.status === "paid" && (
                                        <span style={{ fontSize: 11, color: T.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                            <FiCheckCircle size={11} /> Paid
                                            {s.paymentRef && <span style={{ fontSize: 10, color: T.hint }}>· {s.paymentRef}</span>}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Batch Actions */}
                {Object.keys(batches).length > 0 && (
                    <div style={{ marginTop: 20 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Batch actions</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {Object.entries(batches).map(([batchId, items]) => {
                                const allProcessing = items.every(s => s.status === "processing");
                                const batchTotal = items.reduce((sum, s) => sum + s.vendorEarning, 0);
                                const isActing = actionLoading === batchId;
                                return (
                                    <div key={batchId} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                        <div>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "'Courier New',monospace", margin: 0 }}>{batchId}</p>
                                            <p style={{ fontSize: 11, color: T.hint, margin: "2px 0 0" }}>{items.length} settlements · ₹{batchTotal.toLocaleString("en-IN")} total</p>
                                        </div>
                                        {allProcessing && (
                                            <button className="as-btn" disabled={isActing} onClick={() => setModal({ type: "batch", id: batchId, label: `Batch ${batchId}` })}
                                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: T.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", opacity: isActing ? 0.7 : 1 }}>
                                                {isActing ? <FiLoader size={11} style={{ animation: "as-spin 0.8s linear infinite" }} /> : <FiCreditCard size={11} />}
                                                Mark batch paid
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}`, flexWrap: "wrap", gap: 12 }}>
                        <p style={{ fontSize: 13, color: T.hint, margin: 0 }}>Showing <b style={{ color: T.text }}>{(currentPage - 1) * PAGE_LIMIT + 1}–{Math.min(currentPage * PAGE_LIMIT, total)}</b> of <b style={{ color: T.text }}>{total}</b></p>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                                style={{ padding: "6px 12px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 7, color: T.muted, fontSize: 13, fontWeight: 600, cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.4 : 1 }}>← Prev</button>
                            {getPageNumbers().map((p, i) => p === "…" ? <span key={`d${i}`} style={{ padding: "0 4px", color: T.hint }}>…</span> : (
                                <button key={p} onClick={() => goToPage(p)}
                                    style={{ width: 34, height: 34, background: currentPage === p ? T.blue : T.white, border: currentPage === p ? `1px solid ${T.blue}` : `1px solid ${T.border}`, borderRadius: 7, color: currentPage === p ? "#fff" : T.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{p}</button>
                            ))}
                            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                                style={{ padding: "6px 12px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 7, color: T.muted, fontSize: 13, fontWeight: 600, cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.4 : 1 }}>Next →</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminSettlements;