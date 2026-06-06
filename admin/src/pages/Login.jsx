import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaLock, FaEnvelope, FaShieldAlt, FaArrowLeft } from "react-icons/fa";

const AdminLogin = () => {
    const navigate = useNavigate();

    // ── Step 1 States (Credentials) ──
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // ── Step 2 States (2FA) ──
    const [is2faStep, setIs2faStep] = useState(false);
    const [otp, setOtp] = useState("");
    const [pendingToken, setPendingToken] = useState("");

    // ── UI States ──
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Handle initial email/password submission
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Ensure you have a configured axios instance or setup the base URL properly
            const { data } = await axios.post("/api/admin/login", { email, password });

            if (data.requires2fa) {
                // Shift UI to 2FA verification mode
                setPendingToken(data.pendingToken);
                setIs2faStep(true);
            } else {
                // Standard login success (HttpOnly cookie set by backend)
                navigate("/dashboard");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Login failed. Please check credentials.");
        } finally {
            setLoading(false);
        }
    };

    // Handle OTP submission
    const handleVerify2FA = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const { data } = await axios.post("/api/admin/verify-2fa", {
                pendingToken,
                otp,
            });

            if (data.success) {
                // 2FA successful! HttpOnly cookie is now set by the backend.
                navigate("/dashboard");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Invalid or expired OTP.");

            // If the 5-minute pending token expired, send them back to the login screen
            if (err.response?.data?.message?.toLowerCase().includes("expired")) {
                setTimeout(() => {
                    setIs2faStep(false);
                    setOtp("");
                }, 2500);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md">
                        {is2faStep ? <FaShieldAlt size={20} /> : <FaLock size={20} />}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        {is2faStep ? "Two-Factor Authentication" : "Admin Portal"}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {is2faStep
                            ? "Enter the 6-digit code from your authenticator app."
                            : "Sign in to access the enterprise dashboard."}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg font-medium text-center">
                        {error}
                    </div>
                )}

                {!is2faStep ? (
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                            <div className="relative">
                                <FaEnvelope className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
                                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" placeholder="admin@urbexon.in" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                            <div className="relative">
                                <FaLock className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
                                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" placeholder="••••••••" />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2 shadow-md">
                            {loading ? "Authenticating..." : "Sign In"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify2FA} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 text-center">Authenticator Code</label>
                            <input type="text" required maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" placeholder="000000" autoFocus />
                        </div>
                        <button type="submit" disabled={loading || otp.length !== 6} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md">
                            {loading ? "Verifying..." : "Verify & Access"}
                        </button>
                        <button type="button" onClick={() => setIs2faStep(false)} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                            <FaArrowLeft size={10} /> Back to Login
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AdminLogin;