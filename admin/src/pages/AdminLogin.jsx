import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaShieldAlt } from "react-icons/fa";

const ADMIN_ROLES = ["admin", "owner"];

/* ── Custom hook — keeps JSX clean ── */
const useAdminForm = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const clearError = useCallback(() => setError(""), []);
    const togglePassword = useCallback(() => setShowPassword((s) => !s), []);

    return {
        email, setEmail,
        password, setPassword,
        showPassword, togglePassword,
        error, setError, clearError,
        submitting, setSubmitting,
    };
};

/* ── Reusable input ── */
const Field = ({ label, icon, rightElement, inputRef, ...props }) => {
    const [focused, setFocused] = useState(false);

    return (
        <div style={{ marginBottom: 20 }}>
            <label style={{
                display: "block",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: focused ? "rgba(220,185,130,0.9)" : "rgba(255,255,255,0.3)",
                marginBottom: 8,
                transition: "color 0.2s",
            }}>
                {label}
            </label>
            <div style={{ position: "relative" }}>
                {/* Left icon */}
                <span style={{
                    position: "absolute", left: 14, top: "50%",
                    transform: "translateY(-50%)", pointerEvents: "none",
                    color: focused ? "rgba(220,185,130,0.8)" : "rgba(255,255,255,0.2)",
                    transition: "color 0.2s", display: "flex",
                }}>
                    {icon}
                </span>
                <input
                    ref={inputRef}
                    {...props}
                    onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
                    onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
                    style={{
                        width: "100%",
                        padding: rightElement ? "13px 44px 13px 42px" : "13px 14px 13px 42px",
                        background: focused ? "rgba(220,185,130,0.05)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${focused ? "rgba(220,185,130,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: "#f0ece4",
                        fontSize: 14,
                        fontFamily: "inherit",
                        outline: "none",
                        transition: "all 0.2s",
                        boxSizing: "border-box",
                        boxShadow: focused ? "0 0 0 3px rgba(220,185,130,0.07)" : "none",
                        borderRadius: 0,
                    }}
                />
                {rightElement && (
                    <span style={{
                        position: "absolute", right: 13, top: "50%",
                        transform: "translateY(-50%)",
                    }}>
                        {rightElement}
                    </span>
                )}
            </div>
        </div>
    );
};

/* ── Main component ── */
const AdminLogin = () => {
    const { login, admin, loading } = useAdminAuth();
    const navigate = useNavigate();
    const form = useAdminForm();
    const emailRef = useRef(null);
    const [mounted, setMounted] = useState(false);

    // Entrance animation
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 60);
        return () => clearTimeout(t);
    }, []);

    // Redirect if already authenticated
    useEffect(() => {
        if (!loading && admin) {
            if (ADMIN_ROLES.includes(admin.role)) {
                navigate("/admin", { replace: true });
            } else {
                form.setError("Access denied. Admin accounts only.");
            }
        }
    }, [admin, loading, navigate, form]);

    // Focus email on mount
    useEffect(() => {
        if (mounted) emailRef.current?.focus();
    }, [mounted]);

    /* ── Submit ── */
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const { email, password, setError, setSubmitting } = form;

        if (!email.trim() || !password.trim()) {
            return setError("Email and password are required.");
        }

        try {
            setSubmitting(true);
            setError("");
            await login(email.trim(), password);
            navigate("/admin", { replace: true });
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Invalid credentials. Please try again."
            );
        } finally {
            form.setSubmitting(false);
        }
    }, [form, login, navigate]);

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#080b14",
            padding: "24px 16px",
            fontFamily: "'Jost', 'DM Sans', system-ui, sans-serif",
            position: "relative",
            overflow: "hidden",
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400&family=Jost:wght@300;400;500;600;700&display=swap');

                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                ::placeholder { color: rgba(255,255,255,0.15) !important; font-size: 13px; font-family: inherit; }

                @keyframes al-spin    { to { transform: rotate(360deg); } }
                @keyframes al-fadeIn  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
                @keyframes al-shake   { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
                @keyframes al-glow    { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
                @keyframes al-drift1  { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,20px) scale(1.05)} }
                @keyframes al-drift2  { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,15px) scale(1.03)} }

                .al-card { animation: al-fadeIn 0.55s cubic-bezier(0.22,1,0.36,1) both; }
                .al-error { animation: al-shake 0.35s ease; }

                .al-submit-btn {
                    width: 100%;
                    padding: 14px;
                    border: none; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    font-family: inherit;
                    font-size: 11px; font-weight: 700;
                    letter-spacing: 0.18em; text-transform: uppercase;
                    transition: all 0.25s;
                    position: relative; overflow: hidden;
                }
                .al-submit-btn::before {
                    content: '';
                    position: absolute; inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
                    opacity: 0; transition: opacity 0.2s;
                }
                .al-submit-btn:hover:not(:disabled)::before { opacity: 1; }
                .al-submit-btn:hover:not(:disabled) { transform: translateY(-1px); }
                .al-submit-btn:active:not(:disabled) { transform: scale(0.99); }
                .al-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .al-forgot {
                    background: none; border: none; cursor: pointer;
                    font-family: inherit; font-size: 11px; font-weight: 600;
                    letter-spacing: 0.06em; padding: 0;
                    color: rgba(220,185,130,0.6);
                    transition: color 0.2s; text-decoration: none;
                    text-transform: uppercase;
                }
                .al-forgot:hover { color: rgba(220,185,130,1); }
            `}</style>

            {/* ── Ambient blobs ── */}
            <div style={{
                position: "fixed", width: 600, height: 400,
                top: "-10%", left: "-15%", borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(220,185,130,0.07) 0%, transparent 65%)",
                filter: "blur(40px)", pointerEvents: "none",
                animation: "al-drift1 14s ease-in-out infinite",
            }} />
            <div style={{
                position: "fixed", width: 500, height: 350,
                bottom: "-5%", right: "-10%", borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(100,80,180,0.08) 0%, transparent 65%)",
                filter: "blur(40px)", pointerEvents: "none",
                animation: "al-drift2 18s ease-in-out infinite",
            }} />

            {/* ── Grid ── */}
            <div style={{
                position: "fixed", inset: 0, pointerEvents: "none",
                backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                `,
                backgroundSize: "52px 52px",
            }} />

            {/* ── Card ── */}
            <div
                className="al-card"
                style={{
                    position: "relative", zIndex: 10,
                    width: "100%", maxWidth: 400,
                    opacity: mounted ? 1 : 0,
                }}
            >
                {/* Outer glow border */}
                <div style={{
                    position: "absolute", inset: -1, zIndex: -1,
                    background: "linear-gradient(145deg, rgba(220,185,130,0.2), rgba(255,255,255,0.03) 50%, rgba(220,185,130,0.1))",
                }} />

                <div style={{
                    background: "rgba(10,13,22,0.97)",
                    backdropFilter: "blur(32px)",
                    boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(220,185,130,0.06) inset",
                    overflow: "hidden",
                }}>
                    {/* Top accent line */}
                    <div style={{
                        height: 1,
                        background: "linear-gradient(90deg, transparent, rgba(220,185,130,0.6) 40%, rgba(220,185,130,0.4) 60%, transparent)",
                    }} />

                    <div style={{ padding: "40px 36px 36px" }}>

                        {/* ── Brand ── */}
                        <div style={{ marginBottom: 36 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                                <div style={{
                                    width: 40, height: 40,
                                    background: "linear-gradient(135deg, rgba(220,185,130,0.15), rgba(220,185,130,0.05))",
                                    border: "1px solid rgba(220,185,130,0.25)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "rgba(220,185,130,0.9)",
                                }}>
                                    <FaShieldAlt size={15} />
                                </div>
                                <div>
                                    <div style={{
                                        fontFamily: "'Playfair Display', serif",
                                        fontSize: 18, fontWeight: 600,
                                        color: "#f0ece4", lineHeight: 1,
                                        letterSpacing: "0.02em",
                                    }}>
                                        Urbexon
                                    </div>
                                    <div style={{
                                        fontSize: 9, fontWeight: 600,
                                        letterSpacing: "0.22em", textTransform: "uppercase",
                                        color: "rgba(220,185,130,0.5)", marginTop: 4,
                                    }}>
                                        Admin Portal
                                    </div>
                                </div>
                            </div>

                            {/* Thin divider */}
                            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 28 }} />

                            <h1 style={{
                                fontFamily: "'Playfair Display', serif",
                                fontSize: "1.7rem", fontWeight: 600,
                                color: "#f0ece4", lineHeight: 1.2,
                                marginBottom: 6,
                            }}>
                                Sign In
                            </h1>
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.02em" }}>
                                Authorized personnel only
                            </p>
                        </div>

                        {/* ── Error ── */}
                        {form.error && (
                            <div
                                className="al-error"
                                key={form.error}
                                style={{
                                    marginBottom: 24,
                                    padding: "11px 14px",
                                    background: "rgba(220,60,60,0.08)",
                                    border: "1px solid rgba(220,60,60,0.2)",
                                    color: "#ff9999",
                                    fontSize: 13,
                                    display: "flex", gap: 10, alignItems: "flex-start",
                                    lineHeight: 1.55,
                                }}
                            >
                                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                                <span>{form.error}</span>
                            </div>
                        )}

                        {/* ── Form ── */}
                        <form onSubmit={handleSubmit}>

                            <Field
                                label="Email Address"
                                icon={<FaEnvelope size={12} />}
                                inputRef={emailRef}
                                type="email"
                                value={form.email}
                                onChange={(e) => { form.setEmail(e.target.value); form.clearError(); }}
                                placeholder="admin@urbexon.in"
                                autoComplete="email"
                            />

                            <div style={{ marginBottom: 28 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <label style={{
                                        fontSize: 10, fontWeight: 700,
                                        letterSpacing: "0.2em", textTransform: "uppercase",
                                        color: "rgba(255,255,255,0.3)",
                                    }}>
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        className="al-forgot"
                                        onClick={() => navigate("/admin/forgot-password")}
                                    >
                                        Forgot?
                                    </button>
                                </div>

                                <Field
                                    label=""
                                    icon={<FaLock size={12} />}
                                    type={form.showPassword ? "text" : "password"}
                                    value={form.password}
                                    onChange={(e) => { form.setPassword(e.target.value); form.clearError(); }}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    rightElement={
                                        <button
                                            type="button"
                                            onClick={form.togglePassword}
                                            aria-label={form.showPassword ? "Hide password" : "Show password"}
                                            style={{
                                                background: "none", border: "none",
                                                color: "rgba(255,255,255,0.25)", cursor: "pointer",
                                                padding: 4, display: "flex", alignItems: "center",
                                                transition: "color 0.2s",
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = "rgba(220,185,130,0.8)"}
                                            onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}
                                        >
                                            {form.showPassword ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                                        </button>
                                    }
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={form.submitting}
                                className="al-submit-btn"
                                style={{
                                    background: form.submitting
                                        ? "rgba(220,185,130,0.15)"
                                        : "linear-gradient(135deg, rgba(220,185,130,0.95), rgba(200,160,90,0.95))",
                                    color: form.submitting ? "rgba(220,185,130,0.6)" : "#0d0b08",
                                    boxShadow: form.submitting ? "none" : "0 6px 28px rgba(220,185,130,0.2)",
                                }}
                            >
                                {form.submitting ? (
                                    <>
                                        <div style={{
                                            width: 14, height: 14,
                                            border: "2px solid rgba(220,185,130,0.2)",
                                            borderTopColor: "rgba(220,185,130,0.8)",
                                            borderRadius: "50%",
                                            animation: "al-spin 0.7s linear infinite",
                                            flexShrink: 0,
                                        }} />
                                        Signing in…
                                    </>
                                ) : (
                                    <>
                                        <FaShieldAlt size={11} />
                                        Sign in to Dashboard
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* ── Footer ── */}
                    <div style={{
                        height: 1,
                        background: "linear-gradient(90deg, transparent, rgba(220,185,130,0.08), transparent)",
                    }} />
                    <div style={{
                        padding: "14px 36px",
                        display: "flex", justifyContent: "center", gap: 24,
                    }}>
                        {["SSL Secured", "Admin Only", "Urbexon © 2025"].map((label) => (
                            <span key={label} style={{
                                fontSize: 9, fontWeight: 600,
                                letterSpacing: "0.12em", textTransform: "uppercase",
                                color: "rgba(255,255,255,0.12)",
                                display: "flex", alignItems: "center", gap: 5,
                            }}>
                                <span style={{
                                    width: 3, height: 3, borderRadius: "50%",
                                    background: "rgba(220,185,130,0.3)",
                                    display: "inline-block",
                                }} />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;