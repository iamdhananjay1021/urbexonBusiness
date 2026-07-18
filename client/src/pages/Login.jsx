/**
 * Login.jsx — Production
 * Role-based redirect: user→/, vendor→/vendor/dashboard, delivery_boy→/delivery/dashboard
 */
import { useState, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import SEO from "../components/SEO";
import BackButton from "../components/BackButton";
import { useAuth } from "../contexts/AuthContext";
import * as authApi from "../api/authApi";
import { getFirebaseAuth, isFirebaseConfigured } from "../config/firebase";
import { signInWithPopup } from "firebase/auth";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";

const getRoleRedirect = (role) => {
    switch (role) {
        case "vendor":
            // ✅ FIX: Standardize on Vite environment variables
            return { external: true, url: import.meta.env.VITE_VENDOR_URL || "https://vendor.urbexon.in" };
        case "delivery_boy":
            // Delivery partners use separate delivery-panel app, not customer app
            return { external: true, url: import.meta.env.VITE_DELIVERY_URL || "https://delivery.partner.urbexon.in" };
        case "admin":
        case "owner":
            return null; // block - use admin panel
        default:
            return { external: false, url: "/" };
    }
};

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { loginWithData } = useAuth();
    const from = location.state?.from;

    const redirectAfterAuth = useCallback((data) => {
        loginWithData(data);

        // Priority 1: Agar user explicitly kisi form (/become-vendor) se aaya hai toh wahi wapas bhejo
        if (from) {
            navigate(from, { replace: true });
            return;
        }

        // For vendor/delivery roles, always go to their portal
        // ✅ FIX: Role is on the nested `user` object
        const redirect = getRoleRedirect(data.user.role);
        if (redirect?.external) {
            window.location.href = redirect.url;
        } else {
            navigate(redirect?.url || "/", { replace: true });
        }
    }, [loginWithData, navigate, from]);

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // OTP re-verify state
    const [otpStep, setOtpStep] = useState(false);
    const [otp, setOtp] = useState("");
    const [otpLoading, setOtpLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const handleGoogleLogin = useCallback(async () => {
        try {
            setGoogleLoading(true); setError("");
            const { auth, googleProvider } = getFirebaseAuth();
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();
            const { data } = await authApi.googleAuth({ idToken });
            // ✅ FIX: Role is on the nested `user` object
            if (["admin", "owner"].includes(data.user.role)) {
                setError("Admin accounts must use the Admin Panel.");
                return;
            }
            redirectAfterAuth(data);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || "Google sign-in failed";
            if (err?.code === "auth/popup-closed-by-user") return;
            setError(msg);
        } finally { setGoogleLoading(false); }
    }, [redirectAfterAuth]);

    const handleLogin = useCallback(async (e) => {
        e.preventDefault();
        if (!identifier.trim() || !password.trim()) return setError("Email/phone and password are required");
        try {
            setLoading(true); setError("");
            // Determine if identifier is email or phone
            const isEmail = identifier.includes("@");
            const loginPayload = isEmail
                ? { email: identifier.trim(), password: password.trim() }
                : { phone: identifier.trim(), password: password.trim() };
            const { data } = await authApi.login(loginPayload);
            // ✅ FIX: Role is on the nested `user` object
            if (["admin", "owner"].includes(data.user.role)) {
                setError("Admin accounts must use the Admin Panel.");
                return;
            }
            redirectAfterAuth(data);
        } catch (err) {
            console.log("[Login] Auth Error Caught:", err?.response?.data || err);
            const msg = err?.response?.data?.message || "Login failed";
            if (err?.response?.data?.requiresVerification || msg.toLowerCase().includes("verify") || msg.toLowerCase().includes("otp")) {
                setOtpStep(true);
                setError(msg); // Error clear karne ke bajaye message dikhayen taaki user ko pata chale OTP kahan gaya hai
            } else {
                setError(msg);
            }
        } finally { setLoading(false); }
    }, [identifier, password, redirectAfterAuth]);

    const handleVerifyOtp = useCallback(async (e) => {
        e.preventDefault();
        if (!otp.trim() || otp.length !== 6) return setError("Enter valid 6-digit OTP");
        try {
            setOtpLoading(true); setError("");
            // Use email or phone for OTP verification
            const isEmail = identifier.includes("@");
            const verifyPayload = isEmail
                ? { email: identifier.trim(), otp: otp.trim() }
                : { phone: identifier.trim(), otp: otp.trim() };
            const { data } = await authApi.verifyOtp(verifyPayload);
            redirectAfterAuth(data);
        } catch (err) {
            setError(err?.response?.data?.message || "Invalid OTP");
        } finally { setOtpLoading(false); }
    }, [otp, identifier, redirectAfterAuth]);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-canvas">
            <SEO title="Login" description="Sign in to your Urbexon account." path="/login" noindex />

            <Card padding="none" className="relative w-full max-w-[420px] overflow-hidden shadow-lg">
                <div className="bg-[var(--color-graphite-900)] px-8 py-7 text-center relative">
                    <BackButton
                        variant="inline"
                        fallback="/"
                        className="absolute left-4 top-1/2 -translate-y-1/2 !h-8 !w-8 !bg-white/10 !border-white/20 !text-white hover:!bg-white/20 hover:!text-white hover:!border-white/20 !shadow-none"
                    />
                    <div className="font-display text-2xl font-bold text-white tracking-widest uppercase">Urbexon</div>
                    <div className="text-[9px] text-white/40 tracking-[4px] uppercase mt-1.5">Explore the unknown</div>
                </div>

                <div className="p-7 sm:p-8">
                    {!otpStep ? (
                        <>
                            <div className="text-lg font-bold text-primary font-display">Welcome back</div>
                            <div className="text-xs text-muted mb-6 mt-0.5">Sign in to your account</div>

                            {error && <Alert variant="error" className="mb-4">{error}</Alert>}

                            <form onSubmit={handleLogin} className="space-y-4">
                                <Input
                                    label="Email or Phone"
                                    type="text"
                                    placeholder="your@email.com or 9876543210"
                                    value={identifier}
                                    onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
                                    autoComplete="email"
                                    leadingIcon={FiMail}
                                />
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[13px] font-semibold text-primary">Password</label>
                                        <Link to="/forgot-password" className="text-xs text-muted hover:text-accent transition-colors">
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <Input
                                        type={showPwd ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                        autoComplete="current-password"
                                        leadingIcon={FiLock}
                                        trailingIcon={showPwd ? FiEyeOff : FiEye}
                                        trailingIconLabel={showPwd ? "Hide password" : "Show password"}
                                        onTrailingIconClick={() => setShowPwd((s) => !s)}
                                    />
                                </div>
                                <Button type="submit" variant="primary" className="w-full" loading={loading}>
                                    Sign In →
                                </Button>
                            </form>

                            {isFirebaseConfigured() && (
                                <>
                                    <div className="flex items-center gap-3 my-5 text-[11px] text-muted uppercase tracking-widest">
                                        <span className="flex-1 h-px bg-default" />or<span className="flex-1 h-px bg-default" />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="w-full"
                                        onClick={handleGoogleLogin}
                                        loading={googleLoading}
                                        icon={googleLoading ? undefined : FcGoogle}
                                    >
                                        Sign in with Google
                                    </Button>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="text-lg font-bold text-primary font-display">Verify Email</div>
                            <div className="text-xs text-muted mb-4 mt-0.5">OTP sent to {identifier}</div>

                            <Alert variant="warning" className="mb-4 text-center justify-center">
                                Check your spam / junk folder if not received
                            </Alert>

                            {error && <Alert variant="error" className="mb-4">{error}</Alert>}
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div>
                                    <label className="block text-[13px] font-semibold text-primary mb-1.5 text-center">
                                        Enter 6-digit code
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="· · · · · ·"
                                        value={otp}
                                        onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                                        className="w-full rounded-[var(--radius-sm)] border border-default bg-canvas text-primary font-display text-3xl font-semibold text-center tracking-[14px] py-4 outline-none focus-ring-accent focus:border-[var(--accent-primary)] transition-colors"
                                    />
                                </div>
                                <Button type="submit" variant="primary" className="w-full" loading={otpLoading}>
                                    Verify & Continue →
                                </Button>
                            </form>
                            <div className="text-center mt-4">
                                <button onClick={() => setOtpStep(false)} className="text-sm text-muted hover:text-primary transition-colors">
                                    ← Back to Login
                                </button>
                            </div>
                        </>
                    )}

                    <div className="h-px bg-default my-5" />
                    <div className="text-xs text-muted text-center">
                        New to Urbexon?&nbsp;&nbsp;
                        <Link to="/register" state={{ from }} className="text-primary font-semibold hover:text-accent transition-colors">
                            Create Account →
                        </Link>
                    </div>
                </div>
            </Card>
        </div>
    );
};
export default Login;
