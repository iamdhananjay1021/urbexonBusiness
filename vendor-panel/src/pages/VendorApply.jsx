/**
 * VendorApply.jsx — Production v2.1
 *
 * FIXES:
 *  - deliveryMode initial value "both" (was "vendor_self")
 *  - deliveryMode option values: "self" | "platform" | "both"
 *  - Token saved to localStorage after success (never expires)
 *  - Success screen shows credentials clearly
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiUpload, FiX, FiCheck, FiAlertCircle,
    FiArrowRight, FiArrowLeft, FiUser, FiBriefcase, FiFileText,
} from "react-icons/fi";
import api from "../api/axios";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
    { label: "Basic Info", icon: FiUser },
    { label: "Business", icon: FiBriefcase },
    { label: "Documents", icon: FiFileText },
];

const INITIAL_FORM = {
    shopName: "",
    shopDescription: "",
    shopCategory: "",
    ownerName: "",
    email: "",
    phone: "",
    whatsapp: "",
    alternatePhone: "",
    gstNumber: "",
    panNumber: "",
    businessType: "individual",
    deliveryMode: "both",          // ✅ FIXED: was "vendor_self"
    address: {
        street: "", city: "", state: "", pincode: "", landmark: "",
    },
    servicePincodes: [],
    bankDetails: {
        holderName: "", accountNumber: "", ifsc: "", bankName: "",
    },
};

const INITIAL_FILES = {
    shopLogo: null, shopBanner: null, shopPhoto: null, ownerPhoto: null,
    gstCertificate: null, panCard: null, cancelledCheque: null, addressProof: null,
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    primary: "#4f46e5",
    primaryDk: "#3730a3",
    success: "#10b981",
    danger: "#ef4444",
    border: "#e2e8f0",
    bg: "#f1f5f9",
    card: "#ffffff",
    text: "#0f172a",
    textMd: "#475569",
    textSm: "#94a3b8",
};

// ─── Shared style objects ─────────────────────────────────────────────────────
const S = {
    page: {
        minHeight: "100vh",
        background: "linear-gradient(160deg, #f8fafc 0%, #e9edf5 100%)",
        padding: "48px 20px 80px",
        fontFamily: "'Sora', 'DM Sans', -apple-system, sans-serif",
    },
    wrap: { maxWidth: 860, margin: "0 auto" },
    header: { textAlign: "center", marginBottom: 44 },
    logo: {
        display: "inline-flex", alignItems: "center",
        gap: 10, marginBottom: 20,
    },
    logoBox: {
        width: 44, height: 44, borderRadius: 12,
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: 900, color: "#fff",
    },
    logoText: { fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: 1 },
    h1: { fontSize: 32, fontWeight: 800, color: C.text, margin: "0 0 8px" },
    sub: { fontSize: 15, color: C.textMd, margin: 0 },

    stepper: {
        display: "flex", alignItems: "center",
        justifyContent: "center", gap: 0, marginBottom: 36,
    },
    stepCircle: (active, done) => ({
        width: 44, height: 44, borderRadius: "50%",
        background: done ? C.success : active ? C.primary : "#e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: done || active ? "#fff" : C.textSm,
        fontSize: 18, fontWeight: 700, transition: "all 0.3s", zIndex: 1,
        boxShadow: active ? "0 0 0 4px rgba(79,70,229,0.18)" : "none",
    }),
    stepLabel: (active, done) => ({
        fontSize: 12, fontWeight: active ? 700 : 500, textAlign: "center",
        color: active ? C.primary : done ? C.success : C.textSm,
    }),
    stepLine: (done) => ({
        position: "absolute", top: 22,
        left: "calc(50% + 22px)", width: "calc(100% - 44px)",
        height: 2, background: done ? C.success : "#e2e8f0", transition: "all 0.3s",
    }),

    card: {
        background: C.card, borderRadius: 20, padding: "40px 44px",
        boxShadow: "0 4px 32px rgba(15,23,42,0.08)",
    },
    sectionTitle: {
        fontSize: 18, fontWeight: 700, color: C.text,
        marginBottom: 24, paddingBottom: 12,
        borderBottom: "2px solid #f1f5f9",
        display: "flex", alignItems: "center", gap: 8,
    },
    divider: { borderBottom: "2px solid #f1f5f9", margin: "28px 0" },

    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 },
    gridAuto: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 20,
    },

    field: { display: "flex", flexDirection: "column", gap: 7 },
    label: { fontSize: 13, fontWeight: 600, color: "#334155" },
    req: { color: C.danger },
    input: {
        padding: "11px 14px", border: `1.5px solid ${C.border}`,
        borderRadius: 10, fontSize: 14, color: C.text, outline: "none",
        fontFamily: "inherit", background: "#f8fafc", transition: "all 0.2s",
        width: "100%", boxSizing: "border-box",
    },
    select: {
        padding: "11px 14px", border: `1.5px solid ${C.border}`,
        borderRadius: 10, fontSize: 14, color: C.text, outline: "none",
        fontFamily: "inherit", background: "#f8fafc", cursor: "pointer",
        width: "100%", boxSizing: "border-box",
    },
    textarea: {
        padding: "11px 14px", border: `1.5px solid ${C.border}`,
        borderRadius: 10, fontSize: 14, color: C.text, outline: "none",
        fontFamily: "inherit", background: "#f8fafc", resize: "vertical",
        minHeight: 90, width: "100%", boxSizing: "border-box",
    },

    fileZone: {
        border: `2px dashed ${C.border}`, borderRadius: 12,
        padding: 20, textAlign: "center", cursor: "pointer",
        background: "#f8fafc", transition: "all 0.2s",
    },
    filePreview: {
        position: "relative", width: "100%", paddingTop: "100%",
        borderRadius: 12, overflow: "hidden", border: `2px solid ${C.border}`,
    },
    fileImg: {
        position: "absolute", top: 0, left: 0,
        width: "100%", height: "100%", objectFit: "cover",
    },
    removeBtn: {
        position: "absolute", top: 8, right: 8,
        background: C.danger, border: "none", borderRadius: "50%",
        width: 28, height: 28, cursor: "pointer", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
    },

    errorBox: {
        background: "#fef2f2", border: "1px solid #fecaca",
        color: "#b91c1c", padding: "11px 16px", borderRadius: 10,
        fontSize: 13, marginBottom: 24,
        display: "flex", alignItems: "center", gap: 8,
    },
    infoBox: {
        background: "#fffbeb", border: "1.5px solid #fde68a",
        borderRadius: 12, padding: "14px 16px", marginBottom: 24,
        fontSize: 13, color: "#92400e",
        display: "flex", alignItems: "flex-start", gap: 10,
    },

    btnRow: { display: "flex", gap: 12, marginTop: 32 },
    btnPrimary: {
        flex: 1, padding: "14px 24px",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        border: "none", borderRadius: 12, color: "#fff",
        fontSize: 15, fontWeight: 700, cursor: "pointer",
        fontFamily: "inherit", transition: "all 0.2s",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    },
    btnSecondary: {
        padding: "14px 22px", background: "#f1f5f9",
        border: "none", borderRadius: 12, color: C.textMd,
        fontSize: 15, fontWeight: 600, cursor: "pointer",
        fontFamily: "inherit", transition: "all 0.2s",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    },
};

// ─── Component ────────────────────────────────────────────────────────────────
const VendorApply = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(INITIAL_FORM);
    const [files, setFiles] = useState(INITIAL_FILES);
    const [previews, setPreviews] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [submitted, setSubmitted] = useState(null);
    const [categoryList, setCategoryList] = useState([]);

    // Fetch dynamic categories
    useEffect(() => {
        api.get("/categories", { params: { type: "urbexon_hour" } })
            .then(({ data }) => {
                const cats = Array.isArray(data) ? data : data.categories || [];
                setCategoryList(cats.filter(c => c.isActive !== false).map(c => c.name));
            })
            .catch(() => { });
    }, []);

    // ── Field change ──────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.includes(".")) {
            const [parent, child] = name.split(".");
            setForm(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
        } else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
    };

    // ── File change ───────────────────────────────────────────────────────────
    const handleFileChange = (field, e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setError(`${field}: Max file size is 5MB`);
            return;
        }
        setFiles(prev => ({ ...prev, [field]: file }));
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (ev) =>
                setPreviews(prev => ({ ...prev, [field]: ev.target.result }));
            reader.readAsDataURL(file);
        } else {
            setPreviews(prev => ({ ...prev, [field]: "pdf" }));
        }
    };

    const removeFile = (field) => {
        setFiles(prev => ({ ...prev, [field]: null }));
        setPreviews(prev => ({ ...prev, [field]: null }));
    };

    // ── Step 1 validation ─────────────────────────────────────────────────────
    const validateStep1 = () => {
        if (!form.shopName.trim()) { setError("Shop name is required"); return false; }
        if (!form.shopCategory) { setError("Please select a shop category"); return false; }
        if (!form.ownerName.trim()) { setError("Owner name is required"); return false; }
        if (!form.email.trim()) { setError("Email is required"); return false; }
        if (!form.phone.trim()) { setError("Phone number is required"); return false; }
        if (!/^[6-9]\d{9}$/.test(form.phone)) {
            setError("Enter a valid 10-digit Indian phone number");
            return false;
        }
        return true;
    };

    // ── Step 2 validation ─────────────────────────────────────────────────────
    const validateStep2 = () => {
        if (!form.address.street.trim()) { setError("Street address is required"); return false; }
        if (!form.address.city.trim()) { setError("City is required"); return false; }
        if (!form.address.state.trim()) { setError("State is required"); return false; }
        if (!form.address.pincode.trim()) { setError("Pincode is required"); return false; }
        if (!/^\d{6}$/.test(form.address.pincode)) { setError("Enter a valid 6-digit pincode"); return false; }
        return true;
    };

    const goNext = () => {
        setError("");
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        setStep(s => s + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const goBack = () => {
        setError("");
        setStep(s => s - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validate step 3: require at least ownerPhoto
        if (!files.ownerPhoto) {
            setError("Owner photo is required");
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        try {
            setLoading(true);
            setError("");

            const formData = new FormData();

            // Append form fields
            Object.keys(form).forEach(key => {
                const val = form[key];
                if (typeof val === "object" && val !== null) {
                    formData.append(key, JSON.stringify(val));
                } else {
                    formData.append(key, val);
                }
            });

            // Append files
            Object.keys(files).forEach(key => {
                if (files[key]) formData.append(key, files[key]);
            });

            const res = await api.post("/vendor/register", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            // Save token — never expires
            if (res.data.token) {
                localStorage.setItem("vendorAuth", JSON.stringify({
                    token: res.data.token,
                    vendor: res.data.vendor,
                }));
            }

            setSubmitted({
                shopName: res.data.vendor?.shopName || form.shopName,
                email: form.email,
                defaultPassword: res.data.defaultPassword || form.phone,
            });
            setSuccess(true);

        } catch (err) {
            const msg = err.response?.data?.message || "Submission failed. Please try again.";
            setError(msg);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } finally {
            setLoading(false);
        }
    };

    // ── Success Screen ────────────────────────────────────────────────────────
    if (success) {
        return (
            <div style={S.page}>
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
                    @keyframes popIn {
                        from { transform: scale(0.5); opacity: 0; }
                        to   { transform: scale(1);   opacity: 1; }
                    }
                `}</style>
                <div style={S.wrap}>
                    <div style={{ ...S.card, textAlign: "center", padding: "64px 48px" }}>

                        <div style={{
                            width: 88, height: 88, borderRadius: "50%",
                            background: "linear-gradient(135deg, #10b981, #059669)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 28px",
                            boxShadow: "0 12px 40px rgba(16,185,129,0.28)",
                            animation: "popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        }}>
                            <FiCheck size={44} color="#fff" strokeWidth={3} />
                        </div>

                        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, marginBottom: 10 }}>
                            Application Submitted! 🎉
                        </h2>
                        <p style={{ fontSize: 15, color: C.textMd, marginBottom: 6 }}>
                            <strong>{submitted?.shopName}</strong> — your application is under review.
                        </p>
                        <p style={{ fontSize: 14, color: C.textSm, marginBottom: 32 }}>
                            Our team will review within <strong>24–48 hours</strong>. You'll be notified on your email.
                        </p>

                        {/* Credentials box */}
                        <div style={{
                            background: "#fffbeb", border: "1.5px solid #fde68a",
                            borderRadius: 14, padding: "20px 24px",
                            marginBottom: 32, textAlign: "left",
                        }}>
                            <div style={{
                                fontWeight: 700, color: "#92400e",
                                marginBottom: 10, fontSize: 14,
                            }}>
                                ⚠️ Your Login Credentials — Save These!
                            </div>
                            <div style={{ fontSize: 13, color: "#78350f", lineHeight: 2 }}>
                                <strong>Email:</strong> {submitted?.email}<br />
                                <strong>Password:</strong>{" "}
                                <code style={{
                                    background: "#fef3c7", padding: "2px 8px",
                                    borderRadius: 6, fontWeight: 700,
                                }}>
                                    {submitted?.defaultPassword}
                                </code><br />
                                <span style={{ color: "#a16207", fontSize: 12 }}>
                                    Please change your password after first login.
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate("/login")}
                            style={{
                                ...S.btnPrimary,
                                flex: "none", margin: "0 auto",
                                padding: "14px 48px", fontSize: 16,
                            }}
                        >
                            Go to Login →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Form ─────────────────────────────────────────────────────────────
    return (
        <div style={S.page}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
                * { box-sizing: border-box; }
                input:focus, select:focus, textarea:focus {
                    border-color: ${C.primary} !important;
                    background: #fff !important;
                    box-shadow: 0 0 0 3px rgba(79,70,229,0.12) !important;
                }
                .file-zone:hover  { border-color: ${C.primary} !important; background: #eef2ff !important; }
                .btn-p:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
                .btn-p:disabled  { opacity: 0.55; cursor: not-allowed; }
                .btn-s:hover     { background: #e2e8f0 !important; }
                @keyframes spin  { to { transform: rotate(360deg); } }
                @media (max-width: 640px) {
                    .g2, .g3 { grid-template-columns: 1fr !important; }
                    .cp       { padding: 24px 20px !important; }
                }
            `}</style>

            <div style={S.wrap}>

                {/* Header */}
                <div style={S.header}>
                    <div style={S.logo}>
                        <div style={S.logoBox}>U</div>
                        <span style={S.logoText}>URBEXON</span>
                    </div>
                    <h1 style={S.h1}>Become a Vendor</h1>
                    <p style={S.sub}>Join Urbexon and start selling to thousands of customers</p>
                </div>

                {/* Stepper */}
                <div style={S.stepper}>
                    {STEPS.map(({ label, icon: Icon }, i) => {
                        const num = i + 1;
                        const active = step === num;
                        const done = step > num;
                        return (
                            <div key={num} style={{
                                display: "flex", flexDirection: "column",
                                alignItems: "center", gap: 6,
                                flex: 1, maxWidth: 140, position: "relative",
                            }}>
                                {i < STEPS.length - 1 && (
                                    <div style={S.stepLine(done)} />
                                )}
                                <div style={S.stepCircle(active, done)}>
                                    {done
                                        ? <FiCheck size={18} strokeWidth={3} />
                                        : <Icon size={18} />
                                    }
                                </div>
                                <span style={S.stepLabel(active, done)}>{label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Error */}
                {error && (
                    <div style={S.errorBox}>
                        <FiAlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={S.card} className="cp">

                        {/* ══ STEP 1: Basic Info ══════════════════════════════ */}
                        {step === 1 && (
                            <>
                                <div style={S.sectionTitle}>
                                    <FiUser size={18} color={C.primary} />
                                    Basic Information
                                </div>

                                <div style={S.grid2} className="g2">
                                    <div style={S.field}>
                                        <label style={S.label}>Shop Name <span style={S.req}>*</span></label>
                                        <input type="text" name="shopName" value={form.shopName}
                                            onChange={handleChange} style={S.input}
                                            placeholder="E.g., Fresh Mart" />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Shop Category <span style={S.req}>*</span></label>
                                        <select name="shopCategory" value={form.shopCategory}
                                            onChange={handleChange} style={S.select}>
                                            <option value="">Select category</option>
                                            {categoryList.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ ...S.field, marginBottom: 20 }}>
                                    <label style={S.label}>Shop Description</label>
                                    <textarea name="shopDescription" value={form.shopDescription}
                                        onChange={handleChange} style={S.textarea}
                                        placeholder="Tell customers about your shop..." />
                                </div>

                                <div style={{ ...S.grid2, marginBottom: 20 }} className="g2">
                                    <div style={S.field}>
                                        <label style={S.label}>Owner Name <span style={S.req}>*</span></label>
                                        <input type="text" name="ownerName" value={form.ownerName}
                                            onChange={handleChange} style={S.input}
                                            placeholder="Your full name" />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Email <span style={S.req}>*</span></label>
                                        <input type="email" name="email" value={form.email}
                                            onChange={handleChange} style={S.input}
                                            placeholder="vendor@example.com" />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Phone <span style={S.req}>*</span></label>
                                        <input type="tel" name="phone" value={form.phone}
                                            onChange={handleChange} style={S.input}
                                            placeholder="9876543210" maxLength={10} />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>WhatsApp Number</label>
                                        <input type="tel" name="whatsapp" value={form.whatsapp}
                                            onChange={handleChange} style={S.input}
                                            placeholder="9876543210" maxLength={10} />
                                    </div>
                                </div>

                                <div style={S.divider} />

                                <div style={{ ...S.sectionTitle, borderBottom: "none", paddingBottom: 0 }}>
                                    📍 Business Address
                                </div>

                                <div style={{ ...S.field, marginBottom: 20, marginTop: 16 }}>
                                    <label style={S.label}>Street Address</label>
                                    <input type="text" name="address.street" value={form.address.street}
                                        onChange={handleChange} style={S.input}
                                        placeholder="123 Main Street" />
                                </div>

                                <div style={S.grid3} className="g3">
                                    <div style={S.field}>
                                        <label style={S.label}>City</label>
                                        <input type="text" name="address.city" value={form.address.city}
                                            onChange={handleChange} style={S.input} placeholder="Mumbai" />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>State</label>
                                        <input type="text" name="address.state" value={form.address.state}
                                            onChange={handleChange} style={S.input} placeholder="Maharashtra" />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Pincode</label>
                                        <input type="text" name="address.pincode" value={form.address.pincode}
                                            onChange={handleChange} style={S.input}
                                            placeholder="400001" maxLength={6} />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ══ STEP 2: Business Details ════════════════════════ */}
                        {step === 2 && (
                            <>
                                <div style={S.sectionTitle}>
                                    <FiBriefcase size={18} color={C.primary} />
                                    Business Details
                                </div>

                                <div style={{ ...S.grid2, marginBottom: 20 }} className="g2">
                                    <div style={S.field}>
                                        <label style={S.label}>Business Type</label>
                                        <select name="businessType" value={form.businessType}
                                            onChange={handleChange} style={S.select}>
                                            <option value="individual">Individual</option>
                                            <option value="proprietorship">Proprietorship</option>
                                            <option value="partnership">Partnership</option>
                                            <option value="pvtltd">Private Limited</option>
                                        </select>
                                    </div>

                                    {/* ✅ FIXED: values match model enum */}
                                    <div style={S.field}>
                                        <label style={S.label}>Delivery Mode</label>
                                        <select name="deliveryMode" value={form.deliveryMode}
                                            onChange={handleChange} style={S.select}>
                                            <option value="self">Self Delivery</option>
                                            <option value="platform">Platform Delivery</option>
                                            <option value="both">Both</option>
                                        </select>
                                    </div>

                                    <div style={S.field}>
                                        <label style={S.label}>
                                            GST Number{" "}
                                            <span style={{ color: C.textSm, fontWeight: 400 }}>(optional)</span>
                                        </label>
                                        <input type="text" name="gstNumber" value={form.gstNumber}
                                            onChange={handleChange} style={S.input}
                                            placeholder="22AAAAA0000A1Z5" maxLength={15} />
                                    </div>

                                    <div style={S.field}>
                                        <label style={S.label}>
                                            PAN Number{" "}
                                            <span style={{ color: C.textSm, fontWeight: 400 }}>(optional)</span>
                                        </label>
                                        <input type="text" name="panNumber" value={form.panNumber}
                                            onChange={handleChange} style={S.input}
                                            placeholder="ABCDE1234F" maxLength={10} />
                                    </div>
                                </div>

                                <div style={S.divider} />

                                <div style={{ ...S.sectionTitle, borderBottom: "none", paddingBottom: 0 }}>
                                    🏦 Bank Details{" "}
                                    <span style={{ fontSize: 13, fontWeight: 500, color: C.textSm }}>
                                        (for settlements)
                                    </span>
                                </div>

                                <div style={{ ...S.grid2, marginTop: 16 }} className="g2">
                                    <div style={S.field}>
                                        <label style={S.label}>Account Holder Name</label>
                                        <input type="text" name="bankDetails.holderName"
                                            value={form.bankDetails.holderName}
                                            onChange={handleChange} style={S.input}
                                            placeholder="As per bank records" />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Account Number</label>
                                        <input type="text" name="bankDetails.accountNumber"
                                            value={form.bankDetails.accountNumber}
                                            onChange={handleChange} style={S.input}
                                            placeholder="1234567890" />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>IFSC Code</label>
                                        <input type="text" name="bankDetails.ifsc"
                                            value={form.bankDetails.ifsc}
                                            onChange={handleChange} style={S.input}
                                            placeholder="SBIN0001234" maxLength={11} />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Bank Name</label>
                                        <input type="text" name="bankDetails.bankName"
                                            value={form.bankDetails.bankName}
                                            onChange={handleChange} style={S.input}
                                            placeholder="State Bank of India" />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ══ STEP 3: Documents ═══════════════════════════════ */}
                        {step === 3 && (
                            <>
                                <div style={S.sectionTitle}>
                                    <FiFileText size={18} color={C.primary} />
                                    Upload Documents
                                </div>

                                <div style={S.infoBox}>
                                    <span style={{ fontSize: 18 }}>ℹ️</span>
                                    <span>
                                        Upload clear photos or scans. Max 5MB per file.
                                        Accepted formats: JPG, PNG, PDF.
                                    </span>
                                </div>

                                <div style={S.gridAuto}>
                                    {[
                                        { key: "shopLogo", label: "Shop Logo" },
                                        { key: "shopBanner", label: "Shop Banner" },
                                        { key: "ownerPhoto", label: "Owner Photo" },
                                        { key: "addressProof", label: "Address Proof" },
                                        { key: "gstCertificate", label: "GST Certificate" },
                                        { key: "panCard", label: "PAN Card" },
                                        { key: "cancelledCheque", label: "Cancelled Cheque" },
                                    ].map(({ key, label }) => (
                                        <div key={key} style={S.field}>
                                            <label style={S.label}>{label}</label>

                                            {!files[key] ? (
                                                <label className="file-zone" style={S.fileZone}>
                                                    <input
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        onChange={(e) => handleFileChange(key, e)}
                                                        style={{ display: "none" }}
                                                    />
                                                    <FiUpload size={24} color={C.textSm} />
                                                    <div style={{
                                                        fontSize: 12, color: C.textSm, marginTop: 6,
                                                    }}>
                                                        Click to upload
                                                    </div>
                                                </label>
                                            ) : (
                                                <div style={S.filePreview}>
                                                    {previews[key] && previews[key] !== "pdf" ? (
                                                        <img
                                                            src={previews[key]}
                                                            alt={label}
                                                            style={S.fileImg}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            position: "absolute", inset: 0,
                                                            display: "flex", flexDirection: "column",
                                                            alignItems: "center", justifyContent: "center",
                                                            background: "#f0fdf4", gap: 6,
                                                        }}>
                                                            <FiCheck size={28} color={C.success} strokeWidth={3} />
                                                            <span style={{
                                                                fontSize: 11, color: C.success, fontWeight: 600,
                                                            }}>
                                                                {previews[key] === "pdf" ? "PDF Ready" : "Uploaded"}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(key)}
                                                        style={S.removeBtn}
                                                    >
                                                        <FiX size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ── Navigation Buttons ── */}
                        <div style={S.btnRow}>
                            {step > 1 && (
                                <button
                                    type="button"
                                    onClick={goBack}
                                    style={S.btnSecondary}
                                    className="btn-s"
                                >
                                    <FiArrowLeft size={17} /> Back
                                </button>
                            )}

                            {step < 3 ? (
                                <button
                                    type="button"
                                    onClick={goNext}
                                    style={S.btnPrimary}
                                    className="btn-p"
                                >
                                    Continue <FiArrowRight size={17} />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={S.btnPrimary}
                                    className="btn-p"
                                >
                                    {loading ? (
                                        <>
                                            <div style={{
                                                width: 16, height: 16,
                                                border: "2px solid rgba(255,255,255,0.3)",
                                                borderTopColor: "#fff", borderRadius: "50%",
                                                animation: "spin 0.7s linear infinite",
                                            }} />
                                            Submitting...
                                        </>
                                    ) : (
                                        <><FiCheck size={17} /> Submit Application</>
                                    )}
                                </button>
                            )}
                        </div>

                    </div>
                </form>
            </div>
        </div>
    );
};

export default VendorApply;