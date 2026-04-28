/**
 * Earnings.jsx — v5.0 Production
 * Fully dynamic — earnings + payout request/history
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import {
  FiTrendingUp, FiClock, FiDollarSign,
  FiArrowUpRight, FiArrowDownRight, FiPackage, FiPercent,
} from "react-icons/fi";

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const PAYOUT_STATUS = {
  requested: { bg: "#fef3c7", color: "#92400e", label: "Requested" },
  approved: { bg: "#dbeafe", color: "#1d4ed8", label: "Approved" },
  processing: { bg: "#e0e7ff", color: "#4338ca", label: "Processing" },
  completed: { bg: "#d1fae5", color: "#065f46", label: "Completed" },
  rejected: { bg: "#fee2e2", color: "#b91c1c", label: "Rejected" },
};

const Earnings = () => {
  const [data, setData] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Payout state
  const [payoutData, setPayoutData] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");

  const loadAll = useCallback(() => {
    Promise.all([
      api.get("/vendor/earnings"),
      api.get("/vendor/earnings/weekly"),
      api.get("/vendor/payouts"),
    ]).then(([e, w, p]) => {
      setData(e.data);
      setWeekly(w.data?.weekly || []);
      setPayoutData(p.data);
    }).catch(() => setError("Failed to load earnings"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const requestPayout = async () => {
    const amt = Number(payoutAmount);
    const minPayout = payoutData?.minPayout || 500;
    const availableBalance = payoutData?.balance?.available || 0;

    // Validation 1: Amount must be a number
    if (!amt) {
      setPayoutMsg("❌ Please enter an amount");
      setTimeout(() => setPayoutMsg(""), 3000);
      return;
    }

    // Validation 2: Minimum payout requirement
    if (amt < minPayout) {
      setPayoutMsg(`❌ Minimum payout: ${fmt(minPayout)}`);
      setTimeout(() => setPayoutMsg(""), 3000);
      return;
    }

    // Validation 3: Available balance check (BEFORE API call)
    if (amt > availableBalance) {
      setPayoutMsg(`❌ Insufficient balance. Available: ${fmt(availableBalance)}`);
      setTimeout(() => setPayoutMsg(""), 4000);
      return;
    }

    setRequesting(true);
    try {
      const { data: res } = await api.post("/vendor/payouts/request", { amount: amt });
      setPayoutMsg(res.message || "✅ Payout requested!");
      setPayoutAmount("");

      // Refresh payout data on success
      try {
        const { data: fresh } = await api.get("/vendor/payouts");
        setPayoutData(fresh);
      } catch (refreshErr) {
        console.warn("Failed to refresh payout data:", refreshErr);
        // Don't show error for refresh failure
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || "Failed to request payout";
      setPayoutMsg(`❌ ${errorMsg}`);
      console.error("Payout request error:", err.response?.status, errorMsg);
    } finally {
      setRequesting(false);
      setTimeout(() => setPayoutMsg(""), 5000);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error && !data) return (
    <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>{error}</div>
  );

  const e = data?.earnings || {};
  const sub = data?.subscription;
  const transactions = data?.transactions || [];
  const maxRev = Math.max(...weekly.map(d => d.revenue), 1);
  const growth = e.growth || 0;
  const isUp = growth >= 0;

  return (
    <div style={{ maxWidth: 1100 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Earnings</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Track your revenue and transactions</p>
      </div>

      {/* Top Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {/* Net Earnings */}
        <div style={{
          background: "linear-gradient(135deg, #059669, #10b981)",
          borderRadius: 16, padding: 24,
          boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
          animation: "fadeUp 0.3s ease both",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 1 }}>
              Net Earnings
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FiDollarSign size={18} color="#fff" />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 4 }}>
            {fmt(e.netTotal || e.grossTotal)}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
            {e.totalOrders || 0} delivered order{e.totalOrders !== 1 ? "s" : ""} · Gross {fmt(e.grossTotal)}
          </div>
        </div>

        {/* This Month */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: 24,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          animation: "fadeUp 0.3s ease 0.08s both",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>
              This Month
            </div>
            <FiTrendingUp size={18} color={isUp ? "#10b981" : "#ef4444"} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
            {fmt(e.thisMonthNet || e.thisMonth)}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
            color: isUp ? "#10b981" : growth === 0 ? "#9ca3af" : "#ef4444"
          }}>
            {growth !== 0 && (isUp ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />)}
            {growth === 0
              ? `${e.monthOrders || 0} order${e.monthOrders !== 1 ? "s" : ""}`
              : `${isUp ? "+" : ""}${growth}% vs last month`
            }
          </div>
        </div>

        {/* Commission */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: 24,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          animation: "fadeUp 0.3s ease 0.16s both",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>
              Commission ({e.commissionRate || 0}%)
            </div>
            <FiPercent size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#ef4444", marginBottom: 6 }}>
            {fmt(e.commissionDeducted)}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            This month: {fmt(e.thisMonthCommission)}
          </div>
        </div>

        {/* Pending */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: 24,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          animation: "fadeUp 0.3s ease 0.24s both",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>
              Pending Settlement
            </div>
            <FiClock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
            {fmt(e.pendingSettlement)}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {e.pendingOrders || 0} order{e.pendingOrders !== 1 ? "s" : ""} in progress
          </div>
        </div>
      </div>

      {/* Revenue Overview — last 7 days */}
      <div style={{
        background: "#fff", borderRadius: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: 24, marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Revenue — Last 7 Days</h3>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {fmt(weekly.reduce((s, d) => s + (d.revenue || 0), 0))} total
          </div>
        </div>

        {weekly.length > 0 ? (
          <div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginBottom: 8 }}>
              {weekly.map((d, i) => {
                const h = Math.max(4, (d.revenue / maxRev) * 88);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, color: "#6b7280", fontWeight: 600 }}>
                      {d.revenue > 0 ? fmt(d.revenue) : ""}
                    </div>
                    <div title={`${fmt(d.revenue)} · ${d.orders} order${d.orders !== 1 ? "s" : ""}`} style={{
                      width: "100%", height: h,
                      background: d.revenue > 0
                        ? "linear-gradient(180deg, #7c3aed, #4f46e5)"
                        : "#f3f4f6",
                      borderRadius: "6px 6px 0 0",
                      transition: "height 0.4s ease",
                      cursor: "pointer",
                      minHeight: 4,
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {weekly.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#9ca3af" }}>
                  {d.label || d.date?.slice(5)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
            <div style={{ fontSize: 14 }}>No revenue data yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Revenue will appear once orders are delivered</div>
          </div>
        )}
      </div>

      {/* Subscription Info */}
      {sub && (
        <div style={{
          background: "#fff", borderRadius: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          padding: "16px 20px", marginBottom: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Subscription</h3>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
            <span>Plan: <strong style={{ color: "#7c3aed", textTransform: "capitalize" }}>{sub.plan || "Basic"}</strong></span>
            <span>Max Products: <strong>{sub.maxProducts || 30}</strong></span>
            <span style={{ color: sub.status === "active" ? "#059669" : "#dc2626" }}>
              Status: <strong>{sub.status}</strong>
            </span>
            {sub.expiryDate && (
              <span>Expires: <strong>{new Date(sub.expiryDate).toLocaleDateString("en-IN")}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* ── Payout Section ── */}
      {payoutData && (
        <>
          {/* Balance + Request */}
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24, marginBottom: 20 }}>


            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Withdraw Earnings</h3>
            {(!payoutData?.bankDetails?.accountNumber && !payoutData?.bankDetails?.upiId) && (
              <div style={{ padding: "12px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#92400e", marginTop: 1 }} >!</div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#92400e" }}>Add bank details to request payouts</div>
                    <div style={{ fontSize: 12, color: "#d97706", marginTop: 2 }}>
                      <a href="/bank-details" style={{ color: "#059669", textDecoration: "none", fontWeight: 600 }}>Set up bank/UPI →</a>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Available", value: fmt(payoutData.balance?.available || 0), color: "#059669" },
                { label: "Total Withdrawn", value: fmt(payoutData.balance?.totalWithdrawn || 0), color: "#6b7280" },
                { label: "Pending", value: fmt(payoutData.balance?.pendingPayout || 0), color: "#f59e0b" },
              ].map((b, i) => (
                <div key={i} style={{ padding: "14px 16px", background: "#f9fafb", borderRadius: 12, border: "1px solid #f3f4f6" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{b.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: b.color }}>{b.value}</div>
                </div>
              ))}
            </div>
            {payoutMsg && <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: payoutMsg.includes("fail") || payoutMsg.includes("Minimum") || payoutMsg.includes("Insufficient") || payoutMsg.includes("bank") ? "#fee2e2" : "#d1fae5", color: payoutMsg.includes("fail") || payoutMsg.includes("Minimum") || payoutMsg.includes("Insufficient") || payoutMsg.includes("bank") ? "#b91c1c" : "#065f46" }}>{payoutMsg}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="number"
                value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)}
                placeholder={`Min ${fmt(payoutData?.minPayout || 500)}`}
                style={{ flex: 1, padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit" }}
              />
              <button
                onClick={requestPayout}
                disabled={requesting}
                style={{ padding: "10px 24px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: requesting ? 0.6 : 1, whiteSpace: "nowrap" }}
              >
                {requesting ? "…" : "Request Payout"}
              </button>
            </div>
          </div>

          {/* Payout History */}
          {payoutData.payouts?.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Payout History</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Amount", "Date", "Method", "Reference", "Status"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payoutData.payouts.map(p => {
                      const sc = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.requested;
                      return (
                        <tr key={p._id} style={{ borderBottom: "1px solid #f9fafb" }}>
                          <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#059669" }}>{fmt(p.amount)}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>{p.paymentMethod ? p.paymentMethod.replace("_", " ") : "—"}</td>
                          <td style={{ padding: "12px 16px", fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{p.paymentRef || "—"}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.color }}>{sc.label}</span>
                            {p.rejectionReason && <div style={{ fontSize: 10, color: "#b91c1c", marginTop: 3 }}>{p.rejectionReason}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Transaction History — real orders */}
      <div style={{
        background: "#fff", borderRadius: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Recent Transactions</h3>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</span>
        </div>

        {transactions.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Invoice", "Customer", "Payment", "Date", "Status", "Amount"].map(h => (
                    <th key={h} style={{
                      padding: "11px 16px", textAlign: "left",
                      fontSize: 10, fontWeight: 700, color: "#9ca3af",
                      letterSpacing: 1.2, textTransform: "uppercase",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const isPaid = txn.paymentStatus === "PAID";
                  return (
                    <tr key={txn._id} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td style={{ padding: "13px 16px", fontSize: 12, fontFamily: "monospace", color: "#374151", fontWeight: 600 }}>
                        {txn.invoiceNumber}
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 12, color: "#374151" }}>
                        {txn.customerName}
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 12, color: "#6b7280" }}>
                        {txn.paymentMethod}
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 12, color: "#9ca3af" }}>
                        {new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{
                          background: isPaid ? "#d1fae5" : "#fef3c7",
                          color: isPaid ? "#065f46" : "#92400e",
                          fontSize: 11, fontWeight: 700,
                          padding: "3px 9px", borderRadius: 20,
                        }}>{isPaid ? "Paid" : txn.paymentStatus}</span>
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: "#059669" }}>
                        {fmt(txn.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            No transactions yet — delivered orders will show here
          </div>
        )}
      </div>
    </div>
  );
};

export default Earnings;