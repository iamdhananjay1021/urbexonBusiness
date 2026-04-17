import { useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
    FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash,
    FaPhone, FaStore, FaMotorcycle, FaArrowLeft
} from "react-icons/fa";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import { getFirebaseAuth, isFirebaseConfigured } from "../config/firebase";
import { signInWithPopup } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";

const PHONE_REGEX = /^[6-9]\d{9}$/;

const STRENGTH_CONFIG = {
    weak: { color: "#ef4444", label: "Too short", width: "33%" },
    medium: { color: "#f59e0b", label: "Medium", width: "66%" },
    strong: { color: "#10b981", label: "Strong", width: "100%" },
};

const ROLES = [
    { value: "user", label: "Customer", icon: <FaUser size={14} />, desc: "Shop & buy products" },
    { value: "vendor", label: "Sell on Urbexon", icon: <FaStore size={14} />, desc: "List & sell your products" },
    { value: "delivery_boy", label: "Delivery Partner", icon: <FaMotorcycle size={14} />, desc: "Earn by delivering orders" },
];

const S = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box}
.rg-root{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;background:#f7f3eb;position:relative;overflow:hidden;font-family:'DM Sans',sans-serif}
.rg-root::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 120% 80% at 50% -20%,rgba(201,168,76,0.08) 0%,transparent 60%),radial-gradient(ellipse 60% 60% at 100% 100%,rgba(26,23,64,0.04) 0%,transparent 60%)}
.rg-card{position:relative;width:100%;max-width:440px;background:#fff;border:1px solid rgba(201,168,76,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.04)}
.rg-top{background:#1a1740;padding:28px 32px;text-align:center;position:relative}
.rg-brand{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:700;color:#c9a84c;letter-spacing:6px;text-transform:uppercase;margin:0}
.rg-brand-sub{font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:4px;text-transform:uppercase;margin:6px 0 0}
.rg-back{position:absolute;left:16px;top:50%;transform:translateY(-50%);background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:#c9a84c;cursor:pointer;transition:all 0.2s;text-decoration:none}
.rg-back:hover{background:rgba(201,168,76,0.25);border-color:rgba(201,168,76,0.5)}
.rg-body{padding:28px 32px}
.rg-title{font-size:18px;font-weight:700;color:#1a1740;margin:0 0 4px}
.rg-sub{font-size:12px;color:#94a3b8;margin:0 0 22px;letter-spacing:0.3px}
.rg-role-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:22px}
.rg-role{cursor:pointer;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 6px;text-align:center;background:#fafafe;transition:all 0.2s;display:flex;flex-direction:column;align-items:center;gap:5px}
.rg-role:hover{border-color:#c9a84c;background:#fffcf5}
.rg-role.active{border-color:#c9a84c;background:#fffcf5;box-shadow:0 0 0 3px rgba(201,168,76,0.1)}
.rg-role-ic{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#f7f3eb;color:#1a1740;transition:all 0.2s}
.rg-role.active .rg-role-ic{background:#1a1740;color:#c9a84c}
.rg-role-name{font-size:10px;font-weight:700;color:#1a1740;letter-spacing:0.3px}
.rg-role-desc{font-size:8.5px;color:#94a3b8;line-height:1.3}
.rg-field{margin-bottom:18px}
.rg-label{display:block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:8px}
.rg-inp-wrap{position:relative}
.rg-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;transition:color 0.2s;display:flex}
.rg-inp-wrap:focus-within .rg-icon{color:#c9a84c}
.rg-inp{width:100%;padding:13px 13px 13px 42px;border:1.5px solid #e2e8f0;background:#fafafe;color:#1e293b;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:all 0.2s;box-sizing:border-box}
.rg-inp:focus{border-color:#c9a84c;background:#fff;box-shadow:0 0 0 3px rgba(201,168,76,0.08)}
.rg-inp::placeholder{color:#c4c9d2;font-size:13px}
.rg-prefix{position:absolute;left:42px;top:50%;transform:translateY(-50%);font-size:13px;font-weight:600;color:#94a3b8;pointer-events:none}
.rg-inp-phone{padding-left:76px !important}
.rg-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:4px;transition:color 0.2s;display:flex}
.rg-eye:hover{color:#1a1740}
.rg-str-bar{height:3px;background:#f1f5f9;border-radius:2px;margin-top:8px;overflow:hidden}
.rg-str-fill{height:100%;border-radius:2px;transition:width 0.4s ease,background-color 0.4s ease}
.rg-str-label{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-top:5px;font-weight:600}
.rg-hint{font-size:11px;letter-spacing:0.5px;margin-top:5px;font-weight:500}
.rg-hint-warn{color:#d97706}.rg-hint-error{color:#ef4444}.rg-hint-ok{color:#059669}
.rg-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:11px 14px;font-size:12.5px;margin-bottom:18px;display:flex;gap:8px;align-items:flex-start}
.rg-ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#065f46;padding:11px 14px;font-size:12.5px;margin-bottom:18px;display:flex;gap:8px;align-items:flex-start}
.rg-btn{width:100%;padding:15px;background:#1a1740;border:none;color:#c9a84c;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;cursor:pointer;transition:all 0.25s;margin-top:4px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px}
.rg-btn::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.15),transparent);transition:left 0.5s}
.rg-btn:hover:not(:disabled)::before{left:100%}
.rg-btn:hover:not(:disabled){background:#252060;box-shadow:0 8px 24px rgba(26,23,64,0.25)}
.rg-btn:disabled{opacity:0.5;cursor:not-allowed}
.rg-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);margin:22px 0}
.rg-foot{font-size:12px;color:#94a3b8;text-align:center}
.rg-link{color:#1a1740;font-weight:600;text-decoration:none;transition:color 0.2s}
.rg-link:hover{color:#c9a84c}
.rg-spin{width:16px;height:16px;border:2px solid rgba(201,168,76,0.3);border-top-color:#c9a84c;border-radius:50%;animation:rsp 0.7s linear infinite;display:inline-block}
@keyframes rsp{to{transform:rotate(360deg)}}
.rg-or{display:flex;align-items:center;gap:12px;margin:20px 0;font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase}
.rg-or::before,.rg-or::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent)}
.rg-google{width:100%;padding:13px;background:#fff;border:1.5px solid #e2e8f0;color:#374151;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.2s}
.rg-google:hover:not(:disabled){border-color:#c9a84c;box-shadow:0 4px 12px rgba(0,0,0,0.08)}
.rg-google:disabled{opacity:0.5;cursor:not-allowed}
.rg-otp-inp{width:100%;padding:18px;border:1.5px solid #e2e8f0;background:#fafafe;color:#1a1740;font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:600;text-align:center;letter-spacing:14px;outline:none;transition:all 0.2s;box-sizing:border-box}
.rg-otp-inp:focus{border-color:#c9a84c;background:#fff;box-shadow:0 0 0 3px rgba(201,168,76,0.08)}
.rg-otp-inp::placeholder{color:#c4c9d2;letter-spacing:8px;font-size:24px}
.rg-otp-notice{background:#fffcf5;border:1px solid rgba(201,168,76,0.2);padding:10px 14px;font-size:11.5px;color:#92400e;text-align:center;margin-bottom:20px}
.rg-otp-email{text-align:center;font-size:14px;font-weight:600;color:#1a1740;margin-bottom:18px}
.rg-link-btn{color:#1a1740;font-weight:600;text-decoration:none;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;font-size:inherit;transition:color 0.2s;padding:0}
.rg-link-btn:hover{color:#c9a84c}
.rg-link-btn:disabled{opacity:0.4;cursor:not-allowed}
`;

const AlertBox = ({ type, children }) => (
    <div className={type === "error" ? "rg-err" : "rg-ok"}>
        <span>{type === "error" ? "◆" : "✓"}</span>
        <span>{children}</span>
    </div>
);

const Register = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { loginWithData } = useAuth();
    const from = location.state?.from;

    const redirectAfterAuth = useCallback((data) => {
        loginWithData(data);
        if (data.role === "vendor") {
            window.location.href = (import.meta.env.VITE_VENDOR_URL || "http://localhost:5175") + "/dashboard";
        } else if (data.role === "delivery_boy") {
            window.location.href = (import.meta.env.VITE_DELIVERY_URL || "http://localhost:5176") + "/dashboard";
        } else if (from) {
            navigate(from, { replace: true });
        } else {
            navigate("/", { replace: true });
        }
    }, [loginWithData, navigate, from]);

    const [step, setStep] = useState("register");
    const [selectedRole, setSelectedRole] = useState("user");
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
    const [otp, setOtp] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [googleLoading, setGoogleLoading] = useState(false);

    const onChange = useCallback((e) => {
        const { name, value } = e.target;
        if (name === "phone" && !/^\d*$/.test(value)) return;
        setForm(prev => ({ ...prev, [name]: value }));
        setError("");
    }, []);

    const togglePassword = useCallback(() => setShowPassword(s => !s), []);
    const handleOtpChange = useCallback((e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }, []);
    const goBackToRegister = useCallback(() => { setStep("register"); setError(""); setOtp(""); }, []);

    const submitHandler = useCallback(async (e) => {
        e.preventDefault();
        const { name, email, phone, password } = form;
        if (!name || !email || !phone || !password) return setError("All fields are required");
        if (!PHONE_REGEX.test(phone)) return setError("Enter a valid 10-digit Indian mobile number");
        if (password.length < 8) return setError("Password must be at least 8 characters");
        try {
            setLoading(true); setError("");
            await api.post("/auth/register", { name: name.trim(), email: email.trim(), phone: phone.trim(), password, role: selectedRole });
            setStep("otp");
        } catch (err) {
            setError(err?.response?.data?.message || "Registration failed");
        } finally { setLoading(false); }
    }, [form, selectedRole]);

    const verifyOtp = useCallback(async (e) => {
        e.preventDefault();
        if (!otp.trim() || otp.length !== 6) return setError("Enter valid 6-digit OTP");
        try {
            setLoading(true); setError("");
            const { data } = await api.post("/auth/verify-otp", { email: form.email.trim(), otp: otp.trim() });
            redirectAfterAuth(data);
        } catch (err) {
            setError(err?.response?.data?.message || "Invalid or expired OTP");
        } finally { setLoading(false); }
    }, [otp, form.email, redirectAfterAuth]);

    const resendOtp = useCallback(async () => {
        try {
            setResendLoading(true); setError("");
            await api.post("/auth/resend-otp", { email: form.email.trim() });
            setSuccess("OTP resent successfully!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to resend OTP");
        } finally { setResendLoading(false); }
    }, [form.email]);

    const handleGoogleSignup = useCallback(async () => {
        try {
            setGoogleLoading(true); setError("");
            const { auth, googleProvider } = getFirebaseAuth();
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();
            const { data } = await api.post("/auth/google", { idToken, role: selectedRole });
            redirectAfterAuth(data);
        } catch (err) {
            if (err?.code === "auth/popup-closed-by-user") return;
            setError(err?.response?.data?.message || err?.message || "Google sign-up failed");
        } finally { setGoogleLoading(false); }
    }, [selectedRole, redirectAfterAuth]);

    const passwordStrength = useMemo(() => {
        const len = form.password.length;
        if (len === 0) return null;
        if (len < 8) return "weak";
        if (len < 12) return "medium";
        return "strong";
    }, [form.password]);

    const passwordInvalid = useMemo(
        () => form.password.length > 0 && form.password.length < 8,
        [form.password]
    );

    const phoneHint = useMemo(() => {
        const { phone } = form;
        if (!phone.length) return null;
        if (phone.length < 10) return <p className="rg-hint rg-hint-warn">{10 - phone.length} more digits needed</p>;
        if (!PHONE_REGEX.test(phone)) return <p className="rg-hint rg-hint-error">Must start with 6, 7, 8 or 9</p>;
        return <p className="rg-hint rg-hint-ok">✓ &nbsp;Valid number</p>;
    }, [form.phone]);

    return (
        <div className="rg-root">
            <style>{S}</style>
            <div className="rg-card">
                <div className="rg-top">
                    <button className="rg-back" onClick={() => navigate(-1)} title="Go back">
                        <FaArrowLeft size={13} />
                    </button>
                    <div className="rg-brand">Urbexon</div>
                    <div className="rg-brand-sub">Explore the unknown</div>
                </div>
                <div className="rg-body">
                    {step === "register" ? (
                        <>
                            <div className="rg-title">Create Account</div>
                            <div className="rg-sub">Choose your role to get started</div>

                            {/* Role Selector */}
                            <div className="rg-role-grid">
                                {ROLES.map(r => (
                                    <div
                                        key={r.value}
                                        className={`rg-role ${selectedRole === r.value ? "active" : ""}`}
                                        onClick={() => setSelectedRole(r.value)}
                                    >
                                        <div className="rg-role-ic">{r.icon}</div>
                                        <div className="rg-role-name">{r.label}</div>
                                        <div className="rg-role-desc">{r.desc}</div>
                                    </div>
                                ))}
                            </div>

                            {error && <AlertBox type="error">{error}</AlertBox>}

                            <form onSubmit={submitHandler}>
                                <div className="rg-field">
                                    <label className="rg-label">Full Name</label>
                                    <div className="rg-inp-wrap">
                                        <span className="rg-icon"><FaUser size={12} /></span>
                                        <input name="name" type="text" placeholder="e.g. Rahul Verma"
                                            value={form.name} onChange={onChange} className="rg-inp" />
                                    </div>
                                </div>

                                <div className="rg-field">
                                    <label className="rg-label">Email Address</label>
                                    <div className="rg-inp-wrap">
                                        <span className="rg-icon"><FaEnvelope size={12} /></span>
                                        <input name="email" type="email" placeholder="your@email.com"
                                            value={form.email} onChange={onChange} className="rg-inp" />
                                    </div>
                                </div>

                                <div className="rg-field">
                                    <label className="rg-label">Mobile Number</label>
                                    <div className="rg-inp-wrap">
                                        <span className="rg-icon"><FaPhone size={12} /></span>
                                        <span className="rg-prefix">+91</span>
                                        <input name="phone" type="tel" inputMode="numeric"
                                            maxLength={10} placeholder="9876543210"
                                            value={form.phone} onChange={onChange}
                                            className="rg-inp rg-inp-phone" />
                                    </div>
                                    {phoneHint}
                                </div>

                                <div className="rg-field">
                                    <label className="rg-label">Password</label>
                                    <div className="rg-inp-wrap">
                                        <span className="rg-icon"><FaLock size={12} /></span>
                                        <input name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Min. 8 characters"
                                            value={form.password} onChange={onChange}
                                            style={{ paddingRight: 44 }}
                                            className="rg-inp" />
                                        <button type="button" onClick={togglePassword} className="rg-eye">
                                            {showPassword ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                                        </button>
                                    </div>
                                    {passwordStrength && (
                                        <>
                                            <div className="rg-str-bar">
                                                <div className="rg-str-fill" style={{
                                                    width: STRENGTH_CONFIG[passwordStrength].width,
                                                    backgroundColor: STRENGTH_CONFIG[passwordStrength].color,
                                                }} />
                                            </div>
                                            <div className="rg-str-label" style={{ color: STRENGTH_CONFIG[passwordStrength].color }}>
                                                {STRENGTH_CONFIG[passwordStrength].label}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button type="submit" disabled={loading || passwordInvalid} className="rg-btn">
                                    {loading ? <><span className="rg-spin" /> Sending OTP</> : "Continue →"}
                                </button>
                            </form>

                            {isFirebaseConfigured() && (
                                <>
                                    <div className="rg-or">or</div>
                                    <button className="rg-google" onClick={handleGoogleSignup} disabled={googleLoading}>
                                        {googleLoading ? <span className="rg-spin" /> : <FcGoogle size={18} />}
                                        {googleLoading ? "Signing up..." : "Sign up with Google"}
                                    </button>
                                </>
                            )}

                            <div className="rg-divider" />
                            <div className="rg-foot">
                                Already a member?&nbsp;&nbsp;
                                <Link to="/login" state={{ from }} className="rg-link">Sign In →</Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="rg-title">Verify Identity</div>
                            <div className="rg-sub">OTP sent to {form.email}</div>

                            <div className="rg-otp-notice">◆ &nbsp;Check your spam / junk folder if not received</div>

                            {error && <AlertBox type="error">{error}</AlertBox>}
                            {success && <AlertBox type="success">{success}</AlertBox>}

                            <form onSubmit={verifyOtp}>
                                <div className="rg-field">
                                    <label className="rg-label" style={{ textAlign: "center", display: "block" }}>Enter 6-digit code</label>
                                    <input type="text" inputMode="numeric" maxLength={6}
                                        value={otp} onChange={handleOtpChange}
                                        placeholder="· · · · · ·"
                                        className="rg-otp-inp" />
                                </div>
                                <button type="submit" disabled={loading} className="rg-btn">
                                    {loading ? <><span className="rg-spin" /> Verifying</> : "Confirm & Enter →"}
                                </button>
                            </form>

                            <div className="rg-divider" />
                            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10 }}>
                                <p className="rg-foot">
                                    Didn't receive it?&nbsp;&nbsp;
                                    <button onClick={resendOtp} disabled={resendLoading} className="rg-link-btn">
                                        {resendLoading ? "Sending..." : "Resend Code"}
                                    </button>
                                </p>
                                <button onClick={goBackToRegister} className="rg-link-btn"
                                    style={{ fontSize: 10, letterSpacing: 2, color: "#94a3b8" }}>
                                    ← Change Details
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Register;
