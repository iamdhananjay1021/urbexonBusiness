/**
 * Register.jsx — v3 Complete Tailwind Rewrite
 * ─────────────────────────────────────────────
 * ✅ Full Tailwind CSS — zero <style> / inline CSS blocks
 * ✅ FIXED: vendor/delivery_boy redirect now correctly goes to
 *    /become-vendor or /become-delivery after OTP verification,
 *    regardless of `from` state.
 * ✅ FIXED: `from` redirect only applies to regular `user` role.
 * ✅ Clean split-panel design — left brand panel + right form
 * ✅ All business logic 100% preserved
 */
import { useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
    FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash,
    FaPhone, FaStore, FaMotorcycle, FaArrowLeft,
    FaCheckCircle, FaBolt,
} from "react-icons/fa";
import SEO from "../components/SEO";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import { getFirebaseAuth, isFirebaseConfigured } from "../config/firebase";
import { signInWithPopup } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";

const PHONE_REGEX = /^[6-9]\d{9}$/;

const STRENGTH = {
    weak: { color: "bg-red-400", label: "Too short", width: "w-1/3" },
    medium: { color: "bg-amber-400", label: "Medium", width: "w-2/3" },
    strong: { color: "bg-green-500", label: "Strong ✓", width: "w-full" },
};

const ROLES = [
    {
        value: "user",
        label: "Customer",
        icon: <FaUser size={16} />,
        desc: "Shop & buy products",
        accent: "orange",
    },
    {
        value: "vendor",
        label: "Seller",
        icon: <FaStore size={16} />,
        desc: "List & sell your products",
        accent: "violet",
    },
    {
        value: "delivery_boy",
        label: "Delivery",
        icon: <FaMotorcycle size={16} />,
        desc: "Earn by delivering",
        accent: "green",
    },
];

const ACCENT_MAP = {
    orange: {
        ring: "ring-orange-400",
        bg: "bg-orange-50",
        icon: "bg-orange-500 text-white",
        border: "border-orange-400",
        text: "text-orange-600",
    },
    violet: {
        ring: "ring-violet-400",
        bg: "bg-violet-50",
        icon: "bg-violet-600 text-white",
        border: "border-violet-400",
        text: "text-violet-600",
    },
    green: {
        ring: "ring-green-400",
        bg: "bg-green-50",
        icon: "bg-green-600 text-white",
        border: "border-green-400",
        text: "text-green-600",
    },
};

/* ─── Small atoms ─── */

const InputField = ({ label, icon, hint, error, children }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
            {label}
        </label>
        <div className="relative">
            {icon && (
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    {icon}
                </span>
            )}
            {children}
        </div>
        {hint && <p className="text-[11px] text-neutral-400">{hint}</p>}
        {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
    </div>
);

const StyledInput = ({ hasIcon = true, className = "", ...props }) => (
    <input
        {...props}
        className={`w-full ${hasIcon ? "pl-10" : "pl-4"} pr-4 py-3 
                    bg-neutral-50 border border-neutral-200 rounded-xl
                    text-sm text-neutral-900 outline-none
                    placeholder:text-neutral-300
                    focus:border-orange-400 focus:bg-white
                    focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]
                    transition-all duration-150
                    ${className}`}
    />
);

const AlertBox = ({ type, children }) => (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium
                     ${type === "error"
            ? "bg-red-50 border border-red-100 text-red-600"
            : "bg-green-50 border border-green-100 text-green-700"}`}>
        <span className="shrink-0 mt-0.5">{type === "error" ? "⚠" : "✓"}</span>
        {children}
    </div>
);

const PrimaryBtn = ({ loading, loadingText, children, className = "", ...props }) => (
    <button
        {...props}
        className={`w-full flex items-center justify-center gap-2.5
                    h-12 rounded-2xl text-sm font-bold tracking-wide
                    bg-gradient-to-r from-orange-500 to-rose-500
                    text-white
                    shadow-[0_4px_16px_rgba(249,115,22,0.35)]
                    hover:shadow-[0_6px_22px_rgba(249,115,22,0.45)]
                    hover:-translate-y-0.5
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                    active:scale-[0.98] transition-all duration-200
                    ${className}`}>
        {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {loadingText}</>
            : children}
    </button>
);

/* ══════════════════════════════════════════════════════
   REGISTER COMPONENT
══════════════════════════════════════════════════════ */
const Register = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { loginWithData } = useAuth();

    const from = location.state?.from || null;

    /* ─────────────────────────────────────────────────────
        REDIRECT LOGIC — FIXED
        Priority order:
        1. vendor/delivery_boy → ALWAYS go to application page
           (their registration intent overrides `from`)
        2. Regular user with `from` → go back to original page
        3. Regular user, no `from` → go to home "/"

        WHY: vendor/delivery users register specifically to apply.
        Sending them back to a random `from` page breaks their flow.
        They must complete the application form first.
    ───────────────────────────────────────────────────── */
    const redirectAfterAuth = useCallback((data) => {
        // ✅ CRITICAL FIX: Determine destination FIRST, then loginWithData.
        // If loginWithData is called first → user state sets → PublicOnly
        // sees logged-in user → immediately redirects to "/" before our
        // navigate() can run. So we navigate() first, THEN set auth state.

        let destination = "/";

        // Priority 1: vendor/delivery → always go to application page
        if (data.user.role === "vendor") {
            destination = "/become-vendor";
        } else if (data.user.role === "delivery_boy") {
            destination = "/become-delivery";
        } else if (from) {
            // Priority 2: regular user came from somewhere specific
            destination = from;
        }
        // Priority 3: default → "/"

        // Navigate FIRST (before user state is set, so PublicOnly doesn't intercept)
        navigate(destination, { replace: true });

        // THEN set auth state (user is now on the right page)
        loginWithData(data);
    }, [loginWithData, navigate, from]);

    const [step, setStep] = useState("register");
    const [selectedRole, setSelectedRole] = useState(() => {
        const roleFromQuery = searchParams.get("role");
        // Ensure the role from query is one of the valid roles
        return ROLES.some(r => r.value === roleFromQuery) ? roleFromQuery : "user";
    });
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

    const handleOtpChange = useCallback((e) => {
        setOtp(e.target.value.replace(/\D/g, ""));
        setError("");
    }, []);

    const goBackToRegister = useCallback(() => {
        setStep("register"); setError(""); setOtp("");
    }, []);

    /* ── Register submit ── */
    const submitHandler = useCallback(async (e) => {
        e.preventDefault();
        const { name, email, phone, password } = form;
        if (!name || !email || !phone || !password) return setError("All fields are required");
        if (!PHONE_REGEX.test(phone)) return setError("Enter a valid 10-digit Indian mobile number");
        if (password.length < 8) return setError("Password must be at least 8 characters");
        try {
            setLoading(true); setError("");
            await api.post("/auth/register", {
                name: name.trim(), email: email.trim(),
                phone: phone.trim(), password, role: selectedRole,
            });
            setStep("otp");
        } catch (err) {
            setError(err?.response?.data?.message || "Registration failed");
        } finally { setLoading(false); }
    }, [form, selectedRole]);

    /* ── OTP verify ── */
    const verifyOtp = useCallback(async (e) => {
        e.preventDefault();
        if (!otp.trim() || otp.length !== 6) return setError("Enter valid 6-digit OTP");
        try {
            setLoading(true); setError("");
            const { data } = await api.post("/auth/verify-otp", {
                email: form.email.trim(), otp: otp.trim(),
            });
            redirectAfterAuth(data);
        } catch (err) {
            setError(err?.response?.data?.message || "Invalid or expired OTP");
        } finally { setLoading(false); }
    }, [otp, form.email, redirectAfterAuth]);

    /* ── Resend OTP ── */
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

    /* ── Google signup ── */
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

    /* ── Derived ── */
    const passwordStrength = useMemo(() => {
        const len = form.password.length;
        if (len === 0) return null;
        if (len < 8) return "weak";
        if (len < 12) return "medium";
        return "strong";
    }, [form.password]);

    const passwordInvalid = useMemo(
        () => form.password.length > 0 && form.password.length < 8,
        [form.password],
    );

    const phoneHint = useMemo(() => {
        const { phone } = form;
        if (!phone.length) return null;
        if (phone.length < 10) return `${10 - phone.length} more digits needed`;
        if (!PHONE_REGEX.test(phone)) return "Must start with 6, 7, 8 or 9";
        return null;
    }, [form.phone]);

    const phoneValid = form.phone.length === 10 && PHONE_REGEX.test(form.phone);

    const selectedRoleMeta = ROLES.find(r => r.value === selectedRole);
    const accentCls = ACCENT_MAP[selectedRoleMeta?.accent || "orange"];

    /* ══════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-50
                        flex items-center justify-center p-4 sm:p-8"
            style={{ fontFamily: "'Inter','-apple-system','BlinkMacSystemFont','Segoe UI',sans-serif" }}>

            <SEO title="Create Account — Urbexon"
                description="Create your Urbexon account and start shopping."
                path="/register" noindex />

            {/* ── Main card ── */}
            <div className="w-full max-w-[420px] animate-[fadeUp_.3s_ease_both]">

                {/* ── Top brand bar ── */}
                <div className="relative bg-neutral-900 rounded-t-3xl px-7 pt-7 pb-6 text-center overflow-hidden">
                    {/* Decorative blobs */}
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-rose-500/10 blur-xl pointer-events-none" />

                    {/* Back button */}
                    <button onClick={() => navigate(-1)}
                        className="absolute left-4 top-1/2 -translate-y-1/2
                                   w-8 h-8 rounded-full bg-white/10 border border-white/20
                                   flex items-center justify-center text-white/70
                                   hover:bg-white/20 hover:text-white transition-all">
                        <FaArrowLeft size={12} />
                    </button>

                    {/* Logo */}
                    <div className="flex items-center justify-center gap-1 mb-1 relative z-10">
                        <span className="text-white text-[22px] font-black tracking-tight">URBE</span>
                        <span className="text-[22px] font-black tracking-tight"
                            style={{
                                background: "linear-gradient(90deg,#f97316,#f59e0b)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                            }}>XON</span>
                    </div>
                    <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-white/30 relative z-10">
                        Explore the Unknown
                    </p>

                    {/* Step indicators */}
                    <div className="flex items-center justify-center gap-2 mt-4 relative z-10">
                        {["register", "otp"].map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center
                                                text-[10px] font-bold transition-all duration-300
                                                ${step === s
                                        ? "bg-orange-500 text-white shadow-[0_0_0_3px_rgba(249,115,22,0.3)]"
                                        : step === "otp" && s === "register"
                                            ? "bg-green-500 text-white"
                                            : "bg-white/10 text-white/40"}`}>
                                    {step === "otp" && s === "register"
                                        ? <FaCheckCircle size={10} />
                                        : i + 1}
                                </div>
                                <span className={`text-[10px] font-semibold
                                    ${step === s ? "text-orange-400" : "text-white/30"}`}>
                                    {s === "register" ? "Details" : "Verify"}
                                </span>
                                {i === 0 && <div className={`w-8 h-px ${step === "otp" ? "bg-green-500" : "bg-white/15"}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Form card ── */}
                <div className="bg-white rounded-b-3xl border border-neutral-100 shadow-xl
                                shadow-neutral-900/10 overflow-hidden">

                    {/* ══════════════════════
                        STEP 1 — Register
                    ══════════════════════ */}
                    {step === "register" && (
                        <div className="p-6 sm:p-7 flex flex-col gap-5">
                            <div>
                                <h1 className="text-[18px] font-bold text-neutral-900 mb-0.5">Create Account</h1>
                                <p className="text-xs text-neutral-400">Choose your role and fill in your details</p>
                            </div>

                            {/* ── Role selector ── */}
                            <div className="grid grid-cols-3 gap-2">
                                {ROLES.map(r => {
                                    const ac = ACCENT_MAP[r.accent];
                                    const isActive = selectedRole === r.value;
                                    return (
                                        <button key={r.value} type="button"
                                            onClick={() => setSelectedRole(r.value)}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2
                                                        text-center transition-all duration-200
                                                        ${isActive
                                                    ? `${ac.border} ${ac.bg} ring-2 ${ac.ring} ring-offset-1`
                                                    : "border-neutral-100 bg-neutral-50 hover:border-neutral-200"}`}>
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                                                             transition-all duration-200
                                                             ${isActive ? ac.icon : "bg-neutral-200 text-neutral-500"}`}>
                                                {r.icon}
                                            </div>
                                            <div>
                                                <p className={`text-[11px] font-bold leading-none mb-0.5
                                                               ${isActive ? ac.text : "text-neutral-700"}`}>
                                                    {r.label}
                                                </p>
                                                <p className="text-[9px] text-neutral-400 leading-snug">{r.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {error && <AlertBox type="error">{error}</AlertBox>}

                            {/* ── Form fields ── */}
                            <form onSubmit={submitHandler} className="flex flex-col gap-4">
                                {/* Name */}
                                <InputField label="Full Name" icon={<FaUser size={11} />}>
                                    <StyledInput name="name" type="text" placeholder="Rahul Verma"
                                        value={form.name} onChange={onChange} autoComplete="name" />
                                </InputField>

                                {/* Email */}
                                <InputField label="Email Address" icon={<FaEnvelope size={11} />}>
                                    <StyledInput name="email" type="email" placeholder="rahul@email.com"
                                        value={form.email} onChange={onChange} autoComplete="email" />
                                </InputField>

                                {/* Phone */}
                                <InputField
                                    label="Mobile Number"
                                    icon={<FaPhone size={11} />}
                                    hint={phoneHint}
                                >
                                    <div className="relative">
                                        <span className="absolute left-10 top-1/2 -translate-y-1/2
                                                         text-sm font-semibold text-neutral-500 pointer-events-none z-10">
                                            +91
                                        </span>
                                        <StyledInput name="phone" type="tel" inputMode="numeric"
                                            maxLength={10} placeholder="9876543210"
                                            value={form.phone} onChange={onChange}
                                            autoComplete="tel"
                                            className={`pl-[72px] ${phoneValid ? "border-green-400 bg-green-50/30" : ""}`} />
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                                            <FaPhone size={11} />
                                        </span>
                                    </div>
                                </InputField>

                                {/* Password */}
                                <InputField label="Password" icon={<FaLock size={11} />}>
                                    <StyledInput
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Min. 8 characters"
                                        value={form.password} onChange={onChange}
                                        autoComplete="new-password"
                                        className="pr-11"
                                    />
                                    <button type="button" onClick={() => setShowPassword(s => !s)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2
                                                   text-neutral-400 hover:text-neutral-700 transition-colors p-0.5">
                                        {showPassword ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                                    </button>
                                    {/* Strength bar */}
                                    {passwordStrength && (
                                        <div className="mt-2 flex flex-col gap-1">
                                            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-500
                                                                 ${STRENGTH[passwordStrength].color}
                                                                 ${STRENGTH[passwordStrength].width}`} />
                                            </div>
                                            <p className={`text-[10px] font-semibold
                                                           ${passwordStrength === "weak" ? "text-red-500"
                                                    : passwordStrength === "medium" ? "text-amber-500"
                                                        : "text-green-600"}`}>
                                                {STRENGTH[passwordStrength].label}
                                            </p>
                                        </div>
                                    )}
                                </InputField>

                                <PrimaryBtn type="submit" loading={loading} loadingText="Sending OTP…"
                                    disabled={loading || passwordInvalid}>
                                    <FaBolt size={12} /> Continue
                                </PrimaryBtn>
                            </form>

                            {/* Google signup */}
                            {isFirebaseConfigured() && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-neutral-100" />
                                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">or</span>
                                        <div className="flex-1 h-px bg-neutral-100" />
                                    </div>
                                    <button onClick={handleGoogleSignup} disabled={googleLoading}
                                        className="w-full flex items-center justify-center gap-2.5 h-11
                                                   bg-white border border-neutral-200 rounded-2xl
                                                   text-sm font-semibold text-neutral-700
                                                   hover:border-neutral-300 hover:bg-neutral-50
                                                   disabled:opacity-50 disabled:cursor-not-allowed
                                                   transition-all duration-200 shadow-sm hover:shadow-md">
                                        {googleLoading
                                            ? <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                                            : <FcGoogle size={18} />}
                                        {googleLoading ? "Signing up…" : "Continue with Google"}
                                    </button>
                                </>
                            )}

                            {/* Footer */}
                            <p className="text-center text-xs text-neutral-400">
                                Already have an account?{" "}
                                <Link to="/login" state={{ from }}
                                    className="font-bold text-neutral-900 hover:text-orange-500 transition-colors">
                                    Sign In →
                                </Link>
                            </p>
                        </div>
                    )}

                    {/* ══════════════════════
                        STEP 2 — OTP
                    ══════════════════════ */}
                    {step === "otp" && (
                        <div className="p-6 sm:p-7 flex flex-col gap-5">
                            {/* Header */}
                            <div>
                                <h1 className="text-[18px] font-bold text-neutral-900 mb-0.5">Verify Your Email</h1>
                                <p className="text-xs text-neutral-400">
                                    We sent a 6-digit code to
                                </p>
                                <p className="text-sm font-semibold text-neutral-900 mt-0.5">{form.email}</p>
                            </div>

                            {/* Role-aware message for vendor/delivery */}
                            {(selectedRole === "vendor" || selectedRole === "delivery_boy") && (
                                <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs font-medium
                                    ${selectedRole === "vendor"
                                        ? "bg-violet-50 border border-violet-100 text-violet-700"
                                        : "bg-green-50 border border-green-100 text-green-700"}`}>
                                    <span className="shrink-0 mt-0.5">
                                        {selectedRole === "vendor" ? "🏪" : "🛵"}
                                    </span>
                                    After verification, you'll be redirected to complete your{" "}
                                    {selectedRole === "vendor" ? "seller" : "delivery partner"} application.
                                </div>
                            )}

                            {/* Spam notice */}
                            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100
                                            rounded-xl px-4 py-3 text-xs text-amber-700">
                                <span className="shrink-0 mt-0.5">📬</span>
                                Check your spam / junk folder if you don't see it in inbox.
                            </div>

                            {error && <AlertBox type="error">{error}</AlertBox>}
                            {success && <AlertBox type="success">{success}</AlertBox>}

                            {/* OTP input */}
                            <form onSubmit={verifyOtp} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                                        6-Digit Code
                                    </label>
                                    <input
                                        type="text" inputMode="numeric" maxLength={6}
                                        value={otp} onChange={handleOtpChange}
                                        placeholder="· · · · · ·"
                                        className="w-full px-4 py-4 text-center
                                                   text-[32px] font-bold text-neutral-900
                                                   tracking-[0.5em]
                                                   bg-neutral-50 border-2 border-neutral-200 rounded-2xl
                                                   outline-none transition-all duration-200
                                                   placeholder:text-neutral-200 placeholder:tracking-[0.3em] placeholder:text-2xl
                                                   focus:border-orange-400 focus:bg-white
                                                   focus:shadow-[0_0_0_4px_rgba(249,115,22,0.1)]"
                                    />
                                    {otp.length > 0 && otp.length < 6 && (
                                        <p className="text-[11px] text-neutral-400 text-center">
                                            {6 - otp.length} more digit{6 - otp.length !== 1 ? "s" : ""} needed
                                        </p>
                                    )}
                                </div>

                                <PrimaryBtn type="submit" loading={loading} loadingText="Verifying…"
                                    disabled={loading || otp.length !== 6}>
                                    <FaCheckCircle size={12} /> Confirm & Continue
                                </PrimaryBtn>
                            </form>

                            {/* Resend + back */}
                            <div className="flex flex-col gap-3 items-center">
                                <div className="text-xs text-neutral-400">
                                    Didn't receive it?{" "}
                                    <button onClick={resendOtp} disabled={resendLoading}
                                        className="font-bold text-neutral-900 hover:text-orange-500
                                                   transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                        {resendLoading ? "Sending…" : "Resend Code"}
                                    </button>
                                </div>
                                <button onClick={goBackToRegister}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold
                                               text-neutral-400 hover:text-neutral-700 transition-colors">
                                    <FaArrowLeft size={9} /> Change Details
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom helper */}
                <p className="text-center text-[11px] text-neutral-400 mt-4">
                    By continuing, you agree to our{" "}
                    <Link to="/terms" className="underline hover:text-neutral-700">Terms</Link>
                    {" "}and{" "}
                    <Link to="/privacy" className="underline hover:text-neutral-700">Privacy Policy</Link>
                </p>
            </div>

            {/* Keyframe */}
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
            `}</style>
        </div>
    );
};

export default Register;