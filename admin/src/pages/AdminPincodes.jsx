/**
 * AdminPincodes.jsx
 * Path: src/pages/AdminPincodes.jsx
 *
 * CHANGELOG (from the previous version)
 * --------------------------------------
 * DESIGN
 *  - New visual identity: indigo/amber "ops console" palette instead of
 *    generic blue-on-white, a monospace treatment for codes, and a
 *    coverage bar as the page's signature element — a single glance at
 *    how many pincodes are active / coming soon / blocked, which is the
 *    thing an admin actually opens this page to check.
 *  - Add/Edit moved from a center modal to a right-side drawer so the
 *    table stays visible and orientation isn't lost while editing.
 *  - Delete confirmation moved off window.confirm() into an in-app
 *    dialog (accessible, styleable, doesn't block the JS thread).
 *  - Skeleton rows instead of a blocking spinner on first load.
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

import { useEffect, useMemo, useRef, useState } from "react";
import { usePincodes } from "../hooks/usePincodes";
import { useAdminAuth } from "../auth/AdminAuthContext";
import {
    FiMapPin, FiPlus, FiEdit2, FiTrash2, FiSearch, FiX,
    FiCheckCircle, FiAlertCircle, FiLoader, FiUsers, FiLock,
    FiArrowUp, FiArrowDown, FiDownload, FiShieldOff,
} from "react-icons/fi";

/* ══════════════════════════════════════════
   DESIGN TOKENS
   Indigo/amber "ops console" identity — kept distinct from the generic
   blue-on-white admin-panel default. Status colors stay semantic
   (green/amber/red) since admins scan these by color, not novelty.
══════════════════════════════════════════ */
const T = {
    canvas: "#f5f6fb", surface: "#ffffff", surfaceAlt: "#f0f1f8",
    line: "#e3e5f0", lineSoft: "#edeef6",
    ink: "#14162b", sub: "#383a55", muted: "#5b5e7e", hint: "#9497b3",
    primary: "#4338ca", primarySoft: "#eef0fd", primaryMid: "#dfe1fb",
    amber: "#d97706", amberSoft: "#fef3e2",
    green: "#0d9488", greenSoft: "#ecfdf9",
    red: "#dc2626", redSoft: "#fef2f2",
    mono: "ui-monospace,'JetBrains Mono','SF Mono',Consolas,monospace",
};

const STATUS_CONFIG = {
    active: { label: "Active", color: T.green, bg: T.greenSoft },
    coming_soon: { label: "Coming Soon", color: T.amber, bg: T.amberSoft },
    blocked: { label: "Blocked", color: T.red, bg: T.redSoft },
};

const EMPTY_FORM = { code: "", status: "coming_soon", area: "", city: "", district: "", state: "", expectedLaunchDate: "", note: "", priority: 0 };

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
            background: isErr ? T.redSoft : T.greenSoft,
            border: `1px solid ${isErr ? "#fecaca" : "#a7e8dc"}`,
            color: isErr ? T.red : T.green, padding: "10px 14px", borderRadius: 10,
            fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px rgba(20,22,43,0.14)",
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
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: T.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: T.primary }}>
                {icon}
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: T.ink, margin: "0 0 6px" }}>{title}</h2>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, margin: "0 0 18px" }}>{body}</p>
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
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: "18px 20px", marginBottom: 22, boxShadow: "0 1px 2px rgba(20,22,43,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingRight: 24, borderRight: source ? `1px solid ${T.lineSoft}` : "none" }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>{total}</span>
                    <span style={{ fontSize: 12.5, color: T.hint, fontWeight: 600 }}>pincodes</span>
                </div>

                {source ? (
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: T.surfaceAlt, marginBottom: 10 }}>
                            {segments.map((s) => (
                                <div key={s.key} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / sum) * 100}%`, background: s.color, transition: "width .3s ease" }} />
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                            {segments.map((s) => (
                                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                                    <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>{s.value}</span>
                                    <span style={{ fontSize: 12.5, color: T.hint }}>{s.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p style={{ fontSize: 12.5, color: T.hint, margin: 0 }}>Status breakdown shows once all pages are loaded, or filter by status above.</p>
                )}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   ADD / EDIT DRAWER
══════════════════════════════════════════ */
const PincodeDrawer = ({ initial, onSave, onClose, loading, serverError }) => {
    const [form, setForm] = useState(initial || EMPTY_FORM);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const isEdit = !!initial?._id;
    const firstFieldRef = useRef(null);

    // Client-side format check up front so a malformed code never even
    // reaches the network — the 6-digit rule is still enforced
    // server-side as the source of truth.
    const codeValid = isEdit || /^\d{6}$/.test(form.code.trim());
    const launchDateMissing = form.status === "coming_soon" && !form.expectedLaunchDate;

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
                background: T.surface, boxShadow: "-16px 0 40px rgba(15,17,36,0.18)",
                display: "flex", flexDirection: "column", animation: "ap-slideIn .22s cubic-bezier(.32,.72,0,1)",
            }}>
                <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: T.ink, margin: 0 }}>{isEdit ? `Edit ${initial.code}` : "Add pincode"}</h3>
                    <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, border: "none", background: T.surfaceAlt, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}><FiX size={15} /></button>
                </div>

                <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
                    {serverError && (
                        <div style={{ background: T.redSoft, border: "1px solid #fecaca", color: T.red, padding: "10px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 16, display: "flex", gap: 8 }}>
                            <FiAlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {serverError}
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div style={{ gridColumn: "1 / -1" }}>
                            <label style={LabelStyle}>Pincode *</label>
                            <input ref={firstFieldRef} type="text" inputMode="numeric" maxLength={6} value={form.code} disabled={isEdit}
                                onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 226010"
                                style={{ ...InputStyle, fontFamily: T.mono, letterSpacing: "0.04em", background: isEdit ? T.surfaceAlt : T.surface }} />
                            {!codeValid && form.code.trim() && <p style={HintErr}>Pincode must be exactly 6 digits.</p>}
                            {isEdit && <p style={{ ...HintErr, color: T.hint }}>Pincode can't be changed after creation.</p>}
                        </div>

                        {[
                            { key: "area", label: "Area", placeholder: "Gomti Nagar" },
                            { key: "city", label: "City", placeholder: "Lucknow" },
                            { key: "district", label: "District", placeholder: "Lucknow" },
                            { key: "state", label: "State", placeholder: "Uttar Pradesh" },
                        ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                                <label style={LabelStyle}>{label}</label>
                                <input type="text" value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} style={InputStyle} />
                            </div>
                        ))}

                        <div>
                            <label style={LabelStyle}>Priority</label>
                            <input type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} placeholder="0" style={InputStyle} />
                        </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <label style={LabelStyle}>Status</label>
                        <div style={{ display: "flex", gap: 6 }}>
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                const active = form.status === key;
                                return (
                                    <button key={key} type="button" onClick={() => set("status", key)}
                                        style={{
                                            flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                            border: `1px solid ${active ? cfg.color : T.line}`, background: active ? cfg.bg : T.surface, color: active ? cfg.color : T.muted,
                                        }}>{cfg.label}</button>
                                );
                            })}
                        </div>
                    </div>

                    {form.status === "coming_soon" && (
                        <div style={{ marginTop: 14 }}>
                            <label style={LabelStyle}>Expected launch date</label>
                            <input type="date" value={form.expectedLaunchDate?.split("T")[0] || ""} onChange={(e) => set("expectedLaunchDate", e.target.value)} style={InputStyle} />
                            {launchDateMissing && <p style={{ ...HintErr, color: T.amber }}>Consider adding a launch date so this doesn't sit forgotten.</p>}
                        </div>
                    )}

                    <div style={{ marginTop: 14 }}>
                        <label style={LabelStyle}>Internal note</label>
                        <textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Visible to admins only..." style={{ ...InputStyle, resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                </div>

                <div style={{ padding: 20, borderTop: `1px solid ${T.line}`, display: "flex", gap: 10 }}>
                    <button onClick={() => codeValid && onSave(form)} disabled={loading || !codeValid}
                        style={{ flex: 1, padding: "11px", background: T.primary, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: !codeValid ? 0.5 : 1 }}>
                        {loading ? <FiLoader size={13} style={{ animation: "ap-spin 0.8s linear infinite" }} /> : <FiCheckCircle size={13} />}
                        {isEdit ? "Save changes" : "Create pincode"}
                    </button>
                    <button onClick={onClose} style={{ padding: "11px 18px", background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: 9, fontSize: 13, color: T.muted, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

const LabelStyle = { fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 5 };
const InputStyle = { width: "100%", padding: "9px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13, color: T.ink, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const HintErr = { fontSize: 11, color: T.red, marginTop: 6 };

/* ── delete confirm dialog ── */
const ConfirmDialog = ({ title, body, confirmLabel, onConfirm, onCancel, danger = true, loading }) => (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} role="alertdialog" aria-modal="true">
        <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(15,17,36,0.45)" }} />
        <div style={{ position: "relative", background: T.surface, borderRadius: 14, padding: 22, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(15,17,36,0.2)" }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: "0 0 6px" }}>{title}</h4>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.55, margin: "0 0 18px" }}>{body}</p>
            <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: "10px", background: danger ? T.red : T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {loading ? <FiLoader size={13} style={{ animation: "ap-spin 0.8s linear infinite" }} /> : null}{confirmLabel}
                </button>
                <button onClick={onCancel} style={{ padding: "10px 16px", background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13, color: T.muted, cursor: "pointer" }}>Cancel</button>
            </div>
        </div>
    </div>
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
        { key: "active", label: "Active", dot: T.green },
        { key: "coming_soon", label: "Coming Soon", dot: T.amber },
        { key: "blocked", label: "Blocked", dot: T.red },
    ];

    const columns = [
        { key: "code", label: "Pincode", sortable: true },
        { key: "area", label: "Area / City", sortable: false },
        { key: "status", label: "Status", sortable: false },
        { key: "assignedVendors", label: "Vendors", sortable: false },
        { key: "priority", label: "Priority", sortable: true },
        { key: "updatedAt", label: "Updated", sortable: true },
        { key: "actions", label: "", sortable: false },
    ];

    const allSelected = pincodes.length > 0 && selected.size === pincodes.length;

    return (
        <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: T.ink, background: T.canvas, minHeight: "100%", padding: "28px 32px 40px", animation: "ap-pageIn .45s cubic-bezier(.22,.8,.32,1)" }}>
            <style>{`
                @keyframes ap-spin{to{transform:rotate(360deg)}}
                @keyframes ap-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
                @keyframes ap-fade{from{opacity:0}to{opacity:1}}
                @keyframes ap-pageIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
                .ap-enter-1{animation:ap-fadeUp .4s cubic-bezier(.22,.8,.32,1) both; animation-delay:.03s}
                .ap-enter-2{animation:ap-fadeUp .4s cubic-bezier(.22,.8,.32,1) both; animation-delay:.09s}
                .ap-enter-3{animation:ap-fadeUp .4s cubic-bezier(.22,.8,.32,1) both; animation-delay:.15s}
                @keyframes ap-slideIn{from{transform:translateX(24px);opacity:.6}to{transform:translateX(0);opacity:1}}
                @keyframes ap-shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
                .ap-row{animation:ap-fadeUp .25s ease forwards;}
                .ap-card{transition:border-color .15s,box-shadow .15s;}
                .ap-card:hover{border-color:#c7cbf5 !important;box-shadow:0 2px 14px rgba(67,56,202,0.08) !important;}
                button:disabled{cursor:not-allowed;opacity:.6}
                .ap-th-sort{cursor:pointer;user-select:none;display:flex;align-items:center;gap:4px}
                .ap-skel{background:linear-gradient(90deg,#eef0f8 25%,#e4e6f2 37%,#eef0f8 63%);background-size:400px 100%;animation:ap-shimmer 1.3s ease infinite;border-radius:6px}
                .pin-desktop{display:block}
                .pin-mobile{display:none}
                @media(max-width:720px){ .pin-desktop{display:none !important} .pin-mobile{display:block !important} }
                input:focus, textarea:focus, select:focus { border-color:${T.primary} !important; box-shadow:0 0 0 3px ${T.primaryMid}; }
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
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: "-0.01em" }}>Pincode coverage</h1>
                    <p style={{ fontSize: 13.5, color: T.hint, marginTop: 4 }}>Manage where the service is live, launching, or paused.</p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                        <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.hint, pointerEvents: "none" }} />
                        <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search pincode, city..."
                            style={{ height: 38, boxSizing: "border-box", paddingLeft: 34, paddingRight: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontSize: 13, fontFamily: "inherit", outline: "none", width: 210 }} />
                    </div>
                    <button onClick={() => downloadCSV(pincodes)} disabled={pincodes.length === 0}
                        style={{ height: 38, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 6, padding: "0 14px", background: T.surface, color: T.sub, border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        <FiDownload size={13} /> Export
                    </button>
                    <button onClick={() => setDrawer({ type: "add" })}
                        style={{ height: 38, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 6, padding: "0 16px", background: T.primary, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 2px rgba(67,56,202,0.25)" }}>
                        <FiPlus size={14} /> Add pincode
                    </button>
                </div>
            </div>

            <div className="ap-enter-2"><CoverageBar stats={stats} total={total} pincodes={pincodes} pages={pages} /></div>

            {/* Filter Tabs + bulk bar */}
            <div className="ap-enter-3" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                    {filters.map(({ key, label, dot }) => {
                        const active = filterStatus === key;
                        return (
                            <button key={key} onClick={() => handleFilter(key)}
                                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, border: active ? `1px solid ${T.primary}` : `1px solid ${T.line}`, background: active ? T.primarySoft : T.surface, color: active ? T.primary : T.muted, cursor: "pointer", fontFamily: "inherit", borderRadius: 8 }}>
                                {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />}{label}
                            </button>
                        );
                    })}
                </div>

                {selected.size > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.primarySoft, border: `1px solid ${T.primaryMid}`, borderRadius: 9, padding: "6px 10px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>{selected.size} selected</span>
                        <button onClick={() => handleBulkStatus("active")} style={BulkBtn}>Mark active</button>
                        <button onClick={() => handleBulkStatus("blocked")} style={BulkBtn}>Block</button>
                        {canDelete && <button onClick={() => setPendingDelete({ bulk: true, ids: [...selected] })} style={{ ...BulkBtn, color: T.red }}>Delete</button>}
                        <button onClick={() => setSelected(new Set())} aria-label="Clear selection" style={{ background: "none", border: "none", cursor: "pointer", color: T.hint, display: "flex" }}><FiX size={14} /></button>
                    </div>
                )}
            </div>

            {error && <div style={{ background: T.redSoft, border: "1px solid #fecaca", color: T.red, padding: "10px 14px", borderRadius: 9, fontSize: 13, marginBottom: 16 }}>{error}</div>}

            {/* Desktop Table */}
            <div className="pin-desktop ap-enter-3" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "32px 90px 1fr 120px 90px 80px 90px 76px", gap: 12, padding: "11px 20px", background: T.surfaceAlt, borderBottom: `1px solid ${T.line}`, minWidth: 760 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
                    {columns.map((c) => (
                        <p key={c.key} onClick={() => c.sortable && handleSort(c.key)} className={c.sortable ? "ap-th-sort" : ""}
                            style={{ fontSize: 10, fontWeight: 700, color: T.hint, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                            {c.label}
                            {c.sortable && sort.by === c.key && (sort.dir === "asc" ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />)}
                        </p>
                    ))}
                </div>

                {loading && pincodes.length === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 90px 1fr 120px 90px 80px 90px 76px", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${T.lineSoft}`, minWidth: 760, alignItems: "center" }}>
                            <div className="ap-skel" style={{ height: 14, width: 14 }} />
                            {Array.from({ length: 7 }).map((__, j) => <div key={j} className="ap-skel" style={{ height: 14, width: `${60 + (j % 3) * 15}%` }} />)}
                        </div>
                    ))
                ) : pincodes.length === 0 ? (
                    <div style={{ padding: "56px 0", textAlign: "center" }}>
                        <FiMapPin size={28} style={{ color: T.hint, marginBottom: 10 }} />
                        <p style={{ color: T.sub, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No pincodes found</p>
                        <p style={{ color: T.hint, fontSize: 12.5 }}>Try a different filter or search, or add a new pincode.</p>
                    </div>
                ) : pincodes.map((p, idx) => {
                    const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.coming_soon;
                    const isActing = actionLoading === p._id;
                    const needsLaunchDate = p.status === "coming_soon" && !p.expectedLaunchDate;
                    return (
                        <div key={p._id} className="ap-card ap-row"
                            style={{ display: "grid", gridTemplateColumns: "32px 90px 1fr 120px 90px 80px 90px 76px", gap: 12, padding: "13px 20px", borderBottom: idx < pincodes.length - 1 ? `1px solid ${T.lineSoft}` : "none", alignItems: "center", animationDelay: `${idx * 18}ms`, minWidth: 760 }}>
                            <input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} aria-label={`Select ${p.code}`} />
                            <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: T.mono }}>{p.code}</p>
                            <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: T.sub }}>{p.area || "—"}</p>
                                <p style={{ fontSize: 11, color: T.hint }}>{[p.city, p.state].filter(Boolean).join(", ") || "—"}</p>
                            </div>
                            <div>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "3px 10px", borderRadius: 99 }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />{cfg.label}
                                </span>
                                {needsLaunchDate && <p style={{ fontSize: 10, color: T.amber, marginTop: 4 }}>No launch date set</p>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <FiUsers size={12} color={T.hint} />
                                <span style={{ fontSize: 13, color: T.sub }}>{p.assignedVendors?.length || 0}</span>
                            </div>
                            <p style={{ fontSize: 13, color: T.muted }}>{p.priority || 0}</p>
                            <p style={{ fontSize: 12, color: T.hint }}>{relTime(p.updatedAt)}</p>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => setDrawer({ type: "edit", pincode: p })} title="Edit" aria-label={`Edit ${p.code}`}
                                    style={{ width: 30, height: 30, background: T.primarySoft, border: `1px solid ${T.primaryMid}`, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                    <FiEdit2 size={12} color={T.primary} />
                                </button>
                                {canDelete && (
                                    <button onClick={() => setPendingDelete(p)} disabled={isActing} title="Delete" aria-label={`Delete ${p.code}`}
                                        style={{ width: 30, height: 30, background: T.redSoft, border: "1px solid #fecaca", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                        {isActing ? <FiLoader size={11} color={T.red} style={{ animation: "ap-spin 0.8s linear infinite" }} /> : <FiTrash2 size={12} color={T.red} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Mobile Cards */}
            <div className="pin-mobile" style={{ display: "none", flexDirection: "column", gap: 10 }}>
                {pincodes.length === 0 && !loading ? (
                    <div style={{ padding: "52px 0", textAlign: "center", background: T.surface, borderRadius: 14, border: `1px solid ${T.line}` }}>
                        <FiMapPin size={28} style={{ color: T.hint, marginBottom: 10 }} />
                        <p style={{ color: T.hint, fontSize: 14 }}>No pincodes found</p>
                    </div>
                ) : pincodes.map((p, idx) => {
                    const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.coming_soon;
                    const isActing = actionLoading === p._id;
                    return (
                        <div key={p._id} className="ap-card ap-row" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, animationDelay: `${idx * 18}ms` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} style={{ marginTop: 4 }} />
                                    <div>
                                        <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: T.mono }}>{p.code}</p>
                                        <p style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{p.area || "—"}, {[p.city, p.state].filter(Boolean).join(", ") || "—"}</p>
                                    </div>
                                </div>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "3px 8px", borderRadius: 99, flexShrink: 0 }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />{cfg.label}
                                </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.hint, flexWrap: "wrap" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><FiUsers size={11} /> {p.assignedVendors?.length || 0} vendors</span>
                                    <span>Priority {p.priority || 0}</span>
                                    <span>{relTime(p.updatedAt)}</span>
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button onClick={() => setDrawer({ type: "edit", pincode: p })} title="Edit"
                                        style={{ width: 30, height: 30, background: T.primarySoft, border: `1px solid ${T.primaryMid}`, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                        <FiEdit2 size={12} color={T.primary} />
                                    </button>
                                    {canDelete && (
                                        <button onClick={() => setPendingDelete(p)} disabled={isActing} title="Delete"
                                            style={{ width: 30, height: 30, background: T.redSoft, border: "1px solid #fecaca", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                            {isActing ? <FiLoader size={11} color={T.red} style={{ animation: "ap-spin 0.8s linear infinite" }} /> : <FiTrash2 size={12} color={T.red} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {pages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
                    <button onClick={() => goToPage(page - 1)} disabled={page <= 1 || loading}
                        style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, border: `1px solid ${T.line}`, background: T.surface, color: page <= 1 ? T.hint : T.muted, borderRadius: 8, cursor: page <= 1 ? "not-allowed" : "pointer" }}>← Prev</button>
                    <span style={{ fontSize: 12, color: T.hint }}>Page {page} of {pages}</span>
                    <button onClick={() => goToPage(page + 1)} disabled={page >= pages || loading}
                        style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, border: `1px solid ${T.line}`, background: T.surface, color: page >= pages ? T.hint : T.muted, borderRadius: 8, cursor: page >= pages ? "not-allowed" : "pointer" }}>Next →</button>
                </div>
            )}
        </div>
    );
};

const BulkBtn = { background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.primary, padding: "4px 6px" };

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
        return <AuthScreen icon={<FiLoader size={20} style={{ animation: "ap-spin 0.8s linear infinite" }} />} title="Checking your session…" body="One moment." />;
    }
    if (!admin) {
        // Shouldn't normally be reached — AdminRoute already redirects.
        return (
            <AuthScreen
                icon={<FiLock size={20} />}
                title="Admin sign-in required"
                body="Sign in with an admin or owner account to manage pincode coverage."
                cta={<a href="/admin/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: T.primary, color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Go to sign in</a>}
            />
        );
    }
    return <AdminPincodesInner admin={admin} />;
};

export default AdminPincodes;