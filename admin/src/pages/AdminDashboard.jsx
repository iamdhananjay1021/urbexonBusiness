/**
 * AdminDashboard.jsx — Production Final v4.0
 * ✅ 100% dynamic — all data from API
 * ✅ No dummy/mock data in UI
 * ✅ Graceful empty states
 * ✅ Recharts AreaChart with real monthly revenue from orders
 * ✅ Staggered load animations
 * ✅ Locked final design
 */

import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from "recharts";
import api from "../api/adminApi";
import {
    FiDollarSign, FiShoppingBag, FiUsers, FiTrendingUp,
    FiPackage, FiClock, FiGrid, FiRefreshCw,
    FiArrowUpRight, FiArrowDownRight, FiAlertCircle,
    FiInbox, FiChevronDown,
} from "react-icons/fi";

/* ─── Design tokens ─── */
const C = {
    blue: "#2563eb",
    blueBg: "#eff6ff",
    blueMid: "#dbeafe",
    text: "#1e293b",
    sub: "#334155",
    muted: "#475569",
    hint: "#94a3b8",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    bg: "#f0f4ff",
    pageBg: "#f8fafc",
    white: "#ffffff",
    green: "#10b981",
    greenBg: "#f0fdf4",
    amber: "#f59e0b",
    amberBg: "#fffbeb",
    red: "#ef4444",
    redBg: "#fef2f2",
    violet: "#8b5cf6",
    violetBg: "#f5f3ff",
    orange: "#f97316",
    orangeBg: "#fff7ed",
    sky: "#0ea5e9",
    skyBg: "#f0f9ff",
};

const STATUS_CFG = {
    PLACED: { label: "Placed", color: C.amber, bg: C.amberBg },
    CONFIRMED: { label: "Confirmed", color: C.blue, bg: C.blueBg },
    PACKED: { label: "Packed", color: C.violet, bg: C.violetBg },
    SHIPPED: { label: "Shipped", color: C.sky, bg: C.skyBg },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", color: C.orange, bg: C.orangeBg },
    DELIVERED: { label: "Delivered", color: C.green, bg: C.greenBg },
    CANCELLED: { label: "Cancelled", color: C.red, bg: C.redBg },
};

/* ─── Helpers ─── */
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtRev = (v) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
};

/* ─── Skeleton ─── */
const Sk = ({ h = 18, w = "100%", r = 6 }) => (
    <div style={{ height: h, width: w, background: "#e9edf5", borderRadius: r, animation: "skpulse 1.5s ease-in-out infinite" }} />
);

/* ─── Collapsible Section ─── */
const SECTION_KEY = "db_sections_v1";
const loadSections = () => {
    try { return JSON.parse(localStorage.getItem(SECTION_KEY)) || {}; } catch { return {}; }
};
const saveSections = (s) => { try { localStorage.setItem(SECTION_KEY, JSON.stringify(s)); } catch { /* noop */ } };

const Section = ({ id, title, subtitle, icon: Icon, iconColor, iconBg, children, defaultOpen = true, delay = 0, extra }) => {
    const saved = loadSections();
    const [open, setOpen] = useState(saved[id] !== undefined ? saved[id] : defaultOpen);
    const bodyRef = useRef(null);
    const [height, setHeight] = useState(open ? "auto" : "0px");
    const first = useRef(true);

    useEffect(() => {
        if (first.current) { first.current = false; return; }
        if (open) {
            const h = bodyRef.current?.scrollHeight || 0;
            setHeight(`${h}px`);
            const t = setTimeout(() => setHeight("auto"), 320);
            return () => clearTimeout(t);
        } else {
            const h = bodyRef.current?.scrollHeight || 0;
            setHeight(`${h}px`);
            requestAnimationFrame(() => requestAnimationFrame(() => setHeight("0px")));
        }
    }, [open]);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        const s = loadSections(); s[id] = next; saveSections(s);
    };

    return (
        <div style={{ marginBottom: 16, animation: `fadeUp 0.45s ease both`, animationDelay: `${delay}ms` }}>
            <button onClick={toggle} className="db-section-header" style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "12px 16px", background: C.white, border: `1px solid ${C.border}`,
                borderRadius: open ? "12px 12px 0 0" : 12, cursor: "pointer",
                fontFamily: "inherit", transition: "border-radius .25s",
            }}>
                {Icon && (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg || C.blueBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={15} color={iconColor || C.blue} />
                    </div>
                )}
                <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{title}</p>
                    {subtitle && <p style={{ fontSize: 11, color: C.hint, margin: "2px 0 0" }}>{subtitle}</p>}
                </div>
                {extra && <div style={{ marginRight: 8 }}>{extra}</div>}
                <FiChevronDown size={16} color={C.muted} style={{
                    transition: "transform .25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0,
                }} />
            </button>
            <div ref={bodyRef} style={{
                height, overflow: "hidden", transition: "height .3s ease",
                border: open ? `1px solid ${C.border}` : `1px solid transparent`,
                borderTop: "none", borderRadius: "0 0 12px 12px",
                background: "transparent",
            }}>
                <div style={{ padding: "16px 0 0" }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

/* ─── Custom Tooltip ─── */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", fontSize: 12 }}>
            <p style={{ fontWeight: 700, color: C.text, margin: "0 0 4px" }}>{label}</p>
            <p style={{ color: C.blue, margin: 0, fontWeight: 700 }}>₹{fmt(payload[0]?.value)}</p>
            {payload[1] && <p style={{ color: C.green, margin: "2px 0 0", fontWeight: 600 }}>{fmt(payload[1]?.value)} orders</p>}
        </div>
    );
};

/* ─── Stat Card ─── */
const StatCard = ({ icon: Icon, label, value, change, positive, accent, accentBg, loading, delay = 0 }) => (
    <div style={{
        background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: "20px", flex: "1 1 calc(50% - 6px)", minWidth: "calc(50% - 6px)",
        animation: `fadeUp 0.45s ease both`, animationDelay: `${delay}ms`,
        transition: "box-shadow .2s, transform .2s",
    }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(37,99,235,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
        {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Sk h={13} w="55%" /><Sk h={30} w="70%" /><Sk h={12} w="45%" />
            </div>
        ) : (
            <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <p style={{ fontSize: 13, color: C.muted, fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{label}</p>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: accentBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={17} color={accent} />
                    </div>
                </div>
                <p style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: "0 0 10px", letterSpacing: "-0.5px", lineHeight: 1 }}>
                    {value ?? "—"}
                </p>
                {change !== undefined && change !== null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {positive
                            ? <FiArrowUpRight size={13} color={C.green} />
                            : <FiArrowDownRight size={13} color={C.red} />}
                        <span style={{ fontSize: 12, fontWeight: 700, color: positive ? C.green : C.red }}>{Math.abs(change)}%</span>
                        <span style={{ fontSize: 12, color: C.hint }}>vs last month</span>
                    </div>
                ) : (
                    <div style={{ height: 18 }} />
                )}
            </>
        )}
    </div>
);

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [adminName, setAdminName] = useState("Admin");
    const navigate = useNavigate();
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            // 1. Dashboard stats — use comprehensive endpoint
            const { data: dash } = await api.get("/admin/dashboard");
            if (!mounted.current) return;

            const s = dash.stats || {};

            // Derive pending orders from ordersByStatus breakdown
            const statusMap = {};
            (dash.ordersByStatus || []).forEach(o => { statusMap[o._id] = o.count; });
            const pendingOrders = (statusMap.PLACED || 0) + (statusMap.CONFIRMED || 0);

            setAdminName(
                (() => { try { const a = JSON.parse(localStorage.getItem("adminAuth")); return a?.user?.name || "Admin"; } catch { return "Admin"; } })()
            );

            setStats({
                revenue: s.totalRevenue ?? null,
                totalOrders: s.totalOrders ?? null,
                totalCustomers: s.totalUsers ?? null,
                conversionRate: s.totalUsers > 0 ? ((s.totalOrders / s.totalUsers) * 100) : null,
                totalProducts: s.activeProducts ?? null,
                pendingOrders: pendingOrders || null,
                activeVendors: s.activeVendors ?? null,
                revenueChange: s.revenueGrowth ?? null,
                ordersChange: s.ordersGrowth ?? null,
                customersChange: null,
                conversionChange: null,
                productsAdded: s.outOfStock != null ? `${s.outOfStock} out of stock` : null,
                newVendorsWeek: s.pendingVendors > 0 ? `${s.pendingVendors} pending` : null,
            });

            setRecentOrders(dash.recentOrders || []);

            // 2. Chart — use pre-aggregated revenueByDay from API
            if (dash.revenueByDay?.length) {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                setChartData(dash.revenueByDay.map(d => {
                    const dt = new Date(d._id);
                    return { month: `${months[dt.getMonth()]} ${dt.getDate()}`, revenue: d.revenue, orders: d.orders };
                }));
            } else {
                setChartData([]);
            }

            // 3. Top products
            try {
                const { data: prods } = await api.get("/products/admin/all?limit=5");
                const list = prods.products || prods || [];
                setTopProducts(list.slice(0, 5).map((p, i) => ({
                    rank: i + 1,
                    name: p.name,
                    cat: p.category?.name || p.category || "—",
                    price: p.price,
                    sales: p.sold || p.salesCount || 0,
                    stock: p.stock ?? 0,
                    inStock: p.inStock,
                })));
            } catch {
                setTopProducts([]);
            }

        } catch (err) {
            // API failed — show empty states, not fake data
            if (!mounted.current) return;
            setStats(null);
            setRecentOrders([]);
            setChartData([]);
            setTopProducts([]);
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData(true);
        setRefreshing(false);
    };

    // Chart data is pre-aggregated from API
    const processedChart = chartData;

    return (
        <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: C.text, width: "100%", minWidth: 0, background: C.pageBg, minHeight: "100vh", padding: "0 0 40px" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes skpulse { 0%,100%{opacity:1} 50%{opacity:.45} }
                @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
                .db-row-hover:hover { background: #f8faff !important; cursor: pointer; }
                .db-prod-row:hover  { background: #f8faff !important; }
                .db-period-btn      { border: none; font-family: inherit; cursor: pointer; transition: all .15s; }
                .db-stat-grid       { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
                .db-sec-grid        { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
                .db-chart-grid      { display: grid; grid-template-columns: 1fr 340px; gap: 16px; margin-bottom: 20px; align-items: start; }
                .db-tbl-grid        { display: grid; grid-template-columns: 1.1fr 1fr 1.8fr 0.9fr 1.1fr 0.9fr; }
                @media (max-width: 768px) {
                    .db-chart-grid  { grid-template-columns: 1fr !important; }
                    .db-tbl-grid    { grid-template-columns: 1fr 1fr 1fr !important; }
                    .db-tbl-col-hide{ display: none !important; }
                }
                @media (max-width: 480px) {
                    .db-stat-grid .stat-card { flex: 1 1 calc(50% - 6px) !important; min-width: calc(50% - 6px) !important; }
                }
                .db-section-header { outline: none; }
                .db-section-header:hover { background: ${C.bg} !important; }
                .db-section-header:active { transform: scale(0.995); }
            `}</style>

            {/* ── Header ── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap", animation: "fadeUp 0.3s ease both" }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.3px" }}>Dashboard Overview</h1>
                    <p style={{ fontSize: 13, color: C.hint, margin: "4px 0 0" }}>
                        Welcome back, <span style={{ color: C.blue, fontWeight: 700 }}>{adminName}!</span>{" "}Here's your store at a glance.
                    </p>
                </div>
                <button onClick={handleRefresh} disabled={refreshing || loading}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: (refreshing || loading) ? 0.55 : 1, flexShrink: 0, transition: "opacity .2s" }}>
                    <FiRefreshCw size={13} style={{ animation: refreshing ? "skpulse 0.7s linear infinite" : "none" }} />
                    {refreshing ? "Refreshing…" : "Refresh"}
                </button>
            </div>

            {/* ── Primary stat cards ── */}
            <Section id="stats" title="Key Metrics" subtitle="Revenue, orders, customers & conversion" icon={FiTrendingUp} iconColor={C.blue} iconBg={C.blueBg} delay={60}>
                <div className="db-stat-grid">
                    <StatCard
                        icon={FiDollarSign} label="Total Revenue"
                        value={stats?.revenue != null ? `₹${fmt(stats.revenue)}` : null}
                        change={stats?.revenueChange} positive={stats?.revenueChange >= 0}
                        accent={C.green} accentBg={C.greenBg} loading={loading} delay={60}
                    />
                    <StatCard
                        icon={FiShoppingBag} label="Total Orders"
                        value={stats?.totalOrders != null ? fmt(stats.totalOrders) : null}
                        change={stats?.ordersChange} positive={stats?.ordersChange >= 0}
                        accent={C.blue} accentBg={C.blueBg} loading={loading} delay={100}
                    />
                    <StatCard
                        icon={FiUsers} label="Total Customers"
                        value={stats?.totalCustomers != null ? fmt(stats.totalCustomers) : null}
                        change={stats?.customersChange} positive={stats?.customersChange >= 0}
                        accent={C.violet} accentBg={C.violetBg} loading={loading} delay={140}
                    />
                    <StatCard
                        icon={FiTrendingUp} label="Conversion Rate"
                        value={stats?.conversionRate != null ? `${Number(stats.conversionRate).toFixed(2)}%` : null}
                        change={stats?.conversionChange} positive={stats?.conversionChange >= 0}
                        accent={C.orange} accentBg={C.orangeBg} loading={loading} delay={180}
                    />
                </div>
            </Section>

            {/* ── Secondary cards ── */}
            <Section id="secondary" title="Store Overview" subtitle="Products, pending orders & vendors" icon={FiPackage} iconColor={C.violet} iconBg={C.violetBg} delay={200}>
                <div className="db-sec-grid">
                    {/* Total Products */}
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", flex: 1, minWidth: 180 }}>
                        {loading ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Sk h={13} w="50%" /><Sk h={30} w="40%" /><Sk h={12} w="60%" /></div>
                        ) : (
                            <>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: C.violetBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <FiPackage size={16} color={C.violet} />
                                    </div>
                                    <p style={{ fontSize: 13, color: C.muted, fontWeight: 500, margin: 0 }}>Total Products</p>
                                </div>
                                <p style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
                                    {stats?.totalProducts != null ? fmt(stats.totalProducts) : "—"}
                                </p>
                                {stats?.productsAdded != null
                                    ? <p style={{ fontSize: 12, color: C.green, fontWeight: 700, margin: 0 }}>↑ {stats.productsAdded} added this month</p>
                                    : <p style={{ fontSize: 12, color: C.hint, margin: 0 }}>Active listings</p>
                                }
                            </>
                        )}
                    </div>

                    {/* Pending Orders */}
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", flex: 1, minWidth: 180 }}>
                        {loading ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Sk h={13} w="50%" /><Sk h={30} w="40%" /><Sk h={12} w="60%" /></div>
                        ) : (
                            <>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <FiClock size={16} color={C.amber} />
                                    </div>
                                    <p style={{ fontSize: 13, color: C.muted, fontWeight: 500, margin: 0 }}>Pending Orders</p>
                                </div>
                                <p style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
                                    {stats?.pendingOrders != null ? fmt(stats.pendingOrders) : "—"}
                                </p>
                                {stats?.pendingOrders > 0
                                    ? <p style={{ fontSize: 12, color: C.red, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                                        <FiAlertCircle size={11} /> Needs attention
                                    </p>
                                    : <p style={{ fontSize: 12, color: C.green, fontWeight: 700, margin: 0 }}>✓ All clear</p>
                                }
                            </>
                        )}
                    </div>

                    {/* Active Vendors */}
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", flex: 1, minWidth: 180 }}>
                        {loading ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Sk h={13} w="50%" /><Sk h={30} w="40%" /><Sk h={12} w="60%" /></div>
                        ) : (
                            <>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <FiGrid size={16} color={C.green} />
                                    </div>
                                    <p style={{ fontSize: 13, color: C.muted, fontWeight: 500, margin: 0 }}>Active Vendors</p>
                                </div>
                                <p style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
                                    {stats?.activeVendors != null ? fmt(stats.activeVendors) : "—"}
                                </p>
                                {stats?.newVendorsWeek != null
                                    ? <p style={{ fontSize: 12, color: C.amber, fontWeight: 700, margin: 0 }}>{stats.newVendorsWeek}</p>
                                    : <p style={{ fontSize: 12, color: C.hint, margin: 0 }}>Partner vendors</p>
                                }
                            </>
                        )}
                    </div>
                </div>
            </Section>

            {/* ── Chart + Top Products ── */}
            <Section id="analytics" title="Sales Analytics" subtitle="Revenue trend & top performing products" icon={FiDollarSign} iconColor={C.green} iconBg={C.greenBg} delay={300}>
                <div className="db-chart-grid" style={{ gap: 16, marginBottom: 0, alignItems: "start" }}>

                    {/* Sales Chart */}
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 20px 16px", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                            <div>
                                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Sales Overview</h2>
                                <p style={{ fontSize: 12, color: C.hint, margin: "3px 0 0" }}>Revenue trend — Last 30 days</p>
                            </div>
                        </div>

                        {loading ? <Sk h={230} /> : processedChart.length === 0 ? (
                            <div style={{ height: 230, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.hint }}>
                                <FiInbox size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
                                <p style={{ fontSize: 13, margin: 0 }}>No order data available yet</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={processedChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={C.blue} stopOpacity={0.18} />
                                            <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.hint }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: C.hint }} axisLine={false} tickLine={false} tickFormatter={fmtRev} width={52} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area type="monotone" dataKey="revenue" stroke={C.blue} strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: C.blue, strokeWidth: 0 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Top Selling Products */}
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.borderLight}` }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Top Selling Products</h2>
                            <p style={{ fontSize: 12, color: C.hint, margin: "2px 0 0" }}>Best performers by sales count</p>
                        </div>

                        {loading ? (
                            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                                {[0, 1, 2, 3, 4].map(i => (
                                    <div key={i} style={{ display: "flex", gap: 10 }}>
                                        <Sk h={30} w={30} r={8} />
                                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                                            <Sk h={12} w="70%" /><Sk h={10} w="40%" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : topProducts.length === 0 ? (
                            <div style={{ padding: "40px 20px", textAlign: "center", color: C.hint }}>
                                <FiPackage size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                                <p style={{ fontSize: 13, margin: 0 }}>No product data yet</p>
                            </div>
                        ) : topProducts.map((p, i) => (
                            <div key={i} className="db-prod-row"
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < topProducts.length - 1 ? `1px solid ${C.borderLight}` : "none", transition: "background .12s" }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: C.blue, flexShrink: 0 }}>
                                    {p.rank}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                                    <p style={{ fontSize: 11, color: C.hint, margin: "2px 0 0" }}>{p.cat}</p>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>₹{fmt(p.price)}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 3 }}>
                                        <span style={{ fontSize: 10, color: C.hint }}>{fmt(p.sales)} sold</span>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5,
                                            color: p.stock > 20 ? C.green : p.stock > 5 ? C.amber : C.red,
                                            background: p.stock > 20 ? C.greenBg : p.stock > 5 ? C.amberBg : C.redBg,
                                        }}>
                                            {p.stock} left
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ── Recent Orders ── */}
            <Section id="orders" title="Recent Orders" subtitle="Latest customer orders from your store" icon={FiShoppingBag} iconColor={C.amber} iconBg={C.amberBg} delay={380}
                extra={<Link to="/admin/orders" style={{ fontSize: 12, fontWeight: 700, color: C.blue, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: C.blueBg, border: `1px solid ${C.blueMid}`, borderRadius: 8 }} onClick={e => e.stopPropagation()}>View All →</Link>}
            >
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>

                    {/* Table header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.8fr 0.9fr 1.1fr 0.9fr", padding: "10px 20px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                        {["ORDER ID", "CUSTOMER", "PRODUCT", "AMOUNT", "STATUS", "DATE"].map(h => (
                            <span key={h} style={{ fontSize: 10, fontWeight: 800, color: C.hint, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</span>
                        ))}
                    </div>

                    {loading ? (
                        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                            {[0, 1, 2, 3, 4].map(i => <Sk key={i} h={34} />)}
                        </div>
                    ) : recentOrders.length === 0 ? (
                        <div style={{ padding: "48px 20px", textAlign: "center", color: C.hint }}>
                            <FiShoppingBag size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                            <p style={{ fontSize: 14, margin: "0 0 4px", fontWeight: 600, color: C.muted }}>No orders yet</p>
                            <p style={{ fontSize: 13, margin: 0 }}>Orders will appear here once customers start placing them.</p>
                        </div>
                    ) : recentOrders.map((order, i) => {
                        const cfg = STATUS_CFG[order.orderStatus] || STATUS_CFG.PLACED;
                        return (
                            <div key={order._id} onClick={() => navigate("/admin/orders")}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1.2fr 1fr 1.8fr 0.9fr 1.1fr 0.9fr",
                                    padding: "14px 20px",
                                    borderBottom: i < recentOrders.length - 1 ? `1px solid ${C.borderLight}` : "none",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    transition: "background .15s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.bg; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                            >
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>#{order._id.slice(-6).toUpperCase()}</span>
                                <span style={{ fontSize: 13, color: C.sub, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.customerName || "—"}</span>
                                <span style={{ fontSize: 13, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
                                    {order.items?.[0]?.name || "—"}
                                    {order.items?.length > 1 && <span style={{ color: C.hint, fontSize: 11 }}> +{order.items.length - 1}</span>}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>₹{fmt(order.totalAmount)}</span>
                                <span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}28`, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>
                                        {cfg.label}
                                    </span>
                                </span>
                                <span style={{ fontSize: 12, color: C.hint }}>
                                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </Section>

            {/* ── Quick Actions ── */}
            <Section id="quick-actions" title="Quick Actions" subtitle="Jump to key sections" icon={FiGrid} iconColor={C.violet} iconBg={C.violetBg} delay={300}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, padding: "0 16px 16px" }}>
                    {[
                        { to: "map", icon: "🗺️", label: "Live Map", desc: "Users, orders & riders", bg: "linear-gradient(135deg, #2563eb, #3b82f6)" },
                        { to: "local-delivery", icon: "🚴", label: "Local Delivery", desc: "Dispatch & track", bg: "linear-gradient(135deg, #f97316, #fb923c)" },
                        { to: "orders", icon: "📦", label: "All Orders", desc: "Manage & process", bg: "linear-gradient(135deg, #10b981, #34d399)" },
                        { to: "settlements", icon: "💰", label: "Settlements", desc: "Vendor payouts", bg: "linear-gradient(135deg, #8b5cf6, #a78bfa)" },
                    ].map((a) => (
                        <Link key={a.to} to={a.to} style={{
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 12,
                            padding: "14px 16px", borderRadius: 12, background: C.white,
                            border: `1px solid ${C.border}`, transition: "all 0.15s",
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.1)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
                        >
                            <div style={{
                                width: 40, height: 40, borderRadius: 10, background: a.bg,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 18, flexShrink: 0,
                            }}>{a.icon}</div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.label}</div>
                                <div style={{ fontSize: 11, color: C.hint }}>{a.desc}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </Section>
        </div>
    );

};

export default AdminDashboard;