/**
 * Vendor ForgotPassword.jsx — Production v1.0
 * Purple theme matching vendor panel branding
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiMail, FiAlertCircle, FiArrowLeft, FiSend } from "react-icons/fi";
import api from "../api/axios";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown <= 0) return;
        const t = setInterval(() => setCountdown(c => c - 1), 1000);
        return () => clearInterval(t);
    }, [countdown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) return setError("Email address is required");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            return setError("Please enter a valid email address");

        try {
            setLoading(true);
            setError("");
            await api.post("/auth/vendor/forgot-password", { email: email.trim() });
            setSuccess(true);
            setCountdown(60);
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0 || loading) return;
        try {
            setLoading(true);
            await api.post("/auth/vendor/forgot-password", { email: email.trim() });
            setCountdown(60);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to resend. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #0f0d2e 0%, #1e1b4b 50%, #312e81 100%)",
            padding: 20,
            fontFamily: "'DM Sans', -apple-system, sans-serif",
        }}>
            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .vfp-card { animation: slideUp 0.5s ease forwards; }
        .vfp-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15) !important; background: #fff !important; }
        .vfp-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(124,58,237,0.4); }
        .vfp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .vfp-back:hover { color: #7c3aed !important; }
      `}</style>

            <div className="vfp-card" style={{
                background: "#fff", borderRadius: 20,
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
                padding: "44px 40px", width: "100%", maxWidth: 420,
            }}>
                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20, fontWeight: 900, color: "#fff",
                    }}>U</div>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f0d2e", letterSpacing: 1 }}>URBEXON</div>
                    </div>
                </div>

                {!success ? (
                    <>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", textAlign: "center", marginBottom: 6 }}>
                            Forgot Password?
                        </h1>
                        <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
                            Enter your vendor account email and we'll send you a reset link.
                        </p>

                        {error && (
                            <div style={{
                                background: "#fef2f2", border: "1px solid #fecaca",
                                color: "#b91c1c", padding: "11px 14px", borderRadius: 10,
                                fontSize: 13, marginBottom: 20,
                                display: "flex", alignItems: "center", gap: 8,
                            }}>
                                <FiAlertCircle size={15} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                                    Email Address
                                </label>
                                <div style={{ position: "relative" }}>
                                    <FiMail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                                    <input
                                        type="email"
                                        className="vfp-input"
                                        style={{
                                            width: "100%", padding: "12px 14px 12px 42px",
                                            border: "1.5px solid #e5e7eb", borderRadius: 10,
                                            fontSize: 14, color: "#111827", outline: "none",
                                            fontFamily: "inherit", transition: "all 0.2s",
                                            boxSizing: "border-box", background: "#f9fafb",
                                        }}
                                        placeholder="vendor@example.com"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(""); }}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="vfp-btn"
                                disabled={loading}
                                style={{
                                    width: "100%", padding: "13px",
                                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                                    border: "none", borderRadius: 12,
                                    color: "#fff", fontSize: 15, fontWeight: 700,
                                    cursor: "pointer", fontFamily: "inherit",
                                    transition: "all 0.2s",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                }}
                            >
                                {loading ? (
                                    <>
                                        <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <FiSend size={15} />
                                        Send Reset Link
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: "50%",
                            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 20px", fontSize: 28,
                        }}>✉️</div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Check Your Email</h2>
                        <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 8 }}>
                            We've sent a password reset link to
                        </p>
                        <p style={{
                            display: "inline-block", background: "#f3f0ff",
                            border: "1px solid #ddd6fe", color: "#7c3aed",
                            padding: "4px 14px", borderRadius: 20,
                            fontSize: 13, fontWeight: 700, marginBottom: 20,
                        }}>{email}</p>
                        <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
                            Link expires in 15 minutes. Check spam folder if not found.
                        </p>
                        <button
                            onClick={handleResend}
                            disabled={countdown > 0 || loading}
                            style={{
                                background: "none", border: "none",
                                color: countdown > 0 ? "#9ca3af" : "#7c3aed",
                                fontSize: 13, fontWeight: 700, cursor: countdown > 0 ? "default" : "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            {countdown > 0 ? `Resend in ${countdown}s` : "Resend Email"}
                        </button>
                    </div>
                )}

                <div style={{ marginTop: 24, textAlign: "center" }}>
                    <Link to="/login" className="vfp-back" style={{
                        fontSize: 13, color: "#6b7280", textDecoration: "none",
                        fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
                        transition: "color 0.2s",
                    }}>
                        <FiArrowLeft size={14} />
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
