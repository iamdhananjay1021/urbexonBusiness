import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FiLock, FiEye, FiEyeOff, FiGift, FiCheckCircle } from "react-icons/fi";
import { resetPassword } from "../api/authApi";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import Loader from "../design-system/Loader";

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
            await resetPassword(token, { password });
            setSuccess(true);
            setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Invalid or expired reset link");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[90vh] flex items-center justify-center px-4 bg-canvas">
            <SEO title="Reset Password" description="Set a new password for your Urbexon account." noindex />

            <div className="w-full max-w-md">
                <Card padding="none" className="overflow-hidden">
                    <div className="h-1.5 bg-accent" />

                    <div className="p-8">
                        {/* Logo */}
                        <div className="flex justify-center mb-6">
                            <div className="w-14 h-14 bg-accent rounded-[var(--radius-lg)] flex items-center justify-center shadow-md">
                                <FiGift size={24} className="text-white" aria-hidden="true" />
                            </div>
                        </div>

                        {!success ? (
                            <>
                                <h2 className="text-2xl font-bold text-primary text-center mb-1 font-display">Set New Password</h2>
                                <p className="text-center text-sm text-muted mb-7">
                                    Choose a strong password for your account
                                </p>

                                {error && <Alert variant="error" className="mb-5">{error}</Alert>}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <Input
                                        label="New Password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                        placeholder="Min. 6 characters"
                                        leadingIcon={FiLock}
                                        trailingIcon={showPassword ? FiEyeOff : FiEye}
                                        trailingIconLabel={showPassword ? "Hide password" : "Show password"}
                                        onTrailingIconClick={() => setShowPassword((s) => !s)}
                                    />

                                    <div>
                                        <Input
                                            label="Confirm Password"
                                            type={showConfirm ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                                            placeholder="Re-enter password"
                                            leadingIcon={FiLock}
                                            trailingIcon={showConfirm ? FiEyeOff : FiEye}
                                            trailingIconLabel={showConfirm ? "Hide password" : "Show password"}
                                            onTrailingIconClick={() => setShowConfirm((s) => !s)}
                                        />
                                        {/* Password match indicator */}
                                        {confirmPassword && (
                                            <p className={`text-xs mt-1.5 flex items-center gap-1 ${password === confirmPassword ? "text-success" : "text-error"}`}>
                                                {password === confirmPassword ? (
                                                    <><FiCheckCircle size={11} aria-hidden="true" /> Passwords match</>
                                                ) : (
                                                    "⚠️ Passwords do not match"
                                                )}
                                            </p>
                                        )}
                                    </div>

                                    <Button type="submit" variant="primary" className="w-full" loading={loading}>
                                        Reset Password
                                    </Button>
                                </form>
                            </>
                        ) : (
                            /* ── Success State ── */
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-success-tint rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FiCheckCircle size={32} className="text-[var(--color-success-500)]" aria-hidden="true" />
                                </div>
                                <h2 className="text-xl font-bold text-primary mb-2 font-display">Password Reset!</h2>
                                <p className="text-sm text-secondary mb-6">
                                    Your password has been updated successfully. Redirecting to login...
                                </p>
                                <Loader />
                            </div>
                        )}

                        {!success && (
                            <div className="mt-6 pt-6 border-t border-default text-center">
                                <Link to="/login" className="text-sm text-muted hover:text-primary transition-colors font-medium">
                                    Back to Login
                                </Link>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ResetPassword;
