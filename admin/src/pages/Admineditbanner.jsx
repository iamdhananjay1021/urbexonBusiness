import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAllBanners, updateBanner } from "../api/bannerApi";
import { FiArrowLeft, FiUpload, FiX } from "react-icons/fi";
import { Button, ErrorState, Input } from "../components/ui";

const Field = ({ label, hint, children }) => (
    <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--adm-text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            {label} {hint && <span style={{ color: "var(--adm-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{hint}</span>}
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

const toLocalDT = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const AdminEditBanner = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: "", subtitle: "", description: "", link: "", linkType: "none", buttonText: "",
        isActive: true, order: 0, type: "ecommerce", placement: "hero", startDate: "", endDate: "",
    });
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
                setForm({
                    title: banner.title || "",
                    subtitle: banner.subtitle || "",
                    description: banner.description || "",
                    link: banner.link || "",
                    linkType: banner.linkType || (banner.link ? "route" : "none"),
                    buttonText: banner.buttonText || "",
                    isActive: banner.isActive,
                    order: banner.order || 0,
                    type: banner.type || "ecommerce",
                    placement: banner.placement || "hero",
                    startDate: toLocalDT(banner.startDate),
                    endDate: toLocalDT(banner.endDate),
                });
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
            <span className="adm-btn-spinner" style={{ width: 36, height: 36, borderWidth: 3, color: "var(--adm-primary)" }} />
        </div>
    );

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: "100%", margin: "0 auto", padding: "20px 16px 60px", color: "var(--adm-text-primary)" }}>
            <style>{`
.bnr-container { width:100%; max-width:720px; margin:0 auto; }
.bnr-form {
    background: var(--adm-surface);
    border: 1.5px solid var(--adm-border);
    border-radius: var(--adm-radius-lg);
    padding: 24px;
    box-shadow: var(--adm-shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 18px;
}
.bnr-btns { display:flex; gap:12px; }
.bnr-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

@media(max-width:768px) {
    .bnr-container { padding:16px 12px 50px; }
    .bnr-form { padding:18px 16px; }
    .bnr-grid2 { gap:14px; }
}

@media(max-width:640px) {
    .bnr-container { padding:14px 10px 45px; }
    .bnr-form { padding:16px 14px; }
    .bnr-btns { flex-direction:column; }
    .bnr-grid2 { grid-template-columns:1fr; gap:12px; }
}

@media(max-width:480px) {
    .bnr-container { padding:12px 8px 40px; }
    .bnr-form { padding:14px 12px; }
    .bnr-grid2 { gap:10px; }
}
            `}</style>

            <div className="bnr-container">
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <Button variant="secondary" icon={FiArrowLeft} onClick={() => navigate("/admin/banners")}>Back</Button>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", margin: 0 }}>Edit Banner</h1>
                        <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>Update banner details & settings</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="bnr-form">

                        {/* Current / New Image */}
                        <Field label="Banner Image" hint="(upload new to replace)">
                            {!preview && currentImage && (
                                <div style={{ marginBottom: 10 }}>
                                    <p style={{ fontSize: 11, color: "var(--adm-muted)", marginBottom: 6 }}>Current image:</p>
                                    <div style={{ borderRadius: "var(--adm-radius-md)", overflow: "hidden", border: "1px solid var(--adm-border)" }}>
                                        <img src={currentImage} alt="current" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                                    </div>
                                </div>
                            )}
                            {!preview ? (
                                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: 100, border: "2px dashed var(--adm-border)", borderRadius: "var(--adm-radius-md)", cursor: "pointer", background: "var(--adm-surface-alt)" }}>
                                    <FiUpload size={18} color="var(--adm-muted)" style={{ marginBottom: 6 }} />
                                    <p style={{ fontSize: 12, color: "var(--adm-text-secondary)" }}>Upload new image to replace</p>
                                    <input type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
                                </label>
                            ) : (
                                <div style={{ position: "relative", borderRadius: "var(--adm-radius-md)", overflow: "hidden", border: "1px solid var(--adm-border)" }}>
                                    <img src={preview} alt="preview" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                                    <button type="button" onClick={() => { setImageFile(null); setPreview(""); }}
                                        style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, background: "var(--adm-danger)", color: "var(--adm-text-on-accent)", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                        <FiX size={11} />
                                    </button>
                                </div>
                            )}
                        </Field>

                        {/* Title */}
                        <Field label="Title" hint="(optional — shown as main heading)">
                            <Input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Summer Sale — Up to 70% Off" style={{ width: "100%", boxSizing: "border-box" }} />
                        </Field>

                        {/* Subtitle */}
                        <Field label="Subtitle" hint="(optional — shown below title)">
                            <Input name="subtitle" value={form.subtitle} onChange={handleChange} placeholder="e.g. Limited time offer" style={{ width: "100%", boxSizing: "border-box" }} />
                        </Field>

                        {/* Description */}
                        <Field label="Description" hint="(optional — additional detail text)">
                            <textarea name="description" value={form.description} onChange={handleChange} placeholder="Detailed description..."
                                rows={2} className="adm-field-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                        </Field>

                        {/* Link Type */}
                        <Field label="Click Action" hint="(what happens when user clicks)">
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {LINK_TYPES.map(lt => (
                                    <button key={lt.value} type="button" onClick={() => setForm(prev => ({ ...prev, linkType: lt.value, link: lt.value === "none" ? "" : prev.link }))}
                                        style={{ padding: "7px 12px", border: `2px solid ${form.linkType === lt.value ? "var(--adm-primary)" : "var(--adm-border)"}`, borderRadius: "var(--adm-radius-md)", background: form.linkType === lt.value ? "var(--adm-primary-tint)" : "var(--adm-surface)", cursor: "pointer", fontSize: 11, fontWeight: form.linkType === lt.value ? 700 : 500, color: form.linkType === lt.value ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontFamily: "inherit" }}>
                                        {lt.icon} {lt.label}
                                    </button>
                                ))}
                            </div>
                        </Field>

                        {/* Link URL */}
                        {form.linkType !== "none" && (
                            <Field label="Link URL" hint={`(${LINK_HINTS[form.linkType]})`}>
                                <Input name="link" value={form.link} onChange={handleChange} placeholder={LINK_HINTS[form.linkType]} style={{ width: "100%", boxSizing: "border-box" }} />
                            </Field>
                        )}

                        {/* Button Text */}
                        {form.linkType !== "none" && (
                            <Field label="Button Text" hint="(CTA label, e.g. 'Shop Now', 'View Deals')">
                                <Input name="buttonText" value={form.buttonText} onChange={handleChange} placeholder="e.g. Shop Now" style={{ width: "100%", boxSizing: "border-box" }} />
                            </Field>
                        )}

                        {/* Type & Placement */}
                        <div className="bnr-grid2">
                            <Field label="Banner Type">
                                <div style={{ display: "flex", gap: 8 }}>
                                    {[{ value: "ecommerce", label: "🛒 Ecommerce" }, { value: "urbexon_hour", label: "⚡ Urbexon Hour" }].map(opt => (
                                        <button key={opt.value} type="button" onClick={() => setForm(prev => ({ ...prev, type: opt.value }))}
                                            style={{ flex: 1, padding: "9px 10px", border: `2px solid ${form.type === opt.value ? "var(--adm-primary)" : "var(--adm-border)"}`, borderRadius: "var(--adm-radius-md)", background: form.type === opt.value ? "var(--adm-primary-tint)" : "var(--adm-surface)", cursor: "pointer", fontSize: 12, fontWeight: form.type === opt.value ? 700 : 500, color: form.type === opt.value ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontFamily: "inherit" }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </Field>
                            <Field label="Placement">
                                <div style={{ display: "flex", gap: 8 }}>
                                    {[{ value: "hero", label: "🖼️ Hero" }, { value: "mid", label: "📰 Mid-Page" }].map(opt => (
                                        <button key={opt.value} type="button" onClick={() => setForm(prev => ({ ...prev, placement: opt.value }))}
                                            style={{ flex: 1, padding: "9px 10px", border: `2px solid ${form.placement === opt.value ? "var(--adm-primary)" : "var(--adm-border)"}`, borderRadius: "var(--adm-radius-md)", background: form.placement === opt.value ? "var(--adm-primary-tint)" : "var(--adm-surface)", cursor: "pointer", fontSize: 12, fontWeight: form.placement === opt.value ? 700 : 500, color: form.placement === opt.value ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontFamily: "inherit" }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </Field>
                        </div>

                        {/* Schedule */}
                        <div className="bnr-grid2">
                            <Field label="Start Date" hint="(optional)">
                                <Input name="startDate" type="datetime-local" value={form.startDate} onChange={handleChange} style={{ width: "100%", boxSizing: "border-box" }} />
                            </Field>
                            <Field label="End Date" hint="(optional)">
                                <Input name="endDate" type="datetime-local" value={form.endDate} onChange={handleChange} style={{ width: "100%", boxSizing: "border-box" }} />
                            </Field>
                        </div>

                        {/* Order + Active */}
                        <div className="bnr-grid2">
                            <Field label="Display Order" hint="(lower = first)">
                                <Input name="order" type="number" min="0" value={form.order} onChange={handleChange} style={{ width: "100%", boxSizing: "border-box" }} />
                            </Field>
                            <Field label="Status">
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", background: "var(--adm-surface)" }}>
                                    <span style={{ fontSize: 13, color: "var(--adm-text-primary)", fontWeight: 500 }}>Active</span>
                                    <button type="button" onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                                        style={{ position: "relative", width: 44, height: 24, borderRadius: "var(--adm-radius-full)", border: "none", background: form.isActive ? "var(--adm-primary)" : "var(--adm-border)", cursor: "pointer", transition: "background 0.2s" }}>
                                        <div style={{ position: "absolute", top: 2, width: 20, height: 20, background: "var(--adm-surface)", borderRadius: "50%", boxShadow: "var(--adm-shadow-sm)", transition: "left 0.2s", left: form.isActive ? 22 : 2 }} />
                                    </button>
                                </div>
                            </Field>
                        </div>

                        {/* Error */}
                        {error && <ErrorState message={error} />}

                        {/* Buttons */}
                        <div className="bnr-btns">
                            <Button type="button" variant="secondary" style={{ flex: 1 }} onClick={() => navigate("/admin/banners")}>Cancel</Button>
                            <Button type="submit" variant="primary" style={{ flex: 1 }} loading={saving}>
                                {saving ? "Updating..." : "Update Banner"}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminEditBanner;
