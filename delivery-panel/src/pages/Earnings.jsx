/**
 * Delivery Earnings — Production v5.0
 * Urbexon design + real API + payout request/history
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { G, fmt } from "../utils/theme";

const EARNING_PER_DELIVERY = 40;

const STATUS_COLORS = {
  requested: { bg: "#fef3c7", color: "#92400e", label: "Requested" },
  approved: { bg: "#dbeafe", color: "#1d4ed8", label: "Approved" },
  processing: { bg: "#e0e7ff", color: "#4338ca", label: "Processing" },
  completed: { bg: "#d1fae5", color: "#065f46", label: "Completed" },
  rejected: { bg: "#fee2e2", color: "#b91c1c", label: "Rejected" },
};

const Earnings = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today");

  // Payout state
  const [payoutData, setPayoutData] = useState(null);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [earnRes, payRes] = await Promise.all([
        api.get("/delivery/earnings"),
        api.get("/delivery/payouts"),
      ]);
      setData(earnRes.data);
      setPayoutData(payRes.data);
    } catch { }
    finally { setLoading(false); setPayoutLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const requestPayout = async () => {
    const amt = Number(payoutAmount);
    if (!amt || amt < (payoutData?.minPayout || 200)) {
      setPayoutMsg(`Minimum payout: ${fmt(payoutData?.minPayout || 200)}`);
      setTimeout(() => setPayoutMsg(""), 3000);
      return;
    }
    setRequesting(true);
    try {
      const { data: res } = await api.post("/delivery/payouts/request", { amount: amt });
      setPayoutMsg(res.message || "Payout requested!");
      setPayoutAmount("");
      // Refresh payout data
      const { data: fresh } = await api.get("/delivery/payouts");
      setPayoutData(fresh);
    } catch (err) {
      setPayoutMsg(err.response?.data?.message || "Failed to request payout");
    } finally {
      setRequesting(false);
      setTimeout(() => setPayoutMsg(""), 4000);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${G.green100}`, borderTopColor: G.brand, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    </div>
  );

  const maxBar = Math.max(...(data?.weeklyBreakdown?.map(d => d.earnings) || [1]), 1);

  const tabData = {
    today: { earnings: data?.todayEarnings ?? 0, deliveries: data?.todayDeliveries ?? 0, label: "Today" },
    week: { earnings: data?.weekEarnings ?? 0, deliveries: data?.weekDeliveries ?? 0, label: "This Week" },
    total: { earnings: data?.totalEarnings ?? 0, deliveries: data?.totalDeliveries ?? 0, label: "Total" },
  };
  const active = tabData[tab];

  return (
    <div style={{ animation: "slideUp .25s ease" }}>
      {/* ── Page Head ── */}
      <div style={{ padding: "20px var(--px) 4px" }}>
        <div className="ud-page-title" style={{ fontSize: 20, fontWeight: 800, color: G.text }}>Earnings</div>
        <div style={{ fontSize: 13, color: G.textSub, marginTop: 2 }}>Track your income and performance</div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${G.border}`, margin: "12px 0 0" }}>
        {[
          { key: "today", label: "Today" },
          { key: "week", label: "This Week" },
          { key: "total", label: "Total" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: 10, border: "none", background: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              color: tab === t.key ? G.brand : G.textSub,
              borderBottom: tab === t.key ? `2px solid ${G.brand}` : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Earnings Hero ── */}
      <div style={{ background: G.brand, borderRadius: 12, padding: 20, margin: "12px var(--px) 0", color: G.white }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>🗓️</span>
          <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{active.label} Earnings</span>
        </div>
        <div className="ud-hero-val" style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>{fmt(active.earnings)}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{active.deliveries} deliveries</div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", margin: "12px var(--px) 0", border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden" }}>
        {[
          { icon: "📦", label: "Deliveries", value: active.deliveries },
          { icon: "💸", label: "Per Delivery", value: fmt(EARNING_PER_DELIVERY), green: true },
          { icon: "⭐", label: "Rating", value: data?.rating ? `${Number(data.rating).toFixed(1)}` : "—" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "14px 12px", borderRight: i < 2 ? `1px solid ${G.border}` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 12 }}>{s.icon}</span>
              <span style={{ fontSize: 11, color: G.textSub }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.green ? G.brand : G.text }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Per Delivery Banner ── */}
      <div style={{ margin: "12px var(--px) 0", background: `linear-gradient(135deg,${G.navy},#1e293b)`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", color: G.white }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>PER DELIVERY EARNING</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: G.brand }}>{fmt(EARNING_PER_DELIVERY)}</div>
        </div>
        <div style={{ fontSize: 40 }}>💸</div>
      </div>

      {/* ── Earnings Breakdown ── */}
      <div style={{ margin: "16px var(--px) 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Earnings Breakdown</div>
        <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, padding: "0 16px" }}>
          {[
            { label: "Deliveries", value: `${active.deliveries} × ${fmt(EARNING_PER_DELIVERY)}`, color: G.text },
            { label: "Total Earned", value: fmt(active.earnings), color: G.brand, bold: true },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i === 0 ? `1px solid ${G.borderLight}` : "none", fontSize: row.bold ? 15 : 14, fontWeight: row.bold ? 800 : 400 }}>
              <span style={{ color: G.text }}>{row.label}</span>
              <span style={{ color: row.color, fontWeight: 700 }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Weekly Bar Chart ── */}
      {data?.weeklyBreakdown?.length > 0 && (
        <div style={{ margin: "16px var(--px) 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>This Week</div>
          <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, padding: "16px 16px 12px" }}>
            <div className="ud-bar-wrap" style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, justifyContent: "space-around" }}>
              {data.weeklyBreakdown.map((d, i) => {
                const isToday = i === data.weeklyBreakdown.length - 1;
                const h = Math.max((d.earnings / maxBar) * 90, 4);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                    {d.earnings > 0 && <div style={{ fontSize: 9, fontWeight: 700, color: G.green600 }}>{fmt(d.earnings)}</div>}
                    <div style={{ width: "100%", maxWidth: 28, height: h, borderRadius: "4px 4px 0 0", background: isToday ? G.brand : d.earnings > 0 ? "#86efac" : G.borderLight, transition: "height .3s" }} />
                    <div style={{ fontSize: 10, fontWeight: isToday ? 800 : 500, color: isToday ? G.text : G.textMuted }}>{d.day}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Weekly Table ── */}
      {data?.weeklyBreakdown?.length > 0 && (
        <div style={{ margin: "16px var(--px) 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Weekly Summary</div>
          <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Day", "Deliveries", "Earned"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.weeklyBreakdown.map((d, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${G.borderLight}` }}>
                      <td style={{ padding: "11px 14px", fontSize: 13 }}>{d.day} <span style={{ fontSize: 10, color: G.textMuted }}>{d.date}</span></td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: d.deliveries > 0 ? 700 : 400 }}>{d.deliveries}</td>
                      <td style={{ padding: "11px 14px", fontWeight: 700, color: d.earnings > 0 ? G.green600 : G.textMuted }}>{fmt(d.earnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Payout Section ── */}
      {!payoutLoading && payoutData && (
        <>
          {/* Balance Card */}
          <div style={{ margin: "16px var(--px) 0", background: `linear-gradient(135deg,${G.navy},#1e293b)`, borderRadius: 12, padding: 20, color: G.white }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,.5)", marginBottom: 6 }}>AVAILABLE FOR WITHDRAWAL</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: G.brand }}>{fmt(payoutData.balance?.available || 0)}</div>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "rgba(255,255,255,.6)" }}>
              <span>Earned: {fmt(payoutData.balance?.totalEarned || 0)}</span>
              <span>Withdrawn: {fmt(payoutData.balance?.totalWithdrawn || 0)}</span>
              {payoutData.balance?.pendingPayout > 0 && <span>Pending: {fmt(payoutData.balance.pendingPayout)}</span>}
            </div>
          </div>

          {/* Request Payout */}
          <div style={{ margin: "12px var(--px) 0" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Request Payout</div>
            <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, padding: "14px 16px" }}>
              {payoutMsg && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: payoutMsg.includes("fail") || payoutMsg.includes("Minimum") || payoutMsg.includes("Insufficient") ? "#fee2e2" : "#d1fae5", color: payoutMsg.includes("fail") || payoutMsg.includes("Minimum") || payoutMsg.includes("Insufficient") ? "#b91c1c" : "#065f46" }}>{payoutMsg}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  placeholder={`Min ${fmt(payoutData?.minPayout || 200)}`}
                  style={{ flex: 1, padding: "10px 12px", border: `1.5px solid ${G.border}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
                <button
                  onClick={requestPayout}
                  disabled={requesting || (payoutData.balance?.available || 0) < (payoutData?.minPayout || 200)}
                  style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: G.brand, color: G.white, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: requesting ? 0.6 : 1, whiteSpace: "nowrap" }}
                >
                  {requesting ? "…" : "Withdraw"}
                </button>
              </div>
              {!payoutData.bankDetails?.accountNumber && !payoutData.bankDetails?.upiId && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>⚠️ Add bank details in Profile first</div>
              )}
            </div>
          </div>

          {/* Payout History */}
          {payoutData.payouts?.length > 0 && (
            <div style={{ margin: "16px var(--px) 0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Payout History</div>
              <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden" }}>
                {payoutData.payouts.map((p, i) => {
                  const sc = STATUS_COLORS[p.status] || STATUS_COLORS.requested;
                  return (
                    <div key={p._id} style={{ padding: "12px 16px", borderBottom: i < payoutData.payouts.length - 1 ? `1px solid ${G.borderLight}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: G.text }}>{fmt(p.amount)}</div>
                        <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                        {p.rejectionReason && <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 2 }}>Reason: {p.rejectionReason}</div>}
                        {p.paymentRef && <div style={{ fontSize: 10, color: G.textMuted, marginTop: 1 }}>Ref: {p.paymentRef}</div>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
};

export default Earnings;
