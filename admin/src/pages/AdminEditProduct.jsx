import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/adminApi";
import { fetchAllCategories } from "../api/categoryApi";
import {
    FiArrowLeft, FiUpload, FiX, FiPlus,
    FiTag, FiDollarSign, FiBox, FiCheckCircle,
    FiZap, FiStar, FiPackage, FiGlobe,
} from "react-icons/fi";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Free Size"];
const HIGHLIGHT_KEYS = ["Fabric", "Sleeve", "Pattern", "Color", "Pack of", "Collar", "Fit", "Material", "Brand", "Origin", "Occasion", "Wash Care", "Warranty", "Model No", "Dimensions", "Weight"];

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
* { box-sizing:border-box; }
.ep { font-family:'DM Sans',system-ui,-apple-system,sans-serif; color:#1a202c; }

@keyframes ep-in   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes ep-spin { to{transform:rotate(360deg)} }
@keyframes ep-pop  { from{opacity:0;transform:translateY(-12px) scale(.94)} to{opacity:1;transform:translateY(0) scale(1)} }

/* ── INPUTS & SELECTS ── */
.ep-inp {
    width:100%; padding:10px 12px; background:#fff; font-family:inherit;
    border:1.5px solid #cbd5e1; border-radius:8px; color:#1a202c;
    font-size:14px; outline:none; transition:all .2s;
}
.ep-inp::placeholder { color:#94a3b8; }
.ep-inp:focus  { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.1), 0 1px 3px rgba(0,0,0,.08); }
.ep-inp.err    { border-color:#dc2626; }

.ep-sel {
    appearance:none; -webkit-appearance:none; cursor:pointer;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 11px center; padding-right:32px;
}

/* ── CHIPS & BUTTONS ── */
.ep-chip {
    height:34px; padding:0 12px; border:1.5px solid #e2e8f2; border-radius:8px;
    background:#fff; color:#64748b; font-size:12px; font-weight:600; font-family:inherit;
    cursor:pointer; transition:all .2s; white-space:nowrap;
}
.ep-chip:hover { border-color:#3b82f6; color:#3b82f6; background:#eff6ff; }
.ep-chip.on    { background:#dbeafe; border-color:#3b82f6; color:#1e40af; box-shadow:0 1px 3px rgba(59,130,246,.2); }

/* ── TOGGLES ── */
.ep-tog { position:relative; width:44px; height:24px; border:none; border-radius:12px; cursor:pointer; transition:background .25s; flex-shrink:0; background:#cbd5e1; }
.ep-tog-dot { position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,.15); transition:left .25s; }

/* ── GRIDS ── */
.g2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.g3e { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }

.ep-sec { animation:ep-in .3s ease; }
.ep-sec-ttl { font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#94a3b8; padding-bottom:10px; border-bottom:1px solid #f1f5f9; margin-bottom:2px; }
.ep-hlrow { display:flex; gap:8px; align-items:center; }
.ep-hlrow:hover .ep-hlrm { opacity:1 !important; }
.ep-imggrid { display:grid; grid-template-columns:repeat(3,1fr) !important; gap:12px; }
.ep-slot { aspect-ratio:1; background:#fafbfc; border:1.5px solid #e2e8f2; border-radius:10px; overflow:hidden; position:relative; transition:all .2s; }
.ep-slot:hover { border-color:#3b82f6; box-shadow:0 2px 8px rgba(59,130,246,.1); }
.ep-actions { display:flex; gap:10px; align-items:center; }

/* ── CARD ── */
.ep-card { 
    background:#fff; border:1.5px solid #e2e8f2; border-radius:12px; 
    overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.05);
}
.ep-bar { height:4px; background:linear-gradient(90deg,#3b82f6 0%,#1e40af 100%); }

/* ── BUTTONS ── */
.ep-submit {
    flex:2; padding:12px 20px; background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);
    color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:700; 
    font-family:inherit; cursor:pointer; display:flex; align-items:center; 
    justify-content:center; gap:8px; box-shadow:0 4px 12px rgba(59,130,246,.3);
    transition:all .2s;
}
.ep-submit:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 16px rgba(59,130,246,.35); }
.ep-submit:active:not(:disabled) { transform:translateY(0); }
.ep-submit:disabled { background:#cbd5e1; box-shadow:none; cursor:not-allowed; }

/* ── ERRORS ── */
.ep-errbanner {
    margin:0 20px 16px; padding:12px 14px;
    background:#fef2f2; border:1.5px solid #fecaca;
    border-radius:8px; color:#991b1b; font-size:13px; font-weight:600;
}

/* ════════════════════════════════════════
   RESPONSIVE DESIGN
════════════════════════════════════════ */
@media(max-width:900px) {
    .g3e { grid-template-columns:1fr 1fr; }
}

@media(max-width:768px) {
    .ep { padding:18px 12px 60px !important; }
    .g2, .g3e { grid-template-columns:1fr !important; gap:14px; }
    .ep-imggrid { grid-template-columns:repeat(2,1fr) !important; gap:10px; }
    .ep-card { border-radius:10px; }
    .ep-submit { min-width:100%; order:1; flex:1; padding:11px 16px; }
    .ep-actions { padding:12px 16px 20px !important; flex-wrap:wrap; }
    .ep-inp, .ep-sel { font-size:14px; padding:9px 11px; }
}

@media(max-width:640px) {
    .ep { padding:14px 10px 50px !important; }
    .g2, .g3e { gap:12px; }
    .ep-imggrid { grid-template-columns:repeat(2,1fr) !important; gap:8px; }
    .ep-slot { border-radius:8px; }
    .ep-actions { padding:10px 12px 16px !important; gap:6px; }
    .ep-actions button { font-size:12px; padding:9px 12px; }
    .ep-chip { font-size:11px; padding:0 10px; height:32px; }
    .ep-errbanner { margin:0 14px 12px; padding:10px 12px; font-size:12px; }
    .ep-inp::placeholder { font-size:13px; }
}

@media(max-width:480px) {
    .ep { padding:12px 8px 45px !important; }
    .g2, .g3e { gap:10px; }
    .ep-imggrid { gap:6px; }
    .ep-actions { padding:8px 10px 14px !important; }
    .ep-slot { min-height:70px; }
    .ep-card { border-radius:8px; }
}

@media(max-width:380px) {
    .ep { padding:10px 8px 40px !important; }
    .g2, .g3e { gap:8px; }
    .ep-actions { padding:6px 8px 12px !important; gap:4px; }
    .ep-slot { min-height:60px; }
    .ep-imggrid { gap:5px; }
}
`;

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const Field = ({ label, hint, err, children }) => (
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
);

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
        <button type="button" className="ep-tog" style={{ background: on ? accent : "#d1d5db" }}
            onClick={e => { e.stopPropagation(); toggle(); }}>
            <div className="ep-tog-dot" style={{ left: on ? 21 : 2 }} />
        </button>
    </div>
);

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
const AdminEditProduct = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "", description: "", price: "", mrp: "", category: "", subcategory: "",
        isCustomizable: false, isFeatured: false, tags: "", stock: "",
        brand: "", sku: "", weight: "", origin: "", color: "", material: "", occasion: "",
        isDeal: false, dealEndsAt: "", returnPolicy: "7", shippingInfo: "", gstPercent: "0",
        isCancellable: true, isReturnable: true, isReplaceable: false,
        returnWindow: "7", replacementWindow: "7", cancelWindow: "0", nonReturnableReason: "",
    });
    const [custConfig, setCustConfig] = useState({ ...DEFAULT_CUST_CONFIG });
    const [images, setImages] = useState([]);
    const [curImgs, setCurImgs] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fErrs, setFErrs] = useState({});
    const [topErr, setTopErr] = useState("");
    const [toast, setToast] = useState(null);
    const [selSizes, setSelSizes] = useState([]);
    const [sizeStockMap, setSizeStockMap] = useState({});
    const [hls, setHls] = useState([{ key: "", value: "" }]);
    const [hlTemplate, setHlTemplate] = useState([]);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchAllCategories().then(res => {
            const cats = res.data?.categories || res.data || [];
            setCategories(cats);
        }).catch(() => { });
    }, []);

    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };
    const clrErr = (name) => { setFErrs(p => { const n = { ...p }; delete n[name]; return n; }); setTopErr(""); };

    // Fetch highlight template when category changes
    useEffect(() => {
        if (!form.category) { setHlTemplate([]); return; }
        api.get(`/categories/highlight-template?category=${encodeURIComponent(form.category)}`)
            .then(res => setHlTemplate(res.data?.highlightTemplate || []))
            .catch(() => setHlTemplate([]));
    }, [form.category]);

    /* Fetch product */
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get(`/products/${id}`);
                setForm({
                    name: data.name || "",
                    description: data.description || "",
                    price: data.price?.toString() || "",
                    mrp: data.mrp?.toString() || "",
                    category: data.category || "",
                    subcategory: data.subcategory || "",
                    isCustomizable: Boolean(data.isCustomizable),
                    isFeatured: Boolean(data.isFeatured),
                    tags: data.tags?.join(", ") || "",
                    stock: data.stock?.toString() ?? "0",
                    brand: data.brand || "",
                    sku: data.sku || "",
                    weight: data.weight || "",
                    origin: data.origin || "",
                    color: data.color || "",
                    material: data.material || "",
                    occasion: data.occasion || "",
                    isDeal: Boolean(data.isDeal),
                    dealEndsAt: data.dealEndsAt ? data.dealEndsAt.slice(0, 16) : "",
                    returnPolicy: data.returnPolicy || "7",
                    shippingInfo: data.shippingInfo || "",
                    gstPercent: String(data.gstPercent ?? 0),
                    isCancellable: data.isCancellable !== false,
                    isReturnable: data.isReturnable !== false,
                    isReplaceable: data.isReplaceable === true,
                    returnWindow: String(data.returnWindow ?? 7),
                    replacementWindow: String(data.replacementWindow ?? 7),
                    cancelWindow: String(data.cancelWindow ?? 0),
                    nonReturnableReason: data.nonReturnableReason || "",
                });
                if (data.customizationConfig && typeof data.customizationConfig === "object") {
                    setCustConfig({ ...DEFAULT_CUST_CONFIG, ...data.customizationConfig });
                }
                setCurImgs(data.images || []);
                if (data.sizes?.length) {
                    /* handles both [{size:"M"}] and ["M"] */
                    setSelSizes(data.sizes.map(s => typeof s === "string" ? s : s.size).filter(Boolean));
                    const stockMap = {};
                    data.sizes.forEach(s => {
                        if (typeof s === "object" && s.size) stockMap[s.size] = s.stock ?? 0;
                    });
                    setSizeStockMap(stockMap);
                }
                if (data.highlights && Object.keys(data.highlights).length) {
                    const entries = data.highlights instanceof Map
                        ? [...data.highlights.entries()]
                        : Object.entries(data.highlights);
                    setHls(entries.map(([key, value]) => ({ key, value })));
                }
            } catch { setTopErr("Failed to load product"); }
            finally { setLoading(false); }
        })();
    }, [id]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value }));
        clrErr(name);
    };

    const toggleSize = (s) => setSelSizes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
    const updateSizeStock = (size, val) => {
        const n = Math.max(0, parseInt(val) || 0);
        setSizeStockMap(p => ({ ...p, [size]: n }));
        // Auto-calc total stock from sizes
        const updated = { ...sizeStockMap, [size]: n };
        const total = selSizes.reduce((sum, sz) => sum + (updated[sz] || 0), 0);
        setForm(p => ({ ...p, stock: String(total) }));
    };
    const addHL = () => setHls(p => [...p, { key: "", value: "" }]);
    const removeHL = (i) => setHls(p => p.filter((_, j) => j !== i));
    const updateHL = (i, f, v) => setHls(p => p.map((h, j) => j === i ? { ...h, [f]: v } : h));

    const handleImgs = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        for (const f of files) {
            if (f.size > 5 * 1048576) { setTopErr(`"${f.name}" exceeds 5 MB`); return; }
        }
        const totalImages = curImgs.length + files.length;
        if (totalImages > 6) {
            setTopErr(`Maximum 6 images allowed (${curImgs.length} existing + ${files.length} new = ${totalImages})`);
            return;
        }
        setImages(files);
        setPreviews(files.map(f => URL.createObjectURL(f)));
        setTopErr("");
    };

    const removeNewImg = (i) => {
        setImages(p => p.filter((_, j) => j !== i));
        setPreviews(p => p.filter((_, j) => j !== i));
    };

    const discPct = form.mrp && form.price && +form.mrp > +form.price
        ? Math.round(((+form.mrp - +form.price) / +form.mrp) * 100) : null;

    /* ─────────────────────────────────────────────────────
       SUBMIT — all bugs fixed
    ───────────────────────────────────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFErrs({}); setTopErr("");

        /* Client pre-flight */
        const fe = {};
        if (!form.name.trim()) fe.name = "Required";
        if (!form.price || +form.price <= 0) fe.price = "Enter a valid price";
        if (!form.category) fe.category = "Required";
        if (form.mrp && +form.mrp < +form.price) fe.mrp = "MRP must be ≥ selling price";
        if (form.stock === "" || +form.stock < 0) fe.stock = "Required (0 or more)";
        if (form.isDeal && form.dealEndsAt && isNaN(new Date(form.dealEndsAt).getTime()))
            fe.dealEndsAt = "Invalid date";
        if (Object.keys(fe).length) {
            setFErrs(fe);
            setTopErr(`Fix ${Object.keys(fe).length} field(s) before saving`);
            return;
        }

        try {
            setSaving(true);

            /* ── CRITICAL: use `formData`, NOT `fd` ── */
            const formData = new FormData();

            /* Required */
            formData.append("name", form.name.trim());
            formData.append("category", form.category);
            formData.append("price", String(+form.price));
            formData.append("stock", String(+form.stock));

            /* Optional strings */
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
            ["subcategory", form.subcategory],
            ].forEach(([k, v]) => {
                const s = v?.toString().trim();
                if (s) formData.append(k, s);
            });

            /* GST */
            formData.append("gstPercent", String(+form.gstPercent || 0));

            /* POLICY FIELDS */
            formData.append("isCancellable", form.isCancellable ? "true" : "false");
            formData.append("isReturnable", form.isReturnable ? "true" : "false");
            formData.append("isReplaceable", form.isReplaceable ? "true" : "false");
            formData.append("returnWindow", String(+form.returnWindow || 7));
            formData.append("replacementWindow", String(+form.replacementWindow || 7));
            formData.append("cancelWindow", String(+form.cancelWindow || 0));
            if (form.nonReturnableReason.trim()) formData.append("nonReturnableReason", form.nonReturnableReason.trim());

            /* Booleans */
            formData.append("isFeatured", form.isFeatured ? "true" : "false");
            formData.append("isDeal", form.isDeal ? "true" : "false");
            formData.append("isCustomizable", form.isCustomizable ? "true" : "false");

            /* Customization config */
            if (form.isCustomizable) {
                formData.append("customizationConfig", JSON.stringify(custConfig));
            }

            /*
             * FIX: NEVER send dealEndsAt as empty string
             * z.coerce.date("") = Invalid Date → Zod 400 with path=[]
             * → errors[0].field = "" → "0 fields have errors"
             */
            if (form.isDeal && form.dealEndsAt && form.dealEndsAt.trim()) {
                const d = new Date(form.dealEndsAt);
                if (!isNaN(d.getTime())) formData.append("dealEndsAt", d.toISOString());
            }

            /* Tags → JSON array (FIX: plain string fails z.array()) */
            const tagsArr = form.tags.split(",").map(t => t.trim()).filter(Boolean);
            if (tagsArr.length) formData.append("tags", JSON.stringify(tagsArr));

            /* Images */
            images.forEach(img => formData.append("images", img));

            /* Sizes */
            if (selSizes.length) {
                formData.append("sizes", JSON.stringify(selSizes.map(s => ({ size: s, stock: sizeStockMap[s] || 0 }))));
            }

            /* Highlights */
            const validHls = hls.filter(h => h.key.trim() && h.value.trim());
            if (validHls.length) {
                const obj = {};
                validHls.forEach(h => { obj[h.key.trim()] = h.value.trim(); });
                formData.append("highlights", JSON.stringify(obj));
                formData.append("highlightsArray", JSON.stringify(validHls.map(h => ({ title: h.key.trim(), value: h.value.trim() }))));
            }

            await api.put(`/products/admin/${id}`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            showToast("success", "Product updated successfully!");
            setTimeout(() => navigate("/admin/products"), 1400);

        } catch (err) {
            console.error("[AdminEditProduct] error:", err.response?.data);

            const apiErrors = err.response?.data?.errors;
            if (Array.isArray(apiErrors) && apiErrors.length) {
                const mapped = {};
                apiErrors.forEach(({ field, message }) => { if (field) mapped[field] = message; });
                if (Object.keys(mapped).length) {
                    setFErrs(mapped);
                    setTopErr(`Server rejected ${apiErrors.length} field(s): ${apiErrors.map(e => e.field || e.message).join(", ")}`);
                } else {
                    setTopErr(`Validation error: ${apiErrors.map(e => e.message).join(", ")}`);
                }
            } else {
                setTopErr(err.response?.data?.message || "Failed to update product.");
            }
        } finally {
            setSaving(false);
        }
    };

    /* Loading screen */
    if (loading) return (
        <div className="ep" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
            <style>{CSS}</style>
            <div style={{ width: 36, height: 36, border: "3px solid #dbeafe", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "ep-spin .8s linear infinite" }} />
            <p style={{ fontSize: 13, color: "#94a3b8" }}>Loading product…</p>
        </div>
    );

    /* ═══════════════════════════════════════════════════════
       RENDER
    ═══════════════════════════════════════════════════════ */
    return (
        <div className="ep" style={{ background: "#f0f4fb", minHeight: "100vh", padding: "24px 16px 80px" }}>
            <style>{CSS}</style>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 16, right: 16, zIndex: 9999,
                    background: toast.type === "success" ? "#dcfce7" : "#fef2f2",
                    border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                    color: toast.type === "success" ? "#15803d" : "#ef4444",
                    padding: "11px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 8,
                    animation: "ep-pop .25s ease", boxShadow: "0 4px 16px rgba(0,0,0,.1)",
                }}>
                    <FiCheckCircle size={14} /> {toast.msg}
                </div>
            )}

            <div style={{ width: "100%", maxWidth: 850, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
                    <button onClick={() => navigate("/admin/products")}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", border: "1.5px solid #e2e8f2", borderRadius: 9, color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        <FiArrowLeft size={13} /> Back
                    </button>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 1 }}>Products</p>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#18202e", margin: 0, letterSpacing: "-.02em" }}>Edit Product</h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="ep-card">
                        <div className="ep-bar" />
                        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>

                            {/* ══ Basic Info ══ */}
                            <p className="ep-sec-ttl">Basic Information</p>

                            <Field label="Product Name" hint="*required" err={fErrs.name}>
                                <input name="name" value={form.name} onChange={handleChange}
                                    placeholder="e.g. Premium Cotton Kurta"
                                    className={`ep-inp${fErrs.name ? " err" : ""}`} />
                            </Field>

                            <Field label="Description" hint="optional">
                                <textarea name="description" value={form.description} onChange={handleChange} rows={3}
                                    placeholder="Fabric, fit, occasion, care instructions…"
                                    className="ep-inp" style={{ resize: "vertical", lineHeight: 1.6 }} />
                            </Field>

                            <div className="g2">
                                <Field label="Brand">
                                    <input name="brand" value={form.brand} onChange={handleChange}
                                        placeholder="UrbeXon" className="ep-inp" />
                                </Field>
                                <Field label="SKU / Code">
                                    <input name="sku" value={form.sku} onChange={handleChange}
                                        placeholder="UX-KRT-001" className="ep-inp" />
                                </Field>
                            </div>

                            <div className="g2">
                                <Field label="Color">
                                    <input name="color" value={form.color} onChange={handleChange}
                                        placeholder="Navy Blue" className="ep-inp" />
                                </Field>
                                <Field label="Material">
                                    <input name="material" value={form.material} onChange={handleChange}
                                        placeholder="Cotton" className="ep-inp" />
                                </Field>
                            </div>

                            <div className="g2">
                                <Field label="Category" hint="*required" err={fErrs.category}>
                                    <select name="category" value={form.category} onChange={handleChange}
                                        className={`ep-inp ep-sel${fErrs.category ? " err" : ""}`}>
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
                                        placeholder="e.g. Kurta Set, Running Shoes" className="ep-inp" />
                                </Field>
                            </div>

                            <Field label="Tags" hint="comma-separated">
                                <div style={{ position: "relative" }}>
                                    <FiTag size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0" }} />
                                    <input name="tags" value={form.tags} onChange={handleChange}
                                        placeholder="kurta, ethnic, festive"
                                        className="ep-inp" style={{ paddingLeft: 29 }} />
                                </div>
                            </Field>

                            {/* ══ Pricing & Stock ══ */}
                            <p className="ep-sec-ttl" style={{ marginTop: 6 }}>Pricing & Stock</p>

                            <div className="g2">
                                <Field label="Selling Price (₹)" hint="*required" err={fErrs.price}>
                                    <div style={{ position: "relative" }}>
                                        <FiDollarSign size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0" }} />
                                        <input name="price" type="number" min="0" value={form.price} onChange={handleChange}
                                            placeholder="0" className={`ep-inp${fErrs.price ? " err" : ""}`} style={{ paddingLeft: 29 }} />
                                    </div>
                                </Field>
                                <Field label="MRP (₹)" hint="optional" err={fErrs.mrp}>
                                    <div style={{ position: "relative" }}>
                                        <FiDollarSign size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0" }} />
                                        <input name="mrp" type="number" min="0" value={form.mrp} onChange={handleChange}
                                            placeholder="0" className={`ep-inp${fErrs.mrp ? " err" : ""}`} style={{ paddingLeft: 29 }} />
                                    </div>
                                    {discPct && (
                                        <p style={{ fontSize: 12, marginTop: 3, color: "#059669", fontWeight: 600 }}>
                                            🏷 {discPct}% off — saves ₹{(+form.mrp - +form.price).toLocaleString("en-IN")}
                                        </p>
                                    )}
                                </Field>
                            </div>

                            <div className="g2">
                                <Field label="Stock Quantity" hint={selSizes.length ? "auto from sizes" : "*required"} err={fErrs.stock}>
                                    <div style={{ position: "relative" }}>
                                        <FiBox size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0" }} />
                                        <input name="stock" type="number" min="0" value={form.stock} onChange={handleChange}
                                            readOnly={selSizes.length > 0}
                                            placeholder="0" className={`ep-inp${fErrs.stock ? " err" : ""}`} style={{ paddingLeft: 29, background: selSizes.length > 0 ? "#f1f5f9" : "#fff" }} />
                                    </div>
                                    {form.stock !== "" && !fErrs.stock && (
                                        <p style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color: +form.stock > 0 ? "#059669" : "#ef4444" }}>
                                            {+form.stock > 0 ? `✓ In Stock — ${form.stock} units` : "✕ Out of Stock"}
                                            {selSizes.length > 0 && " — edit per-size stock in Sizes section below"}
                                        </p>
                                    )}
                                </Field>
                                <Field label="GST %" hint="tax slab">
                                    <select name="gstPercent" value={form.gstPercent} onChange={handleChange}
                                        className="ep-inp ep-sel">
                                        {GST_RATES.map(r => (
                                            <option key={r} value={r}>{r}%</option>
                                        ))}
                                    </select>
                                </Field>
                            </div>

                            <div className="g2">
                                <Field label="Return Policy">
                                    <select name="returnPolicy" value={form.returnPolicy} onChange={handleChange}
                                        className="ep-inp ep-sel">
                                        <option value="0">No Returns</option>
                                        <option value="7">7 Days</option>
                                        <option value="15">15 Days</option>
                                        <option value="30">30 Days</option>
                                    </select>
                                </Field>
                                <Field label="Shipping Info" hint="optional">
                                    <input name="shippingInfo" value={form.shippingInfo} onChange={handleChange}
                                        placeholder="Ships in 2–3 days" className="ep-inp" />
                                </Field>
                            </div>

                            {/* ── Cancel / Return / Replacement Policy ── */}
                            <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f2", borderRadius: 11, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", letterSpacing: ".04em" }}>
                                    📋 Cancel / Return / Replacement Policy
                                </p>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: form.isCancellable ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${form.isCancellable ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                                        <input type="checkbox" checked={form.isCancellable} onChange={e => setForm(p => ({ ...p, isCancellable: e.target.checked }))} />
                                        Cancellable
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: form.isReturnable ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${form.isReturnable ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                                        <input type="checkbox" checked={form.isReturnable} onChange={e => setForm(p => ({ ...p, isReturnable: e.target.checked }))} />
                                        Returnable
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: form.isReplaceable ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${form.isReplaceable ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                                        <input type="checkbox" checked={form.isReplaceable} onChange={e => setForm(p => ({ ...p, isReplaceable: e.target.checked }))} />
                                        Replaceable
                                    </label>
                                </div>
                                <div className="g2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                                    <Field label="Cancel Window (hrs)" hint="0 = until packed">
                                        <input name="cancelWindow" value={form.cancelWindow} onChange={handleChange} type="number" min="0" max="72" placeholder="0" className="ep-inp" />
                                    </Field>
                                    <Field label="Return Window (days)" hint="after delivery">
                                        <input name="returnWindow" value={form.returnWindow} onChange={handleChange} type="number" min="0" max="30" placeholder="7" className="ep-inp" />
                                    </Field>
                                    <Field label="Replacement Window (days)" hint="after delivery">
                                        <input name="replacementWindow" value={form.replacementWindow} onChange={handleChange} type="number" min="0" max="30" placeholder="7" className="ep-inp" />
                                    </Field>
                                </div>
                                {!form.isReturnable && (
                                    <Field label="Non-Returnable Reason" hint="shown to customer">
                                        <input name="nonReturnableReason" value={form.nonReturnableReason} onChange={handleChange} placeholder="e.g. Hygiene product, Perishable item" className="ep-inp" />
                                    </Field>
                                )}
                            </div>

                            <div className="g2">
                                <Toggle on={form.isFeatured}
                                    toggle={() => setForm(p => ({ ...p, isFeatured: !p.isFeatured }))}
                                    label={<><FiStar size={11} style={{ color: "#f59e0b", marginRight: 4 }} />Featured</>}
                                    sub="Shown on homepage" accent="#f59e0b" />
                                <Toggle on={form.isCustomizable}
                                    toggle={() => setForm(p => ({ ...p, isCustomizable: !p.isCustomizable }))}
                                    label="Customizable"
                                    sub="Custom design allowed" />
                            </div>

                            {/* ── Customization Config Panel ── */}
                            {form.isCustomizable && (
                                <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f2", borderRadius: 11, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", letterSpacing: ".04em" }}>
                                        🎨 Customization Options
                                    </p>

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
                                                        placeholder="Name / Message" className="ep-inp" />
                                                </Field>
                                                <Field label="Text Placeholder">
                                                    <input value={custConfig.textPlaceholder}
                                                        onChange={e => setCustConfig(p => ({ ...p, textPlaceholder: e.target.value }))}
                                                        placeholder="e.g. Happy Birthday!" className="ep-inp" />
                                                </Field>
                                                <Field label="Max Length">
                                                    <input type="number" min="1" max="500" value={custConfig.textMaxLength}
                                                        onChange={e => setCustConfig(p => ({ ...p, textMaxLength: +e.target.value || 100 }))}
                                                        className="ep-inp" />
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
                                                        placeholder="Upload Design" className="ep-inp" />
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
                                                        placeholder="Special Instructions" className="ep-inp" />
                                                </Field>
                                                <Field label="Note Placeholder">
                                                    <input value={custConfig.notePlaceholder}
                                                        onChange={e => setCustConfig(p => ({ ...p, notePlaceholder: e.target.value }))}
                                                        placeholder="e.g. White background..." className="ep-inp" />
                                                </Field>
                                            </div>
                                        )}
                                    </div>

                                    <Field label="Extra Charge for Customization (₹)" hint="0 = free">
                                        <input type="number" min="0" value={custConfig.extraPrice}
                                            onChange={e => setCustConfig(p => ({ ...p, extraPrice: +e.target.value || 0 }))}
                                            placeholder="0" className="ep-inp" style={{ width: "100%", maxWidth: 180 }} />
                                    </Field>
                                </div>
                            )}

                            <Toggle on={form.isDeal}
                                toggle={() => setForm(p => ({ ...p, isDeal: !p.isDeal, dealEndsAt: "" }))}
                                label={<><FiZap size={11} style={{ color: "#f59e0b", marginRight: 4 }} />Mark as Deal</>}
                                sub="Appears in Deals section" accent="#f59e0b" />

                            {form.isDeal && (
                                <Field label="Deal Ends At" hint="optional" err={fErrs.dealEndsAt}>
                                    <input type="datetime-local" name="dealEndsAt" value={form.dealEndsAt}
                                        onChange={handleChange}
                                        className={`ep-inp${fErrs.dealEndsAt ? " err" : ""}`} />
                                    <p style={{ fontSize: 11, color: "#b0bbd0", marginTop: 2 }}>Leave blank for no expiry</p>
                                </Field>
                            )}

                            {/* ══ Sizes & Details ══ */}
                            <p className="ep-sec-ttl" style={{ marginTop: 6 }}>Sizes & Details</p>

                            <Field label="Available Sizes" hint="click to toggle">
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {ALL_SIZES.map(s => (
                                        <button key={s} type="button" onClick={() => toggleSize(s)}
                                            className={`ep-chip${selSizes.includes(s) ? " on" : ""}`}>
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

                            <Field label="Product Highlights" hint="optional">
                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                    {hls.map((h, i) => (
                                        <div key={i} className="ep-hlrow" style={{ display: "flex", gap: 7, alignItems: "center" }}>
                                            <select value={h.key} onChange={e => updateHL(i, "key", e.target.value)}
                                                className="ep-inp ep-sel"
                                                style={{ flex: "0 0 148px", padding: "9px 32px 9px 10px" }}>
                                                <option value="">Select key</option>
                                                {(hlTemplate.length ? hlTemplate.map(t => t.title) : HIGHLIGHT_KEYS).map(k => <option key={k} value={k}>{k}</option>)}
                                            </select>
                                            <input value={h.value} onChange={e => updateHL(i, "value", e.target.value)}
                                                placeholder="Value…"
                                                className="ep-inp" style={{ flex: 1, padding: "9px 11px" }} />
                                            {hls.length > 1 && (
                                                <button type="button" onClick={() => removeHL(i)} className="ep-hlrm"
                                                    style={{ width: 30, height: 30, borderRadius: 7, background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0, transition: "opacity .15s" }}>
                                                    <FiX size={10} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={addHL}
                                        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: "3px 0" }}>
                                        <FiPlus size={11} /> Add highlight
                                    </button>
                                </div>
                            </Field>

                            <div className="g2">
                                <Field label="Weight" hint="optional">
                                    <div style={{ position: "relative" }}>
                                        <FiPackage size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0" }} />
                                        <input name="weight" value={form.weight} onChange={handleChange}
                                            placeholder="e.g. 250g" className="ep-inp" style={{ paddingLeft: 29 }} />
                                    </div>
                                </Field>
                                <Field label="Country of Origin" hint="optional">
                                    <div style={{ position: "relative" }}>
                                        <FiGlobe size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#b0bbd0" }} />
                                        <input name="origin" value={form.origin} onChange={handleChange}
                                            placeholder="India" className="ep-inp" style={{ paddingLeft: 29 }} />
                                    </div>
                                </Field>
                            </div>

                            {/* ══ Images ══ */}
                            <p className="ep-sec-ttl" style={{ marginTop: 6 }}>Product Images</p>

                            {/* Current images (shown only if no new ones selected) */}
                            {curImgs.length > 0 && previews.length === 0 && (
                                <Field label="Current Images">
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9 }}>
                                        {curImgs.map((img, i) => (
                                            <div key={i} className="ep-slot">
                                                <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                {i === 0 && <span style={{ position: "absolute", bottom: 5, left: 5, background: "#1d4ed8", color: "#fff", fontSize: 8, fontWeight: 800, padding: "2px 7px", borderRadius: 4 }}>MAIN</span>}
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: 11, color: "#b0bbd0", marginTop: 6 }}>Upload new images below to replace these</p>
                                </Field>
                            )}

                            {/* Upload zone */}
                            <Field label={previews.length > 0 ? "New Images (will replace current)" : "Replace Images"} hint="optional, max 6">
                                {previews.length === 0 ? (
                                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: 100, border: "2px dashed #cdd5e3", borderRadius: 10, cursor: "pointer", background: "#f8fafc", transition: "all .2s" }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.background = "#eff6ff"; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#cdd5e3"; e.currentTarget.style.background = "#f8fafc"; }}>
                                        <FiUpload size={20} color="#94a3b8" style={{ marginBottom: 6 }} />
                                        <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Click to upload</p>
                                        <p style={{ fontSize: 10, color: "#b0bbd0", marginTop: 2 }}>PNG · JPG · WEBP · Max 5 MB each</p>
                                        <input type="file" multiple accept="image/*" onChange={handleImgs} style={{ display: "none" }} />
                                    </label>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9 }}>
                                        {previews.map((src, i) => (
                                            <div key={i} className="ep-slot">
                                                <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                {i === 0 && <span style={{ position: "absolute", bottom: 5, left: 5, background: "#1d4ed8", color: "#fff", fontSize: 8, fontWeight: 800, padding: "2px 7px", borderRadius: 4 }}>MAIN</span>}
                                                <button type="button" onClick={() => removeNewImg(i)}
                                                    style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                                    <FiX size={9} />
                                                </button>
                                            </div>
                                        ))}
                                        {previews.length < 6 && (
                                            <label style={{ aspectRatio: "1", border: "2px dashed #cdd5e3", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#f8fafc", transition: "all .2s" }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.background = "#eff6ff"; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#cdd5e3"; e.currentTarget.style.background = "#f8fafc"; }}>
                                                <FiPlus size={18} color="#94a3b8" />
                                                <input type="file" multiple accept="image/*" onChange={handleImgs} style={{ display: "none" }} />
                                            </label>
                                        )}
                                    </div>
                                )}
                            </Field>
                        </div>

                        {/* Error banner */}
                        {topErr && (
                            <div className="ep-errbanner">
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

                        {/* Buttons */}
                        <div style={{ padding: "0 24px 24px", display: "flex", gap: 10 }}>
                            <button type="button" onClick={() => navigate("/admin/products")}
                                style={{ flex: 1, padding: "11px", background: "#fff", border: "1.5px solid #e2e8f2", borderRadius: 9, color: "#64748b", fontWeight: 600, fontSize: 13.5, cursor: "pointer", transition: "all .15s" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#18202e"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#64748b"; }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={saving} className="ep-submit">
                                {saving ? (
                                    <>
                                        <div style={{ width: 15, height: 15, border: "2.5px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "ep-spin .8s linear infinite" }} />
                                        Updating…
                                    </>
                                ) : "Update Product"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminEditProduct;