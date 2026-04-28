/**
 * AdminSubscriptions.jsx - Manage vendor subscriptions/monthly fees
 * v2.0 — Full subscription management with filters, deactivation, payment history
 */
import { useState, useEffect, useCallback } from "react";
import adminApi from "../api/adminApi";
import useDebounce from "../hooks/useDebounce";
import { FiCreditCard, FiAward, FiCheckCircle, FiXCircle, FiClock } from "react-icons/fi";

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
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 400);
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

  useEffect(() => {
    setPage(1);
  }, [search]);

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
          value={searchInput} onChange={e => setSearchInput(e.target.value)}
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
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ padding: "16px 20px 20px", background: "#fafbfc", borderTop: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>

                        {/* Subscription Info Card */}
                        <div style={{ flex: "1 1 250px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                            <FiAward size={16} color="#6366f1" /> Subscription Details
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "#64748b" }}>Current Plan</span>
                              <span style={{ fontWeight: 700, color: "#1e293b", textTransform: "capitalize", background: "#f1f5f9", padding: "2px 8px", borderRadius: 6 }}>{sub.plan}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "#64748b" }}>Max Products</span>
                              <span style={{ fontWeight: 600, color: "#1e293b" }}>{PLANS[sub.plan]?.products || "—"}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "#64748b" }}>Start Date</span>
                              <span style={{ fontWeight: 600, color: "#1e293b" }}>{sub.startDate ? new Date(sub.startDate).toLocaleDateString("en-IN") : "—"}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "#64748b" }}>Expiry Date</span>
                              <span style={{ fontWeight: 600, color: "#1e293b" }}>{sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString("en-IN") : "—"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Payment History */}
                        <div style={{ flex: "2 1 400px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                            <FiCreditCard size={16} color="#10b981" /> Payment History
                          </h4>
                          {sub.payments?.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {sub.payments.slice().reverse().map((p, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, flexWrap: "wrap", gap: 12 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: p.method === "free_trial" ? "#fef3c7" : "#e0e7ff", color: p.method === "free_trial" ? "#d97706" : "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      {p.method === "free_trial" ? <FiAward size={16} /> : <FiCreditCard size={16} />}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", marginBottom: 2 }}>{fmt(p.amount)}</div>
                                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                                        {new Date(p.date).toLocaleDateString("en-IN")} · <span style={{ textTransform: "capitalize" }}>{p.method === "free_trial" ? "Free Trial" : p.method}</span>
                                        {p.months ? ` (${p.months} mo)` : ""}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", gap: 5,
                                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "capitalize",
                                      background: p.status === "success" ? "#d1fae5" : p.status === "failed" ? "#fee2e2" : "#fef3c7",
                                      color: p.status === "success" ? "#065f46" : p.status === "failed" ? "#b91c1c" : "#92400e",
                                    }}>
                                      {p.status === "success" ? <FiCheckCircle size={12} /> : p.status === "failed" ? <FiXCircle size={12} /> : <FiClock size={12} />}
                                      {p.status || "Pending"}
                                    </span>
                                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, fontFamily: "'Courier New', monospace", fontWeight: 600 }}>
                                      {p.razorpayPaymentId || p.reference || "No Reference ID"}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ padding: "30px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13, background: "#f8fafc", borderRadius: 10, border: "1px dashed #e2e8f0" }}>
                              No payment records found
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: "6px 12px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, color: "#374151", cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: "#475569" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: "6px 12px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, color: "#374151", cursor: "pointer", opacity: page === totalPages ? 0.4 : 1 }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
export default AdminSubscriptions;
