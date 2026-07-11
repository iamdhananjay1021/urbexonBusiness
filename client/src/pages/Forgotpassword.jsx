import { useState } from "react";
import { Link } from "react-router-dom";
import { FiMail, FiGift, FiArrowLeft } from "react-icons/fi";
import { forgotPassword } from "../api/authApi";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";

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
            await forgotPassword({ email: email.trim() });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[90vh] flex items-center justify-center px-4 bg-canvas">
            <SEO title="Forgot Password" description="Reset your Urbexon account password." path="/forgot-password" noindex />

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
                                <h2 className="text-2xl font-bold text-primary text-center mb-1 font-display">Forgot Password?</h2>
                                <p className="text-center text-sm text-muted mb-7">
                                    Enter your email and we'll send you a reset link
                                </p>

                                {error && (
                                    <Alert variant="error" className="mb-5">{error}</Alert>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <Input
                                        label="Email Address"
                                        type="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                                        placeholder="your@email.com"
                                        leadingIcon={FiMail}
                                    />

                                    <Button type="submit" variant="primary" className="w-full" loading={loading}>
                                        Send Reset Link
                                    </Button>
                                </form>
                            </>
                        ) : (
                            /* ── Success State ── */
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-success-tint rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">📧</span>
                                </div>
                                <h2 className="text-xl font-bold text-primary mb-2 font-display">Check Your Email</h2>
                                <p className="text-sm text-secondary mb-2">
                                    We've sent a password reset link to
                                </p>
                                <p className="text-sm font-bold text-accent mb-4">{email}</p>
                                <p className="text-xs text-muted mb-6">
                                    Link expires in 15 minutes. Check spam folder if not received.
                                </p>
                                <button
                                    onClick={() => { setSuccess(false); setEmail(""); }}
                                    className="text-sm text-accent font-bold hover:text-[var(--accent-primary-hover)] transition-colors">
                                    Try a different email
                                </button>
                            </div>
                        )}

                        <div className="mt-6 pt-6 border-t border-default text-center">
                            <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted hover:text-primary transition-colors font-medium">
                                <FiArrowLeft size={13} aria-hidden="true" /> Back to Login
                            </Link>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ForgotPassword;
