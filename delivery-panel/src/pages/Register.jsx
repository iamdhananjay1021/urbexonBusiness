/**
 * Delivery Partner Register — Urbexon V4.0
 * Complete 5-step application form with all required fields
 * ✅ Step 1: Personal Details
 * ✅ Step 2: Vehicle & Documents
 * ✅ Step 3: Address Information (NEW)
 * ✅ Step 4: Bank Details (NEW)
 * ✅ Step 5: Review & Submit (NEW)
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import {
    FaBolt, FaMotorcycle, FaCheckCircle,
    FaArrowLeft, FaUser, FaPhone, FaMapMarkerAlt,
    FaCar, FaCamera, FaIdCard, FaUpload, FaHome,
} from "react-icons/fa";

const VEHICLE_TYPES = [
    { value: "bicycle", label: "Bicycle", emoji: "🚲" },
    { value: "scooter", label: "Scooter", emoji: "🛵" },
    { value: "motorcycle", label: "Motorcycle", emoji: "🏍️" },
    { value: "car", label: "Car", emoji: "🚗" },
    { value: "other", label: "Other", emoji: "🚚" },
];

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

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
    const location = useLocation();
    const redirectedRef = useRef(false);

    // Auto-redirect unauthenticated users to login (only once)
    useEffect(() => {
        if (!rider && !localStorage.getItem("deliveryAuth") && !redirectedRef.current) {
            redirectedRef.current = true;
            navigate("/login", { state: { from: "/register" }, replace: true });
        }
    }, []);

    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Step 1: Personal Details
    const [name, setName] = useState(rider?.name || "");
    const [phone, setPhone] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [gender, setGender] = useState("");

    // Step 2: Vehicle & Documents
    const [vehicleType, setVehicleType] = useState("");
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [vehicleModel, setVehicleModel] = useState("");
    const [docs, setDocs] = useState({ aadhaarPhoto: null, licensePhoto: null, vehicleRc: null, selfie: null });
    const [previews, setPreviews] = useState({});

    // Step 3: Address Details
    const [houseNumber, setHouseNumber] = useState("");
    const [landmark, setLandmark] = useState("");
    const [area, setArea] = useState("");
    const [city, setCity] = useState("");
    const [district, setDistrict] = useState("");
    const [state, setState] = useState("");
    const [pincode, setPincode] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");

    // Step 4: Bank Details
    const [accountHolder, setAccountHolder] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [ifsc, setIfsc] = useState("");
    const [upiId, setUpiId] = useState("");
    const [emergencyContactName, setEmergencyContactName] = useState("");
    const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

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

    const captureGPS = () => {
        if (!navigator.geolocation) {
            setError("GPS not available on this device");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                setLatitude(pos.coords.latitude.toFixed(6));
                setLongitude(pos.coords.longitude.toFixed(6));
                setError("");
            },
            () => setError("GPS permission denied")
        );
    };

    const validateStep1 = () => {
        if (!name.trim() || name.trim().length < 2) { setError("Name must be at least 2 characters"); return false; }
        if (!/^[6-9]\d{9}$/.test(phone.trim())) { setError("Enter a valid 10-digit phone number"); return false; }
        if (!dateOfBirth) { setError("Date of birth is required"); return false; }
        if (!gender) { setError("Please select gender"); return false; }
        setError(""); return true;
    };

    const validateStep2 = () => {
        if (!vehicleType) { setError("Please select a vehicle type"); return false; }
        if (!docs.aadhaarPhoto) { setError("Aadhaar photo is required"); return false; }
        if (!docs.selfie) { setError("A selfie photo is required"); return false; }
        setError(""); return true;
    };

    const validateStep3 = () => {
        if (!houseNumber.trim()) { setError("House/Flat number is required"); return false; }
        if (!area.trim()) { setError("Area/Locality is required"); return false; }
        if (!city.trim()) { setError("City is required"); return false; }
        if (!district.trim()) { setError("District is required"); return false; }
        if (!state) { setError("State is required"); return false; }
        if (!/^\d{6}$/.test(pincode.trim())) { setError("Enter valid 6-digit pincode"); return false; }
        if (!latitude || !longitude) { setError("GPS coordinates are required"); return false; }
        setError(""); return true;
    };

    const validateStep4 = () => {
        if (!accountHolder.trim()) { setError("Account holder name is required"); return false; }
        if (!bankName.trim()) { setError("Bank name is required"); return false; }
        if (!/^\d{9,18}$/.test(accountNumber.trim())) { setError("Enter valid account number (9-18 digits)"); return false; }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim())) { setError("Enter valid IFSC code"); return false; }
        if (!upiId.trim() || !upiId.includes("@")) { setError("Enter valid UPI ID"); return false; }
        if (!emergencyContactName.trim()) { setError("Emergency contact name is required"); return false; }
        if (!/^[6-9]\d{9}$/.test(emergencyContactPhone.trim())) { setError("Enter valid 10-digit emergency contact"); return false; }
        setError(""); return true;
    };

    const submit = async () => {
        if (!validateStep4()) return;
        setSubmitting(true); setError("");
        try {
            const fd = new FormData();
            fd.append("name", name.trim());
            fd.append("phone", phone.trim());
            fd.append("dateOfBirth", dateOfBirth);
            fd.append("gender", gender);
            fd.append("vehicleType", vehicleType);
            fd.append("vehicleNumber", vehicleNumber.trim());
            fd.append("vehicleModel", vehicleModel.trim());
            fd.append("houseNumber", houseNumber.trim());
            fd.append("landmark", landmark.trim());
            fd.append("area", area.trim());
            fd.append("city", city.trim());
            fd.append("district", district.trim());
            fd.append("state", state);
            fd.append("pincode", pincode.trim());
            fd.append("latitude", latitude);
            fd.append("longitude", longitude);
            fd.append("accountHolder", accountHolder.trim());
            fd.append("bankName", bankName.trim());
            fd.append("accountNumber", accountNumber.trim());
            fd.append("ifsc", ifsc.trim());
            fd.append("upiId", upiId.trim());
            fd.append("emergencyContactName", emergencyContactName.trim());
            fd.append("emergencyContactPhone", emergencyContactPhone.trim());
            Object.entries(docs).forEach(([key, file]) => { if (file) fd.append(DOC_FIELDS.find(f => f.key === key)?.serverKey || key, file); });

            const { data } = await api.post("/delivery/register", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
            refreshApplicationStatus?.(data.applicationStatus || "pending");
            setSuccess(true); setStep(6);
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed. Please try again.");
        } finally { setSubmitting(false); }
    };

    const LeftPanel = () => (
        <div style={{
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

            <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FaBolt size={16} style={{ color: "#34d399" }} />
                </div>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Urbexon</span>
            </div>

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

            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.25)", position: "relative", zIndex: 1 }}>
                Already a partner? <Link to="/login" style={{ color: "#6ee7b7", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
            </p>
        </div>
    );

    // Redirect is handled by useEffect above, show loading while redirecting
    if (!rider && !localStorage.getItem("deliveryAuth")) {
        return (
            <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
                <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#059669", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (success || step === 6) {
        return (
            <>
                <style>{SHARED_CSS}</style>
                <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                    <LeftPanel />
                    <div style={{ flex: 1, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
                        <div style={{ textAlign: "center", maxWidth: 380, animation: "rg-fadein 0.4s ease-out" }}>
                            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#ecfdf5", border: "2px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                                <FaCheckCircle size={36} style={{ color: "#059669" }} />
                            </div>
                            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#111827", marginBottom: 12, letterSpacing: "-0.025em" }}>
                                Application submitted!
                            </h2>
                            <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.8, marginBottom: 32 }}>
                                Your application is under review. You'll typically hear back within <strong style={{ color: "#111827" }}>24–48 hours</strong>.
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

    return (
        <>
            <style>{SHARED_CSS}</style>
            <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                <LeftPanel />

                <div style={{
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

                        {/* Progress */}
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                                    Step {step} of 5 — {step === 1 ? "Personal details" : step === 2 ? "Vehicle & documents" : step === 3 ? "Address" : step === 4 ? "Bank details" : "Review"}
                                </span>
                                {step > 1 && (
                                    <button
                                        onClick={() => { setStep(step - 1); setError(""); }}
                                        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", fontFamily: "inherit", fontWeight: 500 }}
                                    >
                                        <FaArrowLeft size={10} /> Back
                                    </button>
                                )}
                            </div>
                            <div style={{ height: 4, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${(step / 5) * 100}%`, background: "#059669", borderRadius: 99, transition: "width 0.4s ease" }} />
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

                                {/* STEP 1 */}
                                {step === 1 && (<>
                                    <div>
                                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.025em", marginBottom: 4 }}>Personal details</h2>
                                        <p style={{ fontSize: 13.5, color: "#9ca3af" }}>Tell us about yourself</p>
                                    </div>

                                    <div>
                                        <label style={S.label}>Full name</label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={{ ...S.fieldIcon, color: "#d1d5db" }} />
                                            <input style={{ ...S.input, background: "#f9fafb", color: "#9ca3af", cursor: "not-allowed" }} value={name} disabled />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Phone number <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaPhone size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" inputMode="numeric" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Date of birth <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={S.fieldIcon} />
                                            <input style={S.input} type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Gender <span style={{ color: "#059669" }}>*</span></label>
                                        <select style={{ ...S.input, paddingLeft: 44 }} value={gender} onChange={e => setGender(e.target.value)}>
                                            <option value="">Select gender</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </>)}

                                {/* STEP 2 */}
                                {step === 2 && (<>
                                    <div>
                                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.025em", marginBottom: 4 }}>Vehicle & documents</h2>
                                        <p style={{ fontSize: 13.5, color: "#9ca3af" }}>Details about your vehicle</p>
                                    </div>

                                    <div>
                                        <label style={S.label}>Vehicle type <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                                            {VEHICLE_TYPES.map(v => (
                                                <button key={v.value} type="button" onClick={() => setVehicleType(v.value)} style={{
                                                    display: "flex", flexDirection: "column",
                                                    alignItems: "center", justifyContent: "center",
                                                    gap: 6, padding: "13px 4px",
                                                    borderRadius: 12, cursor: "pointer",
                                                    border: vehicleType === v.value ? "2px solid #059669" : "1.5px solid #e5e7eb",
                                                    background: vehicleType === v.value ? "#ecfdf5" : "#fff",
                                                    boxShadow: vehicleType === v.value ? "0 0 0 3px rgba(5,150,105,0.1)" : "none",
                                                    transition: "all 0.15s",
                                                    fontFamily: "inherit",
                                                }}>
                                                    <span style={{ fontSize: 22, lineHeight: 1 }}>{v.emoji}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: vehicleType === v.value ? "#065f46" : "#6b7280" }}>{v.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Vehicle number</label>
                                        <div style={S.iconWrap}>
                                            <FaCar size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value.toUpperCase())} placeholder="e.g. UP32 AB 1234" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Vehicle model</label>
                                        <div style={S.iconWrap}>
                                            <FaCar size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} placeholder="e.g. Honda Activa 6G" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ ...S.label, marginBottom: 10 }}>Upload documents</label>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                            {DOC_FIELDS.map(({ key, label, Icon, required }) => (
                                                <div key={key}>
                                                    <input ref={fileRefs[key]} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => handleFile(key, e)} />
                                                    <button type="button" onClick={() => fileRefs[key].current?.click()} style={{
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
                                                    }}>
                                                        {previews[key] ? (
                                                            <img src={previews[key]} alt={label} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #d1fae5" }} />
                                                        ) : (
                                                            <Icon size={22} style={{ color: docs[key] ? "#059669" : "#9ca3af" }} />
                                                        )}
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: docs[key] ? "#065f46" : "#6b7280", textAlign: "center" }}>
                                                            {label}{required && <span style={{ color: "#059669" }}> *</span>}
                                                        </span>
                                                        {docs[key] ? <span style={{ fontSize: 10.5, color: "#059669", fontWeight: 600 }}>✓ Uploaded</span> : <span style={{ fontSize: 10, color: "#9ca3af" }}><FaUpload size={8} /> Choose</span>}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>)}

                                {/* STEP 3: ADDRESS */}
                                {step === 3 && (<>
                                    <div>
                                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.025em", marginBottom: 4 }}>Address details</h2>
                                        <p style={{ fontSize: 13.5, color: "#9ca3af" }}>Where you operate from</p>
                                    </div>

                                    <div>
                                        <label style={S.label}>House/Flat number <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaHome size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={houseNumber} onChange={e => setHouseNumber(e.target.value)} placeholder="e.g. 123, ABC Apartment" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Landmark/Building name</label>
                                        <div style={S.iconWrap}>
                                            <FaMapMarkerAlt size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="e.g. Near City Center" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Area/Colony/Locality <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaMapMarkerAlt size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Gomti Nagar" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>City <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaMapMarkerAlt size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Lucknow" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>District <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaMapMarkerAlt size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={district} onChange={e => setDistrict(e.target.value)} placeholder="e.g. Lucknow" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>State <span style={{ color: "#059669" }}>*</span></label>
                                        <select style={{ ...S.input, paddingLeft: 44 }} value={state} onChange={e => setState(e.target.value)}>
                                            <option value="">Select state</option>
                                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={S.label}>Pincode <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaMapMarkerAlt size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" inputMode="numeric" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>GPS Location <span style={{ color: "#059669" }}>*</span></label>
                                        <button type="button" onClick={captureGPS} style={{
                                            width: "100%", padding: "12px", background: "#ecfdf5", border: "1.5px solid #059669",
                                            borderRadius: 12, fontSize: 14, fontWeight: 700, color: "#059669", cursor: "pointer", fontFamily: "inherit"
                                        }}>
                                            📍 Capture GPS Location
                                        </button>
                                        {latitude && longitude && (
                                            <p style={{ fontSize: 12, color: "#059669", marginTop: 8 }}>✓ GPS: {latitude}, {longitude}</p>
                                        )}
                                    </div>
                                </>)}

                                {/* STEP 4: BANK & EMERGENCY */}
                                {step === 4 && (<>
                                    <div>
                                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.025em", marginBottom: 4 }}>Bank & Emergency</h2>
                                        <p style={{ fontSize: 13.5, color: "#9ca3af" }}>Payment and emergency details</p>
                                    </div>

                                    <div>
                                        <label style={S.label}>Account holder name <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={accountHolder} onChange={e => setAccountHolder(e.target.value)} placeholder="Name as per bank account" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Bank name <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. State Bank of India" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Account number <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="9-18 digits" inputMode="numeric" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>IFSC code <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="e.g. SBIN0000001" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>UPI ID <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={upiId} onChange={e => setUpiId(e.target.value.toLowerCase())} placeholder="e.g. yourname@upi" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Emergency contact name <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaUser size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} placeholder="Family member or friend" />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={S.label}>Emergency contact phone <span style={{ color: "#059669" }}>*</span></label>
                                        <div style={S.iconWrap}>
                                            <FaPhone size={13} style={S.fieldIcon} />
                                            <input style={S.input} value={emergencyContactPhone} onChange={e => setEmergencyContactPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" inputMode="numeric" />
                                        </div>
                                    </div>
                                </>)}

                                {/* STEP 5: REVIEW */}
                                {step === 5 && (<>
                                    <div>
                                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.025em", marginBottom: 4 }}>Review your details</h2>
                                        <p style={{ fontSize: 13.5, color: "#9ca3af" }}>Please verify before submitting</p>
                                    </div>

                                    <div style={{ background: "#f9fafb", padding: 16, borderRadius: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                                        <div><strong>Name:</strong> {name}</div>
                                        <div><strong>Phone:</strong> {phone}</div>
                                        <div><strong>DOB:</strong> {dateOfBirth}</div>
                                        <div><strong>Gender:</strong> {gender}</div>
                                        <div><strong>Vehicle:</strong> {vehicleType}</div>
                                        <div><strong>Number:</strong> {vehicleNumber}</div>
                                        <div colSpan={2}><strong>Address:</strong> {houseNumber}, {area}, {city}, {state} - {pincode}</div>
                                        <div><strong>Bank:</strong> {bankName}</div>
                                        <div><strong>Account:</strong> ****{accountNumber.slice(-4)}</div>
                                        <div><strong>UPI:</strong> {upiId}</div>
                                        <div><strong>Emergency:</strong> {emergencyContactName} ({emergencyContactPhone})</div>
                                    </div>

                                    <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 12, borderRadius: 12, fontSize: 13, color: "#065f46" }}>
                                        ✓ All required fields are completed and ready for submission.
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

                                {/* Buttons */}
                                {step < 5 ? (
                                    <button type="button" onClick={() => {
                                        if (step === 1 && !validateStep1()) return;
                                        if (step === 2 && !validateStep2()) return;
                                        if (step === 3 && !validateStep3()) return;
                                        setStep(step + 1);
                                    }} style={{
                                        width: "100%", padding: "15px",
                                        background: "#059669", border: "none",
                                        borderRadius: 12, fontSize: 15,
                                        fontWeight: 700, color: "#fff",
                                        cursor: "pointer", fontFamily: "inherit",
                                    }}>
                                        Continue →
                                    </button>
                                ) : (
                                    <button type="button" disabled={submitting} onClick={submit} style={{
                                        width: "100%", padding: "15px",
                                        background: "#059669", border: "none",
                                        borderRadius: 12, fontSize: 15,
                                        fontWeight: 700, color: "#fff",
                                        cursor: submitting ? "not-allowed" : "pointer",
                                        opacity: submitting ? 0.7 : 1,
                                        fontFamily: "inherit",
                                        display: "flex", alignItems: "center",
                                        justifyContent: "center", gap: 10,
                                    }}>
                                        {submitting ? (
                                            <>
                                                <svg style={{ animation: "rg-spin 0.7s linear infinite", width: 18, height: 18 }} viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                                                    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                                </svg>
                                                Submitting…
                                            </>
                                        ) : (
                                            <><FaCheckCircle size={15} /> Submit Application</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 20 }}>
                            🔒 Your data is encrypted and stored securely
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
`;

export default Register;
