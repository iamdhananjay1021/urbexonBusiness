/**
 * Vendor ResetPassword.jsx — Production v1.0
 * Purple theme matching vendor panel branding
 */
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FiLock, FiEye, FiEyeOff, FiAlertCircle, FiArrowLeft, FiCheckCircle } from "react-icons/fi";
import api from "../api/axios";

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
            <div style={{
                minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(135deg, #0f0d2e 0%, #1e1b4b 50%, #312e81 100%)",
                fontFamily: "'DM Sans', sans-serif", flexDirection: "column", gap: 16,
            }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>Invalid reset link</p>
                <Link to="/forgot-password" style={{ color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}>
                    ← Request a new link
                </Link>
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
            await api.post(`/auth/vendor/reset-password/${token}`, { password });
            setSuccess(true);
            setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Invalid or expired reset link");
        } finally {
            setLoading(false);
        }
    };

    const fieldStyle = {
        width: "100%", padding: "12px 14px 12px 42px",
        border: "1.5px solid #e5e7eb", borderRadius: 10,
        fontSize: 14, color: "#111827", outline: "none",
        fontFamily: "inherit", transition: "all 0.2s",
        boxSizing: "border-box", background: "#f9fafb",
        paddingRight: 42,
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
        .vrp-card { animation: slideUp 0.5s ease forwards; }
        .vrp-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15) !important; background: #fff !important; }
        .vrp-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(124,58,237,0.4); }
        .vrp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

            <div className="vrp-card" style={{
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
                            Set New Password
                        </h1>
                        <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
                            Choose a strong password for your vendor account
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
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                                    New Password
                                </label>
                                <div style={{ position: "relative" }}>
                                    <FiLock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="vrp-input"
                                        style={fieldStyle}
                                        placeholder="Min. 8 characters"
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setError(""); }}
                                        disabled={loading}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                                        background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 0,
                                    }}>
                                        {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                                    Confirm Password
                                </label>
                                <div style={{ position: "relative" }}>
                                    <FiLock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        className="vrp-input"
                                        style={fieldStyle}
                                        placeholder="Re-enter password"
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                                        disabled={loading}
                                    />
                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{
                                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                                        background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 0,
                                    }}>
                                        {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                    </button>
                                </div>
                                {confirmPassword && (
                                    <div style={{
                                        marginTop: 6, fontSize: 12, fontWeight: 600,
                                        color: password === confirmPassword ? "#16a34a" : "#dc2626",
                                        display: "flex", alignItems: "center", gap: 4,
                                    }}>
                                        {password === confirmPassword ? <><FiCheckCircle size={12} /> Passwords match</> : "Passwords do not match"}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="vrp-btn"
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
                                        Resetting...
                                    </>
                                ) : "Reset Password"}
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: "50%",
                            background: "linear-gradient(135deg, #16a34a, #22c55e)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 20px", fontSize: 28,
                        }}>✅</div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Password Reset!</h2>
                        <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 4 }}>
                            Your vendor account password has been updated.
                        </p>
                        <p style={{ fontSize: 12, color: "#9ca3af" }}>Redirecting to login in 3 seconds...</p>
                    </div>
                )}

                <div style={{ marginTop: 24, textAlign: "center" }}>
                    <Link to="/login" style={{
                        fontSize: 13, color: "#6b7280", textDecoration: "none",
                        fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                        <FiArrowLeft size={14} />
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
