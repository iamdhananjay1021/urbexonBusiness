/**
 * AdminVendors.jsx
 * Path: src/pages/AdminVendors.jsx
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useVendors } from "../hooks/useVendors";
import {
    FiCheckCircle, FiXCircle,
    FiAlertCircle, FiChevronDown, FiShoppingBag,
    FiUser, FiPhone, FiMail, FiMapPin, FiEye, FiTrash2,
    FiPauseCircle, FiPercent,
} from "react-icons/fi";
import {
    Button, StatusBadge, Card, EmptyState, ErrorState,
    Skeleton, Modal, FormField, Input, Select, SearchBar, Pagination,
} from "../components/ui";

const PAGE_LIMIT = 20;

/* ── Toast hook ── */
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
            boxShadow: "var(--adm-shadow-md)",
            display: "flex", alignItems: "center", gap: 8,
            maxWidth: 340,
        }}>
            {isErr ? <FiAlertCircle size={14} /> : <FiCheckCircle size={14} />}
            {toast.msg}
        </div>
    );
};

/* ── Approve Modal ── */
const ApproveModal = ({ vendor, onConfirm, onClose, loading }) => {
    const [commission, setCommission] = useState(18);
    const [plan, setPlan] = useState("starter");
    const [note, setNote] = useState("");

    return (
        <Modal
            open={!!vendor}
            onClose={onClose}
            title="Approve Vendor"
            width={420}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="success" icon={FiCheckCircle} loading={loading} onClick={() => onConfirm({ commissionRate: commission, plan, note })}>
                        Approve
                    </Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>{vendor?.shopName}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <FormField label="Plan">
                    <Select value={plan} onChange={e => setPlan(e.target.value)} disabled={loading}>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="pro">Pro</option>
                    </Select>
                </FormField>
                <FormField label="Commission Rate (%)">
                    <Input type="number" value={commission} onChange={e => setCommission(Number(e.target.value))} min={0} max={50} disabled={loading} />
                </FormField>
                <FormField label="Admin Note (optional)">
                    <Input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Internal note..." disabled={loading} />
                </FormField>
            </div>
        </Modal>
    );
};

/* ── Reject Modal ── */
const RejectModal = ({ vendor, onConfirm, onClose, loading }) => {
    const [reason, setReason] = useState("");
    return (
        <Modal
            open={!!vendor}
            onClose={onClose}
            title="Reject Vendor"
            width={400}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="danger" icon={FiXCircle} loading={loading} disabled={!reason.trim()} onClick={() => reason.trim() && onConfirm({ reason })}>
                        Reject
                    </Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>{vendor?.shopName}</p>
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

/* ── Commission Modal ── */
const CommissionModal = ({ vendor, onConfirm, onClose, loading }) => {
    const [rate, setRate] = useState(vendor?.commissionRate || 18);
    return (
        <Modal
            open={!!vendor}
            onClose={onClose}
            title="Update Commission"
            width={360}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" loading={loading} onClick={() => onConfirm(rate)}>Update</Button>
                </>
            )}
        >
            <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 0, marginBottom: 16 }}>{vendor?.shopName}</p>
            <FormField label="Commission Rate (0–50%)">
                <Input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} min={0} max={50} disabled={loading} />
            </FormField>
        </Modal>
    );
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const AdminVendors = () => {
    const navigate = useNavigate();
    const {
        vendors, loading, actionLoading, error,
        total, totalPages, currentPage,
        fetchVendors, approveVendor, rejectVendor,
        suspendVendor, updateCommission, deleteVendor,
    } = useVendors();

    const { toast, show: showToast } = useToast();

    const [filterStatus, setFilterStatus] = useState("ALL");
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const [modal, setModal] = useState(null); // { type, vendor }

    useEffect(() => {
        fetchVendors({ page: 1 });
    }, []);

    const handleFilter = useCallback((status) => {
        setFilterStatus(status);
        setExpandedId(null);
        fetchVendors({ page: 1, status, search: searchQuery });
    }, [fetchVendors, searchQuery]);

    const handleSearchSubmit = useCallback((value) => {
        setSearchQuery(value);
        setFilterStatus("ALL");
        fetchVendors({ page: 1, search: value });
    }, [fetchVendors]);

    const handleSearchChange = useCallback((value) => {
        setSearchInput(value);
        if (!value && searchQuery) {
            setSearchQuery("");
            fetchVendors({ page: 1, status: filterStatus });
        }
    }, [fetchVendors, filterStatus, searchQuery]);

    const goToPage = useCallback((page) => {
        setExpandedId(null);
        window.scrollTo(0, 0);
        fetchVendors({ page, status: filterStatus, search: searchQuery });
    }, [fetchVendors, filterStatus, searchQuery]);

    const handleApprove = useCallback(async (payload) => {
        if (!modal?.vendor?._id) return;
        const res = await approveVendor(modal.vendor._id, payload);
        if (res.success) { showToast("success", "Vendor approved!"); setModal(null); }
        else showToast("error", res.message);
    }, [approveVendor, modal, showToast]);

    const handleReject = useCallback(async (payload) => {
        if (!modal?.vendor?._id) return;
        const res = await rejectVendor(modal.vendor._id, payload);
        if (res.success) { showToast("success", "Vendor rejected."); setModal(null); }
        else showToast("error", res.message);
    }, [rejectVendor, modal, showToast]);

    const handleSuspend = useCallback(async (vendor) => {
        const res = await suspendVendor(vendor._id, { reason: "Suspended by admin" });
        if (res.success) showToast("success", "Vendor suspended.");
        else showToast("error", res.message);
    }, [suspendVendor, showToast]);

    const handleCommission = useCallback(async (rate) => {
        if (!modal?.vendor?._id) return;
        const res = await updateCommission(modal.vendor._id, rate);
        if (res.success) { showToast("success", "Commission updated!"); setModal(null); }
        else showToast("error", res.message);
    }, [updateCommission, modal, showToast]);

    const handleDelete = useCallback(async (vendor) => {
        if (!window.confirm(`Delete vendor "${vendor.shopName}"? This cannot be undone.`)) return;
        const res = await deleteVendor(vendor._id);
        if (res.success) showToast("success", "Vendor deleted.");
        else showToast("error", res.message);
    }, [deleteVendor, showToast]);

    const filters = [
        { key: "ALL", label: "All" },
        { key: "pending", label: "Pending", tone: "warning" },
        { key: "under_review", label: "Under Review", tone: "info" },
        { key: "approved", label: "Approved", tone: "success" },
        { key: "rejected", label: "Rejected", tone: "danger" },
        { key: "suspended", label: "Suspended", tone: "danger" },
    ];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)", width: "100%", minWidth: 0 }}>
            <Toast toast={toast} />

            {/* Modals */}
            <ApproveModal vendor={modal?.type === "approve" ? modal.vendor : null} onConfirm={handleApprove} onClose={() => setModal(null)} loading={modal ? actionLoading === modal.vendor._id : false} />
            <RejectModal vendor={modal?.type === "reject" ? modal.vendor : null} onConfirm={handleReject} onClose={() => setModal(null)} loading={modal ? actionLoading === modal.vendor._id : false} />
            <CommissionModal vendor={modal?.type === "commission" ? modal.vendor : null} onConfirm={handleCommission} onClose={() => setModal(null)} loading={modal ? actionLoading === modal.vendor._id : false} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Vendors</h1>
                    <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 3 }}>{total} total vendors</p>
                </div>
                <div style={{ width: 260 }}>
                    <SearchBar value={searchInput} onChange={handleSearchChange} onSubmit={handleSearchSubmit} placeholder="Search shop, owner, phone…" />
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 20, scrollbarWidth: "none" }}>
                {filters.map(({ key, label, tone }) => {
                    const active = filterStatus === key;
                    return (
                        <button key={key} onClick={() => handleFilter(key)}
                            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, border: active ? "1px solid var(--adm-primary)" : "1px solid var(--adm-border)", background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)", color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)", cursor: "pointer", fontFamily: "inherit", borderRadius: "var(--adm-radius-md)", transition: "all .15s" }}>
                            {tone && <span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--adm-${tone})` }} />}{label}
                        </button>
                    );
                })}
            </div>

            {error && <div style={{ marginBottom: 16 }}><ErrorState message={error} onRetry={() => fetchVendors({ page: currentPage, status: filterStatus, search: searchQuery })} /></div>}

            {/* Vendor Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loading && vendors.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <Card key={`sk-${i}`} padded>
                            <Skeleton height={44} />
                        </Card>
                    ))
                ) : vendors.length === 0 ? (
                    <EmptyState icon={FiShoppingBag} title="No vendors found" />
                ) : vendors.map((vendor) => {
                    const isExpanded = expandedId === vendor._id;
                    const isActing = actionLoading === vendor._id;

                    return (
                        <Card key={vendor._id} padded={false}>
                            {/* Row Header */}
                            <div onClick={() => setExpandedId(isExpanded ? null : vendor._id)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", flexWrap: "wrap", gap: 10, cursor: "pointer" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    {vendor.shopLogo ? (
                                        <img src={vendor.shopLogo} alt={vendor.shopName} style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", border: "1px solid var(--adm-border)", flexShrink: 0 }} />
                                    ) : (
                                        <div style={{ width: 40, height: 40, background: "var(--adm-surface-alt)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <FiShoppingBag size={16} color="var(--adm-muted)" />
                                        </div>
                                    )}
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: 14, color: "var(--adm-text-primary)", margin: 0 }}>{vendor.shopName}</p>
                                        <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 1 }}>{vendor.ownerName} · {vendor.phone}</p>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <StatusBadge status={vendor.status} />
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-text-secondary)" }}>{vendor.commissionRate}% comm.</span>
                                    <div style={{ color: "var(--adm-muted)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>
                                        <FiChevronDown size={16} />
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Panel */}
                            {isExpanded && (
                                <div style={{ borderTop: "1px solid var(--adm-border-soft)", padding: 20, background: "var(--adm-bg)" }}>

                                    {/* Info Grid */}
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 8, marginBottom: 20 }}>
                                        {[
                                            { icon: FiUser, label: "Owner", value: vendor.ownerName },
                                            { icon: FiPhone, label: "Phone", value: vendor.phone },
                                            { icon: FiMail, label: "Email", value: vendor.email },
                                            { icon: FiMapPin, label: "City", value: vendor.address?.city || "—" },
                                            { icon: FiPercent, label: "Commission", value: `${vendor.commissionRate}%` },
                                            { icon: FiShoppingBag, label: "Category", value: vendor.shopCategory || "—" },
                                        ].map(({ icon: Icon, label, value }) => (
                                            <div key={label} style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                                                <Icon size={13} color="var(--adm-muted)" style={{ marginTop: 2 }} />
                                                <div>
                                                    <div style={{ fontSize: 9, color: "var(--adm-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                                                    <div style={{ fontSize: 13, color: "var(--adm-text-secondary)", fontWeight: 500, marginTop: 1 }}>{value}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Subscription Info */}
                                    {vendor.subscription && (
                                        <div style={{ background: "var(--adm-primary-tint)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: "10px 14px", marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap" }}>
                                            <div>
                                                <p style={{ fontSize: 9, color: "var(--adm-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Plan</p>
                                                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-primary)", textTransform: "capitalize" }}>{vendor.subscription.plan}</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: 9, color: "var(--adm-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Active</p>
                                                <p style={{ fontSize: 13, fontWeight: 700, color: vendor.subscription.isActive ? "var(--adm-success)" : "var(--adm-danger)" }}>{vendor.subscription.isActive ? "Yes" : "No"}</p>
                                            </div>
                                            {vendor.subscription.expiryDate && (
                                                <div>
                                                    <p style={{ fontSize: 9, color: "var(--adm-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Expires</p>
                                                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-secondary)" }}>{new Date(vendor.subscription.expiryDate).toLocaleDateString("en-IN")}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Rejection reason */}
                                    {vendor.status === "rejected" && vendor.rejectionReason && (
                                        <div style={{ marginBottom: 16 }}>
                                            <ErrorState message={`Rejection reason: ${vendor.rejectionReason}`} />
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <Button variant="secondary" size="sm" icon={FiEye} onClick={() => navigate(`/admin/vendors/${vendor._id}`)}>
                                            View Details
                                        </Button>

                                        {vendor.status === "pending" || vendor.status === "under_review" ? (
                                            <>
                                                <Button variant="success" size="sm" icon={FiCheckCircle} loading={isActing} onClick={() => setModal({ type: "approve", vendor })}>
                                                    Approve
                                                </Button>
                                                <Button variant="danger" size="sm" icon={FiXCircle} disabled={isActing} onClick={() => setModal({ type: "reject", vendor })}>
                                                    Reject
                                                </Button>
                                            </>
                                        ) : null}

                                        {vendor.status === "approved" && (
                                            <Button variant="secondary" size="sm" icon={FiPauseCircle} loading={isActing} onClick={() => handleSuspend(vendor)}>
                                                Suspend
                                            </Button>
                                        )}

                                        <Button variant="secondary" size="sm" icon={FiPercent} onClick={() => setModal({ type: "commission", vendor })}>
                                            Commission
                                        </Button>

                                        <Button variant="ghost" size="sm" icon={FiTrash2} disabled={isActing} onClick={() => handleDelete(vendor)} style={{ marginLeft: "auto", color: "var(--adm-danger)" }}>
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

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

export default AdminVendors;
