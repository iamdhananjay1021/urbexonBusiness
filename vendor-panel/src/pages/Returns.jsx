/**
 * Returns.jsx — vendor returns dashboard. Pure read layer over the
 * existing Order.return subdocument via /vendor/returns (see
 * vendorReturnController.js) — no new return workflow, no new statuses.
 *
 * Follows the same inline-page conventions as Support.jsx/Wallet.jsx (no
 * shared component library exists in this app).
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { FiRotateCcw, FiDownload, FiChevronLeft, FiChevronRight } from "react-icons/fi";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

// Maps the dashboard's 5 tabs onto the real Order.return.status enum — no
// "Received"/"Closed" states exist on the model, so they aren't invented
// here (see the Phase 5 design discussion: returns are order-level, not a
// separate ReturnRequest workflow).
const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "REQUESTED", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "PICKED_UP", label: "In Transit" },
  { key: "REFUNDED", label: "Completed" },
];

const STATUS_STYLES = {
  REQUESTED: { bg: "#fef3c7", color: "#92400e", label: "Pending" },
  APPROVED: { bg: "#dbeafe", color: "#1d4ed8", label: "Approved" },
  REJECTED: { bg: "#fee2e2", color: "#b91c1c", label: "Rejected" },
  PICKED_UP: { bg: "#ede9fe", color: "#6d28d9", label: "In Transit" },
  REFUNDED: { bg: "#d1fae5", color: "#065f46", label: "Completed" },
};

const REFUND_STATUS_STYLES = {
  NONE: { bg: "#f3f4f6", color: "#6b7280", label: "—" },
  REQUESTED: { bg: "#fef3c7", color: "#92400e", label: "Requested" },
  PROCESSING: { bg: "#dbeafe", color: "#1d4ed8", label: "Processing" },
  PROCESSED: { bg: "#d1fae5", color: "#065f46", label: "Refunded" },
  FAILED: { bg: "#fee2e2", color: "#b91c1c", label: "Failed" },
  REJECTED: { bg: "#fee2e2", color: "#b91c1c", label: "Rejected" },
};

const StatusPill = ({ status, map }) => {
  const s = map[status] || { bg: "#f3f4f6", color: "#6b7280", label: status };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
};

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
};

const Returns = () => {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const loadReturns = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get("/vendor/returns", { params });
      setReturns(data.returns || []);
      setStats(data.stats || null);
      setTotal(data.total || 0);
      setTotalPages(data.pages || 1);
    } catch {
      setError("Failed to load returns");
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  }, [page, statusFilter, dateFrom, dateTo, search]);

  useEffect(() => { loadReturns(); }, [loadReturns]);

  const applyStatus = (status) => { setStatusFilter(status); setPage(1); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/vendor/returns/export", { params, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendor-returns-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export returns");
      setTimeout(() => setError(""), 4000);
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

  const statTiles = [
    ["Pending", stats?.requested || 0, "#92400e"],
    ["Approved", stats?.approved || 0, "#1d4ed8"],
    ["In Transit", stats?.pickedUp || 0, "#6d28d9"],
    ["Completed", stats?.refunded || 0, "#065f46"],
    ["Rejected", stats?.rejected || 0, "#b91c1c"],
  ];

  return (
    <div style={{ maxWidth: 1150 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <FiRotateCcw /> Returns
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Customer return requests on your products</p>
        </div>
        <button onClick={handleExport} disabled={exporting} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "1px solid #e5e7eb",
          background: "#fff", color: "#374151", fontSize: 13, fontWeight: 700, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.6 : 1,
        }}>
          <FiDownload size={14} /> {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 600, background: "#fee2e2", color: "#b91c1c", animation: "fadeUp .3s ease" }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
        {statTiles.map(([label, value, color]) => (
          <div key={label} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => applyStatus(key)} style={{
            padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${statusFilter === key ? "#7c3aed" : "#e5e7eb"}`,
            background: statusFilter === key ? "#f5f3ff" : "#fff",
            color: statusFilter === key ? "#6d28d9" : "#6b7280",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>From</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={inputStyle} />
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>To</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={inputStyle} />
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>Search</label>
          <input type="text" placeholder="Order number or customer…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={inputStyle} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Return Requests</h3>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{total} total</span>
        </div>

        {listLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 50 }}>
            <div style={{ width: 28, height: 28, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          </div>
        ) : returns.length === 0 ? (
          <div style={{ textAlign: "center", padding: 50, color: "#9ca3af", fontSize: 13 }}>
            {statusFilter || dateFrom || dateTo || search ? "No returns match these filters." : "No return requests yet."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Order", "Customer", "Requested", "Reason", "Status", "Refund", "Amount"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r._id} onClick={() => navigate(`/returns/${r._id}`)} style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#fafafa"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}>
                    <td style={{ padding: "13px 16px", fontSize: 12, fontFamily: "monospace", color: "#374151", fontWeight: 600 }}>
                      {r.invoiceNumber || `#${r._id.slice(-6).toUpperCase()}`}
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#374151" }}>{r.customerName}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#6b7280" }}>{fmtDate(r.return.requestedAt)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#6b7280", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.return.reason}>
                      {r.return.reason || "—"}
                    </td>
                    <td style={{ padding: "13px 16px" }}><StatusPill status={r.return.status} map={STATUS_STYLES} /></td>
                    <td style={{ padding: "13px 16px" }}><StatusPill status={r.refund.status} map={REFUND_STATUS_STYLES} /></td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmt(r.return.refundAmount)}</td>
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
          <button aria-label="Previous page" disabled={page <= 1 || listLoading} onClick={() => setPage((p) => p - 1)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: 8, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1, display: "flex" }}>
            <FiChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button aria-label="Next page" disabled={page >= totalPages || listLoading} onClick={() => setPage((p) => p + 1)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: 8, cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1, display: "flex" }}>
            <FiChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Returns;
