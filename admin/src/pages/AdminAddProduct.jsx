import React, { useState, useCallback, memo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/adminApi";
import { fetchAllCategories } from "../api/categoryApi";
import {
    FaArrowLeft, FaUpload, FaTimes, FaPlus, FaTag,
    FaRupeeSign, FaBoxes, FaCheck, FaGlobe, FaWeight,
    FaShippingFast, FaStar, FaBolt,
} from "react-icons/fa";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Free Size"];
const HIGHLIGHT_KEYS = ["Fabric", "Sleeve", "Pattern", "Color", "Pack of", "Collar", "Fit", "Material", "Brand", "Origin", "Occasion", "Wash Care", "Warranty", "Model No", "Dimensions", "Weight"];

const SECTIONS = [
    { id: "basic", label: "Basic Info", icon: "📝" },
    { id: "pricing", label: "Pricing & Stock", icon: "💰" },
    { id: "details", label: "Details", icon: "🏷️" },
    { id: "images", label: "Images", icon: "🖼️" },
    { id: "seo", label: "SEO & Shipping", icon: "🚚" },
];

/* Tab that owns each field (for auto-navigation on error) */
const FIELD_TAB = {
    name: "basic", description: "basic", brand: "basic", sku: "basic",
    color: "basic", material: "basic", occasion: "basic", category: "basic", subcategory: "basic", tags: "basic",
    price: "pricing", mrp: "pricing", stock: "pricing", gstPercent: "pricing", isDeal: "pricing", dealEndsAt: "pricing",
    sizes: "details", highlights: "details", weight: "details", origin: "details",
    images: "images",
    returnPolicy: "seo", shippingInfo: "seo", metaTitle: "seo", metaDesc: "seo",
};

const GST_RATES = ["0", "5", "12", "18", "28"];

const DEFAULT_CUST_CONFIG = {
    allowText: true, allowImage: true, allowNote: true,
    textLabel: "Name / Message", textPlaceholder: "e.g. Happy Birthday Rahul!", textMaxLength: 100,
    imageLabel: "Upload Design",
    noteLabel: "Special Instructions", notePlaceholder: "e.g. White background, bold font...",
    extraPrice: 0,
};

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
.ap * { box-sizing:border-box; font-family:'DM Sans',system-ui,sans-serif; }

@keyframes ap-in   { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:none} }
@keyframes ap-spin { to{transform:rotate(360deg)} }
@keyframes ap-pop  { from{opacity:0;transform:translateY(-10px) scale(.96)} to{opacity:1;transform:none} }

.ap-inp {
    width:100%; padding:10px 12px; background:#fff;
    border:1.5px solid #e2e8f2; border-radius:9px; color:#18202e;
    font-size:13.5px; outline:none; transition:border-color .15s,box-shadow .15s;
}
.ap-inp::placeholder { color:#b0bbd0; }
.ap-inp:focus  { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.12); }
.ap-inp.err    { border-color:#f87171; box-shadow:0 0 0 3px rgba(248,113,113,.12); }

.ap-sel {
    appearance:none; -webkit-appearance:none; cursor:pointer;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23b0bbd0'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 12px center;
}

.ap-chip {
    height:32px; padding:0 12px; border:1.5px solid #e2e8f2; border-radius:7px;
    background:#fff; color:#64748b; font-size:12px; font-weight:600;
    cursor:pointer; transition:all .15s; white-space:nowrap;
}
.ap-chip:hover { border-color:#3b82f6; color:#3b82f6; background:#eff6ff; }
.ap-chip.on    { background:#eff6ff; border-color:#3b82f6; color:#3b82f6; }

.ap-tab {
    display:flex; align-items:center; gap:5px; padding:7px 13px;
    font-size:12px; font-weight:600; border:1.5px solid transparent;
    border-radius:8px; background:transparent; color:#64748b;
    cursor:pointer; transition:all .15s; position:relative;
}
.ap-tab.on    { background:#fff; border-color:#e2e8f2; color:#1d4ed8; box-shadow:0 1px 4px rgba(0,0,0,.07); }
.ap-tab:hover:not(.on) { background:#f1f5f9; color:#334155; }
.ap-tab .dot  { width:7px; height:7px; border-radius:50%; background:#f87171; position:absolute; top:4px; right:4px; }
.ap-tab .num  { min-width:16px; height:16px; border-radius:8px; font-size:9px; font-weight:800; display:flex; align-items:center; justify-content:center; background:#cbd5e1; color:#fff; transition:background .15s; }
.ap-tab.on .num { background:#1d4ed8; }

.ap-slot {
    aspect-ratio:1; background:#f8fafc; border:1.5px solid #e2e8f2;
    border-radius:10px; overflow:hidden; position:relative; transition:border-color .15s;
}
.ap-slot:hover { border-color:#3b82f6; }

.ap-drop {
    border:2px dashed #cdd5e3; border-radius:10px; background:#f8fafc;
    cursor:pointer; display:flex; flex-direction:column;
    align-items:center; justify-content:center; padding:20px;
    transition:all .2s; aspect-ratio:1;
}
.ap-drop:hover { border-color:#3b82f6; background:#eff6ff; }

.ap-tog {
    position:relative; width:42px; height:23px; border:none;
    border-radius:12px; cursor:pointer; transition:background .2s; flex-shrink:0;
}
.ap-tog-dot {
    position:absolute; top:2px; width:19px; height:19px; border-radius:50%;
    background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.18); transition:left .2s;
}

.g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
@media(max-width:520px){ .g2,.g3{ grid-template-columns:1fr; } }

.ap-sec { animation:ap-in .2s ease; }
.ap-hlrow:hover .ap-hlrm { opacity:1 !important; }
@media(max-width:520px){
  .ap-hlrow { flex-wrap:wrap; }
  .ap-hlrow select.ap-inp { flex:1 1 100% !important; }
  .ap-imggrid { grid-template-columns:repeat(2,1fr) !important; }
  .ap-actions { flex-wrap:wrap; }
  .ap-actions .ap-submit { min-width:100%; order:1; }
  .ap-tab span:nth-child(2) { font-size:11px; }
}

.ap-card { background:#fff; border:1.5px solid #e2e8f2; border-radius:13px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.05); }
.ap-bar  { height:3px; background:linear-gradient(90deg,#1d4ed8,#60a5fa); }

.ap-submit {
    flex:2; padding:11px; background:#1d4ed8; color:#fff; border:none;
    border-radius:9px; font-size:13.5px; font-weight:700; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:7px;
    box-shadow:0 2px 10px rgba(29,78,216,.28); transition:all .15s;
}
.ap-submit:hover:not(:disabled) { background:#1e40af; }
.ap-submit:disabled { background:#93c5fd; box-shadow:none; cursor:not-allowed; }

.ap-errbanner {
    margin:0 24px 16px; padding:11px 14px;
    background:#fef2f2; border:1.5px solid #fecaca;
    border-radius:9px; color:#dc2626; font-size:12.5px;
}
.ap-discount {
    display:flex; align-items:center; gap:12px; padding:10px 14px;
    background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:9px;
}
`;

/* ═══════════════════════════════════════════════════════════
   FIELD WRAPPER
═══════════════════════════════════════════════════════════ */
const Field = memo(({ label, hint, err, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: err ? "#dc2626" : "#475569" }}>
                {label}
            </label>
            {hint && <span style={{ fontSize: 11, color: "#b0bbd0" }}>{hint}</span>}
        </div>
        {children}
        {err && <p style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginTop: 1 }}>⚠ {err}</p>}
    </div>
));
Field.displayName = "Field";

/* ═══════════════════════════════════════════════════════════
   TOGGLE
═══════════════════════════════════════════════════════════ */
const Toggle = ({ on, toggle, label, sub, accent = "#1d4ed8" }) => (
    <div onClick={toggle} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderRadius: 10, cursor: "pointer",
        background: on ? "#eff6ff" : "#f8fafc",
        border: `1.5px solid ${on ? accent : "#e2e8f2"}`,
        transition: "all .2s",
    }}>
        <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: "#18202e", marginBottom: 2 }}>{label}</p>
            {sub && <p style={{ fontSize: 11, color: "#b0bbd0" }}>{sub}</p>}
        </div>
        <button type="button" className="ap-tog" style={{ background: on ? accent : "#d1d5db" }}
            onClick={e => { e.stopPropagation(); toggle(); }}>
            <div className="ap-tog-dot" style={{ left: on ? 21 : 2 }} />
        </button>
    </div>
);

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
const AdminAddProduct = () => {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "", description: "", price: "", mrp: "", category: "", subcategory: "",
        isFeatured: false, isDeal: false, dealEndsAt: "", isCustomizable: false,
        tags: "", stock: "", brand: "", sku: "", weight: "", origin: "",
        returnPolicy: "7", shippingInfo: "", metaTitle: "", metaDesc: "",
        color: "", material: "", occasion: "", gstPercent: "0",
    });
    const [custConfig, setCustConfig] = useState({ ...DEFAULT_CUST_CONFIG });
    const [images, setImages] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fErrs, setFErrs] = useState({});     // field-level errors
    const [topErr, setTopErr] = useState("");     // banner error
    const [toast, setToast] = useState(null);
    const [selSizes, setSelSizes] = useState([]);
    const [sizeStockMap, setSizeStockMap] = useState({});
    const [hls, setHls] = useState([{ key: "", value: "" }]);
    const [tab, setTab] = useState("basic");
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchAllCategories().then(res => {
            const cats = res.data?.categories || res.data || [];
            setCategories(cats);
        }).catch(() => { });
    }, []);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const clrErr = useCallback((name) => {
        setFErrs(p => { const n = { ...p }; delete n[name]; return n; });
        setTopErr("");
    }, []);

    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value }));
        clrErr(name);
    }, [clrErr]);

    const toggleSize = useCallback((s) => setSelSizes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]), []);
    const updateSizeStock = useCallback((size, val) => {
        const n = Math.max(0, parseInt(val) || 0);
        setSizeStockMap(p => {
            const updated = { ...p, [size]: n };
            // Auto-calc total stock
            setForm(f => ({ ...f, stock: String(selSizes.reduce((sum, sz) => sum + (updated[sz] || 0), 0)) }));
            return updated;
        });
    }, [selSizes]);
    const addHL = useCallback(() => setHls(p => [...p, { key: "", value: "" }]), []);
    const removeHL = useCallback((i) => setHls(p => p.filter((_, j) => j !== i)), []);
    const updateHL = useCallback((i, f, v) => setHls(p => p.map((h, j) => j === i ? { ...h, [f]: v } : h)), []);

    const handleImgs = useCallback((e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const merged = [...images, ...files];
        if (merged.length > 6) {
            setTopErr(`Maximum 6 images allowed (tried ${merged.length})`);
            return;
        }
        for (const f of merged) {
            if (f.size > 5 * 1048576) { setTopErr(`"${f.name}" exceeds 5 MB`); return; }
        }
        setImages(merged);
        setPreviews(merged.map(f => URL.createObjectURL(f)));
        clrErr("images");
    }, [images, clrErr]);

    const removeImg = useCallback((i) => {
        setImages(p => p.filter((_, j) => j !== i));
        setPreviews(p => p.filter((_, j) => j !== i));
    }, []);

    const discPct = form.mrp && form.price && +form.mrp > +form.price
        ? Math.round(((+form.mrp - +form.price) / +form.mrp) * 100) : null;

    const tabIdx = SECTIONS.findIndex(s => s.id === tab);

    /* ─────────────────────────────────────────────────────
       WHICH TABS HAVE ERRORS
    ───────────────────────────────────────────────────── */
    const tabHasErr = (id) => {
        const owns = Object.entries(FIELD_TAB).filter(([, t]) => t === id).map(([f]) => f);
        return owns.some(f => fErrs[f]);
    };

    /* ─────────────────────────────────────────────────────
       SUBMIT
       ROOT CAUSE OF 400:
         z.coerce.date("") = Invalid Date → Zod rejects at root level
         → errors[0].path = [] → field = "" → "0 fields have errors"
       FIX: NEVER append dealEndsAt as empty string
    ───────────────────────────────────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFErrs({});
        setTopErr("");

        /* ── Client pre-flight ── */
        const fe = {};
        if (!form.name.trim()) fe.name = "Required";
        if (!form.price || +form.price <= 0) fe.price = "Enter a valid price (> 0)";
        if (form.mrp && +form.mrp < +form.price) fe.mrp = "MRP must be ≥ selling price";
        if (!form.category) fe.category = "Required";
        if (images.length === 0) fe.images = "At least 1 image required";
        if (form.stock === "" || +form.stock < 0) fe.stock = "Required (0 or more)";
        if (form.isDeal && form.dealEndsAt && isNaN(new Date(form.dealEndsAt).getTime()))
            fe.dealEndsAt = "Invalid date";

        if (Object.keys(fe).length) {
            setFErrs(fe);
            const firstTab = FIELD_TAB[Object.keys(fe)[0]];
            if (firstTab) setTab(firstTab);
            setTopErr(`Fix the ${Object.keys(fe).length} highlighted field(s) before publishing`);
            return;
        }

        try {
            setLoading(true);

            const fd = new FormData();

            /* REQUIRED — always send, even if "0" */
            fd.append("name", form.name.trim());
            fd.append("category", form.category);
            fd.append("price", String(+form.price));
            fd.append("stock", String(+form.stock));

            /* OPTIONAL strings — only when non-empty */
            [["description", form.description],
            ["mrp", form.mrp],
            ["brand", form.brand],
            ["sku", form.sku],
            ["weight", form.weight],
            ["origin", form.origin],
            ["returnPolicy", form.returnPolicy],
            ["shippingInfo", form.shippingInfo],
            ["material", form.material],
            ["color", form.color],
            ["occasion", form.occasion],
            ["metaTitle", form.metaTitle],
            ["metaDesc", form.metaDesc],
            ["subcategory", form.subcategory],
            ].forEach(([k, v]) => {
                const s = v?.toString().trim();
                if (s) fd.append(k, s);
            });

            /* GST */
            fd.append("gstPercent", String(+form.gstPercent || 0));

            /* BOOLEANS — explicit "true"/"false" strings */
            fd.append("isFeatured", form.isFeatured ? "true" : "false");
            fd.append("isDeal", form.isDeal ? "true" : "false");
            fd.append("isCustomizable", form.isCustomizable ? "true" : "false");

            /* CUSTOMIZATION CONFIG */
            if (form.isCustomizable) {
                fd.append("customizationConfig", JSON.stringify(custConfig));
            }

            /*
             * FIX: dealEndsAt — NEVER send empty string.
             * z.coerce.date("") produces Invalid Date → Zod throws
             * root-level error with path=[] → field="" → "0 fields have errors"
             */
            if (form.isDeal && form.dealEndsAt && form.dealEndsAt.trim()) {
                const d = new Date(form.dealEndsAt);
                if (!isNaN(d.getTime())) fd.append("dealEndsAt", d.toISOString());
            }

            /* TAGS → JSON array (FIX: plain string fails Zod z.array()) */
            const tagsArr = form.tags.split(",").map(t => t.trim()).filter(Boolean);
            if (tagsArr.length) fd.append("tags", JSON.stringify(tagsArr));

            /* IMAGES */
            images.forEach(img => fd.append("images", img));

            /* SIZES */
            if (selSizes.length) {
                fd.append("sizes", JSON.stringify(selSizes.map(s => ({ size: s, stock: sizeStockMap[s] || 0 }))));
            }

            /* HIGHLIGHTS */
            const validHls = hls.filter(h => h.key.trim() && h.value.trim());
            if (validHls.length) {
                const obj = {};
                validHls.forEach(h => { obj[h.key.trim()] = h.value.trim(); });
                fd.append("highlights", JSON.stringify(obj));
            }

            const response = await api.post("/products/admin", fd);
            showToast("success", "Product published successfully!");
            setTimeout(() => navigate("/admin/products"), 1400);

        } catch (err) {
            const respData = err.response?.data || {};
            const apiErrors = respData.errors;

            // Check for image upload errors
            if (apiErrors && Array.isArray(apiErrors)) {
                const imgErrs = apiErrors.filter((e) => {
                    const str = typeof e === 'string' ? e : e.message || '';
                    return str.toLowerCase().includes('image');
                });

                if (imgErrs.length > 0) {
                    const imgMsg = imgErrs.map(e => typeof e === 'string' ? e : e.message).join(" | ");
                    setFErrs({ images: imgMsg });
                    setTab("images");
                    setTopErr(`🖼️ ${imgMsg}`);
                } else {
                    const mapped = {};
                    apiErrors.forEach(({ field, message }) => { if (field) mapped[field] = message; });

                    if (Object.keys(mapped).length) {
                        setFErrs(mapped);
                        const firstTab = FIELD_TAB[Object.keys(mapped)[0]];
                        if (firstTab) setTab(firstTab);
                        setTopErr(`Server rejected ${apiErrors.length} field(s): ${apiErrors.map(e => e.field || e.message).join(", ")}`);
                    } else {
                        setTopErr(`Validation error: ${apiErrors.map(e => e.message).join(", ")}`);
                    }
                }
            } else {
                setTopErr(respData.message || err.response?.data?.message || "Failed to publish. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    /* ═══════════════════════════════════════════════════════
       RENDER
    ═══════════════════════════════════════════════════════ */
    return (
        <div className="ap" style={{ background: "#f0f4fb", minHeight: "100vh", padding: "28px 16px 80px" }}>
            <style>{CSS}</style>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 99999,
                    display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 9,
                    background: toast.type === "success" ? "#059669" : "#ef4444",
                    color: "#fff", fontWeight: 700, fontSize: 13,
                    animation: "ap-pop .25s ease", boxShadow: "0 8px 28px rgba(0,0,0,.18)", whiteSpace: "nowrap",
                }}>
                    {toast.type === "success" ? <FaCheck size={11} /> : <FaTimes size={11} />}
                    {toast.msg}
                </div>
            )}

            <div style={{ maxWidth: 820, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                    <button type="button" onClick={() => navigate("/admin/products")}
                        style={{ width: 38, height: 38, borderRadius: 9, background: "#fff", border: "1.5px solid #e2e8f2", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#3b82f6"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f2"; e.currentTarget.style.color = "#64748b"; }}>
                        <FaArrowLeft size={12} />
                    </button>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 2 }}>Products</p>
                        <h1 style={{ fontWeight: 800, fontSize: 21, color: "#18202e", margin: 0, letterSpacing: "-.02em" }}>Add New Product</h1>
                    </div>
                </div>

                {/* Tab bar */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14, background: "#e4e9f2", padding: 5, borderRadius: 11 }}>
                    {SECTIONS.map((s, i) => (
                        <button key={s.id} type="button" onClick={() => setTab(s.id)}
                            className={`ap-tab${tab === s.id ? " on" : ""}`}>
                            <span style={{ fontSize: 13 }}>{s.icon}</span>
                            <span>{s.label}</span>
                            <span className="num">{i + 1}</span>
                            {tabHasErr(s.id) && <span className="dot" />}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="ap-card">
                        <div className="ap-bar" />
                        <div style={{ padding: "22px 24px 0" }}>

                            {/* ══════ BASIC INFO ══════ */}
                            {tab === "basic" && (
                                <div className="ap-sec" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                                    <Field label="Product Name" hint="*required" err={fErrs.name}>
                                        <input name="name" value={form.name} onChange={handleChange}
                                            placeholder="e.g. Silk Embroidered Kurta"
                                            className={`ap-inp${fErrs.name ? " err" : ""}`} />
                                    </Field>

                                    <Field label="Description" hint="optional">
                                        <textarea name="description" value={form.description} onChange={handleChange}
                                            placeholder="Describe fabric, fit, occasion, care…" rows={3}
                                            className="ap-inp" style={{ resize: "vertical", lineHeight: 1.6 }} />
                                    </Field>

                                    <div className="g2">
                                        <Field label="Brand">
                                            <input name="brand" value={form.brand} onChange={handleChange}
                                                placeholder="e.g. UrbeXon" className="ap-inp" />
                                        </Field>
                                        <Field label="SKU / Code">
                                            <input name="sku" value={form.sku} onChange={handleChange}
                                                placeholder="e.g. UX-KRT-001" className="ap-inp" />
                                        </Field>
                                    </div>

                                    <div className="g3">
                                        <Field label="Color">
                                            <input name="color" value={form.color} onChange={handleChange}
                                                placeholder="Navy Blue" className="ap-inp" />
                                        </Field>
                                        <Field label="Material">
                                            <input name="material" value={form.material} onChange={handleChange}
                                                placeholder="Cotton" className="ap-inp" />
                                        </Field>
                                        <Field label="Occasion">
                                            <input name="occasion" value={form.occasion} onChange={handleChange}
                                                placeholder="Casual" className="ap-inp" />
                                        </Field>
                                    </div>

                                    <div className="g2">
                                        <Field label="Category" hint="*required" err={fErrs.category}>
                                            <select name="category" value={form.category} onChange={handleChange}
                                                className={`ap-inp ap-sel${fErrs.category ? " err" : ""}`}>
                                                <option value="">— Select Category —</option>
                                                {categories.map(c => (
                                                    <option key={c._id || c.value} value={c.value || c.slug || c.name}>
                                                        {c.icon ? `${c.icon} ` : ""}{c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Subcategory" hint="optional">
                                            <input name="subcategory" value={form.subcategory} onChange={handleChange}
                                                placeholder="e.g. Kurta Set, Running Shoes" className="ap-inp" />
                                        </Field>
                                    </div>

                                    <Field label="Tags" hint="comma-separated">
                                        <div style={{ position: "relative" }}>
                                            <FaTag size={10} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0", pointerEvents: "none" }} />
                                            <input name="tags" value={form.tags} onChange={handleChange}
                                                placeholder="kurta, ethnic, festive"
                                                className="ap-inp" style={{ paddingLeft: 29 }} />
                                        </div>
                                    </Field>

                                    <div className="g2">
                                        <Toggle on={form.isFeatured}
                                            toggle={() => setForm(p => ({ ...p, isFeatured: !p.isFeatured }))}
                                            label={<><FaStar size={10} style={{ color: "#f59e0b", marginRight: 4 }} />Featured</>}
                                            sub="Shown on homepage" accent="#f59e0b" />
                                        <Toggle on={form.isCustomizable}
                                            toggle={() => setForm(p => ({ ...p, isCustomizable: !p.isCustomizable }))}
                                            label="Customizable"
                                            sub="Custom design/text allowed" />
                                    </div>

                                    {/* ── Customization Config Panel ── */}
                                    {form.isCustomizable && (
                                        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f2", borderRadius: 11, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", letterSpacing: ".04em" }}>
                                                🎨 Customization Options
                                            </p>

                                            {/* Toggle rows */}
                                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                <Toggle on={custConfig.allowText}
                                                    toggle={() => setCustConfig(p => ({ ...p, allowText: !p.allowText }))}
                                                    label="Allow Custom Text"
                                                    sub="Customer can type name/message" />
                                                {custConfig.allowText && (
                                                    <div className="g2" style={{ paddingLeft: 12 }}>
                                                        <Field label="Text Label">
                                                            <input value={custConfig.textLabel}
                                                                onChange={e => setCustConfig(p => ({ ...p, textLabel: e.target.value }))}
                                                                placeholder="Name / Message" className="ap-inp" />
                                                        </Field>
                                                        <Field label="Text Placeholder">
                                                            <input value={custConfig.textPlaceholder}
                                                                onChange={e => setCustConfig(p => ({ ...p, textPlaceholder: e.target.value }))}
                                                                placeholder="e.g. Happy Birthday!" className="ap-inp" />
                                                        </Field>
                                                        <Field label="Max Length">
                                                            <input type="number" min="1" max="500" value={custConfig.textMaxLength}
                                                                onChange={e => setCustConfig(p => ({ ...p, textMaxLength: +e.target.value || 100 }))}
                                                                className="ap-inp" />
                                                        </Field>
                                                    </div>
                                                )}

                                                <Toggle on={custConfig.allowImage}
                                                    toggle={() => setCustConfig(p => ({ ...p, allowImage: !p.allowImage }))}
                                                    label="Allow Image Upload"
                                                    sub="Customer can upload design/photo" />
                                                {custConfig.allowImage && (
                                                    <div style={{ paddingLeft: 12 }}>
                                                        <Field label="Image Label">
                                                            <input value={custConfig.imageLabel}
                                                                onChange={e => setCustConfig(p => ({ ...p, imageLabel: e.target.value }))}
                                                                placeholder="Upload Design" className="ap-inp" />
                                                        </Field>
                                                    </div>
                                                )}

                                                <Toggle on={custConfig.allowNote}
                                                    toggle={() => setCustConfig(p => ({ ...p, allowNote: !p.allowNote }))}
                                                    label="Allow Special Notes"
                                                    sub="Customer can add instructions" />
                                                {custConfig.allowNote && (
                                                    <div className="g2" style={{ paddingLeft: 12 }}>
                                                        <Field label="Note Label">
                                                            <input value={custConfig.noteLabel}
                                                                onChange={e => setCustConfig(p => ({ ...p, noteLabel: e.target.value }))}
                                                                placeholder="Special Instructions" className="ap-inp" />
                                                        </Field>
                                                        <Field label="Note Placeholder">
                                                            <input value={custConfig.notePlaceholder}
                                                                onChange={e => setCustConfig(p => ({ ...p, notePlaceholder: e.target.value }))}
                                                                placeholder="e.g. White background..." className="ap-inp" />
                                                        </Field>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Extra Price */}
                                            <Field label="Extra Charge for Customization (₹)" hint="0 = free">
                                                <input type="number" min="0" value={custConfig.extraPrice}
                                                    onChange={e => setCustConfig(p => ({ ...p, extraPrice: +e.target.value || 0 }))}
                                                    placeholder="0" className="ap-inp" style={{ maxWidth: 180 }} />
                                            </Field>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ══════ PRICING & STOCK ══════ */}
                            {tab === "pricing" && (
                                <div className="ap-sec" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                                    <div className="g2">
                                        <Field label="Selling Price (₹)" hint="*required" err={fErrs.price}>
                                            <div style={{ position: "relative" }}>
                                                <FaRupeeSign size={10} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0", pointerEvents: "none" }} />
                                                <input type="number" name="price" value={form.price} onChange={handleChange}
                                                    placeholder="0" min="1"
                                                    className={`ap-inp${fErrs.price ? " err" : ""}`} style={{ paddingLeft: 27 }} />
                                            </div>
                                        </Field>
                                        <Field label="MRP (₹)" hint="compare-at" err={fErrs.mrp}>
                                            <div style={{ position: "relative" }}>
                                                <FaRupeeSign size={10} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0", pointerEvents: "none" }} />
                                                <input type="number" name="mrp" value={form.mrp} onChange={handleChange}
                                                    placeholder="0" min="1"
                                                    className={`ap-inp${fErrs.mrp ? " err" : ""}`} style={{ paddingLeft: 27 }} />
                                            </div>
                                        </Field>
                                    </div>

                                    {discPct && (
                                        <div className="ap-discount">
                                            <span style={{ color: "#059669", fontWeight: 800, fontSize: 22 }}>{discPct}%</span>
                                            <div>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Discount Applied</p>
                                                <p style={{ fontSize: 11, color: "#64748b" }}>Customer saves ₹{(+form.mrp - +form.price).toLocaleString("en-IN")}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="g2">
                                        <Field label="Stock Quantity" hint={selSizes.length ? "auto from sizes" : "*required"} err={fErrs.stock}>
                                            <div style={{ position: "relative" }}>
                                                <FaBoxes size={10} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0", pointerEvents: "none" }} />
                                                <input type="number" name="stock" value={form.stock} onChange={handleChange}
                                                    readOnly={selSizes.length > 0}
                                                    placeholder="0" min="0"
                                                    className={`ap-inp${fErrs.stock ? " err" : ""}`} style={{ paddingLeft: 27, background: selSizes.length > 0 ? "#f1f5f9" : "#fff" }} />
                                            </div>
                                            {form.stock !== "" && !fErrs.stock && (
                                                <p style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color: +form.stock > 0 ? "#059669" : "#ef4444" }}>
                                                    {+form.stock > 0 ? `✓ In Stock — ${form.stock} units` : "✕ Out of Stock"}
                                                </p>
                                            )}
                                        </Field>
                                        <Field label="GST %" hint="tax slab" err={fErrs.gstPercent}>
                                            <select name="gstPercent" value={form.gstPercent} onChange={handleChange}
                                                className="ap-inp ap-sel">
                                                {GST_RATES.map(r => (
                                                    <option key={r} value={r}>{r}%</option>
                                                ))}
                                            </select>
                                        </Field>
                                    </div>

                                    <Toggle on={form.isDeal}
                                        toggle={() => setForm(p => ({ ...p, isDeal: !p.isDeal, dealEndsAt: "" }))}
                                        label={<><FaBolt size={10} style={{ color: "#f59e0b", marginRight: 4 }} />Mark as Deal</>}
                                        sub="Appears in Deals section" accent="#f59e0b" />

                                    {form.isDeal && (
                                        <Field label="Deal Ends At" hint="optional" err={fErrs.dealEndsAt}>
                                            <input type="datetime-local" name="dealEndsAt" value={form.dealEndsAt}
                                                onChange={handleChange}
                                                className={`ap-inp${fErrs.dealEndsAt ? " err" : ""}`} />
                                            <p style={{ fontSize: 11, color: "#b0bbd0", marginTop: 2 }}>Leave blank for no expiry</p>
                                        </Field>
                                    )}
                                </div>
                            )}

                            {/* ══════ DETAILS ══════ */}
                            {tab === "details" && (
                                <div className="ap-sec" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                                    <Field label="Available Sizes" hint="click to toggle">
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                            {ALL_SIZES.map(s => (
                                                <button key={s} type="button" onClick={() => toggleSize(s)}
                                                    className={`ap-chip${selSizes.includes(s) ? " on" : ""}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                        {selSizes.length > 0 && (
                                            <>
                                                <p style={{ fontSize: 11, color: "#3b82f6", marginTop: 8, fontWeight: 600, marginBottom: 6 }}>
                                                    Per-size stock:
                                                </p>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                    {selSizes.map(s => (
                                                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1.5px solid #e2e8f2", borderRadius: 8, padding: "6px 10px" }}>
                                                            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", minWidth: 32 }}>{s}</span>
                                                            <input type="number" min="0" value={sizeStockMap[s] ?? 0}
                                                                onChange={e => updateSizeStock(s, e.target.value)}
                                                                style={{ width: 60, padding: "5px 8px", border: "1.5px solid #e2e8f2", borderRadius: 6, fontSize: 12, textAlign: "center", outline: "none" }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </Field>

                                    <Field label="Product Highlights" hint="key specs shown on product page">
                                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                            {hls.map((h, i) => (
                                                <div key={i} className="ap-hlrow" style={{ display: "flex", gap: 7, alignItems: "center" }}>
                                                    <select value={h.key} onChange={e => updateHL(i, "key", e.target.value)}
                                                        className="ap-inp ap-sel"
                                                        style={{ flex: "0 0 148px", padding: "9px 32px 9px 10px" }}>
                                                        <option value="">Select key</option>
                                                        {HIGHLIGHT_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                                                    </select>
                                                    <input value={h.value} onChange={e => updateHL(i, "value", e.target.value)}
                                                        placeholder="Value…"
                                                        className="ap-inp" style={{ flex: 1, padding: "9px 11px" }} />
                                                    {hls.length > 1 && (
                                                        <button type="button" onClick={() => removeHL(i)} className="ap-hlrm"
                                                            style={{ width: 30, height: 30, borderRadius: 7, background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0, transition: "opacity .15s" }}>
                                                            <FaTimes size={9} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button type="button" onClick={addHL}
                                                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: "3px 0" }}>
                                                <FaPlus size={9} /> Add highlight
                                            </button>
                                        </div>
                                    </Field>

                                    <div className="g2">
                                        <Field label="Weight" hint="for shipping calc">
                                            <div style={{ position: "relative" }}>
                                                <FaWeight size={9} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0", pointerEvents: "none" }} />
                                                <input name="weight" value={form.weight} onChange={handleChange}
                                                    placeholder="e.g. 250g" className="ap-inp" style={{ paddingLeft: 27 }} />
                                            </div>
                                        </Field>
                                        <Field label="Country of Origin">
                                            <div style={{ position: "relative" }}>
                                                <FaGlobe size={9} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0", pointerEvents: "none" }} />
                                                <input name="origin" value={form.origin} onChange={handleChange}
                                                    placeholder="e.g. India" className="ap-inp" style={{ paddingLeft: 27 }} />
                                            </div>
                                        </Field>
                                    </div>
                                </div>
                            )}

                            {/* ══════ IMAGES ══════ */}
                            {tab === "images" && (
                                <div className="ap-sec" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                        <div>
                                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: fErrs.images ? "#dc2626" : "#475569", marginBottom: 3 }}>
                                                Product Images
                                            </p>
                                            <p style={{ fontSize: 11, color: "#b0bbd0" }}>First = main display · Max 6 · 5 MB each · Square recommended</p>
                                        </div>
                                        <span style={{
                                            fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                                            color: previews.length >= 6 ? "#059669" : previews.length === 0 ? "#ef4444" : "#3b82f6",
                                            background: previews.length >= 6 ? "#f0fdf4" : previews.length === 0 ? "#fef2f2" : "#eff6ff",
                                            border: `1px solid ${previews.length >= 6 ? "#bbf7d0" : previews.length === 0 ? "#fecaca" : "#bfdbfe"}`,
                                        }}>
                                            {previews.length}/6
                                        </span>
                                    </div>

                                    {fErrs.images && (
                                        <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>⚠ {fErrs.images}</p>
                                    )}

                                    <div className="ap-imggrid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                                        {previews.map((src, i) => (
                                            <div key={i} className="ap-slot">
                                                <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                                                {i === 0 && (
                                                    <div style={{ position: "absolute", bottom: 6, left: 6, background: "#1d4ed8", color: "#fff", fontSize: 8, fontWeight: 800, padding: "2px 7px", borderRadius: 4, letterSpacing: ".1em" }}>MAIN</div>
                                                )}
                                                <button type="button" onClick={() => removeImg(i)}
                                                    style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 6, background: "rgba(0,0,0,.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                                    onMouseEnter={e => e.currentTarget.style.background = "#ef4444"}
                                                    onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,.6)"}>
                                                    <FaTimes size={8} />
                                                </button>
                                            </div>
                                        ))}
                                        {previews.length < 6 && (
                                            <label className="ap-drop">
                                                <FaUpload size={18} style={{ color: "#3b82f6", marginBottom: 7, opacity: .8 }} />
                                                <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Click to upload</p>
                                                <p style={{ fontSize: 10, color: "#b0bbd0", marginTop: 3 }}>PNG · JPG · WEBP</p>
                                                <input type="file" multiple accept="image/*" onChange={handleImgs} style={{ display: "none" }} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ══════ SEO & SHIPPING ══════ */}
                            {tab === "seo" && (
                                <div className="ap-sec" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                                    <div style={{ padding: "10px 13px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                                        <p style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600 }}>
                                            💡 SEO helps rank on Google. Leave blank to auto-use product name & description.
                                        </p>
                                    </div>

                                    <Field label="Meta Title" hint="~60 chars">
                                        <input name="metaTitle" value={form.metaTitle} onChange={handleChange}
                                            placeholder="Buy Premium Silk Kurta | UrbeXon" className="ap-inp" />
                                        {form.metaTitle && (
                                            <p style={{ fontSize: 10, marginTop: 2, color: form.metaTitle.length > 60 ? "#ef4444" : "#b0bbd0" }}>
                                                {form.metaTitle.length}/60
                                            </p>
                                        )}
                                    </Field>

                                    <Field label="Meta Description" hint="~160 chars">
                                        <textarea name="metaDesc" value={form.metaDesc} onChange={handleChange}
                                            placeholder="Brief description for search engines…" rows={3}
                                            className="ap-inp" style={{ resize: "none", lineHeight: 1.6 }} />
                                        {form.metaDesc && (
                                            <p style={{ fontSize: 10, marginTop: 2, color: form.metaDesc.length > 160 ? "#ef4444" : "#b0bbd0" }}>
                                                {form.metaDesc.length}/160
                                            </p>
                                        )}
                                    </Field>

                                    <div style={{ height: 1, background: "#f1f5f9" }} />

                                    <div className="g2">
                                        <Field label="Return Policy">
                                            <select name="returnPolicy" value={form.returnPolicy} onChange={handleChange}
                                                className="ap-inp ap-sel">
                                                <option value="0">No Returns</option>
                                                <option value="7">7 Days</option>
                                                <option value="15">15 Days</option>
                                                <option value="30">30 Days</option>
                                            </select>
                                        </Field>
                                        <Field label="Shipping Info" hint="optional">
                                            <div style={{ position: "relative" }}>
                                                <FaShippingFast size={10} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0", pointerEvents: "none" }} />
                                                <input name="shippingInfo" value={form.shippingInfo} onChange={handleChange}
                                                    placeholder="Ships in 2–3 days" className="ap-inp" style={{ paddingLeft: 29 }} />
                                            </div>
                                        </Field>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Error banner */}
                        {topErr && (
                            <div className="ap-errbanner">
                                <p style={{ fontWeight: 700, marginBottom: Object.keys(fErrs).length ? 6 : 0 }}>⚠ {topErr}</p>
                                {Object.keys(fErrs).length > 0 && (
                                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, fontWeight: 500, lineHeight: 1.7 }}>
                                        {Object.entries(fErrs).map(([f, msg]) => (
                                            <li key={f}><strong>{f}</strong>: {msg}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="ap-actions" style={{ padding: "12px 24px 24px", display: "flex", gap: 8, alignItems: "center" }}>
                            {[["←", tabIdx > 0, () => setTab(SECTIONS[tabIdx - 1].id)],
                            ["→", tabIdx < SECTIONS.length - 1, () => setTab(SECTIONS[tabIdx + 1].id)]
                            ].map(([arrow, enabled, fn]) => (
                                <button key={arrow} type="button" onClick={fn} disabled={!enabled}
                                    style={{ width: 36, height: 40, borderRadius: 8, background: "#f1f5f9", border: "1.5px solid #e2e8f2", color: "#64748b", cursor: enabled ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 700, opacity: enabled ? 1 : .35 }}>
                                    {arrow}
                                </button>
                            ))}

                            <button type="button" onClick={() => navigate("/admin/products")}
                                style={{ flex: 1, padding: "11px", background: "#fff", border: "1.5px solid #e2e8f2", borderRadius: 9, color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#18202e"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#64748b"; }}>
                                Cancel
                            </button>

                            <button type="submit" disabled={loading} className="ap-submit">
                                {loading ? (
                                    <>
                                        <div style={{ width: 14, height: 14, border: "2.5px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "ap-spin .7s linear infinite" }} />
                                        Publishing…
                                    </>
                                ) : <><FaPlus size={10} /> Publish Product</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminAddProduct;