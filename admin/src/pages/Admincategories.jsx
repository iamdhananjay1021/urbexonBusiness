import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllCategories, deleteCategory, updateCategory } from "../api/categoryApi";
import { FiPlus, FiEdit2, FiTrash2, FiTag, FiToggleLeft, FiToggleRight, FiArrowLeft } from "react-icons/fi";

const AdminCategories = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [toast, setToast] = useState(null);

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

    const handleDelete = async (slug) => {
        if (!window.confirm("Delete this category?")) return;
        setDeletingId(slug);
        try {
            await deleteCategory(slug);
            setCategories(prev => prev.filter(c => c.slug !== slug));
            showToast("success", "Category deleted");
        } catch {
            showToast("error", "Delete failed");
        } finally {
            setDeletingId(null);
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

    const Sk = () => (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
            {[48, 160, 100, 80].map((w, i) => (
                <div key={i} style={{ height: 20, width: w, background: "#f1f5f9", borderRadius: 6, animation: "ux-pulse 1.6s ease-in-out infinite" }} />
            ))}
        </div>
    );

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <style>{`@keyframes ux-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@media(max-width:768px){.cat-row{padding:12px!important;gap:10px!important;}.cat-color{display:none!important;}}
@media(max-width:480px){.cat-row{padding:10px!important;}}`}</style>

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: toast.type === "success" ? "#dcfce7" : "#fef2f2", border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`, color: toast.type === "success" ? "#15803d" : "#dc2626", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                    {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => navigate("/admin")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        <FiArrowLeft size={14} /> Back
                    </button>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Categories</h1>
                        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{categories.length} categor{categories.length !== 1 ? "ies" : "y"} total</p>
                    </div>
                </div>
                <button onClick={() => navigate("/admin/categories/new")}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    <FiPlus size={15} /> Add Category
                </button>
            </div>

            {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[1, 2, 3, 4].map(i => <Sk key={i} />)}
                </div>
            )}

            {!loading && categories.length === 0 && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "64px 24px", textAlign: "center" }}>
                    <FiTag size={36} style={{ color: "#cbd5e1", marginBottom: 12 }} />
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>No categories yet</p>
                    <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Add your first product category</p>
                    <button onClick={() => navigate("/admin/categories/new")}
                        style={{ padding: "9px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        Add Category
                    </button>
                </div>
            )}

            {!loading && categories.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {categories.map((cat) => (
                        <div key={cat._id} className="cat-row" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                            {/* Emoji / Image */}
                            <div style={{ width: 46, height: 46, borderRadius: 12, background: cat.lightColor || "#f0eefb", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "1px solid #e2e8f0" }}>
                                {cat.image?.url
                                    ? <img src={cat.image.url} alt={cat.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    : <span style={{ fontSize: 22 }}>{cat.emoji || "🏷️"}</span>
                                }
                            </div>

                            {/* Info */}
                            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: 0 }}>{cat.name}</p>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: cat.type === "urbexon_hour" ? "#fff7ed" : "#f0f9ff", color: cat.type === "urbexon_hour" ? "#c2410c" : "#1d4ed8", border: `1px solid ${cat.type === "urbexon_hour" ? "#fed7aa" : "#bfdbfe"}` }}>
                                        {cat.type === "urbexon_hour" ? "⚡ UH" : "🛒 EC"}
                                    </span>
                                </div>
                                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>/{cat.slug}</p>
                            </div>

                            {/* Color dot */}
                            <div className="cat-color" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                <div style={{ width: 14, height: 14, borderRadius: "50%", background: cat.color || "#1a1740", border: "2px solid #e2e8f0" }} />
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>{cat.color}</span>
                            </div>

                            {/* Status */}
                            <div style={{ flexShrink: 0 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: cat.isActive ? "#dcfce7" : "#f1f5f9", color: cat.isActive ? "#15803d" : "#94a3b8", border: `1px solid ${cat.isActive ? "#bbf7d0" : "#e2e8f0"}` }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: cat.isActive ? "#22c55e" : "#cbd5e1" }} />
                                    {cat.isActive ? "Active" : "Inactive"}
                                </span>
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                <button onClick={() => handleToggle(cat)} title={cat.isActive ? "Deactivate" : "Activate"}
                                    style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: cat.isActive ? "#f59e0b" : "#22c55e", cursor: "pointer" }}>
                                    {cat.isActive ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                                </button>
                                <button onClick={() => navigate(`/admin/categories/${cat.slug}/edit`)} title="Edit"
                                    style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#2563eb", cursor: "pointer" }}>
                                    <FiEdit2 size={14} />
                                </button>
                                <button onClick={() => handleDelete(cat.slug)} disabled={deletingId === cat.slug} title="Delete"
                                    style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", color: "#ef4444", cursor: "pointer", opacity: deletingId === cat.slug ? 0.5 : 1 }}>
                                    <FiTrash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminCategories;