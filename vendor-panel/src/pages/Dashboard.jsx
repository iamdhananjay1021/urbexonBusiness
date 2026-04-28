/**
 * Dashboard.jsx — v4.0 Production
 * ✅ Matches Figma design
 * ✅ All API bugs fixed
 * ✅ WebSocket via NotificationContext
 */
import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import {
    FiPackage, FiClock, FiDollarSign, FiTrendingUp,
    FiToggleLeft, FiToggleRight, FiAlertCircle,
    FiPlus, FiEye, FiBarChart2,
} from "react-icons/fi";

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const STATUS_CFG = {
    PLACED: { bg: "#fef3c7", c: "#92400e", label: "New" },
    CONFIRMED: { bg: "#dbeafe", c: "#1d4ed8", label: "Confirmed" },
    PACKED: { bg: "#ede9fe", c: "#5b21b6", label: "Packed" },
    READY_FOR_PICKUP: { bg: "#fef9c3", c: "#854d0e", label: "Ready" },
    OUT_FOR_DELIVERY: { bg: "#cffafe", c: "#0e7490", label: "Out" },
    DELIVERED: { bg: "#d1fae5", c: "#065f46", label: "Delivered" },
    CANCELLED: { bg: "#fee2e2", c: "#b91c1c", label: "Cancelled" },
};

const StatCard = memo(({ label, value, icon: Icon, color, sub, index }) => (
    <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        animation: `fadeUp 0.4s ease ${index * 0.08}s both`,
    }}>
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                {label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${color}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            <Icon size={22} color={color} />
        </div>
    </div>
));

const QuickCard = memo(({ icon: Icon, label, sub, color, onClick }) => (
    <button onClick={onClick} style={{
        flex: 1, minWidth: 0, padding: "20px 16px",
        background: color, border: "none", borderRadius: 16,
        cursor: "pointer", textAlign: "left",
        transition: "transform 0.15s, box-shadow 0.15s",
        color: "#fff",
    }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
        <Icon size={24} style={{ marginBottom: 10, opacity: 0.9 }} />
        <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>{sub}</div>
    </button>
));

const OrderRow = memo(({ order, onRefresh }) => {
    const cfg = STATUS_CFG[order.orderStatus] || STATUS_CFG.PLACED;
    const [updating, setUpdating] = useState(false);
    const next = { PLACED: "CONFIRMED", CONFIRMED: "PACKED", PACKED: "READY_FOR_PICKUP" };
    const nextStatus = next[order.orderStatus];

    const update = async () => {
        try {
            setUpdating(true);
            await api.patch(`/vendor/orders/${order._id}/status`, { status: nextStatus });
            onRefresh?.();
        } catch (err) {
            alert(err.response?.data?.message || "Failed");
        } finally { setUpdating(false); }
    };

    return (
        <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "#111827", fontFamily: "monospace" }}>
                #{(order._id || "").slice(-6).toUpperCase()}
            </td>
            <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                {order.customerName || order.customer?.name || "Guest"}
            </td>
            <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "#111827" }}>
                {fmt(order.vendorSummary?.subtotal ?? order.totalAmount ?? order.pricing?.finalAmount ?? 0)}
            </td>
            <td style={{ padding: "14px 16px" }}>
                <span style={{
                    background: cfg.bg, color: cfg.c,
                    fontSize: 11, fontWeight: 700,
                    padding: "4px 10px", borderRadius: 20,
                }}>{cfg.label}</span>
            </td>
            <td style={{ padding: "14px 16px", fontSize: 12, color: "#9ca3af" }}>
                {new Date(order.createdAt).toLocaleDateString("en-IN")}
            </td>
            <td style={{ padding: "14px 16px" }}>
                {nextStatus && (
                    <button onClick={update} disabled={updating} style={{
                        padding: "6px 12px",
                        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                        color: "#fff", border: "none", borderRadius: 8,
                        fontSize: 11, fontWeight: 700, cursor: updating ? "not-allowed" : "pointer",
                        opacity: updating ? 0.6 : 1,
                    }}>
                        {updating ? "..." : nextStatus.replace(/_/g, " ")}
                    </button>
                )}
            </td>
        </tr>
    );
});

const Dashboard = () => {
    const navigate = useNavigate();
    const [vendor, setVendor] = useState(null);
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            setError("");
            // Fetch vendor profile first (works for all vendor statuses)
            const vRes = await api.get("/vendor/me");

            if (!vRes.data.success || !vRes.data.vendor) {
                throw new Error("Invalid vendor response");
            }

            setVendor(vRes.data.vendor);

            // Only fetch orders/stats if vendor is approved
            if (vRes.data.vendor.status === "approved") {
                try {
                    const oRes = await api.get("/vendor/orders?limit=10");
                    setOrders(oRes.data.orders || []);
                    setStats(oRes.data.stats || {});
                } catch (orderErr) {
                    console.warn("[Dashboard] Orders fetch failed:", orderErr.response?.data?.message);
                    setOrders([]);
                    setStats({});
                }
            }
        } catch (err) {
            console.error("[Dashboard] Load failed:", err);
            setError(err.response?.data?.message || "Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        // Listen for real-time order events
        const handler = () => load();
        window.addEventListener("vendor:new_order", handler);
        return () => window.removeEventListener("vendor:new_order", handler);
    }, [load]);

    const toggleShop = async () => {
        try {
            setToggling(true);
            const { data } = await api.patch("/vendor/toggle-shop");
            setVendor(prev => prev ? { ...prev, isOpen: data.isOpen } : prev);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to toggle shop");
        } finally { setToggling(false); }
    };

    if (loading) return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <div style={{
                width: 36, height: 36, border: "3px solid #e5e7eb",
                borderTopColor: "#7c3aed", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
            }} />

        </div>
    );

    if (error && !vendor) return (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{
                background: "#fff", borderRadius: 16, padding: 32,
                maxWidth: 400, margin: "0 auto",
                border: "1px solid #fecaca",
            }}>
                <FiAlertCircle size={32} color="#ef4444" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Error Loading Dashboard</div>
                <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>{error}</div>
                <button onClick={load} style={{
                    padding: "10px 20px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer",
                }}>Retry</button>
            </div>
        </div>
    );

    // ── Pending / Under Review / Rejected Vendor ─────────────────
    if (vendor && vendor.status !== "approved") {
        const statusMap = {
            pending: { icon: FiClock, color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", title: "Application Pending", msg: "Your vendor application is under review. We'll notify you once it's approved." },
            under_review: { icon: FiClock, color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd", title: "Under Review", msg: "Your application is being reviewed by our team. This usually takes 24-48 hours." },
            rejected: { icon: FiAlertCircle, color: "#ef4444", bg: "#fef2f2", border: "#fecaca", title: "Application Rejected", msg: vendor.rejectionReason || "Your vendor application was rejected. Please contact support for details." },
            suspended: { icon: FiAlertCircle, color: "#ef4444", bg: "#fef2f2", border: "#fecaca", title: "Account Suspended", msg: "Your vendor account has been suspended. Please contact support." },
        };
        const s = statusMap[vendor.status] || statusMap.pending;
        const StatusIcon = s.icon;

        return (
            <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 20px" }}>

                <div style={{
                    background: s.bg, border: `1px solid ${s.border}`,
                    borderRadius: 20, padding: "48px 32px", textAlign: "center",
                    animation: "fadeUp 0.4s ease both",
                }}>
                    <StatusIcon size={48} color={s.color} style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>{s.title}</h2>
                    <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.6, margin: "0 0 24px" }}>{s.msg}</p>
                    <div style={{
                        background: "#fff", borderRadius: 12, padding: "16px 20px",
                        display: "inline-block", textAlign: "left",
                    }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Shop Details</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{vendor.shopName}</div>
                        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{vendor.ownerName} • {vendor.phone}</div>
                    </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 20 }}>
                    <button onClick={load} style={{
                        padding: "10px 24px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                        color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer",
                        fontSize: 14,
                    }}>Refresh Status</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1200 }}>


            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
                        {vendor?.shopName || "My Shop"}
                    </h1>
                    <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
                        {vendor?.shopCategory || "Vendor Dashboard"}
                    </p>
                </div>

                <button onClick={toggleShop} disabled={toggling} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 18px", borderRadius: 12, border: "2px solid",
                    background: vendor?.isOpen ? "#f0fdf4" : "#fef2f2",
                    borderColor: vendor?.isOpen ? "#10b981" : "#ef4444",
                    color: vendor?.isOpen ? "#065f46" : "#991b1b",
                    fontWeight: 700, fontSize: 13, cursor: toggling ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                }}>
                    {vendor?.isOpen
                        ? <FiToggleRight size={20} color="#10b981" />
                        : <FiToggleLeft size={20} color="#ef4444" />
                    }
                    {toggling ? "Updating..." : vendor?.isOpen ? "Shop Open" : "Shop Closed"}
                </button>
            </div>

            {/* Subscription warning — inactive or expired */}
            {vendor?.subscription && (() => {
                const now = new Date();
                const sub = vendor.subscription;
                const isExpired = sub.expiryDate && new Date(sub.expiryDate) <= now;
                const isInactive = !sub.isActive;
                if (!isInactive && !isExpired) return null;
                const daysLeft = sub.expiryDate
                    ? Math.max(0, Math.ceil((new Date(sub.expiryDate) - now) / (1000 * 60 * 60 * 24)))
                    : null;
                const isExpiringSoon = sub.isActive && daysLeft !== null && daysLeft <= 7;

                if (isExpired || (isInactive && !isExpiringSoon)) {
                    return (
                        <div style={{
                            background: "#fee2e2", border: "1px solid #fca5a5",
                            borderRadius: 12, padding: "14px 18px", marginBottom: 24,
                            display: "flex", alignItems: "center", gap: 10, fontSize: 14,
                        }}>
                            <FiAlertCircle size={18} color="#dc2626" />
                            <span style={{ color: "#7f1d1d", flex: 1 }}>
                                <strong>Subscription {isExpired ? "expired" : "inactive"}.</strong>{" "}
                                Products & orders are paused.{" "}
                                <Link to="/subscription" style={{ color: "#dc2626", fontWeight: 700, textDecoration: "underline" }}>Renew now →</Link>
                            </span>
                        </div>
                    );
                }
                if (isExpiringSoon) {
                    return (
                        <div style={{
                            background: "#fef3c7", border: "1px solid #fcd34d",
                            borderRadius: 12, padding: "12px 18px", marginBottom: 24,
                            display: "flex", alignItems: "center", gap: 10, fontSize: 14,
                        }}>
                            <FiAlertCircle size={18} color="#f59e0b" />
                            <span style={{ color: "#78350f" }}>
                                Subscription expires in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>.{" "}
                                <Link to="/subscription" style={{ color: "#111827", fontWeight: 700 }}>Renew now</Link>
                                {" "}to avoid interruption.
                            </span>
                        </div>
                    );
                }
                return null;
            })()}

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                <StatCard label="Total Orders" value={stats.total || 0} icon={FiPackage} color="#7c3aed" index={0} />
                <StatCard label="Pending" value={stats.pending || 0} icon={FiClock} color="#f59e0b" sub="Need action" index={1} />
                <StatCard label="Revenue" value={fmt(stats.revenue || 0)} icon={FiDollarSign} color="#10b981" sub="Delivered only" index={2} />
                <StatCard label="Delivered" value={stats.delivered || 0} icon={FiTrendingUp} color="#3b82f6" index={3} />
            </div>

            {/* Recent Orders */}
            <div style={{
                background: "#fff", borderRadius: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                overflow: "hidden", marginBottom: 28,
            }}>
                <div style={{
                    padding: "16px 20px", borderBottom: "1px solid #f3f4f6",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Recent Orders</h2>
                    <Link to="/orders" style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600, textDecoration: "none" }}>
                        View All →
                    </Link>
                </div>

                {orders.length === 0 ? (
                    <div style={{ padding: "60px 20px", textAlign: "center", color: "#9ca3af" }}>
                        <FiPackage size={40} color="#e5e7eb" style={{ marginBottom: 12 }} />
                        <div style={{ fontSize: 14 }}>No orders yet. Orders will appear here once customers start ordering.</div>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "#f9fafb" }}>
                                    {["Order ID", "Customer", "Amount", "Status", "Date", "Action"].map(h => (
                                        <th key={h} style={{
                                            padding: "11px 16px", textAlign: "left",
                                            fontSize: 10, fontWeight: 700, color: "#9ca3af",
                                            letterSpacing: 1.2, textTransform: "uppercase",
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <OrderRow key={order._id} order={order} onRefresh={load} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <QuickCard
                    icon={FiPlus}
                    label="Add Product"
                    sub="List new products to your shop"
                    color="linear-gradient(135deg, #4f46e5, #7c3aed)"
                    onClick={() => navigate("/products/new")}
                />
                <QuickCard
                    icon={FiEye}
                    label="View Shop"
                    sub="See how customers view your shop"
                    color="linear-gradient(135deg, #7c3aed, #a855f7)"
                    onClick={() => navigate("/profile")}
                />
                <QuickCard
                    icon={FiBarChart2}
                    label="Analytics"
                    sub="Track your shop performance"
                    color="linear-gradient(135deg, #059669, #10b981)"
                    onClick={() => navigate("/earnings")}
                />
            </div>
        </div>
    );
};

export default Dashboard;
