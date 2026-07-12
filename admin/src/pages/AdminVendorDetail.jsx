/**
 * AdminVendorDetail.jsx
 * Path: src/pages/AdminVendorDetail.jsx
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as vendorApi from "../api/vendorApi";
import {
    FiArrowLeft, FiShoppingBag, FiCheckCircle,
    FiXCircle, FiPauseCircle, FiAlertCircle,
    FiExternalLink,
} from "react-icons/fi";
import {
    Button, StatusBadge, Card, CardHeader, ErrorState,
    Skeleton, Modal, FormField, Input,
} from "../components/ui";

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

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const AdminVendorDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast, show: showToast } = useToast();

    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [approveCommission, setApproveCommission] = useState(18);
    const [error, setError] = useState("");
    const [rejectOpen, setRejectOpen] = useState(false);

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

    const handleAction = useCallback(async (type, payload = {}) => {
        setActionLoading(type);
        try {
            let res;
            if (type === "approve") res = await vendorApi.approveVendor(id, payload);
            if (type === "reject") res = await vendorApi.rejectVendor(id, payload);
            if (type === "suspend") res = await vendorApi.suspendVendor(id, payload);
            setVendor(res.data.vendor);
            showToast("success", `Vendor ${type}d successfully`);
            if (type === "reject") setRejectOpen(false);
        } catch (err) {
            showToast("error", err.response?.data?.message || `Failed to ${type}`);
        } finally {
            setActionLoading(null);
        }
    }, [id, showToast]);

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

            {/* Documents */}
            {vendor.documents && Object.values(vendor.documents).some(Boolean) && (
                <Card padded={false} style={{ marginTop: 16 }}>
                    <CardHeader title="Documents" />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10, padding: "16px 20px 20px" }}>
                        {Object.entries(vendor.documents).map(([key, url]) => url ? (
                            <a key={key} href={url} target="_blank" rel="noreferrer"
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", textDecoration: "none" }}>
                                <FiExternalLink size={10} color="var(--adm-muted)" style={{ marginLeft: "auto" }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-text-secondary)", textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
                            </a>
                        ) : null)}
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
        </div>
    );
};

export default AdminVendorDetail;
