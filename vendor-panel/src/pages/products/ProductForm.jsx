import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { FaUpload, FaArrowLeft, FaTrash, FaBolt, FaPlus } from "react-icons/fa";

const Field = ({ label, required, children, hint }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
      {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      {hint && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "#94a3b8" }}> {hint}</span>}
    </label>
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
    brand: "", sku: "", gstPercent: "0", hsn: "", barcode: "", lowStockThreshold: "5",
    metaTitle: "", metaDesc: "",
    isCancellable: true, isReturnable: true, isReplaceable: false,
    returnWindow: "7", replacementWindow: "7", cancelWindow: "0", nonReturnableReason: "",
    returnConditions: ["damaged", "wrong_product", "defective"],
    packagingRequired: false, tagsRequired: false, returnMethod: "self_ship",
  });
  // Marketplace-wide guardrails (admin-configured) — vendor can only pick
  // values within these bounds. Falls back to the schema's own hard
  // ceiling if the config hasn't loaded yet, so the inputs are never
  // unbounded even for a moment.
  const [policyLimits, setPolicyLimits] = useState({
    minReturnWindowDays: 0, maxReturnWindowDays: 30,
    minReplacementWindowDays: 0, maxReplacementWindowDays: 30,
    minCancelWindowHours: 0, maxCancelWindowHours: 72,
    allowedReturnConditions: ["damaged", "wrong_product", "defective", "missing_items", "other"],
  });
  const [sizes, setSizes] = useState([]); // [{ size, stock }] — optional, for apparel/footwear-style UH categories
  const [newSize, setNewSize] = useState({ size: "", stock: "" });
  const [highlights, setHighlights] = useState([]); // [{ title, value }]
  const [highlightTemplate, setHighlightTemplate] = useState([]); // from category
  const [customHighlight, setCustomHighlight] = useState({ title: "", value: "" });
  // Metadata-driven attributes — fields auto-render from the category's
  // attributeSchema (defined by admin); values power storefront filters.
  const [attributeSchema, setAttributeSchema] = useState([]);
  const [attributes, setAttributes] = useState({}); // { key: value }

  // Fetch dynamic categories (with subcategories)
  useEffect(() => {
    api.get("/categories", { params: { type: "urbexon_hour" } })
      .then(({ data }) => {
        const cats = Array.isArray(data) ? data : data.categories || [];
        setCategoryList(cats.filter(c => c.isActive !== false));
      })
      .catch(() => { });
  }, []);

  // Marketplace-wide return/replacement/cancel window bounds — reuses the
  // existing public delivery-config endpoint rather than a new route.
  useEffect(() => {
    api.get("/delivery-config/public")
      .then(({ data }) => {
        if (data?.productPolicyLimits) {
          setPolicyLimits((p) => ({ ...p, ...data.productPolicyLimits }));
        }
      })
      .catch(() => { });
  }, []);

  // Update subcategory options when category changes
  useEffect(() => {
    if (!form.category) { setSubcategoryOptions([]); setHighlightTemplate([]); setAttributeSchema([]); return; }
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

    // Fetch attribute schema (discovery metadata) — no code changes needed
    // when admin adds a new category with new attributes.
    if (cat?.slug) {
      api.get(`/categories/${cat.slug}/metadata`, { params: { productType: "urbexon_hour" } })
        .then(({ data }) => setAttributeSchema(data?.metadata?.attributeSchema || []))
        .catch(() => setAttributeSchema([]));
    } else {
      setAttributeSchema([]);
    }
  }, [form.category, categoryList]);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api.get(`/products/${id}`).then(({ data }) => {
      setForm({
        name: data.name || "", description: data.description || "", price: data.price || "", mrp: data.mrp || "",
        category: data.category || "", subcategory: data.subcategory || "", tags: (data.tags || []).join(", "),
        stock: data.stock || "", prepTimeMinutes: data.prepTimeMinutes || "10", maxOrderQty: data.maxOrderQty || "10",
        isDeal: !!data.isDeal, dealEndsAt: data.dealEndsAt ? new Date(data.dealEndsAt).toISOString().slice(0, 16) : "",
        brand: data.brand || "", sku: data.sku || "", gstPercent: data.gstPercent ?? "0", hsn: data.hsn || "", barcode: data.barcode || "",
        lowStockThreshold: data.lowStockThreshold ?? "5",
        metaTitle: data.seo?.metaTitle || "", metaDesc: data.seo?.metaDescription || "",
        isCancellable: data.isCancellable !== false, isReturnable: data.isReturnable !== false, isReplaceable: !!data.isReplaceable,
        returnWindow: String(data.returnWindow ?? 7), replacementWindow: String(data.replacementWindow ?? 7), cancelWindow: String(data.cancelWindow ?? 0),
        nonReturnableReason: data.nonReturnableReason || "",
        returnConditions: Array.isArray(data.returnConditions) && data.returnConditions.length ? data.returnConditions : ["damaged", "wrong_product", "defective"],
        packagingRequired: !!data.packagingRequired, tagsRequired: !!data.tagsRequired,
        returnMethod: data.returnMethod === "pickup" ? "pickup" : "self_ship",
      });
      setExistingImages(data.images || []);
      if (Array.isArray(data.sizes) && data.sizes.length > 0) setSizes(data.sizes);
      if (Array.isArray(data.highlightsArray) && data.highlightsArray.length > 0) {
        setHighlights(data.highlightsArray);
      }
      if (data.attributes && typeof data.attributes === "object") {
        setAttributes(data.attributes);
      }
    }).catch(() => setError("Failed to load product")).finally(() => setLoading(false));
  }, [id]);

  const onChange = e => {
    const { name, type, checked, value } = e.target;
    setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };
  const toggleReturnCondition = (key) => {
    setForm(p => ({
      ...p,
      returnConditions: p.returnConditions.includes(key)
        ? p.returnConditions.filter(c => c !== key)
        : [...p.returnConditions, key],
    }));
  };
  const onImages = e => {
    const files = Array.from(e.target.files);
    const previews = files.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setImages(p => [...p, ...previews].slice(0, 4));
  };

  const addSize = () => {
    if (!newSize.size.trim()) return;
    setSizes(p => [...p, { size: newSize.size.trim(), stock: Number(newSize.stock) || 0 }]);
    setNewSize({ size: "", stock: "" });
  };
  const removeSize = (i) => setSizes(p => p.filter((_, j) => j !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) return setError("Name, price and category required");
    if (existingImages.length + images.length === 0) return setError("At least 1 product photo is required");
    try {
      setSaving(true); setError("");
      const fd = new FormData();
      // Plain scalar fields — everything except tags/sizes/returnConditions,
      // which the backend's Zod schema expects as JSON, not raw comma/
      // FormData strings (a raw array appended via fd.append would
      // serialize as "damaged,wrong_product" — not valid JSON).
      const { tags, returnConditions, ...scalars } = form;
      Object.entries(scalars).forEach(([k, v]) => fd.append(k, v));
      fd.append("tags", JSON.stringify(tags.split(",").map(t => t.trim()).filter(Boolean)));
      fd.append("returnConditions", JSON.stringify(returnConditions));
      fd.append("sizes", JSON.stringify(sizes));
      // Add structured highlights
      const validHighlights = highlights.filter(h => h.title.trim() && h.value.trim());
      fd.append("highlightsArray", JSON.stringify(validHighlights));
      fd.append("attributes", JSON.stringify(attributes));
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
          <Field label="Brand"><Inp name="brand" value={form.brand} onChange={onChange} placeholder="e.g. Haldiram's" /></Field>
          <Field label="SKU" hint="(unique — leave blank to skip)"><Inp name="sku" value={form.sku} onChange={onChange} placeholder="e.g. VEN-SNK-001" /></Field>
          <Field label="GST %"><Inp name="gstPercent" type="number" min="0" max="100" value={form.gstPercent} onChange={onChange} /></Field>
          <Field label="HSN Code"><Inp name="hsn" value={form.hsn} onChange={onChange} placeholder="e.g. 21069099" /></Field>
          <Field label="Barcode"><Inp name="barcode" value={form.barcode} onChange={onChange} /></Field>
          <Field label="Low Stock Alert Below"><Inp name="lowStockThreshold" type="number" min="0" value={form.lowStockThreshold} onChange={onChange} /></Field>
        </div>

        {/* Sizes — optional per-size stock, for apparel/footwear-style UH categories. When set, total stock is the sum of these instead of "Available Stock" above. */}
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            📏 Sizes <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>(optional — e.g. S/M/L, or shoe sizes, each with its own stock)</span>
          </div>
          {sizes.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <Inp value={s.size} readOnly style={{ flex: "0 0 35%", fontSize: 12, padding: "8px 10px", background: "#fff" }} />
              <Inp value={s.stock} readOnly style={{ flex: 1, fontSize: 12, padding: "8px 10px", background: "#fff" }} />
              <button type="button" onClick={() => removeSize(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
                <FaTrash size={11} />
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <Inp value={newSize.size} onChange={e => setNewSize(p => ({ ...p, size: e.target.value }))} placeholder="Size, e.g. M" style={{ flex: "0 0 35%", fontSize: 12, padding: "8px 10px" }} />
            <Inp value={newSize.stock} onChange={e => setNewSize(p => ({ ...p, stock: e.target.value }))} type="number" min="0" placeholder="Stock" style={{ flex: 1, fontSize: 12, padding: "8px 10px" }} />
            <button type="button" onClick={addSize} style={{ background: "#1a1740", color: "#c9a84c", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
              <FaPlus size={9} /> Add
            </button>
          </div>
        </div>

        {/* Return / Cancel / Replace Policy — matters a lot for UH: most
            items are perishable food, where "returnable, 7-day window" (the
            schema default) is wrong. Vendor sets this per product instead of
            every item silently inheriting a policy that doesn't apply. */}
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>📋 Return / Cancel Policy</div>
          <div style={{ display: "flex", gap: 18, marginBottom: 12, flexWrap: "wrap" }}>
            {[["isCancellable", "Cancellable"], ["isReturnable", "Returnable"], ["isReplaceable", "Replaceable"]].map(([k, label]) => (
              <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                <input type="checkbox" name={k} checked={form[k]} onChange={onChange} /> {label}
              </label>
            ))}
          </div>
          <div className="product-form-grid">
            <Field label="Cancel Window (hrs)" hint={`(${policyLimits.minCancelWindowHours}-${policyLimits.maxCancelWindowHours} allowed)`}>
              <Inp name="cancelWindow" type="number" min={policyLimits.minCancelWindowHours} max={policyLimits.maxCancelWindowHours} value={form.cancelWindow} onChange={onChange} />
            </Field>
            <Field label="Return Window (days)" hint={`(${policyLimits.minReturnWindowDays}-${policyLimits.maxReturnWindowDays} allowed)`}>
              <Inp name="returnWindow" type="number" min={policyLimits.minReturnWindowDays} max={policyLimits.maxReturnWindowDays} value={form.returnWindow} onChange={onChange} />
            </Field>
            <Field label="Replacement Window (days)" hint={`(${policyLimits.minReplacementWindowDays}-${policyLimits.maxReplacementWindowDays} allowed)`}>
              <Inp name="replacementWindow" type="number" min={policyLimits.minReplacementWindowDays} max={policyLimits.maxReplacementWindowDays} value={form.replacementWindow} onChange={onChange} />
            </Field>
          </div>
          {!form.isReturnable && (
            <Field label="Non-returnable reason"><Inp name="nonReturnableReason" value={form.nonReturnableReason} onChange={onChange} placeholder="e.g. Perishable food item" /></Field>
          )}

          {form.isReturnable && (
            <>
              <Field label="Return Conditions" hint="(select all that apply)">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["damaged", "Damaged"], ["wrong_product", "Wrong Product"], ["defective", "Defective"], ["missing_items", "Missing Items"], ["other", "Other"]]
                    .filter(([k]) => policyLimits.allowedReturnConditions.includes(k))
                    .map(([k, label]) => {
                      const active = form.returnConditions.includes(k);
                      return (
                        <button key={k} type="button" onClick={() => toggleReturnCondition(k)} style={{
                          padding: "6px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                          border: `1px solid ${active ? "#1a1740" : "#e2e8f0"}`,
                          background: active ? "#1a1740" : "#fff",
                          color: active ? "#c9a84c" : "#64748b",
                        }}>
                          {label}
                        </button>
                      );
                    })}
                </div>
              </Field>
              <div style={{ display: "flex", gap: 18, marginBottom: 12, flexWrap: "wrap", marginTop: 4 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" name="packagingRequired" checked={form.packagingRequired} onChange={onChange} /> Original Packaging Required
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" name="tagsRequired" checked={form.tagsRequired} onChange={onChange} /> Tags Required
                </label>
              </div>
              <Field label="Return Method">
                <select name="returnMethod" value={form.returnMethod} onChange={onChange} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fafafe" }}>
                  <option value="self_ship">Customer Self-Ships</option>
                  <option value="pickup">We Arrange Pickup</option>
                </select>
              </Field>
            </>
          )}
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

        {/* Product Attributes — metadata-driven fields from the category's
            attributeSchema. These values power the storefront's dynamic
            filter sidebar automatically. */}
        {attributeSchema.length > 0 && (
          <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              🏷️ Product Attributes
              <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>(auto-loaded for this category — used for filters)</span>
            </div>
            <div className="product-form-grid">
              {attributeSchema.map((attr) => (
                <Field key={attr.key} label={attr.label || attr.key} required={attr.required}>
                  {attr.type === "select" && attr.options?.length > 0 ? (
                    <select
                      value={attributes[attr.key] || ""}
                      onChange={(e) => setAttributes((p) => ({ ...p, [attr.key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fafafe" }}
                    >
                      <option value="">Select {attr.label || attr.key}</option>
                      {attr.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <Inp
                      value={attributes[attr.key] || ""}
                      onChange={(e) => setAttributes((p) => ({ ...p, [attr.key]: e.target.value }))}
                      placeholder={`e.g. ${attr.options?.[0] || attr.label || attr.key}`}
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}

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

        {/* SEO — falls back to name/description on the storefront if left blank */}
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>🔍 SEO (optional)</div>
          <div className="product-form-grid">
            <Field label="Meta Title"><Inp name="metaTitle" value={form.metaTitle} onChange={onChange} maxLength={120} /></Field>
            <Field label="Meta Description"><Inp name="metaDesc" value={form.metaDesc} onChange={onChange} maxLength={200} /></Field>
          </div>
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
