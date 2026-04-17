/**
 * AdminVendorDetail.jsx
 * Path: src/pages/AdminVendorDetail.jsx
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as vendorApi from "../api/vendorApi";
import {
    FiArrowLeft, FiShoppingBag, FiUser, FiPhone, FiMail,
    FiMapPin, FiPercent, FiFileText, FiCheckCircle,
    FiXCircle, FiPauseCircle, FiLoader, FiAlertCircle,
    FiExternalLink, FiDollarSign,
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
    under_review: { label: "Under Review", color: T.blue, bg: T.blueBg },
    approved: { label: "Approved", color: T.green, bg: "#f0fdf4" },
    rejected: { label: "Rejected", color: T.red, bg: "#fef2f2" },
    suspended: { label: "Suspended", color: T.violet, bg: "#f5f3ff" },
};

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
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: isErr ? "#fef2f2" : "#f0fdf4", border: `1px solid ${isErr ? "#fecaca" : "#bbf7d0"}`, color: isErr ? T.red : T.green, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 8, maxWidth: 340 }}>
            {isErr ? <FiAlertCircle size={14} /> : <FiCheckCircle size={14} />}
            {toast.msg}
        </div>
    );
};

const InfoRow = ({ label, value }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: T.hint, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.sub }}>{value || "—"}</p>
    </div>
);

const Section = ({ title, children }) => (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.hint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>{title}</p>
        {children}
    </div>
);

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
        } catch (err) {
            showToast("error", err.response?.data?.message || `Failed to ${type}`);
        } finally {
            setActionLoading(null);
        }
    }, [id, showToast]);

    if (loading) return (
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ width: 36, height: 36, border: `3px solid ${T.blueMid}`, borderTopColor: T.blue, borderRadius: "50%", animation: "avd-spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ color: T.hint, fontSize: 13 }}>Loading vendor...</p>
            </div>
            <style>{`@keyframes avd-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error || !vendor) return (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <FiAlertCircle size={32} style={{ color: T.red, marginBottom: 10 }} />
            <p style={{ color: T.red, fontSize: 14, fontWeight: 600 }}>{error || "Vendor not found"}</p>
            <button onClick={() => navigate("/admin/vendors")} style={{ marginTop: 16, padding: "8px 16px", background: T.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Back to Vendors</button>
        </div>
    );

    const cfg = STATUS_CONFIG[vendor.status] || STATUS_CONFIG.pending;

    return (
        <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: T.text }}>
            <style>{`@keyframes avd-spin{to{transform:rotate(360deg)}}
@media(max-width:768px){.avd-grid{grid-template-columns:1fr!important;}.avd-inner{grid-template-columns:1fr!important;}}
@media(max-width:480px){.avd-grid{gap:12px!important;}}`}</style>
            <Toast toast={toast} />

            {/* Back + Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                <button onClick={() => navigate("/admin/vendors")}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.muted, cursor: "pointer" }}>
                    <FiArrowLeft size={13} /> Back
                </button>
                {vendor.shopLogo ? (
                    <img src={vendor.shopLogo} alt={vendor.shopName} style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", border: `1px solid ${T.border}` }} />
                ) : (
                    <div style={{ width: 48, height: 48, background: cfg.bg, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FiShoppingBag size={20} color={cfg.color} />
                    </div>
                )}
                <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>{vendor.shopName}</h1>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, padding: "3px 10px", borderRadius: 99 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />{cfg.label}
                        </span>
                    </div>
                    <p style={{ fontSize: 13, color: T.hint, marginTop: 2 }}>{vendor.ownerName} · {vendor.email}</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                {(vendor.status === "pending" || vendor.status === "under_review") && (
                    <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>Commission %</label>
                            <input type="number" min={0} max={50} value={approveCommission} onChange={e => setApproveCommission(Number(e.target.value))}
                                style={{ width: 60, padding: "7px 8px", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, textAlign: "center" }} />
                        </div>
                        <button onClick={() => handleAction("approve", { commissionRate: approveCommission, plan: "starter" })} disabled={actionLoading === "approve"}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: T.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            {actionLoading === "approve" ? <FiLoader size={13} style={{ animation: "avd-spin 0.8s linear infinite" }} /> : <FiCheckCircle size={13} />}
                            Approve Vendor
                        </button>
                        <button onClick={() => { const r = prompt("Rejection reason?"); if (r) handleAction("reject", { reason: r }); }} disabled={actionLoading === "reject"}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#fef2f2", border: "1px solid #fecaca", color: T.red, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            <FiXCircle size={13} /> Reject
                        </button>
                    </>
                )}
                {vendor.status === "approved" && (
                    <button onClick={() => handleAction("suspend", { reason: "Suspended by admin" })} disabled={actionLoading === "suspend"}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#f5f3ff", border: "1px solid #ddd6fe", color: T.violet, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        {actionLoading === "suspend" ? <FiLoader size={13} style={{ animation: "avd-spin 0.8s linear infinite" }} /> : <FiPauseCircle size={13} />}
                        Suspend
                    </button>
                )}
            </div>

            <div className="avd-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Shop Info */}
                <Section title="Shop Info">
                    <div className="avd-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <InfoRow label="Shop Name" value={vendor.shopName} />
                        <InfoRow label="Category" value={vendor.shopCategory} />
                        <InfoRow label="Business Type" value={vendor.businessType} />
                        <InfoRow label="Delivery Mode" value={vendor.deliveryMode} />
                        <InfoRow label="GST Number" value={vendor.gstNumber} />
                        <InfoRow label="PAN Number" value={vendor.panNumber} />
                    </div>
                    {vendor.shopDescription && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: T.hint, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Description</p>
                            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{vendor.shopDescription}</p>
                        </div>
                    )}
                </Section>

                {/* Owner Info */}
                <Section title="Owner Info">
                    <div className="avd-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <InfoRow label="Owner" value={vendor.ownerName} />
                        <InfoRow label="Phone" value={vendor.phone} />
                        <InfoRow label="WhatsApp" value={vendor.whatsapp} />
                        <InfoRow label="Email" value={vendor.email} />
                        <InfoRow label="Address" value={[vendor.address?.line1, vendor.address?.city, vendor.address?.pincode].filter(Boolean).join(", ")} />
                    </div>
                </Section>

                {/* Commission + Subscription */}
                <Section title="Commission & Subscription">
                    <div className="avd-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                        <InfoRow label="Commission" value={`${vendor.commissionRate}%`} />
                        <InfoRow label="Override" value={vendor.commissionOverride ? "Yes" : "No"} />
                        <InfoRow label="Plan" value={vendor.subscription?.plan} />
                        <InfoRow label="Sub Active" value={vendor.subscription?.isActive ? "Yes" : "No"} />
                        <InfoRow label="Expires" value={vendor.subscription?.expiryDate ? new Date(vendor.subscription.expiryDate).toLocaleDateString("en-IN") : "—"} />
                    </div>
                </Section>

                {/* Stats */}
                <Section title="Stats">
                    <div className="avd-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <InfoRow label="Total Orders" value={vendor.totalOrders} />
                        <InfoRow label="Total Revenue" value={`₹${Number(vendor.totalRevenue || 0).toLocaleString("en-IN")}`} />
                        <InfoRow label="Total Earnings" value={`₹${Number(vendor.totalEarnings || 0).toLocaleString("en-IN")}`} />
                        <InfoRow label="Pending Settlement" value={`₹${Number(vendor.pendingSettlement || 0).toLocaleString("en-IN")}`} />
                        <InfoRow label="Rating" value={`${vendor.rating} / 5 (${vendor.ratingCount} reviews)`} />
                    </div>
                </Section>
            </div>

            {/* Service Pincodes */}
            {vendor.servicePincodes?.length > 0 && (
                <Section title="Service Pincodes">
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {vendor.servicePincodes.map(p => (
                            <span key={p} style={{ fontSize: 12, fontWeight: 600, background: T.blueBg, color: T.blue, border: `1px solid ${T.blueMid}`, padding: "4px 12px", borderRadius: 6, fontFamily: "'Courier New',monospace" }}>{p}</span>
                        ))}
                    </div>
                </Section>
            )}

            {/* Documents */}
            {vendor.documents && Object.values(vendor.documents).some(Boolean) && (
                <Section title="Documents">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10 }}>
                        {Object.entries(vendor.documents).map(([key, url]) => url ? (
                            <a key={key} href={url} target="_blank" rel="noreferrer"
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8, textDecoration: "none" }}>
                                <FiFileText size={14} color={T.blue} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: T.sub, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
                                <FiExternalLink size={10} color={T.hint} style={{ marginLeft: "auto" }} />
                            </a>
                        ) : null)}
                    </div>
                </Section>
            )}

            {/* Bank Details */}
            {vendor.bankDetails?.accountNumber && (
                <Section title="Bank Details">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 14 }}>
                        <InfoRow label="Account Holder" value={vendor.bankDetails.accountHolder} />
                        <InfoRow label="Account Number" value={vendor.bankDetails.accountNumber} />
                        <InfoRow label="IFSC" value={vendor.bankDetails.ifsc} />
                        <InfoRow label="Bank" value={vendor.bankDetails.bankName} />
                        <InfoRow label="UPI ID" value={vendor.bankDetails.upiId} />
                    </div>
                </Section>
            )}
        </div>
    );
};

export default AdminVendorDetail;