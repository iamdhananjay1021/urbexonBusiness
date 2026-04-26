import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchAllBanners, deleteBanner, updateBanner } from "../api/bannerApi";
import {
    FiPlus, FiEdit2, FiTrash2, FiImage, FiArrowLeft,
    FiLink, FiFilter, FiSearch, FiX, FiEye, FiEyeOff
} from "react-icons/fi";

const TYPE_CFG = {
    ecommerce: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", label: "🛒 Ecommerce" },
    urbexon_hour: { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe", label: "⚡ UH" },
};
const PLACE_CFG = {
    hero: { bg: "#fefce8", color: "#a16207", border: "#fef08a", label: "Hero" },
    mid: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", label: "Mid" },
};

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const getScheduleStatus = (b) => {
    if (!b.startDate && !b.endDate) return null;
    const now = new Date();
    if (b.startDate && new Date(b.startDate) > now)
        return { label: "Scheduled", color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" };
    if (b.endDate && new Date(b.endDate) < now)
        return { label: "Expired", color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" };
    return { label: "Live", color: "#16a34a", bg: "#f0fdf4", dot: "#22c55e" };
};

const SkeletonCard = () => (
    <div style={{
        background: "#fff", borderRadius: 16, padding: "18px 16px",
        border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    }}>
        {[80, "70%", "50%", "40%"].map((w, i) => (
            <div key={i} style={{
                height: i === 0 ? 60 : 14, width: w, borderRadius: 8,
                background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
                backgroundSize: "400% 100%", animation: "shimmer 1.6s infinite linear"
            }} />
        ))}
    </div>
);

const StatCard = ({ icon, value, label, accent }) => (
    <div style={{
        background: "#fff", borderRadius: 14, padding: "14px 16px",
        border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", gap: 12
    }}>
        <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: accent + "18",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0
        }}>{icon}</div>
        <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        </div>
    </div>
);

const FilterPill = ({ active, onClick, children, activeColor = "#2563eb" }) => (
    <button onClick={onClick} style={{
        padding: "5px 12px", borderRadius: 20,
        border: `1.5px solid ${active ? activeColor : "#e5e7eb"}`,
        background: active ? activeColor : "#fff",
        color: active ? "#fff" : "#64748b",
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        transition: "all 0.18s", whiteSpace: "nowrap", flexShrink: 0
    }}>{children}</button>
);

/* ═══ Main ═════════════════════════════════════════════════ */
const AdminBanners = () => {
    const navigate = useNavigate();
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [toast, setToast] = useState(null);
    const [filterType, setFilterType] = useState("all");
    const [filterPlace, setFilterPlace] = useState("all");
    const [search, setSearch] = useState("");

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await fetchAllBanners();
                setBanners(Array.isArray(data) ? data : []);
            } catch { showToast("error", "Failed to load banners"); }
            finally { setLoading(false); }
        })();
    }, [showToast]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return banners
            .filter((b) => {
                if (filterType !== "all" && b.type !== filterType) return false;
                if (filterPlace !== "all" && b.placement !== filterPlace) return false;
                if (q && !b.title?.toLowerCase().includes(q) && !b.subtitle?.toLowerCase().includes(q)) return false;
                return true;
            })
            .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    }, [banners, filterType, filterPlace, search]);

    const counts = useMemo(() => ({
        total: banners.length,
        active: banners.filter((b) => b.isActive).length,
        ecom: banners.filter((b) => b.type === "ecommerce").length,
        uh: banners.filter((b) => b.type === "urbexon_hour").length,
    }), [banners]);

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this banner permanently?")) return;
        setDeletingId(id);
        try {
            await deleteBanner(id);
            setBanners((prev) => prev.filter((b) => b._id !== id));
            showToast("success", "Banner deleted");
        } catch { showToast("error", "Delete failed – try again"); }
        finally { setDeletingId(null); }
    };

    const handleToggle = async (banner) => {
        try {
            const fd = new FormData();
            fd.append("isActive", !banner.isActive);
            const { data } = await updateBanner(banner._id, fd);
            setBanners((prev) => prev.map((b) => (b._id === banner._id ? data : b)));
            showToast("success", `Banner ${data.isActive ? "activated" : "deactivated"}`);
        } catch { showToast("error", "Toggle failed"); }
    };

    const clearFilters = () => { setFilterType("all"); setFilterPlace("all"); setSearch(""); };
    const hasFilters = filterType !== "all" || filterPlace !== "all" || !!search.trim();

    return (
        <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#f8fafc", minHeight: "100vh", padding: "12px" }}>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes shimmer  { 0%{background-position:-400% 0} 100%{background-position:400% 0} }
                @keyframes toast-in { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
                @keyframes fade-in  { from{opacity:0;transform:translateY(6px)}  to{opacity:1;transform:translateY(0)} }
                * { box-sizing: border-box; }
                .bn-card { transition: box-shadow 0.2s, transform 0.2s; }
                .bn-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.1) !important; transform: translateY(-2px); }
                .bn-btn { transition: opacity 0.15s, transform 0.15s; border: none; }
                .bn-btn:hover:not(:disabled) { opacity: 0.82; transform: scale(1.07); }
                .bn-btn:disabled { cursor: not-allowed; }
                .bn-search:focus { outline: none; border-color: #93c5fd !important; box-shadow: 0 0 0 3px rgba(147,197,253,0.28) !important; }

                /* Horizontal scroll for filter row — no overflow clip */
                .filter-row {
                    display: flex; gap: 6px; align-items: center;
                    overflow-x: auto; padding-bottom: 2px;
                    -webkit-overflow-scrolling: touch; scrollbar-width: none;
                }
                .filter-row::-webkit-scrollbar { display: none; }

                /* Stat grid: 4 cols desktop → 2 cols mobile */
                .stat-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px; margin-bottom: 16px;
                }
                @media (max-width: 600px) {
                    .stat-grid { grid-template-columns: repeat(2, 1fr); }
                }

                /* Banner card: desktop = single row, mobile = stacked */
                .bn-card-body {
                    display: flex; align-items: center; gap: 14px;
                }
                @media (max-width: 600px) {
                    .bn-card-body {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                    }
                    .bn-top-row {
                        display: flex !important;
                        gap: 12px;
                        align-items: flex-start;
                    }
                    .bn-thumb {
                        width: 88px !important;
                        height: 56px !important;
                    }
                    .bn-meta { padding-right: 28px !important; }
                    .bn-subtitle { display: none !important; }
                    .bn-footer-row {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                    }
                    /* On mobile the footer is always shown as its own row */
                    .bn-footer-row-desktop { display: none !important; }
                    .bn-footer-row-mobile  { display: flex !important; }
                }
                @media (min-width: 601px) {
                    .bn-top-row { display: contents; }
                    .bn-footer-row-mobile  { display: none !important; }
                    .bn-footer-row-desktop { display: flex !important; }
                }
            `}</style>

            {/* ── Toast ─────────────────────────────────────────── */}
            {toast && (
                <div style={{
                    position: "fixed", top: 12, left: 12, right: 12, zIndex: 9999,
                    background: toast.type === "success" ? "#f0fdf4" : "#fff1f2",
                    border: `1.5px solid ${toast.type === "success" ? "#86efac" : "#fca5a5"}`,
                    color: toast.type === "success" ? "#15803d" : "#be123c",
                    padding: "12px 16px", borderRadius: 13, fontSize: 13, fontWeight: 600,
                    boxShadow: "0 6px 20px rgba(0,0,0,0.12)", animation: "toast-in 0.28s ease",
                    display: "flex", alignItems: "center", gap: 10,
                    maxWidth: 480, margin: "0 auto"
                }}>
                    <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
                    <span style={{ flex: 1 }}>{toast.msg}</span>
                    <button onClick={() => setToast(null)} className="bn-btn" style={{ background: "none", cursor: "pointer", color: "inherit", opacity: 0.5, padding: 0, flexShrink: 0 }}>
                        <FiX size={14} />
                    </button>
                </div>
            )}

            {/* ── Header card ───────────────────────────────────── */}
            <div style={{
                background: "#fff", borderRadius: 18, padding: "16px",
                border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                marginBottom: 14, animation: "fade-in 0.3s ease"
            }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <button
                            onClick={() => navigate("/admin")}
                            className="bn-btn"
                            style={{
                                display: "flex", alignItems: "center", gap: 5, padding: "8px 12px",
                                background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 10,
                                color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0
                            }}
                        >
                            <FiArrowLeft size={14} /> Back
                        </button>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.4px" }}>
                                Banner Studio
                            </h1>
                            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 1, fontWeight: 500 }}>
                                {counts.total} banners · {counts.active} active
                            </p>
                        </div>
                    </div>

                    <Link
                        to="/admin/banners/new"
                        className="bn-btn"
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 7,
                            padding: "9px 16px", background: "#2563eb", color: "#fff",
                            borderRadius: 11, fontSize: 13, fontWeight: 700, textDecoration: "none",
                            boxShadow: "0 3px 10px rgba(37,99,235,0.35)", flexShrink: 0
                        }}
                    >
                        <FiPlus size={15} strokeWidth={2.5} /> Create
                    </Link>
                </div>

                {/* Search */}
                <div style={{ position: "relative", marginTop: 12 }}>
                    <FiSearch size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    <input
                        className="bn-search"
                        placeholder="Search banners…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: "100%", padding: "10px 36px 10px 38px",
                            border: "1.5px solid #e5e7eb", borderRadius: 11,
                            fontSize: 13, background: "#f8fafc", color: "#0f172a",
                            transition: "all 0.18s"
                        }}
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="bn-btn" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}>
                            <FiX size={13} />
                        </button>
                    )}
                </div>

                {/* Filters – single horizontally scrollable row */}
                <div className="filter-row" style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0 }}>TYPE</span>
                    <FilterPill active={filterType === "all"} onClick={() => setFilterType("all")}>All</FilterPill>
                    {Object.entries(TYPE_CFG).map(([k, v]) => (
                        <FilterPill key={k} active={filterType === k} onClick={() => setFilterType(filterType === k ? "all" : k)} activeColor={v.color}>
                            {v.label}
                        </FilterPill>
                    ))}
                    <span style={{ width: 1, height: 16, background: "#e5e7eb", flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0 }}>PLACE</span>
                    <FilterPill active={filterPlace === "all"} onClick={() => setFilterPlace("all")}>All</FilterPill>
                    {Object.entries(PLACE_CFG).map(([k, v]) => (
                        <FilterPill key={k} active={filterPlace === k} onClick={() => setFilterPlace(filterPlace === k ? "all" : k)} activeColor={v.color}>
                            {v.label}
                        </FilterPill>
                    ))}
                    {hasFilters && (
                        <button onClick={clearFilters} style={{
                            display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                            borderRadius: 20, border: "1.5px solid #fca5a5",
                            background: "#fff1f2", color: "#be123c", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0
                        }}>
                            <FiX size={10} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Stats ─────────────────────────────────────────── */}
            <div className="stat-grid" style={{ animation: "fade-in 0.35s ease" }}>
                <StatCard icon="📊" value={counts.total} label="Total" accent="#2563eb" />
                <StatCard icon="🟢" value={counts.active} label="Active" accent="#16a34a" />
                <StatCard icon="🛒" value={counts.ecom} label="Ecommerce" accent="#2563eb" />
                <StatCard icon="⚡" value={counts.uh} label="UH" accent="#7c3aed" />
            </div>

            {/* ── Skeletons ─────────────────────────────────────── */}
            {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
                </div>
            )}

            {/* ── Empty state ───────────────────────────────────── */}
            {!loading && filtered.length === 0 && (
                <div style={{
                    background: "#fff", borderRadius: 18, padding: "60px 24px",
                    border: "1px solid #f1f5f9", textAlign: "center", animation: "fade-in 0.3s ease"
                }}>
                    {hasFilters
                        ? <FiFilter size={40} style={{ color: "#cbd5e1", marginBottom: 14 }} />
                        : <FiImage size={40} style={{ color: "#cbd5e1", marginBottom: 14 }} />}
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
                        {hasFilters ? "No matching banners" : "No banners yet"}
                    </h2>
                    <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 22, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
                        {hasFilters ? "Try clearing your filters." : "Create your first banner to get started."}
                    </p>
                    {hasFilters ? (
                        <button onClick={clearFilters} style={{ padding: "10px 22px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            Clear Filters
                        </button>
                    ) : (
                        <Link to="/admin/banners/new" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", background: "#2563eb", color: "#fff", borderRadius: 11, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                            <FiPlus size={15} /> Create Banner
                        </Link>
                    )}
                </div>
            )}

            {/* ── Banner list ───────────────────────────────────── */}
            {!loading && filtered.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fade-in 0.35s ease" }}>
                    {filtered.map((banner, idx) => {
                        const tc = TYPE_CFG[banner.type] || TYPE_CFG.ecommerce;
                        const pc = PLACE_CFG[banner.placement] || PLACE_CFG.hero;
                        const sched = getScheduleStatus(banner);

                        /* Shared action buttons — rendered in both desktop+mobile rows */
                        const ActionButtons = () => (
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                <button className="bn-btn" onClick={() => handleToggle(banner)} title={banner.isActive ? "Deactivate" : "Activate"}
                                    style={{ width: 36, height: 36, borderRadius: 9, border: "1.5px solid #e5e7eb", background: "#fff", color: banner.isActive ? "#d97706" : "#16a34a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {banner.isActive ? <FiEyeOff size={15} strokeWidth={2} /> : <FiEye size={15} strokeWidth={2} />}
                                </button>
                                <Link to={`/admin/banners/${banner._id}/edit`} className="bn-btn" title="Edit"
                                    style={{ width: 36, height: 36, borderRadius: 9, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                                    <FiEdit2 size={14} strokeWidth={2} />
                                </Link>
                                <button className="bn-btn" onClick={() => handleDelete(banner._id)} disabled={deletingId === banner._id} title="Delete"
                                    style={{ width: 36, height: 36, borderRadius: 9, border: "1.5px solid #fca5a5", background: "#fff1f2", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: deletingId === banner._id ? 0.5 : 1 }}>
                                    <FiTrash2 size={14} strokeWidth={2} />
                                </button>
                            </div>
                        );

                        const StatusPill = () => (
                            <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background: banner.isActive ? "#f0fdf4" : "#f8fafc",
                                color: banner.isActive ? "#15803d" : "#64748b",
                                border: banner.isActive ? "1.5px solid #86efac" : "1.5px solid #e5e7eb",
                                whiteSpace: "nowrap", flexShrink: 0
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: banner.isActive ? "#22c55e" : "#cbd5e1" }} />
                                {banner.isActive ? "Live" : "Draft"}
                            </span>
                        );

                        return (
                            <div key={banner._id} className="bn-card" style={{
                                background: "#fff", borderRadius: 16, padding: "14px",
                                border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                                position: "relative"
                            }}>
                                {/* Order badge */}
                                <div style={{
                                    position: "absolute", top: 10, right: 10,
                                    fontSize: 10, fontWeight: 700, color: "#94a3b8",
                                    background: "#f8fafc", border: "1px solid #e5e7eb",
                                    borderRadius: 6, padding: "2px 7px", zIndex: 1
                                }}>
                                    #{banner.order ?? idx + 1}
                                </div>

                                <div className="bn-card-body">

                                    {/* Top row: thumb + meta (on mobile becomes its own block) */}
                                    <div className="bn-top-row">
                                        {/* Thumb */}
                                        <div className="bn-thumb" style={{
                                            width: 100, height: 62, borderRadius: 10, overflow: "hidden",
                                            background: "#f8fafc", border: "1px solid #f1f5f9", flexShrink: 0
                                        }}>
                                            {banner.image?.url ? (
                                                <img src={banner.image.url} alt={banner.title || "Banner"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <FiImage size={20} color="#cbd5e1" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Meta */}
                                        <div className="bn-meta" style={{ flex: 1, minWidth: 0, paddingRight: 30 }}>
                                            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {banner.title || <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 500 }}>Untitled</span>}
                                            </h3>
                                            {banner.subtitle && (
                                                <p className="bn-subtitle" style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {banner.subtitle}
                                                </p>
                                            )}
                                            {/* Badges */}
                                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                                <span style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700 }}>
                                                    {tc.label}
                                                </span>
                                                <span style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700 }}>
                                                    {pc.label}
                                                </span>
                                                {banner.link && (
                                                    <span style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e5e7eb", padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                                        <FiLink size={9} />
                                                        {banner.linkType === "external" ? "Ext" : banner.linkType === "product" ? "Prod" : banner.linkType === "category" ? "Cat" : "Route"}
                                                    </span>
                                                )}
                                                {sched && (
                                                    <span style={{ background: sched.bg, color: sched.color, border: `1px solid ${sched.dot}44`, padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: sched.dot, display: "inline-block" }} />
                                                        {sched.label}
                                                    </span>
                                                )}
                                            </div>
                                            {(banner.startDate || banner.endDate) && (
                                                <p style={{ fontSize: 10, color: "#94a3b8", margin: "6px 0 0", fontWeight: 500 }}>
                                                    📅 {fmtDate(banner.startDate)} → {fmtDate(banner.endDate)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Desktop: status + actions stay inline */}
                                    <div className="bn-footer-row-desktop" style={{ alignItems: "center", gap: 10, flexShrink: 0 }}>
                                        <StatusPill />
                                        <ActionButtons />
                                    </div>

                                    {/* Mobile: status + actions pinned to bottom row */}
                                    <div className="bn-footer-row-mobile" style={{ alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <StatusPill />
                                        <ActionButtons />
                                    </div>

                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminBanners;