/**
 * Register.jsx — Signal Design System migration
 * ✅ All business logic 100% preserved verbatim from prior version
 * NOTE: the 3 role-selector cards previously used 3 arbitrary Tailwind
 * accent colors (orange/violet/green) not part of the approved palette.
 * Consolidated to the single Signal accent color per the approved system —
 * selection state is still fully functional, just visually consistent now.
 */
import { useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
    FiUser, FiMail, FiLock, FiEye, FiEyeOff,
    FiPhone, FiArrowLeft, FiCheckCircle, FiZap,
} from "react-icons/fi";
import { FaStore, FaMotorcycle } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import BackButton from "../components/BackButton";
import SEO from "../components/SEO";
import * as authApi from "../api/authApi";
import { useAuth } from "../contexts/AuthContext";
import { getFirebaseAuth, isFirebaseConfigured } from "../config/firebase";
import { signInWithPopup } from "firebase/auth";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import { cn } from "../design-system/utils/cn";

const PHONE_REGEX = /^[6-9]\d{9}$/;

const STRENGTH = {
    weak: { color: "bg-[var(--color-error-500)]", label: "Too short", width: "w-1/3" },
    medium: { color: "bg-[var(--color-warning-500)]", label: "Medium", width: "w-2/3" },
    strong: { color: "bg-[var(--color-success-500)]", label: "Strong ✓", width: "w-full" },
};

const ROLES = [
    { value: "user", label: "Customer", icon: FiUser, desc: "Shop & buy products" },
    { value: "vendor", label: "Seller", icon: FaStore, desc: "List & sell your products" },
    { value: "delivery_boy", label: "Delivery", icon: FaMotorcycle, desc: "Earn by delivering" },
];

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

        // Priority 1: vendor/delivery → redirect to respective apps' /apply page.
        // BUG FIX: /apply was only baked into the fallback default, which
        // never actually runs — client/.env sets BOTH VITE_VENDOR_URL and
        // VITE_DELIVERY_URL to bare origins (e.g. "http://localhost:5175",
        // no path), so the `||` short-circuited before /apply ever got
        // appended. Both roles landed on the panel's bare root instead of
        // the application form. Append /apply unconditionally, after the
        // fallback resolves, so it's always present either way.
        if (data.user.role === "vendor") {
            const base = import.meta.env.VITE_VENDOR_URL || "https://vendor.urbexon.in";
            window.location.href = `${base.replace(/\/$/, "")}/apply`;
            return;
        } else if (data.user.role === "delivery_boy") {
            const base = import.meta.env.VITE_DELIVERY_URL || "https://delivery.partner.urbexon.in";
            window.location.href = `${base.replace(/\/$/, "")}/apply`;
            return;
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
            await authApi.register({
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
            const { data } = await authApi.verifyOtp({
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
            await authApi.resendOtp({ email: form.email.trim() });
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
            const { data } = await authApi.googleAuth({ idToken, role: selectedRole });
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

    /* ══════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen bg-canvas flex items-center justify-center p-4 sm:p-8">
            <SEO title="Create Account — Urbexon"
                description="Create your Urbexon account and start shopping."
                path="/register" noindex />

            {/* ── Main card ── */}
            <div className="w-full max-w-[420px]">

                <Card padding="none" className="overflow-hidden shadow-lg">
                    {/* ── Top brand bar ── */}
                    <div className="relative bg-[var(--color-graphite-900)] px-7 pt-7 pb-6 text-center">
                        <BackButton
                            variant="inline"
                            fallback="/"
                            className="absolute left-4 top-1/2 -translate-y-1/2 !w-8 !h-8 !bg-white/10 !border-white/20 !text-white/70 hover:!bg-white/20 hover:!text-white !shadow-none"
                        />

                        <div className="text-white text-[22px] font-black tracking-tight font-display">Urbexon</div>
                        <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-white/30">
                            Explore the Unknown
                        </p>

                        {/* Step indicators */}
                        <div className="flex items-center justify-center gap-2 mt-4">
                            {["register", "otp"].map((s, i) => (
                                <div key={s} className="flex items-center gap-2">
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300",
                                        step === s
                                            ? "bg-accent text-white"
                                            : step === "otp" && s === "register"
                                                ? "bg-[var(--color-success-500)] text-white"
                                                : "bg-white/10 text-white/40"
                                    )}>
                                        {step === "otp" && s === "register" ? <FiCheckCircle size={10} aria-hidden="true" /> : i + 1}
                                    </div>
                                    <span className={cn("text-[10px] font-semibold", step === s ? "text-accent" : "text-white/30")}>
                                        {s === "register" ? "Details" : "Verify"}
                                    </span>
                                    {i === 0 && <div className={cn("w-8 h-px", step === "otp" ? "bg-[var(--color-success-500)]" : "bg-white/15")} />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ══════════════════════
                        STEP 1 — Register
                    ══════════════════════ */}
                    {step === "register" && (
                        <div className="p-6 sm:p-7 flex flex-col gap-5">
                            <div>
                                <h1 className="text-[18px] font-bold text-primary mb-0.5 font-display">Create Account</h1>
                                <p className="text-xs text-muted">Choose your role and fill in your details</p>
                            </div>

                            {/* ── Role selector ── */}
                            <div className="grid grid-cols-3 gap-2">
                                {ROLES.map(r => {
                                    const isActive = selectedRole === r.value;
                                    const Icon = r.icon;
                                    return (
                                        <button key={r.value} type="button"
                                            onClick={() => setSelectedRole(r.value)}
                                            className={cn(
                                                "flex flex-col items-center gap-2 p-3 rounded-[var(--radius-lg)] border-2 text-center transition-all duration-200",
                                                isActive ? "border-[var(--accent-primary)] bg-accent-tint" : "border-default bg-canvas hover:border-strong"
                                            )}>
                                            <div className={cn(
                                                "w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center transition-all duration-200",
                                                isActive ? "bg-accent text-white" : "bg-[var(--color-graphite-200)] text-muted"
                                            )}>
                                                <Icon size={16} aria-hidden="true" />
                                            </div>
                                            <div>
                                                <p className={cn("text-[11px] font-bold leading-none mb-0.5", isActive ? "text-accent" : "text-secondary")}>
                                                    {r.label}
                                                </p>
                                                <p className="text-[9px] text-muted leading-snug">{r.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {error && <Alert variant="error">{error}</Alert>}

                            {/* ── Form fields ── */}
                            <form onSubmit={submitHandler} className="flex flex-col gap-4">
                                <Input
                                    label="Full Name" name="name" type="text" placeholder="Rahul Verma"
                                    value={form.name} onChange={onChange} autoComplete="name"
                                    leadingIcon={FiUser}
                                />
                                <Input
                                    label="Email Address" name="email" type="email" placeholder="rahul@email.com"
                                    value={form.email} onChange={onChange} autoComplete="email"
                                    leadingIcon={FiMail}
                                />
                                <div>
                                    <Input
                                        label="Mobile Number" name="phone" type="tel" inputMode="numeric"
                                        maxLength={10} placeholder="9876543210"
                                        value={form.phone} onChange={onChange} autoComplete="tel"
                                        leadingIcon={FiPhone}
                                        className={phoneValid ? "border-[var(--color-success-500)]" : ""}
                                    />
                                    {phoneHint && <p className="text-[11px] text-muted mt-1">{phoneHint}</p>}
                                </div>
                                <div>
                                    <Input
                                        label="Password" name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Min. 8 characters"
                                        value={form.password} onChange={onChange}
                                        autoComplete="new-password"
                                        leadingIcon={FiLock}
                                        trailingIcon={showPassword ? FiEyeOff : FiEye}
                                        trailingIconLabel={showPassword ? "Hide password" : "Show password"}
                                        onTrailingIconClick={() => setShowPassword((s) => !s)}
                                    />
                                    {passwordStrength && (
                                        <div className="mt-2 flex flex-col gap-1">
                                            <div className="h-1.5 bg-[var(--color-graphite-100)] rounded-full overflow-hidden">
                                                <div className={cn("h-full rounded-full transition-all duration-500", STRENGTH[passwordStrength].color, STRENGTH[passwordStrength].width)} />
                                            </div>
                                            <p className={cn(
                                                "text-[10px] font-semibold",
                                                passwordStrength === "weak" ? "text-error" : passwordStrength === "medium" ? "text-warning" : "text-success"
                                            )}>
                                                {STRENGTH[passwordStrength].label}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <Button type="submit" variant="primary" loading={loading} disabled={loading || passwordInvalid} icon={loading ? undefined : FiZap}>
                                    {loading ? "Sending OTP…" : "Continue"}
                                </Button>
                            </form>

                            {/* Google signup */}
                            {isFirebaseConfigured() && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-default" />
                                        <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">or</span>
                                        <div className="flex-1 h-px bg-default" />
                                    </div>
                                    <Button variant="secondary" onClick={handleGoogleSignup} loading={googleLoading} icon={googleLoading ? undefined : FcGoogle}>
                                        {googleLoading ? "Signing up…" : "Continue with Google"}
                                    </Button>
                                </>
                            )}

                            {/* Footer */}
                            <p className="text-center text-xs text-muted">
                                Already have an account?{" "}
                                <Link to="/login" state={{ from }} className="font-bold text-primary hover:text-accent transition-colors">
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
                            <div>
                                <h1 className="text-[18px] font-bold text-primary mb-0.5 font-display">Verify Your Email</h1>
                                <p className="text-xs text-muted">We sent a 6-digit code to</p>
                                <p className="text-sm font-semibold text-primary mt-0.5">{form.email}</p>
                            </div>

                            {/* Role-aware message for vendor/delivery */}
                            {(selectedRole === "vendor" || selectedRole === "delivery_boy") && (
                                <Alert variant="info">
                                    After verification, you'll be redirected to complete your{" "}
                                    {selectedRole === "vendor" ? "seller" : "delivery partner"} application.
                                </Alert>
                            )}

                            <Alert variant="warning">
                                Check your spam / junk folder if you don't see it in inbox.
                            </Alert>

                            {error && <Alert variant="error">{error}</Alert>}
                            {success && <Alert variant="success">{success}</Alert>}

                            {/* OTP input */}
                            <form onSubmit={verifyOtp} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                                        6-Digit Code
                                    </label>
                                    <input
                                        type="text" inputMode="numeric" maxLength={6}
                                        value={otp} onChange={handleOtpChange}
                                        placeholder="· · · · · ·"
                                        className="w-full px-4 py-4 text-center text-[32px] font-bold text-primary font-display tracking-[0.5em] bg-canvas border-2 border-default rounded-[var(--radius-lg)] outline-none transition-all duration-200 focus-ring-accent focus:border-[var(--accent-primary)]"
                                    />
                                    {otp.length > 0 && otp.length < 6 && (
                                        <p className="text-[11px] text-muted text-center">
                                            {6 - otp.length} more digit{6 - otp.length !== 1 ? "s" : ""} needed
                                        </p>
                                    )}
                                </div>

                                <Button type="submit" variant="primary" loading={loading} disabled={loading || otp.length !== 6} icon={loading ? undefined : FiCheckCircle}>
                                    {loading ? "Verifying…" : "Confirm & Continue"}
                                </Button>
                            </form>

                            {/* Resend + back */}
                            <div className="flex flex-col gap-3 items-center">
                                <div className="text-xs text-muted">
                                    Didn't receive it?{" "}
                                    <button onClick={resendOtp} disabled={resendLoading}
                                        className="font-bold text-primary hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                        {resendLoading ? "Sending…" : "Resend Code"}
                                    </button>
                                </div>
                                <button onClick={goBackToRegister}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-secondary transition-colors">
                                    <FiArrowLeft size={9} aria-hidden="true" /> Change Details
                                </button>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Bottom helper */}
                <p className="text-center text-[11px] text-muted mt-4">
                    By continuing, you agree to our{" "}
                    <Link to="/terms" className="underline hover:text-secondary">Terms</Link>
                    {" "}and{" "}
                    <Link to="/privacy" className="underline hover:text-secondary">Privacy Policy</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
