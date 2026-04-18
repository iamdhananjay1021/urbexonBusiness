import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { FaUpload, FaArrowLeft, FaTrash, FaBolt } from "react-icons/fa";

const Field = ({ label, required, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>{label}{required && <span style={{ color: "#ef4444" }}> *</span>}</label>
    {children}
  </div>
);
const Inp = (props) => <input {...props} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#1e293b", outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fafafe", ...props.style }} />;

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState([]);
  const [form, setForm] = useState({
    name: "", description: "", price: "", mrp: "", category: "", subcategory: "", tags: "",
    stock: "", prepTimeMinutes: "10", maxOrderQty: "10",
    isDeal: false, dealEndsAt: "",
  });
  const [highlights, setHighlights] = useState([]); // [{ title, value }]
  const [highlightTemplate, setHighlightTemplate] = useState([]); // from category
  const [customHighlight, setCustomHighlight] = useState({ title: "", value: "" });

  // Fetch dynamic categories (with subcategories)
  useEffect(() => {
    api.get("/categories", { params: { type: "urbexon_hour" } })
      .then(({ data }) => {
        const cats = Array.isArray(data) ? data : data.categories || [];
        setCategoryList(cats.filter(c => c.isActive !== false));
      })
      .catch(() => { });
  }, []);

  // Update subcategory options when category changes
  useEffect(() => {
    if (!form.category) { setSubcategoryOptions([]); setHighlightTemplate([]); return; }
    const cat = categoryList.find(c => c.name === form.category);
    setSubcategoryOptions(Array.isArray(cat?.subcategories) ? cat.subcategories : []);

    // Fetch highlight template for this category
    api.get("/categories/highlight-template", { params: { name: form.category } })
      .then(({ data }) => {
        const tmpl = data.highlightTemplate || [];
        setHighlightTemplate(tmpl);
        // Pre-populate highlights with template titles if not already set
        if (tmpl.length > 0 && highlights.length === 0) {
          setHighlights(tmpl.map(t => ({ title: t.title, value: "" })));
        }
      })
      .catch(() => setHighlightTemplate([]));
  }, [form.category, categoryList]);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api.get(`/products/${id}`).then(({ data }) => {
      setForm({ name: data.name || "", description: data.description || "", price: data.price || "", mrp: data.mrp || "", category: data.category || "", subcategory: data.subcategory || "", tags: (data.tags || []).join(", "), stock: data.stock || "", prepTimeMinutes: data.prepTimeMinutes || "10", maxOrderQty: data.maxOrderQty || "10", isDeal: !!data.isDeal, dealEndsAt: data.dealEndsAt ? new Date(data.dealEndsAt).toISOString().slice(0, 16) : "" });
      setExistingImages(data.images || []);
      if (Array.isArray(data.highlightsArray) && data.highlightsArray.length > 0) {
        setHighlights(data.highlightsArray);
      }
    }).catch(() => setError("Failed to load product")).finally(() => setLoading(false));
  }, [id]);

  const onChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const onImages = e => {
    const files = Array.from(e.target.files);
    const previews = files.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setImages(p => [...p, ...previews].slice(0, 4));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) return setError("Name, price and category required");
    try {
      setSaving(true); setError("");
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      // Add structured highlights
      const validHighlights = highlights.filter(h => h.title.trim() && h.value.trim());
      fd.append("highlightsArray", JSON.stringify(validHighlights));
      images.forEach(img => fd.append("images", img.file));
      if (isEdit) await api.put(`/products/vendor/${id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      else await api.post("/products/vendor", fd, { headers: { "Content-Type": "multipart/form-data" } });
      navigate("/products");
    } catch (err) { setError(err?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <style>{`
        .product-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .product-form-grid .full-width { grid-column: 1 / -1; }
        .product-img-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
        @media (max-width: 640px) {
          .product-form-grid { grid-template-columns: 1fr !important; }
          .product-img-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate("/products")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
          <FaArrowLeft size={11} /> Back
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", margin: 0 }}>{isEdit ? "Edit Product" : "Add New Product"}</h1>
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#1d4ed8" }}>
        ℹ️ This product will appear in the <strong>Urbexon Hour</strong> section for local express delivery.
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 16 }}>{error}</div>}

      <form onSubmit={submit}>
        <div className="product-form-grid">
          <div className="full-width">
            <Field label="Product Name" required><Inp name="name" value={form.name} onChange={onChange} placeholder="e.g. Fresh Samosa Plate" /></Field>
          </div>
          <div className="full-width">
            <Field label="Description">
              <textarea name="description" value={form.description} onChange={onChange} rows={3} placeholder="Describe your product…" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            </Field>
          </div>
          <Field label="Category" required>
            <select name="category" value={form.category} onChange={onChange} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fafafe" }}>
              <option value="">Select category</option>
              {categoryList.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Subcategory">
            {subcategoryOptions.length > 0 ? (
              <select name="subcategory" value={form.subcategory} onChange={onChange} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fafafe" }}>
                <option value="">Select subcategory</option>
                {subcategoryOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <Inp name="subcategory" value={form.subcategory} onChange={onChange} placeholder="e.g. Snacks, Beverages, Shirts" />
            )}
          </Field>
          <Field label="Tags (comma separated)"><Inp name="tags" value={form.tags} onChange={onChange} placeholder="e.g. snacks, veg, spicy" /></Field>
          <Field label="Selling Price (₹)" required><Inp name="price" type="number" value={form.price} onChange={onChange} placeholder="99" /></Field>
          <Field label="MRP / Original Price (₹)"><Inp name="mrp" type="number" value={form.mrp} onChange={onChange} placeholder="149" /></Field>
          <Field label="Available Stock" required><Inp name="stock" type="number" value={form.stock} onChange={onChange} placeholder="50" /></Field>
          <Field label="Max Order Qty"><Inp name="maxOrderQty" type="number" value={form.maxOrderQty} onChange={onChange} /></Field>
          <Field label="Prep Time (mins)"><Inp name="prepTimeMinutes" type="number" value={form.prepTimeMinutes} onChange={onChange} /></Field>
        </div>

        {/* Product Highlights */}
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            ✨ Product Highlights
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>
              {highlightTemplate.length > 0 ? "(auto-loaded for this category)" : "(add details about your product)"}
            </span>
          </div>

          {highlights.map((h, i) => {
            const isRequired = highlightTemplate.find(t => t.title === h.title)?.required;
            return (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <Inp
                  value={h.title}
                  onChange={e => {
                    const next = [...highlights];
                    next[i] = { ...next[i], title: e.target.value };
                    setHighlights(next);
                  }}
                  placeholder="e.g. Weight"
                  style={{ flex: "0 0 35%", fontSize: 12, padding: "8px 10px" }}
                  readOnly={highlightTemplate.some(t => t.title === h.title)}
                />
                <Inp
                  value={h.value}
                  onChange={e => {
                    const next = [...highlights];
                    next[i] = { ...next[i], value: e.target.value };
                    setHighlights(next);
                  }}
                  placeholder="e.g. 1kg"
                  style={{ flex: 1, fontSize: 12, padding: "8px 10px", borderColor: isRequired && !h.value.trim() ? "#fca5a5" : undefined }}
                />
                <button type="button" onClick={() => setHighlights(p => p.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
                  <FaTrash size={11} />
                </button>
              </div>
            );
          })}

          {/* Add custom highlight */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <Inp
              value={customHighlight.title}
              onChange={e => setCustomHighlight(p => ({ ...p, title: e.target.value }))}
              placeholder="Add highlight name…"
              style={{ flex: "0 0 35%", fontSize: 12, padding: "8px 10px" }}
            />
            <Inp
              value={customHighlight.value}
              onChange={e => setCustomHighlight(p => ({ ...p, value: e.target.value }))}
              placeholder="Value"
              style={{ flex: 1, fontSize: 12, padding: "8px 10px" }}
            />
            <button type="button" onClick={() => {
              if (customHighlight.title.trim() && customHighlight.value.trim()) {
                setHighlights(p => [...p, { title: customHighlight.title.trim(), value: customHighlight.value.trim() }]);
                setCustomHighlight({ title: "", value: "" });
              }
            }} style={{ background: "#1a1740", color: "#c9a84c", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              + Add
            </button>
          </div>
        </div>

        {/* Deal toggle */}
        <div style={{ background: form.isDeal ? "#fffbeb" : "#f8fafc", border: `1.5px solid ${form.isDeal ? "#fbbf24" : "#e2e8f0"}`, borderRadius: 10, padding: "14px 16px", marginTop: 16, transition: "all .2s" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div onClick={() => setForm(p => ({ ...p, isDeal: !p.isDeal, dealEndsAt: p.isDeal ? "" : p.dealEndsAt }))} style={{ width: 38, height: 22, borderRadius: 11, background: form.isDeal ? "#f59e0b" : "#cbd5e1", position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: form.isDeal ? 18 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 5 }}><FaBolt size={11} style={{ color: "#f59e0b" }} /> Mark as Deal</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Shows in Flash Deals section with special badge</div>
            </div>
          </label>
          {form.isDeal && (
            <div style={{ marginTop: 12 }}>
              <Field label="Deal Ends At (optional)">
                <Inp name="dealEndsAt" type="datetime-local" value={form.dealEndsAt} onChange={onChange} />
                <p style={{ fontSize: 10, color: "#94a3b8", margin: "4px 0 0" }}>Leave blank for no expiry</p>
              </Field>
            </div>
          )}
        </div>

        {/* Images */}
        <Field label="Product Photos (max 4)">
          <div className="product-img-grid">
            {existingImages.map((img, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={img.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
              </div>
            ))}
            {images.map((img, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={img.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
                <button type="button" onClick={() => setImages(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, background: "#ef4444", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FaTrash size={9} />
                </button>
              </div>
            ))}
            {(existingImages.length + images.length) < 4 && (
              <label style={{ border: "2px dashed #e2e8f0", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "1", cursor: "pointer", color: "#94a3b8", fontSize: 12, gap: 6, transition: "all .2s" }}>
                <FaUpload size={18} /><span>Add Photo</span>
                <input type="file" accept="image/*" multiple onChange={onImages} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button type="submit" disabled={saving} style={{ flex: 1, padding: 13, background: "#1a1740", border: "none", color: "#c9a84c", fontWeight: 700, fontSize: 13, letterSpacing: 2, borderRadius: 8, cursor: "pointer" }}>
            {saving ? "Saving…" : isEdit ? "Update Product" : "Add Product"}
          </button>
          <button type="button" onClick={() => navigate("/products")} style={{ padding: "13px 20px", border: "1.5px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, background: "#fff", color: "#64748b" }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
export default ProductForm;
