import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchAllBanners, deleteBanner, updateBanner } from "../api/bannerApi";
import {
    FiPlus, FiEdit2, FiTrash2, FiImage, FiArrowLeft,
    FiLink, FiFilter, FiX, FiEye, FiEyeOff
} from "react-icons/fi";
import {
    Button, Badge, Card, Skeleton, EmptyState, Modal, SearchBar,
} from "../components/ui";

const TYPE_LABEL = {
    ecommerce: { label: "🛒 Ecommerce", tone: "info" },
    urbexon_hour: { label: "⚡ UH", tone: "primary" },
};
const PLACE_LABEL = {
    hero: { label: "Hero", tone: "warning" },
    mid: { label: "Mid", tone: "success" },
};

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const getScheduleStatus = (b) => {
    if (!b.startDate && !b.endDate) return null;
    const now = new Date();
    if (b.startDate && new Date(b.startDate) > now) return { label: "Scheduled", tone: "warning" };
    if (b.endDate && new Date(b.endDate) < now) return { label: "Expired", tone: "danger" };
    return { label: "Live", tone: "success" };
};

const SkeletonCard = () => (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton height={60} />
        <Skeleton height={14} width="70%" />
        <Skeleton height={14} width="50%" />
        <Skeleton height={14} width="40%" />
    </Card>
);

const StatCard = ({ icon, value, label, tone }) => (
    <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
            width: 40, height: 40, borderRadius: "var(--adm-radius-md)",
            background: `var(--adm-${tone}-tint)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0
        }}>{icon}</div>
        <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: "var(--adm-muted)", fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        </div>
    </Card>
);

const FilterPill = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
        padding: "5px 12px", borderRadius: "var(--adm-radius-full)",
        border: active ? "1.5px solid var(--adm-primary)" : "1.5px solid var(--adm-border)",
        background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)",
        color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)",
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
    const [pendingDelete, setPendingDelete] = useState(null);

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

    const handleDelete = async () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        setDeletingId(id);
        try {
            await deleteBanner(id);
            setBanners((prev) => prev.filter((b) => b._id !== id));
            showToast("success", "Banner deleted");
        } catch { showToast("error", "Delete failed – try again"); }
        finally { setDeletingId(null); setPendingDelete(null); }
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
        <div style={{ fontFamily: "var(--adm-font-sans)", background: "var(--adm-bg)", minHeight: "100vh", padding: "12px" }}>
            <style>{`
                * { box-sizing: border-box; }
                .bn-card { transition: box-shadow 0.2s, transform 0.2s; }
                .bn-card:hover { box-shadow: var(--adm-shadow-md) !important; transform: translateY(-2px); }
                .bn-btn { transition: opacity 0.15s, transform 0.15s; border: none; }
                .bn-btn:hover:not(:disabled) { opacity: 0.82; transform: scale(1.07); }
                .bn-btn:disabled { cursor: not-allowed; }

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

            {/* ── Delete confirmation ─────────────────────────────── */}
            <Modal
                open={!!pendingDelete}
                onClose={() => setPendingDelete(null)}
                title="Delete this banner?"
                width={360}
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={!!deletingId}>Cancel</Button>
                        <Button variant="danger" icon={FiTrash2} loading={!!deletingId} onClick={handleDelete}>Delete</Button>
                    </>
                )}
            >
                <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", lineHeight: 1.55, margin: 0 }}>
                    This can't be undone. "{pendingDelete?.title || "Untitled"}" will be permanently removed.
                </p>
            </Modal>

            {/* ── Toast ─────────────────────────────────────────── */}
            {toast && (
                <div style={{
                    position: "fixed", top: 12, left: 12, right: 12, zIndex: 9999,
                    background: toast.type === "success" ? "var(--adm-success-tint)" : "var(--adm-danger-tint)",
                    border: `1.5px solid var(--adm-${toast.type === "success" ? "success" : "danger"})`,
                    color: `var(--adm-${toast.type === "success" ? "success" : "danger"})`,
                    padding: "12px 16px", borderRadius: "var(--adm-radius-lg)", fontSize: 13, fontWeight: 600,
                    boxShadow: "var(--adm-shadow-md)",
                    display: "flex", alignItems: "center", gap: 10,
                    maxWidth: 480, margin: "0 auto"
                }}>
                    <span style={{ flex: 1 }}>{toast.msg}</span>
                    <button onClick={() => setToast(null)} className="bn-btn" style={{ background: "none", cursor: "pointer", color: "inherit", opacity: 0.5, padding: 0, flexShrink: 0 }}>
                        <FiX size={14} />
                    </button>
                </div>
            )}

            {/* ── Header card ───────────────────────────────────── */}
            <Card style={{ marginBottom: 14 }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <Button variant="secondary" size="sm" icon={FiArrowLeft} onClick={() => navigate("/admin")}>Back</Button>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--adm-text-primary)", margin: 0, letterSpacing: "-0.4px" }}>
                                Banner Studio
                            </h1>
                            <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 1, fontWeight: 500 }}>
                                {counts.total} banners · {counts.active} active
                            </p>
                        </div>
                    </div>

                    <Link
                        to="/admin/banners/new"
                        className="bn-btn"
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 7,
                            padding: "9px 16px", background: "var(--adm-primary)", color: "var(--adm-text-on-accent)",
                            borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 700, textDecoration: "none",
                            boxShadow: "var(--adm-shadow-sm)", flexShrink: 0
                        }}
                    >
                        <FiPlus size={15} strokeWidth={2.5} /> Create
                    </Link>
                </div>

                {/* Search */}
                <div style={{ marginTop: 12 }}>
                    <SearchBar value={search} onChange={setSearch} placeholder="Search banners…" />
                </div>

                {/* Filters – single horizontally scrollable row */}
                <div className="filter-row" style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 10, color: "var(--adm-muted)", fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0 }}>TYPE</span>
                    <FilterPill active={filterType === "all"} onClick={() => setFilterType("all")}>All</FilterPill>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                        <FilterPill key={k} active={filterType === k} onClick={() => setFilterType(filterType === k ? "all" : k)}>
                            {v.label}
                        </FilterPill>
                    ))}
                    <span style={{ width: 1, height: 16, background: "var(--adm-border)", flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "var(--adm-muted)", fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0 }}>PLACE</span>
                    <FilterPill active={filterPlace === "all"} onClick={() => setFilterPlace("all")}>All</FilterPill>
                    {Object.entries(PLACE_LABEL).map(([k, v]) => (
                        <FilterPill key={k} active={filterPlace === k} onClick={() => setFilterPlace(filterPlace === k ? "all" : k)}>
                            {v.label}
                        </FilterPill>
                    ))}
                    {hasFilters && (
                        <button onClick={clearFilters} style={{
                            display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                            borderRadius: "var(--adm-radius-full)", border: "1.5px solid var(--adm-danger)",
                            background: "var(--adm-danger-tint)", color: "var(--adm-danger)", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0
                        }}>
                            <FiX size={10} /> Clear
                        </button>
                    )}
                </div>
            </Card>

            {/* ── Stats ─────────────────────────────────────────── */}
            <div className="stat-grid">
                <StatCard icon="📊" value={counts.total} label="Total" tone="primary" />
                <StatCard icon="🟢" value={counts.active} label="Active" tone="success" />
                <StatCard icon="🛒" value={counts.ecom} label="Ecommerce" tone="info" />
                <StatCard icon="⚡" value={counts.uh} label="UH" tone="primary" />
            </div>

            {/* ── Skeletons ─────────────────────────────────────── */}
            {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
                </div>
            )}

            {/* ── Empty state ───────────────────────────────────── */}
            {!loading && filtered.length === 0 && (
                <Card style={{ textAlign: "center" }}>
                    <EmptyState
                        icon={hasFilters ? FiFilter : FiImage}
                        title={hasFilters ? "No matching banners" : "No banners yet"}
                        description={hasFilters ? "Try clearing your filters." : "Create your first banner to get started."}
                        action={hasFilters ? (
                            <Button variant="primary" onClick={clearFilters}>Clear Filters</Button>
                        ) : (
                            <Link to="/admin/banners/new" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", background: "var(--adm-primary)", color: "var(--adm-text-on-accent)", borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                                <FiPlus size={15} /> Create Banner
                            </Link>
                        )}
                    />
                </Card>
            )}

            {/* ── Banner list ───────────────────────────────────── */}
            {!loading && filtered.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filtered.map((banner, idx) => {
                        const tc = TYPE_LABEL[banner.type] || TYPE_LABEL.ecommerce;
                        const pc = PLACE_LABEL[banner.placement] || PLACE_LABEL.hero;
                        const sched = getScheduleStatus(banner);

                        /* Shared action buttons — rendered in both desktop+mobile rows */
                        const ActionButtons = () => (
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                <button className="bn-btn" onClick={() => handleToggle(banner)} title={banner.isActive ? "Deactivate" : "Activate"}
                                    style={{ width: 36, height: 36, borderRadius: "var(--adm-radius-sm)", border: "1.5px solid var(--adm-border)", background: "var(--adm-surface)", color: banner.isActive ? "var(--adm-warning)" : "var(--adm-success)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {banner.isActive ? <FiEyeOff size={15} strokeWidth={2} /> : <FiEye size={15} strokeWidth={2} />}
                                </button>
                                <Link to={`/admin/banners/${banner._id}/edit`} className="bn-btn" title="Edit"
                                    style={{ width: 36, height: 36, borderRadius: "var(--adm-radius-sm)", border: "1.5px solid color-mix(in srgb, var(--adm-primary) 30%, transparent)", background: "var(--adm-primary-tint)", color: "var(--adm-primary)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                                    <FiEdit2 size={14} strokeWidth={2} />
                                </Link>
                                <button className="bn-btn" onClick={() => setPendingDelete(banner)} disabled={deletingId === banner._id} title="Delete"
                                    style={{ width: 36, height: 36, borderRadius: "var(--adm-radius-sm)", border: "1.5px solid color-mix(in srgb, var(--adm-danger) 30%, transparent)", background: "var(--adm-danger-tint)", color: "var(--adm-danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: deletingId === banner._id ? 0.5 : 1 }}>
                                    <FiTrash2 size={14} strokeWidth={2} />
                                </button>
                            </div>
                        );

                        const StatusPill = () => (
                            <Badge tone={banner.isActive ? "success" : "neutral"} dot>
                                {banner.isActive ? "Live" : "Draft"}
                            </Badge>
                        );

                        return (
                            <Card key={banner._id} className="bn-card" style={{ position: "relative" }}>
                                {/* Order badge */}
                                <div style={{
                                    position: "absolute", top: 10, right: 10,
                                    fontSize: 10, fontWeight: 700, color: "var(--adm-muted)",
                                    background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border)",
                                    borderRadius: "var(--adm-radius-sm)", padding: "2px 7px", zIndex: 1
                                }}>
                                    #{banner.order ?? idx + 1}
                                </div>

                                <div className="bn-card-body">

                                    {/* Top row: thumb + meta (on mobile becomes its own block) */}
                                    <div className="bn-top-row">
                                        {/* Thumb */}
                                        <div className="bn-thumb" style={{
                                            width: 100, height: 62, borderRadius: "var(--adm-radius-md)", overflow: "hidden",
                                            background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border-soft)", flexShrink: 0
                                        }}>
                                            {banner.image?.url ? (
                                                <img src={banner.image.url} alt={banner.title || "Banner"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <FiImage size={20} color="var(--adm-border)" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Meta */}
                                        <div className="bn-meta" style={{ flex: 1, minWidth: 0, paddingRight: 30 }}>
                                            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-text-primary)", margin: "0 0 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {banner.title || <span style={{ color: "var(--adm-muted)", fontStyle: "italic", fontWeight: 500 }}>Untitled</span>}
                                            </h3>
                                            {banner.subtitle && (
                                                <p className="bn-subtitle" style={{ fontSize: 12, color: "var(--adm-text-secondary)", margin: "0 0 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {banner.subtitle}
                                                </p>
                                            )}
                                            {/* Badges */}
                                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                                <Badge tone={tc.tone}>{tc.label}</Badge>
                                                <Badge tone={pc.tone}>{pc.label}</Badge>
                                                {banner.link && (
                                                    <Badge tone="neutral">
                                                        <FiLink size={9} />
                                                        {banner.linkType === "external" ? "Ext" : banner.linkType === "product" ? "Prod" : banner.linkType === "category" ? "Cat" : "Route"}
                                                    </Badge>
                                                )}
                                                {sched && <Badge tone={sched.tone} dot>{sched.label}</Badge>}
                                            </div>
                                            {(banner.startDate || banner.endDate) && (
                                                <p style={{ fontSize: 10, color: "var(--adm-muted)", margin: "6px 0 0", fontWeight: 500 }}>
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
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminBanners;
