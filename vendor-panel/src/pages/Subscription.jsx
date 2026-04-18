/**
 * Subscription.jsx — v1.0 Production
 * Vendor Subscription Management with Razorpay Payment Integration
 * Plan selection, payment, status, history
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import {
    FiCheck, FiClock, FiAlertCircle, FiCreditCard,
    FiPackage, FiRefreshCw, FiShield, FiStar, FiZap,
} from "react-icons/fi";

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const STATUS_MAP = {
    active: { bg: "#d1fae5", color: "#065f46", label: "Active", icon: FiCheck },
    expired: { bg: "#fee2e2", color: "#b91c1c", label: "Expired", icon: FiAlertCircle },
    inactive: { bg: "#f3f4f6", color: "#6b7280", label: "Inactive", icon: FiClock },
    pending: { bg: "#fef3c7", color: "#92400e", label: "Pending", icon: FiClock },
    pending_payment: { bg: "#fef3c7", color: "#92400e", label: "Pending Payment", icon: FiCreditCard },
    cancelled: { bg: "#fee2e2", color: "#b91c1c", label: "Cancelled", icon: FiAlertCircle },
};

const PLAN_ICONS = {
    starter: FiPackage,
    basic: FiShield,
    standard: FiStar,
    premium: FiZap,
};

const PLAN_COLORS = {
    starter: { bg: "#f3f4f6", border: "#d1d5db", accent: "#6b7280" },
    basic: { bg: "#eff6ff", border: "#93c5fd", accent: "#2563eb" },
    standard: { bg: "#faf5ff", border: "#c4b5fd", accent: "#7c3aed" },
    premium: { bg: "#fefce8", border: "#fbbf24", accent: "#d97706" },
};

const PAYMENT_STATUS = {
    success: { bg: "#d1fae5", color: "#065f46", label: "Success" },
    failed: { bg: "#fee2e2", color: "#b91c1c", label: "Failed" },
    pending: { bg: "#fef3c7", color: "#92400e", label: "Pending" },
};

const Subscription = () => {
    const [plans, setPlans] = useState(null);
    const [currentSub, setCurrentSub] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [months, setMonths] = useState(1);
    const [paying, setPaying] = useState(false);
    const [msg, setMsg] = useState({ text: "", type: "" });

    const showMsg = (text, type = "info") => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: "", type: "" }), 5000);
    };

    const loadData = useCallback(async () => {
        try {
            const [plansRes, historyRes] = await Promise.all([
                api.get("/vendor/subscription/plans"),
                api.get("/vendor/subscription/payment-history"),
            ]);
            setPlans(plansRes.data.plans);
            setCurrentSub(plansRes.data.currentSubscription);
            setPayments(historyRes.data.payments || []);
        } catch {
            setError("Failed to load subscription data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Razorpay Payment Flow ──────────────────────────
    const handlePayment = async (plan) => {
        if (!plan || paying) return;
        setPaying(true);

        try {
            // Step 1: Create Razorpay order
            const { data: orderData } = await api.post("/vendor/subscription/create-order", {
                plan,
                months,
            });

            if (!orderData.success) {
                showMsg(orderData.message || "Failed to create order", "error");
                setPaying(false);
                return;
            }

            // Step 2: Open Razorpay checkout
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: orderData.order.amount,
                currency: orderData.order.currency,
                name: "Urbexon Hour",
                description: `${orderData.plan.label} Plan - ${orderData.plan.months} Month${orderData.plan.months > 1 ? "s" : ""}`,
                order_id: orderData.order.id,
                handler: async (response) => {
                    try {
                        // Step 3: Verify payment on server
                        const { data: verifyData } = await api.post("/vendor/subscription/verify-payment", {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });

                        if (verifyData.success) {
                            showMsg(verifyData.message || "Subscription activated!", "success");
                            loadData(); // Refresh
                        } else {
                            showMsg(verifyData.message || "Verification failed", "error");
                        }
                    } catch (err) {
                        showMsg(err.response?.data?.message || "Payment verification failed", "error");
                    } finally {
                        setPaying(false);
                    }
                },
                modal: {
                    ondismiss: () => {
                        setPaying(false);
                        showMsg("Payment cancelled", "info");
                    },
                },
                prefill: {},
                theme: { color: "#111827" },
            };

            if (!window.Razorpay) {
                showMsg("Payment system not loaded. Please refresh.", "error");
                setPaying(false);
                return;
            }

            const rzp = new window.Razorpay(options);

            rzp.on("payment.failed", async (resp) => {
                try {
                    await api.post("/vendor/subscription/payment-failed", {
                        razorpay_order_id: orderData.order.id,
                        error_code: resp.error?.code,
                        error_description: resp.error?.description,
                    });
                } catch { /* silent */ }
                showMsg("Payment failed. You can retry anytime.", "error");
                setPaying(false);
                loadData();
            });

            rzp.open();
        } catch (err) {
            showMsg(err.response?.data?.message || "Failed to initiate payment", "error");
            setPaying(false);
        }
    };

    // ── Render ─────────────────────────────────────────
    if (loading) return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error && !plans) return (
        <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>{error}</div>
    );

    const status = currentSub?.status || "inactive";
    const statusInfo = STATUS_MAP[status] || STATUS_MAP.inactive;
    const StatusIcon = statusInfo.icon;
    const daysLeft = currentSub?.expiryDate
        ? Math.max(0, Math.ceil((new Date(currentSub.expiryDate) - new Date()) / 86400000))
        : 0;
    const isActive = status === "active" && daysLeft > 0;

    return (
        <div style={{ maxWidth: 1100 }}>
            <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .sub-plan-card:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,0.08)!important}
      `}</style>

            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Subscription</h1>
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Manage your plan and payments</p>
            </div>

            {/* Message Banner */}
            {msg.text && (
                <div style={{
                    padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 600,
                    background: msg.type === "success" ? "#d1fae5" : msg.type === "error" ? "#fee2e2" : "#dbeafe",
                    color: msg.type === "success" ? "#065f46" : msg.type === "error" ? "#b91c1c" : "#1d4ed8",
                    animation: "fadeUp .3s ease",
                }}>
                    {msg.text}
                </div>
            )}

            {/* Current Subscription Status */}
            <div style={{
                background: "#fff", borderRadius: 14, padding: 24, marginBottom: 24,
                border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <StatusIcon size={20} style={{ color: statusInfo.color }} />
                            <span style={{
                                padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                                background: statusInfo.bg, color: statusInfo.color,
                            }}>
                                {statusInfo.label}
                            </span>
                            {isActive && (
                                <span style={{ fontSize: 12, color: "#6b7280" }}>
                                    {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
                                </span>
                            )}
                        </div>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, textTransform: "capitalize" }}>
                            {currentSub?.plan || "No Plan"} Plan
                        </h2>
                        {currentSub?.expiryDate && (
                            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                                Expires: {new Date(currentSub.expiryDate).toLocaleDateString("en-IN", {
                                    day: "numeric", month: "short", year: "numeric"
                                })}
                            </p>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                                {currentSub?.maxProducts || 0}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>Product Limit</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                                {fmt(currentSub?.monthlyFee || 0)}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>Monthly Fee</div>
                        </div>
                    </div>
                </div>

                {/* Expiry Warning */}
                {isActive && daysLeft <= 7 && (
                    <div style={{
                        marginTop: 16, padding: "10px 14px", borderRadius: 8,
                        background: "#fef3c7", border: "1px solid #fbbf24", fontSize: 13, color: "#92400e",
                    }}>
                        <FiAlertCircle style={{ verticalAlign: "middle", marginRight: 6 }} />
                        Your subscription expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}. Renew now to avoid disruption.
                    </div>
                )}

                {/* Expired/Inactive CTA */}
                {(status === "expired" || status === "inactive" || status === "cancelled") && (
                    <div style={{
                        marginTop: 16, padding: "10px 14px", borderRadius: 8,
                        background: "#fee2e2", border: "1px solid #fca5a5", fontSize: 13, color: "#b91c1c",
                    }}>
                        <FiAlertCircle style={{ verticalAlign: "middle", marginRight: 6 }} />
                        {status === "expired" ? "Your subscription has expired." : "No active subscription."}{" "}
                        Select a plan below to continue selling on Urbexon Hour.
                    </div>
                )}
            </div>

            {/* Month Selector */}
            <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap",
            }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Duration:</span>
                {[1, 3, 6, 12].map(m => (
                    <button
                        key={m}
                        onClick={() => setMonths(m)}
                        style={{
                            padding: "6px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                            border: months === m ? "2px solid #111827" : "1px solid #d1d5db",
                            background: months === m ? "#111827" : "#fff",
                            color: months === m ? "#fff" : "#374151",
                            cursor: "pointer", transition: "all 0.15s",
                        }}
                    >
                        {m} Month{m > 1 ? "s" : ""}
                        {m >= 6 && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>Save {m === 6 ? "5" : "10"}%</span>}
                    </button>
                ))}
            </div>

            {/* Plan Cards */}
            {plans && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
                    {Object.entries(plans).map(([key, plan]) => {
                        const PlanIcon = PLAN_ICONS[key] || FiPackage;
                        const colors = PLAN_COLORS[key] || PLAN_COLORS.basic;
                        const isCurrent = currentSub?.plan === key && isActive;
                        const totalPrice = plan.monthlyFee * months;
                        const isStarter = plan.monthlyFee === 0;

                        return (
                            <div
                                key={key}
                                className="sub-plan-card"
                                style={{
                                    background: isCurrent ? colors.bg : "#fff",
                                    borderRadius: 14,
                                    padding: 24,
                                    border: `2px solid ${isCurrent ? colors.accent : colors.border}`,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                                    transition: "all 0.2s",
                                    position: "relative",
                                    cursor: "pointer",
                                }}
                                onClick={() => !isCurrent && !isStarter && setSelectedPlan(key)}
                            >
                                {isCurrent && (
                                    <div style={{
                                        position: "absolute", top: -1, right: 16,
                                        background: colors.accent, color: "#fff",
                                        padding: "3px 10px", borderRadius: "0 0 8px 8px",
                                        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                    }}>
                                        CURRENT
                                    </div>
                                )}

                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: colors.bg, display: "flex",
                                        alignItems: "center", justifyContent: "center",
                                    }}>
                                        <PlanIcon size={20} style={{ color: colors.accent }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", textTransform: "capitalize" }}>
                                            {plan.label}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                                            Up to {plan.maxProducts} products
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <span style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>
                                        {isStarter ? "Free" : fmt(plan.monthlyFee)}
                                    </span>
                                    {!isStarter && (
                                        <span style={{ fontSize: 13, color: "#6b7280" }}>/month</span>
                                    )}
                                </div>

                                {!isStarter && months > 1 && (
                                    <div style={{ fontSize: 12, color: colors.accent, fontWeight: 600, marginBottom: 12 }}>
                                        Total: {fmt(totalPrice)} for {months} months
                                    </div>
                                )}

                                <button
                                    disabled={isCurrent || isStarter || paying}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlePayment(key);
                                    }}
                                    style={{
                                        width: "100%", padding: "10px 0", borderRadius: 10,
                                        border: "none", fontSize: 13, fontWeight: 700,
                                        background: isCurrent ? "#d1d5db" : isStarter ? "#e5e7eb" : "#111827",
                                        color: isCurrent || isStarter ? "#6b7280" : "#fff",
                                        cursor: isCurrent || isStarter || paying ? "not-allowed" : "pointer",
                                        transition: "all 0.15s",
                                        opacity: paying ? 0.6 : 1,
                                    }}
                                >
                                    {paying && selectedPlan === key ? (
                                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                            <FiRefreshCw size={14} style={{ animation: "spin .8s linear infinite" }} />
                                            Processing...
                                        </span>
                                    ) : isCurrent ? (
                                        "Current Plan"
                                    ) : isStarter ? (
                                        "Contact Admin"
                                    ) : isActive ? (
                                        "Upgrade"
                                    ) : (
                                        "Subscribe Now"
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Payment History */}
            <div style={{
                background: "#fff", borderRadius: 14, padding: 24,
                border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 16px 0" }}>
                    <FiCreditCard style={{ verticalAlign: "middle", marginRight: 8 }} />
                    Payment History
                </h3>

                {payments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>
                        No payments yet
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                                    {["Date", "Plan", "Amount", "Months", "Method", "Status"].map(h => (
                                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: 12 }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p, i) => {
                                    const st = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending;
                                    return (
                                        <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                            <td style={{ padding: "10px 12px", color: "#374151" }}>
                                                {new Date(p.date).toLocaleDateString("en-IN", {
                                                    day: "numeric", month: "short", year: "numeric"
                                                })}
                                            </td>
                                            <td style={{ padding: "10px 12px", color: "#374151", textTransform: "capitalize" }}>
                                                {p.reference?.includes("ADMIN") ? "Manual" : "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827" }}>
                                                {fmt(p.amount)}
                                            </td>
                                            <td style={{ padding: "10px 12px", color: "#374151" }}>
                                                {p.months || 1}
                                            </td>
                                            <td style={{ padding: "10px 12px", color: "#374151", textTransform: "capitalize" }}>
                                                {p.method === "free_trial" ? "Trial" : p.method || "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px" }}>
                                                <span style={{
                                                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                                    background: st.bg, color: st.color,
                                                }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Subscription;
