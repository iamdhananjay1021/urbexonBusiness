import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchAllBanners, deleteBanner, updateBanner } from "../api/bannerApi";
import { FiPlus, FiEdit2, FiTrash2, FiImage, FiToggleLeft, FiToggleRight, FiArrowLeft, FiLink, FiCalendar, FiFilter } from "react-icons/fi";

const TYPE_COLORS = { ecommerce: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", label: "🛒 Ecommerce" }, urbexon_hour: { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe", label: "⚡ UH" } };
const PLACE_COLORS = { hero: { bg: "#fefce8", color: "#a16207", border: "#fef08a", label: "Hero" }, mid: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", label: "Mid" } };

const AdminBanners = () => {
    const navigate = useNavigate();
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [toast, setToast] = useState(null);
    const [filterType, setFilterType] = useState("all");
    const [filterPlacement, setFilterPlacement] = useState("all");

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        (async () => {
            try {
                const { data } = await fetchAllBanners();
                setBanners(Array.isArray(data) ? data : []);
            } catch {
                showToast("error", "Failed to load banners");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filtered = useMemo(() => {
        return banners.filter(b => {
            if (filterType !== "all" && b.type !== filterType) return false;
            if (filterPlacement !== "all" && b.placement !== filterPlacement) return false;
            return true;
        });
    }, [banners, filterType, filterPlacement]);

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this banner?")) return;
        setDeletingId(id);
        try {
            await deleteBanner(id);
            setBanners(prev => prev.filter(b => b._id !== id));
            showToast("success", "Banner deleted");
        } catch {
            showToast("error", "Delete failed");
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggle = async (banner) => {
        try {
            const fd = new FormData();
            fd.append("isActive", !banner.isActive);
            const { data } = await updateBanner(banner._id, fd);
            setBanners(prev => prev.map(b => b._id === banner._id ? data : b));
            showToast("success", `Banner ${data.isActive ? "activated" : "deactivated"}`);
        } catch {
            showToast("error", "Toggle failed");
        }
    };

    const getScheduleStatus = (b) => {
        if (!b.startDate && !b.endDate) return null;
        const now = new Date();
        if (b.startDate && new Date(b.startDate) > now) return { label: "Scheduled", color: "#f59e0b", bg: "#fffbeb" };
        if (b.endDate && new Date(b.endDate) < now) return { label: "Expired", color: "#ef4444", bg: "#fef2f2" };
        return { label: "Live", color: "#22c55e", bg: "#f0fdf4" };
    };

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";

    // Summary counts
    const counts = useMemo(() => ({
        total: banners.length,
        ecom: banners.filter(b => b.type === "ecommerce").length,
        uh: banners.filter(b => b.type === "urbexon_hour").length,
        active: banners.filter(b => b.isActive).length,
    }), [banners]);

    const Sk = () => (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
            {[120, 200, 120, 80].map((w, i) => (
                <div key={i} style={{ height: 20, width: w, background: "#f1f5f9", borderRadius: 6, animation: "ux-pulse 1.6s ease-in-out infinite" }} />
            ))}
        </div>
    );

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <style>{`@keyframes ux-pulse{0%,100%{opacity:1}50%{opacity:.4}}
.ab-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
@media(max-width:768px){.ab-row{padding:12px!important;gap:10px!important;flex-direction:column;align-items:flex-start!important}.ab-order{display:none!important;}.ab-thumb{width:100%!important;height:120px!important;}.ab-meta{flex-wrap:wrap;gap:4px!important}.ab-actions{width:100%;justify-content:flex-end}}
@media(max-width:480px){.ab-row{padding:10px!important;}.ab-filters{flex-direction:column!important}}`}</style>

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: toast.type === "success" ? "#dcfce7" : "#fef2f2", border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`, color: toast.type === "success" ? "#15803d" : "#dc2626", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                    {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => navigate("/admin")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        <FiArrowLeft size={14} /> Back
                    </button>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Banner Management</h1>
                        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{banners.length} banner{banners.length !== 1 ? "s" : ""} total</p>
                    </div>
                </div>
                <Link to="/admin/banners/new" style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                    <FiPlus size={15} /> Add Banner
                </Link>
            </div>

            {/* Summary Cards */}
            {!loading && banners.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
                    {[
                        { label: "Total", value: counts.total, bg: "#f8fafc", color: "#1e293b" },
                        { label: "Active", value: counts.active, bg: "#f0fdf4", color: "#15803d" },
                        { label: "Ecommerce", value: counts.ecom, bg: "#eff6ff", color: "#2563eb" },
                        { label: "Urbexon Hour", value: counts.uh, bg: "#faf5ff", color: "#7c3aed" },
                    ].map(c => (
                        <div key={c.label} style={{ background: c.bg, border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{c.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            {!loading && banners.length > 0 && (
                <div className="ab-filters" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                        <FiFilter size={13} /> Filter:
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        {[{ v: "all", l: "All Types" }, { v: "ecommerce", l: "🛒 Ecommerce" }, { v: "urbexon_hour", l: "⚡ UH" }].map(o => (
                            <button key={o.v} onClick={() => setFilterType(o.v)}
                                style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${filterType === o.v ? "#2563eb" : "#e2e8f0"}`, background: filterType === o.v ? "#eff6ff" : "#fff", color: filterType === o.v ? "#2563eb" : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                {o.l}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        {[{ v: "all", l: "All Placements" }, { v: "hero", l: "🖼️ Hero" }, { v: "mid", l: "📰 Mid" }].map(o => (
                            <button key={o.v} onClick={() => setFilterPlacement(o.v)}
                                style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${filterPlacement === o.v ? "#2563eb" : "#e2e8f0"}`, background: filterPlacement === o.v ? "#eff6ff" : "#fff", color: filterPlacement === o.v ? "#2563eb" : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                {o.l}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[1, 2, 3].map(i => <Sk key={i} />)}
                </div>
            )}

            {/* Empty */}
            {!loading && banners.length === 0 && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "64px 24px", textAlign: "center" }}>
                    <FiImage size={36} style={{ color: "#cbd5e1", marginBottom: 12 }} />
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>No banners yet</p>
                    <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Add your first banner to get started</p>
                    <Link to="/admin/banners/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                        <FiPlus size={13} /> Add Banner
                    </Link>
                </div>
            )}

            {/* Banner List */}
            {!loading && filtered.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filtered.map((banner, idx) => {
                        const tc = TYPE_COLORS[banner.type] || TYPE_COLORS.ecommerce;
                        const pc = PLACE_COLORS[banner.placement] || PLACE_COLORS.hero;
                        const sched = getScheduleStatus(banner);

                        return (
                            <div key={banner._id} className="ab-row" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                                {/* Order badge */}
                                <div className="ab-order" style={{ width: 28, height: 28, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#64748b", flexShrink: 0 }}>
                                    {banner.order ?? idx + 1}
                                </div>

                                {/* Thumbnail */}
                                <div className="ab-thumb" style={{ width: 100, height: 56, borderRadius: 8, overflow: "hidden", background: "#f8fafc", border: "1px solid #e2e8f0", flexShrink: 0 }}>
                                    {banner.image?.url
                                        ? <img src={banner.image.url} alt={banner.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><FiImage size={16} color="#cbd5e1" /></div>
                                    }
                                </div>

                                {/* Info */}
                                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                                        {banner.title || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No title</span>}
                                    </p>
                                    {banner.subtitle && (
                                        <p style={{ fontSize: 12, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{banner.subtitle}</p>
                                    )}
                                    {/* Badges row */}
                                    <div className="ab-meta" style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                                        <span className="ab-badge" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{tc.label}</span>
                                        <span className="ab-badge" style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{pc.label}</span>
                                        {sched && <span className="ab-badge" style={{ background: sched.bg, color: sched.color, border: `1px solid ${sched.color}22` }}><FiCalendar size={9} style={{ marginRight: 3 }} />{sched.label}</span>}
                                        {banner.link && (
                                            <span className="ab-badge" style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
                                                <FiLink size={9} style={{ marginRight: 3 }} />
                                                {banner.linkType === "external" ? "External" : banner.linkType === "product" ? "Product" : banner.linkType === "category" ? "Category" : "Route"}
                                            </span>
                                        )}
                                        {banner.buttonText && (
                                            <span style={{ fontSize: 10, color: "#94a3b8" }}>CTA: "{banner.buttonText}"</span>
                                        )}
                                    </div>
                                    {/* Schedule dates */}
                                    {(banner.startDate || banner.endDate) && (
                                        <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, margin: "3px 0 0" }}>
                                            📅 {fmtDate(banner.startDate)} → {fmtDate(banner.endDate)}
                                        </p>
                                    )}
                                </div>

                                {/* Status */}
                                <div style={{ flexShrink: 0 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: banner.isActive ? "#dcfce7" : "#f1f5f9", color: banner.isActive ? "#15803d" : "#94a3b8", border: `1px solid ${banner.isActive ? "#bbf7d0" : "#e2e8f0"}` }}>
                                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: banner.isActive ? "#22c55e" : "#cbd5e1" }} />
                                        {banner.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="ab-actions" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                    <button onClick={() => handleToggle(banner)} title={banner.isActive ? "Deactivate" : "Activate"}
                                        style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: banner.isActive ? "#f59e0b" : "#22c55e", cursor: "pointer" }}>
                                        {banner.isActive ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                                    </button>
                                    <Link to={`/admin/banners/${banner._id}/edit`} title="Edit"
                                        style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#2563eb", textDecoration: "none" }}>
                                        <FiEdit2 size={14} />
                                    </Link>
                                    <button onClick={() => handleDelete(banner._id)} disabled={deletingId === banner._id} title="Delete"
                                        style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", color: "#ef4444", cursor: "pointer", opacity: deletingId === banner._id ? 0.5 : 1 }}>
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* No results after filter */}
            {!loading && banners.length > 0 && filtered.length === 0 && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "40px 24px", textAlign: "center" }}>
                    <FiFilter size={28} style={{ color: "#cbd5e1", marginBottom: 10 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>No banners match filters</p>
                    <button onClick={() => { setFilterType("all"); setFilterPlacement("all"); }}
                        style={{ padding: "7px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 8, fontFamily: "inherit" }}>
                        Clear Filters
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminBanners;