/**
 * Login.jsx — Production
 * Role-based redirect: user→/, vendor→/vendor/dashboard, delivery_boy→/delivery/dashboard
 */
import { useState, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import SEO from "../components/SEO";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import { getFirebaseAuth, isFirebaseConfigured } from "../config/firebase";
import { signInWithPopup } from "firebase/auth";

const getRoleRedirect = (role) => {
    switch (role) {
        case "vendor":
            return { external: true, url: (import.meta.env.VITE_VENDOR_URL || "http://localhost:5175") + "/dashboard" };
        case "delivery_boy":
            return { external: true, url: (import.meta.env.VITE_DELIVERY_URL || "http://localhost:5176") + "/dashboard" };
        case "admin":
        case "owner":
            return null; // block - use admin panel
        default:
            return { external: false, url: "/" };
    }
};

const S = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box}
.lg-root{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;background:#f7f3eb;position:relative;overflow:hidden;font-family:'DM Sans',sans-serif}
.lg-root::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 120% 80% at 50% -20%,rgba(201,168,76,0.08) 0%,transparent 60%),radial-gradient(ellipse 60% 60% at 100% 100%,rgba(26,23,64,0.04) 0%,transparent 60%)}
.lg-card{position:relative;width:100%;max-width:420px;background:#fff;border:1px solid rgba(201,168,76,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.04)}
.lg-top{background:#1a1740;padding:28px 32px;text-align:center;position:relative}
.lg-back{position:absolute;left:16px;top:50%;transform:translateY(-50%);background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:#c9a84c;cursor:pointer;transition:all 0.2s;text-decoration:none}
.lg-back:hover{background:rgba(201,168,76,0.25);border-color:rgba(201,168,76,0.5)}
.lg-brand{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:700;color:#c9a84c;letter-spacing:6px;text-transform:uppercase;margin:0}
.lg-brand-sub{font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:4px;text-transform:uppercase;margin:6px 0 0}
.lg-body{padding:28px 32px}
.lg-title{font-size:18px;font-weight:700;color:#1a1740;margin:0 0 4px}
.lg-sub{font-size:12px;color:#94a3b8;margin:0 0 24px;letter-spacing:0.3px}
.lg-field{margin-bottom:18px}
.lg-label{display:block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:8px}
.lg-inp-wrap{position:relative}
.lg-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;transition:color 0.2s;display:flex}
.lg-inp-wrap:focus-within .lg-icon{color:#c9a84c}
.lg-inp{width:100%;padding:13px 13px 13px 42px;border:1.5px solid #e2e8f0;background:#fafafe;color:#1e293b;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:all 0.2s;box-sizing:border-box}
.lg-inp::placeholder{color:#c4c9d2;font-size:13px}
.lg-inp:focus{border-color:#c9a84c;background:#fff;box-shadow:0 0 0 3px rgba(201,168,76,0.08)}
.lg-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:4px;transition:color 0.2s;display:flex}
.lg-eye:hover{color:#1a1740}
.lg-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:11px 14px;font-size:12.5px;margin-bottom:18px;display:flex;gap:8px;align-items:flex-start}
.lg-btn{width:100%;padding:15px;background:#1a1740;border:none;color:#c9a84c;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;cursor:pointer;transition:all 0.25s;margin-top:4px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px}
.lg-btn::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.15),transparent);transition:left 0.5s}
.lg-btn:hover:not(:disabled)::before{left:100%}
.lg-btn:hover:not(:disabled){background:#252060;box-shadow:0 8px 24px rgba(26,23,64,0.25)}
.lg-btn:disabled{opacity:0.5;cursor:not-allowed}
.lg-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);margin:22px 0}
.lg-foot{font-size:12px;color:#94a3b8;text-align:center}
.lg-link{color:#1a1740;font-weight:600;text-decoration:none;transition:color 0.2s}
.lg-link:hover{color:#c9a84c}
.lg-spin{width:16px;height:16px;border:2px solid rgba(201,168,76,0.3);border-top-color:#c9a84c;border-radius:50%;animation:sp 0.7s linear infinite;display:inline-block}
@keyframes sp{to{transform:rotate(360deg)}}
.lg-forgot{font-size:11px;color:#94a3b8;text-decoration:none;float:right;margin-top:-2px;transition:color 0.2s}
.lg-forgot:hover{color:#c9a84c}
.lg-or{display:flex;align-items:center;gap:12px;margin:20px 0;font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase}
.lg-or::before,.lg-or::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent)}
.lg-google{width:100%;padding:13px;background:#fff;border:1.5px solid #e2e8f0;color:#374151;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.2s}
.lg-google:hover:not(:disabled){border-color:#c9a84c;box-shadow:0 4px 12px rgba(0,0,0,0.08)}
.lg-google:disabled{opacity:0.5;cursor:not-allowed}
.lg-otp-inp{width:100%;padding:18px;border:1.5px solid #e2e8f0;background:#fafafe;color:#1a1740;font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:600;text-align:center;letter-spacing:14px;outline:none;transition:all 0.2s;box-sizing:border-box}
.lg-otp-inp:focus{border-color:#c9a84c;background:#fff;box-shadow:0 0 0 3px rgba(201,168,76,0.08)}
.lg-otp-inp::placeholder{color:#c4c9d2;letter-spacing:8px;font-size:24px}
.lg-otp-notice{background:#fffcf5;border:1px solid rgba(201,168,76,0.2);padding:10px 14px;font-size:11.5px;color:#92400e;text-align:center;margin-bottom:18px}
.lg-back-link{background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:color 0.2s;padding:0}
.lg-back-link:hover{color:#1a1740}
@media(max-width:480px){
.lg-top{padding:22px 16px}
.lg-back{width:30px;height:30px;left:12px}
.lg-brand{font-size:22px;letter-spacing:4px}
.lg-brand-sub{font-size:8px;letter-spacing:3px}
.lg-body{padding:22px 18px}
.lg-title{font-size:16px}
.lg-btn{padding:14px;font-size:10px;letter-spacing:3px}
.lg-google{padding:12px;font-size:12px}
}
`;

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { loginWithData } = useAuth();
    const from = location.state?.from;

    const redirectAfterAuth = useCallback((data) => {
        loginWithData(data);
        // For vendor/delivery roles, always go to their portal
        const redirect = getRoleRedirect(data.role);
        if (redirect?.external) {
            window.location.href = redirect.url;
        } else if (from) {
            navigate(from, { replace: true });
        } else {
            navigate(redirect?.url || "/", { replace: true });
        }
    }, [loginWithData, navigate, from]);

    const [email, setEmail] = useState("");
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
            const { data } = await api.post("/auth/google", { idToken });
            if (["admin", "owner"].includes(data.role)) {
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
        if (!email.trim() || !password.trim()) return setError("Email and password are required");
        try {
            setLoading(true); setError("");
            const { data } = await api.post("/auth/login", { email: email.trim(), password: password.trim() });
            if (["admin", "owner"].includes(data.role)) {
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
    }, [email, password, redirectAfterAuth]);

    const handleVerifyOtp = useCallback(async (e) => {
        e.preventDefault();
        if (!otp.trim() || otp.length !== 6) return setError("Enter valid 6-digit OTP");
        try {
            setOtpLoading(true); setError("");
            const { data } = await api.post("/auth/verify-otp", { email: email.trim(), otp: otp.trim() });
            redirectAfterAuth(data);
        } catch (err) {
            setError(err?.response?.data?.message || "Invalid OTP");
        } finally { setOtpLoading(false); }
    }, [otp, email, redirectAfterAuth]);

    return (
        <div className="lg-root">
            <SEO title="Login" description="Sign in to your Urbexon account." path="/login" noindex />
            <style>{S}</style>
            <div className="lg-card">
                <div className="lg-top">
                    <button className="lg-back" onClick={() => navigate(-1)} title="Go back">
                        <FaArrowLeft size={13} />
                    </button>
                    <div className="lg-brand">Urbexon</div>
                    <div className="lg-brand-sub">Explore the unknown</div>
                </div>
                <div className="lg-body">
                    {!otpStep ? (
                        <>
                            <div className="lg-title">Welcome back</div>
                            <div className="lg-sub">Sign in to your account</div>

                            {error && <div className="lg-err"><span>◆</span><span>{error}</span></div>}

                            <form onSubmit={handleLogin}>
                                <div className="lg-field">
                                    <label className="lg-label">Email Address</label>
                                    <div className="lg-inp-wrap">
                                        <span className="lg-icon"><FaEnvelope size={13} /></span>
                                        <input className="lg-inp" type="email" placeholder="your@email.com"
                                            value={email} onChange={e => { setEmail(e.target.value); setError(""); }} autoComplete="email" />
                                    </div>
                                </div>
                                <div className="lg-field">
                                    <label className="lg-label">
                                        Password
                                        <Link to="/forgot-password" className="lg-forgot">Forgot password?</Link>
                                    </label>
                                    <div className="lg-inp-wrap">
                                        <span className="lg-icon"><FaLock size={13} /></span>
                                        <input className="lg-inp" type={showPwd ? "text" : "password"}
                                            placeholder="••••••••" value={password}
                                            onChange={e => { setPassword(e.target.value); setError(""); }}
                                            style={{ paddingRight: 44 }} autoComplete="current-password" />
                                        <button type="button" className="lg-eye" onClick={() => setShowPwd(s => !s)}>
                                            {showPwd ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" className="lg-btn" disabled={loading}>
                                    {loading ? <><span className="lg-spin" style={{ marginRight: 8 }} />Signing In</> : "Sign In →"}
                                </button>
                            </form>

                            {isFirebaseConfigured() && (
                                <>
                                    <div className="lg-or">or</div>
                                    <button className="lg-google" onClick={handleGoogleLogin} disabled={googleLoading}>
                                        {googleLoading ? <span className="lg-spin" /> : <FcGoogle size={18} />}
                                        {googleLoading ? "Signing in..." : "Sign in with Google"}
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="lg-title">Verify Email</div>
                            <div className="lg-sub">OTP sent to {email}</div>

                            <div className="lg-otp-notice">◆ &nbsp;Check your spam / junk folder if not received</div>

                            {error && <div className="lg-err"><span>◆</span><span>{error}</span></div>}
                            <form onSubmit={handleVerifyOtp}>
                                <div className="lg-field">
                                    <label className="lg-label" style={{ textAlign: "center", display: "block" }}>Enter 6-digit code</label>
                                    <input className="lg-otp-inp" type="text" inputMode="numeric" maxLength={6}
                                        placeholder="· · · · · ·"
                                        value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }} />
                                </div>
                                <button type="submit" className="lg-btn" disabled={otpLoading}>
                                    {otpLoading ? <><span className="lg-spin" />Verifying</> : "Verify & Continue →"}
                                </button>
                            </form>
                            <div style={{ textAlign: "center", marginTop: 16 }}>
                                <button onClick={() => setOtpStep(false)} className="lg-back-link">
                                    ← Back to Login
                                </button>
                            </div>
                        </>
                    )}

                    <div className="lg-divider" />
                    <div className="lg-foot">
                        New to Urbexon?&nbsp;&nbsp;<Link to="/register" state={{ from }} className="lg-link">Create Account →</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Login;
