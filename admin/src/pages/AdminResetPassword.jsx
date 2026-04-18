import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FaLock, FaEye, FaEyeSlash, FaGift, FaCheckCircle } from "react-icons/fa";
import api from "../api/adminApi";

const AdminResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    // Redirect if no token
    if (!token) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0c29", color: "#fff", fontFamily: "'DM Sans',sans-serif", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 16, fontWeight: 600 }}>Invalid reset link</p>
                <Link to="/admin/forgot-password" style={{ color: "#f59e0b", textDecoration: "none", fontWeight: 600 }}>← Request a new link</Link>
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
            await api.post(`/auth/admin/reset-password/${token}`, { password });
            setSuccess(true);
            setTimeout(() => navigate("/admin/login"), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Invalid or expired reset link");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "'DM Sans', sans-serif",
            position: "relative",
            overflow: "hidden",
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;900&display=swap');
                @keyframes float1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
                @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(15px)} }
                @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
                @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
                @keyframes spin { to{transform:rotate(360deg)} }
                .login-card { animation: slideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards; }
                .orb1 { animation: float1 6s ease-in-out infinite; }
                .orb2 { animation: float2 8s ease-in-out infinite; }
                .shake { animation: shake 0.4s ease; }
                .btn-gradient {
                    background: linear-gradient(135deg, #f59e0b, #f97316, #ef4444);
                    background-size: 200%; transition: all 0.3s;
                }
                .btn-gradient:hover { background-position: right; transform: translateY(-1px); box-shadow: 0 8px 25px rgba(245,158,11,0.4); }
                .btn-gradient:active { transform: translateY(0); }
                .input-field {
                    width:100%; padding:14px 14px 14px 44px;
                    border-radius:12px; font-size:14px; font-family:'DM Sans',sans-serif;
                    outline:none; transition:all 0.3s; box-sizing:border-box;
                    background:rgba(255,255,255,0.07);
                    border:1.5px solid rgba(255,255,255,0.1);
                    color:#fff;
                }
                .input-field::placeholder { color:rgba(255,255,255,0.3); }
                .input-field:focus {
                    background:rgba(255,255,255,0.12);
                    border-color:rgba(251,191,36,0.6);
                    box-shadow:0 0 0 3px rgba(251,191,36,0.15);
                }
                .back-link {
                    color: rgba(255,255,255,0.4); font-size: 13px; font-weight: 600;
                    text-decoration: none; transition: color 0.2s;
                    display: flex; align-items: center; gap: 6px; justify-content: center;
                }
                .back-link:hover { color: rgba(255,255,255,0.8); }
            `}</style>

            {/* Background orbs */}
            <div className="orb1" style={{ position: "absolute", top: "10%", left: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,158,11,0.15),transparent 70%)", pointerEvents: "none" }} />
            <div className="orb2" style={{ position: "absolute", bottom: "15%", right: "8%", width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.2),transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)", backgroundSize: "50px 50px", pointerEvents: "none" }} />

            <div className="login-card" style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 10 }}>

                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{ width: 72, height: 72, margin: "0 auto 16px", borderRadius: "50%", background: "linear-gradient(135deg,#f59e0b,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px rgba(245,158,11,0.4)" }}>
                        <FaGift size={28} color="#fff" />
                    </div>
                    <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 900, color: "#fff", margin: 0 }}>
                        Urb<span style={{ color: "#f59e0b" }}>eXon</span> Admin
                    </h1>
                </div>

                {/* Card */}
                <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 24, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
                    <div style={{ height: 3, background: "linear-gradient(90deg,#f59e0b,#f97316,#ef4444,#8b5cf6,#6366f1)" }} />

                    <div style={{ padding: 28 }}>
                        {!success ? (
                            <>
                                <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 20, margin: "0 0 6px", textAlign: "center" }}>
                                    Set New Password
                                </h2>
                                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", marginBottom: 24 }}>
                                    Choose a strong password for your admin account
                                </p>

                                {error && (
                                    <div className="shake" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 12, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                        ⚠️ {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit}>
                                    {/* New Password */}
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                                            New Password
                                        </label>
                                        <div style={{ position: "relative" }}>
                                            <FaLock size={13} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Min. 6 characters"
                                                value={password}
                                                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                                className="input-field"
                                                style={{ paddingRight: 44 }}
                                            />
                                            <button type="button" onClick={() => setShowPassword(s => !s)}
                                                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 0 }}>
                                                {showPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password */}
                                    <div style={{ marginBottom: 24 }}>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                                            Confirm Password
                                        </label>
                                        <div style={{ position: "relative" }}>
                                            <FaLock size={13} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
                                            <input
                                                type={showConfirm ? "text" : "password"}
                                                placeholder="Re-enter password"
                                                value={confirmPassword}
                                                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                                                className="input-field"
                                                style={{ paddingRight: 44 }}
                                            />
                                            <button type="button" onClick={() => setShowConfirm(s => !s)}
                                                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 0 }}>
                                                {showConfirm ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                            </button>
                                        </div>

                                        {/* Match indicator */}
                                        {confirmPassword && (
                                            <p style={{ fontSize: 12, marginTop: 6, color: password === confirmPassword ? "#34d399" : "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
                                                {password === confirmPassword
                                                    ? <><FaCheckCircle size={10} /> Passwords match</>
                                                    : "⚠️ Passwords do not match"
                                                }
                                            </p>
                                        )}
                                    </div>

                                    <button type="submit" disabled={loading} className="btn-gradient"
                                        style={{ width: "100%", padding: "14px", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans',sans-serif" }}>
                                        {loading ? (
                                            <><div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Resetting...</>
                                        ) : "Reset Password"}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div style={{ textAlign: "center", padding: "16px 0" }}>
                                <div style={{ width: 64, height: 64, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                                    <FaCheckCircle size={28} color="#34d399" />
                                </div>
                                <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 20, margin: "0 0 8px" }}>Password Reset!</h2>
                                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
                                    Your password has been updated. Redirecting to login...
                                </p>
                                <div style={{ width: 32, height: 32, border: "3px solid rgba(245,158,11,0.3)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
                            </div>
                        )}

                        {!success && (
                            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                                <Link to="/admin/login" className="back-link">
                                    Back to Login
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminResetPassword;