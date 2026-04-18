import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FaLock, FaEye, FaEyeSlash, FaGift, FaCheckCircle } from "react-icons/fa";
import api from "../api/axios";
import SEO from "../components/SEO";

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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!password.trim()) return setError("Please enter a new password");
        if (password.length < 8) return setError("Password must be at least 8 characters");
        if (password !== confirmPassword) return setError("Passwords do not match");

        try {
            setLoading(true);
            setError("");
            await api.post(`/auth/reset-password/${token}`, { password });
            setSuccess(true);
            setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Invalid or expired reset link");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[90vh] flex items-center justify-center px-4 bg-gradient-to-br from-stone-100 via-amber-50/30 to-stone-100">
            <SEO title="Reset Password" description="Set a new password for your Urbexon account." noindex />
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
                .auth-font { font-family: 'DM Sans', sans-serif; }
                @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
                .fade-up { animation: fadeUp 0.4s ease forwards; }
                .input-field {
                    width:100%; padding: 12px 12px 12px 40px;
                    border: 1.5px solid #e7e5e4; border-radius: 12px;
                    font-size: 14px; background: #fafaf9;
                    outline: none; transition: all 0.2s;
                    font-family: 'DM Sans', sans-serif;
                }
                .input-field:focus {
                    border-color: #f59e0b;
                    background: white;
                    box-shadow: 0 0 0 3px rgba(245,158,11,0.12);
                }
            `}</style>

            <div className="auth-font w-full max-w-md fade-up">
                <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/80 border border-stone-100 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />

                    <div className="p-8">
                        {/* Logo */}
                        <div className="flex justify-center mb-6">
                            <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200 rotate-3 hover:rotate-0 transition-transform duration-300">
                                <FaGift size={24} className="text-white" />
                            </div>
                        </div>

                        {!success ? (
                            <>
                                <h2 className="text-2xl font-black text-zinc-900 text-center mb-1">Set New Password</h2>
                                <p className="text-center text-sm text-zinc-400 mb-7">
                                    Choose a strong password for your account
                                </p>

                                {error && (
                                    <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl flex items-center gap-2">
                                        <span>⚠️</span> {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {/* New Password */}
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 mb-1.5 block uppercase tracking-wide">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                                placeholder="Min. 6 characters"
                                                style={{ paddingRight: "44px" }}
                                                className="input-field"
                                            />
                                            <button type="button" onClick={() => setShowPassword(s => !s)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-500 transition-colors p-1">
                                                {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password */}
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 mb-1.5 block uppercase tracking-wide">
                                            Confirm Password
                                        </label>
                                        <div className="relative">
                                            <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
                                            <input
                                                type={showConfirm ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                                                placeholder="Re-enter password"
                                                style={{ paddingRight: "44px" }}
                                                className="input-field"
                                            />
                                            <button type="button" onClick={() => setShowConfirm(s => !s)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-500 transition-colors p-1">
                                                {showConfirm ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                                            </button>
                                        </div>

                                        {/* Password match indicator */}
                                        {confirmPassword && (
                                            <p className={`text-xs mt-1.5 flex items-center gap-1 ${password === confirmPassword ? "text-emerald-600" : "text-red-500"}`}>
                                                {password === confirmPassword
                                                    ? <><FaCheckCircle size={10} /> Passwords match</>
                                                    : "⚠️ Passwords do not match"
                                                }
                                            </p>
                                        )}
                                    </div>

                                    <button type="submit" disabled={loading}
                                        className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-60 shadow-lg shadow-amber-200 flex items-center justify-center gap-2">
                                        {loading ? (
                                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting...</>
                                        ) : "Reset Password"}
                                    </button>
                                </form>
                            </>
                        ) : (
                            /* ── Success State ── */
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FaCheckCircle size={32} className="text-emerald-500" />
                                </div>
                                <h2 className="text-xl font-black text-zinc-900 mb-2">Password Reset!</h2>
                                <p className="text-sm text-zinc-500 mb-6">
                                    Your password has been updated successfully. Redirecting to login...
                                </p>
                                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                            </div>
                        )}

                        {!success && (
                            <div className="mt-6 pt-6 border-t border-stone-100 text-center">
                                <Link to="/login" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors font-medium">
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

export default ResetPassword;