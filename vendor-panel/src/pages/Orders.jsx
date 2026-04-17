/**
 * Orders.jsx — v3.0 Production
 * Matches Figma: Tab filters, stats cards, order table with product images
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { FiSearch, FiEye, FiPackage, FiClock, FiTruck, FiCheckCircle } from "react-icons/fi";

const STATUS_CFG = {
  PLACED: { bg: "#fef3c7", c: "#92400e", l: "Pending", dot: "#f59e0b" },
  CONFIRMED: { bg: "#dbeafe", c: "#1d4ed8", l: "Processing", dot: "#3b82f6" },
  PACKED: { bg: "#ede9fe", c: "#5b21b6", l: "Processing", dot: "#7c3aed" },
  OUT_FOR_DELIVERY: { bg: "#ffedd5", c: "#c2410c", l: "Shipped", dot: "#f97316" },
  DELIVERED: { bg: "#d1fae5", c: "#065f46", l: "Delivered", dot: "#10b981" },
  CANCELLED: { bg: "#fee2e2", c: "#b91c1c", l: "Cancelled", dot: "#ef4444" },
};

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const TABS = [
  { key: "all", label: "All Orders" },
  { key: "PLACED", label: "Pending" },
  { key: "CONFIRMED", label: "Processing" },
  { key: "OUT_FOR_DELIVERY", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
];

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState("7");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page, limit: 15 });
    if (filter !== "all") p.set("status", filter);
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (dateRange) p.set("days", dateRange);
    api.get(`/vendor/orders?${p}`)
      .then(({ data }) => {
        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setStats(data.stats || {});
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [filter, page, debouncedSearch, dateRange]);

  // Debounce search input — 400ms delay
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/vendor/orders/${id}/status`, { status });
      setOrders(prev => prev.map(o => o._id === id ? { ...o, orderStatus: status } : o));
    } catch (err) { alert(err.response?.data?.message || "Failed"); }
  };

  const tabCounts = {
    all: stats.total || 0,
    PLACED: stats.pending || 0,
    DELIVERED: stats.delivered || 0,
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Orders</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Manage and track your orders</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: "#fff", borderRadius: 12,
        padding: "0 4px",
        display: "flex", gap: 2,
        marginBottom: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        overflowX: "auto",
      }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => { setFilter(key); setPage(1); }} style={{
            padding: "14px 20px",
            border: "none", background: "none",
            borderBottom: `2px solid ${filter === key ? "#7c3aed" : "transparent"}`,
            color: filter === key ? "#7c3aed" : "#6b7280",
            fontWeight: filter === key ? 700 : 500,
            fontSize: 13, cursor: "pointer",
            whiteSpace: "nowrap", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {label}
            {tabCounts[key] !== undefined && tabCounts[key] > 0 && (
              <span style={{
                background: filter === key ? "#7c3aed" : "#e5e7eb",
                color: filter === key ? "#fff" : "#6b7280",
                fontSize: 10, fontWeight: 700,
                padding: "1px 6px", borderRadius: 10,
              }}>{tabCounts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Date Range */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
          <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Search by order ID or customer..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: "100%", padding: "10px 12px 10px 34px",
              border: "1.5px solid #e5e7eb", borderRadius: 10,
              fontSize: 13, color: "#111827", outline: "none",
              fontFamily: "inherit", boxSizing: "border-box", background: "#fff",
            }}
            onFocus={e => e.target.style.borderColor = "#7c3aed"}
            onBlur={e => e.target.style.borderColor = "#e5e7eb"}
          />
        </div>
        <select
          value={dateRange}
          onChange={e => { setDateRange(e.target.value); setPage(1); }}
          style={{
            padding: "10px 12px", border: "1.5px solid #e5e7eb",
            background: "#fff", borderRadius: 10,
            fontSize: 13, color: "#374151", cursor: "pointer", outline: "none",
          }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="">All time</option>
        </select>
      </div>

      {/* Stats mini cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Orders", value: stats.total || 0, color: "#111827" },
          { label: "Pending", value: stats.pending || 0, color: "#f59e0b" },
          { label: "Processing", value: 0, color: "#3b82f6" },
          { label: "Delivered", value: stats.delivered || 0, color: "#10b981" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "#fff", borderRadius: 12,
            padding: "14px 16px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 16, color: "#9ca3af" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "#fff", borderRadius: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          color: "#9ca3af",
        }}>
          <FiPackage size={36} color="#e5e7eb" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14 }}>No orders found</div>
        </div>
      ) : (
        <div style={{
          background: "#fff", borderRadius: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Order ID", "Customer", "Product", "Qty", "Total", "Date", "Status", "Actions"].map(h => (
                    <th key={h} style={{
                      padding: "11px 16px", textAlign: "left",
                      fontSize: 10, fontWeight: 700, color: "#9ca3af",
                      letterSpacing: 1.2, textTransform: "uppercase",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, idx) => {
                  const s = STATUS_CFG[o.orderStatus] || { bg: "#f3f4f6", c: "#374151", l: o.orderStatus, dot: "#9ca3af" };
                  const items = o.items || [];
                  return (
                    <tr key={o._id} style={{ borderBottom: idx < orders.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <td style={{ padding: "13px 16px", fontWeight: 700, color: "#111827", fontSize: 12, fontFamily: "monospace" }}>
                        #{o._id?.slice(-6)?.toUpperCase()}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          {o.customer?.name || o.customerName || "Guest"}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {o.customer?.phone || ""}
                        </div>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {items[0]?.image ? (
                            <img src={items[0].image} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f3f4f6", flexShrink: 0 }} />
                          )}
                          <div style={{ fontSize: 12, color: "#374151", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {items[0]?.name || items[0]?.productName || "Product"}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 13, color: "#374151" }}>
                        {items.length} item{items.length !== 1 ? "s" : ""}
                      </td>
                      <td style={{ padding: "13px 16px", fontWeight: 700, fontSize: 13, color: "#111827" }}>
                        {fmt(o.pricing?.finalAmount || o.totalAmount)}
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 12, color: "#9ca3af" }}>
                        {new Date(o.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: s.bg, color: s.c,
                          fontSize: 11, fontWeight: 700,
                          padding: "4px 10px", borderRadius: 20,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
                          {s.l}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {o.orderStatus === "PLACED" && (
                            <button onClick={() => updateStatus(o._id, "CONFIRMED")} style={{
                              padding: "5px 10px", background: "#dbeafe",
                              border: "none", color: "#1d4ed8",
                              borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700,
                            }}>Confirm</button>
                          )}
                          {o.orderStatus === "CONFIRMED" && (
                            <button onClick={() => updateStatus(o._id, "PACKED")} style={{
                              padding: "5px 10px", background: "#ede9fe",
                              border: "none", color: "#5b21b6",
                              borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700,
                            }}>Mark Packed</button>
                          )}
                          <button onClick={() => navigate(`/orders/${o._id}`)} style={{
                            width: 28, height: 28, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            background: "#f0f4ff", border: "none",
                            borderRadius: 7, cursor: "pointer",
                          }}>
                            <FiEye size={13} color="#7c3aed" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            padding: "12px 16px",
            display: "flex", justifyContent: "space-between",
            alignItems: "center", borderTop: "1px solid #f3f4f6",
          }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{total} total orders</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{
                padding: "7px 14px", border: "1px solid #e5e7eb",
                borderRadius: 8, cursor: "pointer", fontSize: 13, background: "#fff",
                color: page === 1 ? "#d1d5db" : "#374151",
              }}>← Prev</button>
              <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} style={{
                padding: "7px 14px", border: "1px solid #e5e7eb",
                borderRadius: 8, cursor: "pointer", fontSize: 13, background: "#fff",
                color: page * 15 >= total ? "#d1d5db" : "#374151",
              }}>Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;