import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/adminApi";
import { fetchAllCategories } from "../api/categoryApi";
import { Button, Badge, Card, ErrorState, FormField, Input, Select } from "../components/ui";
import DynamicAttributeFields from "../components/DynamicAttributeFields";

/* ─────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────── */
const SIZE_TEMPLATES = {
    apparel_top: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Free Size"],
    apparel_bottom: ["28", "30", "32", "34", "36", "38", "40", "42", "44"],
    footwear: ["UK 4", "UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11", "UK 12"],
    storage: ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB"],
    ram: ["2GB", "4GB", "6GB", "8GB", "12GB", "16GB"],
    volume: ["10ml", "30ml", "50ml", "100ml", "200ml", "250ml", "500ml", "1L"],
    weight: ["50g", "100g", "200g", "250g", "500g", "1kg", "2kg", "5kg"],
};

const getSuggestedSizes = (categoryName) => {
    if (!categoryName) return SIZE_TEMPLATES.apparel_top;
    const lowerCat = String(categoryName).toLowerCase();
    if (lowerCat.match(/shoe|footwear|sneaker|sandal|slipper|boot/)) return SIZE_TEMPLATES.footwear;
    if (lowerCat.match(/jeans|trouser|pant|short|track|bottom/)) return SIZE_TEMPLATES.apparel_bottom;
    if (lowerCat.match(/phone|laptop|tablet|mobile|computer|pendrive|drive|storage/)) return [...SIZE_TEMPLATES.storage, ...SIZE_TEMPLATES.ram];
    if (lowerCat.match(/perfume|shampoo|oil|wash|cream|lotion|liquid|beauty/)) return SIZE_TEMPLATES.volume;
    if (lowerCat.match(/grocery|food|tea|coffee|sugar|rice|dal|dry fruit|powder/)) return SIZE_TEMPLATES.weight;
    return SIZE_TEMPLATES.apparel_top;
};

const GST_RATES = ["0", "5", "12", "18", "28"];
const HIGHLIGHT_KEYS = [
    "Fabric", "Sleeve", "Pattern", "Color", "Pack of", "Collar", "Fit",
    "Material", "Brand", "Origin", "Occasion", "Wash Care", "Warranty",
    "Model No", "Dimensions", "Weight", "Battery", "Processor", "RAM",
    "Storage", "Display", "Camera", "Connectivity", "OS", "Power",
];

const PRODUCT_TYPE_CONFIG = {
    ecommerce: {
        label: "E-Commerce", icon: "🛍️",
        color: "var(--adm-primary)", bg: "var(--adm-primary-tint)", border: "var(--adm-primary)",
        sections: ["basic", "pricing", "variants", "details", "images", "policy", "seo"],
        hint: "Standard online store product — no prep time needed",
    },
    urbexon_hour: {
        label: "Urbexon Hour", icon: "⚡",
        color: "var(--adm-warning)", bg: "var(--adm-warning-tint)", border: "var(--adm-warning)",
        sections: ["basic", "pricing", "variants", "details", "images", "policy", "quick"],
        hint: "Fast delivery product — vendor managed, prep time required",
    },
};

const SECTION_META = {
    basic: { label: "Basic Info", icon: "📝" },
    pricing: { label: "Pricing & Stock", icon: "💰" },
    variants: { label: "Variants", icon: "🎨" },
    details: { label: "Details", icon: "🏷️" },
    images: { label: "Images", icon: "🖼️" },
    policy: { label: "Policy", icon: "📋" },
    seo: { label: "SEO & Shipping", icon: "🚚" },
    quick: { label: "Quick Commerce", icon: "⚡" },
};

const FIELD_TAB = {
    name: "basic", description: "basic", brand: "basic", sku: "basic", category: "basic",
    subcategory: "basic", tags: "basic", color: "basic", material: "basic", occasion: "basic",
    price: "pricing", mrp: "pricing", stock: "pricing", gstPercent: "pricing",
    isDeal: "pricing", dealEndsAt: "pricing",
    colorVariants: "variants", sizes: "variants",
    highlights: "details", weight: "details", origin: "details",
    images: "images",
    isCancellable: "policy", isReturnable: "policy", isReplaceable: "policy",
    returnWindow: "policy", replacementWindow: "policy", cancelWindow: "policy",
    returnConditions: "policy", packagingRequired: "policy", tagsRequired: "policy", returnMethod: "policy",
    returnPolicy: "seo", shippingInfo: "seo", metaTitle: "seo", metaDesc: "seo",
    hsn: "pricing", barcode: "pricing", lowStockThreshold: "pricing",
    shipLength: "seo", shipWidth: "seo", shipHeight: "seo",
    prepTimeMinutes: "quick", maxOrderQty: "quick", vendorId: "quick",
};

/* Per-step required checks for the wizard's Next button. Full validation
   still runs on Publish; this catches problems early, per step. */
const STEP_VALIDATORS = {
    basic: (ctx) => {
        const fe = {};
        if (!ctx.form.name.trim()) fe.name = "Required";
        if (!ctx.form.category) fe.category = "Required";
        return fe;
    },
    pricing: (ctx) => {
        const fe = {};
        if (!ctx.form.price || +ctx.form.price <= 0) fe.price = "Enter valid price";
        if (ctx.form.mrp && +ctx.form.mrp < +ctx.form.price) fe.mrp = "MRP must be ≥ price";
        if (!ctx.enableVariants && (ctx.form.stock === "" || +ctx.form.stock < 0)) fe.stock = "Required (0 or more)";
        return fe;
    },
    variants: (ctx) => {
        const fe = {};
        if (ctx.enableVariants && ctx.colorVariants.some(v => !v.name.trim()))
            fe.colorVariants = "All color variants must have a name";
        return fe;
    },
    images: (ctx) => {
        const fe = {};
        if (ctx.mainImages.length === 0 && ctx.colorVariants.every(v => v.images.length === 0))
            fe.images = "At least 1 image required";
        return fe;
    },
    quick: (ctx) => {
        const fe = {};
        if (!ctx.form.vendorId?.trim()) fe.vendorId = "Vendor ID required for UH";
        return fe;
    },
};

const DRAFT_KEY = "adm_product_draft_v1";

const DEFAULT_FORM = {
    name: "", description: "", price: "", mrp: "", category: "", subcategory: "",
    isFeatured: false, isDeal: false, dealEndsAt: "", isCustomizable: false,
    tags: "", stock: "", brand: "", sku: "", weight: "", origin: "",
    returnPolicy: "7", shippingInfo: "", metaTitle: "", metaDesc: "",
    hsn: "", barcode: "", lowStockThreshold: "5",
    shipLength: "", shipWidth: "", shipHeight: "",
    color: "", material: "", occasion: "", gstPercent: "0",
    isCancellable: true, isReturnable: true, isReplaceable: false,
    returnWindow: "7", replacementWindow: "7", cancelWindow: "0",
    nonReturnableReason: "",
    returnConditions: ["damaged", "wrong_product", "defective"],
    packagingRequired: false, tagsRequired: false, returnMethod: "self_ship",
    prepTimeMinutes: "10", maxOrderQty: "10", vendorId: "",
};

/**
 * v2.1: Each color variant now has price + mrp fields
 * price: "" = use base product price
 * mrp:   "" = use base product mrp
 */
const DEFAULT_COLOR_VARIANT = () => ({
    id: Date.now() + Math.random(),
    name: "",
    hex: "#000000",
    images: [],
    previews: [],
    stock: "0",
    price: "",   // ← empty = inherit base price
    mrp: "",     // ← empty = inherit base mrp
    isDefault: false,
});

/* ─────────────────────────────────────────────────────────
   STYLES — layout & motion only; colors come from theme tokens
───────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

.pf-root {
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;
  background:var(--adm-bg);
  min-height:100vh;
  color:var(--adm-text-primary);
}

.pf-page-title { font-size:22px; font-weight:800; letter-spacing:-.03em; color:var(--adm-text-primary); }
.pf-page-sub   { font-size:12px; font-weight:600; color:var(--adm-primary); text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; }
.pf-sec-label  { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--adm-muted); padding-bottom:12px; border-bottom:1px solid var(--adm-border-soft); margin-bottom:18px; }

.pf-chip {
  height:32px; padding:0 12px;
  border:1.5px solid var(--adm-border); border-radius:8px;
  background:var(--adm-bg); color:var(--adm-neutral);
  font-size:12px; font-weight:600; font-family:inherit;
  cursor:pointer; transition:all .15s; white-space:nowrap;
  display:inline-flex; align-items:center; gap:4px;
}
.pf-chip:hover:not(.on) { border-color:var(--adm-primary); color:var(--adm-primary); background:var(--adm-primary-tint); }
.pf-chip.on { background:var(--adm-primary-tint); border-color:var(--adm-primary); color:var(--adm-primary); }

.pf-tog-wrap {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 14px; border-radius:12px; cursor:pointer;
  border:1.5px solid var(--adm-border); background:var(--adm-bg); transition:all .18s;
}
.pf-tog-wrap.on { border-color:var(--tog-color, var(--adm-primary)); background:var(--tog-bg, var(--adm-primary-tint)); }
.pf-tog { width:42px; height:23px; border-radius:12px; border:none; cursor:pointer;
  position:relative; flex-shrink:0; background:var(--adm-border); transition:background .2s; }
.pf-tog.on { background:var(--tog-color, var(--adm-primary)); }
.pf-tog-dot { position:absolute; top:2px; left:2px; width:19px; height:19px;
  border-radius:50%; background:var(--adm-surface); box-shadow:0 1px 4px rgba(0,0,0,.18);
  transition:left .2s; }
.pf-tog.on .pf-tog-dot { left:21px; }

.pf-tabbar {
  display:flex; gap:2px; padding:6px;
  background:var(--adm-surface-alt); border-radius:12px;
  overflow-x:auto; scrollbar-width:none;
}
.pf-tabbar::-webkit-scrollbar { display:none; }
.pf-tab {
  display:flex; align-items:center; flex-direction:column;
  padding:7px 10px; border-radius:9px;
  font-size:10px; font-weight:700; font-family:inherit;
  letter-spacing:.04em; color:var(--adm-neutral);
  cursor:pointer; border:none; background:transparent;
  white-space:nowrap; flex-shrink:0; transition:all .15s;
  position:relative; gap:3px;
}
.pf-tab:hover:not(.on) { background:var(--adm-surface); color:var(--adm-text-secondary); }
.pf-tab.on { background:var(--adm-surface); color:var(--adm-primary); box-shadow:var(--adm-shadow-sm); }
.pf-tab-icon { font-size:14px; line-height:1; }
.pf-tab-dot { width:6px; height:6px; border-radius:50%; background:var(--adm-danger);
  position:absolute; top:5px; right:5px; }

.pf-imgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.pf-slot {
  aspect-ratio:1; background:var(--adm-bg); border:1.5px solid var(--adm-border);
  border-radius:12px; overflow:hidden; position:relative; transition:all .18s;
}
.pf-slot:hover { border-color:var(--adm-primary); }
.pf-drop {
  aspect-ratio:1; border:2px dashed var(--adm-border); border-radius:12px;
  background:var(--adm-bg); cursor:pointer;
  display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:6px; padding:16px;
  transition:all .18s;
}
.pf-drop:hover { border-color:var(--adm-primary); background:var(--adm-primary-tint); }
.pf-drop-icon { font-size:22px; opacity:.6; }
.pf-drop-text { font-size:12px; color:var(--adm-neutral); font-weight:600; }
.pf-drop-sub  { font-size:10px; color:var(--adm-muted); }
.pf-img-del {
  position:absolute; top:6px; right:6px;
  width:22px; height:22px; border-radius:6px;
  background:rgba(0,0,0,.55); border:none; color:#fff;
  cursor:pointer; display:flex; align-items:center;
  justify-content:center; font-size:10px; transition:background .15s;
}
.pf-img-del:hover { background:var(--adm-danger); }

/* ── Variant card v2.1 ── */
.pf-variant-card {
  border:1.5px solid var(--adm-border); border-radius:14px;
  background:var(--adm-bg); padding:16px; transition:all .18s;
  position:relative;
}
.pf-variant-card.default { border-color:var(--adm-primary); background:var(--adm-primary-tint); }
.pf-variant-card:hover { border-color:var(--adm-primary); }

.pf-hl-row { display:flex; gap:8px; align-items:center; }
.pf-hl-row:hover .pf-hl-rm { opacity:1!important; }
.pf-hl-rm {
  width:28px; height:28px; border-radius:7px;
  background:var(--adm-danger-tint); border:1px solid var(--adm-danger);
  color:var(--adm-danger); cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  opacity:0; transition:opacity .15s; flex-shrink:0; font-size:10px;
}

.pf-actions { display:flex; gap:8px; align-items:center; padding:14px 24px 22px; }
.pf-submit-wrap { flex:2; display:flex; }
.pf-submit-wrap .adm-btn { width:100%; justify-content:center; }

.pf-discount-row {
  display:flex; align-items:center; gap:12px;
  padding:12px 14px; background:var(--adm-success-tint);
  border-radius:10px; border:1px solid var(--adm-success);
}

.pf-toast {
  position:fixed; top:18px; left:50%; transform:translateX(-50%);
  z-index:99999; padding:11px 22px; border-radius:10px;
  font-weight:700; font-size:13px; font-family:inherit;
  display:flex; align-items:center; gap:8px;
  animation:pf-pop .22s ease; white-space:nowrap;
  box-shadow:var(--adm-shadow-lg);
}
.pf-toast.ok  { background:var(--adm-success); color:var(--adm-text-on-accent); }
.pf-toast.err { background:var(--adm-danger); color:var(--adm-text-on-accent); }

.pf-type-opt {
  flex:1; padding:14px 16px; border-radius:13px;
  border:2px solid var(--adm-border); background:var(--adm-bg);
  cursor:pointer; transition:all .18s; text-align:left; font-family:inherit;
}
.pf-type-opt:hover { border-color:var(--adm-primary); background:var(--adm-primary-tint); }
.pf-type-opt.on { border-color:var(--t-color); background:var(--t-bg); }

.g2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }

@keyframes pf-in  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes pf-pop { from{opacity:0;transform:translateX(-50%) scale(.93)} to{opacity:1;transform:translateX(-50%) scale(1)} }
.pf-anim { animation:pf-in .28s ease; }

@media(max-width:768px){
  .g2,.g3 { grid-template-columns:1fr!important; gap:12px; }
  .pf-imgrid { grid-template-columns:repeat(2,1fr); }
  .pf-actions { flex-wrap:wrap; padding:12px 16px 18px; }
  .pf-submit-wrap { order:-1; min-width:100%; }
  .pf-tab { padding:6px 8px; }
}
@media(max-width:480px){
  .pf-imgrid { grid-template-columns:repeat(2,1fr); gap:7px; }
  .pf-tab-label { display:none; }
  .pf-tab { padding:5px 7px; }
}
`;

/* ─────────────────────────────────────────────────────────
   TINY COMPONENTS
───────────────────────────────────────────────────────── */

/** Composes a FormField label node with an optional required-asterisk / hint. */
const LBL = (label, { required, hint } = {}) => (
    <>
        {label}
        {required && <span style={{ color: "var(--adm-danger)", marginLeft: 2 }}>*</span>}
        {hint && (
            <span style={{ fontSize: 11, color: "var(--adm-muted)", marginLeft: 6, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {hint}
            </span>
        )}
    </>
);

const Toggle = ({ on, toggle, label, sub, color = "var(--adm-primary)", bg = "var(--adm-primary-tint)" }) => (
    <div
        className={`pf-tog-wrap${on ? " on" : ""}`}
        style={{ "--tog-color": color, "--tog-bg": bg }}
        onClick={toggle}
    >
        <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: "var(--adm-text-primary)", marginBottom: 2 }}>{label}</p>
            {sub && <p style={{ fontSize: 11, color: "var(--adm-muted)" }}>{sub}</p>}
        </div>
        <button
            type="button"
            className={`pf-tog${on ? " on" : ""}`}
            style={{ "--tog-color": color }}
            onClick={e => { e.stopPropagation(); toggle(); }}
        >
            <div className="pf-tog-dot" />
        </button>
    </div>
);

const SectionLabel = ({ children }) => (
    <p className="pf-sec-label">{children}</p>
);

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
const AdminAddProduct = () => {
    const navigate = useNavigate();

    const [productType, setProductType] = useState("ecommerce");
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [tab, setTab] = useState("basic");
    const [fErrs, setFErrs] = useState({});
    const [topErr, setTopErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [categories, setCategories] = useState([]);
    const [hlTemplate, setHlTemplate] = useState([]);
    // Marketplace-wide return/replacement/cancel window bounds — same
    // public endpoint the vendor panel's ProductForm.jsx reads.
    const [policyLimits, setPolicyLimits] = useState({
        minReturnWindowDays: 0, maxReturnWindowDays: 30,
        minReplacementWindowDays: 0, maxReplacementWindowDays: 30,
        minCancelWindowHours: 0, maxCancelWindowHours: 72,
        allowedReturnConditions: ["damaged", "wrong_product", "defective", "missing_items", "other"],
    });
    useEffect(() => {
        api.get("/delivery-config/public")
            .then(({ data }) => { if (data?.productPolicyLimits) setPolicyLimits((p) => ({ ...p, ...data.productPolicyLimits })); })
            .catch(() => { });
    }, []);

    const [selSizes, setSelSizes] = useState([]);
    const selSizesRef = useRef([]);
    useEffect(() => { selSizesRef.current = selSizes; }, [selSizes]);
    const [sizeStockMap, setSizeStockMap] = useState({});
    const [availableSizes, setAvailableSizes] = useState([...SIZE_TEMPLATES.apparel_top]);
    const [newSize, setNewSize] = useState("");

    const [hls, setHls] = useState([{ key: "", value: "" }]);
    const [mainImages, setMainImages] = useState([]);
    const [mainPreviews, setMainPreviews] = useState([]);
    const [imageAlts, setImageAlts] = useState([]);      // per-image alt text
    const [uploadPct, setUploadPct] = useState(0);        // publish upload progress
    const [dirty, setDirty] = useState(false);            // unsaved-changes guard
    const [draftAvailable, setDraftAvailable] = useState(() => {
        try { return !!localStorage.getItem(DRAFT_KEY); } catch { return false; }
    });

    const [colorVariants, setColorVariants] = useState([]);
    const [enableVariants, setEnableVariants] = useState(false);

    const [custConfig, setCustConfig] = useState({
        allowText: true, allowImage: true, allowNote: true,
        textLabel: "Name / Message", textPlaceholder: "e.g. Happy Birthday!",
        textMaxLength: 100, imageLabel: "Upload Design",
        noteLabel: "Special Instructions", notePlaceholder: "e.g. White background...",
        extraPrice: 0,
    });

    useEffect(() => {
        fetchAllCategories()
            .then(r => setCategories(r.data?.categories || r.data || []))
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!form.category) { setHlTemplate([]); return; }
        api.get(`/categories/highlight-template?category=${encodeURIComponent(form.category)}`)
            .then(r => {
                const tmpl = r.data?.highlightTemplate || [];
                setHlTemplate(tmpl);
                if (tmpl.length) setHls(tmpl.map(t => ({ key: t.title, value: "" })));
            })
            .catch(() => setHlTemplate([]));
    }, [form.category]);

    // Discovery attributes — schema fetched from category metadata, fields
    // auto-render (no hardcoded attribute names anywhere).
    const [attrSchema, setAttrSchema] = useState([]);
    const [attributes, setAttributes] = useState({});
    useEffect(() => {
        const catObj = categories.find(c => c.value === form.category || c.slug === form.category || c.name === form.category);
        if (!catObj?.slug) { setAttrSchema([]); return; }
        api.get(`/categories/${catObj.slug}/metadata`)
            .then(r => setAttrSchema(r.data?.metadata?.attributeSchema || []))
            .catch(() => setAttrSchema([]));
    }, [form.category, categories]);

    useEffect(() => {
        const catObj = categories.find(c => c.value === form.category || c.slug === form.category || c.name === form.category);
        const catName = catObj ? catObj.name : form.category;
        const suggested = getSuggestedSizes(catName);
        setAvailableSizes(Array.from(new Set([...suggested, ...selSizesRef.current])));
    }, [form.category, categories]);

    const sections = PRODUCT_TYPE_CONFIG[productType].sections;

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3200);
    };

    const clrErr = name => {
        setFErrs(p => { const n = { ...p }; delete n[name]; return n; });
        setTopErr("");
    };

    const hc = useCallback(e => {
        const { name, value, type, checked } = e.target;
        setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value }));
        setDirty(true);
        clrErr(name);
    }, []);

    const discPct = form.mrp && form.price && +form.mrp > +form.price
        ? Math.round(((+form.mrp - +form.price) / +form.mrp) * 100) : null;

    const tabHasErr = id => {
        const owned = Object.entries(FIELD_TAB).filter(([, t]) => t === id).map(([f]) => f);
        return owned.some(f => fErrs[f]);
    };

    const tabIdx = sections.indexOf(tab);

    const toggleSize = s => setSelSizes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
    const updateSizeStock = (size, val) => {
        const n = Math.max(0, parseInt(val) || 0);
        setSizeStockMap(p => ({ ...p, [size]: n }));
    };

    useEffect(() => {
        if (selSizes.length > 0) {
            const totalStock = selSizes.reduce((s, sz) => s + (sizeStockMap[sz] || 0), 0);
            setForm(f => ({ ...f, stock: String(totalStock) }));
        }
    }, [selSizes, sizeStockMap]);

    const handleAddCustomSize = (e) => {
        if (e) e.preventDefault();
        const val = newSize.trim();
        if (!val) return;
        if (!availableSizes.includes(val)) setAvailableSizes(p => [...p, val]);
        if (!selSizes.includes(val)) setSelSizes(p => [...p, val]);
        setNewSize("");
    };

    const addHL = () => setHls(p => [...p, { key: "", value: "" }]);
    const removeHL = i => setHls(p => p.filter((_, j) => j !== i));
    const updateHL = (i, f, v) => setHls(p => p.map((h, j) => j === i ? { ...h, [f]: v } : h));

    const handleMainImgs = e => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const merged = [...mainImages, ...files];
        if (merged.length > 6) { setTopErr("Max 6 images allowed"); return; }
        for (const f of merged) {
            if (f.size > 5 * 1048576) { setTopErr(`"${f.name}" exceeds 5MB`); return; }
        }
        setMainImages(merged);
        setMainPreviews(merged.map(f => URL.createObjectURL(f)));
        setImageAlts(p => [...p, ...Array(merged.length - p.length).fill("")].slice(0, merged.length));
        setDirty(true);
        clrErr("images");
    };
    const removeMainImg = i => {
        setMainImages(p => p.filter((_, j) => j !== i));
        setMainPreviews(p => p.filter((_, j) => j !== i));
        setImageAlts(p => p.filter((_, j) => j !== i));
    };

    /* ── Image manager: reorder / make-primary / alt text / drag-drop ──
       Display order = upload order = storefront order, so reordering the
       arrays is all that's needed (first image = primary). */
    const swapArr = (arr, i, j) => { const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; return n; };
    const moveMainImg = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= mainImages.length) return;
        setMainImages(p => swapArr(p, i, j));
        setMainPreviews(p => swapArr(p, i, j));
        setImageAlts(p => swapArr([...p, ...Array(Math.max(0, mainImages.length - p.length)).fill("")], i, j));
    };
    const makePrimaryImg = (i) => {
        if (i === 0) return;
        const toFront = (arr) => [arr[i], ...arr.filter((_, j) => j !== i)];
        setMainImages(toFront);
        setMainPreviews(toFront);
        setImageAlts(p => toFront([...p, ...Array(Math.max(0, mainImages.length - p.length)).fill("")]));
    };
    const setImgAlt = (i, v) => setImageAlts(p => {
        const n = [...p, ...Array(Math.max(0, mainImages.length - p.length)).fill("")];
        n[i] = v; return n;
    });
    const handleImageDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith("image/"));
        if (!files.length) return;
        handleMainImgs({ target: { files } });
    };

    /* ── Wizard: per-step validation + navigation ── */
    const stepCtx = { form, enableVariants, colorVariants, mainImages };
    const validateStep = (stepId) => (STEP_VALIDATORS[stepId] ? STEP_VALIDATORS[stepId](stepCtx) : {});
    const goToStep = (target) => {
        // moving forward validates every step in between; backward is free
        const fromIdx = sections.indexOf(tab);
        const toIdx = sections.indexOf(target);
        if (toIdx > fromIdx) {
            for (let i = fromIdx; i < toIdx; i++) {
                const fe = validateStep(sections[i]);
                if (Object.keys(fe).length) {
                    setFErrs(fe);
                    setTab(sections[i]);
                    setTopErr("Complete this step before continuing");
                    return;
                }
            }
        }
        setFErrs({}); setTopErr("");
        setTab(target);
    };

    /* ── Draft autosave (serializable state only — files can't persist) ── */
    const draftPayload = JSON.stringify({
        form, hls, attributes, selSizes, sizeStockMap, productType, enableVariants,
        colorVariantsMeta: colorVariants.map(({ id, name, hex, stock, price, mrp, isDefault }) =>
            ({ id, name, hex, stock, price, mrp, isDefault })),
    });
    const draftRef = useRef(draftPayload);
    useEffect(() => { draftRef.current = draftPayload; }, [draftPayload]);
    useEffect(() => {
        if (!dirty) return;
        const t = setTimeout(() => {
            try { localStorage.setItem(DRAFT_KEY, draftRef.current); } catch { /* storage full */ }
        }, 800);
        return () => clearTimeout(t);
    }, [draftPayload, dirty]);

    const resumeDraft = () => {
        try {
            const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
            if (d.form) setForm(f => ({ ...f, ...d.form }));
            if (Array.isArray(d.hls) && d.hls.length) setHls(d.hls);
            if (d.attributes) setAttributes(d.attributes);
            if (Array.isArray(d.selSizes)) setSelSizes(d.selSizes);
            if (d.sizeStockMap) setSizeStockMap(d.sizeStockMap);
            if (d.productType) setProductType(d.productType);
            if (d.enableVariants !== undefined) setEnableVariants(d.enableVariants);
            if (Array.isArray(d.colorVariantsMeta) && d.colorVariantsMeta.length) {
                setColorVariants(d.colorVariantsMeta.map(v => ({ ...v, images: [], previews: [] })));
            }
            setDirty(true);
        } catch { /* corrupt draft */ }
        setDraftAvailable(false);
    };
    const discardDraft = () => {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setDraftAvailable(false);
    };

    /* ── Unsaved-changes guard (browser close / refresh) ── */
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

    const addVariant = () => setColorVariants(p => [
        ...p,
        { ...DEFAULT_COLOR_VARIANT(), isDefault: p.length === 0 },
    ]);

    const updateVariant = (id, key, val) =>
        setColorVariants(p => p.map(v => v.id === id ? { ...v, [key]: val } : v));

    const setDefaultVariant = id =>
        setColorVariants(p => p.map(v => ({ ...v, isDefault: v.id === id })));

    const removeVariant = id =>
        setColorVariants(p => {
            const rem = p.filter(v => v.id !== id);
            if (rem.length > 0 && !rem.some(v => v.isDefault)) rem[0].isDefault = true;
            return rem;
        });

    const handleVariantImages = (id, e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setColorVariants(p => p.map(v => {
            if (v.id === id) {
                return {
                    ...v,
                    images: [...v.images, ...files],
                    previews: [...v.previews, ...files.map(f => URL.createObjectURL(f))]
                };
            }
            return v;
        }));
    };

    /* ── SUBMIT ── */
    const handleSubmit = async e => {
        e.preventDefault();
        setFErrs({}); setTopErr("");

        const fe = {};
        if (!form.name.trim()) fe.name = "Required";
        if (!form.price || +form.price <= 0) fe.price = "Enter valid price";
        if (!form.category) fe.category = "Required";
        if (form.mrp && +form.mrp < +form.price) fe.mrp = "MRP must be ≥ price";
        if (form.stock === "" || +form.stock < 0) fe.stock = "Required (0 or more)";
        if (mainImages.length === 0 && colorVariants.every(v => v.images.length === 0))
            fe.images = "At least 1 image required";
        if (productType === "urbexon_hour" && !form.vendorId?.trim())
            fe.vendorId = "Vendor ID required for UH";

        // Validate variants
        if (enableVariants && colorVariants.length > 0) {
            const badVariant = colorVariants.find(v => !v.name.trim());
            if (badVariant) fe.colorVariants = "All color variants must have a name";
        }

        if (Object.keys(fe).length) {
            setFErrs(fe);
            const firstBad = FIELD_TAB[Object.keys(fe)[0]];
            if (firstBad && sections.includes(firstBad)) setTab(firstBad);
            setTopErr(`Fix ${Object.keys(fe).length} field(s) before publishing`);
            return;
        }

        try {
            setLoading(true);
            const fd = new FormData();

            fd.append("name", form.name.trim());
            fd.append("category", form.category);
            fd.append("price", String(+form.price));
            fd.append("productType", productType);

            [["description", form.description], ["mrp", form.mrp], ["brand", form.brand],
            ["sku", form.sku], ["weight", form.weight], ["origin", form.origin],
            ["returnPolicy", form.returnPolicy], ["shippingInfo", form.shippingInfo],
            ["material", form.material], ["color", form.color], ["occasion", form.occasion],
            ["subcategory", form.subcategory], ["metaTitle", form.metaTitle],
            ["metaDesc", form.metaDesc], ["nonReturnableReason", form.nonReturnableReason],
            ].forEach(([k, v]) => { const s = v?.toString().trim(); if (s) fd.append(k, s); });

            fd.append("gstPercent", String(+form.gstPercent || 0));
            fd.append("isFeatured", form.isFeatured ? "true" : "false");
            fd.append("isDeal", form.isDeal ? "true" : "false");
            fd.append("isCustomizable", form.isCustomizable ? "true" : "false");
            fd.append("isCancellable", form.isCancellable ? "true" : "false");
            fd.append("isReturnable", form.isReturnable ? "true" : "false");
            fd.append("isReplaceable", form.isReplaceable ? "true" : "false");
            fd.append("returnWindow", String(+form.returnWindow || 7));
            fd.append("replacementWindow", String(+form.replacementWindow || 7));
            fd.append("cancelWindow", String(+form.cancelWindow || 0));
            fd.append("returnConditions", JSON.stringify(form.returnConditions));
            fd.append("packagingRequired", form.packagingRequired ? "true" : "false");
            fd.append("tagsRequired", form.tagsRequired ? "true" : "false");
            fd.append("returnMethod", form.returnMethod);

            if (form.isDeal && form.dealEndsAt?.trim()) {
                const d = new Date(form.dealEndsAt);
                if (!isNaN(d.getTime())) fd.append("dealEndsAt", d.toISOString());
            }

            const tagsArr = form.tags.split(",").map(t => t.trim()).filter(Boolean);
            if (tagsArr.length) fd.append("tags", JSON.stringify(tagsArr));

            if (form.isCustomizable) fd.append("customizationConfig", JSON.stringify(custConfig));

            fd.append("sizes", JSON.stringify(selSizes.map(s => ({ size: s, stock: sizeStockMap[s] || 0 }))));

            const validHls = hls.filter(h => h.key.trim() && h.value.trim());
            if (validHls.length) {
                const obj = {};
                validHls.forEach(h => { obj[h.key.trim()] = h.value.trim(); });
                fd.append("highlights", JSON.stringify(obj));
                fd.append("highlightsArray", JSON.stringify(validHls.map(h => ({ title: h.key.trim(), value: h.value.trim() }))));
            }
            // BUG FIX: attributes were only sent when highlights were filled
            // (append lived inside the validHls if-block) — send them always.
            fd.append("attributes", JSON.stringify(attributes));

            // SEO / shipping / inventory extras
            fd.append("hsn", form.hsn || "");
            fd.append("barcode", form.barcode || "");
            fd.append("lowStockThreshold", String(+form.lowStockThreshold || 5));
            fd.append("shipping", JSON.stringify({
                lengthCm: +form.shipLength || 0,
                widthCm: +form.shipWidth || 0,
                heightCm: +form.shipHeight || 0,
            }));
            fd.append("imageAlts", JSON.stringify(imageAlts.slice(0, mainImages.length)));

            // Main images
            mainImages.forEach(img => fd.append("images", img));
            fd.append("mainImageCount", mainImages.length);

            // Color variants — v2.1: include price + mrp per variant
            if (enableVariants && colorVariants.length > 0) {
                const varMeta = colorVariants.map(v => ({
                    name: v.name,
                    hex: v.hex,
                    stock: +v.stock || 0,
                    price: v.price !== "" ? +v.price : null,   // null = inherit base
                    mrp: v.mrp !== "" ? +v.mrp : null,         // null = inherit base
                    isDefault: v.isDefault,
                    imageCount: v.images.length,
                }));
                fd.append("colorVariants", JSON.stringify(varMeta));
                colorVariants.forEach(v => {
                    v.images.forEach(img => fd.append("images", img));
                });

                // Stock is derived from variants — send 0 (backend auto-calculates)
                fd.append("stock", "0");
            } else {
                fd.append("stock", String(+form.stock));
            }

            if (productType === "urbexon_hour") {
                fd.append("prepTimeMinutes", String(+form.prepTimeMinutes || 10));
                fd.append("maxOrderQty", String(+form.maxOrderQty || 10));
                if (form.vendorId?.trim()) fd.append("vendorId", form.vendorId.trim());
            }

            setUploadPct(1);
            await api.post("/products/admin", fd, {
                onUploadProgress: (ev) => {
                    if (ev.total) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
                },
            });
            setUploadPct(0);
            setDirty(false);
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
            showToast("ok", "Product published successfully!");
            setTimeout(() => navigate("/admin/products"), 1500);

        } catch (err) {
            const data = err.response?.data || {};
            const apiErrs = data.errors;
            if (Array.isArray(apiErrs) && apiErrs.length) {
                const mapped = {};
                apiErrs.forEach(({ field, message }) => { if (field) mapped[field] = message; });
                if (Object.keys(mapped).length) {
                    setFErrs(mapped);
                    const fb = FIELD_TAB[Object.keys(mapped)[0]];
                    if (fb && sections.includes(fb)) setTab(fb);
                    setTopErr(`Server rejected: ${Object.keys(mapped).join(", ")}`);
                } else {
                    setTopErr(apiErrs.map(e => e.message).join(" | "));
                }
            } else {
                setTopErr(data.message || "Failed to publish. Please retry.");
            }
        } finally {
            setLoading(false);
            setUploadPct(0);
        }
    };

    const tc = PRODUCT_TYPE_CONFIG[productType];

    return (
        <div className="pf-root" style={{ padding: "24px 14px 80px" }}>
            <style>{GLOBAL_CSS}</style>

            {toast && (
                <div className={`pf-toast ${toast.type}`}>
                    {toast.type === "ok" ? "✓" : "✕"} {toast.msg}
                </div>
            )}

            <div style={{ maxWidth: 880, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                    <Button
                        type="button" variant="secondary"
                        onClick={() => navigate("/admin/products")}
                        style={{ width: 38, height: 38, padding: 0, borderRadius: 10, flexShrink: 0 }}
                    >←</Button>
                    <div>
                        <p className="pf-page-sub">Products</p>
                        <h1 className="pf-page-title">Add New Product</h1>
                    </div>
                </div>

                {/* Product Type Selector */}
                <Card style={{ marginBottom: 14, borderTop: `3px solid ${tc.color}` }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--adm-muted)", marginBottom: 10 }}>
                        Product Type
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                        {Object.entries(PRODUCT_TYPE_CONFIG).map(([key, cfg]) => (
                            <button
                                key={key} type="button"
                                className={`pf-type-opt${productType === key ? " on" : ""}`}
                                style={{ "--t-color": cfg.color, "--t-bg": cfg.bg }}
                                onClick={() => { setProductType(key); setTab("basic"); }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                                    <span style={{ fontSize: 20 }}>{cfg.icon}</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: productType === key ? cfg.color : "var(--adm-text-primary)" }}>
                                        {cfg.label}
                                    </span>
                                    {productType === key && (
                                        <span style={{ marginLeft: "auto" }}>
                                            <Badge tone={key === "ecommerce" ? "primary" : "warning"}>ACTIVE</Badge>
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: 11, color: "var(--adm-text-secondary)" }}>{cfg.hint}</p>
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Draft resume banner */}
                {draftAvailable && (
                    <Card style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, borderLeft: "3px solid var(--adm-primary)" }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>Unfinished draft found</p>
                            <p style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 2 }}>
                                Resume where you left off (images need re-uploading — browsers can't persist files).
                            </p>
                        </div>
                        <Button type="button" variant="secondary" onClick={discardDraft}>Discard</Button>
                        <Button type="button" variant="primary" onClick={resumeDraft}>Resume Draft</Button>
                    </Card>
                )}

                {/* Wizard stepper — numbered steps; forward moves validate */}
                <div className="pf-tabbar" style={{ marginBottom: 12 }}>
                    {sections.map((sid, idx) => {
                        const meta = SECTION_META[sid];
                        const stepDone = idx < tabIdx && Object.keys(validateStep(sid)).length === 0;
                        return (
                            <button
                                key={sid} type="button"
                                className={`pf-tab${tab === sid ? " on" : ""}`}
                                onClick={() => goToStep(sid)}
                            >
                                <span className="pf-tab-icon" style={stepDone ? { color: "var(--adm-success)" } : undefined}>
                                    {stepDone ? "✓" : `${idx + 1}.`}
                                </span>
                                <span className="pf-tab-label">{meta.label}</span>
                                {tabHasErr(sid) && <span className="pf-tab-dot" />}
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit}>
                    <Card padded={false} style={{ borderTop: `3px solid ${tc.color}` }}>
                        <div style={{ padding: "22px 24px 6px" }}>

                            {/* ══ BASIC INFO ══ */}
                            {tab === "basic" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SectionLabel>Basic Information</SectionLabel>

                                    <FormField label={LBL("Product Name", { required: true })} error={fErrs.name}>
                                        <Input name="name" value={form.name} onChange={hc}
                                            placeholder="e.g. Premium Cotton Kurta" error={fErrs.name} />
                                    </FormField>

                                    <FormField label={LBL("Description", { hint: "optional" })}>
                                        <textarea name="description" value={form.description} onChange={hc}
                                            placeholder="Describe fabric, fit, occasion, care instructions…"
                                            rows={3} className="adm-field-input" style={{ resize: "vertical", lineHeight: 1.65, width: "100%" }} />
                                    </FormField>

                                    <div className="g2">
                                        <FormField label="Brand">
                                            <Input name="brand" value={form.brand} onChange={hc} placeholder="e.g. Urbexon" />
                                        </FormField>
                                        <FormField label={LBL("SKU / Code", { hint: "optional" })}>
                                            <Input name="sku" value={form.sku} onChange={hc} placeholder="e.g. UX-KRT-001" />
                                        </FormField>
                                    </div>

                                    <div className="g3">
                                        <FormField label={LBL("Color", { hint: "primary" })}>
                                            <Input name="color" value={form.color} onChange={hc} placeholder="Navy Blue" />
                                        </FormField>
                                        <FormField label="Material">
                                            <Input name="material" value={form.material} onChange={hc} placeholder="Cotton" />
                                        </FormField>
                                        <FormField label="Occasion">
                                            <Input name="occasion" value={form.occasion} onChange={hc} placeholder="Casual" />
                                        </FormField>
                                    </div>

                                    <div className="g2">
                                        <FormField label={LBL("Category", { required: true })} error={fErrs.category}>
                                            <Select name="category" value={form.category} onChange={hc} error={fErrs.category}>
                                                <option value="">— Select Category —</option>
                                                {categories.map(c => (
                                                    <option key={c._id || c.value} value={c.value || c.slug || c.name}>
                                                        {c.icon ? `${c.icon} ` : ""}{c.name}
                                                    </option>
                                                ))}
                                            </Select>
                                        </FormField>
                                        <FormField label={LBL("Subcategory", { hint: "optional" })}>
                                            <Input name="subcategory" value={form.subcategory} onChange={hc}
                                                placeholder="e.g. Kurta Set, Running Shoes" />
                                        </FormField>
                                    </div>

                                    <FormField label={LBL("Tags", { hint: "comma-separated" })}>
                                        <Input name="tags" value={form.tags} onChange={hc}
                                            placeholder="kurta, ethnic, festive, cotton" />
                                    </FormField>

                                    <div className="g2">
                                        <Toggle on={form.isFeatured}
                                            toggle={() => setForm(p => ({ ...p, isFeatured: !p.isFeatured }))}
                                            label="⭐ Featured Product" sub="Shown prominently on homepage"
                                            color="var(--adm-warning)" bg="var(--adm-warning-tint)" />
                                        <Toggle on={form.isCustomizable}
                                            toggle={() => setForm(p => ({ ...p, isCustomizable: !p.isCustomizable }))}
                                            label="🎨 Customizable" sub="Customer can add design/text" />
                                    </div>

                                    {form.isCustomizable && (
                                        <div style={{ background: "var(--adm-bg)", border: "1.5px solid var(--adm-border)", borderRadius: 13, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-primary)" }}>🎨 Customization Options</p>
                                            <Toggle on={custConfig.allowText}
                                                toggle={() => setCustConfig(p => ({ ...p, allowText: !p.allowText }))}
                                                label="Allow Custom Text" sub="Name / message input" />
                                            {custConfig.allowText && (
                                                <div className="g2" style={{ paddingLeft: 10 }}>
                                                    <FormField label="Text Label">
                                                        <Input value={custConfig.textLabel}
                                                            onChange={e => setCustConfig(p => ({ ...p, textLabel: e.target.value }))}
                                                            placeholder="Name / Message" />
                                                    </FormField>
                                                    <FormField label="Max Length">
                                                        <Input type="number" min="1" max="500" value={custConfig.textMaxLength}
                                                            onChange={e => setCustConfig(p => ({ ...p, textMaxLength: +e.target.value || 100 }))} />
                                                    </FormField>
                                                </div>
                                            )}
                                            <Toggle on={custConfig.allowImage}
                                                toggle={() => setCustConfig(p => ({ ...p, allowImage: !p.allowImage }))}
                                                label="Allow Image Upload" sub="Customer uploads design/photo" />
                                            <Toggle on={custConfig.allowNote}
                                                toggle={() => setCustConfig(p => ({ ...p, allowNote: !p.allowNote }))}
                                                label="Allow Special Notes" sub="Free-text instructions" />
                                            <FormField label={LBL("Extra Charge (₹)", { hint: "0 = free" })}>
                                                <Input type="number" min="0" value={custConfig.extraPrice}
                                                    onChange={e => setCustConfig(p => ({ ...p, extraPrice: +e.target.value || 0 }))}
                                                    placeholder="0" style={{ maxWidth: 180 }} />
                                            </FormField>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ══ PRICING ══ */}
                            {tab === "pricing" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SectionLabel>Pricing & Stock</SectionLabel>

                                    <div style={{ padding: "10px 14px", background: "var(--adm-primary-tint)", border: "1px solid var(--adm-primary)", borderRadius: 10 }}>
                                        <p style={{ fontSize: 11, color: "var(--adm-primary)", fontWeight: 600 }}>
                                            💡 This is the <strong>base price</strong>. If color variants have different prices, set them in the Variants tab.
                                        </p>
                                    </div>

                                    <div className="g2">
                                        <FormField label={LBL("Selling Price (₹)", { required: true })} error={fErrs.price}>
                                            <div style={{ position: "relative" }}>
                                                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--adm-muted)", fontSize: 13, pointerEvents: "none" }}>₹</span>
                                                <Input type="number" name="price" value={form.price} onChange={hc}
                                                    placeholder="0" min="1" error={fErrs.price} style={{ paddingLeft: 28 }} />
                                            </div>
                                        </FormField>
                                        <FormField label={LBL("MRP (₹)", { hint: "compare-at price" })} error={fErrs.mrp}>
                                            <div style={{ position: "relative" }}>
                                                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--adm-muted)", fontSize: 13, pointerEvents: "none" }}>₹</span>
                                                <Input type="number" name="mrp" value={form.mrp} onChange={hc}
                                                    placeholder="0" min="1" error={fErrs.mrp} style={{ paddingLeft: 28 }} />
                                            </div>
                                        </FormField>
                                    </div>

                                    {discPct && (
                                        <div className="pf-discount-row">
                                            <span style={{ color: "var(--adm-success)", fontWeight: 800, fontSize: 22 }}>{discPct}%</span>
                                            <div>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-success)" }}>Discount Applied</p>
                                                <p style={{ fontSize: 11, color: "var(--adm-text-secondary)" }}>Customer saves ₹{(+form.mrp - +form.price).toLocaleString("en-IN")}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="g2">
                                        <FormField
                                            label={LBL("Stock Quantity", { required: true, hint: enableVariants ? "auto from variants" : selSizes.length ? "auto from sizes" : undefined })}
                                            error={fErrs.stock}
                                        >
                                            <div style={{ position: "relative" }}>
                                                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--adm-muted)", fontSize: 12, pointerEvents: "none" }}>📦</span>
                                                <Input type="number" name="stock" value={form.stock} onChange={hc}
                                                    readOnly={selSizes.length > 0 || enableVariants}
                                                    placeholder="0" min="0" error={fErrs.stock}
                                                    style={{ paddingLeft: 30, background: (selSizes.length > 0 || enableVariants) ? "var(--adm-surface-alt)" : undefined }} />
                                            </div>
                                            {form.stock !== "" && !fErrs.stock && (
                                                <div style={{ marginTop: 4 }}>
                                                    <Badge tone={+form.stock > 0 ? "success" : "danger"}>
                                                        {+form.stock > 0 ? `In Stock — ${form.stock} units` : "Out of Stock"}
                                                    </Badge>
                                                </div>
                                            )}
                                        </FormField>
                                        <FormField label="GST Rate">
                                            <Select name="gstPercent" value={form.gstPercent} onChange={hc}>
                                                {GST_RATES.map(r => <option key={r} value={r}>{r}% GST</option>)}
                                            </Select>
                                        </FormField>
                                    </div>

                                    {/* Inventory extras */}
                                    <div className="g3">
                                        <FormField label={LBL("HSN Code", { hint: "GST classification" })}>
                                            <Input name="hsn" value={form.hsn} onChange={hc} maxLength={20} placeholder="e.g. 6109" />
                                        </FormField>
                                        <FormField label="Barcode (EAN/UPC)">
                                            <Input name="barcode" value={form.barcode} onChange={hc} maxLength={50} placeholder="e.g. 8901234567890" />
                                        </FormField>
                                        <FormField label={LBL("Low Stock Alert", { hint: "units" })}>
                                            <Input name="lowStockThreshold" value={form.lowStockThreshold} onChange={hc} type="number" min="0" placeholder="5" />
                                        </FormField>
                                    </div>

                                    <Toggle on={form.isDeal}
                                        toggle={() => setForm(p => ({ ...p, isDeal: !p.isDeal, dealEndsAt: "" }))}
                                        label="⚡ Mark as Deal" sub="Appears in Deals / Flash Deals section"
                                        color="var(--adm-warning)" bg="var(--adm-warning-tint)" />

                                    {form.isDeal && (
                                        <FormField label={LBL("Deal Ends At", { hint: "leave blank for no expiry" })}>
                                            <Input type="datetime-local" name="dealEndsAt" value={form.dealEndsAt} onChange={hc} />
                                        </FormField>
                                    )}
                                </div>
                            )}

                            {/* ══ VARIANTS ══ */}
                            {tab === "variants" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <SectionLabel>Color Variants & Sizes</SectionLabel>

                                    {/* Sizes */}
                                    <div>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-secondary)", marginBottom: 10 }}>AVAILABLE SIZES</p>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                                            {availableSizes.map(s => (
                                                <button key={s} type="button" onClick={() => toggleSize(s)}
                                                    className={`pf-chip${selSizes.includes(s) ? " on" : ""}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                            <Input
                                                value={newSize}
                                                onChange={e => setNewSize(e.target.value)}
                                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomSize(); } }}
                                                placeholder="Add custom size"
                                                style={{ maxWidth: 200, padding: "8px 12px" }}
                                            />
                                            <Button type="button" variant="secondary" size="sm" onClick={handleAddCustomSize} style={{ flexShrink: 0 }}>
                                                Add Size
                                            </Button>
                                        </div>
                                        {selSizes.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                {selSizes.map(s => (
                                                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--adm-bg)", border: "1.5px solid var(--adm-border)", borderRadius: 9, padding: "6px 10px" }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-secondary)", minWidth: 36 }}>{s}</span>
                                                        <input type="number" min="0" value={sizeStockMap[s] ?? 0}
                                                            onChange={e => updateSizeStock(s, e.target.value)}
                                                            style={{ width: 60, padding: "5px 8px", border: "1.5px solid var(--adm-border)", borderRadius: 7, fontSize: 12, textAlign: "center", outline: "none", fontFamily: "inherit", background: "var(--adm-surface)", color: "var(--adm-text-primary)" }} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Color Variants toggle */}
                                    <Toggle on={enableVariants}
                                        toggle={() => {
                                            setEnableVariants(p => !p);
                                            if (!enableVariants && colorVariants.length === 0) addVariant();
                                        }}
                                        label="🎨 Multiple Color Variants"
                                        sub="Add different colors with separate price, stock and images"
                                    />

                                    {fErrs.colorVariants && (
                                        <p style={{ fontSize: 11, color: "var(--adm-danger)", fontWeight: 600 }}>⚠ {fErrs.colorVariants}</p>
                                    )}

                                    {enableVariants && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <div style={{ padding: "10px 14px", background: "var(--adm-warning-tint)", border: "1px solid var(--adm-warning)", borderRadius: 10 }}>
                                                <p style={{ fontSize: 11, color: "var(--adm-warning)", fontWeight: 600 }}>
                                                    💡 Leave Price/MRP blank to inherit base product price. Only fill if this color has a different price.
                                                </p>
                                            </div>

                                            {colorVariants.map((v, vi) => (
                                                <div key={v.id}
                                                    className={`pf-variant-card${v.isDefault ? " default" : ""}`}
                                                >
                                                    {/* Row 1: Color swatch + Name + Default/Remove */}
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                                        <div style={{ position: "relative" }}>
                                                            <input
                                                                type="color" value={v.hex}
                                                                onChange={e => updateVariant(v.id, "hex", e.target.value)}
                                                                style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer", border: "none" }}
                                                            />
                                                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: v.hex, border: "3px solid var(--adm-surface)", boxShadow: "0 0 0 2px var(--adm-border)", cursor: "pointer" }} />
                                                        </div>
                                                        <Input
                                                            value={v.name}
                                                            onChange={e => updateVariant(v.id, "name", e.target.value)}
                                                            placeholder="Color name (e.g. Navy Blue)"
                                                            style={{ flex: 1 }}
                                                        />
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                                                            <Button type="button" size="sm" variant={v.isDefault ? "primary" : "secondary"}
                                                                onClick={() => setDefaultVariant(v.id)}>
                                                                {v.isDefault ? "✓ Default" : "Set Default"}
                                                            </Button>
                                                            {colorVariants.length > 1 && (
                                                                <Button type="button" size="sm" variant="danger" onClick={() => removeVariant(v.id)}>
                                                                    Remove
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Price + MRP + Stock (v2.1) */}
                                                    <div className="g3" style={{ marginBottom: 14 }}>
                                                        <FormField label={LBL("Price (₹)", { hint: "blank = base price" })}>
                                                            <div style={{ position: "relative" }}>
                                                                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--adm-muted)", fontSize: 12, pointerEvents: "none" }}>₹</span>
                                                                <Input type="number" min="0"
                                                                    value={v.price}
                                                                    onChange={e => updateVariant(v.id, "price", e.target.value)}
                                                                    placeholder={form.price || "Base"}
                                                                    style={{ paddingLeft: 24, fontSize: 13 }}
                                                                />
                                                            </div>
                                                        </FormField>
                                                        <FormField label={LBL("MRP (₹)", { hint: "blank = base MRP" })}>
                                                            <div style={{ position: "relative" }}>
                                                                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--adm-muted)", fontSize: 12, pointerEvents: "none" }}>₹</span>
                                                                <Input type="number" min="0"
                                                                    value={v.mrp}
                                                                    onChange={e => updateVariant(v.id, "mrp", e.target.value)}
                                                                    placeholder={form.mrp || "Base"}
                                                                    style={{ paddingLeft: 24, fontSize: 13 }}
                                                                />
                                                            </div>
                                                        </FormField>
                                                        <FormField label="Stock">
                                                            <Input
                                                                type="number" min="0"
                                                                value={v.stock}
                                                                onChange={e => updateVariant(v.id, "stock", e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </FormField>
                                                    </div>

                                                    {/* Row 3: Variant images */}
                                                    <div>
                                                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--adm-neutral)", marginBottom: 8 }}>Images for this color:</p>
                                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                                                            {v.previews.map((src, pi) => (
                                                                <div key={pi} className="pf-slot">
                                                                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                                    {pi === 0 && (
                                                                        <span style={{ position: "absolute", bottom: 6, left: 6 }}>
                                                                            <Badge tone="primary">MAIN</Badge>
                                                                        </span>
                                                                    )}
                                                                    <button type="button" className="pf-img-del"
                                                                        onClick={() => {
                                                                            const imgs = v.images.filter((_, j) => j !== pi);
                                                                            const prvs = v.previews.filter((_, j) => j !== pi);
                                                                            updateVariant(v.id, "images", imgs);
                                                                            updateVariant(v.id, "previews", prvs);
                                                                        }}>✕</button>
                                                                </div>
                                                            ))}
                                                            {v.previews.length < 4 && (
                                                                <label className="pf-drop">
                                                                    <span className="pf-drop-icon">📷</span>
                                                                    <span className="pf-drop-text">Add</span>
                                                                    <input type="file" multiple accept="image/*"
                                                                        onChange={e => handleVariantImages(v.id, e)}
                                                                        style={{ display: "none" }} />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            <Button type="button" variant="ghost" onClick={addVariant}
                                                style={{ border: "2px dashed var(--adm-primary)", borderRadius: 12, color: "var(--adm-primary)", justifyContent: "center", padding: "10px 16px" }}>
                                                + Add Color Variant
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ══ DETAILS ══ */}
                            {tab === "details" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <SectionLabel>Product Details & Specifications</SectionLabel>
                                    <FormField label={LBL("Product Highlights", { hint: "key specs shown on product page" })}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {hls.map((h, i) => (
                                                <div key={i} className="pf-hl-row">
                                                    <Select value={h.key} onChange={e => updateHL(i, "key", e.target.value)}
                                                        style={{ flex: "0 0 150px" }}>
                                                        <option value="">Select key</option>
                                                        {(hlTemplate.length ? hlTemplate.map(t => t.title) : HIGHLIGHT_KEYS)
                                                            .map(k => <option key={k} value={k}>{k}</option>)}
                                                    </Select>
                                                    <Input value={h.value} onChange={e => updateHL(i, "value", e.target.value)}
                                                        placeholder="Value…" style={{ flex: 1 }} />
                                                    {hls.length > 1 && (
                                                        <button type="button" onClick={() => removeHL(i)} className="pf-hl-rm">✕</button>
                                                    )}
                                                </div>
                                            ))}
                                            <Button type="button" variant="ghost" size="sm" onClick={addHL} style={{ alignSelf: "flex-start" }}>
                                                + Add Highlight
                                            </Button>
                                        </div>
                                    </FormField>
                                    <div className="g2">
                                        <FormField label={LBL("Weight", { hint: "for shipping calc" })}>
                                            <Input name="weight" value={form.weight} onChange={hc} placeholder="e.g. 250g" />
                                        </FormField>
                                        <FormField label="Country of Origin">
                                            <Input name="origin" value={form.origin} onChange={hc} placeholder="e.g. India" />
                                        </FormField>
                                    </div>

                                    {/* Metadata-driven attributes for the selected category */}
                                    <DynamicAttributeFields schema={attrSchema} value={attributes} onChange={setAttributes} />
                                </div>
                            )}

                            {/* ══ IMAGES ══ */}
                            {tab === "images" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SectionLabel>Product Images</SectionLabel>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", marginBottom: 3 }}>Main Product Images</p>
                                            <p style={{ fontSize: 11, color: "var(--adm-muted)" }}>First image = main thumbnail · Max 6 · 5MB each</p>
                                        </div>
                                        <Badge tone={mainPreviews.length === 0 ? "danger" : "primary"}>{mainPreviews.length}/6</Badge>
                                    </div>
                                    {fErrs.images && <p style={{ fontSize: 11, color: "var(--adm-danger)", fontWeight: 600 }}>⚠ {fErrs.images}</p>}
                                    <div className="pf-imgrid"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleImageDrop}>
                                        {mainPreviews.map((src, i) => (
                                            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                <div className="pf-slot">
                                                    <img src={src} alt={imageAlts[i] || ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                                                    {i === 0 && (
                                                        <span style={{ position: "absolute", bottom: 6, left: 6 }}>
                                                            <Badge tone="primary">PRIMARY</Badge>
                                                        </span>
                                                    )}
                                                    <button type="button" className="pf-img-del" onClick={() => removeMainImg(i)}>✕</button>
                                                </div>
                                                {/* Reorder / make-primary controls */}
                                                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                                    <button type="button" title="Move left" disabled={i === 0}
                                                        onClick={() => moveMainImg(i, -1)}
                                                        style={{ border: "1px solid var(--adm-border)", background: "var(--adm-surface)", borderRadius: 6, width: 24, height: 22, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.35 : 1, fontSize: 11 }}>◀</button>
                                                    {i !== 0 && (
                                                        <button type="button" title="Make primary"
                                                            onClick={() => makePrimaryImg(i)}
                                                            style={{ border: "1px solid var(--adm-primary)", color: "var(--adm-primary)", background: "var(--adm-primary-tint)", borderRadius: 6, height: 22, padding: "0 6px", cursor: "pointer", fontSize: 9, fontWeight: 800 }}>★</button>
                                                    )}
                                                    <button type="button" title="Move right" disabled={i === mainPreviews.length - 1}
                                                        onClick={() => moveMainImg(i, 1)}
                                                        style={{ border: "1px solid var(--adm-border)", background: "var(--adm-surface)", borderRadius: 6, width: 24, height: 22, cursor: i === mainPreviews.length - 1 ? "default" : "pointer", opacity: i === mainPreviews.length - 1 ? 0.35 : 1, fontSize: 11 }}>▶</button>
                                                </div>
                                                <input
                                                    value={imageAlts[i] || ""}
                                                    onChange={(e) => setImgAlt(i, e.target.value)}
                                                    placeholder="Alt text (SEO)"
                                                    maxLength={150}
                                                    style={{ width: "100%", fontSize: 10.5, padding: "5px 7px", border: "1px solid var(--adm-border)", borderRadius: 6, background: "var(--adm-surface)", color: "var(--adm-text-primary)", boxSizing: "border-box" }}
                                                />
                                            </div>
                                        ))}
                                        {mainPreviews.length < 6 && (
                                            <label className="pf-drop">
                                                <span className="pf-drop-icon">🖼️</span>
                                                <span className="pf-drop-text">Click or drag & drop</span>
                                                <span className="pf-drop-sub">PNG · JPG · WEBP</span>
                                                <input type="file" multiple accept="image/*" onChange={handleMainImgs} style={{ display: "none" }} />
                                            </label>
                                        )}
                                    </div>
                                    {enableVariants && colorVariants.length > 0 && (
                                        <div style={{ marginTop: 8, padding: 14, background: "var(--adm-warning-tint)", border: "1px solid var(--adm-warning)", borderRadius: 12 }}>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-warning)" }}>💡 Color Variants Active</p>
                                            <p style={{ fontSize: 11, color: "var(--adm-text-secondary)", marginTop: 4 }}>
                                                Upload variant-specific images in the Variants tab. These main images are used as fallback.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ══ POLICY ══ */}
                            {tab === "policy" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SectionLabel>Cancellation, Return & Replacement Policy</SectionLabel>
                                    <div className="g3">
                                        {[["isCancellable", "Cancellable"], ["isReturnable", "Returnable"], ["isReplaceable", "Replaceable"]].map(([field, label]) => (
                                            <label key={field} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700, background: form[field] ? "var(--adm-success-tint)" : "var(--adm-danger-tint)", border: `1.5px solid ${form[field] ? "var(--adm-success)" : "var(--adm-danger)"}`, transition: "all .15s" }}>
                                                <input type="checkbox" name={field} checked={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.checked }))} />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                    <div className="g3">
                                        <FormField label={`Cancel Window (hours, ${policyLimits.minCancelWindowHours}-${policyLimits.maxCancelWindowHours})`}>
                                            <Input name="cancelWindow" value={form.cancelWindow} onChange={hc} type="number" min={policyLimits.minCancelWindowHours} max={policyLimits.maxCancelWindowHours} placeholder="0" />
                                        </FormField>
                                        <FormField label={`Return Window (days, ${policyLimits.minReturnWindowDays}-${policyLimits.maxReturnWindowDays})`}>
                                            <Input name="returnWindow" value={form.returnWindow} onChange={hc} type="number" min={policyLimits.minReturnWindowDays} max={policyLimits.maxReturnWindowDays} placeholder="7" />
                                        </FormField>
                                        <FormField label={`Replacement Window (days, ${policyLimits.minReplacementWindowDays}-${policyLimits.maxReplacementWindowDays})`}>
                                            <Input name="replacementWindow" value={form.replacementWindow} onChange={hc} type="number" min={policyLimits.minReplacementWindowDays} max={policyLimits.maxReplacementWindowDays} placeholder="7" />
                                        </FormField>
                                    </div>
                                    {!form.isReturnable && (
                                        <FormField label="Non-Returnable Reason">
                                            <Input name="nonReturnableReason" value={form.nonReturnableReason} onChange={hc} placeholder="e.g. Hygiene product" />
                                        </FormField>
                                    )}
                                    {form.isReturnable && (
                                        <>
                                            <FormField label="Return Conditions (select all that apply)">
                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    {[["damaged", "Damaged"], ["wrong_product", "Wrong Product"], ["defective", "Defective"], ["missing_items", "Missing Items"], ["other", "Other"]]
                                                        .filter(([k]) => policyLimits.allowedReturnConditions.includes(k))
                                                        .map(([k, label]) => {
                                                            const active = form.returnConditions.includes(k);
                                                            return (
                                                                <button key={k} type="button"
                                                                    onClick={() => setForm(p => ({ ...p, returnConditions: p.returnConditions.includes(k) ? p.returnConditions.filter(c => c !== k) : [...p.returnConditions, k] }))}
                                                                    style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${active ? "var(--adm-primary)" : "var(--adm-border)"}`, background: active ? "var(--adm-primary-tint)" : "var(--adm-surface)", color: active ? "var(--adm-primary)" : "var(--adm-text-secondary)" }}>
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                </div>
                                            </FormField>
                                            <div className="g3">
                                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                                    <input type="checkbox" name="packagingRequired" checked={form.packagingRequired} onChange={hc} /> Original Packaging Required
                                                </label>
                                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                                    <input type="checkbox" name="tagsRequired" checked={form.tagsRequired} onChange={hc} /> Tags Required
                                                </label>
                                                <FormField label="Return Method">
                                                    <Select name="returnMethod" value={form.returnMethod} onChange={hc}>
                                                        <option value="self_ship">Customer Self-Ships</option>
                                                        <option value="pickup">We Arrange Pickup</option>
                                                    </Select>
                                                </FormField>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ══ SEO ══ */}
                            {tab === "seo" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SectionLabel>SEO & Shipping</SectionLabel>
                                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                        <Button type="button" variant="secondary" size="sm"
                                            disabled={!form.name.trim()}
                                            onClick={() => setForm(p => ({
                                                ...p,
                                                metaTitle: p.metaTitle || `Buy ${p.name.trim()}${p.brand ? ` by ${p.brand}` : ""} Online | Urbexon`.slice(0, 120),
                                                metaDesc: p.metaDesc || `${p.name.trim()} at the best price on Urbexon. ${p.description?.trim().slice(0, 120) || "Fast delivery, secure checkout, verified sellers."}`.slice(0, 200),
                                            }))}>
                                            ⚡ Auto-generate from product info
                                        </Button>
                                    </div>
                                    <FormField label={LBL("Meta Title", { hint: `${form.metaTitle.length}/120 chars` })}>
                                        <Input name="metaTitle" value={form.metaTitle} onChange={hc} maxLength={120} placeholder="Buy Premium Silk Kurta | Urbexon" />
                                    </FormField>
                                    <FormField label={LBL("Meta Description", { hint: `${form.metaDesc.length}/200 chars` })}>
                                        <textarea name="metaDesc" value={form.metaDesc} onChange={hc} rows={3} maxLength={200} className="adm-field-input" style={{ resize: "none", lineHeight: 1.6, width: "100%" }} />
                                    </FormField>
                                    <SectionLabel>Package Dimensions (for courier rates)</SectionLabel>
                                    <div className="g3">
                                        <FormField label="Length (cm)">
                                            <Input name="shipLength" value={form.shipLength} onChange={hc} type="number" min="0" placeholder="30" />
                                        </FormField>
                                        <FormField label="Width (cm)">
                                            <Input name="shipWidth" value={form.shipWidth} onChange={hc} type="number" min="0" placeholder="20" />
                                        </FormField>
                                        <FormField label="Height (cm)">
                                            <Input name="shipHeight" value={form.shipHeight} onChange={hc} type="number" min="0" placeholder="5" />
                                        </FormField>
                                    </div>
                                    <div className="g2">
                                        <FormField label="Return Policy">
                                            <Select name="returnPolicy" value={form.returnPolicy} onChange={hc}>
                                                <option value="0">No Returns</option>
                                                <option value="7">7 Days</option>
                                                <option value="15">15 Days</option>
                                                <option value="30">30 Days</option>
                                            </Select>
                                        </FormField>
                                        <FormField label="Shipping Info">
                                            <Input name="shippingInfo" value={form.shippingInfo} onChange={hc} placeholder="Ships in 2–3 business days" />
                                        </FormField>
                                    </div>
                                </div>
                            )}

                            {/* ══ QUICK COMMERCE ══ */}
                            {tab === "quick" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SectionLabel>Quick Commerce Settings (Urbexon Hour)</SectionLabel>
                                    <FormField label={LBL("Vendor ID", { required: true })} error={fErrs.vendorId}>
                                        <Input name="vendorId" value={form.vendorId} onChange={hc}
                                            placeholder="e.g. 64a1b2c3d4e5f678901234ab" error={fErrs.vendorId} />
                                    </FormField>
                                    <div className="g2">
                                        <FormField label="Prep Time (minutes)">
                                            <Input name="prepTimeMinutes" value={form.prepTimeMinutes} onChange={hc} type="number" min="1" max="120" placeholder="10" />
                                        </FormField>
                                        <FormField label="Max Order Qty">
                                            <Input name="maxOrderQty" value={form.maxOrderQty} onChange={hc} type="number" min="1" max="100" placeholder="10" />
                                        </FormField>
                                    </div>
                                </div>
                            )}

                        </div>

                        {topErr && (
                            <div style={{ margin: "8px 22px 16px" }}>
                                <ErrorState message={topErr} />
                                {Object.keys(fErrs).length > 0 && (
                                    <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 11, lineHeight: 1.8, color: "var(--adm-text-secondary)" }}>
                                        {Object.entries(fErrs).map(([f, msg]) => (
                                            <li key={f}><strong style={{ color: "var(--adm-text-primary)" }}>{f}</strong>: {msg}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Upload progress while publishing */}
                        {loading && uploadPct > 0 && (
                            <div style={{ margin: "0 22px 10px" }}>
                                <div style={{ height: 6, borderRadius: 3, background: "var(--adm-border)", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${uploadPct}%`, background: "var(--adm-primary)", transition: "width .2s" }} />
                                </div>
                                <p style={{ fontSize: 10.5, color: "var(--adm-muted)", marginTop: 4, textAlign: "right" }}>
                                    Uploading images… {uploadPct}%
                                </p>
                            </div>
                        )}

                        {/* Wizard footer — Back / step counter / Next, Publish only on the last step */}
                        <div className="pf-actions">
                            <Button type="button" variant="secondary" disabled={tabIdx <= 0}
                                onClick={() => goToStep(sections[tabIdx - 1])} style={{ flexShrink: 0 }}>← Back</Button>
                            <span style={{ flex: 1, textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "var(--adm-muted)" }}>
                                Step {tabIdx + 1} of {sections.length} — {SECTION_META[tab]?.label}
                            </span>
                            <Button type="button" variant="secondary"
                                onClick={() => {
                                    if (dirty && !window.confirm("Discard unsaved changes? Your draft is auto-saved.")) return;
                                    navigate("/admin/products");
                                }} style={{ flexShrink: 0 }}>Cancel</Button>
                            {tabIdx < sections.length - 1 ? (
                                <Button type="button" variant="primary"
                                    onClick={() => goToStep(sections[tabIdx + 1])} style={{ flexShrink: 0 }}>
                                    Next →
                                </Button>
                            ) : (
                                <span className="pf-submit-wrap">
                                    <Button type="submit" variant="primary" loading={loading}>
                                        {loading ? "Publishing…" : "✦ Publish Product"}
                                    </Button>
                                </span>
                            )}
                        </div>
                    </Card>
                </form>

                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }}>
                    {sections.map(sid => (
                        <div key={sid} style={{
                            width: sid === tab ? 20 : 6, height: 6, borderRadius: 3,
                            background: tabHasErr(sid) ? "var(--adm-danger)" : sid === tab ? tc.color : "var(--adm-border)",
                            transition: "all .25s",
                        }} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminAddProduct;
