/**
 * AdminDeliveryBoys.jsx — Manage delivery partners
 * ✅ FIX: DocModal + table now show full rider details — vehicle number,
 *    city/address, email, emergency contact, service area — which were
 *    previously either missing from the UI or silently unavailable
 *    because the schema/controller/register-form chain wasn't saving them.
 *    Now reading flat fields matching the corrected DeliveryBoy schema.
 */
import { useEffect, useState } from "react";
import adminApi from "../api/adminApi";
import { Button, StatusBadge, Card, Table, SearchBar, Modal } from "../components/ui";

/* Document Viewer Modal — per-doc approval/rejection */
const DOC_FIELDS = [
    { key: "aadhaarPhoto", label: "Aadhaar Card" },
    { key: "licensePhoto", label: "Driving License" },
    { key: "vehicleRc", label: "Vehicle RC" },
    { key: "selfie", label: "Selfie" },
];

const DocModal = ({ rider, onClose, onUpdate }) => {
    const [fullscreen, setFullscreen] = useState(null);
    const [noteInputs, setNoteInputs] = useState({});
    const [updating, setUpdating] = useState({});

    if (!rider) return null;
    const docs = rider.documents || {};
    const docStatuses = rider.documentStatus || {};
    const docNotes = rider.documentNotes || {};
    const bank = rider.bankDetails || {};

    const handleDocAction = async (docKey, status) => {
        setUpdating(p => ({ ...p, [docKey]: true }));
        try {
            await adminApi.patch(`/admin/delivery-boys/${rider._id}/document-status`, {
                docKey, status, note: noteInputs[docKey] || "",
            });
            if (onUpdate) onUpdate();
        } catch { /* silent */ }
        finally { setUpdating(p => ({ ...p, [docKey]: false })); }
    };

    // Full registered address, assembled from the flat address fields.
    const fullAddress = [rider.houseNumber, rider.landmark, rider.area, rider.city, rider.district, rider.state]
        .filter(Boolean).join(", ") + (rider.pincode ? ` - ${rider.pincode}` : "");

    return (
        <>
            <Modal
                open={!!rider}
                onClose={onClose}
                title={rider.name || "Rider"}
                width={640}
            >
                <p style={{ fontSize: 12, color: "var(--adm-muted)", margin: "-8px 0 16px" }}>{rider.phone} · {rider.city || "No city"}</p>

                {/* Rider details grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: .5 }}>Vehicle</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", marginTop: 2, textTransform: "capitalize" }}>{rider.vehicleType || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--adm-text-secondary)" }}>{rider.vehicleNumber || "No number"} {rider.vehicleModel ? `· ${rider.vehicleModel}` : ""}</div>
                    </div>
                    <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: .5 }}>Stats</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", marginTop: 2 }}>{rider.totalDeliveries || 0} deliveries</div>
                        <div style={{ fontSize: 11, color: "var(--adm-text-secondary)" }}>₹{rider.totalEarnings || 0} earned · ⭐ {rider.rating?.toFixed(1) || "5.0"}</div>
                    </div>
                    <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: .5 }}>Contact</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", marginTop: 2 }}>{rider.email || "No email"}</div>
                        <div style={{ fontSize: 11, color: "var(--adm-text-secondary)" }}>{rider.phone}</div>
                    </div>
                    <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: .5 }}>Emergency Contact</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", marginTop: 2 }}>{rider.emergencyContactName || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--adm-text-secondary)" }}>{rider.emergencyContactPhone || "No number"}</div>
                    </div>
                </div>

                {/* Address */}
                <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Registered Address</div>
                    <div style={{ fontSize: 13, color: "var(--adm-text-primary)" }}>{fullAddress.trim() || "Not provided"}</div>
                    {rider.latitude && rider.longitude && (
                        <div style={{ fontSize: 11, color: "var(--adm-text-secondary)", marginTop: 2 }}>📍 {rider.latitude}, {rider.longitude}</div>
                    )}
                </div>

                {/* Service Area */}
                <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Service Area (Pincodes)</div>
                    <div style={{ fontSize: 13, color: "var(--adm-text-primary)" }}>
                        {rider.servicePincodes?.length > 0 ? rider.servicePincodes.join(", ") : "All areas (no restriction set)"}
                    </div>
                </div>

                {/* Bank Details */}
                <div style={{ background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Bank Details</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                        <div><strong>Holder:</strong> {bank.accountHolder || "—"}</div>
                        <div><strong>Bank:</strong> {bank.bankName || "—"}</div>
                        <div><strong>Account:</strong> {bank.accountNumber ? `****${bank.accountNumber.slice(-4)}` : "—"}</div>
                        <div><strong>IFSC:</strong> {bank.ifsc || "—"}</div>
                        <div style={{ gridColumn: "1 / -1" }}><strong>UPI:</strong> {bank.upiId || "—"}</div>
                    </div>
                </div>

                {/* Documents with per-doc approval */}
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", marginBottom: 10 }}>Documents</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {DOC_FIELDS.map(doc => {
                        const url = docs[doc.key];
                        const status = docStatuses[doc.key] || "pending";
                        const note = docNotes[doc.key] || "";
                        const busy = updating[doc.key];

                        return (
                            <div key={doc.key} style={{ border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", overflow: "hidden", background: "var(--adm-surface)" }}>
                                <div style={{ display: "flex", gap: 12, padding: 12, alignItems: "flex-start" }}>
                                    {url ? (
                                        <div style={{ width: 80, height: 80, borderRadius: "var(--adm-radius-sm)", overflow: "hidden", border: "1px solid var(--adm-border)", cursor: "pointer", flexShrink: 0 }}
                                            onClick={() => setFullscreen({ url, label: doc.label })}>
                                            <img src={url} alt={doc.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                                        </div>
                                    ) : (
                                        <div style={{ width: 80, height: 80, borderRadius: "var(--adm-radius-sm)", background: "var(--adm-surface-alt)", border: "1px dashed var(--adm-border)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                                            <span style={{ fontSize: 20, opacity: .3 }}>📄</span>
                                            <span style={{ fontSize: 9, color: "var(--adm-border)" }}>Not uploaded</span>
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{doc.label}</span>
                                            <StatusBadge status={status} />
                                        </div>
                                        {note && <div style={{ fontSize: 11, color: "var(--adm-text-secondary)", marginBottom: 6 }}>Note: {note}</div>}
                                        {url && (
                                            <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--adm-primary)", fontWeight: 600, textDecoration: "none" }}>
                                                Open full size ↗
                                            </a>
                                        )}
                                        {url && (
                                            <div style={{ marginTop: 8 }}>
                                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                                    {status !== "approved" && (
                                                        <Button variant="success" size="sm" loading={busy} onClick={() => handleDocAction(doc.key, "approved")}>Approve</Button>
                                                    )}
                                                    {status !== "rejected" && (
                                                        <Button variant="danger" size="sm" loading={busy} onClick={() => handleDocAction(doc.key, "rejected")}>Reject</Button>
                                                    )}
                                                    {status === "approved" && (
                                                        <Button variant="secondary" size="sm" loading={busy} onClick={() => handleDocAction(doc.key, "pending")}>Reset</Button>
                                                    )}
                                                </div>
                                                {status !== "approved" && (
                                                    <input
                                                        type="text" placeholder="Rejection note (optional)"
                                                        value={noteInputs[doc.key] || ""}
                                                        onChange={e => setNoteInputs(p => ({ ...p, [doc.key]: e.target.value }))}
                                                        style={{ marginTop: 6, width: "100%", padding: "5px 10px", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-sm)", fontSize: 11, outline: "none", boxSizing: "border-box" }}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {rider.adminNote && (
                    <div style={{ background: "var(--adm-warning-tint)", border: "1px solid var(--adm-warning)", borderRadius: "var(--adm-radius-sm)", padding: "10px 14px", marginTop: 12, fontSize: 12, color: "var(--adm-warning-hover)" }}>
                        <strong>Admin Note:</strong> {rider.adminNote}
                    </div>
                )}
            </Modal>

            {fullscreen && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
                    onClick={() => setFullscreen(null)}>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{fullscreen.label}</div>
                    <img src={fullscreen.url} alt={fullscreen.label} style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8 }} onClick={e => e.stopPropagation()} />
                    <button onClick={() => setFullscreen(null)} style={{ marginTop: 16, padding: "8px 24px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
                </div>
            )}
        </>
    );
};

const AdminDeliveryBoys = () => {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [msg, setMsg] = useState("");
    const [docRider, setDocRider] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await adminApi.get("/admin/delivery-boys");
            setList(data.deliveryBoys || []);
        } catch { setMsg("Failed to load"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const updateStatus = async (id, status) => {
        try {
            await adminApi.patch(`/admin/delivery-boys/${id}/status`, { status });
            setMsg(`Status updated to ${status}`);
            load();
            setTimeout(() => setMsg(""), 3000);
        } catch { setMsg("Failed to update"); }
    };

    const filtered = list.filter(d => {
        const matchStatus = filter === "all" || d.status === filter;
        const displayName = d.name || d.userId?.name || "";
        const matchSearch = !search || displayName.toLowerCase().includes(search.toLowerCase()) || d.phone?.includes(search);
        return matchStatus && matchSearch;
    });

    const counts = {};
    list.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });

    const filterPill = (active) => ({
        padding: "6px 14px",
        border: `1.5px solid ${active ? "var(--adm-primary)" : "var(--adm-border)"}`,
        background: active ? "var(--adm-primary)" : "var(--adm-surface)",
        color: active ? "var(--adm-text-on-accent)" : "var(--adm-text-secondary)",
        borderRadius: "var(--adm-radius-full)",
        fontSize: 12, fontWeight: 700, cursor: "pointer",
    });

    const columns = [
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "city", label: "City" },
        { key: "vehicle", label: "Vehicle" },
        { key: "emergency", label: "Emergency Contact" },
        { key: "status", label: "Status" },
        { key: "online", label: "Online" },
        { key: "rating", label: "Rating" },
        { key: "actions", label: "Actions" },
    ];

    return (
        <div style={{ padding: 24, fontFamily: "var(--adm-font-sans)" }}>
            {docRider && <DocModal rider={docRider} onClose={() => setDocRider(null)} onUpdate={load} />}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--adm-text-primary)", margin: 0 }}>🏍️ Delivery Partners</h1>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", margin: "4px 0 0" }}>
                        Total: {list.length} · Online: {list.filter(d => d.isOnline).length} · Pending: {counts.pending || 0}
                    </p>
                </div>
            </div>

            {msg && (
                <div style={{ background: "var(--adm-success-tint)", border: "1px solid var(--adm-success)", color: "var(--adm-success-hover)", padding: "10px 14px", borderRadius: "var(--adm-radius-sm)", marginBottom: 16, fontSize: 13 }}>{msg}</div>
            )}

            <Card padded>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {["all", "pending", "approved", "rejected", "suspended"].map(f => (
                            <button key={f} style={filterPill(filter === f)} onClick={() => setFilter(f)}>
                                {f.charAt(0).toUpperCase() + f.slice(1)} {f !== "all" && counts[f] ? `(${counts[f]})` : ""}
                            </button>
                        ))}
                    </div>
                    <div style={{ width: 240 }}>
                        <SearchBar value={search} onChange={setSearch} placeholder="Search name / phone…" />
                    </div>
                </div>

                <Table
                    columns={columns}
                    rows={filtered}
                    loading={loading}
                    skeletonRows={6}
                    empty={{ title: "No delivery partners found", description: "Try a different filter or search." }}
                    renderRow={(d) => {
                        const displayName = d.name || d.userId?.name || "Unknown";
                        return (
                            <tr key={d._id}>
                                <td>
                                    <div style={{ fontWeight: 700 }}>{displayName}</div>
                                    <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>{d.vehicleNumber || "—"}</div>
                                </td>
                                <td>{d.phone}</td>
                                <td>{d.email || "—"}</td>
                                <td>{d.city || "—"}</td>
                                <td style={{ textTransform: "capitalize" }}>{d.vehicleType || "—"}{d.vehicleModel ? ` · ${d.vehicleModel}` : ""}</td>
                                <td>
                                    {d.emergencyContactName
                                        ? <>{d.emergencyContactName}<div style={{ fontSize: 11, color: "var(--adm-muted)" }}>{d.emergencyContactPhone}</div></>
                                        : "—"}
                                </td>
                                <td><StatusBadge status={d.status} /></td>
                                <td><StatusBadge status={d.isOnline ? "online" : "offline"} /></td>
                                <td>⭐ {d.rating?.toFixed(1) || "5.0"}</td>
                                <td>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        <Button variant="secondary" size="sm" onClick={() => setDocRider(d)}>View</Button>
                                        {d.status !== "approved" && d.status !== "rejected" && (
                                            <Button variant="success" size="sm" onClick={() => updateStatus(d._id, "approved")}>Approve</Button>
                                        )}
                                        {d.status === "pending" && (
                                            <Button variant="danger" size="sm" onClick={() => updateStatus(d._id, "rejected")}>Reject</Button>
                                        )}
                                        {d.status === "approved" && (
                                            <Button variant="danger" size="sm" onClick={() => updateStatus(d._id, "suspended")}>Suspend</Button>
                                        )}
                                        {(d.status === "suspended" || d.status === "rejected") && (
                                            <Button variant="success" size="sm" onClick={() => updateStatus(d._id, "approved")}>Restore</Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                />
            </Card>
        </div>
    );
};
export default AdminDeliveryBoys;