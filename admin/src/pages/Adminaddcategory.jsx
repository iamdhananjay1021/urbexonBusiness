import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCategory } from "../api/categoryApi";
import { FiArrowLeft, FiUpload, FiX } from "react-icons/fi";
import { Button, Badge, Card, ErrorState, FormField, Input } from "../components/ui";

const EMOJI_OPTIONS = ["👔", "👗", "🥻", "👜", "📱", "✨", "👟", "🎒", "⌚", "💍", "🕶️", "🧢", "🏷️"];

const hintSpan = (text) => (
    <span style={{ color: "var(--adm-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}> {text}</span>
);

const AdminAddCategory = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", emoji: "🏷️", color: "#1a1740", lightColor: "#f0eefb", isActive: true, order: 0, type: "ecommerce" });
    const [subcategories, setSubcategories] = useState([]);
    const [subInput, setSubInput] = useState("");
    const [highlightFields, setHighlightFields] = useState([]); // [{ title, required }]
    const [hlInput, setHlInput] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

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
            fd.append("subcategories", JSON.stringify(subcategories));
            fd.append("highlightTemplate", JSON.stringify(highlightFields));
            if (imageFile) fd.append("image", imageFile);
            await createCategory(fd);
            navigate("/admin/categories");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create category");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: 640, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <Button variant="secondary" icon={FiArrowLeft} onClick={() => navigate("/admin/categories")}>Back</Button>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Add Category</h1>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>Create a new product category</p>
                </div>
            </div>

            {/* Preview Card */}
            <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: "var(--adm-radius-lg)", background: form.lightColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid var(--adm-border)" }}>
                    {preview
                        ? <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 26 }}>{form.emoji}</span>
                    }
                </div>
                <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: form.color }}>{form.name || "Category Name"}</p>
                    <p style={{ fontSize: 11, color: "var(--adm-muted)" }}>Live preview</p>
                </div>
            </Card>

            <form onSubmit={handleSubmit}>
                <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Name */}
                    <FormField label="Category Name">
                        <Input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Men's Fashion" style={{ width: "100%" }} />
                    </FormField>

                    {/* Emoji Picker */}
                    <FormField label={<>Emoji{hintSpan("(shown if no image)")}</>}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {EMOJI_OPTIONS.map(em => (
                                <button key={em} type="button" onClick={() => setForm(prev => ({ ...prev, emoji: em }))}
                                    style={{ width: 38, height: 38, fontSize: 20, border: `2px solid ${form.emoji === em ? "var(--adm-primary)" : "var(--adm-border)"}`, borderRadius: "var(--adm-radius-md)", background: form.emoji === em ? "var(--adm-primary-tint)" : "var(--adm-surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {em}
                                </button>
                            ))}
                            <Input name="emoji" value={form.emoji} onChange={handleChange} placeholder="or type"
                                style={{ width: 80, textAlign: "center", fontSize: 18 }} />
                        </div>
                    </FormField>

                    {/* Colors */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <FormField label="Text Color">
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="color" value={form.color} onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
                                    style={{ width: 40, height: 38, border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", cursor: "pointer", padding: 2 }} />
                                <Input name="color" value={form.color} onChange={handleChange} style={{ flex: 1 }} />
                            </div>
                        </FormField>
                        <FormField label="Background Color">
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="color" value={form.lightColor} onChange={e => setForm(prev => ({ ...prev, lightColor: e.target.value }))}
                                    style={{ width: 40, height: 38, border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", cursor: "pointer", padding: 2 }} />
                                <Input name="lightColor" value={form.lightColor} onChange={handleChange} style={{ flex: 1 }} />
                            </div>
                        </FormField>
                    </div>

                    {/* Image Upload */}
                    <FormField label={<>Category Image{hintSpan("(optional, replaces emoji)")}</>}>
                        {!preview ? (
                            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: 100, border: "2px dashed var(--adm-border)", borderRadius: "var(--adm-radius-md)", cursor: "pointer", background: "var(--adm-surface-alt)" }}>
                                <FiUpload size={18} color="var(--adm-muted)" style={{ marginBottom: 6 }} />
                                <p style={{ fontSize: 12, color: "var(--adm-text-secondary)" }}>Upload category image</p>
                                <input type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
                            </label>
                        ) : (
                            <div style={{ position: "relative", width: 80, height: 80, borderRadius: "var(--adm-radius-md)", overflow: "hidden", border: "1px solid var(--adm-border)" }}>
                                <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                <button type="button" onClick={() => { setImageFile(null); setPreview(""); }}
                                    style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, background: "var(--adm-danger)", color: "var(--adm-text-on-accent)", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                    <FiX size={10} />
                                </button>
                            </div>
                        )}
                    </FormField>

                    {/* Type + Order + Active */}
                    <FormField label="Category Type">
                        <div style={{ display: "flex", gap: 10 }}>
                            {[{ value: "ecommerce", label: "🛒 Ecommerce" }, { value: "urbexon_hour", label: "⚡ Urbexon Hour" }].map(opt => (
                                <button key={opt.value} type="button" onClick={() => setForm(prev => ({ ...prev, type: opt.value }))}
                                    style={{ flex: 1, padding: "10px 14px", border: `2px solid ${form.type === opt.value ? "var(--adm-primary)" : "var(--adm-border)"}`, borderRadius: "var(--adm-radius-md)", background: form.type === opt.value ? "var(--adm-primary-tint)" : "var(--adm-surface)", cursor: "pointer", fontSize: 13, fontWeight: form.type === opt.value ? 700 : 500, color: form.type === opt.value ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontFamily: "inherit", transition: "all 0.2s" }}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </FormField>

                    {/* Subcategories */}
                    <FormField label={<>Subcategories{hintSpan("(press Enter to add)")}</>}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: subcategories.length ? 10 : 0 }}>
                            {subcategories.map((sub, i) => (
                                <Badge key={i} tone="primary">
                                    {sub}
                                    <button type="button" onClick={() => setSubcategories(prev => prev.filter((_, j) => j !== i))}
                                        style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", fontSize: 14, lineHeight: 1, opacity: 0.6 }}>×</button>
                                </Badge>
                            ))}
                        </div>
                        <Input
                            value={subInput}
                            onChange={e => setSubInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    const val = subInput.trim();
                                    if (val && !subcategories.includes(val)) setSubcategories(prev => [...prev, val]);
                                    setSubInput("");
                                }
                            }}
                            placeholder="e.g. Shirts, Shoes, Laptops"
                            style={{ width: "100%" }}
                        />
                    </FormField>

                    {/* Highlight Template */}
                    <FormField label={<>Product Highlight Fields{hintSpan("(template for products in this category)")}</>}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: highlightFields.length ? 10 : 0 }}>
                            {highlightFields.map((hl, i) => (
                                <Badge key={i} tone={hl.required ? "warning" : "success"}>
                                    {hl.title}
                                    {hl.required && <span style={{ fontSize: 9, background: "var(--adm-warning)", color: "var(--adm-text-on-accent)", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>REQ</span>}
                                    <button type="button" onClick={() => {
                                        const next = [...highlightFields];
                                        next[i] = { ...next[i], required: !next[i].required };
                                        setHighlightFields(next);
                                    }} title="Toggle required" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "inherit", padding: 0, opacity: 0.7 }}>⚙</button>
                                    <button type="button" onClick={() => setHighlightFields(prev => prev.filter((_, j) => j !== i))}
                                        style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", fontSize: 14, lineHeight: 1, opacity: 0.6 }}>×</button>
                                </Badge>
                            ))}
                        </div>
                        <Input
                            value={hlInput}
                            onChange={e => setHlInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    const val = hlInput.trim();
                                    if (val && !highlightFields.some(h => h.title === val)) {
                                        setHighlightFields(prev => [...prev, { title: val, required: false }]);
                                    }
                                    setHlInput("");
                                }
                            }}
                            placeholder="e.g. Weight, Brand, Expiry Date (press Enter)"
                            style={{ width: "100%" }}
                        />
                        <p style={{ fontSize: 10, color: "var(--adm-muted)", marginTop: 4 }}>These fields will auto-load when vendors add products in this category. Click ⚙ to toggle required.</p>
                    </FormField>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <FormField label="Display Order">
                            <Input name="order" type="number" min="0" value={form.order} onChange={handleChange} style={{ width: "100%" }} />
                        </FormField>
                        <FormField label="Status">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)" }}>
                                <span style={{ fontSize: 13, color: "var(--adm-text-primary)", fontWeight: 500 }}>Active</span>
                                <button type="button" onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                                    style={{ position: "relative", width: 44, height: 24, borderRadius: "var(--adm-radius-full)", border: "none", background: form.isActive ? "var(--adm-primary)" : "var(--adm-border)", cursor: "pointer", transition: "background 0.2s" }}>
                                    <div style={{ position: "absolute", top: 2, width: 20, height: 20, background: "var(--adm-surface)", borderRadius: "50%", boxShadow: "var(--adm-shadow-sm)", transition: "left 0.2s", left: form.isActive ? 22 : 2 }} />
                                </button>
                            </div>
                        </FormField>
                    </div>

                    {error && <ErrorState message={error} />}

                    <div style={{ display: "flex", gap: 10 }}>
                        <Button type="button" variant="secondary" onClick={() => navigate("/admin/categories")} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" loading={saving} style={{ flex: 1 }}>
                            {saving ? "Saving..." : "Add Category"}
                        </Button>
                    </div>
                </Card>
            </form>
        </div>
    );
};

export default AdminAddCategory;
