/**
 * Order History — Production v4.0
 * Delivered orders with search + earnings summary
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/axios";
import { G, fmt, fmtDate } from "../utils/theme";

const OrderHistory = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        try {
            const { data } = await api.get("/delivery/orders");
            setOrders((data.orders || []).filter(o => o.orderStatus === "DELIVERED"));
        } catch (err) {
            console.error("[OrderHistory]", err.message);
            setOrders([]);
        }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        if (!search.trim()) return orders;
        const q = search.toLowerCase();
        return orders.filter(o =>
            (o.customerName || "").toLowerCase().includes(q) ||
            (o._id || "").toLowerCase().includes(q) ||
            (o.address || "").toLowerCase().includes(q)
        );
    }, [orders, search]);

    const totalEarnings = filtered.reduce((sum, o) => sum + (o.earning || 40), 0);

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
            <div style={{ width: 24, height: 24, border: `3px solid ${G.green100}`, borderTopColor: G.brand, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
        </div>
    );

    return (
        <div style={{ animation: "slideUp .25s ease" }}>
            {/* ── Page Head ── */}
            <div style={{ padding: "20px var(--px) 4px" }}>
                <div className="ud-page-title" style={{ fontSize: 20, fontWeight: 800, color: G.text }}>Order History</div>
                <div style={{ fontSize: 13, color: G.textSub, marginTop: 2 }}>{orders.length} completed deliveries</div>
            </div>

            {/* ── Search ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9fafb", border: `1px solid ${G.border}`, borderRadius: 10, margin: "12px var(--px) 0" }}>
                <span style={{ fontSize: 14, color: G.textMuted }}>🔍</span>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by order ID or customer"
                    style={{ border: "none", background: "none", fontSize: 13, color: G.text, width: "100%", outline: "none" }}
                />
                {search && (
                    <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: G.textMuted, fontSize: 14, padding: 0 }}>✕</button>
                )}
            </div>

            {/* ── Summary ── */}
            <div style={{ margin: "12px var(--px) 0", border: `1px solid ${G.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", background: G.white }}>
                <div>
                    <div style={{ fontSize: 11, color: G.textSub, fontWeight: 600 }}>Total Earnings</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: G.brand, marginTop: 2 }}>{fmt(totalEarnings)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: G.textSub, fontWeight: 600 }}>Orders</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: G.text, marginTop: 2 }}>{filtered.length}</div>
                </div>
            </div>

            {/* ── Orders List ── */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontWeight: 600, color: G.textSub }}>
                        {search ? "No orders match your search" : "No delivered orders yet"}
                    </div>
                </div>
            ) : (
                <div style={{ marginTop: 8 }}>
                    {filtered.map(order => (
                        <div
                            key={order._id}
                            className="ud-order-card"
                            style={{ margin: "0 var(--px) 10px", border: `1px solid ${G.border}`, borderRadius: 12, background: G.white, padding: "14px 16px" }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>Order #{(order._id || "").slice(-7).toUpperCase()}</div>
                                    <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11, color: G.textMuted }}>
                                        <span>📅 {fmtDate(order.createdAt)}</span>
                                    </div>
                                </div>
                                <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: G.green100, color: "#065f46" }}>Delivered</span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: G.text, marginBottom: 4 }}>{order.customerName}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                                <span style={{ fontSize: 13 }}>📍</span>
                                <span style={{ fontSize: 12, color: G.textSub }}>{order.address}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 12, color: G.textSub }}>
                                    📦 {order.items?.length || 0} items • {fmt(order.totalAmount)}
                                </span>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 11, color: G.textSub }}>You earned</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: G.brand }}>+{fmt(order.earning || 40)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ height: 20 }} />
        </div>
    );
};

export default OrderHistory;
