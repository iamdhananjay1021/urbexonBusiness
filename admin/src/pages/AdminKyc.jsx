/**
 * AdminKYC.jsx
 * Urbexon Admin Panel — Delivery Partner KYC Review
 *
 * Talks to: controllers/admin/adminKYCController.js (via services/deliveryKYCService.js)
 * Route file: routes/admin/adminDeliveryRoutes.js
 * (uses the same "/admin/delivery" mount-prefix assumption as AdminZone.jsx —
 * verify against server.js and update KYC_BASE below if different)
 *
 * IMPORTANT — this page only exposes the actions the backend actually has
 * routes for:
 *   GET    /admin/delivery/kyc            → review queue (always overallStatus="under_review")
 *   GET    /admin/delivery/kyc/:id        → full record
 *   PATCH  /admin/delivery/kyc/:id/aadhaar → { verified, notes }
 *   PATCH  /admin/delivery/kyc/:id/pan     → { verified, notes }
 *   POST   /admin/delivery/kyc/:id/approve → { notes }
 *   POST   /admin/delivery/kyc/:id/reject  → { reason }
 *
 * There are no admin routes for verifying Driving License / Vehicle RC /
 * Face match individually — those sections are shown READ-ONLY (whatever
 * the rider submitted) so the admin can eyeball them before making the
 * overall Approve/Reject call. If you add routes for those later, this
 * page can grow matching action buttons for them.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
    FiRefreshCw, FiCheckCircle, FiXCircle, FiAlertCircle, FiExternalLink, FiClock,
} from "react-icons/fi";
import adminApi from "../api/adminApi";
import {
    Button, StatusBadge, Card, EmptyState, Skeleton, Pagination,
} from "../components/ui";

const KYC_BASE = "/admin/delivery/kyc";

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/* ─────────────────────────── SMALL UI HELPERS ─────────────────────────── */

const Toast = ({ msg }) => {
    if (!msg.text) return null;
    const isSuccess = msg.type === "success";
    return (
        <div style={{
            position: "fixed", top: 20, right: 24, zIndex: 9999,
            background: isSuccess ? "var(--adm-success-tint)" : "var(--adm-danger-tint)",
            border: `1px solid ${isSuccess ? "var(--adm-success)" : "var(--adm-danger)"}`,
            color: isSuccess ? "var(--adm-success)" : "var(--adm-danger)",
            padding: "10px 16px", borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "var(--adm-shadow-md)",
        }}>
            {isSuccess ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
            {msg.text}
        </div>
    );
};

const inputStyle = {
    padding: "8px 10px", fontSize: 13, borderRadius: "var(--adm-radius-md)",
    border: "1px solid var(--adm-border)", background: "var(--adm-surface)",
    color: "var(--adm-text-primary)", width: "100%", fontFamily: "inherit", boxSizing: "border-box",
};

const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-text-secondary)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
        {children}
    </div>
);

/* Small verified/unverified pill — used for individual document status,
   distinct from the overall StatusBadge which handles overallStatus */
const VerifiedPill = ({ verified }) => (
    <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--adm-radius-full)",
        background: verified ? "var(--adm-success-tint)" : "var(--adm-warning-tint)",
        color: verified ? "var(--adm-success)" : "var(--adm-warning)",
    }}>
        {verified ? <FiCheckCircle size={10} /> : <FiClock size={10} />}
        {verified ? "Verified" : "Not verified"}
    </span>
);

/* Document image thumbnail — links out to the full-size image since this
   page has no image-viewer component available */
const DocImage = ({ url, label }) => (
    <a
        href={url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { if (!url) e.preventDefault(); }}
        style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            width: 100, textDecoration: "none", cursor: url ? "pointer" : "default",
        }}
    >
        <div style={{
            width: 100, height: 72, borderRadius: "var(--adm-radius-md)",
            border: "1px solid var(--adm-border)", background: "var(--adm-surface-alt)",
            overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            {url ? (
                <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
                <span style={{ fontSize: 10, color: "var(--adm-muted)" }}>No image</span>
            )}
        </div>
        <span style={{ fontSize: 10, color: "var(--adm-text-secondary)", display: "flex", alignItems: "center", gap: 2 }}>
            {label}{url && <FiExternalLink size={9} />}
        </span>
    </a>
);

/* ─────────────────────────── VERIFIABLE DOC CARD (Aadhaar / PAN) ─────────────────────────── */

const VerifiableDocCard = ({ title, doc, images, number, onVerify, busy }) => {
    const [notes, setNotes] = useState("");

    return (
        <Card padded>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{title}</div>
                <VerifiedPill verified={!!doc?.verified} />
            </div>

            <div style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginBottom: 10 }}>
                Number: <span style={{ fontWeight: 600, color: "var(--adm-text-primary)" }}>{number || "—"}</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                {images.map(({ url, label }) => <DocImage key={label} url={url} label={label} />)}
            </div>

            {doc?.extractedData && (doc.extractedData.name || doc.extractedData.dob) && (
                <div style={{ fontSize: 11, color: "var(--adm-muted)", marginBottom: 10 }}>
                    Extracted: {doc.extractedData.name || "—"}
                    {doc.extractedData.dob ? ` · DOB ${fmtDate(doc.extractedData.dob)}` : ""}
                </div>
            )}

            {doc?.verifiedAt && (
                <div style={{ fontSize: 11, color: "var(--adm-muted)", marginBottom: 10 }}>
                    Last reviewed {fmtDateTime(doc.verifiedAt)}
                </div>
            )}

            <textarea
                style={{ ...inputStyle, minHeight: 44, resize: "vertical", marginBottom: 8 }}
                placeholder="Reviewer note (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" variant="primary" loading={busy} onClick={() => onVerify(true, notes)}>Verify</Button>
                <Button size="sm" variant="danger" loading={busy} onClick={() => onVerify(false, notes)}>Reject</Button>
            </div>
        </Card>
    );
};

/* ─────────────────────────── READ-ONLY DOC CARD (License / RC / Face) ─────────────────────────── */

const ReadOnlyDocCard = ({ title, verified, images, fields }) => (
    <Card padded>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{title}</div>
            {verified !== undefined && <VerifiedPill verified={!!verified} />}
        </div>

        {images && images.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                {images.map(({ url, label }) => <DocImage key={label} url={url} label={label} />)}
            </div>
        )}

        {fields && fields.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {fields.map(([label, value]) => (
                    <div key={label}>
                        <div style={{ fontSize: 10, color: "var(--adm-muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                        <div style={{ fontSize: 12, color: "var(--adm-text-primary)", fontWeight: 600 }}>{value || "—"}</div>
                    </div>
                ))}
            </div>
        )}
    </Card>
);

/* ─────────────────────────── EXPANDED KYC RECORD ─────────────────────────── */

const KYCExpanded = ({ kycId, showMsg, onDecided }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(null); // "aadhaar" | "pan" | null
    const [decisionNote, setDecisionNote] = useState("");
    const [deciding, setDeciding] = useState(null); // "approve" | "reject" | null

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await adminApi.get(`${KYC_BASE}/${kycId}`);
            setDetail(data.data);
        } catch {
            showMsg("Failed to load KYC details", "error");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kycId]);

    useEffect(() => { load(); }, [load]);

    const verifyDoc = async (type, verified, notes) => {
        setVerifying(type);
        try {
            await adminApi.patch(`${KYC_BASE}/${kycId}/${type}`, { verified, notes });
            showMsg(`${type === "aadhaar" ? "Aadhaar" : "PAN"} ${verified ? "verified" : "rejected"}`, "success");
            load();
        } catch (err) {
            showMsg(err?.response?.data?.message || "Failed to update", "error");
        } finally {
            setVerifying(null);
        }
    };

    const decide = async (action) => {
        if (action === "reject" && !decisionNote.trim()) {
            showMsg("Rejection reason is required", "error");
            return;
        }
        if (!window.confirm(action === "approve" ? "Approve this KYC application?" : "Reject this KYC application?")) return;
        setDeciding(action);
        try {
            if (action === "approve") {
                await adminApi.post(`${KYC_BASE}/${kycId}/approve`, { notes: decisionNote });
            } else {
                await adminApi.post(`${KYC_BASE}/${kycId}/reject`, { reason: decisionNote });
            }
            showMsg(`KYC ${action === "approve" ? "approved" : "rejected"}`, "success");
            onDecided();
        } catch (err) {
            showMsg(err?.response?.data?.message || "Failed to submit decision", "error");
        } finally {
            setDeciding(null);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: "20px 24px", background: "var(--adm-bg)", borderTop: "1px solid var(--adm-border-soft)" }}>
                <Skeleton height={160} />
            </div>
        );
    }
    if (!detail) return null;

    const rider = detail.deliveryBoyId || {};
    const timeline = [...(detail.timeline || [])].reverse();

    return (
        <div style={{ background: "var(--adm-bg)", borderTop: "1px solid var(--adm-border-soft)", padding: "20px 24px 24px" }}>
            {/* Rider info */}
            <Card padded style={{ marginBottom: 14 }}>
                <SectionLabel>Delivery partner</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {[
                        ["Name", rider.name],
                        ["Phone", rider.phone],
                        ["Email", rider.email],
                        ["City", rider.city],
                        ["Vehicle", rider.vehicleType],
                        ["Vehicle No.", rider.vehicleNumber],
                        ["Bank", rider.bankDetails?.bankName],
                        ["A/C (masked)", rider.bankDetails?.accountNumber ? `••••${String(rider.bankDetails.accountNumber).slice(-4)}` : "—"],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <div style={{ fontSize: 10, color: "var(--adm-muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                            <div style={{ fontSize: 12, color: "var(--adm-text-primary)", fontWeight: 600 }}>{value || "—"}</div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Verifiable documents */}
            <SectionLabel>Aadhaar &amp; PAN (actionable)</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <VerifiableDocCard
                    title="Aadhaar Card"
                    doc={detail.aadhaar}
                    number={detail.aadhaar?.number}
                    images={[
                        { url: detail.aadhaar?.frontImage, label: "Front" },
                        { url: detail.aadhaar?.backImage, label: "Back" },
                    ]}
                    onVerify={(verified, notes) => verifyDoc("aadhaar", verified, notes)}
                    busy={verifying === "aadhaar"}
                />
                <VerifiableDocCard
                    title="PAN Card"
                    doc={detail.pan}
                    number={detail.pan?.number}
                    images={[{ url: detail.pan?.image, label: "PAN" }]}
                    onVerify={(verified, notes) => verifyDoc("pan", verified, notes)}
                    busy={verifying === "pan"}
                />
            </div>

            {/* Read-only documents */}
            <SectionLabel>Other submitted documents (read-only)</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                <ReadOnlyDocCard
                    title="Driving License"
                    verified={detail.drivingLicense?.verified}
                    images={[
                        { url: detail.drivingLicense?.frontImage, label: "Front" },
                        { url: detail.drivingLicense?.backImage, label: "Back" },
                    ]}
                    fields={[
                        ["Number", detail.drivingLicense?.number],
                        ["State", detail.drivingLicense?.state],
                        ["Expiry", fmtDate(detail.drivingLicense?.expiryDate)],
                        ["Class", detail.drivingLicense?.vehicleClass],
                    ]}
                />
                <ReadOnlyDocCard
                    title="Vehicle RC"
                    verified={detail.vehicleRC?.verified}
                    images={[
                        { url: detail.vehicleRC?.frontImage, label: "Front" },
                        { url: detail.vehicleRC?.backImage, label: "Back" },
                    ]}
                    fields={[
                        ["Reg. number", detail.vehicleRC?.registrationNumber],
                        ["Owner", detail.vehicleRC?.ownerName],
                        ["Valid till", fmtDate(detail.vehicleRC?.validTill)],
                        ["Type", detail.vehicleRC?.vehicleType],
                    ]}
                />
                <ReadOnlyDocCard
                    title="Face Verification"
                    verified={detail.faceVerification?.status === "verified"}
                    images={[{ url: detail.faceVerification?.selfieImage, label: "Selfie" }]}
                    fields={[
                        ["Status", detail.faceVerification?.status || "pending"],
                        ["Match score", detail.faceVerification?.aadhaarMatchScore ?? "—"],
                        ["Attempts", detail.faceVerification?.attempts ?? 0],
                    ]}
                />
            </div>

            {/* Timeline */}
            {timeline.length > 0 && (
                <Card padded style={{ marginBottom: 14 }}>
                    <SectionLabel>Timeline</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                        {timeline.map((t, i) => (
                            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                                <span style={{ color: "var(--adm-muted)", minWidth: 130, flexShrink: 0 }}>{fmtDateTime(t.timestamp)}</span>
                                <span style={{ color: "var(--adm-text-primary)", fontWeight: 600 }}>{t.event}</span>
                                {t.notes && <span style={{ color: "var(--adm-text-secondary)" }}>— {t.notes}</span>}
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Overall decision */}
            <Card padded>
                <SectionLabel>Final decision</SectionLabel>
                <textarea
                    style={{ ...inputStyle, minHeight: 56, resize: "vertical", marginBottom: 10 }}
                    placeholder="Note (used as approval note, or required as rejection reason)"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="primary" icon={FiCheckCircle} loading={deciding === "approve"} onClick={() => decide("approve")}>
                        Approve KYC
                    </Button>
                    <Button variant="danger" icon={FiXCircle} loading={deciding === "reject"} onClick={() => decide("reject")}>
                        Reject KYC
                    </Button>
                </div>
            </Card>
        </div>
    );
};

/* ─────────────────────────── MAIN COMPONENT ─────────────────────────── */

const AdminKYC = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ text: "", type: "" });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [expandedId, setExpandedId] = useState(null);
    const msgTimer = useRef(null);

    const showMsg = (text, type = "info") => {
        clearTimeout(msgTimer.current);
        setMsg({ text, type });
        msgTimer.current = setTimeout(() => setMsg({ text: "", type: "" }), 4000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await adminApi.get(`${KYC_BASE}?${new URLSearchParams({ page, limit: 20 })}`);
            setRecords(data.data || []);
            setTotal(data.pagination?.total || 0);
            setTotalPages(data.pagination?.pages || 1);
        } catch {
            showMsg("Failed to load KYC queue", "error");
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { load(); }, [load]);

    const onDecided = () => {
        setExpandedId(null);
        load();
    };

    return (
        <div style={{ padding: 28, fontFamily: "var(--adm-font-sans)", background: "var(--adm-bg)", minHeight: "100vh" }}>
            <Toast msg={msg} />

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: "var(--adm-radius-md)", background: "var(--adm-primary)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                        }}>🪪</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", letterSpacing: "-.4px" }}>
                            KYC Review Queue
                        </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--adm-text-secondary)", marginLeft: 46 }}>
                        Delivery partners awaiting document verification
                    </div>
                </div>
                <Button variant="secondary" icon={FiRefreshCw} onClick={load}>Refresh</Button>
            </div>

            {/* List */}
            <Card padded={false} style={{ overflow: "hidden" }}>
                <div style={{
                    padding: "14px 22px", background: "var(--adm-surface-alt)", borderBottom: "1px solid var(--adm-border-soft)",
                    display: "flex", alignItems: "center", gap: 10,
                }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-text-primary)" }}>Pending review</span>
                    <span style={{
                        background: "var(--adm-surface)", color: "var(--adm-text-secondary)", fontSize: 11, fontWeight: 700,
                        padding: "2px 8px", borderRadius: "var(--adm-radius-full)",
                    }}>{total}</span>
                </div>

                {loading ? (
                    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} />)}
                    </div>
                ) : records.length === 0 ? (
                    <EmptyState title="No KYC records pending review" />
                ) : (
                    records.map((rec, idx) => {
                        const rider = rec.deliveryBoyId || {};
                        const isExpanded = expandedId === rec._id;
                        return (
                            <div key={rec._id} style={{ borderBottom: idx < records.length - 1 ? "1px solid var(--adm-border-soft)" : "none" }}>
                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : rec._id)}
                                    style={{
                                        display: "grid", gridTemplateColumns: "1fr 160px 140px 120px",
                                        alignItems: "center", cursor: "pointer",
                                        background: isExpanded ? "var(--adm-surface-alt)" : "var(--adm-surface)",
                                    }}
                                >
                                    <div style={{ padding: "14px 22px" }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{rider.name || "Unknown"}</div>
                                        <div style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 2 }}>{rider.phone} · {rider.city || "—"}</div>
                                    </div>
                                    <div style={{ padding: "14px 8px", fontSize: 12, color: "var(--adm-text-secondary)" }}>
                                        Submitted {fmtDate(rec.createdAt)}
                                    </div>
                                    <div style={{ padding: "14px 8px", display: "flex", gap: 4 }}>
                                        <VerifiedPill verified={!!rec.aadhaar?.verified} />
                                    </div>
                                    <div style={{ padding: "14px 22px 14px 8px" }}>
                                        <StatusBadge status={rec.overallStatus} />
                                    </div>
                                </div>
                                {isExpanded && (
                                    <KYCExpanded kycId={rec._id} showMsg={showMsg} onDecided={onDecided} />
                                )}
                            </div>
                        );
                    })
                )}
            </Card>

            {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
                </div>
            )}

            <div style={{ height: 40 }} />
        </div>
    );
};

export default AdminKYC;