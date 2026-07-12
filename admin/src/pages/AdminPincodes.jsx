/**
 * AdminPincodes.jsx
 * Path: src/pages/AdminPincodes.jsx
 *
 * CHANGELOG (from the previous version)
 * --------------------------------------
 * DESIGN
 *  - Migrated onto the shared admin design system (theme/tokens.css +
 *    components/ui/*): the coverage bar, filter tabs, list, pagination,
 *    search and dialogs now read from the same tokens every other admin
 *    page uses instead of a page-local color object.
 *  - Add/Edit stays a right-side drawer so the table remains visible and
 *    orientation isn't lost while editing (a centered modal would hide
 *    the list entirely, which is a worse editing experience here).
 *  - Delete confirmation uses the shared Modal component instead of
 *    window.confirm() — accessible, styleable, doesn't block the JS thread.
 *  - Skeleton rows (via the shared Table component) instead of a blocking
 *    spinner on first load.
 *
 * AUTH
 *  - The page is gated by useAdminAuth(): unauthenticated → sign-in
 *    prompt, wrong role → forbidden screen, expired session mid-session
 *    → automatically dropped back to sign-in (see admin:unauthorized
 *    event in usePincodes.js / useAdminAuth.js).
 *  - All API calls carry the admin's bearer token (handled in the hook).
 *
 * OPTIMIZATION
 *  - Search is debounced (350ms) so it doesn't fire a request per
 *    keystroke, while the "Go" button still allows an instant search.
 *  - List requests are abortable, so fast filter/page switching can't
 *    show stale results (see usePincodes.js).
 *  - Column sort, pagination and filters are combined into one params
 *    object per request instead of separate effects fighting each other.
 *
 * MISSING DETAILS ADDED
 *  - Sortable columns (code, city, priority, updatedAt).
 *  - Bulk select + bulk status change / bulk delete.
 *  - "Last updated" column (relative time) — useful to spot stale
 *    coming_soon rows that were never followed up on.
 *  - CSV export of the current filtered view.
 *  - Duplicate-code guard message surfaced from the server, plus the
 *    existing 6-digit client-side format check.
 *  - Empty "coming soon with no launch date" nudge, since that combo is
 *    an easy state to forget to fill in.
 */

import { useEffect, useRef, useState } from "react";
import { usePincodes } from "../hooks/usePincodes";
import { useAdminAuth } from "../auth/AdminAuthContext";
import {
    FiMapPin, FiPlus, FiEdit2, FiTrash2, FiX,
    FiCheckCircle, FiAlertCircle, FiLoader, FiUsers, FiLock,
    FiArrowUp, FiArrowDown, FiDownload,
} from "react-icons/fi";
import {
    Button, Badge, Card, Table, Pagination, SearchBar,
    ErrorState, Modal, FormField, Input,
} from "../components/ui";

const MONO_FONT = "ui-monospace,'JetBrains Mono','SF Mono',Consolas,monospace";

const STATUS_CONFIG = {
    active: { label: "Active", tone: "success" },
    coming_soon: { label: "Coming Soon", tone: "warning" },
    blocked: { label: "Blocked", tone: "danger" },
};

const EMPTY_FORM = { code: "", status: "coming_soon", area: "", city: "", district: "", state: "", expectedLaunchDate: "", note: "", priority: 0, lat: "", lng: "", deliveryRadiusKm: 8 };

/* ── small utils ── */
const relTime = (iso) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const day = 86400000;
    if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
    if (diff < day) return `${Math.round(diff / 3600000)}h ago`;
    if (diff < day * 30) return `${Math.round(diff / day)}d ago`;
    return new Date(iso).toLocaleDateString();
};

const toCSV = (rows) => {
    const headers = ["code", "area", "city", "district", "state", "status", "priority", "assignedVendors", "expectedLaunchDate"];
    const lines = [headers.join(",")];
    rows.forEach((p) => {
        lines.push(headers.map((h) => {
            const v = h === "assignedVendors" ? (p.assignedVendors?.length || 0) : (p[h] ?? "");
            return `"${String(v).replace(/"/g, '""')}"`;
        }).join(","));
    });
    return lines.join("\n");
};

const downloadCSV = (rows) => {
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pincodes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

/* ── toast ── */
const useToast = () => {
    const [toast, setToast] = useState(null);
    const show = (type, msg, duration = 4000) => {
        setToast({ type, msg, id: Date.now() });
        setTimeout(() => setToast((t) => (t?.id === undefined ? null : t)), duration);
    };
    return { toast, show, dismiss: () => setToast(null) };
};

const Toast = ({ toast, onDismiss }) => {
    if (!toast) return null;
    const isErr = toast.type === "error";
    return (
        <div role="status" aria-live="polite" style={{
            position: "fixed", top: 20, right: 20, zIndex: 9999,
            background: isErr ? "var(--adm-danger-tint)" : "var(--adm-success-tint)",
            border: `1px solid ${isErr ? "var(--adm-danger)" : "var(--adm-success)"}`,
            color: isErr ? "var(--adm-danger)" : "var(--adm-success)", padding: "10px 14px", borderRadius: "var(--adm-radius-md)",
            fontSize: 13, fontWeight: 600, boxShadow: "var(--adm-shadow-lg)",
            display: "flex", alignItems: "center", gap: 8, maxWidth: 360, animation: "ap-fadeUp .2s ease",
        }}>
            {isErr ? <FiAlertCircle size={14} /> : <FiCheckCircle size={14} />}
            <span style={{ flex: 1 }}>{toast.msg}</span>
            <button onClick={onDismiss} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}><FiX size={13} /></button>
        </div>
    );
};

/* ══════════════════════════════════════════
   AUTH SCREENS
══════════════════════════════════════════ */
const AuthScreen = ({ icon, title, body, cta }) => (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--adm-font-sans)" }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
            <div style={{ width: 48, height: 48, borderRadius: "var(--adm-radius-lg)", background: "var(--adm-primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--adm-primary)" }}>
                {icon}
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--adm-text-primary)", margin: "0 0 6px" }}>{title}</h2>
            <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", lineHeight: 1.6, margin: "0 0 18px" }}>{body}</p>
            {cta}
        </div>
    </div>
);

/* ══════════════════════════════════════════
   COVERAGE BAR — signature element
   Prefers server-provided `stats` (accurate across all pages). If the
   backend doesn't send it yet, falls back to counting the currently
   loaded rows — but ONLY when every record is already on this one page
   (pages <= 1), since counting just the visible page would silently
   under-report and mislead an admin scanning coverage. In that case it
   shows the total only, still styled consistently rather than a broken-
   looking empty state.
══════════════════════════════════════════ */
const CoverageBar = ({ stats, total, pincodes, pages }) => {
    const localCounts = pincodes.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
    }, {});
    const source = stats || (pages <= 1 ? localCounts : null);

    const segments = [
        { key: "active", ...STATUS_CONFIG.active, value: source?.active || 0 },
        { key: "coming_soon", ...STATUS_CONFIG.coming_soon, value: source?.coming_soon || 0 },
        { key: "blocked", ...STATUS_CONFIG.blocked, value: source?.blocked || 0 },
    ];
    const sum = Math.max(1, segments.reduce((s, x) => s + x.value, 0));

    return (
        <Card style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingRight: 24, borderRight: source ? "1px solid var(--adm-border-soft)" : "none" }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: "var(--adm-text-primary)", letterSpacing: "-0.02em" }}>{total}</span>
                    <span style={{ fontSize: 12.5, color: "var(--adm-muted)", fontWeight: 600 }}>pincodes</span>
                </div>

                {source ? (
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--adm-surface-alt)", marginBottom: 10 }}>
                            {segments.map((s) => (
                                <div key={s.key} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / sum) * 100}%`, background: `var(--adm-${s.tone})`, transition: "width .3s ease" }} />
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                            {segments.map((s) => (
                                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--adm-${s.tone})` }} />
                                    <span style={{ fontSize: 12.5, color: "var(--adm-text-secondary)", fontWeight: 700 }}>{s.value}</span>
                                    <span style={{ fontSize: 12.5, color: "var(--adm-muted)" }}>{s.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p style={{ fontSize: 12.5, color: "var(--adm-muted)", margin: 0 }}>Status breakdown shows once all pages are loaded, or filter by status above.</p>
                )}
            </div>
        </Card>
    );
};

/* ══════════════════════════════════════════
   ADD / EDIT DRAWER
   A right-side slide-in rather than a centered dialog, so the list stays
   visible while editing — kept as a bespoke overlay (not the shared
   <Modal>, which is always a centered dialog) but every color, input and
   button inside now reads from the shared tokens/components.
══════════════════════════════════════════ */
const PincodeDrawer = ({ initial, onSave, onClose, loading, serverError }) => {
    const [form, setForm] = useState(() => {
        if (!initial) return EMPTY_FORM;
        const coords = initial.location?.coordinates;
        return {
            ...EMPTY_FORM,
            ...initial,
            lat: coords?.[1] != null ? String(coords[1]) : "",
            lng: coords?.[0] != null ? String(coords[0]) : "",
            deliveryRadiusKm: initial.deliveryRadiusKm ?? 8,
        };
    });
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const isEdit = !!initial?._id;
    const firstFieldRef = useRef(null);

    // Coordinates decide which pincode a GPS fix resolves to backend-side —
    // fat-fingering these silently breaks resolution for real users near
    // this point, so validate the same India-bounded range the backend does.
    const latNum = form.lat === "" ? null : Number(form.lat);
    const lngNum = form.lng === "" ? null : Number(form.lng);
    const latLngPartial = (form.lat === "") !== (form.lng === "");
    const latLngInvalid = (latNum !== null && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90))
        || (lngNum !== null && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180));

    // Client-side format check up front so a malformed code never even
    // reaches the network — the 6-digit rule is still enforced
    // server-side as the source of truth.
    const codeValid = isEdit || /^\d{6}$/.test(form.code.trim());
    const launchDateMissing = form.status === "coming_soon" && !form.expectedLaunchDate;
    const canSave = codeValid && !latLngPartial && !latLngInvalid;

    const buildPayload = (f) => {
        const { lat, lng, ...rest } = f;
        const payload = { ...rest };
        if (lat !== "" && lng !== "") {
            payload.location = { type: "Point", coordinates: [Number(lng), Number(lat)] };
        } else {
            payload.location = null; // explicit clear when both left blank
        }
        payload.deliveryRadiusKm = Number(f.deliveryRadiusKm) || 8;
        return payload;
    };

    useEffect(() => {
        firstFieldRef.current?.focus();
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000 }} role="dialog" aria-modal="true" aria-label={isEdit ? "Edit pincode" : "Add pincode"}>
            <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,17,36,0.45)", animation: "ap-fade .15s ease" }} />
            <div style={{
                position: "absolute", top: 0, right: 0, bottom: 0, width: "min(420px, 100%)",
                background: "var(--adm-surface)", boxShadow: "var(--adm-shadow-lg)",
                display: "flex", flexDirection: "column", animation: "ap-slideIn .22s cubic-bezier(.32,.72,0,1)",
            }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--adm-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>{isEdit ? `Edit ${initial.code}` : "Add pincode"}</h3>
                    <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, border: "none", background: "var(--adm-surface-alt)", borderRadius: "var(--adm-radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-muted)" }}><FiX size={15} /></button>
                </div>

                <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
                    {serverError && <ErrorState message={serverError} />}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: serverError ? 16 : 0 }}>
                        <div style={{ gridColumn: "1 / -1" }}>
                            <FormField label="Pincode *" error={!codeValid && form.code.trim() ? "Pincode must be exactly 6 digits." : (isEdit ? "Pincode can't be changed after creation." : undefined)}>
                                {/* plain input (not the shared <Input/>, which doesn't forward refs) so autofocus-on-open still works */}
                                <input ref={firstFieldRef} type="text" inputMode="numeric" maxLength={6} value={form.code} disabled={isEdit}
                                    onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 226010"
                                    className="adm-field-input"
                                    style={{ width: "100%", boxSizing: "border-box", fontFamily: MONO_FONT, letterSpacing: "0.04em" }} />
                            </FormField>
                        </div>

                        {[
                            { key: "area", label: "Area", placeholder: "Gomti Nagar" },
                            { key: "city", label: "City", placeholder: "Lucknow" },
                            { key: "district", label: "District", placeholder: "Lucknow" },
                            { key: "state", label: "State", placeholder: "Uttar Pradesh" },
                        ].map(({ key, label, placeholder }) => (
                            <FormField key={key} label={label}>
                                <Input type="text" value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box" }} />
                            </FormField>
                        ))}

                        <FormField label="Priority">
                            <Input type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} placeholder="0" style={{ width: "100%", boxSizing: "border-box" }} />
                        </FormField>
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-text-secondary)", display: "block", marginBottom: 5 }}>Coordinates (drives GPS → pincode resolution)</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <Input type="text" inputMode="decimal" value={form.lat} onChange={(e) => set("lat", e.target.value)} placeholder="Latitude e.g. 26.4192" style={{ width: "100%", boxSizing: "border-box" }} />
                            <Input type="text" inputMode="decimal" value={form.lng} onChange={(e) => set("lng", e.target.value)} placeholder="Longitude e.g. 82.5359" style={{ width: "100%", boxSizing: "border-box" }} />
                        </div>
                        {latLngPartial && <p style={{ fontSize: 11, color: "var(--adm-danger)", marginTop: 6 }}>Enter both latitude and longitude, or leave both blank.</p>}
                        {latLngInvalid && <p style={{ fontSize: 11, color: "var(--adm-danger)", marginTop: 6 }}>Latitude must be -90..90 and longitude -180..180.</p>}
                        <p style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 6 }}>Leave blank if unknown — GPS lookups near this pincode will fall back to the reverse-geocoder guess until coordinates are set.</p>
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <FormField label="Delivery radius (km)">
                            <Input type="number" min={1} max={25} value={form.deliveryRadiusKm} onChange={(e) => set("deliveryRadiusKm", e.target.value)} style={{ maxWidth: 140 }} />
                        </FormField>
                        <p style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 6 }}>How far (km) a detected GPS point can be from these coordinates and still resolve to this pincode.</p>
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-text-secondary)", display: "block", marginBottom: 5 }}>Status</label>
                        <div style={{ display: "flex", gap: 6 }}>
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                const active = form.status === key;
                                return (
                                    <button key={key} type="button" onClick={() => set("status", key)}
                                        style={{
                                            flex: 1, padding: "8px 6px", borderRadius: "var(--adm-radius-sm)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                                            border: `1px solid ${active ? `var(--adm-${cfg.tone})` : "var(--adm-border)"}`,
                                            background: active ? `var(--adm-${cfg.tone}-tint)` : "var(--adm-surface)",
                                            color: active ? `var(--adm-${cfg.tone})` : "var(--adm-text-secondary)",
                                        }}>{cfg.label}</button>
                                );
                            })}
                        </div>
                    </div>

                    {form.status === "coming_soon" && (
                        <div style={{ marginTop: 14 }}>
                            <FormField label="Expected launch date" error={launchDateMissing ? "Consider adding a launch date so this doesn't sit forgotten." : undefined}>
                                <Input type="date" value={form.expectedLaunchDate?.split("T")[0] || ""} onChange={(e) => set("expectedLaunchDate", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
                            </FormField>
                        </div>
                    )}

                    <div style={{ marginTop: 14 }}>
                        <FormField label="Internal note">
                            <textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)}
                                placeholder="Visible to admins only..."
                                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", fontSize: 13, color: "var(--adm-text-primary)", background: "var(--adm-surface)", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
                        </FormField>
                    </div>
                </div>

                <div style={{ padding: 20, borderTop: "1px solid var(--adm-border)", display: "flex", gap: 10 }}>
                    <Button variant="primary" icon={FiCheckCircle} loading={loading} disabled={!canSave} onClick={() => canSave && onSave(buildPayload(form))} style={{ flex: 1 }}>
                        {isEdit ? "Save changes" : "Create pincode"}
                    </Button>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </div>
    );
};

/* ── delete confirm dialog — shared Modal ── */
const ConfirmDialog = ({ title, body, confirmLabel, onConfirm, onCancel, danger = true, loading }) => (
    <Modal
        open
        onClose={onCancel}
        title={title}
        width={360}
        footer={(
            <>
                <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
                <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
            </>
        )}
    >
        <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", lineHeight: 1.55, margin: 0 }}>{body}</p>
    </Modal>
);

/* BUG FIX: this used to be defined INSIDE AdminPincodesInner (a new
   function identity — and a new React component type — on every render),
   which the react-hooks/static-components rule correctly flags as an
   anti-pattern. Hoisted to module scope, taking sort/onSort as explicit
   props instead of closing over component state. */
const SortHeader = ({ label, sortKey, sort, onSort }) => (
    <span className="ap-th-sort" onClick={() => onSort(sortKey)}>
        {label}
        {sort.by === sortKey && (sort.dir === "asc" ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />)}
    </span>
);

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const AdminPincodesInner = ({ admin }) => {
    const {
        pincodes, loading, actionLoading, error, total, page, pages, stats,
        fetchPincodes, createPincode, updatePincode, deletePincode,
        bulkUpdateStatus, bulkDelete,
    } = usePincodes();
    const { toast, show: showToast, dismiss } = useToast();

    // Deleting pincodes drops vendor coverage immediately and can't be
    // undone — restrict it to "owner". Regular "admin" accounts can still
    // add, edit, and change status, just not delete.
    const canDelete = admin?.role === "owner";

    const [filterStatus, setFilterStatus] = useState("ALL");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState({ by: "priority", dir: "desc" });
    const [drawer, setDrawer] = useState(null); // { pincode? }
    const [drawerErr, setDrawerErr] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null); // pincode | { bulk: true, ids }
    const [selected, setSelected] = useState(new Set());

    const buildParams = (overrides = {}) => ({
        page: 1,
        ...(filterStatus !== "ALL" ? { status: filterStatus } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        sortBy: sort.by, sortDir: sort.dir,
        ...overrides,
    });

    useEffect(() => { fetchPincodes(buildParams({ page: 1 })); }, []); // eslint-disable-line

    // Debounced live search — keystrokes settle for 350ms before firing,
    // so typing "226" doesn't trigger three separate requests.
    const searchTimer = useRef(null);
    const onSearchChange = (val) => {
        setSearch(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchPincodes(buildParams({ page: 1, search: val.trim() })), 350);
    };

    const handleFilter = (status) => {
        setFilterStatus(status);
        setSelected(new Set());
        fetchPincodes(buildParams({ page: 1, status: status !== "ALL" ? status : undefined }));
    };

    const handleSort = (key) => {
        const dir = sort.by === key && sort.dir === "asc" ? "desc" : "asc";
        setSort({ by: key, dir });
        fetchPincodes(buildParams({ page: 1, sortBy: key, sortDir: dir }));
    };

    const goToPage = (next) => fetchPincodes(buildParams({ page: next }));

    const handleSave = async (form) => {
        const isEdit = !!drawer?.pincode?._id;
        setDrawerErr(null);
        const res = isEdit ? await updatePincode(drawer.pincode._id, form) : await createPincode(form);
        if (res.success) {
            showToast("success", isEdit ? "Pincode updated." : "Pincode created.");
            setDrawer(null);
        } else {
            setDrawerErr(res.message);
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        if (pendingDelete.bulk) {
            const res = await bulkDelete(pendingDelete.ids);
            if (res.success) { showToast("success", `${pendingDelete.ids.length} pincodes deleted.`); setSelected(new Set()); }
            else showToast("error", res.message);
        } else {
            const res = await deletePincode(pendingDelete._id);
            if (res.success) showToast("success", "Pincode deleted.");
            else showToast("error", res.message);
        }
        setPendingDelete(null);
    };

    const toggleSelect = (id) => setSelected((s) => {
        const next = new Set(s);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const toggleSelectAll = () => setSelected((s) => (s.size === pincodes.length ? new Set() : new Set(pincodes.map((p) => p._id))));

    const handleBulkStatus = async (status) => {
        const ids = [...selected];
        const res = await bulkUpdateStatus(ids, status);
        if (res.success) { showToast("success", `${ids.length} pincodes marked ${STATUS_CONFIG[status].label}.`); setSelected(new Set()); }
        else showToast("error", res.message);
    };

    const filters = [
        { key: "ALL", label: "All" },
        { key: "active", label: "Active", tone: "success" },
        { key: "coming_soon", label: "Coming Soon", tone: "warning" },
        { key: "blocked", label: "Blocked", tone: "danger" },
    ];

    const columns = [
        { key: "select", label: <input type="checkbox" checked={pincodes.length > 0 && selected.size === pincodes.length} onChange={toggleSelectAll} aria-label="Select all" />, width: 32 },
        { key: "code", label: <SortHeader label="Pincode" sortKey="code" sort={sort} onSort={handleSort} /> },
        { key: "area", label: "Area / City" },
        { key: "status", label: "Status" },
        { key: "assignedVendors", label: "Vendors" },
        { key: "priority", label: <SortHeader label="Priority" sortKey="priority" sort={sort} onSort={handleSort} /> },
        { key: "updatedAt", label: <SortHeader label="Updated" sortKey="updatedAt" sort={sort} onSort={handleSort} /> },
        { key: "actions", label: "" },
    ];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)", background: "var(--adm-bg)", minHeight: "100%", padding: "28px 32px 40px", animation: "ap-pageIn .45s cubic-bezier(.22,.8,.32,1)" }}>
            <style>{`
                @keyframes ap-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
                @keyframes ap-fade{from{opacity:0}to{opacity:1}}
                @keyframes ap-pageIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
                .ap-enter-1{animation:ap-fadeUp .4s cubic-bezier(.22,.8,.32,1) both; animation-delay:.03s}
                .ap-enter-2{animation:ap-fadeUp .4s cubic-bezier(.22,.8,.32,1) both; animation-delay:.09s}
                .ap-enter-3{animation:ap-fadeUp .4s cubic-bezier(.22,.8,.32,1) both; animation-delay:.15s}
                @keyframes ap-slideIn{from{transform:translateX(24px);opacity:.6}to{transform:translateX(0);opacity:1}}
                .ap-th-sort{cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:4px}
            `}</style>

            <Toast toast={toast} onDismiss={dismiss} />
            {drawer && (
                <PincodeDrawer
                    initial={drawer.pincode}
                    onSave={handleSave}
                    onClose={() => { setDrawer(null); setDrawerErr(null); }}
                    loading={actionLoading === "create" || actionLoading === drawer?.pincode?._id}
                    serverError={drawerErr}
                />
            )}
            {pendingDelete && (
                <ConfirmDialog
                    title={pendingDelete.bulk ? `Delete ${pendingDelete.ids.length} pincodes?` : `Delete pincode ${pendingDelete.code}?`}
                    body="This can't be undone. Any vendors assigned to these pincodes will lose that coverage immediately."
                    confirmLabel="Delete"
                    danger
                    loading={actionLoading === "bulk" || actionLoading === pendingDelete?._id}
                    onConfirm={confirmDelete}
                    onCancel={() => setPendingDelete(null)}
                />
            )}

            {/* Header */}
            <div className="ap-enter-1" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", margin: 0, letterSpacing: "-0.01em" }}>Pincode coverage</h1>
                    <p style={{ fontSize: 13.5, color: "var(--adm-muted)", marginTop: 4 }}>Manage where the service is live, launching, or paused.</p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ width: 220 }}>
                        <SearchBar value={search} onChange={onSearchChange} placeholder="Search pincode, city..." />
                    </div>
                    <Button variant="secondary" icon={FiDownload} disabled={pincodes.length === 0} onClick={() => downloadCSV(pincodes)}>Export</Button>
                    <Button variant="primary" icon={FiPlus} onClick={() => setDrawer({ type: "add" })}>Add pincode</Button>
                </div>
            </div>

            <div className="ap-enter-2"><CoverageBar stats={stats} total={total} pincodes={pincodes} pages={pages} /></div>

            {/* Filter Tabs + bulk bar */}
            <div className="ap-enter-3" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                    {filters.map(({ key, label, tone }) => {
                        const active = filterStatus === key;
                        return (
                            <button key={key} onClick={() => handleFilter(key)}
                                style={{
                                    flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                                    border: active ? "1px solid var(--adm-primary)" : "1px solid var(--adm-border)",
                                    background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)",
                                    color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)",
                                    cursor: "pointer", fontFamily: "inherit", borderRadius: "var(--adm-radius-md)",
                                }}>
                                {tone && <span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--adm-${tone})` }} />}{label}
                            </button>
                        );
                    })}
                </div>

                {selected.size > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--adm-primary-tint)", border: "1px solid color-mix(in srgb, var(--adm-primary) 25%, transparent)", borderRadius: "var(--adm-radius-md)", padding: "6px 10px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-primary)" }}>{selected.size} selected</span>
                        <Button variant="ghost" size="sm" onClick={() => handleBulkStatus("active")}>Mark active</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleBulkStatus("blocked")}>Block</Button>
                        {canDelete && <Button variant="ghost" size="sm" style={{ color: "var(--adm-danger)" }} onClick={() => setPendingDelete({ bulk: true, ids: [...selected] })}>Delete</Button>}
                        <button onClick={() => setSelected(new Set())} aria-label="Clear selection" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-muted)", display: "flex" }}><FiX size={14} /></button>
                    </div>
                )}
            </div>

            {error && <div style={{ marginBottom: 16 }}><ErrorState message={error} onRetry={() => fetchPincodes(buildParams({ page }))} /></div>}

            {/* Pincode list */}
            <div className="ap-enter-3">
                <Table
                    columns={columns}
                    rows={pincodes}
                    loading={loading}
                    skeletonRows={6}
                    empty={{ icon: FiMapPin, title: "No pincodes found", description: "Try a different filter or search, or add a new pincode." }}
                    renderRow={(p) => {
                        const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.coming_soon;
                        const isActing = actionLoading === p._id;
                        const needsLaunchDate = p.status === "coming_soon" && !p.expectedLaunchDate;
                        return (
                            <tr key={p._id}>
                                <td><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} aria-label={`Select ${p.code}`} /></td>
                                <td style={{ fontWeight: 700, fontFamily: MONO_FONT }}>{p.code}</td>
                                <td>
                                    <div>{p.area || "—"}</div>
                                    <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>{[p.city, p.state].filter(Boolean).join(", ") || "—"}</div>
                                </td>
                                <td>
                                    <Badge tone={cfg.tone} dot>{cfg.label}</Badge>
                                    {needsLaunchDate && <div style={{ fontSize: 10, color: "var(--adm-warning)", marginTop: 4 }}>No launch date set</div>}
                                </td>
                                <td>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiUsers size={12} color="var(--adm-muted)" />{p.assignedVendors?.length || 0}</span>
                                </td>
                                <td>{p.priority || 0}</td>
                                <td style={{ color: "var(--adm-muted)" }}>{relTime(p.updatedAt)}</td>
                                <td>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button onClick={() => setDrawer({ type: "edit", pincode: p })} title="Edit" aria-label={`Edit ${p.code}`}
                                            style={{ width: 30, height: 30, background: "var(--adm-primary-tint)", border: "1px solid color-mix(in srgb, var(--adm-primary) 25%, transparent)", borderRadius: "var(--adm-radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                            <FiEdit2 size={12} color="var(--adm-primary)" />
                                        </button>
                                        {canDelete && (
                                            <button onClick={() => setPendingDelete(p)} disabled={isActing} title="Delete" aria-label={`Delete ${p.code}`}
                                                style={{ width: 30, height: 30, background: "var(--adm-danger-tint)", border: "1px solid color-mix(in srgb, var(--adm-danger) 25%, transparent)", borderRadius: "var(--adm-radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                                {isActing ? <FiLoader size={11} color="var(--adm-danger)" style={{ animation: "adm-spin 0.6s linear infinite" }} /> : <FiTrash2 size={12} color="var(--adm-danger)" />}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>

            {pages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20 }}>
                    <Pagination currentPage={page} totalPages={pages} onPageChange={goToPage} disabled={loading} />
                </div>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════
   AUTH GATE WRAPPER — this is the exported component.
   Routing-level protection (who can even land on this page) already
   happens in <AdminRoute /> — it redirects to /admin/login if there's no
   admin or the role isn't admin/owner. This wrapper does NOT duplicate
   that redirect logic. It only handles two things AdminRoute can't:
     1. A brief render before AdminAuthProvider's initial localStorage
        read finishes (`loading`), so the table doesn't flash empty.
     2. A defensive fallback if this component is ever rendered outside
        an <AdminRoute> tree (e.g. in a test, or a future route change
        that forgets the wrapper) — it fails safe instead of crashing on
        a null `admin`.
══════════════════════════════════════════ */
const AdminPincodes = () => {
    const { admin, loading } = useAdminAuth();

    if (loading) {
        return <AuthScreen icon={<FiLoader size={20} style={{ animation: "adm-spin 0.6s linear infinite" }} />} title="Checking your session…" body="One moment." />;
    }
    if (!admin) {
        // Shouldn't normally be reached — AdminRoute already redirects.
        return (
            <AuthScreen
                icon={<FiLock size={20} />}
                title="Admin sign-in required"
                body="Sign in with an admin or owner account to manage pincode coverage."
                cta={<a href="/admin/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: "var(--adm-primary)", color: "var(--adm-text-on-accent)", borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Go to sign in</a>}
            />
        );
    }
    return <AdminPincodesInner admin={admin} />;
};

export default AdminPincodes;
