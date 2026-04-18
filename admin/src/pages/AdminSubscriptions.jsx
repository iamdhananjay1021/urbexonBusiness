/**
 * AdminSubscriptions.jsx - Manage vendor subscriptions/monthly fees
 * v2.0 — Full subscription management with filters, deactivation, payment history
 */
import { useState, useEffect, useCallback } from "react";
import adminApi from "../api/adminApi";

const PLANS = {
  starter: { label: "Starter", price: 0, products: 10, color: "#6b7280" },
  basic: { label: "Basic", price: 499, products: 30, color: "#3b82f6" },
  standard: { label: "Standard", price: 999, products: 100, color: "#8b5cf6" },
  premium: { label: "Premium", price: 1999, products: 500, color: "#f59e0b" },
};

const StatusBadge = ({ status }) => {
  const cfg = {
    active: { bg: "#d1fae5", c: "#065f46", l: "Active" },
    expired: { bg: "#fee2e2", c: "#b91c1c", l: "Expired" },
    cancelled: { bg: "#f1f5f9", c: "#475569", l: "Cancelled" },
    pending_payment: { bg: "#fef3c7", c: "#92400e", l: "Pending Payment" },
    pending: { bg: "#fef3c7", c: "#92400e", l: "Pending" },
    inactive: { bg: "#f1f5f9", c: "#94a3b8", l: "Inactive" },
    none: { bg: "#f1f5f9", c: "#94a3b8", l: "No Plan" },
  }[status] || { bg: "#f1f5f9", c: "#475569", l: status };
  return <span style={{ background: cfg.bg, color: cfg.c, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>{cfg.l}</span>;
};

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const AdminSubscriptions = () => {
  const [subs, setSubs] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [activating, setActivating] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const showMsg = (text, type = "info") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
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
    } catch { showMsg("Failed to load subscriptions", "error"); }
    finally { setLoading(false); }
  }, [filter, search, page]);

  useEffect(() => { load(); }, [load]);

  const activatePlan = async (vendorId, plan, months = 1) => {
    setActivating(vendorId);
    try {
      await adminApi.post(`/admin/vendors/${vendorId}/subscription`, { plan, months });
      showMsg(`${PLANS[plan].label} plan activated for ${months} month(s)`, "success");
      load();
    } catch (err) {
      showMsg(err?.response?.data?.message || "Failed", "error");
    } finally { setActivating(null); }
  };

  const deactivateSub = async (vendorId) => {
    if (!window.confirm("Deactivate this vendor's subscription?")) return;
    setActivating(vendorId);
    try {
      await adminApi.patch(`/admin/vendors/${vendorId}/subscription/deactivate`, {
        reason: "Admin deactivation"
      });
      showMsg("Subscription deactivated", "success");
      load();
    } catch (err) {
      showMsg(err?.response?.data?.message || "Failed", "error");
    } finally { setActivating(null); }
  };

  const S = {
    root: { padding: 24, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
    title: { fontSize: 20, fontWeight: 800, color: "#1e293b", marginBottom: 6 },
    sub: { fontSize: 13, color: "#64748b", marginBottom: 24 },
    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 16 },
    head: { padding: "14px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
    row: { padding: "16px 20px", borderBottom: "1px solid #f8fafc", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
    planBtn: (plan) => ({ padding: "6px 14px", border: `1.5px solid ${PLANS[plan]?.color || "#6b7280"}`, color: PLANS[plan]?.color || "#6b7280", background: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all .2s" }),
    filterBtn: (active) => ({ padding: "6px 14px", border: active ? "1.5px solid #111827" : "1px solid #d1d5db", background: active ? "#111827" : "#fff", color: active ? "#fff" : "#374151", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }),
    deactivateBtn: { padding: "6px 14px", border: "1.5px solid #ef4444", color: "#ef4444", background: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 },
  };

  return (
    <div style={S.root}>
      <div style={S.title}>Subscription Management</div>
      <div style={S.sub}>Manage vendor plans, payments, and access control</div>

      {msg.text && (
        <div style={{ background: msg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`, color: msg.type === "success" ? "#166534" : "#b91c1c", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Active", count: summary.active || 0, color: "#065f46", bg: "#d1fae5" },
          { label: "Expired", count: summary.expired || 0, color: "#b91c1c", bg: "#fee2e2" },
          { label: "Pending", count: summary.pending || 0, color: "#92400e", bg: "#fef3c7" },
          { label: "Cancelled", count: summary.cancelled || 0, color: "#475569", bg: "#f1f5f9" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {["all", "active", "expired", "inactive", "cancelled"].map(f => (
          <button key={f} style={S.filterBtn(filter === f)} onClick={() => { setFilter(f); setPage(1); }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <input
          type="text" placeholder="Search vendor..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ marginLeft: "auto", padding: "7px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, width: 200 }}
        />
      </div>

      {/* Subscription List */}
      <div style={S.card}>
        <div style={S.head}>
          <span style={{ fontWeight: 700, color: "#1e293b" }}>Subscriptions ({subs.length})</span>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading…</div> :
          subs.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No subscriptions found</div> :
            subs.map(sub => {
              const vendor = sub.vendorId || {};
              const isExpanded = expandedId === sub._id;
              return (
                <div key={sub._id}>
                  <div style={{ ...S.row, cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : sub._id)}>
                    {/* Vendor info */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{vendor.shopName || "Unknown"}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{vendor.ownerName} · {vendor.email}</div>
                    </div>
                    {/* Plan & Status */}
                    <div style={{ minWidth: 120 }}>
                      <StatusBadge status={sub.status} />
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 3, textTransform: "capitalize" }}>
                        {sub.plan} · {sub.expiryDate ? `Exp: ${new Date(sub.expiryDate).toLocaleDateString("en-IN")}` : "—"}
                      </div>
                    </div>
                    {/* Fee */}
                    <div style={{ minWidth: 80, textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: "#111827" }}>{fmt(sub.monthlyFee)}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>/month</div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.entries(PLANS).filter(([k]) => k !== "starter").map(([key]) => (
                        <button
                          key={key}
                          style={S.planBtn(key)}
                          disabled={activating === vendor._id}
                          onClick={(e) => { e.stopPropagation(); activatePlan(vendor._id, key, 1); }}
                          title={`Activate ${PLANS[key].label} for 1 month`}
                        >
                          {activating === vendor._id ? "…" : PLANS[key].label}
                        </button>
                      ))}
                      {sub.status === "active" && (
                        <button
                          style={S.deactivateBtn}
                          disabled={activating === vendor._id}
                          onClick={(e) => { e.stopPropagation(); deactivateSub(vendor._id); }}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Expanded: Payment History */}
                  {isExpanded && sub.payments?.length > 0 && (
                    <div style={{ padding: "0 20px 16px", background: "#fafbfc" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Payment History</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                            {["Date", "Amount", "Method", "Months", "Status", "Reference"].map(h => (
                              <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sub.payments.slice().reverse().map((p, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                              <td style={{ padding: "6px 10px" }}>{new Date(p.date).toLocaleDateString("en-IN")}</td>
                              <td style={{ padding: "6px 10px", fontWeight: 700 }}>{fmt(p.amount)}</td>
                              <td style={{ padding: "6px 10px", textTransform: "capitalize" }}>{p.method === "free_trial" ? "Trial" : p.method}</td>
                              <td style={{ padding: "6px 10px" }}>{p.months}</td>
                              <td style={{ padding: "6px 10px" }}>
                                <span style={{
                                  padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                                  background: p.status === "success" ? "#d1fae5" : p.status === "failed" ? "#fee2e2" : "#fef3c7",
                                  color: p.status === "success" ? "#065f46" : p.status === "failed" ? "#b91c1c" : "#92400e",
                                }}>{p.status || "—"}</span>
                              </td>
                              <td style={{ padding: "6px 10px", fontSize: 11, color: "#6b7280", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {p.razorpayPaymentId || p.reference || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: page === p ? "1.5px solid #111827" : "1px solid #d1d5db",
                background: page === p ? "#111827" : "#fff",
                color: page === p ? "#fff" : "#374151",
              }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
export default AdminSubscriptions;
