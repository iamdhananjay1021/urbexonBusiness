/**
 * AdminSubscriptions.jsx
 * v3.0 — migrated onto the shared design system (theme/tokens.css + components/ui)
 * Urbexon Admin Panel — Subscription Management
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { FiRefreshCw, FiXCircle, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import adminApi from "../api/adminApi";
import useDebounce from "../hooks/useDebounce";
import {
  Button, Badge, StatusBadge, Card, SearchBar,
  EmptyState, Skeleton, Pagination,
} from "../components/ui";

/* ─────────────────────────── PLAN CONFIG ─────────────────────────── */
/* BUG FIX: price/products used to be hardcoded here — a THIRD independent
   copy of the same config already duplicated between
   backend/models/vendorModels/Subscription.js (PLANS, the canonical
   source) and backend/controllers/admin/vendorApproval.js (now fixed to
   import Subscription.PLANS instead of redeclaring it). A price/limit
   change would silently go stale on this exact page — the one admin uses
   to manually activate plans. `GET /admin/subscriptions` now also returns
   `plans: Subscription.PLANS`; `load()` below merges those live values
   into this object on every fetch. Kept as a plain mutable object (not
   React state) so the several sibling components below that read
   `PLANS[key]` directly (PlanBadge, activation buttons, etc.) don't need
   prop-drilling — they already re-read it fresh on every render, and
   `load()` already triggers a re-render via setSubs/setSummary. `tone`
   stays local — it's a UI color choice, not business data. This object is
   only ever seeded with these safe defaults for the instant before the
   first `load()` response arrives. */
const PLANS = {
  starter: { label: "Starter", price: 0, products: 10, tone: "neutral" },
  basic: { label: "Basic", price: 499, products: 30, tone: "primary" },
  standard: { label: "Standard", price: 999, products: 100, tone: "info" },
  premium: { label: "Premium", price: 1999, products: 500, tone: "warning" },
};

/* Small lookup from a Badge tone name to the underlying tokens, used only
   by the bespoke per-plan activation buttons below (their per-plan colors
   can't be expressed through the fixed Button variant enum). */
const TONE_VARS = {
  primary: { solid: "var(--adm-primary)", tint: "var(--adm-primary-tint)", text: "var(--adm-primary)", border: "var(--adm-border)" },
  success: { solid: "var(--adm-success)", tint: "var(--adm-success-tint)", text: "var(--adm-success)", border: "var(--adm-border)" },
  warning: { solid: "var(--adm-warning)", tint: "var(--adm-warning-tint)", text: "var(--adm-warning)", border: "var(--adm-border)" },
  danger: { solid: "var(--adm-danger)", tint: "var(--adm-danger-tint)", text: "var(--adm-danger)", border: "var(--adm-border)" },
  info: { solid: "var(--adm-info)", tint: "var(--adm-info-tint)", text: "var(--adm-info)", border: "var(--adm-border)" },
  neutral: { solid: "var(--adm-neutral)", tint: "var(--adm-neutral-tint)", text: "var(--adm-neutral)", border: "var(--adm-border)" },
};

/* ─────────────────────────── HELPERS ─────────────────────────── */
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const initials = name => (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

/* Avatar background/text pairs are purely decorative variety (rotated by
   name so the same vendor always gets the same color) — not a status or
   semantic signal, so there's no clean token to map them to individually.
   Left as one-off literals per the migration guidance. */
const AVATAR_COLORS = [
  ["#ede9fe", "#7c3aed"], ["#dbeafe", "#1d4ed8"], ["#dcfce7", "#15803d"],
  ["#fef3c7", "#b45309"], ["#fee2e2", "#dc2626"], ["#f0fdf4", "#16a34a"],
];
const avatarColor = name => AVATAR_COLORS[(name || "").charCodeAt(0) % AVATAR_COLORS.length];

/* ─────────────────────────── SUB-COMPONENTS ─────────────────────────── */

const PlanBadge = ({ plan }) => {
  const p = PLANS[plan];
  if (!p) return null;
  return <Badge tone={p.tone}>{p.label}</Badge>;
};

const Avatar = ({ name, size = 38 }) => {
  const [bg, color] = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, fontSize: size * 0.35, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "2px solid var(--adm-surface)", boxShadow: "0 0 0 1px var(--adm-border)", flexShrink: 0,
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
      background: isSuccess ? "var(--adm-success-tint)" : "var(--adm-danger-tint)",
      border: `1px solid ${isSuccess ? "var(--adm-success)" : "var(--adm-danger)"}`,
      color: isSuccess ? "var(--adm-success)" : "var(--adm-danger)",
      padding: "10px 16px", borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 600,
      display: "flex", alignItems: "center", gap: 8,
      boxShadow: "var(--adm-shadow-md)",
    }}>
      {isSuccess ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
      {msg.text}
    </div>
  );
};

/* ─────────────────────────── STAT CARD ─────────────────────────── */
const StatCard = ({ label, count, tone, icon }) => {
  const t = TONE_VARS[tone];
  return (
    <Card padded style={{ position: "relative", overflow: "hidden", background: t.tint, borderColor: t.border }}>
      <div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 11, color: t.text, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: t.text, lineHeight: 1, marginTop: 6 }}>{count}</div>
      <div style={{
        position: "absolute", right: -12, top: -12,
        width: 72, height: 72, borderRadius: "50%",
        background: t.solid, opacity: .07,
      }} />
    </Card>
  );
};

/* ─────────────────────────── PLAN ACTIVATE BUTTON ─────────────────────────── */
const PlanButton = ({ planKey, onClick, loading }) => {
  const p = PLANS[planKey];
  const t = TONE_VARS[p.tone];
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
        borderRadius: "var(--adm-radius-md)",
        fontSize: 12, fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        border: `1.5px solid ${t.border}`,
        background: hovered && !loading ? t.solid : t.tint,
        color: hovered && !loading ? "var(--adm-text-on-accent)" : t.text,
        transition: "all .18s",
        opacity: loading ? .5 : 1,
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
  const planTone = TONE_VARS[plan.tone];
  const payments = [...(sub.payments || [])].reverse();

  return (
    <div style={{
      background: "var(--adm-bg)",
      borderTop: "1px solid var(--adm-border-soft)",
      padding: "20px 24px 24px",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>

        {/* Left — Subscription Info */}
        <Card padded={false}>
          {/* Plan header */}
          <div style={{
            background: planTone.solid, padding: "16px 18px",
            display: "flex", alignItems: "center", gap: 12,
            borderRadius: "var(--adm-radius-lg) var(--adm-radius-lg) 0 0",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "var(--adm-radius-md)",
              background: "rgba(255,255,255,.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>
              {sub.plan === "premium" ? "👑" : sub.plan === "standard" ? "⭐" : sub.plan === "basic" ? "🔵" : "🎯"}
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,.75)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".6px" }}>Current plan</div>
              <div style={{ color: "var(--adm-text-on-accent)", fontSize: 18, fontWeight: 800, textTransform: "capitalize" }}>{sub.plan || "—"}</div>
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
                padding: "10px 18px", borderBottom: "1px solid var(--adm-border-soft)",
              }}>
                <span style={{ fontSize: 12, color: "var(--adm-text-secondary)" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-text-primary)" }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Right — Payment History */}
        <Card padded>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)",
            marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: "var(--adm-radius-sm)",
              background: "var(--adm-success-tint)", display: "inline-flex",
              alignItems: "center", justifyContent: "center", fontSize: 13,
            }}>💳</span>
            Payment History
            {payments.length > 0 && (
              <span style={{
                marginLeft: "auto", background: "var(--adm-surface-alt)", color: "var(--adm-text-secondary)",
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--adm-radius-full)",
              }}>
                {payments.length} record{payments.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {payments.length === 0 ? (
            <EmptyState icon={() => <span style={{ fontSize: 28 }}>🧾</span>} title="No payment records found" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {payments.map((p, i) => {
                const isFreeTrial = p.method === "free_trial";
                const stOk = p.status === "success";
                const stFail = p.status === "failed";
                const stTone = stOk ? "success" : stFail ? "danger" : "warning";
                const stLabel = stOk ? "Paid" : stFail ? "Failed" : "Pending";

                return (
                  <div key={i} style={{
                    background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border-soft)",
                    borderRadius: "var(--adm-radius-md)", padding: "11px 14px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    {/* Icon */}
                    <div style={{
                      width: 38, height: 38, borderRadius: "var(--adm-radius-md)", flexShrink: 0,
                      background: isFreeTrial ? "var(--adm-warning-tint)" : "var(--adm-primary-tint)",
                      color: isFreeTrial ? "var(--adm-warning)" : "var(--adm-primary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17,
                    }}>
                      {isFreeTrial ? "🎁" : "💳"}
                    </div>

                    {/* Amount + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--adm-text-primary)" }}>{fmt(p.amount)}</div>
                      <div style={{ fontSize: 11, color: "var(--adm-text-secondary)", marginTop: 2 }}>
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
                          fontSize: 9, color: "var(--adm-muted)", marginTop: 3,
                          background: "var(--adm-surface)", border: "1px solid var(--adm-border)",
                          display: "inline-block", padding: "1px 5px", borderRadius: "var(--adm-radius-sm)",
                        }}>
                          {p.razorpayPaymentId || p.reference}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <Badge tone={stTone}>{stLabel}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

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
      // Sync the canonical plan pricing/limits from the backend — see the
      // PLAN CONFIG comment above for why this mutates the shared object
      // instead of living in React state.
      if (data.plans) {
        Object.entries(data.plans).forEach(([key, p]) => {
          if (PLANS[key]) {
            PLANS[key].price = p.monthlyFee;
            PLANS[key].products = p.maxProducts;
            PLANS[key].label = p.label || PLANS[key].label;
          }
        });
      }
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
      fontFamily: "var(--adm-font-sans)",
      background: "var(--adm-bg)",
      minHeight: "100vh",
    }}>
      <Toast msg={msg} />

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--adm-radius-md)",
              background: "var(--adm-primary)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>💎</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", letterSpacing: "-.4px" }}>
              Subscription Management
            </div>
          </div>
          <div style={{ fontSize: 13, color: "var(--adm-text-secondary)", marginLeft: 46 }}>
            Manage vendor plans, billing, and access control
          </div>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={load}>Refresh</Button>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Active" count={summary.active || 0} tone="success" icon="✅" />
        <StatCard label="Expired" count={summary.expired || 0} tone="danger" icon="⏰" />
        <StatCard label="Pending" count={summary.pending || 0} tone="warning" icon="⏳" />
        <StatCard label="Cancelled" count={summary.cancelled || 0} tone="neutral" icon="🚫" />
        <StatCard label="Total" count={(summary.active || 0) + (summary.expired || 0) + (summary.pending || 0) + (summary.cancelled || 0)} tone="primary" icon="📊" />
      </div>

      {/* ── Plan pricing strip ── */}
      <Card padded style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 0, overflow: "hidden" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".6px", marginRight: 16, flexShrink: 0 }}>
          Plans
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(PLANS).map(([key, p]) => {
            const t = TONE_VARS[p.tone];
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: t.tint, border: `1px solid ${t.border}`,
                borderRadius: "var(--adm-radius-md)", padding: "5px 10px",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.solid }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{p.label}</span>
                <span style={{ fontSize: 11, color: "var(--adm-muted)" }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{p.price === 0 ? "Free" : `₹${p.price}/mo`}</span>
                <span style={{ fontSize: 11, color: "var(--adm-muted)" }}>·</span>
                <span style={{ fontSize: 10, color: "var(--adm-muted)" }}>{p.products} products</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Filters + Search ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{
          display: "flex", background: "var(--adm-surface)", border: "1px solid var(--adm-border)",
          borderRadius: "var(--adm-radius-md)", padding: 4, gap: 4,
        }}>
          {FILTERS.map(f => {
            const isActive = filter === f;
            const countMap = { all: null, active: summary.active, expired: summary.expired, inactive: null, cancelled: summary.cancelled };
            const cnt = countMap[f];
            return (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
                padding: "5px 12px", borderRadius: "var(--adm-radius-sm)",
                background: isActive ? "var(--adm-text-primary)" : "transparent",
                color: isActive ? "var(--adm-text-on-accent)" : "var(--adm-text-secondary)",
                border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, transition: "all .15s",
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: "inherit",
              }}>
                {FILTER_LABELS[f]}
                {cnt !== undefined && cnt !== null && (
                  <span style={{
                    background: isActive ? "rgba(255,255,255,.2)" : "var(--adm-surface-alt)",
                    color: isActive ? "var(--adm-text-on-accent)" : "var(--adm-text-secondary)",
                    fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: "var(--adm-radius-full)",
                  }}>{cnt}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ marginLeft: "auto", width: 240 }}>
          <SearchBar value={searchInput} onChange={setSearchInput} placeholder="Search vendors…" />
        </div>
      </div>

      {/* ── Main Table Card ── */}
      <Card padded={false} style={{ overflow: "hidden" }}>
        {/* Table Header */}
        <div style={{
          padding: "14px 22px",
          background: "var(--adm-surface-alt)",
          borderBottom: "1px solid var(--adm-border-soft)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-text-primary)" }}>
            Subscriptions
          </span>
          <span style={{
            background: "var(--adm-surface)", color: "var(--adm-text-secondary)",
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--adm-radius-full)",
          }}>
            {subs.length}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 190px 100px 110px auto",
              background: "var(--adm-surface)", borderRadius: "var(--adm-radius-sm)", overflow: "hidden",
              border: "1px solid var(--adm-border-soft)", fontSize: 11, color: "var(--adm-muted)",
              fontWeight: 600, minWidth: 700,
            }}>
              {[
                { label: "Vendor", pad: "5px 22px" },
                { label: "Plan / Status", pad: "5px 12px" },
                { label: "Fee", pad: "5px 12px" },
                { label: "Months", pad: "5px 8px" },
                { label: "Actions", pad: "5px 22px" },
              ].map(h => (
                <div key={h.label} style={{ padding: h.pad, borderRight: "1px solid var(--adm-border-soft)", whiteSpace: "nowrap" }}>{h.label}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={48} />)}
          </div>
        ) : subs.length === 0 ? (
          <EmptyState title="No subscriptions found" />
        ) : (
          subs.map((sub, idx) => {
            const vendor = sub.vendorId || {};
            const isExpanded = expandedId === sub._id;
            const isBusy = activating === vendor._id;
            const months = monthsMap[vendor._id] || 1;

            return (
              <div key={sub._id} style={{ borderBottom: idx < subs.length - 1 ? "1px solid var(--adm-border-soft)" : "none" }}>
                {/* Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 190px 100px 110px auto",
                    alignItems: "center",
                    gap: 0,
                    cursor: "pointer",
                    transition: "background .12s",
                    background: isExpanded ? "var(--adm-surface-alt)" : "var(--adm-surface)",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : sub._id)}
                >
                  {/* Vendor */}
                  <div style={{ padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <Avatar name={vendor.shopName} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {vendor.shopName || "Unknown"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                        <span style={{ fontSize: 10, color: "var(--adm-muted)", whiteSpace: "nowrap" }}>
                          · exp {fmtDate(sub.expiryDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fee */}
                  <div style={{ padding: "14px 12px", textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--adm-text-primary)" }}>{fmt(sub.monthlyFee)}</div>
                    <div style={{ fontSize: 10, color: "var(--adm-muted)", marginTop: 1 }}>/ month</div>
                  </div>

                  {/* Months selector */}
                  <div style={{ padding: "14px 8px" }} onClick={e => e.stopPropagation()}>
                    <select
                      value={months}
                      onChange={e => setMonthsMap(m => ({ ...m, [vendor._id]: Number(e.target.value) }))}
                      className="adm-field-select"
                      style={{ padding: "6px 8px", fontSize: 12, fontWeight: 600, width: "100%" }}
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
                      />
                    ))}

                    {sub.status === "active" && (
                      <Button variant="danger" size="sm" icon={FiXCircle} loading={isBusy} onClick={() => deactivateSub(vendor._id)}>
                        Deactivate
                      </Button>
                    )}

                    {/* Expand chevron */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : sub._id)}
                      style={{
                        width: 28, height: 28, borderRadius: "var(--adm-radius-sm)",
                        background: isExpanded ? "var(--adm-primary-tint)" : "var(--adm-surface-alt)",
                        border: `1px solid ${isExpanded ? "var(--adm-primary)" : "var(--adm-border)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", transition: "all .15s", marginLeft: 4, flexShrink: 0,
                      }}
                    >
                      <span style={{
                        display: "inline-block",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform .2s",
                        fontSize: 12, color: isExpanded ? "var(--adm-primary)" : "var(--adm-muted)",
                      }}>▼</span>
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && <ExpandedDetails sub={sub} />}
              </div>
            );
          })
        )}
      </Card>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20 }}>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
        </div>
      )}

      {/* ── Bottom padding ── */}
      <div style={{ height: 40 }} />
    </div>
  );
};

export default AdminSubscriptions;
