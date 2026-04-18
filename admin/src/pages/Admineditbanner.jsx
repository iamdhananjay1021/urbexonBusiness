import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAllBanners, updateBanner } from "../api/bannerApi";
import { FiArrowLeft, FiUpload, FiX } from "react-icons/fi";

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

const AdminEditBanner = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState({ title: "", subtitle: "", link: "", isActive: true, order: 0, type: "ecommerce", placement: "hero" });
    const [currentImage, setCurrentImage] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const { data } = await fetchAllBanners();
                const banner = data.find(b => b._id === id);
                if (!banner) { navigate("/admin/banners"); return; }
                setForm({ title: banner.title || "", subtitle: banner.subtitle || "", link: banner.link || "", isActive: banner.isActive, order: banner.order || 0, type: banner.type || "ecommerce", placement: banner.placement || "hero" });
                setCurrentImage(banner.image?.url || "");
            } catch {
                setError("Failed to load banner");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
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
        try {
            setSaving(true);
            setError("");
            const fd = new FormData();
            fd.append("title", form.title.trim());
            fd.append("subtitle", form.subtitle.trim());
            fd.append("link", form.link.trim());
            fd.append("isActive", form.isActive);
            fd.append("order", form.order);
            fd.append("type", form.type);
            fd.append("placement", form.placement);
            if (imageFile) fd.append("image", imageFile);
            await updateBanner(id, fd);
            navigate("/admin/banners");
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

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <button onClick={() => navigate("/admin/banners")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    <FiArrowLeft size={14} /> Back
                </button>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Edit Banner</h1>
                    <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Update banner details</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Current / New Image */}
                    <Field label="Banner Image" hint="(upload new to replace)">
                        {!preview && currentImage && (
                            <div style={{ marginBottom: 10 }}>
                                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Current image:</p>
                                <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                    <img src={currentImage} alt="current" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                                </div>
                            </div>
                        )}
                        {!preview ? (
                            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: 100, border: "2px dashed #e2e8f0", borderRadius: 10, cursor: "pointer", background: "#f8fafc" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.background = "#eff6ff"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}>
                                <FiUpload size={18} color="#94a3b8" style={{ marginBottom: 6 }} />
                                <p style={{ fontSize: 12, color: "#64748b" }}>Upload new image to replace</p>
                                <input type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
                            </label>
                        ) : (
                            <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                <img src={preview} alt="preview" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                                <button type="button" onClick={() => { setImageFile(null); setPreview(""); }}
                                    style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                    <FiX size={11} />
                                </button>
                            </div>
                        )}
                    </Field>

                    <Field label="Title" hint="(optional)">
                        <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Shop The Trend"
                            style={inputStyle} onFocus={e => e.target.style.borderColor = "#93c5fd"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </Field>

                    <Field label="Subtitle" hint="(optional)">
                        <input name="subtitle" value={form.subtitle} onChange={handleChange} placeholder="e.g. Live The Trend."
                            style={inputStyle} onFocus={e => e.target.style.borderColor = "#93c5fd"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </Field>

                    <Field label="Link URL" hint="(optional)">
                        <input name="link" value={form.link} onChange={handleChange} placeholder="e.g. /category/mens-fashion"
                            style={inputStyle} onFocus={e => e.target.style.borderColor = "#93c5fd"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    </Field>

                    {/* Type & Placement */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <Field label="Banner Type">
                            <div style={{ display: "flex", gap: 8 }}>
                                {[{ value: "ecommerce", label: "🛒 Ecommerce" }, { value: "urbexon_hour", label: "⚡ Urbexon Hour" }].map(opt => (
                                    <button key={opt.value} type="button" onClick={() => setForm(prev => ({ ...prev, type: opt.value }))}
                                        style={{ flex: 1, padding: "9px 10px", border: `2px solid ${form.type === opt.value ? "#2563eb" : "#e2e8f0"}`, borderRadius: 8, background: form.type === opt.value ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: form.type === opt.value ? 700 : 500, color: form.type === opt.value ? "#2563eb" : "#64748b", fontFamily: "inherit", transition: "all 0.2s" }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Placement">
                            <div style={{ display: "flex", gap: 8 }}>
                                {[{ value: "hero", label: "🖼️ Hero" }, { value: "mid", label: "📰 Mid-Page" }].map(opt => (
                                    <button key={opt.value} type="button" onClick={() => setForm(prev => ({ ...prev, placement: opt.value }))}
                                        style={{ flex: 1, padding: "9px 10px", border: `2px solid ${form.placement === opt.value ? "#2563eb" : "#e2e8f0"}`, borderRadius: 8, background: form.placement === opt.value ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: form.placement === opt.value ? 700 : 500, color: form.placement === opt.value ? "#2563eb" : "#64748b", fontFamily: "inherit", transition: "all 0.2s" }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </Field>
                    </div>

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
                        <button type="button" onClick={() => navigate("/admin/banners")}
                            style={{ flex: 1, padding: "11px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            style={{ flex: 1, padding: "11px", background: saving ? "#93c5fd" : "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            {saving ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "ux-spin 0.8s linear infinite" }} />Updating...</> : "Update Banner"}
                        </button>
                    </div>
                </div>
            </form>
            <style>{`@keyframes ux-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
};

export default AdminEditBanner;