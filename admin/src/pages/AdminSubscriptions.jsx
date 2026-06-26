/**
 * AdminSubscriptions.jsx
 * v2.0 — Full aesthetic redesign with complete UI
 * Urbexon Admin Panel — Subscription Management
 */
import { useState, useEffect, useCallback, useRef } from "react";
import adminApi from "../api/adminApi";
import useDebounce from "../hooks/useDebounce";

/* ─────────────────────────── PLAN CONFIG ─────────────────────────── */
const PLANS = {
  starter: {
    label: "Starter", price: 0, products: 10,
    gradient: "linear-gradient(135deg,#667eea,#764ba2)",
    solid: "#667eea", light: "#f0eeff", border: "#d0c8fa",
    text: "#4c3bbf", badge: "#e8e4ff",
  },
  basic: {
    label: "Basic", price: 499, products: 30,
    gradient: "linear-gradient(135deg,#0ea5e9,#2563eb)",
    solid: "#2563eb", light: "#eff6ff", border: "#bfdbfe",
    text: "#1d4ed8", badge: "#dbeafe",
  },
  standard: {
    label: "Standard", price: 999, products: 100,
    gradient: "linear-gradient(135deg,#8b5cf6,#a855f7)",
    solid: "#8b5cf6", light: "#f5f3ff", border: "#ddd6fe",
    text: "#7c3aed", badge: "#ede9fe",
  },
  premium: {
    label: "Premium", price: 1999, products: 500,
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444)",
    solid: "#f59e0b", light: "#fffbeb", border: "#fde68a",
    text: "#d97706", badge: "#fef3c7",
  },
};

const STATUS = {
  active: { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0", dot: "#22c55e", label: "Active" },
  expired: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5", dot: "#ef4444", label: "Expired" },
  cancelled: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1", dot: "#94a3b8", label: "Cancelled" },
  pending_payment: { bg: "#fef3c7", text: "#b45309", border: "#fcd34d", dot: "#f59e0b", label: "Pending Payment" },
  pending: { bg: "#fef3c7", text: "#b45309", border: "#fcd34d", dot: "#f59e0b", label: "Pending" },
  inactive: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", dot: "#94a3b8", label: "Inactive" },
  none: { bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0", dot: "#cbd5e1", label: "No Plan" },
};

/* ─────────────────────────── HELPERS ─────────────────────────── */
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const initials = name => (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

const AVATAR_COLORS = [
  ["#ede9fe", "#7c3aed"], ["#dbeafe", "#1d4ed8"], ["#dcfce7", "#15803d"],
  ["#fef3c7", "#b45309"], ["#fee2e2", "#dc2626"], ["#f0fdf4", "#16a34a"],
];
const avatarColor = name => AVATAR_COLORS[(name || "").charCodeAt(0) % AVATAR_COLORS.length];

/* ─────────────────────────── SUB-COMPONENTS ─────────────────────────── */

const StatusBadge = ({ status }) => {
  const cfg = STATUS[status] || STATUS.none;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: cfg.bg, color: cfg.text,
      border: `1px solid ${cfg.border}`,
      fontSize: 11, fontWeight: 700, padding: "3px 9px",
      borderRadius: 20, whiteSpace: "nowrap",
      width: "fit-content", flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

const PlanBadge = ({ plan }) => {
  const p = PLANS[plan];
  if (!p) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: p.badge, color: p.text,
      border: `1px solid ${p.border}`,
      fontSize: 10, fontWeight: 800, padding: "2px 8px",
      borderRadius: 20, textTransform: "uppercase", letterSpacing: ".4px",
      width: "fit-content", flexShrink: 0, whiteSpace: "nowrap",
    }}>
      {p.label}
    </span>
  );
};

const Avatar = ({ name, size = 38 }) => {
  const [bg, color] = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, fontSize: size * 0.35, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "2px solid #fff", boxShadow: "0 0 0 1px #e2e8f0", flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
};

const Toast = ({ msg }) => {
  if (!msg.text) return null;
  const isSuccess = msg.type === "success";
  return (
    <div style={{
      position: "fixed", top: 20, right: 24, zIndex: 9999,
      background: isSuccess ? "#f0fdf4" : "#fff1f2",
      border: `1px solid ${isSuccess ? "#bbf7d0" : "#fecdd3"}`,
      color: isSuccess ? "#166534" : "#be123c",
      padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      display: "flex", alignItems: "center", gap: 8,
      boxShadow: "0 4px 20px rgba(0,0,0,.1)",
      animation: "slideIn .25s ease",
    }}>
      <span style={{ fontSize: 16 }}>{isSuccess ? "✓" : "✕"}</span>
      {msg.text}
    </div>
  );
};

/* ─────────────────────────── STAT CARD ─────────────────────────── */
const StatCard = ({ label, count, color, bg, border, icon }) => (
  <div style={{
    background: bg, border: `1px solid ${border}`, borderRadius: 14,
    padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6,
    position: "relative", overflow: "hidden",
  }}>
    <div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div>
    <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px" }}>{label}</div>
    <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
    <div style={{
      position: "absolute", right: -12, top: -12,
      width: 72, height: 72, borderRadius: "50%",
      background: color, opacity: .07,
    }} />
  </div>
);

/* ─────────────────────────── PLAN ACTIVATE BUTTON ─────────────────────────── */
const PlanButton = ({ planKey, onClick, loading, currentPlan, active }) => {
  const p = PLANS[planKey];
  const isCurrent = currentPlan === planKey;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Activate ${p.label} · ${fmt(p.price)}/mo`}
      style={{
        padding: "6px 13px",
        borderRadius: 8,
        fontSize: 12, fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        border: `1.5px solid ${p.border}`,
        background: hovered && !loading ? p.gradient : (isCurrent ? p.light : "#fff"),
        color: hovered && !loading ? "#fff" : p.text,
        transition: "all .18s",
        opacity: loading ? .5 : 1,
        boxShadow: hovered && !loading ? `0 2px 8px ${p.solid}40` : "none",
        whiteSpace: "nowrap",
        letterSpacing: ".2px",
      }}
    >
      {loading ? "…" : p.label}
    </button>
  );
};

/* ─────────────────────────── EXPANDED ROW ─────────────────────────── */
const ExpandedDetails = ({ sub }) => {
  const plan = PLANS[sub.plan] || PLANS.starter;
  const payments = [...(sub.payments || [])].reverse();

  return (
    <div style={{
      background: "linear-gradient(180deg,#f8fafc 0%,#fff 100%)",
      borderTop: "1px solid #f1f5f9",
      padding: "20px 24px 24px",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>

        {/* Left — Subscription Info */}
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 12, overflow: "hidden",
        }}>
          {/* Plan header */}
          <div style={{
            background: plan.gradient, padding: "16px 18px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "rgba(255,255,255,.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>
              {sub.plan === "premium" ? "👑" : sub.plan === "standard" ? "⭐" : sub.plan === "basic" ? "🔵" : "🎯"}
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,.75)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".6px" }}>Current plan</div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, textTransform: "capitalize" }}>{sub.plan || "—"}</div>
            </div>
          </div>

          {/* Info rows */}
          <div style={{ padding: "4px 0" }}>
            {[
              { label: "Monthly fee", value: fmt(sub.monthlyFee) },
              { label: "Products limit", value: (PLANS[sub.plan]?.products || "—") + " products" },
              { label: "Status", value: <StatusBadge status={sub.status} /> },
              { label: "Start date", value: fmtDate(sub.startDate) },
              { label: "Expiry date", value: fmtDate(sub.expiryDate) },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 18px", borderBottom: "1px solid #f8fafc",
              }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Payment History */}
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 12, padding: 18,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "#1e293b",
            marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: 6,
              background: "#dcfce7", display: "inline-flex",
              alignItems: "center", justifyContent: "center", fontSize: 13,
            }}>💳</span>
            Payment History
            {payments.length > 0 && (
              <span style={{
                marginLeft: "auto", background: "#f1f5f9", color: "#64748b",
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              }}>
                {payments.length} record{payments.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {payments.length === 0 ? (
            <div style={{
              padding: "32px 20px", textAlign: "center",
              background: "#f8fafc", borderRadius: 10,
              border: "1.5px dashed #e2e8f0", color: "#94a3b8", fontSize: 13,
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🧾</div>
              No payment records found
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {payments.map((p, i) => {
                const isFreeTrial = p.method === "free_trial";
                const stOk = p.status === "success";
                const stFail = p.status === "failed";
                const stCfg = stOk
                  ? { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0", label: "Paid", icon: "✓" }
                  : stFail
                    ? { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5", label: "Failed", icon: "✕" }
                    : { bg: "#fef3c7", color: "#b45309", border: "#fcd34d", label: "Pending", icon: "⏳" };

                return (
                  <div key={i} style={{
                    background: "#f8fafc", border: "1px solid #f1f5f9",
                    borderRadius: 10, padding: "11px 14px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    {/* Icon */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: isFreeTrial ? "#fef3c7" : "#eff6ff",
                      color: isFreeTrial ? "#b45309" : "#2563eb",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17,
                    }}>
                      {isFreeTrial ? "🎁" : "💳"}
                    </div>

                    {/* Amount + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b" }}>{fmt(p.amount)}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        {fmtDate(p.date)}
                        {" · "}
                        <span style={{ textTransform: "capitalize" }}>
                          {isFreeTrial ? "Free Trial" : (p.method || "—")}
                        </span>
                        {p.months ? ` · ${p.months} mo` : ""}
                      </div>
                      {(p.razorpayPaymentId || p.reference) && (
                        <div style={{
                          fontFamily: "'Courier New',monospace",
                          fontSize: 9, color: "#94a3b8", marginTop: 3,
                          background: "#fff", border: "1px solid #e2e8f0",
                          display: "inline-block", padding: "1px 5px", borderRadius: 4,
                        }}>
                          {p.razorpayPaymentId || p.reference}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: stCfg.bg, color: stCfg.color,
                      border: `1px solid ${stCfg.border}`,
                      fontSize: 11, fontWeight: 700, padding: "4px 10px",
                      borderRadius: 20, flexShrink: 0,
                    }}>
                      {stCfg.icon} {stCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

/* ─────────────────────────── MAIN COMPONENT ─────────────────────────── */
const AdminSubscriptions = () => {
  const [subs, setSubs] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [activating, setActivating] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 380);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [monthsMap, setMonthsMap] = useState({});
  const msgTimer = useRef(null);

  const showMsg = (text, type = "info") => {
    clearTimeout(msgTimer.current);
    setMsg({ text, type });
    msgTimer.current = setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filter !== "all") params.append("status", filter);
      if (search) params.append("search", search);
      const { data } = await adminApi.get(`/admin/subscriptions?${params}`);
      setSubs(data.subscriptions || []);
      setSummary(data.summary || {});
      setTotalPages(data.totalPages || 1);
    } catch {
      showMsg("Failed to load subscriptions", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const activatePlan = async (vendorId, plan) => {
    const months = monthsMap[vendorId] || 1;
    setActivating(vendorId);
    try {
      await adminApi.post(`/admin/vendors/${vendorId}/subscription`, { plan, months });
      showMsg(`${PLANS[plan].label} plan activated for ${months} month(s)`, "success");
      load();
    } catch (err) {
      showMsg(err?.response?.data?.message || "Failed to activate plan", "error");
    } finally { setActivating(null); }
  };

  const deactivateSub = async (vendorId) => {
    if (!window.confirm("Deactivate this vendor's subscription?")) return;
    setActivating(vendorId);
    try {
      await adminApi.patch(`/admin/vendors/${vendorId}/subscription/deactivate`, { reason: "Admin deactivation" });
      showMsg("Subscription deactivated", "success");
      load();
    } catch (err) {
      showMsg(err?.response?.data?.message || "Failed to deactivate", "error");
    } finally { setActivating(null); }
  };

  const FILTERS = ["all", "active", "expired", "inactive", "cancelled"];
  const FILTER_LABELS = { all: "All", active: "Active", expired: "Expired", inactive: "Inactive", cancelled: "Cancelled" };

  return (
    <div style={{
      padding: 28,
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      background: "#f8fafc",
      minHeight: "100vh",
    }}>

      {/* Inject keyframes */}
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        .sub-row-expand { animation: fadeIn .2s ease; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:4px; }
      `}</style>

      <Toast msg={msg} />

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>💎</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-.4px" }}>
              Subscription Management
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginLeft: 46 }}>
            Manage vendor plans, billing, and access control
          </div>
        </div>
        <button
          onClick={load}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 10,
            fontSize: 13, fontWeight: 600, color: "#374151",
            cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,.05)",
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Active" count={summary.active || 0} color="#15803d" bg="#f0fdf4" border="#bbf7d0" icon="✅" />
        <StatCard label="Expired" count={summary.expired || 0} color="#dc2626" bg="#fff1f2" border="#fecdd3" icon="⏰" />
        <StatCard label="Pending" count={summary.pending || 0} color="#b45309" bg="#fffbeb" border="#fde68a" icon="⏳" />
        <StatCard label="Cancelled" count={summary.cancelled || 0} color="#475569" bg="#f8fafc" border="#e2e8f0" icon="🚫" />
        <StatCard label="Total" count={(summary.active || 0) + (summary.expired || 0) + (summary.pending || 0) + (summary.cancelled || 0)} color="#4f46e5" bg="#eef2ff" border="#c7d2fe" icon="📊" />
      </div>

      {/* ── Plan pricing strip ── */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: 14, padding: "14px 20px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 0, overflow: "hidden",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px", marginRight: 16, flexShrink: 0 }}>
          Plans
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(PLANS).map(([key, p]) => (
            <div key={key} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: p.light, border: `1px solid ${p.border}`,
              borderRadius: 8, padding: "5px 10px",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.solid }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: p.text }}>{p.label}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: p.text }}>{p.price === 0 ? "Free" : `₹${p.price}/mo`}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>·</span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.products} products</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters + Search ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{
          display: "flex", background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 10, padding: 4, gap: 4,
        }}>
          {FILTERS.map(f => {
            const isActive = filter === f;
            const countMap = { all: null, active: summary.active, expired: summary.expired, inactive: null, cancelled: summary.cancelled };
            const cnt = countMap[f];
            return (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
                padding: "5px 12px", borderRadius: 7,
                background: isActive ? "#0f172a" : "transparent",
                color: isActive ? "#fff" : "#64748b",
                border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, transition: "all .15s",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {FILTER_LABELS[f]}
                {cnt !== undefined && cnt !== null && (
                  <span style={{
                    background: isActive ? "rgba(255,255,255,.2)" : "#f1f5f9",
                    color: isActive ? "#fff" : "#64748b",
                    fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 20,
                  }}>{cnt}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 11, fontSize: 15, color: "#94a3b8", pointerEvents: "none" }}>🔍</span>
          <input
            type="text" placeholder="Search vendors…"
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            style={{
              padding: "8px 14px 8px 34px",
              border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12,
              background: "#fff", color: "#1e293b", outline: "none", width: 220,
              boxShadow: "0 1px 3px rgba(0,0,0,.04)",
            }}
          />
          {searchInput && (
            <button onClick={() => setSearchInput("")} style={{
              position: "absolute", right: 10, background: "none", border: "none",
              cursor: "pointer", color: "#94a3b8", fontSize: 14, padding: 0,
            }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Main Table Card ── */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,.05), 0 0 0 1px rgba(0,0,0,.02)",
      }}>
        {/* Table Header */}
        <div style={{
          padding: "14px 22px",
          background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
          borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
            Subscriptions
          </span>
          <span style={{
            background: "#f1f5f9", color: "#64748b",
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
          }}>
            {subs.length}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 190px 100px 110px auto",
              background: "#f8fafc", borderRadius: 8, overflow: "hidden",
              border: "1px solid #f1f5f9", fontSize: 11, color: "#94a3b8",
              fontWeight: 600, minWidth: 700,
            }}>
              {[
                { label: "Vendor", pad: "5px 22px" },
                { label: "Plan / Status", pad: "5px 12px" },
                { label: "Fee", pad: "5px 12px" },
                { label: "Months", pad: "5px 8px" },
                { label: "Actions", pad: "5px 22px" },
              ].map(h => (
                <div key={h.label} style={{ padding: h.pad, borderRight: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h.label}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⟳</div>
            Loading subscriptions…
          </div>
        ) : subs.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            No subscriptions found
          </div>
        ) : (
          subs.map((sub, idx) => {
            const vendor = sub.vendorId || {};
            const isExpanded = expandedId === sub._id;
            const isBusy = activating === vendor._id;
            const months = monthsMap[vendor._id] || 1;

            return (
              <div key={sub._id} style={{ borderBottom: idx < subs.length - 1 ? "1px solid #f8fafc" : "none" }}>
                {/* Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 190px 100px 110px auto",
                    alignItems: "center",
                    gap: 0,
                    padding: "0 0",
                    cursor: "pointer",
                    transition: "background .12s",
                    background: isExpanded ? "#fafcff" : "#fff",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : sub._id)}
                >
                  {/* Vendor */}
                  <div style={{ padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <Avatar name={vendor.shopName} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {vendor.shopName || "Unknown"}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {vendor.ownerName} · {vendor.email}
                      </div>
                    </div>
                  </div>

                  {/* Plan + Status */}
                  <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
                    <StatusBadge status={sub.status} />
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <PlanBadge plan={sub.plan} />
                      {sub.expiryDate && (
                        <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>
                          · exp {fmtDate(sub.expiryDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fee */}
                  <div style={{ padding: "14px 12px", textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{fmt(sub.monthlyFee)}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>/ month</div>
                  </div>

                  {/* Months selector */}
                  <div style={{ padding: "14px 8px" }} onClick={e => e.stopPropagation()}>
                    <select
                      value={months}
                      onChange={e => setMonthsMap(m => ({ ...m, [vendor._id]: Number(e.target.value) }))}
                      style={{
                        padding: "6px 8px", border: "1px solid #e2e8f0",
                        borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: "#f8fafc", color: "#374151",
                        cursor: "pointer", outline: "none", width: "100%",
                      }}
                    >
                      {[1, 2, 3, 6, 12].map(m => (
                        <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div
                    style={{ padding: "14px 22px 14px 8px", display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}
                    onClick={e => e.stopPropagation()}
                  >
                    {Object.entries(PLANS).filter(([k]) => k !== "starter").map(([key]) => (
                      <PlanButton
                        key={key}
                        planKey={key}
                        onClick={() => activatePlan(vendor._id, key)}
                        loading={isBusy}
                        currentPlan={sub.plan}
                        active={sub.status === "active"}
                      />
                    ))}

                    {sub.status === "active" && (
                      <button
                        onClick={() => deactivateSub(vendor._id)}
                        disabled={isBusy}
                        style={{
                          padding: "6px 12px", borderRadius: 8,
                          fontSize: 12, fontWeight: 700,
                          background: "#fff1f2", color: "#be123c",
                          border: "1.5px solid #fecdd3",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          transition: "all .15s", whiteSpace: "nowrap",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#ffe4e6"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fff1f2"; }}
                      >
                        🚫 Deactivate
                      </button>
                    )}

                    {/* Expand chevron */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : sub._id)}
                      style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: isExpanded ? "#eef2ff" : "#f8fafc",
                        border: `1px solid ${isExpanded ? "#c7d2fe" : "#e2e8f0"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", transition: "all .15s", marginLeft: 4, flexShrink: 0,
                      }}
                    >
                      <span style={{
                        display: "inline-block",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform .2s",
                        fontSize: 12, color: isExpanded ? "#6366f1" : "#94a3b8",
                      }}>▼</span>
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="sub-row-expand">
                    <ExpandedDetails sub={sub} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{
              padding: "7px 16px", background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: 8, fontSize: 13, color: "#374151", cursor: "pointer",
              opacity: page === 1 ? .4 : 1, fontWeight: 600,
            }}
          >← Prev</button>
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)} style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: page === p ? "#0f172a" : "#fff",
                  color: page === p ? "#fff" : "#64748b",
                  border: `1px solid ${page === p ? "#0f172a" : "#e2e8f0"}`,
                  cursor: "pointer", fontSize: 13, fontWeight: 700,
                }}>
                  {p}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{
              padding: "7px 16px", background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: 8, fontSize: 13, color: "#374151", cursor: "pointer",
              opacity: page === totalPages ? .4 : 1, fontWeight: 600,
            }}
          >Next →</button>
        </div>
      )}

      {/* ── Bottom padding ── */}
      <div style={{ height: 40 }} />
    </div>
  );
};

export default AdminSubscriptions;