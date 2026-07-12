import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllCategories, deleteCategory, updateCategory } from "../api/categoryApi";
import { FiPlus, FiEdit2, FiTrash2, FiTag, FiToggleLeft, FiToggleRight, FiArrowLeft } from "react-icons/fi";
import { Button, Badge, Card, EmptyState, Skeleton, Modal } from "../components/ui";

const AdminCategories = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null); // category pending delete confirmation
    const [toast, setToast] = useState(null);
    const [activeTab, setActiveTab] = useState("all"); // all, ecommerce, urbexon_hour

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        (async () => {
            try {
                const { data } = await fetchAllCategories();
                setCategories(Array.isArray(data) ? data : []);
            } catch {
                showToast("error", "Failed to load categories");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Filter categories by type
    const filteredCategories = activeTab === "all"
        ? categories
        : categories.filter(cat => cat.type === activeTab);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const slug = deleteTarget.slug;
        setDeletingId(slug);
        try {
            await deleteCategory(slug);
            setCategories(prev => prev.filter(c => c.slug !== slug));
            showToast("success", "Category deleted");
        } catch {
            showToast("error", "Delete failed");
        } finally {
            setDeletingId(null);
            setDeleteTarget(null);
        }
    };

    const handleToggle = async (cat) => {
        try {
            const fd = new FormData();
            fd.append("isActive", !cat.isActive);
            const { data } = await updateCategory(cat.slug, fd);
            setCategories(prev => prev.map(c => c._id === cat._id ? data : c));
            showToast("success", `Category ${data.isActive ? "activated" : "deactivated"}`);
        } catch {
            showToast("error", "Toggle failed");
        }
    };

    const SkeletonRow = () => (
        <Card padded={false} style={{ padding: "14px 18px", display: "flex", gap: 14, alignItems: "center" }}>
            <Skeleton width={46} height={46} radius={10} />
            <Skeleton width={160} height={16} />
            <Skeleton width={70} height={16} />
            <Skeleton width={80} height={16} />
        </Card>
    );

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)" }}>
            <style>{`
@media(max-width:768px){.cat-row{padding:12px!important;gap:10px!important;}.cat-color{display:none!important;}}
@media(max-width:480px){.cat-row{padding:10px!important;}}`}</style>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 1000,
                    background: toast.type === "success" ? "var(--adm-success-tint)" : "var(--adm-danger-tint)",
                    border: `1px solid var(--adm-${toast.type === "success" ? "success" : "danger"})`,
                    color: toast.type === "success" ? "var(--adm-success-hover)" : "var(--adm-danger-hover)",
                    padding: "10px 18px", borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 600,
                    boxShadow: "var(--adm-shadow-md)",
                }}>
                    {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
                </div>
            )}

            {/* Delete confirmation */}
            <Modal
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Delete category"
                width={380}
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={!!deletingId}>Cancel</Button>
                        <Button variant="danger" icon={FiTrash2} loading={!!deletingId} onClick={confirmDelete}>Delete</Button>
                    </>
                )}
            >
                <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", margin: 0 }}>
                    Are you sure you want to delete <b>{deleteTarget?.name}</b>? This action cannot be undone.
                </p>
            </Modal>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Button variant="secondary" icon={FiArrowLeft} onClick={() => navigate("/admin")}>Back</Button>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Categories</h1>
                        <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>{filteredCategories.length} categor{filteredCategories.length !== 1 ? "ies" : "y"}</p>
                    </div>
                </div>
                <Button variant="primary" icon={FiPlus} onClick={() => navigate("/admin/categories/new")}>Add Category</Button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--adm-border)", paddingBottom: 12 }}>
                {[
                    { id: "all", label: "📋 All", count: categories.length },
                    { id: "ecommerce", label: "🛒 E-Commerce", count: categories.filter(c => c.type === "ecommerce").length },
                    { id: "urbexon_hour", label: "⚡ Urbexon Hour", count: categories.filter(c => c.type === "urbexon_hour").length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            borderBottom: activeTab === tab.id ? "2px solid var(--adm-primary)" : "2px solid transparent",
                            background: "transparent",
                            color: activeTab === tab.id ? "var(--adm-primary)" : "var(--adm-muted)",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            fontFamily: "inherit",
                        }}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
                </div>
            )}

            {!loading && categories.length === 0 && (
                <Card>
                    <EmptyState
                        icon={FiTag}
                        title="No categories yet"
                        description="Add your first product category"
                        action={<Button variant="primary" onClick={() => navigate("/admin/categories/new")}>Add Category</Button>}
                    />
                </Card>
            )}

            {!loading && categories.length > 0 && filteredCategories.length === 0 && (
                <Card>
                    <EmptyState
                        icon={FiTag}
                        title="No categories in this section"
                        description="Switch to another tab or create new category"
                    />
                </Card>
            )}

            {!loading && filteredCategories.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filteredCategories.map((cat) => (
                        <Card key={cat._id} padded={false} className="cat-row" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>

                            {/* Emoji / Image */}
                            <div style={{ width: 46, height: 46, borderRadius: "var(--adm-radius-md)", background: cat.lightColor || "var(--adm-primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "1px solid var(--adm-border)" }}>
                                {cat.image?.url
                                    ? <img src={cat.image.url} alt={cat.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    : <span style={{ fontSize: 22 }}>{cat.emoji || "🏷️"}</span>
                                }
                            </div>

                            {/* Info */}
                            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--adm-text-primary)", margin: 0 }}>{cat.name}</p>
                                    <Badge tone={cat.type === "urbexon_hour" ? "warning" : "primary"}>
                                        {cat.type === "urbexon_hour" ? "⚡ UH" : "🛒 EC"}
                                    </Badge>
                                </div>
                                <p style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 2 }}>/{cat.slug}</p>
                            </div>

                            {/* Color dot */}
                            <div className="cat-color" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                <div style={{ width: 14, height: 14, borderRadius: "50%", background: cat.color || "#1a1740", border: "2px solid var(--adm-border)" }} />
                                <span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{cat.color}</span>
                            </div>

                            {/* Status */}
                            <div style={{ flexShrink: 0 }}>
                                <Badge tone={cat.isActive ? "success" : "neutral"} dot>
                                    {cat.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                <button onClick={() => handleToggle(cat)} title={cat.isActive ? "Deactivate" : "Activate"}
                                    style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", background: "var(--adm-surface-alt)", color: cat.isActive ? "var(--adm-warning)" : "var(--adm-success)", cursor: "pointer" }}>
                                    {cat.isActive ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                                </button>
                                <button onClick={() => navigate(`/admin/categories/${cat.slug}/edit`)} title="Edit"
                                    style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", background: "var(--adm-surface-alt)", color: "var(--adm-primary)", cursor: "pointer" }}>
                                    <FiEdit2 size={14} />
                                </button>
                                <button onClick={() => setDeleteTarget(cat)} disabled={deletingId === cat.slug} title="Delete"
                                    style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--adm-danger-tint)", borderRadius: "var(--adm-radius-md)", background: "var(--adm-danger-tint)", color: "var(--adm-danger)", cursor: "pointer", opacity: deletingId === cat.slug ? 0.5 : 1 }}>
                                    <FiTrash2 size={14} />
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminCategories;
