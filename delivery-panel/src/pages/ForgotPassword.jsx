/**
 * Delivery ForgotPassword.jsx — Production v1.0
 * Green/Navy theme matching delivery panel branding
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaMotorcycle } from "react-icons/fa";
import api from "../api/axios";

const CSS = `
*{box-sizing:border-box}
.dfp-root{min-height:100vh;background:linear-gradient(135deg,#0f172a 0%,#134e2a 100%);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.dfp-card{background:#fff;border-radius:16px;padding:36px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:slideUp .5s ease forwards}
.dfp-logo{text-align:center;margin-bottom:24px}
.dfp-title{font-size:22px;font-weight:800;color:#1e293b;margin:0 0 4px}
.dfp-sub{font-size:13px;color:#94a3b8;margin:0}
.dfp-label{display:block;font-size:11px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.dfp-inp{width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;transition:border .15s;font-family:inherit;box-sizing:border-box}
.dfp-inp:focus{border-color:#22c55e}
.dfp-btn{width:100%;padding:13px;background:#0f172a;border:none;color:#22c55e;font-size:14px;font-weight:800;letter-spacing:1.5px;border-radius:9px;cursor:pointer;margin-top:20px;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
.dfp-btn:hover:not(:disabled){background:#1e293b}
.dfp-btn:disabled{opacity:.5;cursor:not-allowed}
.dfp-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-top:12px}
.dfp-back{display:inline-flex;align-items:center;gap:6px;color:#64748b;font-size:13px;font-weight:600;text-decoration:none;transition:color .2s}
.dfp-back:hover{color:#22c55e}
.dfp-email-badge{display:inline-block;background:#f0fdf4;border:1px solid #dcfce7;color:#16a34a;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;margin-bottom:16px}
.dfp-resend{background:none;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;padding:6px 12px;border-radius:8px;transition:all .2s}
.dfp-resend:not(:disabled):hover{background:rgba(34,197,94,.1)}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
`;

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
            await api.post("/auth/delivery/forgot-password", { email: email.trim() });
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
            await api.post("/auth/delivery/forgot-password", { email: email.trim() });
            setCountdown(60);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to resend. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dfp-root">
            <style>{CSS}</style>
            <div className="dfp-card">
                <div className="dfp-logo">
                    <FaMotorcycle size={32} color="#22c55e" />
                    <h1 className="dfp-title">Forgot Password?</h1>
                    <p className="dfp-sub">URBEXON — Delivery Partner</p>
                </div>

                {!success ? (
                    <>
                        <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
                            Enter your delivery account email and we'll send you a password reset link.
                        </p>

                        {error && <div className="dfp-err">{error}</div>}

                        <form onSubmit={handleSubmit}>
                            <label className="dfp-label" style={{ marginTop: 14 }}>Email Address</label>
                            <input
                                className="dfp-inp"
                                type="email"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(""); }}
                                placeholder="aapka@email.com"
                                required
                                disabled={loading}
                            />

                            <button type="submit" className="dfp-btn" disabled={loading}>
                                {loading ? (
                                    <>
                                        <div style={{ width: 16, height: 16, border: "2px solid rgba(34,197,94,.3)", borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                                        SENDING...
                                    </>
                                ) : "SEND RESET LINK"}
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: "50%",
                            background: "#f0fdf4", border: "2px solid #dcfce7",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 16px", fontSize: 24,
                        }}>✉️</div>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>Check Your Email</h2>
                        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 8 }}>
                            We've sent a password reset link to
                        </p>
                        <div className="dfp-email-badge">{email}</div>
                        <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
                            Link expires in 15 minutes. Check spam if not found.
                        </p>
                        <button
                            onClick={handleResend}
                            disabled={countdown > 0 || loading}
                            className="dfp-resend"
                            style={{ color: countdown > 0 ? "#94a3b8" : "#22c55e" }}
                        >
                            {countdown > 0 ? `Resend in ${countdown}s` : "Resend Email"}
                        </button>
                    </div>
                )}

                <div style={{ marginTop: 24, textAlign: "center" }}>
                    <Link to="/login" className="dfp-back">← Back to Login</Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
