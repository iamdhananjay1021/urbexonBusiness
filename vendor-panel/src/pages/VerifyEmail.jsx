/**
 * VerifyEmail.jsx — Email OTP Verification
 * ✅ OTP entry page after login
 * ✅ Resend OTP functionality
 * ✅ Countdown timer
 */
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiMail, FiAlertCircle, FiCheck } from "react-icons/fi";
import api from "../api/axios";

const VerifyEmail = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [canResend, setCanResend] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Get email from location state
    const email = location.state?.email;

    // Initialize 30 second countdown on mount
    useEffect(() => {
        setCountdown(30);
        setCanResend(false);
    }, []);

    // Redirect if no email in state
    useEffect(() => {
        if (!email) {
            navigate("/login", { replace: true });
        }
    }, [email, navigate]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) {
            setCanResend(true);
            return;
        }

        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!otp.trim()) {
            setError("Please enter the OTP");
            return;
        }

        if (otp.length < 4) {
            setError("OTP must be at least 4 digits");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const { data } = await api.post("/auth/verify-otp", {
                email: email.trim(),
                otp: otp.trim(),
            });

            if (data.success) {
                // Save token and user data
                if (data.token) {
                    localStorage.setItem("vendorAuth", JSON.stringify({
                        token: data.token,
                        vendor: {
                            _id: data._id,
                            name: data.name,
                            email: data.email,
                            phone: data.phone,
                            role: data.role,
                            token: data.token,
                        },
                    }));
                    api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
                }

                setSuccess(true);
                setTimeout(() => {
                    navigate("/apply");
                }, 1500);
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.message ||
                "Verification failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend || countdown > 0) return;

        try {
            setLoading(true);
            setError("");

            const { data } = await api.post("/auth/resend-otp", {
                email: email.trim(),
            });

            if (data.success) {
                setError("");
                setOtp("");
                setCountdown(60);
                setCanResend(false);
                setError("New OTP sent to your email!");
                setTimeout(() => setError(""), 3000);
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.message ||
                "Failed to resend OTP"
            );
        } finally {
            setLoading(false);
        }
    };

    const otpInputStyle = {
        width: "100%",
        padding: "12px 14px",
        border: "1.5px solid #e5e7eb",
        borderRadius: 10,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: "8px",
        color: "#111827",
        outline: "none",
        fontFamily: "'Courier New', monospace",
        transition: "all 0.2s",
        boxSizing: "border-box",
        background: "#f9fafb",
    };

    const buttonStyle = {
        width: "100%",
        padding: "14px 18px",
        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
        color: "#fff",
        border: "none",
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 700,
        cursor: loading || !otp ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        opacity: loading || !otp ? 0.6 : 1,
        boxShadow: loading || !otp ? "none" : "0 4px 12px rgba(124,58,237,0.2)",
    };

    if (!email) return null;

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0f0d2e 0%, #1e1b4b 50%, #312e81 100%)",
                padding: 20,
                fontFamily: "'DM Sans', -apple-system, sans-serif",
            }}
        >
            <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        .otp-input::placeholder {
          color: #d1d5db;
          opacity: 0.7;
        }
        .otp-input:focus {
          border-color: #7c3aed !important;
          box-shadow: 0 0 0 3px rgba(124,58,237,0.15) !important;
          background: #fff !important;
        }
        .otp-input:disabled {
          opacity: 0.6;
          background: #f3f4f6 !important;
          cursor: not-allowed;
        }
        .verify-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(124,58,237,0.35) !important;
        }
        .verify-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .verify-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .verify-card {
          animation: slideIn 0.4s ease-out;
        }
      `}</style>

            <div
                className="verify-card"
                style={{
                    background: "#fff",
                    borderRadius: 20,
                    boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
                    padding: "40px 32px",
                    width: "100%",
                    maxWidth: 420,
                }}
            >
                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
                    <div
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            fontWeight: 900,
                            color: "#fff",
                        }}
                    >
                        U
                    </div>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f0d2e", letterSpacing: 1 }}>
                            URBEXON
                        </div>
                    </div>
                </div>

                {success ? (
                    <div style={{ textAlign: "center" }}>
                        <div
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                background: "#d1fae5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 24px",
                            }}
                        >
                            <FiCheck size={32} color="#059669" />
                        </div>
                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
                            Email Verified!
                        </h2>
                        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
                            Your email has been verified successfully. Redirecting...
                        </p>
                    </div>
                ) : (
                    <>
                        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", textAlign: "center", marginBottom: 6 }}>
                            Verify Email
                        </h1>
                        <div style={{ textAlign: "center", marginBottom: 28 }}>
                            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 8, margin: 0 }}>
                                We've sent a 6-digit OTP to
                            </p>
                            <div style={{
                                background: "#f3f4f6",
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                padding: "8px 12px",
                                marginBottom: 0,
                                wordBreak: "break-all",
                                overflowWrap: "break-word"
                            }}>
                                <strong style={{ color: "#111827", fontSize: 13, fontWeight: 600 }}>{email}</strong>
                            </div>
                        </div>

                        {error && (
                            <div
                                style={{
                                    background: error.includes("sent") ? "#dcfce7" : "#fef2f2",
                                    border: `1.5px solid ${error.includes("sent") ? "#86efac" : "#fecaca"}`,
                                    color: error.includes("sent") ? "#166534" : "#991b1b",
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    marginBottom: 20,
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    animation: "slideIn 0.3s ease-out",
                                }}
                            >
                                <FiAlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                                    Enter OTP
                                </label>
                                <div style={{ position: "relative" }}>
                                    <FiMail
                                        size={18}
                                        style={{
                                            position: "absolute",
                                            left: 12,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            color: "#9ca3af",
                                        }}
                                    />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Enter 4-6 digit OTP"
                                        maxLength="6"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                        className="otp-input"
                                        style={otpInputStyle}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="verify-btn"
                                style={buttonStyle}
                                disabled={loading || !otp}
                            >
                                {loading ? "Verifying..." : "Verify OTP"}
                            </button>
                        </form>

                        <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #e5e7eb", textAlign: "center" }}>
                            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, margin: "0 0 12px" }}>
                                Didn't receive the OTP?
                            </p>
                            <button
                                onClick={handleResend}
                                disabled={!canResend || countdown > 0}
                                style={{
                                    background: canResend && countdown <= 0 ? "#f3f4f6" : "transparent",
                                    border: "1.5px solid #e5e7eb",
                                    color: countdown > 0 ? "#6b7280" : "#7c3aed",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    padding: "8px 16px",
                                    borderRadius: 8,
                                    cursor: canResend && countdown <= 0 ? "pointer" : "not-allowed",
                                    transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                    if (canResend && countdown <= 0) {
                                        e.target.style.background = "#ede9fe";
                                        e.target.style.borderColor = "#7c3aed";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (canResend && countdown <= 0) {
                                        e.target.style.background = "#f3f4f6";
                                        e.target.style.borderColor = "#e5e7eb";
                                    }
                                }}
                            >
                                {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
