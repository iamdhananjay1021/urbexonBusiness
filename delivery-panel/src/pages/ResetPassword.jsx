/**
 * Delivery ResetPassword.jsx — Production v1.0
 * Green/Navy theme matching delivery panel branding
 */
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FaMotorcycle, FaEye, FaEyeSlash, FaCheckCircle } from "react-icons/fa";
import api from "../api/axios";

const CSS = `
*{box-sizing:border-box}
.drp-root{min-height:100vh;background:linear-gradient(135deg,#0f172a 0%,#134e2a 100%);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.drp-card{background:#fff;border-radius:16px;padding:36px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:slideUp .5s ease forwards}
.drp-logo{text-align:center;margin-bottom:24px}
.drp-title{font-size:22px;font-weight:800;color:#1e293b;margin:0 0 4px}
.drp-sub{font-size:13px;color:#94a3b8;margin:0}
.drp-label{display:block;font-size:11px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;margin-top:14px}
.drp-inp{width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;transition:border .15s;font-family:inherit;box-sizing:border-box}
.drp-inp:focus{border-color:#22c55e}
.drp-pw{position:relative}
.drp-pw-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;padding:0}
.drp-btn{width:100%;padding:13px;background:#0f172a;border:none;color:#22c55e;font-size:14px;font-weight:800;letter-spacing:1.5px;border-radius:9px;cursor:pointer;margin-top:20px;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
.drp-btn:hover:not(:disabled){background:#1e293b}
.drp-btn:disabled{opacity:.5;cursor:not-allowed}
.drp-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-top:12px}
.drp-match{margin-top:6px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px}
.drp-back{display:inline-flex;align-items:center;gap:6px;color:#64748b;font-size:13px;font-weight:600;text-decoration:none;transition:color .2s}
.drp-back:hover{color:#22c55e}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
`;

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    if (!token) {
        return (
            <div className="drp-root">
                <style>{CSS}</style>
                <div className="drp-card" style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 12 }}>Invalid reset link</p>
                    <Link to="/forgot-password" style={{ color: "#22c55e", textDecoration: "none", fontWeight: 600 }}>
                        ← Request a new link
                    </Link>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password.trim()) return setError("Please enter a new password");
        if (password.length < 8) return setError("Password must be at least 8 characters");
        if (password !== confirmPassword) return setError("Passwords do not match");

        try {
            setLoading(true);
            setError("");
            await api.post(`/auth/delivery/reset-password/${token}`, { password });
            setSuccess(true);
            setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Invalid or expired reset link");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="drp-root">
            <style>{CSS}</style>
            <div className="drp-card">
                <div className="drp-logo">
                    <FaMotorcycle size={32} color="#22c55e" />
                    <h1 className="drp-title">{success ? "Password Reset!" : "Set New Password"}</h1>
                    <p className="drp-sub">URBEXON — Delivery Partner</p>
                </div>

                {!success ? (
                    <>
                        <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 16, lineHeight: 1.6 }}>
                            Choose a strong password for your delivery account
                        </p>

                        {error && <div className="drp-err">{error}</div>}

                        <form onSubmit={handleSubmit}>
                            <label className="drp-label">New Password</label>
                            <div className="drp-pw">
                                <input
                                    className="drp-inp"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError(""); }}
                                    placeholder="Min. 8 characters"
                                    required
                                    disabled={loading}
                                    style={{ paddingRight: 40 }}
                                />
                                <button type="button" className="drp-pw-btn" onClick={() => setShowPassword(s => !s)}>
                                    {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                                </button>
                            </div>

                            <label className="drp-label">Confirm Password</label>
                            <div className="drp-pw">
                                <input
                                    className="drp-inp"
                                    type={showConfirm ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                                    placeholder="Re-enter password"
                                    required
                                    disabled={loading}
                                    style={{ paddingRight: 40 }}
                                />
                                <button type="button" className="drp-pw-btn" onClick={() => setShowConfirm(s => !s)}>
                                    {showConfirm ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                                </button>
                            </div>

                            {confirmPassword && (
                                <div className="drp-match" style={{ color: password === confirmPassword ? "#16a34a" : "#dc2626" }}>
                                    {password === confirmPassword ? <><FaCheckCircle size={12} /> Passwords match</> : "Passwords do not match"}
                                </div>
                            )}

                            <button type="submit" className="drp-btn" disabled={loading}>
                                {loading ? (
                                    <>
                                        <div style={{ width: 16, height: 16, border: "2px solid rgba(34,197,94,.3)", borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                                        RESETTING...
                                    </>
                                ) : "RESET PASSWORD"}
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
                        }}>✅</div>
                        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 4 }}>
                            Your delivery account password has been updated.
                        </p>
                        <p style={{ fontSize: 12, color: "#94a3b8" }}>Redirecting to login in 3 seconds...</p>
                    </div>
                )}

                <div style={{ marginTop: 24, textAlign: "center" }}>
                    <Link to="/login" className="drp-back">← Back to Login</Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
