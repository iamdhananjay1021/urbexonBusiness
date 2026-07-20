/**
 * Wallet.jsx — vendor wallet ledger. Pure presentation layer over the
 * existing /vendor/wallet* endpoints (vendorWalletController.js) — every
 * balance/summary number is a value already computed server-side
 * (vendorWalletService.js). Nothing here sums, subtracts, or recomputes
 * a balance.
 *
 * Follows Support.jsx/Earnings.jsx's established page conventions: no
 * shared component library exists in this app (unlike admin's
 * components/ui/), so "table"/"pagination"/"modal"/"spinner" below are
 * the same inline patterns already used everywhere else in this app,
 * not new primitives.
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import Modal from "../components/Modal";
import {
  FiCreditCard, FiTrendingUp, FiTrendingDown, FiClock,
  FiDownload, FiEye, FiChevronLeft, FiChevronRight, FiPocket,
} from "react-icons/fi";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const WALLET_TX_TYPE_LABELS = {
  opening_balance: "Opening Balance",
  settlement_credit: "Settlement Credit",
  withdrawal_debit: "Withdrawal",
  manual_credit: "Manual Credit",
  manual_debit: "Manual Debit",
  refund_adjustment: "Refund Adjustment",
  chargeback: "Chargeback",
};
const isCreditType = (type) => ["opening_balance", "settlement_credit", "manual_credit"].includes(type);
const REFERENCE_LABELS = { Settlement: "Settlement", Payout: "Payout", ApprovalRequest: "Admin Adjustment" };

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
};

/* ── Transaction Detail Modal — vendor-scoped fields only. The backend
     entry also carries createdBy (admin identity) and never returns
     reviewer/approval-request metadata to this endpoint at all
     (getMyWalletTransactionDetail only projects the ledger row itself)
     — nothing extra needs to be scrubbed here, just not over-rendered. */
const TransactionDetailModal = ({ txn, onClose }) => {
  return (
    <Modal open={!!txn} onClose={onClose} title="Transaction Detail" width={460}>
      {txn && (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: "0 0 18px" }}>Transaction Detail</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              ["Date", fmtDateTime(txn.createdAt)],
              ["Type", WALLET_TX_TYPE_LABELS[txn.type] || txn.type],
              ["Amount", `${isCreditType(txn.type) ? "+" : "-"}${fmt(txn.amount)}`],
              ["Balance After", fmt(txn.balanceAfter)],
              ["Reference Type", txn.referenceType ? (REFERENCE_LABELS[txn.referenceType] || txn.referenceType) : "—"],
              ["Reference ID", txn.referenceId || "—"],
              ["Description", txn.description || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 2, wordBreak: "break-word" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

const Wallet = () => {
  const [summary, setSummary] = useState(null); // { walletBalance, totalCredited, totalDebited, transactionCount }
  const [pendingPayout, setPendingPayout] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });

  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest"); // newest | oldest — backend always returns newest-first, so "oldest" is a client-side reverse of the loaded page
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [exporting, setExporting] = useState(false);

  const showMsg = (text, type = "info") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  // Summary + pending payout — loaded once (and on manual refresh), never
  // re-fetched on page/filter changes, since pagination/filters only
  // affect the transaction list below.
  const loadSummary = useCallback(async () => {
    try {
      const [{ data: wallet }, payoutRes] = await Promise.all([
        api.get("/vendor/wallet"),
        api.get("/vendor/payouts").catch(() => null), // pending payout is a nice-to-have; don't fail the whole page if unavailable
      ]);
      setSummary(wallet);
      setPendingPayout(payoutRes?.data?.balance?.pendingPayout ?? null);
    } catch {
      setError("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTxnLoading(true);
    try {
      const params = { page, limit: 20 };
      if (typeFilter) params.type = typeFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await api.get("/vendor/wallet/transactions", { params });
      setTransactions(data.transactions || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      showMsg("Failed to load transactions", "error");
    } finally {
      setTxnLoading(false);
    }
  }, [page, typeFilter, dateFrom, dateTo]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (typeFilter) params.type = typeFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get("/vendor/wallet/transactions/export", { params, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `wallet-transactions-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showMsg("Failed to export transactions", "error");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error && !summary) return (
    <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>{error}</div>
  );

  // Search has no backend query-param support (getHistory only filters by
  // type/date) — applied client-side over the currently-loaded page rather
  // than adding a new backend param.
  const filtersActive = !!(typeFilter || dateFrom || dateTo || search.trim());
  let visibleRows = transactions.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const haystack = `${t.description || ""} ${t.referenceId || ""} ${WALLET_TX_TYPE_LABELS[t.type] || t.type}`.toLowerCase();
    return haystack.includes(q);
  });
  if (sortOrder === "oldest") visibleRows = [...visibleRows].reverse();

  const lastTxn = transactions[0];

  const statCards = [
    { label: "Current Balance", value: fmt(summary?.walletBalance), icon: FiCreditCard, color: "#7c3aed", bg: "linear-gradient(135deg, #7c3aed, #4f46e5)", light: false },
    { label: "Lifetime Credits", value: fmt(summary?.totalCredited), icon: FiTrendingUp, color: "#059669" },
    { label: "Lifetime Debits", value: fmt(summary?.totalDebited), icon: FiTrendingDown, color: "#ef4444" },
    { label: "Last Transaction", value: lastTxn ? fmtDateTime(lastTxn.createdAt) : "—", sub: lastTxn ? (WALLET_TX_TYPE_LABELS[lastTxn.type] || lastTxn.type) : undefined, icon: FiClock, color: "#f59e0b" },
    { label: "Pending Payout", value: pendingPayout !== null ? fmt(pendingPayout) : "—", icon: FiPocket, color: "#2563eb" },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <FiPocket /> Wallet
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Your balance and transaction ledger</p>
      </div>

      {msg.text && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 600, animation: "fadeUp .3s ease",
          background: msg.type === "error" ? "#fee2e2" : "#d1fae5",
          color: msg.type === "error" ? "#b91c1c" : "#065f46",
        }}>
          {msg.text}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {statCards.map(({ label, value, sub, icon: Icon, color, bg }, i) => (
          <div key={label} style={{
            background: bg || "#fff", borderRadius: 16, padding: 22,
            boxShadow: bg ? "0 4px 20px rgba(124,58,237,0.3)" : "0 1px 4px rgba(0,0,0,0.06)",
            animation: `fadeUp 0.3s ease ${i * 0.06}s both`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: bg ? "rgba(255,255,255,0.8)" : "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 }}>
                {label}
              </div>
              <Icon size={16} color={bg ? "#fff" : color} />
            </div>
            <div style={{ fontSize: label === "Last Transaction" ? 16 : 22, fontWeight: 800, color: bg ? "#fff" : "#111827" }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: bg ? "rgba(255,255,255,0.8)" : "#9ca3af", marginTop: 3 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ minWidth: 150 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>Type</label>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">All Types</option>
            {Object.entries(WALLET_TX_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>From</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={inputStyle} />
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>To</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={inputStyle} />
        </div>
        <div style={{ minWidth: 180, flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>Search</label>
          <input type="text" placeholder="Description, type, reference…" value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>Sort</label>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={inputStyle}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
        <button onClick={handleExport} disabled={exporting} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "1px solid #e5e7eb",
          background: "#fff", color: "#374151", fontSize: 13, fontWeight: 700, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.6 : 1, whiteSpace: "nowrap",
        }}>
          <FiDownload size={14} /> {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {/* Transaction table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Transaction History</h3>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{total} total</span>
        </div>

        {txnLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 50 }}>
            <div style={{ width: 28, height: 28, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          </div>
        ) : visibleRows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 50, color: "#9ca3af", fontSize: 13 }}>
            {filtersActive ? "No transactions match these filters." : "No transactions yet — your wallet activity will show up here."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Date", "Type", "Amount", "Balance After", "Reference", "Description", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((t) => (
                  <tr key={t._id} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDateTime(t.createdAt)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>{WALLET_TX_TYPE_LABELS[t.type] || t.type}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: isCreditType(t.type) ? "#059669" : "#ef4444" }}>
                      {isCreditType(t.type) ? "+" : "-"}{fmt(t.amount)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>{fmt(t.balanceAfter)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>{t.referenceType ? (REFERENCE_LABELS[t.referenceType] || t.referenceType) : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.description}>{t.description || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <button onClick={() => setSelectedTxn(t)} style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb",
                        background: "#fff", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>
                        <FiEye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 18 }}>
          <button aria-label="Previous page" disabled={page <= 1 || txnLoading} onClick={() => setPage((p) => p - 1)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: 8, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1, display: "flex" }}>
            <FiChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button aria-label="Next page" disabled={page >= totalPages || txnLoading} onClick={() => setPage((p) => p + 1)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: 8, cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1, display: "flex" }}>
            <FiChevronRight size={15} />
          </button>
        </div>
      )}

      <TransactionDetailModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />
    </div>
  );
};

export default Wallet;
