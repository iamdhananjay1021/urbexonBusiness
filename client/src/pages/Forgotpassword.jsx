import { useState } from "react";
import { Link } from "react-router-dom";
import { FaEnvelope, FaGift, FaArrowLeft } from "react-icons/fa";
import api from "../api/axios";
import SEO from "../components/SEO";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) return setError("Please enter your email");

        try {
            setLoading(true);
            setError("");
            await api.post("/auth/forgot-password", { email: email.trim() });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[90vh] flex items-center justify-center px-4 bg-gradient-to-br from-stone-100 via-amber-50/30 to-stone-100">
            <SEO title="Forgot Password" description="Reset your Urbexon account password." path="/forgot-password" noindex />
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
                                <h2 className="text-2xl font-black text-zinc-900 text-center mb-1">Forgot Password?</h2>
                                <p className="text-center text-sm text-zinc-400 mb-7">
                                    Enter your email and we'll send you a reset link
                                </p>

                                {error && (
                                    <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl flex items-center gap-2">
                                        <span>⚠️</span> {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 mb-1.5 block uppercase tracking-wide">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                                                placeholder="your@email.com"
                                                className="input-field"
                                            />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={loading}
                                        className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-60 shadow-lg shadow-amber-200 flex items-center justify-center gap-2">
                                        {loading ? (
                                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                                        ) : "Send Reset Link"}
                                    </button>
                                </form>
                            </>
                        ) : (
                            /* ── Success State ── */
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">📧</span>
                                </div>
                                <h2 className="text-xl font-black text-zinc-900 mb-2">Check Your Email</h2>
                                <p className="text-sm text-zinc-500 mb-2">
                                    We've sent a password reset link to
                                </p>
                                <p className="text-sm font-bold text-amber-600 mb-4">{email}</p>
                                <p className="text-xs text-zinc-400 mb-6">
                                    Link expires in 15 minutes. Check spam folder if not received.
                                </p>
                                <button
                                    onClick={() => { setSuccess(false); setEmail(""); }}
                                    className="text-sm text-amber-600 font-bold hover:text-amber-700 transition-colors">
                                    Try a different email
                                </button>
                            </div>
                        )}

                        <div className="mt-6 pt-6 border-t border-stone-100 text-center">
                            <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-zinc-600 transition-colors font-medium">
                                <FaArrowLeft size={11} /> Back to Login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;