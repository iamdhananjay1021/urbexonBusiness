import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/adminApi";
import { fetchAllCategories } from "../api/categoryApi";

/* ─────────────────────────────────────────────────────────
   RE-USE CONSTANTS (same as AdminAddProduct)
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
        label: "E-Commerce", icon: "🛍️", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe",
        sections: ["basic", "pricing", "variants", "details", "images", "policy", "seo"],
    },
    urbexon_hour: {
        label: "Urbexon Hour", icon: "⚡", color: "#d97706", bg: "#fffbeb", border: "#fde68a",
        sections: ["basic", "pricing", "variants", "details", "images", "policy", "quick"],
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
    name: "basic", description: "basic", brand: "basic", sku: "basic",
    category: "basic", subcategory: "basic", tags: "basic",
    color: "basic", material: "basic", occasion: "basic",
    price: "pricing", mrp: "pricing", stock: "pricing", gstPercent: "pricing",
    isDeal: "pricing", dealEndsAt: "pricing",
    colorVariants: "variants", sizes: "variants",
    highlights: "details", weight: "details", origin: "details",
    images: "images",
    isCancellable: "policy", isReturnable: "policy", isReplaceable: "policy",
    returnWindow: "policy", replacementWindow: "policy", cancelWindow: "policy",
    returnPolicy: "seo", shippingInfo: "seo", metaTitle: "seo", metaDesc: "seo",
    prepTimeMinutes: "quick", maxOrderQty: "quick", vendorId: "quick",
};

/* Same CSS as AdminAddProduct — in production extract to shared file */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
.pf-root{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#f5f6fa;min-height:100vh;color:#0f172a;}
.pf-page-title{font-size:22px;font-weight:800;letter-spacing:-.03em;color:#0f172a;}
.pf-page-sub{font-size:12px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;}
.pf-sec-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;padding-bottom:12px;border-bottom:1px solid #f1f5f9;margin-bottom:18px;}
.pf-field-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#475569;}
.pf-field-hint{font-size:11px;color:#94a3b8;margin-left:5px;font-weight:400;text-transform:none;letter-spacing:0;}
.pf-field-err{font-size:11px;color:#dc2626;font-weight:600;margin-top:4px;}
.pf-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,.05);}
.pf-card-accent{height:3px;}
.pf-inp{width:100%;padding:10px 13px;background:#fafbfc;border:1.5px solid #e2e8f0;border-radius:10px;color:#0f172a;font-size:14px;font-family:inherit;outline:none;transition:all .18s;line-height:1.5;}
.pf-inp::placeholder{color:#94a3b8;}
.pf-inp:focus{background:#fff;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1);}
.pf-inp.err{border-color:#dc2626;background:#fff8f8;}
.pf-inp:read-only{background:#f1f5f9;cursor:not-allowed;color:#64748b;}
.pf-sel{appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px;}
.pf-chip{height:32px;padding:0 12px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fafbfc;color:#64748b;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;}
.pf-chip:hover:not(.on){border-color:#6366f1;color:#6366f1;background:#eef2ff;}
.pf-chip.on{background:#eef2ff;border-color:#6366f1;color:#4f46e5;}
.pf-tog-wrap{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;cursor:pointer;border:1.5px solid #e2e8f0;background:#fafbfc;transition:all .18s;}
.pf-tog-wrap.on{border-color:var(--tog-color,#6366f1);background:var(--tog-bg,#eef2ff);}
.pf-tog{width:42px;height:23px;border-radius:12px;border:none;cursor:pointer;position:relative;flex-shrink:0;background:#d1d5db;transition:background .2s;}
.pf-tog.on{background:var(--tog-color,#6366f1);}
.pf-tog-dot{position:absolute;top:2px;left:2px;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:left .2s;}
.pf-tog.on .pf-tog-dot{left:21px;}
.pf-tabbar{display:flex;gap:2px;padding:6px;background:#f1f5f9;border-radius:12px;overflow-x:auto;scrollbar-width:none;}
.pf-tabbar::-webkit-scrollbar{display:none;}
.pf-tab{display:flex;align-items:center;flex-direction:column;padding:7px 10px;border-radius:9px;font-size:10px;font-weight:700;font-family:inherit;letter-spacing:.04em;color:#64748b;cursor:pointer;border:none;background:transparent;white-space:nowrap;flex-shrink:0;transition:all .15s;position:relative;gap:3px;}
.pf-tab:hover:not(.on){background:#fff;color:#475569;}
.pf-tab.on{background:#fff;color:#4f46e5;box-shadow:0 1px 4px rgba(99,102,241,.15);}
.pf-tab-icon{font-size:14px;line-height:1;}
.pf-tab-dot{width:6px;height:6px;border-radius:50%;background:#ef4444;position:absolute;top:5px;right:5px;}
.pf-imgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.pf-slot{aspect-ratio:1;background:#fafbfc;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;position:relative;transition:all .18s;}
.pf-slot:hover{border-color:#6366f1;}
.pf-drop{aspect-ratio:1;border:2px dashed #cbd5e1;border-radius:12px;background:#fafbfc;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:16px;transition:all .18s;}
.pf-drop:hover{border-color:#6366f1;background:#eef2ff;}
.pf-img-badge{position:absolute;bottom:6px;left:6px;background:#4f46e5;color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:4px;letter-spacing:.1em;}
.pf-img-del{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:6px;background:rgba(0,0,0,.55);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;transition:background .15s;}
.pf-img-del:hover{background:#ef4444;}
.pf-variant-card{border:1.5px solid #e2e8f0;border-radius:14px;background:#fafbfc;padding:16px;transition:all .18s;position:relative;}
.pf-variant-card.default{border-color:#6366f1;background:#eef2ff;}
.pf-hl-row{display:flex;gap:8px;align-items:center;}
.pf-hl-row:hover .pf-hl-rm{opacity:1!important;}
.pf-hl-rm{width:28px;height:28px;border-radius:7px;background:#fef2f2;border:1px solid #fecaca;color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;flex-shrink:0;font-size:10px;}
.pf-actions{display:flex;gap:8px;align-items:center;padding:14px 24px 22px;}
.pf-btn-ghost{flex:1;padding:11px;background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;color:#64748b;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s;}
.pf-btn-ghost:hover{background:#f8fafc;border-color:#cbd5e1;color:#0f172a;}
.pf-btn-nav{width:36px;height:40px;border-radius:9px;background:#fafbfc;border:1.5px solid #e2e8f0;color:#64748b;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;display:flex;align-items:center;justify-content:center;}
.pf-btn-nav:hover:not(:disabled){background:#eef2ff;border-color:#a5b4fc;color:#4f46e5;}
.pf-btn-nav:disabled{opacity:.35;cursor:not-allowed;}
.pf-btn-submit{flex:2;padding:12px 20px;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(5,150,105,.3);transition:all .18s;}
.pf-btn-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 18px rgba(5,150,105,.35);}
.pf-btn-submit:disabled{background:#e2e8f0;color:#94a3b8;box-shadow:none;cursor:not-allowed;}
.pf-errbanner{margin:0 22px 16px;padding:12px 14px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;color:#991b1b;font-size:12px;font-weight:600;}
.pf-discount-row{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;}
.pf-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:99999;padding:11px 22px;border-radius:10px;font-weight:700;font-size:13px;font-family:inherit;display:flex;align-items:center;gap:8px;animation:pf-pop .22s ease;white-space:nowrap;box-shadow:0 8px 28px rgba(0,0,0,.15);}
.pf-toast.ok{background:#059669;color:#fff;}
.pf-toast.err{background:#dc2626;color:#fff;}
.pf-loading-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:14px;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
@keyframes pf-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pf-pop{from{opacity:0;transform:translateX(-50%) scale(.93)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes pf-spin{to{transform:rotate(360deg)}}
.pf-anim{animation:pf-in .28s ease;}
.pf-spin{width:14px;height:14px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:pf-spin .7s linear infinite;}
.pf-spin-dark{width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:pf-spin .8s linear infinite;}
@media(max-width:768px){.g2,.g3{grid-template-columns:1fr!important;gap:12px;}.pf-imgrid{grid-template-columns:repeat(2,1fr);}.pf-actions{flex-wrap:wrap;padding:12px 16px 18px;}.pf-btn-submit{order:-1;min-width:100%;}.pf-card{border-radius:12px;}.pf-tab{padding:6px 8px;}}
@media(max-width:480px){.pf-imgrid{grid-template-columns:repeat(2,1fr);gap:7px;}.pf-tab-label{display:none;}.pf-tab{padding:5px 7px;}}
`;

/* ─────────────────────────────────────────────────────────
   TINY SHARED COMPONENTS
───────────────────────────────────────────────────────── */
const Field = ({ label, hint, err, required, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="pf-field-label" style={{ color: err ? "#dc2626" : undefined }}>
                {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
            </span>
            {hint && <span className="pf-field-hint">{hint}</span>}
        </div>
        {children}
        {err && <p className="pf-field-err">⚠ {err}</p>}
    </div>
);

const Toggle = ({ on, toggle, label, sub, color = "#6366f1", bg = "#eef2ff" }) => (
    <div className={`pf-tog-wrap${on ? " on" : ""}`}
        style={{ "--tog-color": color, "--tog-bg": bg }} onClick={toggle}>
        <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", marginBottom: 2 }}>{label}</p>
            {sub && <p style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</p>}
        </div>
        <button type="button" className={`pf-tog${on ? " on" : ""}`}
            style={{ "--tog-color": color }}
            onClick={e => { e.stopPropagation(); toggle(); }}>
            <div className="pf-tog-dot" />
        </button>
    </div>
);

const SL = ({ children }) => <p className="pf-sec-label">{children}</p>;

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
const AdminEditProduct = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    /* ── State ── */
    const [productType, setProductType] = useState("ecommerce");
    const [form, setForm] = useState({
        name: "", description: "", price: "", mrp: "", category: "", subcategory: "",
        isFeatured: false, isDeal: false, dealEndsAt: "", isCustomizable: false,
        tags: "", stock: "", brand: "", sku: "", weight: "", origin: "",
        returnPolicy: "7", shippingInfo: "", metaTitle: "", metaDesc: "",
        color: "", material: "", occasion: "", gstPercent: "0",
        isCancellable: true, isReturnable: true, isReplaceable: false,
        returnWindow: "7", replacementWindow: "7", cancelWindow: "0",
        nonReturnableReason: "",
        prepTimeMinutes: "10", maxOrderQty: "10", vendorId: "",
    });
    const [custConfig, setCustConfig] = useState({
        allowText: true, allowImage: true, allowNote: true,
        textLabel: "Name / Message", textPlaceholder: "", textMaxLength: 100,
        imageLabel: "Upload Design", noteLabel: "Special Instructions", notePlaceholder: "",
        extraPrice: 0,
    });

    /* Images */
    const [curImgs, setCurImgs] = useState([]);
    const [newImages, setNewImages] = useState([]);
    const [newPreviews, setNewPreviews] = useState([]);

    /* Sizes */
    const [selSizes, setSelSizes] = useState([]);
    const selSizesRef = useRef([]);
    useEffect(() => { selSizesRef.current = selSizes; }, [selSizes]);
    const [sizeStockMap, setSizeStockMap] = useState({});
    const [availableSizes, setAvailableSizes] = useState([...SIZE_TEMPLATES.apparel_top]);
    const [newSize, setNewSize] = useState("");

    /* Highlights */
    const [hls, setHls] = useState([{ key: "", value: "" }]);
    const [hlTemplate, setHlTemplate] = useState([]);

    /* Variants */
    const [enableVariants, setEnableVariants] = useState(false);
    const [colorVariants, setColorVariants] = useState([]);

    /* UI */
    const [tab, setTab] = useState("basic");
    const [fErrs, setFErrs] = useState({});
    const [topErr, setTopErr] = useState("");
    const [pageLoad, setPageLoad] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [categories, setCategories] = useState([]);

    /* ── Load categories ── */
    useEffect(() => {
        fetchAllCategories()
            .then(r => setCategories(r.data?.categories || r.data || []))
            .catch(() => { });
    }, []);

    /* ── Highlight template on category change ── */
    useEffect(() => {
        if (!form.category) { setHlTemplate([]); return; }
        api.get(`/categories/highlight-template?category=${encodeURIComponent(form.category)}`)
            .then(r => setHlTemplate(r.data?.highlightTemplate || []))
            .catch(() => setHlTemplate([]));
    }, [form.category]);

    /* ── Sync dynamic sizes when category changes ── */
    useEffect(() => {
        const catObj = categories.find(c => c.value === form.category || c.slug === form.category || c.name === form.category);
        const catName = catObj ? catObj.name : form.category;
        const suggested = getSuggestedSizes(catName);
        setAvailableSizes(prev => Array.from(new Set([...suggested, ...selSizesRef.current])));
    }, [form.category, categories]);

    /* ── Fetch product data ── */
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get(`/products/${id}`);
                setProductType(data.productType || "ecommerce");

                setForm({
                    name: data.name || "",
                    description: data.description || "",
                    price: data.price?.toString() || "",
                    mrp: data.mrp?.toString() || "",
                    category: data.category || "",
                    subcategory: data.subcategory || "",
                    isFeatured: Boolean(data.isFeatured),
                    isDeal: Boolean(data.isDeal),
                    dealEndsAt: data.dealEndsAt ? data.dealEndsAt.slice(0, 16) : "",
                    isCustomizable: Boolean(data.isCustomizable),
                    tags: data.tags?.join(", ") || "",
                    stock: data.stock?.toString() ?? "0",
                    brand: data.brand || "",
                    sku: data.sku || "",
                    weight: data.weight || "",
                    origin: data.origin || "",
                    returnPolicy: data.returnPolicy || "7",
                    shippingInfo: data.shippingInfo || "",
                    metaTitle: data.metaTitle || "",
                    metaDesc: data.metaDesc || "",
                    color: data.color || "",
                    material: data.material || "",
                    occasion: data.occasion || "",
                    gstPercent: String(data.gstPercent ?? 0),
                    isCancellable: data.isCancellable !== false,
                    isReturnable: data.isReturnable !== false,
                    isReplaceable: data.isReplaceable === true,
                    returnWindow: String(data.returnWindow ?? 7),
                    replacementWindow: String(data.replacementWindow ?? 7),
                    cancelWindow: String(data.cancelWindow ?? 0),
                    nonReturnableReason: data.nonReturnableReason || "",
                    prepTimeMinutes: String(data.prepTimeMinutes ?? 10),
                    maxOrderQty: String(data.maxOrderQty ?? 10),
                    vendorId: data.vendorId?.toString() || "",
                });

                if (data.customizationConfig) {
                    setCustConfig(prev => ({ ...prev, ...data.customizationConfig }));
                }

                setCurImgs(data.images || []);

                /* Sizes */
                if (data.sizes?.length) {
                    const sz = data.sizes.map(s => typeof s === "string" ? s : s.size).filter(Boolean);
                    setSelSizes(sz);
                    setAvailableSizes(prev => Array.from(new Set([...prev, ...sz])));
                    const sm = {};
                    data.sizes.forEach(s => {
                        if (typeof s === "object" && s.size) sm[s.size] = s.stock ?? 0;
                    });
                    setSizeStockMap(sm);
                }

                /* Highlights */
                if (data.highlightsArray?.length) {
                    setHls(data.highlightsArray.map(h => ({ key: h.title, value: h.value })));
                } else if (data.highlights && Object.keys(data.highlights).length) {
                    const entries = data.highlights instanceof Map
                        ? [...data.highlights.entries()]
                        : Object.entries(data.highlights);
                    setHls(entries.map(([key, value]) => ({ key, value })));
                }

                /* Color variants */
                if (data.colorVariants?.length) {
                    setEnableVariants(true);
                    setColorVariants(data.colorVariants.map((v, i) => ({
                        id: i + Date.now(),
                        name: v.name || "",
                        hex: v.hex || "#000000",
                        stock: String(v.stock || 0),
                        isDefault: v.isDefault || i === 0,
                        images: [], previews: [],
                        existingImages: v.images || [],
                    })));
                }

            } catch (err) {
                setTopErr("Failed to load product data. Please refresh.");
            } finally {
                setPageLoad(false);
            }
        })();
    }, [id]);

    const tc = PRODUCT_TYPE_CONFIG[productType];
    const sections = tc.sections;
    const tabIdx = sections.indexOf(tab);

    /* ── Helpers ── */
    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3200); };
    const clrErr = name => { setFErrs(p => { const n = { ...p }; delete n[name]; return n; }); setTopErr(""); };
    const hc = useCallback(e => {
        const { name, value, type, checked } = e.target;
        setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value }));
        clrErr(name);
    }, []);

    const discPct = form.mrp && form.price && +form.mrp > +form.price
        ? Math.round(((+form.mrp - +form.price) / +form.mrp) * 100) : null;

    const tabHasErr = id => {
        const owned = Object.entries(FIELD_TAB).filter(([, t]) => t === id).map(([f]) => f);
        return owned.some(f => fErrs[f]);
    };

    /* Sizes */
    const toggleSize = s => setSelSizes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
    const updateSizeStock = (size, val) => {
        const n = Math.max(0, parseInt(val) || 0);
        setSizeStockMap(p => ({ ...p, [size]: n }));
    };

    useEffect(() => {
        if (selSizes.length > 0) {
            const totalStock = selSizes.reduce((acc, sz) => acc + (sizeStockMap[sz] || 0), 0);
            setForm(f => ({ ...f, stock: String(totalStock) }));
        }
    }, [selSizes, sizeStockMap]);

    const handleAddCustomSize = (e) => {
        if (e) e.preventDefault();
        const val = newSize.trim();
        if (!val) return;
        if (!availableSizes.includes(val)) {
            setAvailableSizes(p => [...p, val]);
        }
        if (!selSizes.includes(val)) {
            setSelSizes(p => [...p, val]);
        }
        setNewSize("");
    };

    /* Highlights */
    const addHL = () => setHls(p => [...p, { key: "", value: "" }]);
    const removeHL = i => setHls(p => p.filter((_, j) => j !== i));
    const updateHL = (i, f, v) => setHls(p => p.map((h, j) => j === i ? { ...h, [f]: v } : h));

    /* New images */
    const handleNewImgs = e => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        for (const f of files) {
            if (f.size > 5 * 1048576) { setTopErr(`"${f.name}" exceeds 5MB`); return; }
        }
        if (files.length > 6) { setTopErr("Max 6 images allowed"); return; }
        setNewImages(files);
        setNewPreviews(files.map(f => URL.createObjectURL(f)));
        setTopErr("");
    };
    const removeNewImg = i => {
        setNewImages(p => p.filter((_, j) => j !== i));
        setNewPreviews(p => p.filter((_, j) => j !== i));
    };

    /* Variants */
    const addVariant = () => setColorVariants(p => [
        ...p, {
            id: Date.now(), name: "", hex: "#000000", stock: "0",
            isDefault: p.length === 0, images: [], previews: [], existingImages: []
        },
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
        updateVariant(id, "images", files);
        updateVariant(id, "previews", files.map(f => URL.createObjectURL(f)));
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

        if (Object.keys(fe).length) {
            setFErrs(fe);
            const fb = FIELD_TAB[Object.keys(fe)[0]];
            if (fb && sections.includes(fb)) setTab(fb);
            setTopErr(`Fix ${Object.keys(fe).length} field(s) before saving`);
            return;
        }

        try {
            setSaving(true);
            const fd = new FormData();

            fd.append("name", form.name.trim());
            fd.append("category", form.category);
            fd.append("price", String(+form.price));
            fd.append("stock", String(+form.stock));
            fd.append("productType", productType);

            [["description", form.description], ["mrp", form.mrp], ["brand", form.brand],
            ["sku", form.sku], ["weight", form.weight], ["origin", form.origin],
            ["returnPolicy", form.returnPolicy], ["shippingInfo", form.shippingInfo],
            ["material", form.material], ["color", form.color], ["occasion", form.occasion],
            ["subcategory", form.subcategory], ["metaTitle", form.metaTitle], ["metaDesc", form.metaDesc],
            ["nonReturnableReason", form.nonReturnableReason],
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

            newImages.forEach(img => fd.append("images", img));

            if (enableVariants && colorVariants.length) {
                const meta = colorVariants.map(v => ({
                    name: v.name, hex: v.hex, stock: +v.stock || 0, isDefault: v.isDefault,
                }));
                fd.append("colorVariants", JSON.stringify(meta));
                colorVariants.forEach((v, vi) => {
                    v.images.forEach(img => fd.append(`variantImages_${vi}`, img));
                });
            }

            if (productType === "urbexon_hour") {
                fd.append("prepTimeMinutes", String(+form.prepTimeMinutes || 10));
                fd.append("maxOrderQty", String(+form.maxOrderQty || 10));
            }

            await api.put(`/products/admin/${id}`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            showToast("ok", "Product updated successfully!");
            setTimeout(() => navigate("/admin/products"), 1500);

        } catch (err) {
            const data = err.response?.data || {};
            const apiErrors = data.errors;
            if (Array.isArray(apiErrors) && apiErrors.length) {
                const mapped = {};
                apiErrors.forEach(({ field, message }) => { if (field) mapped[field] = message; });
                if (Object.keys(mapped).length) {
                    setFErrs(mapped);
                    const fb = FIELD_TAB[Object.keys(mapped)[0]];
                    if (fb && sections.includes(fb)) setTab(fb);
                    setTopErr(`Server rejected: ${Object.keys(mapped).join(", ")}`);
                } else {
                    setTopErr(apiErrors.map(e => e.message).join(" | "));
                }
            } else {
                setTopErr(data.message || "Failed to update. Please retry.");
            }
        } finally {
            setSaving(false);
        }
    };

    /* ── Loading screen ── */
    if (pageLoad) return (
        <div className="pf-root">
            <style>{GLOBAL_CSS}</style>
            <div className="pf-loading-screen">
                <div className="pf-spin-dark" />
                <p style={{ fontSize: 13, color: "#94a3b8" }}>Loading product…</p>
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════
       RENDER
    ═══════════════════════════════════════════════════════ */
    return (
        <div className="pf-root" style={{ padding: "24px 14px 80px" }}>
            <style>{GLOBAL_CSS}</style>

            {toast && (
                <div className={`pf-toast ${toast.type}`}>
                    {toast.type === "ok" ? "✓" : "✕"} {toast.msg}
                </div>
            )}

            <div style={{ maxWidth: 880, margin: "0 auto" }}>

                {/* ── Header ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                    <button type="button" onClick={() => navigate("/admin/products")}
                        style={{
                            width: 38, height: 38, borderRadius: 10, background: "#fff",
                            border: "1.5px solid #e2e8f0", color: "#64748b", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, fontSize: 14, transition: "all .15s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}>
                        ←
                    </button>
                    <div>
                        <p className="pf-page-sub">Products</p>
                        <h1 className="pf-page-title">Edit Product</h1>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                            letterSpacing: ".07em", color: tc.color,
                            background: tc.bg, border: `1px solid ${tc.border}`,
                            padding: "4px 12px", borderRadius: 20
                        }}>
                            {tc.icon} {tc.label}
                        </span>
                    </div>
                </div>

                {/* ── Tab bar ── */}
                <div className="pf-tabbar" style={{ marginBottom: 12 }}>
                    {sections.map(sid => {
                        const meta = SECTION_META[sid];
                        return (
                            <button key={sid} type="button"
                                className={`pf-tab${tab === sid ? " on" : ""}`}
                                onClick={() => setTab(sid)}>
                                <span className="pf-tab-icon">{meta.icon}</span>
                                <span className="pf-tab-label">{meta.label}</span>
                                {tabHasErr(sid) && <span className="pf-tab-dot" />}
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="pf-card">
                        <div className="pf-card-accent" style={{ background: `linear-gradient(90deg,${tc.color},#059669)` }} />

                        <div style={{ padding: "22px 24px 6px" }}>

                            {/* BASIC */}
                            {tab === "basic" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SL>Basic Information</SL>

                                    <Field label="Product Name" required err={fErrs.name}>
                                        <input name="name" value={form.name} onChange={hc}
                                            placeholder="e.g. Premium Cotton Kurta"
                                            className={`pf-inp${fErrs.name ? " err" : ""}`} />
                                    </Field>

                                    <Field label="Description" hint="optional">
                                        <textarea name="description" value={form.description} onChange={hc}
                                            placeholder="Fabric, fit, occasion, care instructions…"
                                            rows={3} className="pf-inp" style={{ resize: "vertical", lineHeight: 1.65 }} />
                                    </Field>

                                    <div className="g2">
                                        <Field label="Brand">
                                            <input name="brand" value={form.brand} onChange={hc} placeholder="Urbexon" className="pf-inp" />
                                        </Field>
                                        <Field label="SKU / Code">
                                            <input name="sku" value={form.sku} onChange={hc} placeholder="UX-KRT-001" className="pf-inp" />
                                        </Field>
                                    </div>

                                    <div className="g3">
                                        <Field label="Color">
                                            <input name="color" value={form.color} onChange={hc} placeholder="Navy Blue" className="pf-inp" />
                                        </Field>
                                        <Field label="Material">
                                            <input name="material" value={form.material} onChange={hc} placeholder="Cotton" className="pf-inp" />
                                        </Field>
                                        <Field label="Occasion">
                                            <input name="occasion" value={form.occasion} onChange={hc} placeholder="Casual" className="pf-inp" />
                                        </Field>
                                    </div>

                                    <div className="g2">
                                        <Field label="Category" required err={fErrs.category}>
                                            <select name="category" value={form.category} onChange={hc}
                                                className={`pf-inp pf-sel${fErrs.category ? " err" : ""}`}>
                                                <option value="">— Select Category —</option>
                                                {categories.map(c => (
                                                    <option key={c._id || c.value} value={c.value || c.slug || c.name}>
                                                        {c.icon ? `${c.icon} ` : ""}{c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Subcategory">
                                            <input name="subcategory" value={form.subcategory} onChange={hc}
                                                placeholder="e.g. Kurta Set" className="pf-inp" />
                                        </Field>
                                    </div>

                                    <Field label="Tags" hint="comma-separated">
                                        <input name="tags" value={form.tags} onChange={hc}
                                            placeholder="kurta, ethnic, festive" className="pf-inp" />
                                    </Field>

                                    <div className="g2">
                                        <Toggle on={form.isFeatured}
                                            toggle={() => setForm(p => ({ ...p, isFeatured: !p.isFeatured }))}
                                            label="⭐ Featured Product" sub="Shown on homepage"
                                            color="#f59e0b" bg="#fffbeb" />
                                        <Toggle on={form.isCustomizable}
                                            toggle={() => setForm(p => ({ ...p, isCustomizable: !p.isCustomizable }))}
                                            label="🎨 Customizable" sub="Customer can add design/text" />
                                    </div>

                                    {form.isCustomizable && (
                                        <div style={{
                                            background: "#fafbfc", border: "1.5px solid #e2e8f0",
                                            borderRadius: 13, padding: 16, display: "flex", flexDirection: "column", gap: 12
                                        }}>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: "#4f46e5" }}>🎨 Customization Options</p>
                                            <Toggle on={custConfig.allowText}
                                                toggle={() => setCustConfig(p => ({ ...p, allowText: !p.allowText }))}
                                                label="Allow Custom Text" sub="Name / message input" />
                                            {custConfig.allowText && (
                                                <div className="g2" style={{ paddingLeft: 10 }}>
                                                    <Field label="Text Label">
                                                        <input value={custConfig.textLabel}
                                                            onChange={e => setCustConfig(p => ({ ...p, textLabel: e.target.value }))}
                                                            placeholder="Name / Message" className="pf-inp" />
                                                    </Field>
                                                    <Field label="Max Length">
                                                        <input type="number" min="1" max="500" value={custConfig.textMaxLength}
                                                            onChange={e => setCustConfig(p => ({ ...p, textMaxLength: +e.target.value || 100 }))}
                                                            className="pf-inp" />
                                                    </Field>
                                                </div>
                                            )}
                                            <Toggle on={custConfig.allowImage}
                                                toggle={() => setCustConfig(p => ({ ...p, allowImage: !p.allowImage }))}
                                                label="Allow Image Upload" sub="Customer uploads photo" />
                                            <Toggle on={custConfig.allowNote}
                                                toggle={() => setCustConfig(p => ({ ...p, allowNote: !p.allowNote }))}
                                                label="Allow Special Notes" sub="Free-text instructions" />
                                            <Field label="Extra Charge (₹)" hint="0 = free">
                                                <input type="number" min="0" value={custConfig.extraPrice}
                                                    onChange={e => setCustConfig(p => ({ ...p, extraPrice: +e.target.value || 0 }))}
                                                    placeholder="0" className="pf-inp" style={{ maxWidth: 180 }} />
                                            </Field>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PRICING */}
                            {tab === "pricing" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SL>Pricing & Stock</SL>
                                    <div className="g2">
                                        <Field label="Selling Price (₹)" required err={fErrs.price}>
                                            <div style={{ position: "relative" }}>
                                                <span style={{
                                                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                                                    color: "#94a3b8", fontSize: 13, pointerEvents: "none"
                                                }}>₹</span>
                                                <input type="number" name="price" value={form.price} onChange={hc}
                                                    placeholder="0" min="1"
                                                    className={`pf-inp${fErrs.price ? " err" : ""}`} style={{ paddingLeft: 28 }} />
                                            </div>
                                        </Field>
                                        <Field label="MRP (₹)" hint="compare-at" err={fErrs.mrp}>
                                            <div style={{ position: "relative" }}>
                                                <span style={{
                                                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                                                    color: "#94a3b8", fontSize: 13, pointerEvents: "none"
                                                }}>₹</span>
                                                <input type="number" name="mrp" value={form.mrp} onChange={hc}
                                                    placeholder="0" min="1"
                                                    className={`pf-inp${fErrs.mrp ? " err" : ""}`} style={{ paddingLeft: 28 }} />
                                            </div>
                                        </Field>
                                    </div>
                                    {discPct && (
                                        <div className="pf-discount-row">
                                            <span style={{ color: "#059669", fontWeight: 800, fontSize: 22 }}>{discPct}%</span>
                                            <div>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Discount Applied</p>
                                                <p style={{ fontSize: 11, color: "#64748b" }}>
                                                    Customer saves ₹{(+form.mrp - +form.price).toLocaleString("en-IN")}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="g2">
                                        <Field label="Stock Quantity" required err={fErrs.stock}
                                            hint={selSizes.length ? "auto from sizes" : undefined}>
                                            <input type="number" name="stock" value={form.stock} onChange={hc}
                                                readOnly={selSizes.length > 0} placeholder="0" min="0"
                                                className={`pf-inp${fErrs.stock ? " err" : ""}`}
                                                style={{ background: selSizes.length > 0 ? "#f1f5f9" : undefined }} />
                                            {form.stock !== "" && !fErrs.stock && (
                                                <p style={{
                                                    fontSize: 11, fontWeight: 600, marginTop: 2,
                                                    color: +form.stock > 0 ? "#059669" : "#ef4444"
                                                }}>
                                                    {+form.stock > 0 ? `✓ In Stock — ${form.stock} units` : "✕ Out of Stock"}
                                                </p>
                                            )}
                                        </Field>
                                        <Field label="GST Rate">
                                            <select name="gstPercent" value={form.gstPercent} onChange={hc}
                                                className="pf-inp pf-sel">
                                                {GST_RATES.map(r => <option key={r} value={r}>{r}% GST</option>)}
                                            </select>
                                        </Field>
                                    </div>
                                    <Toggle on={form.isDeal}
                                        toggle={() => setForm(p => ({ ...p, isDeal: !p.isDeal, dealEndsAt: "" }))}
                                        label="⚡ Mark as Deal" sub="Appears in Deals section"
                                        color="#d97706" bg="#fffbeb" />
                                    {form.isDeal && (
                                        <Field label="Deal Ends At" hint="blank = no expiry">
                                            <input type="datetime-local" name="dealEndsAt" value={form.dealEndsAt} onChange={hc}
                                                className="pf-inp" />
                                        </Field>
                                    )}
                                </div>
                            )}

                            {/* VARIANTS */}
                            {tab === "variants" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <SL>Color Variants & Sizes</SL>

                                    <div>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>AVAILABLE SIZES</p>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                                            {availableSizes.map(s => (
                                                <button key={s} type="button" onClick={() => toggleSize(s)}
                                                    className={`pf-chip${selSizes.includes(s) ? " on" : ""}`}>{s}</button>
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                            <input
                                                value={newSize}
                                                onChange={e => setNewSize(e.target.value)}
                                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomSize(); } }}
                                                placeholder="Add custom size (e.g. 8, 42, 6GB)"
                                                className="pf-inp"
                                                style={{ maxWidth: 200, padding: "8px 12px" }}
                                            />
                                            <button type="button" onClick={handleAddCustomSize} className="pf-btn-ghost" style={{ flex: "none", padding: "8px 16px" }}>
                                                Add Size
                                            </button>
                                        </div>
                                        {selSizes.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                {selSizes.map(s => (
                                                    <div key={s} style={{
                                                        display: "flex", alignItems: "center", gap: 8,
                                                        background: "#fafbfc", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "6px 10px"
                                                    }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", minWidth: 36 }}>{s}</span>
                                                        <input type="number" min="0" value={sizeStockMap[s] ?? 0}
                                                            onChange={e => updateSizeStock(s, e.target.value)}
                                                            style={{
                                                                width: 60, padding: "5px 8px", border: "1.5px solid #e2e8f0",
                                                                borderRadius: 7, fontSize: 12, textAlign: "center",
                                                                outline: "none", fontFamily: "inherit"
                                                            }} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Toggle on={enableVariants}
                                        toggle={() => { setEnableVariants(p => !p); if (!enableVariants && colorVariants.length === 0) addVariant(); }}
                                        label="🎨 Multiple Color Variants"
                                        sub="Separate images and stock per color option" />

                                    {enableVariants && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            {colorVariants.map((v, vi) => (
                                                <div key={v.id} className={`pf-variant-card${v.isDefault ? " default" : ""}`}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                                        <div style={{ position: "relative" }}>
                                                            <input type="color" value={v.hex}
                                                                onChange={e => updateVariant(v.id, "hex", e.target.value)}
                                                                style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer", border: "none" }} />
                                                            <div style={{
                                                                width: 36, height: 36, borderRadius: "50%",
                                                                background: v.hex, border: "3px solid #fff",
                                                                boxShadow: "0 0 0 2px #e2e8f0", cursor: "pointer"
                                                            }} />
                                                        </div>
                                                        <input value={v.name}
                                                            onChange={e => updateVariant(v.id, "name", e.target.value)}
                                                            placeholder={`Color ${vi + 1} (e.g. Navy Blue)`}
                                                            className="pf-inp" style={{ flex: 1 }} />
                                                        <input type="number" min="0" value={v.stock}
                                                            onChange={e => updateVariant(v.id, "stock", e.target.value)}
                                                            placeholder="Stock" className="pf-inp" style={{ width: 90 }} />
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                                                            <button type="button" onClick={() => setDefaultVariant(v.id)}
                                                                style={{
                                                                    padding: "4px 10px", fontSize: 10, fontWeight: 700,
                                                                    border: "1.5px solid", borderRadius: 6, cursor: "pointer",
                                                                    background: v.isDefault ? "#4f46e5" : "#fff",
                                                                    color: v.isDefault ? "#fff" : "#6366f1",
                                                                    borderColor: v.isDefault ? "#4f46e5" : "#a5b4fc"
                                                                }}>
                                                                {v.isDefault ? "✓ Default" : "Set Default"}
                                                            </button>
                                                            {colorVariants.length > 1 && (
                                                                <button type="button" onClick={() => removeVariant(v.id)}
                                                                    style={{
                                                                        padding: "3px 10px", fontSize: 10, fontWeight: 700,
                                                                        border: "1.5px solid #fecaca", borderRadius: 6,
                                                                        cursor: "pointer", background: "#fef2f2", color: "#dc2626"
                                                                    }}>
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Existing images indicator */}
                                                    {v.existingImages?.length > 0 && v.previews.length === 0 && (
                                                        <div style={{
                                                            marginBottom: 10, padding: "8px 12px",
                                                            background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8
                                                        }}>
                                                            <p style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                                                                ✓ {v.existingImages.length} existing image(s) — upload new to replace
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
                                                            Images for this color:
                                                        </p>
                                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                                                            {v.previews.map((src, pi) => (
                                                                <div key={pi} className="pf-slot">
                                                                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                                    {pi === 0 && <span className="pf-img-badge">MAIN</span>}
                                                                    <button type="button" className="pf-img-del"
                                                                        onClick={() => {
                                                                            updateVariant(v.id, "images", v.images.filter((_, j) => j !== pi));
                                                                            updateVariant(v.id, "previews", v.previews.filter((_, j) => j !== pi));
                                                                        }}>✕</button>
                                                                </div>
                                                            ))}
                                                            {v.previews.length < 4 && (
                                                                <label className="pf-drop">
                                                                    <span style={{ fontSize: 22 }}>📷</span>
                                                                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Add</span>
                                                                    <input type="file" multiple accept="image/*"
                                                                        onChange={e => handleVariantImages(v.id, e)}
                                                                        style={{ display: "none" }} />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button type="button" onClick={addVariant}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
                                                    padding: "10px 16px", border: "2px dashed #c7d2fe",
                                                    borderRadius: 12, background: "none", cursor: "pointer",
                                                    color: "#6366f1", fontWeight: 700, fontSize: 13, fontFamily: "inherit"
                                                }}>
                                                + Add Color Variant
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* DETAILS */}
                            {tab === "details" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <SL>Product Details & Specifications</SL>
                                    <Field label="Product Highlights" hint="key specs shown on product page">
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {hls.map((h, i) => (
                                                <div key={i} className="pf-hl-row">
                                                    <select value={h.key} onChange={e => updateHL(i, "key", e.target.value)}
                                                        className="pf-inp pf-sel" style={{ flex: "0 0 150px", padding: "9px 32px 9px 10px" }}>
                                                        <option value="">Select key</option>
                                                        {(hlTemplate.length ? hlTemplate.map(t => t.title) : HIGHLIGHT_KEYS)
                                                            .map(k => <option key={k} value={k}>{k}</option>)}
                                                    </select>
                                                    <input value={h.value} onChange={e => updateHL(i, "value", e.target.value)}
                                                        placeholder="Value…" className="pf-inp" style={{ flex: 1 }} />
                                                    {hls.length > 1 && (
                                                        <button type="button" onClick={() => removeHL(i)} className="pf-hl-rm">✕</button>
                                                    )}
                                                </div>
                                            ))}
                                            <button type="button" onClick={addHL}
                                                style={{
                                                    alignSelf: "flex-start", display: "flex", alignItems: "center",
                                                    gap: 5, fontSize: 12, fontWeight: 600, color: "#6366f1",
                                                    background: "none", border: "none", cursor: "pointer", padding: "3px 0"
                                                }}>
                                                + Add Highlight
                                            </button>
                                        </div>
                                    </Field>
                                    <div className="g2">
                                        <Field label="Weight"><input name="weight" value={form.weight} onChange={hc} placeholder="e.g. 250g" className="pf-inp" /></Field>
                                        <Field label="Country of Origin"><input name="origin" value={form.origin} onChange={hc} placeholder="e.g. India" className="pf-inp" /></Field>
                                    </div>
                                </div>
                            )}

                            {/* IMAGES */}
                            {tab === "images" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SL>Product Images</SL>

                                    {/* Current images */}
                                    {curImgs.length > 0 && newPreviews.length === 0 && (
                                        <div>
                                            <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 10 }}>
                                                Current Images <span style={{ color: "#94a3b8", fontWeight: 400 }}>— upload new to replace</span>
                                            </p>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                                                {curImgs.map((img, i) => (
                                                    <div key={i} className="pf-slot">
                                                        <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                        {i === 0 && <span className="pf-img-badge">MAIN</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* New image upload */}
                                    <div>
                                        <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 10 }}>
                                            {newPreviews.length > 0 ? "New Images (will replace current)" : "Replace Images"}
                                        </p>
                                        {newPreviews.length === 0 ? (
                                            <label className="pf-drop" style={{ aspectRatio: "auto", height: 110 }}>
                                                <span style={{ fontSize: 22 }}>🖼️</span>
                                                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Click to upload new images</span>
                                                <span style={{ fontSize: 10, color: "#94a3b8" }}>PNG · JPG · WEBP · Max 5MB</span>
                                                <input type="file" multiple accept="image/*" onChange={handleNewImgs} style={{ display: "none" }} />
                                            </label>
                                        ) : (
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                                                {newPreviews.map((src, i) => (
                                                    <div key={i} className="pf-slot">
                                                        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                        {i === 0 && <span className="pf-img-badge">MAIN</span>}
                                                        <button type="button" className="pf-img-del" onClick={() => removeNewImg(i)}>✕</button>
                                                    </div>
                                                ))}
                                                {newPreviews.length < 6 && (
                                                    <label className="pf-drop">
                                                        <span style={{ fontSize: 20 }}>+</span>
                                                        <input type="file" multiple accept="image/*" onChange={handleNewImgs} style={{ display: "none" }} />
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* POLICY */}
                            {tab === "policy" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SL>Cancellation, Return & Replacement Policy</SL>
                                    <div className="g3">
                                        {[["isCancellable", "Cancellable"], ["isReturnable", "Returnable"], ["isReplaceable", "Replaceable"]].map(([field, label]) => (
                                            <label key={field} style={{
                                                display: "flex", alignItems: "center", gap: 9,
                                                padding: "11px 14px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700,
                                                background: form[field] ? "#f0fdf4" : "#fef2f2",
                                                border: `1.5px solid ${form[field] ? "#bbf7d0" : "#fecaca"}`,
                                                transition: "all .15s"
                                            }}>
                                                <input type="checkbox" name={field} checked={form[field]}
                                                    onChange={e => setForm(p => ({ ...p, [field]: e.target.checked }))} />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                    <div className="g3">
                                        <Field label="Cancel Window (hrs)">
                                            <input name="cancelWindow" value={form.cancelWindow} onChange={hc} type="number" min="0" max="72" className="pf-inp" />
                                        </Field>
                                        <Field label="Return Window (days)">
                                            <input name="returnWindow" value={form.returnWindow} onChange={hc} type="number" min="0" max="30" className="pf-inp" />
                                        </Field>
                                        <Field label="Replacement Window (days)">
                                            <input name="replacementWindow" value={form.replacementWindow} onChange={hc} type="number" min="0" max="30" className="pf-inp" />
                                        </Field>
                                    </div>
                                    {!form.isReturnable && (
                                        <Field label="Non-Returnable Reason">
                                            <input name="nonReturnableReason" value={form.nonReturnableReason} onChange={hc}
                                                placeholder="e.g. Hygiene product" className="pf-inp" />
                                        </Field>
                                    )}
                                </div>
                            )}

                            {/* SEO */}
                            {tab === "seo" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SL>SEO & Shipping</SL>
                                    <Field label="Meta Title" hint="~60 chars">
                                        <input name="metaTitle" value={form.metaTitle} onChange={hc}
                                            placeholder="Buy Premium Silk Kurta | Urbexon" className="pf-inp" />
                                        {form.metaTitle && (
                                            <p style={{ fontSize: 10, marginTop: 2, color: form.metaTitle.length > 60 ? "#dc2626" : "#94a3b8" }}>
                                                {form.metaTitle.length}/60 chars
                                            </p>
                                        )}
                                    </Field>
                                    <Field label="Meta Description" hint="~160 chars">
                                        <textarea name="metaDesc" value={form.metaDesc} onChange={hc}
                                            placeholder="Brief description…" rows={3} className="pf-inp" style={{ resize: "none", lineHeight: 1.6 }} />
                                        {form.metaDesc && (
                                            <p style={{ fontSize: 10, marginTop: 2, color: form.metaDesc.length > 160 ? "#dc2626" : "#94a3b8" }}>
                                                {form.metaDesc.length}/160 chars
                                            </p>
                                        )}
                                    </Field>
                                    <div style={{ height: 1, background: "#f1f5f9" }} />
                                    <div className="g2">
                                        <Field label="Return Policy">
                                            <select name="returnPolicy" value={form.returnPolicy} onChange={hc} className="pf-inp pf-sel">
                                                <option value="0">No Returns</option>
                                                <option value="7">7 Days</option>
                                                <option value="15">15 Days</option>
                                                <option value="30">30 Days</option>
                                            </select>
                                        </Field>
                                        <Field label="Shipping Info">
                                            <input name="shippingInfo" value={form.shippingInfo} onChange={hc}
                                                placeholder="Ships in 2–3 business days" className="pf-inp" />
                                        </Field>
                                    </div>
                                </div>
                            )}

                            {/* QUICK */}
                            {tab === "quick" && (
                                <div className="pf-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <SL>Quick Commerce Settings (Urbexon Hour)</SL>
                                    <div style={{
                                        padding: "12px 14px", background: "#fffbeb",
                                        border: "1px solid #fde68a", borderRadius: 10
                                    }}>
                                        <p style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                                            ⚡ Urbexon Hour fast-delivery product settings
                                        </p>
                                    </div>
                                    <div className="g2">
                                        <Field label="Prep Time (minutes)">
                                            <input name="prepTimeMinutes" value={form.prepTimeMinutes} onChange={hc}
                                                type="number" min="1" max="120" placeholder="10" className="pf-inp" />
                                        </Field>
                                        <Field label="Max Order Qty">
                                            <input name="maxOrderQty" value={form.maxOrderQty} onChange={hc}
                                                type="number" min="1" max="100" placeholder="10" className="pf-inp" />
                                        </Field>
                                    </div>
                                </div>
                            )}

                        </div>

                        {topErr && (
                            <div className="pf-errbanner" style={{ marginTop: 8 }}>
                                <p style={{ fontWeight: 700, marginBottom: Object.keys(fErrs).length ? 6 : 0 }}>⚠ {topErr}</p>
                                {Object.keys(fErrs).length > 0 && (
                                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.8 }}>
                                        {Object.entries(fErrs).map(([f, m]) => <li key={f}><strong>{f}</strong>: {m}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}

                        <div className="pf-actions">
                            <button type="button" className="pf-btn-nav" disabled={tabIdx <= 0}
                                onClick={() => setTab(sections[tabIdx - 1])}>←</button>
                            <button type="button" className="pf-btn-nav" disabled={tabIdx >= sections.length - 1}
                                onClick={() => setTab(sections[tabIdx + 1])}>→</button>
                            <button type="button" className="pf-btn-ghost"
                                onClick={() => navigate("/admin/products")}>Cancel</button>
                            <button type="submit" disabled={saving} className="pf-btn-submit">
                                {saving ? <><div className="pf-spin" /> Updating…</> : <>✓ Update Product</>}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Progress dots */}
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }}>
                    {sections.map(sid => (
                        <div key={sid} style={{
                            width: sid === tab ? 20 : 6, height: 6, borderRadius: 3,
                            background: tabHasErr(sid) ? "#ef4444" : sid === tab ? tc.color : "#e2e8f0",
                            transition: "all .25s"
                        }} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminEditProduct;