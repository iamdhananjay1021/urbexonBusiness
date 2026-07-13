/**
 * AdminZone.jsx
 * Urbexon Admin Panel — Delivery Zone Management
 *
 * Talks to: controllers/admin/adminZoneController.js (via services/deliveryZoneService.js)
 * Route file: routes/admin/adminDeliveryRoutes.js
 *
 * ⚠️ MOUNT PREFIX ASSUMPTION — verify against your server.js:
 *   This page assumes adminDeliveryRoutes.js is mounted at "/admin/delivery"
 *   (e.g. app.use("/admin/delivery", adminDeliveryRoutes)), so the zone
 *   sub-routes resolve to:
 *     GET    /admin/delivery/zones
 *     POST   /admin/delivery/zones
 *     GET    /admin/delivery/zones/:id
 *     PATCH  /admin/delivery/zones/:id
 *     POST   /admin/delivery/zones/:id/assign-partner
 *     DELETE /admin/delivery/zones/:id/partners/:partnerId
 *   If your server.js mounts adminDeliveryRoutes.js under a different
 *   prefix, update the ZONES constant below — it's the only place the
 *   base path is defined.
 *
 * NOTE — "Assign partner" uses a plain delivery-partner-ID text field
 * rather than a searchable dropdown, because this page doesn't have the
 * verified response shape of adminDeliveryPartnerController.listDeliveryPartners.
 * Share that controller and I can wire up a proper search/select.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { FiRefreshCw, FiPlus, FiX, FiTrash2, FiEdit2, FiUserPlus, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import adminApi from "../api/adminApi";
import useDebounce from "../hooks/useDebounce";
import {
    Button, StatusBadge, Card, SearchBar,
    EmptyState, Skeleton, Pagination,
} from "../components/ui";

const ZONES = "/admin/delivery/zones";

const STATUSES = ["active", "inactive", "suspended", "expansion_in_progress"];
const STATUS_LABELS = {
    active: "Active", inactive: "Inactive", suspended: "Suspended", expansion_in_progress: "Expansion",
};
const PREFERENCES = ["primary", "secondary"];

const toArr = (str) => (str || "").split(",").map((s) => s.trim()).filter(Boolean);
const numOrDef = (v, def) => { const n = Number(v); return isNaN(n) ? def : n; };

const emptyForm = () => ({
    name: "", code: "", city: "", district: "", state: "",
    pincodes: "", areas: "",
    minDeliveryPartners: 3, optimalDeliveryPartners: 5,
    standardDeliveryTime: 45, expressDeliveryTime: 30, maxDeliveryDistance: 5,
    baseDeliveryCharge: 40, perKmCharge: 5, peakHourMultiplier: 1.5,
    minOrderValue: 0, maxOrderValue: "",
    adminNotes: "",
});

const formToPayload = (f) => ({
    name: f.name.trim(),
    code: f.code.trim().toUpperCase(),
    city: f.city.trim(),
    district: f.district.trim(),
    state: f.state.trim(),
    pincodes: toArr(f.pincodes),
    areas: toArr(f.areas),
    minDeliveryPartners: numOrDef(f.minDeliveryPartners, 3),
    optimalDeliveryPartners: numOrDef(f.optimalDeliveryPartners, 5),
    deliveryFeatures: {
        standardDeliveryTime: numOrDef(f.standardDeliveryTime, 45),
        expressDeliveryTime: numOrDef(f.expressDeliveryTime, 30),
        maxDeliveryDistance: numOrDef(f.maxDeliveryDistance, 5),
        baseDeliveryCharge: numOrDef(f.baseDeliveryCharge, 40),
        perKmCharge: numOrDef(f.perKmCharge, 5),
        peakHourMultiplier: numOrDef(f.peakHourMultiplier, 1.5),
    },
    restrictions: {
        minOrderValue: numOrDef(f.minOrderValue, 0),
        maxOrderValue: f.maxOrderValue === "" ? null : numOrDef(f.maxOrderValue, null),
    },
    adminNotes: f.adminNotes.trim(),
});

const zoneToForm = (z) => ({
    name: z.name || "", code: z.code || "", city: z.city || "",
    district: z.district || "", state: z.state || "",
    pincodes: (z.pincodes || []).join(", "),
    areas: (z.areas || []).join(", "),
    minDeliveryPartners: z.minDeliveryPartners ?? 3,
    optimalDeliveryPartners: z.optimalDeliveryPartners ?? 5,
    standardDeliveryTime: z.deliveryFeatures?.standardDeliveryTime ?? 45,
    expressDeliveryTime: z.deliveryFeatures?.expressDeliveryTime ?? 30,
    maxDeliveryDistance: z.deliveryFeatures?.maxDeliveryDistance ?? 5,
    baseDeliveryCharge: z.deliveryFeatures?.baseDeliveryCharge ?? 40,
    perKmCharge: z.deliveryFeatures?.perKmCharge ?? 5,
    peakHourMultiplier: z.deliveryFeatures?.peakHourMultiplier ?? 1.5,
    minOrderValue: z.restrictions?.minOrderValue ?? 0,
    maxOrderValue: z.restrictions?.maxOrderValue ?? "",
    adminNotes: z.adminNotes || "",
});

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

const StatCard = ({ label, count }) => (
    <Card padded style={{ minWidth: 140 }}>
        <div style={{ fontSize: 11, color: "var(--adm-text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--adm-text-primary)", marginTop: 4 }}>{count}</div>
    </Card>
);

const Field = ({ label, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-text-secondary)", textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</label>
        {children}
    </div>
);

const inputStyle = {
    padding: "8px 10px", fontSize: 13, borderRadius: "var(--adm-radius-md)",
    border: "1px solid var(--adm-border)", background: "var(--adm-surface)",
    color: "var(--adm-text-primary)", width: "100%", fontFamily: "inherit", boxSizing: "border-box",
};

/* ─────────────────────────── ZONE FORM (create + edit share this) ─────────────────────────── */

const ZoneForm = ({ form, setForm }) => {
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Zone name *"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="e.g. Lucknow South" /></Field>
            <Field label="Zone code *"><input style={inputStyle} value={form.code} onChange={set("code")} placeholder="e.g. LKO_SOUTH_01" /></Field>
            <Field label="City *"><input style={inputStyle} value={form.city} onChange={set("city")} placeholder="e.g. Lucknow" /></Field>

            <Field label="District"><input style={inputStyle} value={form.district} onChange={set("district")} /></Field>
            <Field label="State"><input style={inputStyle} value={form.state} onChange={set("state")} /></Field>
            <div />

            <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Pincodes (comma separated)">
                    <input style={inputStyle} value={form.pincodes} onChange={set("pincodes")} placeholder="226001, 226002, 226003" />
                </Field>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Areas / localities (comma separated)">
                    <input style={inputStyle} value={form.areas} onChange={set("areas")} placeholder="Gomti Nagar, Hazratganj" />
                </Field>
            </div>

            <Field label="Min partners"><input type="number" style={inputStyle} value={form.minDeliveryPartners} onChange={set("minDeliveryPartners")} /></Field>
            <Field label="Optimal partners"><input type="number" style={inputStyle} value={form.optimalDeliveryPartners} onChange={set("optimalDeliveryPartners")} /></Field>
            <div />

            <Field label="Standard delivery (min)"><input type="number" style={inputStyle} value={form.standardDeliveryTime} onChange={set("standardDeliveryTime")} /></Field>
            <Field label="Express delivery (min)"><input type="number" style={inputStyle} value={form.expressDeliveryTime} onChange={set("expressDeliveryTime")} /></Field>
            <Field label="Max delivery distance (km)"><input type="number" style={inputStyle} value={form.maxDeliveryDistance} onChange={set("maxDeliveryDistance")} /></Field>

            <Field label="Base delivery charge (₹)"><input type="number" style={inputStyle} value={form.baseDeliveryCharge} onChange={set("baseDeliveryCharge")} /></Field>
            <Field label="Per-km charge (₹)"><input type="number" style={inputStyle} value={form.perKmCharge} onChange={set("perKmCharge")} /></Field>
            <Field label="Peak hour multiplier"><input type="number" step="0.1" style={inputStyle} value={form.peakHourMultiplier} onChange={set("peakHourMultiplier")} /></Field>

            <Field label="Min order value (₹)"><input type="number" style={inputStyle} value={form.minOrderValue} onChange={set("minOrderValue")} /></Field>
            <Field label="Max order value (₹, blank = no limit)"><input type="number" style={inputStyle} value={form.maxOrderValue} onChange={set("maxOrderValue")} /></Field>
            <div />

            <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Admin notes">
                    <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.adminNotes} onChange={set("adminNotes")} />
                </Field>
            </div>
        </div>
    );
};

/* ─────────────────────────── CREATE ZONE MODAL ─────────────────────────── */

const CreateZoneModal = ({ onClose, onCreated, showMsg }) => {
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!form.name.trim() || !form.code.trim() || !form.city.trim()) {
            showMsg("Name, code and city are required", "error");
            return;
        }
        setSaving(true);
        try {
            await adminApi.post(ZONES, formToPayload(form));
            showMsg("Zone created", "success");
            onCreated();
            onClose();
        } catch (err) {
            showMsg(err?.response?.data?.message || "Failed to create zone", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9998,
                display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto",
            }}
            onClick={onClose}
        >
            <div style={{ width: "min(760px, 100%)" }} onClick={(e) => e.stopPropagation()}>
                <Card padded style={{ background: "var(--adm-surface)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--adm-text-primary)" }}>New Delivery Zone</div>
                        <button
                            onClick={onClose}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-muted)" }}
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                    <ZoneForm form={form} setForm={setForm} />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" loading={saving} onClick={submit}>Create Zone</Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

/* ─────────────────────────── PARTNER ROW ─────────────────────────── */

const PartnerRow = ({ partner, onRemove, removing }) => {
    const p = partner.deliveryBoyId || {};
    const id = typeof p === "object" ? p._id : p;
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border-soft)",
            borderRadius: "var(--adm-radius-md)", padding: "9px 12px",
        }}>
            <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: p.isOnline ? "var(--adm-success)" : "var(--adm-muted)", flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{p.name || id || "Unknown rider"}</div>
                <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>
                    {p.phone || "—"} · {partner.preference || "primary"} · {partner.status || "active"}
                    {p.rating ? ` · ★ ${p.rating}` : ""}
                </div>
            </div>
            <button
                onClick={() => onRemove(id)}
                disabled={removing}
                title="Remove from zone"
                style={{
                    width: 28, height: 28, borderRadius: "var(--adm-radius-sm)", border: "1px solid var(--adm-border)",
                    background: "var(--adm-surface)", color: "var(--adm-danger)", cursor: removing ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", opacity: removing ? .5 : 1, flexShrink: 0,
                }}
            >
                <FiTrash2 size={13} />
            </button>
        </div>
    );
};

/* ─────────────────────────── EXPANDED ZONE ROW ─────────────────────────── */

const ZoneExpanded = ({ zoneId, showMsg, onZoneUpdated }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [assignId, setAssignId] = useState("");
    const [assignPref, setAssignPref] = useState("primary");
    const [assigning, setAssigning] = useState(false);
    const [removingId, setRemovingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await adminApi.get(`${ZONES}/${zoneId}`);
            setDetail(data.data);
            setForm(zoneToForm(data.data));
        } catch {
            showMsg("Failed to load zone details", "error");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoneId]);

    useEffect(() => { load(); }, [load]);

    const saveEdit = async () => {
        setSaving(true);
        try {
            await adminApi.patch(`${ZONES}/${zoneId}`, formToPayload(form));
            showMsg("Zone updated", "success");
            setEditing(false);
            load();
            onZoneUpdated();
        } catch (err) {
            showMsg(err?.response?.data?.message || "Failed to update zone", "error");
        } finally {
            setSaving(false);
        }
    };

    const assignPartner = async () => {
        if (!assignId.trim()) { showMsg("Enter a delivery partner ID", "error"); return; }
        setAssigning(true);
        try {
            await adminApi.post(`${ZONES}/${zoneId}/assign-partner`, { deliveryBoyId: assignId.trim(), preference: assignPref });
            showMsg("Partner assigned", "success");
            setAssignId("");
            load();
            onZoneUpdated();
        } catch (err) {
            showMsg(err?.response?.data?.message || "Failed to assign partner", "error");
        } finally {
            setAssigning(false);
        }
    };

    const removePartner = async (partnerId) => {
        if (!window.confirm("Remove this partner from the zone?")) return;
        setRemovingId(partnerId);
        try {
            await adminApi.delete(`${ZONES}/${zoneId}/partners/${partnerId}`);
            showMsg("Partner removed", "success");
            load();
            onZoneUpdated();
        } catch (err) {
            showMsg(err?.response?.data?.message || "Failed to remove partner", "error");
        } finally {
            setRemovingId(null);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: "20px 24px", background: "var(--adm-bg)", borderTop: "1px solid var(--adm-border-soft)" }}>
                <Skeleton height={120} />
            </div>
        );
    }
    if (!detail) return null;

    return (
        <div style={{ background: "var(--adm-bg)", borderTop: "1px solid var(--adm-border-soft)", padding: "20px 24px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
                {/* Left: info / edit */}
                <Card padded>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>Zone details</div>
                        {!editing ? (
                            <Button size="sm" variant="secondary" icon={FiEdit2} onClick={() => setEditing(true)}>Edit</Button>
                        ) : (
                            <div style={{ display: "flex", gap: 8 }}>
                                <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setForm(zoneToForm(detail)); }}>Cancel</Button>
                                <Button size="sm" variant="primary" loading={saving} onClick={saveEdit}>Save</Button>
                            </div>
                        )}
                    </div>

                    {editing ? (
                        <ZoneForm form={form} setForm={setForm} />
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            {[
                                ["District", detail.district || "—"],
                                ["State", detail.state || "—"],
                                ["Pincodes", (detail.pincodes || []).join(", ") || "—"],
                                ["Areas", (detail.areas || []).join(", ") || "—"],
                                ["Min / Optimal partners", `${detail.minDeliveryPartners ?? "—"} / ${detail.optimalDeliveryPartners ?? "—"}`],
                                ["Standard / Express time", `${detail.deliveryFeatures?.standardDeliveryTime ?? "—"} / ${detail.deliveryFeatures?.expressDeliveryTime ?? "—"} min`],
                                ["Base / per-km charge", `₹${detail.deliveryFeatures?.baseDeliveryCharge ?? "—"} + ₹${detail.deliveryFeatures?.perKmCharge ?? "—"}/km`],
                                ["Order value range", `₹${detail.restrictions?.minOrderValue ?? 0} – ${detail.restrictions?.maxOrderValue ?? "no limit"}`],
                                ["On-time rate", `${detail.demand?.onTimeDeliveryRate ?? "—"}%`],
                                ["Avg daily orders", detail.demand?.averageDailyOrders ?? "—"],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <div style={{ fontSize: 10, color: "var(--adm-muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                                    <div style={{ fontSize: 13, color: "var(--adm-text-primary)", fontWeight: 600 }}>{value}</div>
                                </div>
                            ))}
                            {detail.adminNotes && (
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <div style={{ fontSize: 10, color: "var(--adm-muted)", fontWeight: 700, textTransform: "uppercase" }}>Notes</div>
                                    <div style={{ fontSize: 13, color: "var(--adm-text-primary)" }}>{detail.adminNotes}</div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Right: partners */}
                <Card padded>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", marginBottom: 10 }}>
                        Assigned partners ({(detail.assignedPartners || []).length})
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", marginBottom: 12 }}>
                        {(detail.assignedPartners || []).length === 0 ? (
                            <div style={{ fontSize: 12, color: "var(--adm-muted)" }}>No partners assigned yet.</div>
                        ) : (
                            detail.assignedPartners.map((p, i) => (
                                <PartnerRow
                                    key={p.deliveryBoyId?._id || p.deliveryBoyId || i}
                                    partner={p}
                                    onRemove={removePartner}
                                    removing={removingId === (p.deliveryBoyId?._id || p.deliveryBoyId)}
                                />
                            ))
                        )}
                    </div>

                    <div style={{ borderTop: "1px solid var(--adm-border-soft)", paddingTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-text-secondary)", textTransform: "uppercase", marginBottom: 6 }}>
                            Assign a partner
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                            <input
                                style={{ ...inputStyle, flex: 1 }}
                                placeholder="Delivery partner ID"
                                value={assignId}
                                onChange={(e) => setAssignId(e.target.value)}
                            />
                            <select
                                className="adm-field-select"
                                style={{ ...inputStyle, width: 110 }}
                                value={assignPref}
                                onChange={(e) => setAssignPref(e.target.value)}
                            >
                                {PREFERENCES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <Button size="sm" variant="primary" icon={FiUserPlus} loading={assigning} onClick={assignPartner}>Assign</Button>
                        </div>
                        <div style={{ fontSize: 10, color: "var(--adm-muted)", marginTop: 4 }}>
                            Paste the delivery partner's ID from the Delivery Boys page.
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

/* ─────────────────────────── MAIN COMPONENT ─────────────────────────── */

const AdminZone = () => {
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ text: "", type: "" });
    const [status, setStatus] = useState("active");
    const [cityInput, setCityInput] = useState("");
    const city = useDebounce(cityInput, 380);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [statCounts, setStatCounts] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const msgTimer = useRef(null);

    const showMsg = (text, type = "info") => {
        clearTimeout(msgTimer.current);
        setMsg({ text, type });
        msgTimer.current = setTimeout(() => setMsg({ text: "", type: "" }), 4000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20, status });
            if (city) params.append("city", city);
            const { data } = await adminApi.get(`${ZONES}?${params}`);
            setZones(data.data || []);
            setTotal(data.pagination?.total || 0);
            setTotalPages(data.pagination?.pages || 1);
        } catch {
            showMsg("Failed to load zones", "error");
        } finally {
            setLoading(false);
        }
    }, [page, status, city]);

    const loadStatCounts = useCallback(async () => {
        try {
            const results = await Promise.all(
                STATUSES.map((s) => adminApi.get(`${ZONES}?${new URLSearchParams({ page: 1, limit: 1, status: s })}`))
            );
            const counts = {};
            STATUSES.forEach((s, i) => { counts[s] = results[i].data?.pagination?.total || 0; });
            setStatCounts(counts);
        } catch {
            // Stat cards are a nice-to-have; a failure here shouldn't block the page.
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { loadStatCounts(); }, [loadStatCounts]);
    useEffect(() => { setPage(1); }, [city, status]);

    const refreshAll = () => { load(); loadStatCounts(); };

    const quickStatusChange = async (zoneId, newStatus) => {
        try {
            await adminApi.patch(`${ZONES}/${zoneId}`, { status: newStatus });
            showMsg(`Zone marked ${STATUS_LABELS[newStatus] || newStatus}`, "success");
            refreshAll();
        } catch (err) {
            showMsg(err?.response?.data?.message || "Failed to update status", "error");
        }
    };

    return (
        <div style={{ padding: 28, fontFamily: "var(--adm-font-sans)", background: "var(--adm-bg)", minHeight: "100vh" }}>
            <Toast msg={msg} />
            {showCreate && (
                <CreateZoneModal
                    onClose={() => setShowCreate(false)}
                    onCreated={refreshAll}
                    showMsg={showMsg}
                />
            )}

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: "var(--adm-radius-md)", background: "var(--adm-primary)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                        }}>🗺️</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", letterSpacing: "-.4px" }}>
                            Delivery Zones
                        </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--adm-text-secondary)", marginLeft: 46 }}>
                        Manage service areas, coverage, and delivery partner assignments
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="secondary" icon={FiRefreshCw} onClick={refreshAll}>Refresh</Button>
                    <Button variant="primary" icon={FiPlus} onClick={() => setShowCreate(true)}>New Zone</Button>
                </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 20 }}>
                {STATUSES.map((s) => (
                    <StatCard key={s} label={STATUS_LABELS[s]} count={statCounts[s] ?? "—"} />
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", background: "var(--adm-surface)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: 4, gap: 4 }}>
                    {STATUSES.map((s) => {
                        const isActive = status === s;
                        return (
                            <button
                                key={s}
                                onClick={() => setStatus(s)}
                                style={{
                                    padding: "5px 12px", borderRadius: "var(--adm-radius-sm)",
                                    background: isActive ? "var(--adm-text-primary)" : "transparent",
                                    color: isActive ? "var(--adm-text-on-accent)" : "var(--adm-text-secondary)",
                                    border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                }}
                            >
                                {STATUS_LABELS[s]}
                            </button>
                        );
                    })}
                </div>
                <div style={{ marginLeft: "auto", width: 240 }}>
                    <SearchBar value={cityInput} onChange={setCityInput} placeholder="Filter by city…" />
                </div>
            </div>

            {/* Zones list */}
            <Card padded={false} style={{ overflow: "hidden" }}>
                <div style={{
                    padding: "14px 22px", background: "var(--adm-surface-alt)", borderBottom: "1px solid var(--adm-border-soft)",
                    display: "flex", alignItems: "center", gap: 10,
                }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-text-primary)" }}>Zones</span>
                    <span style={{
                        background: "var(--adm-surface)", color: "var(--adm-text-secondary)", fontSize: 11, fontWeight: 700,
                        padding: "2px 8px", borderRadius: "var(--adm-radius-full)",
                    }}>{total}</span>
                </div>

                {loading ? (
                    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} />)}
                    </div>
                ) : zones.length === 0 ? (
                    <EmptyState title="No zones found" />
                ) : (
                    zones.map((zone, idx) => {
                        const isExpanded = expandedId === zone._id;
                        return (
                            <div key={zone._id} style={{ borderBottom: idx < zones.length - 1 ? "1px solid var(--adm-border-soft)" : "none" }}>
                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : zone._id)}
                                    style={{
                                        display: "grid", gridTemplateColumns: "1fr 120px 110px 140px auto",
                                        alignItems: "center", cursor: "pointer",
                                        background: isExpanded ? "var(--adm-surface-alt)" : "var(--adm-surface)",
                                    }}
                                >
                                    <div style={{ padding: "14px 22px" }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{zone.name}</div>
                                        <div style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 2 }}>{zone.code} · {zone.city}</div>
                                    </div>
                                    <div style={{ padding: "14px 8px" }}><StatusBadge status={zone.status} /></div>
                                    <div style={{ padding: "14px 8px", fontSize: 12, color: "var(--adm-text-secondary)" }}>
                                        {(zone.pincodes || []).length} pincodes
                                    </div>
                                    <div style={{ padding: "14px 8px", fontSize: 12, color: "var(--adm-text-secondary)" }}>
                                        {(zone.assignedPartners || []).length} / {zone.optimalDeliveryPartners ?? "—"} partners
                                    </div>
                                    <div
                                        style={{ padding: "14px 22px 14px 8px", display: "flex", gap: 6, justifyContent: "flex-end" }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {zone.status !== "active" && (
                                            <Button size="sm" variant="secondary" onClick={() => quickStatusChange(zone._id, "active")}>Activate</Button>
                                        )}
                                        {zone.status === "active" && (
                                            <Button size="sm" variant="danger" onClick={() => quickStatusChange(zone._id, "suspended")}>Suspend</Button>
                                        )}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <ZoneExpanded zoneId={zone._id} showMsg={showMsg} onZoneUpdated={refreshAll} />
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

export default AdminZone;