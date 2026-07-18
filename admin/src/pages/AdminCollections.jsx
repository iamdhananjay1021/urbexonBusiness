/**
 * AdminCollections.jsx — Collection Engine management.
 * Collections are rule-based saved queries (Festival Collection = tags +
 * min discount, Best Sellers = sort by sales, …). Products populate
 * automatically; admin only edits the rules here.
 */
import { useEffect, useState } from "react";
import adminApi from "../api/adminApi";
import { FiPlus, FiEdit2, FiTrash2, FiExternalLink } from "react-icons/fi";
import { Button, Badge, Card, ErrorState, FormField, Input, Select } from "../components/ui";

const SORTS = ["newest", "popularity", "recommended", "rating", "discount", "price_asc", "price_desc"];

const EMPTY = {
    name: "", description: "", sort: "newest", order: 0, isActive: true,
    seoTitle: "", seoDescription: "",
    rules: { category: "", tags: "", brand: "", isDeal: false, isFeatured: false, minRating: 0, minDiscount: 0, maxAgeDays: 0 },
};

const toForm = (c) => ({
    name: c.name || "", description: c.description || "",
    sort: c.sort || "newest", order: c.order || 0, isActive: c.isActive !== false,
    seoTitle: c.seo?.title || "", seoDescription: c.seo?.description || "",
    rules: {
        category: c.rules?.category || "",
        tags: (c.rules?.tags || []).join(", "),
        brand: c.rules?.brand || "",
        isDeal: !!c.rules?.isDeal,
        isFeatured: !!c.rules?.isFeatured,
        minRating: c.rules?.minRating || 0,
        minDiscount: c.rules?.minDiscount || 0,
        maxAgeDays: c.rules?.maxAgeDays || 0,
    },
});

const AdminCollections = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState(null);   // null | "new" | collection._id
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        adminApi.get("/collections/admin/all")
            .then(r => setCollections(r.data?.collections || []))
            .catch(() => setError("Failed to load collections"))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    const openNew = () => { setForm(EMPTY); setEditing("new"); setError(""); };
    const openEdit = (c) => { setForm(toForm(c)); setEditing(c._id); setError(""); };

    const save = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return setError("Name is required");
        try {
            setSaving(true); setError("");
            const payload = {
                name: form.name, description: form.description, sort: form.sort,
                order: form.order, isActive: form.isActive,
                seoTitle: form.seoTitle, seoDescription: form.seoDescription,
                rules: { ...form.rules, tags: form.rules.tags },
            };
            if (editing === "new") await adminApi.post("/collections/admin", payload);
            else await adminApi.put(`/collections/admin/${editing}`, payload);
            setEditing(null);
            load();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save collection");
        } finally { setSaving(false); }
    };

    const remove = async (c) => {
        if (!window.confirm(`Delete collection "${c.name}"?`)) return;
        try { await adminApi.delete(`/collections/admin/${c._id}`); load(); }
        catch { setError("Failed to delete"); }
    };

    const setRule = (key, value) => setForm(p => ({ ...p, rules: { ...p.rules, [key]: value } }));

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Collections</h1>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>
                        Rule-based collections — products populate automatically from the rules
                    </p>
                </div>
                <Button variant="primary" icon={FiPlus} onClick={openNew}>New Collection</Button>
            </div>

            {error && !editing && <ErrorState message={error} />}

            {/* ── Editor ── */}
            {editing && (
                <Card style={{ marginBottom: 20 }}>
                    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>
                            {editing === "new" ? "New Collection" : "Edit Collection"}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                            <FormField label="Name">
                                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Festival Collection" />
                            </FormField>
                            <FormField label="Default Sort">
                                <Select value={form.sort} onChange={e => setForm(p => ({ ...p, sort: e.target.value }))}>
                                    {SORTS.map(s => <option key={s} value={s}>{s}</option>)}
                                </Select>
                            </FormField>
                            <FormField label="Order">
                                <Input type="number" min="0" value={form.order} onChange={e => setForm(p => ({ ...p, order: e.target.value }))} />
                            </FormField>
                        </div>
                        <FormField label="Description">
                            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Shown on the collection page" maxLength={300} />
                        </FormField>

                        {/* Rules */}
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-text-secondary)", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 4 }}>Rules (all optional — combined with AND)</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                            <FormField label="Category (slug)">
                                <Input value={form.rules.category} onChange={e => setRule("category", e.target.value)} placeholder="e.g. mens-fashion" />
                            </FormField>
                            <FormField label="Tags (comma separated)">
                                <Input value={form.rules.tags} onChange={e => setRule("tags", e.target.value)} placeholder="festive, wedding" />
                            </FormField>
                            <FormField label="Brand">
                                <Input value={form.rules.brand} onChange={e => setRule("brand", e.target.value)} placeholder="e.g. Nike" />
                            </FormField>
                            <FormField label="Min Rating (0–5)">
                                <Input type="number" min="0" max="5" step="0.5" value={form.rules.minRating} onChange={e => setRule("minRating", e.target.value)} />
                            </FormField>
                            <FormField label="Min Discount %">
                                <Input type="number" min="0" max="99" value={form.rules.minDiscount} onChange={e => setRule("minDiscount", e.target.value)} />
                            </FormField>
                            <FormField label="Max Age (days, 0 = any)">
                                <Input type="number" min="0" value={form.rules.maxAgeDays} onChange={e => setRule("maxAgeDays", e.target.value)} />
                            </FormField>
                        </div>
                        <div style={{ display: "flex", gap: 18 }}>
                            {[["isDeal", "Deals only"], ["isFeatured", "Featured only"]].map(([k, label]) => (
                                <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--adm-text-secondary)", cursor: "pointer" }}>
                                    <input type="checkbox" checked={!!form.rules[k]} onChange={e => setRule(k, e.target.checked)} /> {label}
                                </label>
                            ))}
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--adm-text-secondary)", cursor: "pointer", marginLeft: "auto" }}>
                                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} /> Active
                            </label>
                        </div>

                        {/* SEO */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <FormField label="SEO Title"><Input value={form.seoTitle} onChange={e => setForm(p => ({ ...p, seoTitle: e.target.value }))} maxLength={120} /></FormField>
                            <FormField label="SEO Description"><Input value={form.seoDescription} onChange={e => setForm(p => ({ ...p, seoDescription: e.target.value }))} maxLength={200} /></FormField>
                        </div>

                        {error && <ErrorState message={error} />}
                        <div style={{ display: "flex", gap: 10 }}>
                            <Button type="button" variant="secondary" onClick={() => setEditing(null)} style={{ flex: 1 }}>Cancel</Button>
                            <Button type="submit" variant="primary" loading={saving} style={{ flex: 1 }}>{saving ? "Saving…" : "Save Collection"}</Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* ── List ── */}
            {loading ? (
                <Card><p style={{ fontSize: 13, color: "var(--adm-muted)", textAlign: "center", padding: 20 }}>Loading…</p></Card>
            ) : collections.length === 0 && !editing ? (
                <Card>
                    <p style={{ fontSize: 13, color: "var(--adm-muted)", textAlign: "center", padding: 24 }}>
                        No collections yet. Create "New Arrivals", "Best Sellers", or a "Festival Collection" — products fill in automatically from the rules.
                    </p>
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {collections.map((c) => (
                        <Card key={c._id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-text-primary)" }}>{c.name}</p>
                                    <Badge tone={c.isActive ? "success" : "danger"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                                </div>
                                <p style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 3 }}>
                                    /collections/{c.slug} · sort: {c.sort}
                                    {c.rules?.category ? ` · category: ${c.rules.category}` : ""}
                                    {c.rules?.tags?.length ? ` · tags: ${c.rules.tags.join(",")}` : ""}
                                    {c.rules?.minDiscount ? ` · ≥${c.rules.minDiscount}% off` : ""}
                                    {c.rules?.isDeal ? " · deals" : ""}{c.rules?.isFeatured ? " · featured" : ""}
                                </p>
                            </div>
                            <a href={`https://www.urbexon.in/collections/${c.slug}`} target="_blank" rel="noreferrer"
                                title="View on storefront"
                                style={{ color: "var(--adm-muted)", display: "flex", padding: 6 }}>
                                <FiExternalLink size={14} />
                            </a>
                            <Button variant="secondary" icon={FiEdit2} onClick={() => openEdit(c)}>Edit</Button>
                            <button onClick={() => remove(c)} title="Delete"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-danger)", padding: 6 }}>
                                <FiTrash2 size={15} />
                            </button>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminCollections;
