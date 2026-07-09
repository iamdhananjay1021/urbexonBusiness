/**
 * Delivery Partner Register — Urbexon V3.1
 * Full-screen split layout · Inline styles · Responsive · Production ready
 *
 * FIXES (v3.1):
 * - ✅ DOC_FIELDS keys now match fileRefs object keys AND backend multer
 *   field names (aadhaarPhoto, licensePhoto, vehicleRc, selfie). Previously
 *   "Driving License" / "Vehicle RC" / "Profile Photo" used mismatched keys
 *   that didn't exist in fileRefs, causing a crash on click:
 *   "Cannot read properties of undefined (reading 'current')".
 * - ✅ After a successful submit, calls refreshApplicationStatus("pending")
 *   so AuthContext/AppRoutes immediately reflect the new status without
 *   requiring a full reload.
 */
import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import {
    FaBolt, FaMotorcycle, FaCheckCircle,
    FaArrowLeft, FaUser, FaPhone, FaMapMarkerAlt,
    FaCar, FaCamera, FaIdCard, FaUpload,
} from "react-icons/fa";

const VEHICLE_TYPES = [
    { value: "bicycle", label: "Bicycle", emoji: "🚲" },
    { value: "scooter", label: "Scooter", emoji: "🛵" },
    { value: "motorcycle", label: "Motorcycle", emoji: "🏍️" },
    { value: "car", label: "Car", emoji: "🚗" },
    { value: "other", label: "Other", emoji: "🚚" },
];

// ✅ FIX: keys now match fileRefs object keys AND the backend's multer
// field names (aadhaarPhoto, licensePhoto, vehicleRc, selfie — see
// deliveryRoutes.js docUpload.fields(...)). Previously these keys
// ("drivingLicensePhoto", "vehicleRCPhoto", "profilePhoto") didn't exist
// in fileRefs at all, so clicking those upload buttons crashed with
// "Cannot read properties of undefined (reading 'current')" — and even
// the ones that didn't crash would have uploaded under field names the
// backend doesn't recognize.
const DOC_FIELDS = [
    { key: "aadhaarPhoto", label: "Aadhaar Card", Icon: FaIdCard, required: true, serverKey: "aadhaarPhoto" },
    { key: "licensePhoto", label: "Driving License", Icon: FaIdCard, required: false, serverKey: "licensePhoto" },
    { key: "vehicleRc", label: "Vehicle RC", Icon: FaCar, required: false, serverKey: "vehicleRc" },
    { key: "selfie", label: "Profile Photo", Icon: FaCamera, required: true, serverKey: "selfie" },
];

const S = {
    label: {
        display: "block",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "#6b7280",
        marginBottom: 7,
    },
    input: {
        width: "100%",
        padding: "13px 16px 13px 44px",
        fontSize: 15,
        color: "#111827",
        background: "#fff",
        border: "1.5px solid #e5e7eb",
        borderRadius: 12,
        outline: "none",
        fontFamily: "inherit",
        boxSizing: "border-box",
        transition: "border-color 0.18s, box-shadow 0.18s",
    },
    iconWrap: {
        position: "relative",
    },
    fieldIcon: {
        position: "absolute",
        left: 15,
        top: "50%",
        transform: "translateY(-50%)",
        color: "#9ca3af",
        pointerEvents: "none",
    },
};

const Register = () => {
    const { rider, refreshApplicationStatus } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const [name, setName] = useState(rider?.name || "");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("");
    const [vehicleType, setVehicleType] = useState("");
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [vehicleModel, setVehicleModel] = useState("");

    const [docs, setDocs] = useState({ aadhaarPhoto: null, licensePhoto: null, vehicleRc: null, selfie: null });
    const [previews, setPreviews] = useState({});

    const fileRefs = {
        aadhaarPhoto: useRef(null),
        licensePhoto: useRef(null),
        vehicleRc: useRef(null),
        selfie: useRef(null),
    };

    const handleFile = (field, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError("File size must be under 5 MB"); return; }
        setDocs(d => ({ ...d, [field]: file }));
        setPreviews(p => ({ ...p, [field]: URL.createObjectURL(file) }));
        setError("");
    };

    const validateStep1 = () => {
        if (!name.trim() || name.trim().length < 2) { setError("Name must be at least 2 characters"); return false; }
        if (!/^[6-9]\d{9}$/.test(phone.trim())) { setError("Enter a valid 10-digit phone number"); return false; }
        setError(""); return true;
    };

    const validateStep2 = () => {
        if (!vehicleType) { setError("Please select a vehicle type"); return false; }
        if (!docs.aadhaarPhoto) { setError("Aadhaar photo is required"); return false; }
        if (!docs.selfie) { setError("A selfie photo is required"); return false; }
        setError(""); return true;
    };

    const submit = async () => {
        if (!validateStep2()) return;
        setSubmitting(true); setError("");
        try {
            const fd = new FormData();
            // ✅ FIX: backend's validateBody + registerDeliveryBoy controller
            // both read req.body.name — sending "fullName" left `name` missing
            // entirely, which validateBody rejected with 400 Bad Request.
            fd.append("name", name.trim());
            fd.append("phone", phone.trim());
            fd.append("city", city.trim());
            fd.append("vehicleType", vehicleType);
            fd.append("vehicleNumber", vehicleNumber.trim());
            Object.entries(docs).forEach(([key, file]) => { if (file) fd.append(DOC_FIELDS.find(f => f.key === key)?.serverKey || key, file); });
            const { data } = await api.post("/delivery/register", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });

            // ✅ FIX: Reflect the new "pending" status immediately in AuthContext
            // so Protected routes (AppRoutes.js) don't bounce the rider back to
            // /apply on the next navigation before a refetch happens.
            refreshApplicationStatus?.(data.applicationStatus || "pending");

            setSuccess(true); setStep(3);
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed. Please try again.");
        } finally { setSubmitting(false); }
    };

    /* ─────────────────────────────────────────
       LEFT PANEL — shared across all states
    ───────────────────────────────────────── */
    const LeftPanel = () => (
        <div className="rg-split-left" style={{
            width: "40%",
            background: "linear-gradient(160deg, #064e3b 0%, #065f46 40%, #0f172a 100%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 48px",
            position: "relative",
            overflow: "hidden",
        }}>
            <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(52,211,153,0.07)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -60, left: -40, width: 220, height: 220, borderRadius: "50%", background: "rgba(16,185,129,0.05)", pointerEvents: "none" }} />

            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FaBolt size={16} style={{ color: "#34d399" }} />
                </div>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Urbexon</span>
            </div>

            {/* Middle content */}
            <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 99, padding: "5px 13px", marginBottom: 22 }}>
                    <FaMotorcycle size={12} style={{ color: "#34d399" }} />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6ee7b7", letterSpacing: "0.06em", textTransform: "uppercase" }}>Partner Application</span>
                </div>
                <h2 style={{ fontSize: 32, fontWeight: 800, color: "#fff", lineHeight: 1.18, letterSpacing: "-0.03em", marginBottom: 16 }}>
                    Start earning<br />
                    <span style={{ color: "#34d399" }}>on your terms</span>
                </h2>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, maxWidth: 280 }}>
                    Flexible hours, daily payouts, and full support from the Urbexon team.
                </p>

                {/* Perks */}
                <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 14 }}>
                    {[
                        ["✅", "Earn ₹500–₹1500 per day"],
                        ["⚡", "Fast approval within 24–48 hrs"],
                        ["🛡️", "Insurance & support included"],
                    ].map(([icon, text]) => (
                        <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 16 }}>{icon}</span>
                            <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom note */}
            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.25)", position: "relative", zIndex: 1 }}>
                Already a partner?{" "}
                <Link to="/login" style={{ color: "#6ee7b7", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
            </p>
        </div>
    );

    /* ─────────────────────────────────────────
       NOT LOGGED IN
    ───────────────────────────────────────── */
    if (!rider && !localStorage.getItem("deliveryAuth")) {
        return (
            <>
                <style>{SHARED_CSS}</style>
                <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                    <LeftPanel />
                    <div className="rg-split-right" style={{ flex: 1, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
                        <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb", padding: "40px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", animation: "rg-fadein 0.4s ease-out" }}>
                            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                                <FaMotorcycle size={22} style={{ color: "#059669" }} />
                            </div>
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8, letterSpacing: "-0.02em" }}>Sign in to apply</h2>
                            <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginBottom: 28 }}>
                                You need an Urbexon account to become a delivery partner.
                            </p>
                            <Link to="/login" style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                padding: "14px", background: "#059669", borderRadius: 12,
                                fontSize: 15, fontWeight: 700, color: "#fff", textDecoration: "none",
                            }}>
                                Sign in to continue
                            </Link>
                            <p style={{ textAlign: "center", fontSize: 13, color: "#9ca3af", marginTop: 18 }}>
                                No account?{" "}
                                <Link to="/signup" style={{ color: "#059669", fontWeight: 600, textDecoration: "none" }}>Create one free</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    /* ─────────────────────────────────────────
       SUCCESS
    ───────────────────────────────────────── */
    if (success || step === 3) {
        return (
            <>
                <style>{SHARED_CSS}</style>
                <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                    <LeftPanel />
                    <div className="rg-split-right" style={{ flex: 1, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
                        <div style={{ textAlign: "center", maxWidth: 380, animation: "rg-fadein 0.4s ease-out" }}>
                            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#ecfdf5", border: "2px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                                <FaCheckCircle size={36} style={{ color: "#059669" }} />
                            </div>
                            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#111827", marginBottom: 12, letterSpacing: "-0.025em" }}>
                                Application submitted!
                            </h2>
                            <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.8, marginBottom: 32 }}>
                                Your application is under review. You'll typically hear back within{" "}
                                <strong style={{ color: "#111827" }}>24–48 hours</strong>.
                            </p>
                            <button
                                onClick={() => navigate("/dashboard")}
                                style={{
                                    padding: "14px 32px", background: "#059669",
                                    border: "none", borderRadius: 12,
                                    fontSize: 15, fontWeight: 700, color: "#fff",
                                    cursor: "pointer", fontFamily: "inherit",
                                }}
                            >
                                Go to dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    /* ─────────────────────────────────────────
       MAIN FORM
    ───────────────────────────────────────── */
    return (
        <>
            <style>{SHARED_CSS}</style>
            <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                <LeftPanel />

                {/* Right */}
                <div className="rg-split-right" style={{
                    flex: 1,
                    background: "#f9fafb",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "40px 24px",
                    minHeight: "100vh",
                    overflowY: "auto",
                }}>
                    <div style={{ width: "100%", maxWidth: 480, animation: "rg-fadein 0.4s ease-out" }}>

                        {/* Step progress */}
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                                    Step {step} of 2 — {step === 1 ? "Personal details" : "Vehicle & documents"}
                                </span>
                                {step === 2 && (
                                    <button
                                        onClick={() => { setStep(1); setError(""); }}
                                        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", fontFamily: "inherit", fontWeight: 500 }}
                                    >
                                        <FaArrowLeft size={10} /> Back
                                    </button>
                                )}
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: 4, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: step === 1 ? "50%" : "100%", background: "#059669", borderRadius: 99, transition: "width 0.4s ease" }} />
                            </div>
                        </div>

                        {/* Form card */}
                        <div style={{
                            background: "#fff",
                            borderRadius: 20,
                            border: "1px solid #e5e7eb",
                            padding: "36px 36px 32px",
                            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                        }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

                                {/* ══ STEP 1 ══ */}
                                {step === 1 && (<>
                                    <div>
                                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.025em", marginBottom: 4 }}>Personal details</h2>
                                        <p style={{ fontSize: 13.5, color: "#9ca3af" }}>Tell us a bit about yourself</p>
                                    </div>

                                    {/* Name */}
                                    <div>
                                        <label style={S.label}>Full name</label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={{ ...S.fieldIcon, color: "#d1d5db" }} />
                                            <input
                                                style={{ ...S.input, background: "#f9fafb", color: "#9ca3af", cursor: "not-allowed" }}
                                                value={name} disabled placeholder="Your full name"
                                            />
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div>
                                        <label style={S.label}>Phone number <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaPhone size={13} style={S.fieldIcon} />
                                            <input
                                                className="rg-inp"
                                                style={S.input}
                                                value={phone}
                                                onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                                placeholder="10-digit mobile number"
                                                inputMode="numeric"
                                            />
                                        </div>
                                    </div>

                                    {/* City */}
                                    <div>
                                        <label style={S.label}>City / Area</label>
                                        <div style={S.iconWrap}>
                                            <FaMapMarkerAlt size={13} style={S.fieldIcon} />
                                            <input
                                                className="rg-inp"
                                                style={S.input}
                                                value={city}
                                                onChange={e => setCity(e.target.value)}
                                                placeholder="e.g. Lucknow, UP"
                                            />
                                        </div>
                                    </div>
                                </>)}

                                {/* ══ STEP 2 ══ */}
                                {step === 2 && (<>
                                    <div>
                                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.025em", marginBottom: 4 }}>Vehicle & documents</h2>
                                        <p style={{ fontSize: 13.5, color: "#9ca3af" }}>Almost there — just a few more details</p>
                                    </div>

                                    {/* Vehicle type */}
                                    <div>
                                        <label style={S.label}>Vehicle type <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                                            {VEHICLE_TYPES.map(v => (
                                                <button
                                                    key={v.value}
                                                    type="button"
                                                    onClick={() => setVehicleType(v.value)}
                                                    style={{
                                                        display: "flex", flexDirection: "column",
                                                        alignItems: "center", justifyContent: "center",
                                                        gap: 6, padding: "13px 4px",
                                                        borderRadius: 12, cursor: "pointer",
                                                        border: vehicleType === v.value ? "2px solid #059669" : "1.5px solid #e5e7eb",
                                                        background: vehicleType === v.value ? "#ecfdf5" : "#fff",
                                                        boxShadow: vehicleType === v.value ? "0 0 0 3px rgba(5,150,105,0.1)" : "none",
                                                        transition: "all 0.15s",
                                                        fontFamily: "inherit",
                                                    }}
                                                >
                                                    <span style={{ fontSize: 22, lineHeight: 1 }}>{v.emoji}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: vehicleType === v.value ? "#065f46" : "#6b7280" }}>{v.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Vehicle number */}
                                    <div>
                                        <label style={S.label}>Vehicle number</label>
                                        <div style={S.iconWrap}>
                                            <FaCar size={13} style={S.fieldIcon} />
                                            <input
                                                className="rg-inp"
                                                style={S.input}
                                                value={vehicleNumber}
                                                onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                                                placeholder="e.g. UP32 AB 1234"
                                            />
                                        </div>
                                    </div>

                                    {/* Vehicle model */}
                                    <div>
                                        <label style={S.label}>Vehicle model</label>
                                        <div style={S.iconWrap}>
                                            <FaCar size={13} style={S.fieldIcon} />
                                            <input
                                                className="rg-inp"
                                                style={S.input}
                                                value={vehicleModel}
                                                onChange={e => setVehicleModel(e.target.value)}
                                                placeholder="e.g. Honda Activa 6G"
                                            />
                                        </div>
                                    </div>

                                    {/* Documents */}
                                    <div>
                                        <label style={{ ...S.label, marginBottom: 10 }}>
                                            Upload documents
                                        </label>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                            {DOC_FIELDS.map(({ key, label, Icon, required }) => (
                                                <div key={key}>
                                                    <input
                                                        ref={fileRefs[key]}
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        style={{ display: "none" }}
                                                        onChange={e => handleFile(key, e)}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => fileRefs[key].current?.click()}
                                                        className="rg-doc"
                                                        style={{
                                                            width: "100%",
                                                            minHeight: 110,
                                                            borderRadius: 12,
                                                            border: docs[key] ? "2px solid #059669" : "2px dashed #d1d5db",
                                                            background: docs[key] ? "#ecfdf5" : "#fafafa",
                                                            display: "flex", flexDirection: "column",
                                                            alignItems: "center", justifyContent: "center",
                                                            gap: 7, padding: "14px 10px",
                                                            cursor: "pointer", transition: "all 0.15s",
                                                            fontFamily: "inherit",
                                                        }}
                                                    >
                                                        {previews[key] ? (
                                                            <img
                                                                src={previews[key]}
                                                                alt={label}
                                                                style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #d1fae5" }}
                                                            />
                                                        ) : (
                                                            <Icon size={22} style={{ color: docs[key] ? "#059669" : "#9ca3af" }} />
                                                        )}
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: docs[key] ? "#065f46" : "#6b7280", textAlign: "center", lineHeight: 1.45 }}>
                                                            {label}{required && <span style={{ color: "#059669" }}> *</span>}
                                                        </span>
                                                        {docs[key]
                                                            ? <span style={{ fontSize: 10.5, color: "#059669", fontWeight: 600 }}>✓ Uploaded</span>
                                                            : <span style={{ fontSize: 10, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3 }}>
                                                                <FaUpload size={8} /> Choose file
                                                            </span>
                                                        }
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>Max 5 MB per file · JPG, PNG or PDF</p>
                                    </div>
                                </>)}

                                {/* Error */}
                                {error && (
                                    <div style={{
                                        display: "flex", alignItems: "flex-start", gap: 10,
                                        background: "#fef2f2", border: "1px solid #fecaca",
                                        borderRadius: 12, padding: "13px 16px",
                                        fontSize: 13.5, color: "#dc2626", fontWeight: 500, lineHeight: 1.5,
                                    }}>
                                        <span style={{ flexShrink: 0 }}>⚠️</span> {error}
                                    </div>
                                )}

                                {/* Action button */}
                                {step === 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => validateStep1() && setStep(2)}
                                        style={{
                                            width: "100%", padding: "15px",
                                            background: "#059669", border: "none",
                                            borderRadius: 12, fontSize: 15,
                                            fontWeight: 700, color: "#fff",
                                            cursor: "pointer", fontFamily: "inherit",
                                            transition: "background 0.18s",
                                        }}
                                    >
                                        Continue →
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={submit}
                                        style={{
                                            width: "100%", padding: "15px",
                                            background: "#059669", border: "none",
                                            borderRadius: 12, fontSize: 15,
                                            fontWeight: 700, color: "#fff",
                                            cursor: submitting ? "not-allowed" : "pointer",
                                            opacity: submitting ? 0.7 : 1,
                                            fontFamily: "inherit",
                                            display: "flex", alignItems: "center",
                                            justifyContent: "center", gap: 10,
                                            transition: "opacity 0.15s",
                                        }}
                                    >
                                        {submitting ? (
                                            <>
                                                <svg style={{ animation: "rg-spin 0.7s linear infinite", width: 18, height: 18 }} viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                                                    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                                </svg>
                                                Submitting…
                                            </>
                                        ) : (
                                            <><FaCheckCircle size={15} /> Submit application</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 20 }}>
                            🔒 Your documents are encrypted and stored securely
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

const SHARED_CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @keyframes rg-spin { to { transform: rotate(360deg); } }
    @keyframes rg-fadein { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    .rg-inp:focus {
        border-color: #059669 !important;
        box-shadow: 0 0 0 4px rgba(5,150,105,0.1) !important;
    }
    .rg-inp::placeholder { color: #9ca3af; }
    .rg-doc:hover {
        border-color: #059669 !important;
        background: #f0fdf4 !important;
    }
    @media (max-width: 767px) {
        .rg-split-left { display: none !important; }
        .rg-split-right { width: 100% !important; padding: 24px 16px 48px !important; }
    }
    @media (max-width: 480px) {
        .rg-split-right > div { padding: 24px 20px 20px !important; }
    }
`;

export default Register;