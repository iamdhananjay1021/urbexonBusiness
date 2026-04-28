import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBanner } from "../api/bannerApi";
import { FiArrowLeft, FiUpload, FiX, FiLink, FiType } from "react-icons/fi";

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

const LINK_TYPES = [
    { value: "none", label: "No Link", icon: "—" },
    { value: "route", label: "Internal Route", icon: "🔗" },
    { value: "product", label: "Product Page", icon: "📦" },
    { value: "category", label: "Category Page", icon: "📂" },
    { value: "external", label: "External URL", icon: "🌐" },
];

const LINK_HINTS = {
    none: "",
    route: "e.g. /deals, /urbexon-hour, /category/fashion",
    product: "e.g. /product/6639abc123",
    category: "e.g. /category/electronics",
    external: "e.g. https://example.com/promo",
};

const AdminAddBanner = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: "", subtitle: "", description: "", link: "", linkType: "none", buttonText: "",
        isActive: true, order: 0, type: "ecommerce", placement: "hero", startDate: "", endDate: "",
    });
    const [imageFile, setImageFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

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
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!imageFile) return setError("Please upload a banner image");
        try {
            setSaving(true);
            setError("");
            const fd = new FormData();
            fd.append("title", form.title.trim());
            fd.append("subtitle", form.subtitle.trim());
            fd.append("description", form.description.trim());
            fd.append("link", form.link.trim());
            fd.append("linkType", form.linkType);
            fd.append("buttonText", form.buttonText.trim());
            fd.append("isActive", form.isActive);
            fd.append("order", form.order);
            fd.append("type", form.type);
            fd.append("placement", form.placement);
            if (form.startDate) fd.append("startDate", form.startDate);
            if (form.endDate) fd.append("endDate", form.endDate);
            fd.append("image", imageFile);
            await createBanner(fd);
            navigate("/admin/banners");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create banner");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ fontFamily: "'DM Sans',system-ui,-apple-system,sans-serif", maxWidth: "100%", margin: "0 auto", padding: "20px 16px 60px" }}>
            <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
* { box-sizing:border-box; }
@keyframes ux-spin { to{transform:rotate(360deg)} }
@keyframes bnr-fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

.bnr-container {
    width:100%;
    max-width:720px;
    margin:0 auto;
    animation:bnr-fadeIn .3s ease;
}

.bnr-inp {
    width:100%;
    padding:11px 13px;
    background:#fff;
    border:1.5px solid #cbd5e1;
    border-radius:8px;
    font-family:inherit;
    font-size:14px;
    color:#1a202c;
    outline:none;
    transition:all .2s;
}

.bnr-inp::placeholder { color:#94a3b8; }
.bnr-inp:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.1); }

.bnr-form {
    background:#fff;
    border:1.5px solid #e2e8f0;
    border-radius:12px;
    padding:24px;
    box-shadow:0 2px 8px rgba(0,0,0,.05);
    animation:bnr-fadeIn .3s ease;
}

.bnr-btns {
    display:flex;
    gap:12px;
}

.bnr-grid2 {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:16px;
}

/* Responsive: Tablet */
@media(max-width:768px) {
    .bnr-container { padding:16px 12px 50px; }
    .bnr-form { padding:18px 16px; }
    .bnr-grid2 { gap:14px; }
    .bnr-inp { font-size:13px; padding:10px 12px; }
}

/* Responsive: Phone */
@media(max-width:640px) {
    .bnr-container { padding:14px 10px 45px; }
    .bnr-form { padding:16px 14px; }
    .bnr-btns { flex-direction:column; }
    .bnr-grid2 { grid-template-columns:1fr; gap:12px; }
    .bnr-inp { font-size:13px; padding:10px 12px; }
}

/* Responsive: Small Phone */
@media(max-width:480px) {
    .bnr-container { padding:12px 8px 40px; }
    .bnr-form { padding:14px 12px; }
    .bnr-grid2 { gap:10px; }
}

/* Responsive: Extra Small */
@media(max-width:380px) {
    .bnr-container { padding:10px 8px 35px; }
    .bnr-form { padding:12px 10px; }
}
            `}</style>

            <div className="bnr-container">

                <div className="bnr-container">
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                        <button onClick={() => navigate("/admin/banners")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .2s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#3b82f6"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}>
                            <FiArrowLeft size={14} /> Back
                        </button>
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a202c", margin: 0 }}>Add Banner</h1>
                            <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Create a new homepage banner</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="bnr-form">

                            {/* Image Upload */}
                            <Field label="Banner Image" hint="(required, max 5MB)">
                                {!preview ? (
                                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: 140, border: "2px dashed #e2e8f0", borderRadius: 10, cursor: "pointer", transition: "all 0.2s", background: "#f8fafc" }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.background = "#eff6ff"; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}>
                                        <FiUpload size={22} color="#94a3b8" style={{ marginBottom: 8 }} />
                                        <p style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Click to upload banner image</p>
                                        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>PNG, JPG, WEBP · Recommended: 1440×500px</p>
                                        <input type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
                                    </label>
                                ) : (
                                    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                        <img src={preview} alt="preview" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                                        <button type="button" onClick={() => { setImageFile(null); setPreview(""); }}
                                            style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                            <FiX size={12} />
                                        </button>
                                    </div>
                                )}
                            </Field>

                            {/* Title */}
                            <Field label="Title" hint="(optional — shown as main heading)">
                                <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Summer Sale — Up to 70% Off"
                                    className="bnr-inp" />
                            </Field>

                            {/* Subtitle */}
                            <Field label="Subtitle" hint="(optional — shown below title)">
                                <input name="subtitle" value={form.subtitle} onChange={handleChange} placeholder="e.g. Limited time offer on fashion & electronics"
                                    className="bnr-inp" />
                            </Field>

                            {/* Description */}
                            <Field label="Description" hint="(optional — additional detail text)">
                                <textarea name="description" value={form.description} onChange={handleChange} placeholder="Detailed description shown on hover or expanded view..."
                                    rows={2} className="bnr-inp" style={{ resize: "vertical", lineHeight: 1.6 }} />
                            </Field>

                            {/* Link Type */}
                            <Field label="Click Action" hint="(what happens when user clicks)">
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {LINK_TYPES.map(lt => (
                                        <button key={lt.value} type="button" onClick={() => setForm(prev => ({ ...prev, linkType: lt.value, link: lt.value === "none" ? "" : prev.link }))}
                                            style={{ padding: "7px 12px", border: `2px solid ${form.linkType === lt.value ? "#2563eb" : "#e2e8f0"}`, borderRadius: 8, background: form.linkType === lt.value ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 11, fontWeight: form.linkType === lt.value ? 700 : 500, color: form.linkType === lt.value ? "#2563eb" : "#64748b", fontFamily: "inherit", transition: "all 0.2s" }}>
                                            {lt.icon} {lt.label}
                                        </button>
                                    ))}
                                </div>
                            </Field>

                            {/* Link URL (shown when linkType != none) */}
                            {form.linkType !== "none" && (
                                <Field label="Link URL" hint={`(${LINK_HINTS[form.linkType]})`}>
                                    <input name="link" value={form.link} onChange={handleChange} placeholder={LINK_HINTS[form.linkType]}
                                        className="bnr-inp" />
                                </Field>
                            )}

                            {/* Button Text (shown when linkType != none) */}
                            {form.linkType !== "none" && (
                                <Field label="Button Text" hint="(CTA label, e.g. 'Shop Now', 'View Deals')">
                                    <input name="buttonText" value={form.buttonText} onChange={handleChange} placeholder="e.g. Shop Now"
                                        className="bnr-inp" />
                                </Field>
                            )}

                            {/* Type & Placement */}
                            <div className="bnr-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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

                            {/* Schedule (Start & End Date) */}
                            <div className="bnr-grid2">
                                <Field label="Start Date" hint="(optional — leave empty for immediate)">
                                    <input name="startDate" type="datetime-local" value={form.startDate} onChange={handleChange}
                                        className="bnr-inp" />
                                </Field>
                                <Field label="End Date" hint="(optional — leave empty for no expiry)">
                                    <input name="endDate" type="datetime-local" value={form.endDate} onChange={handleChange}
                                        className="bnr-inp" />
                                </Field>
                            </div>

                            {/* Order + Active */}
                            <div className="bnr-grid2">
                                <Field label="Display Order" hint="(lower = first)">
                                    <input name="order" type="number" min="0" value={form.order} onChange={handleChange}
                                        className="bnr-inp" />
                                </Field>
                                <Field label="Status">
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", border: "1.5px solid #cbd5e1", borderRadius: 8, background: "#fff" }}>
                                        <span style={{ fontSize: 13, color: "#1a202c", fontWeight: 600 }}>Active</span>
                                        <button type="button" onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                                            style={{ position: "relative", width: 44, height: 24, borderRadius: 12, border: "none", background: form.isActive ? "linear-gradient(135deg,#3b82f6 0%,#1e40af 100%)" : "#cbd5e1", cursor: "pointer", transition: "background 0.25s" }}>
                                            <div style={{ position: "absolute", top: 2, left: form.isActive ? 22 : 2, width: 20, height: 20, background: "#fff", borderRadius: "50%", boxShadow: "0 2px 4px rgba(0,0,0,.15)", transition: "left 0.25s" }} />
                                        </button>
                                    </div>
                                </Field>
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                                    ⚠ {error}
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="bnr-btns">
                                <button type="button" onClick={() => navigate("/admin/banners")}
                                    style={{ flex: 1, padding: "12px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#64748b", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#cbd5e1"; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    style={{ flex: 1, padding: "12px", background: saving ? "#cbd5e1" : "linear-gradient(135deg,#3b82f6 0%,#1e40af 100%)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: saving ? "none" : "0 4px 12px rgba(59,130,246,.3)", transition: "all .2s" }}>
                                    {saving ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "ux-spin 0.8s linear infinite" }} />Saving...</> : "Add Banner"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AdminAddBanner;
