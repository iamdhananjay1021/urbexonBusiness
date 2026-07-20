/**
 * Settings.jsx — v5.0 Production
 * Dynamic subscription info from API + security actions
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import {
  FiLock, FiAlertTriangle, FiKey, FiLogOut,
  FiCheckCircle, FiClock, FiAlertCircle, FiPackage, FiCalendar, FiCreditCard,
  FiArrowUpRight, FiArrowDownRight, FiX,
} from "react-icons/fi";

const PLAN_COLORS = {
  starter: "#6b7280",
  basic: "#3b82f6",
  standard: "#7c3aed",
  premium: "#f59e0b",
};

const STATUS_CONFIG = {
  active: { label: "Active", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: FiCheckCircle },
  expired: { label: "Expired", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: FiAlertCircle },
  cancelled: { label: "Cancelled", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: FiAlertCircle },
  pending_payment: { label: "Pending Payment", color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: FiClock },
};

const Subscription_PLANS_LABEL = (plans, key) => plans[key]?.label || key;

const Card = ({ title, icon: Icon, color, children }) => (
  <div style={{
    background: "#fff", borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    padding: 24, marginBottom: 16,
  }}>
    {title && (
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {Icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${color}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={18} color={color} />
          </div>
        )}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>{title}</h3>
      </div>
    )}
    {children}
  </div>
);

const Settings = () => {
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState({ text: "", type: "" });
  const [planModal, setPlanModal] = useState(null); // plan key to request
  const [planNote, setPlanNote] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planMsg, setPlanMsg] = useState({ text: "", type: "" });
  const [subError, setSubError] = useState("");

  const loadSubscription = () => {
    setLoading(true);
    setSubError("");
    api.get("/vendor/subscription")
      .then(r => {
        setSub(r.data.subscription);
        setPlans(r.data.plans || {});
      })
      // [FIX] Was a silent no-op catch — a suspended vendor (blocked here by
      // blockSuspendedVendor, which returns a clear 403 message) or any
      // other failure just left the whole Subscription & Plans section
      // blank with zero explanation and no way to retry.
      .catch(err => setSubError(err.response?.data?.message || "Failed to load subscription details"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSubscription(); }, []);

  const { logout } = useAuth();

  const changePassword = async () => {
    if (!pwForm.current || !pwForm.newPw) return setPwMsg({ text: "All fields required", type: "error" });
    if (pwForm.newPw.length < 8) return setPwMsg({ text: "Password must be at least 8 characters", type: "error" });
    if (pwForm.newPw !== pwForm.confirm) return setPwMsg({ text: "Passwords do not match", type: "error" });
    try {
      setPwLoading(true);
      await api.put("/auth/change-password", { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      // [FIX] The backend bumps the user's tokenVersion AND wipes all
      // refreshSessions on a successful change (see authController.js::
      // changePassword) — that invalidates THIS session's own access token
      // too, not just other devices, and the wiped refresh token means the
      // silent-refresh flow can't save it either. Previously this just
      // closed the modal and left the vendor looking "still logged in"
      // until their next click 401'd and force-logged them out with no
      // explanation. Now the logout is immediate and intentional instead.
      setPwMsg({ text: "Password changed! Logging you out for security — please log in again.", type: "success" });
      setPwForm({ current: "", newPw: "", confirm: "" });
      // pwLoading stays true so the modal can't be reopened/interacted with
      // during the redirect countdown — no `finally` reset on this path.
      setTimeout(() => { logout(); navigate("/login"); }, 1800);
    } catch (err) {
      setPwMsg({ text: err.response?.data?.message || "Failed to change password", type: "error" });
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRequestPlan = async () => {
    if (!planModal) return;
    try {
      setPlanLoading(true);
      setPlanMsg({ text: "", type: "" });
      const res = await api.post("/vendor/subscription/request-change", { plan: planModal, note: planNote.trim() });
      setSub(res.data.subscription);
      setPlanMsg({ text: res.data.message, type: "success" });
      setTimeout(() => { setPlanModal(null); setPlanNote(""); setPlanMsg({ text: "", type: "" }); }, 2000);
    } catch (err) {
      setPlanMsg({ text: err.response?.data?.message || "Failed to submit request", type: "error" });
    } finally { setPlanLoading(false); }
  };

  const handleCancelRequest = async () => {
    try {
      setPlanLoading(true);
      const res = await api.post("/vendor/subscription/cancel-request");
      setSub(res.data.subscription);
      setPlanMsg({ text: "", type: "" });
    } catch (err) {
      setPlanMsg({ text: err.response?.data?.message || "Failed to cancel", type: "error" });
    } finally { setPlanLoading(false); }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Manage your account and subscription</p>
      </div>

      {/* Security */}
      <Card title="Security" icon={FiLock} color="#10b981">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 0", borderBottom: "1px solid #f9fafb",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiKey size={15} color="#6b7280" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Change Password</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>Update your account password</div>
            </div>
          </div>
          <button onClick={() => { setPwModal(true); setPwMsg({ text: "", type: "" }); }} style={{
            padding: "7px 16px", border: "1.5px solid #e5e7eb",
            background: "#fff", borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
          }}>Change</button>
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiLogOut size={15} color="#6b7280" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Logout</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>Sign out of your vendor account</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            padding: "7px 16px", border: "1.5px solid #fecaca",
            background: "#fef2f2", borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: "#ef4444", cursor: "pointer",
          }}>Logout</button>
        </div>
      </Card>

      {/* Change Password Modal */}
      <Modal
        open={pwModal}
        onClose={() => setPwModal(false)}
        closeOnOverlayClick={!pwLoading}
        title="Change Password"
        width={420}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 20 }}>Change Password</h3>
        {pwMsg.text && (
          <div style={{
            background: pwMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${pwMsg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: pwMsg.type === "success" ? "#065f46" : "#b91c1c",
            padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13,
          }}>{pwMsg.text}</div>
        )}
        {[
          { label: "Current Password", key: "current", autoComplete: "current-password" },
          { label: "New Password", key: "newPw", autoComplete: "new-password" },
          { label: "Confirm Password", key: "confirm", autoComplete: "new-password" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{f.label}</label>
            <input
              type="password"
              autoComplete={f.autoComplete}
              value={pwForm[f.key]}
              onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
              style={{
                width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb",
                borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "#7c3aed"}
              onBlur={e => e.target.style.borderColor = "#e5e7eb"}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setPwModal(false)} disabled={pwLoading} style={{
            flex: 1, padding: 11, border: "1px solid #e5e7eb", background: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#6b7280",
            cursor: pwLoading ? "not-allowed" : "pointer", opacity: pwLoading ? 0.5 : 1,
          }}>Cancel</button>
          <button onClick={changePassword} disabled={pwLoading} style={{
            flex: 1, padding: 11, border: "none",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff",
            cursor: pwLoading ? "not-allowed" : "pointer", opacity: pwLoading ? 0.6 : 1,
          }}>{pwLoading ? "Changing..." : "Change Password"}</button>
        </div>
      </Modal>

      {/* Subscription */}
      {subError ? (
        <div style={{
          background: "#fff", borderRadius: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          padding: 24, marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FiAlertCircle size={18} color="#dc2626" />
            <span style={{ fontSize: 13, color: "#374151" }}>{subError}</span>
          </div>
          <button onClick={loadSubscription} style={{
            padding: "7px 16px", border: "1.5px solid #e5e7eb",
            background: "#fff", borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
          }}>Retry</button>
        </div>
      ) : (() => {
        const status = sub?.status || "pending_payment";
        const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_payment;
        const StatusIcon = statusCfg.icon;
        const currentPlan = sub?.plan || null;
        const planColor = PLAN_COLORS[currentPlan] || "#6b7280";
        const isActive = status === "active" && sub?.expiryDate && new Date(sub.expiryDate) > new Date();
        const daysLeft = sub?.expiryDate ? Math.max(0, Math.ceil((new Date(sub.expiryDate) - new Date()) / 86400000)) : 0;
        const planList = Object.entries(plans).map(([key, p]) => ({ key, ...p, color: PLAN_COLORS[key] || "#6b7280" }));

        return (
          <div style={{
            background: "#fff", borderRadius: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            padding: 24, marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              Subscription & Plans
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
              Manage your plan to list products on Urbexon
            </p>

            {/* BUG FIX: this section only ever offered "request a plan
                change → wait for admin" (the admin-manual-approval path,
                POST /vendor/subscription/request-change) and its copy told
                vendors to "contact admin to renew" — even though a fully
                working, instant self-serve Razorpay checkout already exists
                one click away at /subscription. A vendor landing here first
                had no way to discover it. This banner makes the faster path
                visible without removing the admin-approval option below
                (e.g. for vendors who'd rather pay via bank transfer/manual
                arrangement with admin). */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
              background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 12,
              padding: "14px 18px", marginBottom: 18,
            }}>
              <div style={{ fontSize: 13, color: "#5b21b6" }}>
                ⚡ Want to activate instantly? Pay online now via the Subscription page.
              </div>
              <button
                onClick={() => navigate("/subscription")}
                style={{
                  padding: "8px 16px", border: "none", borderRadius: 8,
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Pay Online →
              </button>
            </div>

            {/* Current Status Banner */}
            <div style={{
              background: statusCfg.bg, border: `1.5px solid ${statusCfg.border}`,
              borderRadius: 12, padding: "16px 18px", marginBottom: 18,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: `${statusCfg.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <StatusIcon size={20} color={statusCfg.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
                  {currentPlan && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: "#fff",
                      background: planColor, padding: "2px 10px",
                      borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5,
                    }}>{currentPlan}</span>
                  )}
                </div>
                {isActive ? (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {daysLeft > 0 ? (
                      <>{daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining · Expires {new Date(sub.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
                    ) : "Expires today"}
                  </div>
                ) : status === "expired" ? (
                  <div style={{ fontSize: 12, color: "#dc2626" }}>
                    Expired on {sub?.expiryDate ? new Date(sub.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}. Renew instantly on the Subscription page, or request a plan below.
                  </div>
                ) : status === "pending_payment" ? (
                  <div style={{ fontSize: 12, color: "#92400e" }}>
                    {sub ? "Payment pending. Pay instantly on the Subscription page, or contact admin." : "No subscription yet. Pay instantly on the Subscription page, or choose a plan below."}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Contact admin for assistance.</div>
                )}
              </div>
            </div>

            {/* Current Plan Details (if active subscription) */}
            {sub && (
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10,
                marginBottom: 18,
              }}>
                {[
                  { icon: FiPackage, label: "Product Limit", value: `${sub.maxProducts || "—"} products`, color: "#7c3aed" },
                  { icon: FiCreditCard, label: "Monthly Fee", value: sub.monthlyFee === 0 ? "Free" : `₹${sub.monthlyFee?.toLocaleString("en-IN")}/mo`, color: "#3b82f6" },
                  { icon: FiCalendar, label: "Start Date", value: sub.startDate ? new Date(sub.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—", color: "#10b981" },
                  { icon: FiClock, label: "Expiry Date", value: sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—", color: isActive ? "#10b981" : "#dc2626" },
                ].map((stat, i) => (
                  <div key={i} style={{
                    padding: "12px 14px", borderRadius: 10,
                    border: "1px solid #f3f4f6", background: "#fafafa",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <stat.icon size={13} color={stat.color} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.3 }}>{stat.label}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Expiry Warning */}
            {isActive && daysLeft <= 7 && daysLeft > 0 && (
              <div style={{
                background: "#fff7ed", border: "1px solid #fed7aa",
                borderRadius: 10, padding: "10px 14px", marginBottom: 18,
                fontSize: 13, color: "#c2410c", display: "flex", alignItems: "center", gap: 8,
              }}>
                <FiAlertTriangle size={15} />
                Your subscription expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}. Contact admin to renew.
              </div>
            )}

            {/* Pending Request Banner */}
            {sub?.requestedPlan && (
              <div style={{
                background: "#f5f3ff", border: "1.5px solid #ddd6fe",
                borderRadius: 12, padding: "14px 18px", marginBottom: 18,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FiClock size={18} color="#7c3aed" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>
                      Plan Change Requested → {Subscription_PLANS_LABEL(plans, sub.requestedPlan)}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                      Submitted {sub.planChangeRequestedAt ? new Date(sub.planChangeRequestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "recently"}. Admin will review shortly.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCancelRequest}
                  disabled={planLoading}
                  style={{
                    padding: "6px 14px", border: "1.5px solid #ddd6fe",
                    background: "#fff", borderRadius: 8,
                    fontSize: 12, fontWeight: 600, color: "#7c3aed", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                    opacity: planLoading ? 0.5 : 1,
                  }}
                >
                  <FiX size={13} /> Cancel
                </button>
              </div>
            )}

            {/* Plans Grid */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
              Available Plans
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {planList.map(plan => {
                const isCurrent = currentPlan === plan.key;
                const isPending = sub?.requestedPlan === plan.key;
                const planOrder = ["starter", "basic", "standard", "premium"];
                const currentIdx = planOrder.indexOf(currentPlan);
                const thisIdx = planOrder.indexOf(plan.key);
                const isUpgrade = thisIdx > currentIdx;
                const canRequest = !isCurrent && !sub?.requestedPlan;

                return (
                  <div key={plan.key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: 16, borderRadius: 12, flexWrap: "wrap", gap: 12,
                    border: `2px solid ${isPending ? "#7c3aed" : isCurrent ? plan.color : "#e5e7eb"}`,
                    background: isPending ? "#f5f3ff" : isCurrent ? `${plan.color}08` : "#fff",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{plan.label}</span>
                        {isCurrent && (
                          <span style={{
                            background: "#d1fae5", color: "#065f46",
                            fontSize: 10, fontWeight: 700,
                            padding: "2px 8px", borderRadius: 20,
                          }}>Current Plan</span>
                        )}
                        {isPending && (
                          <span style={{
                            background: "#ede9fe", color: "#7c3aed",
                            fontSize: 10, fontWeight: 700,
                            padding: "2px 8px", borderRadius: 20,
                          }}>Requested</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {plan.maxProducts} products{plan.key === "basic" ? ", standard support" : plan.key === "standard" ? ", priority support" : plan.key === "premium" ? ", dedicated support" : ", basic support"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: plan.color }}>
                          {plan.monthlyFee === 0 ? "Free" : `₹${plan.monthlyFee.toLocaleString("en-IN")}/mo`}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>Up to {plan.maxProducts} products</div>
                      </div>
                      {!isCurrent && !isPending && (
                        <button
                          onClick={() => { setPlanModal(plan.key); setPlanMsg({ text: "", type: "" }); setPlanNote(""); }}
                          disabled={!canRequest}
                          style={{
                            padding: "8px 16px", border: "none",
                            background: canRequest
                              ? (isUpgrade ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "#f3f4f6")
                              : "#f3f4f6",
                            borderRadius: 8,
                            fontSize: 12, fontWeight: 700,
                            color: canRequest ? (isUpgrade ? "#fff" : "#374151") : "#9ca3af",
                            cursor: canRequest ? "pointer" : "not-allowed",
                            display: "flex", alignItems: "center", gap: 4,
                            whiteSpace: "nowrap",
                            opacity: canRequest ? 1 : 0.5,
                          }}
                        >
                          {isUpgrade ? <><FiArrowUpRight size={13} /> Upgrade</> : <><FiArrowDownRight size={13} /> Switch</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment History */}
            {sub?.payments?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                  Payment History
                </div>
                <div style={{
                  border: "1px solid #f3f4f6", borderRadius: 10, overflow: "hidden",
                }}>
                  {sub.payments.slice().reverse().slice(0, 5).map((p, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px",
                      borderBottom: i < Math.min(sub.payments.length, 5) - 1 ? "1px solid #f9fafb" : "none",
                      fontSize: 13,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#111827" }}>
                          ₹{p.amount?.toLocaleString("en-IN")} · {p.months || 1} month{(p.months || 1) > 1 ? "s" : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                          {p.method === "razorpay" ? "Razorpay" : p.method === "free_trial" ? "Free Trial" : "Manual"}{p.reference ? ` · ${p.reference}` : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {p.date ? new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Admin */}
            <div style={{
              marginTop: 18, background: "#fefce8", border: "1px solid #fde68a",
              borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400e",
            }}>
              💡 The requests above are reviewed and activated by admin. To activate/change/renew instantly
              yourself instead, use the{" "}
              <button
                onClick={() => navigate("/subscription")}
                style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 700, color: "#7c3aed", textDecoration: "underline", cursor: "pointer" }}
              >
                Subscription page
              </button>{" "}
              to pay online. Or contact admin at <strong>officialurbexon@gmail.com</strong> / WhatsApp{" "}
              <strong>8808485840</strong>.
            </div>
          </div>
        );
      })()}

      {/* Plan Change Confirmation Modal */}
      <Modal
        open={!!planModal}
        onClose={() => { setPlanModal(null); setPlanMsg({ text: "", type: "" }); }}
        closeOnOverlayClick={!planLoading}
        title="Request Plan Change"
        width={420}
      >
        {planModal && (() => {
              const targetPlan = plans[planModal];
              const currentLabel = sub?.plan ? (plans[sub.plan]?.label || sub.plan) : "None";
              const targetLabel = targetPlan?.label || planModal;
              const targetColor = PLAN_COLORS[planModal] || "#7c3aed";
              return (
                <>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                    Request Plan Change
                  </h3>
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
                    Switch from <strong>{currentLabel}</strong> to{" "}
                    <strong style={{ color: targetColor }}>{targetLabel}</strong>{" "}
                    ({targetPlan?.monthlyFee === 0 ? "Free" : `₹${targetPlan?.monthlyFee?.toLocaleString("en-IN")}/mo`}, up to {targetPlan?.maxProducts} products).
                    Admin will review and activate.
                  </p>

                  {planMsg.text && (
                    <div style={{
                      background: planMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${planMsg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                      color: planMsg.type === "success" ? "#065f46" : "#b91c1c",
                      padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13,
                    }}>{planMsg.text}</div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Note (optional)
                    </label>
                    <textarea
                      value={planNote}
                      onChange={e => setPlanNote(e.target.value)}
                      placeholder="Any message for admin..."
                      maxLength={300}
                      rows={3}
                      style={{
                        width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb",
                        borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
                        fontFamily: "inherit", resize: "vertical",
                      }}
                      onFocus={e => e.target.style.borderColor = "#7c3aed"}
                      onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button
                      onClick={() => { setPlanModal(null); setPlanMsg({ text: "", type: "" }); }}
                      disabled={planLoading}
                      style={{
                        flex: 1, padding: 11, border: "1px solid #e5e7eb", background: "#fff",
                        borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer",
                      }}
                    >Cancel</button>
                    <button
                      onClick={handleRequestPlan}
                      disabled={planLoading}
                      style={{
                        flex: 1, padding: 11, border: "none",
                        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                        borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff",
                        cursor: planLoading ? "not-allowed" : "pointer",
                        opacity: planLoading ? 0.6 : 1,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >{planLoading ? "Submitting..." : "Submit Request"}</button>
                  </div>
                </>
              );
        })()}
      </Modal>

      {/* Danger Zone */}
      <div style={{
        background: "#fff", borderRadius: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: 24, border: "1px solid #fee2e2",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <FiAlertTriangle size={18} color="#ef4444" />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#ef4444", margin: 0 }}>Danger Zone</h3>
        </div>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          To deactivate or delete your account, please contact support at{" "}
          <strong style={{ color: "#111827" }}>officialurbexon@gmail.com</strong>
        </p>
      </div>
    </div>
  );
};

export default Settings;