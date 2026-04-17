import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAllCategories, updateCategory } from "../api/categoryApi";
import { FiArrowLeft, FiUpload, FiX } from "react-icons/fi";

const EMOJI_OPTIONS = ["👔", "👗", "🥻", "👜", "📱", "✨", "👟", "🎒", "⌚", "💍", "🕶️", "🧢", "🏷️"];

const inputStyle = {
    width: "100%", padding: "10px 14px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 13, color: "#1e293b", background: "#fff",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

const Field = ({ label, hint, children }) => (
    <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            {label} {hint && <span style={{ color: "#94a3b8", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{hint}</span>}
        </label>
        {children}
    </div>
);

const AdminEditCategory = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", emoji: "🏷️", color: "#1a1740", lightColor: "#f0eefb", isActive: true, order: 0, type: "ecommerce" });
    const [currentImage, setCurrentImage] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const { data } = await fetchAllCategories();
                const cat = data.find(c => c._id === id);
                if (!cat) { navigate("/admin/categories"); return; }
                setForm({ name: cat.name || "", emoji: cat.emoji || "🏷️", color: cat.color || "#1a1740", lightColor: cat.lightColor || "#f0eefb", isActive: cat.isActive, order: cat.order || 0, type: cat.type || "ecommerce" });
                setCurrentImage(cat.image?.url || "");
            } catch {
                setError("Failed to load category");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        setError("");
    };

    const handleImage = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size / (1024 * 1024) > 5) return setError("Image must be under 5MB");
        setImageFile(file);
        setPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return setError("Category name is required");
        try {
            setSaving(true);
            setError("");
            const fd = new FormData();
            fd.append("name", form.name.trim());
            fd.append("emoji", form.emoji);
            fd.append("color", form.color);
            fd.append("lightColor", form.lightColor);
            fd.append("isActive", form.isActive);
            fd.append("order", form.order);
            fd.append("type", form.type);
            if (imageFile) fd.append("image", imageFile);
            await updateCategory(id, fd);
            navigate("/admin/categories");
        } catch (err) {
            setError(err.response?.data?.message || "Update failed");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #dbeafe", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 640, margin: "0 auto" }}>
            <style>{`@keyframes ux-spin{to{transform:rotate(360deg)}}`}</style>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <button onClick={() => navigate("/admin/categories")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    <FiArrowLeft size={14} /> Back
                </button>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Edit Category</h1>
                    <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Update category details</p>
                </div>
            </div>

            {/* Preview */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: form.lightColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    {preview
                        ? <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : currentImage && !preview
                            ? <img src={currentImage} alt="current" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 26 }}>{form.emoji}</span>
                    }
                </div>
                <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: form.color }}>{form.name || "Category Name"}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>Live preview</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 20 }}>

                    <Field label="Category Name">
                        <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Men's Fashion"
                            style={inputStyle} onFocus={e => e.target.style.borderColor = "#93c5fd"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </Field>

                    <Field label="Emoji" hint="(shown if no image)">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {EMOJI_OPTIONS.map(em => (
                                <button key={em} type="button" onClick={() => setForm(prev => ({ ...prev, emoji: em }))}
                                    style={{ width: 38, height: 38, fontSize: 20, border: `2px solid ${form.emoji === em ? "#2563eb" : "#e2e8f0"}`, borderRadius: 8, background: form.emoji === em ? "#eff6ff" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {em}
                                </button>
                            ))}
                            <input name="emoji" value={form.emoji} onChange={handleChange}
                                style={{ ...inputStyle, width: 80, textAlign: "center", fontSize: 18 }} />
                        </div>
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <Field label="Text Color">
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="color" value={form.color} onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
                                    style={{ width: 40, height: 38, border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", padding: 2 }} />
                                <input name="color" value={form.color} onChange={handleChange}
                                    style={{ ...inputStyle, flex: 1 }} onFocus={e => e.target.style.borderColor = "#93c5fd"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                            </div>
                        </Field>
                        <Field label="Background Color">
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="color" value={form.lightColor} onChange={e => setForm(prev => ({ ...prev, lightColor: e.target.value }))}
                                    style={{ width: 40, height: 38, border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", padding: 2 }} />
                                <input name="lightColor" value={form.lightColor} onChange={handleChange}
                                    style={{ ...inputStyle, flex: 1 }} onFocus={e => e.target.style.borderColor = "#93c5fd"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                            </div>
                        </Field>
                    </div>

                    <Field label="Category Image" hint="(upload new to replace)">
                        {!preview ? (
                            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: 90, border: "2px dashed #e2e8f0", borderRadius: 10, cursor: "pointer", background: "#f8fafc" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.background = "#eff6ff"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}>
                                <FiUpload size={16} color="#94a3b8" style={{ marginBottom: 5 }} />
                                <p style={{ fontSize: 12, color: "#64748b" }}>{currentImage ? "Upload new to replace" : "Upload category image"}</p>
                                <input type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
                            </label>
                        ) : (
                            <div style={{ position: "relative", width: 80, height: 80, borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                <button type="button" onClick={() => { setImageFile(null); setPreview(""); }}
                                    style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                    <FiX size={10} />
                                </button>
                            </div>
                        )}
                    </Field>

                    <Field label="Category Type">
                        <div style={{ display: "flex", gap: 10 }}>
                            {[{ value: "ecommerce", label: "🛒 Ecommerce" }, { value: "urbexon_hour", label: "⚡ Urbexon Hour" }].map(opt => (
                                <button key={opt.value} type="button" onClick={() => setForm(prev => ({ ...prev, type: opt.value }))}
                                    style={{ flex: 1, padding: "10px 14px", border: `2px solid ${form.type === opt.value ? "#2563eb" : "#e2e8f0"}`, borderRadius: 8, background: form.type === opt.value ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: form.type === opt.value ? 700 : 500, color: form.type === opt.value ? "#2563eb" : "#64748b", fontFamily: "inherit", transition: "all 0.2s" }}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <Field label="Display Order">
                            <input name="order" type="number" min="0" value={form.order} onChange={handleChange}
                                style={inputStyle} onFocus={e => e.target.style.borderColor = "#93c5fd"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                        </Field>
                        <Field label="Status">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>Active</span>
                                <button type="button" onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                                    style={{ position: "relative", width: 44, height: 24, borderRadius: 12, border: "none", background: form.isActive ? "#2563eb" : "#e2e8f0", cursor: "pointer", transition: "background 0.2s" }}>
                                    <div style={{ position: "absolute", top: 2, width: 20, height: 20, background: "#fff", borderRadius: "50%", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s", left: form.isActive ? 22 : 2 }} />
                                </button>
                            </div>
                        </Field>
                    </div>

                    {error && (
                        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                            ⚠ {error}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" onClick={() => navigate("/admin/categories")}
                            style={{ flex: 1, padding: "11px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            style={{ flex: 1, padding: "11px", background: saving ? "#93c5fd" : "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            {saving ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "ux-spin 0.8s linear infinite" }} />Updating...</> : "Update Category"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default AdminEditCategory;