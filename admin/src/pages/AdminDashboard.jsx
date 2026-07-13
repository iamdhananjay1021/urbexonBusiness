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
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from "recharts";
import api from "../api/adminApi";
import { useAdminWsContext } from "../contexts/AdminWsContext";
import {
    FiDollarSign, FiShoppingBag, FiUsers, FiTrendingUp,
    FiPackage, FiClock, FiGrid, FiRefreshCw,
    FiArrowUpRight, FiArrowDownRight, FiAlertCircle,
    FiInbox, FiChevronDown, FiTruck, FiUserCheck, FiRefreshCcw, FiAlertTriangle,
} from "react-icons/fi";
import { Skeleton, StatusBadge, EmptyState } from "../components/ui";

/* ─── Helpers ─── */
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtRev = (v) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
};

/* ─── Collapsible Section ─── */
const SECTION_KEY = "db_sections_v1";
const loadSections = () => {
    try { return JSON.parse(localStorage.getItem(SECTION_KEY)) || {}; } catch { return {}; }
};
const saveSections = (s) => { try { localStorage.setItem(SECTION_KEY, JSON.stringify(s)); } catch { /* noop */ } };

const Section = ({ id, title, subtitle, icon: Icon, iconColor, iconBg, children, defaultOpen = true, delay = 0, extra }) => {
    // BUG FIX: was `const saved = loadSections()` called as a plain
    // expression above useState — that read+JSON.parse'd localStorage on
    // EVERY render of every Section instance (5 of them), even though the
    // value is only ever consulted once, at mount. useState's lazy
    // initializer form runs the function only on the component's first
    // render.
    const [open, setOpen] = useState(() => {
        const saved = loadSections();
        return saved[id] !== undefined ? saved[id] : defaultOpen;
    });
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
                padding: "12px 16px", background: "var(--adm-surface)", border: `1px solid var(--adm-border)`,
                borderRadius: open ? "12px 12px 0 0" : 12, cursor: "pointer",
                fontFamily: "inherit", transition: "border-radius .25s",
            }}>
                {Icon && (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg || "var(--adm-primary-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={15} color={iconColor || "var(--adm-primary)"} />
                    </div>
                )}
                <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>{title}</p>
                    {subtitle && <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>{subtitle}</p>}
                </div>
                {extra && <div style={{ marginRight: 8 }}>{extra}</div>}
                <FiChevronDown size={16} color={"var(--adm-text-secondary)"} style={{
                    transition: "transform .25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0,
                }} />
            </button>
            <div ref={bodyRef} style={{
                height, overflow: "hidden", transition: "height .3s ease",
                border: open ? `1px solid var(--adm-border)` : `1px solid transparent`,
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
        <div style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", fontSize: 12 }}>
            <p style={{ fontWeight: 700, color: "var(--adm-text-primary)", margin: "0 0 4px" }}>{label}</p>
            <p style={{ color: "var(--adm-primary)", margin: 0, fontWeight: 700 }}>₹{fmt(payload[0]?.value)}</p>
            {payload[1] && <p style={{ color: "var(--adm-success)", margin: "2px 0 0", fontWeight: 600 }}>{fmt(payload[1]?.value)} orders</p>}
        </div>
    );
};

/* ─── Stat Card ─── */
const StatCard = ({ icon: Icon, label, value, change, positive, accent, accentBg, loading, delay = 0 }) => (
    <div style={{
        background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 14,
        padding: "20px", flex: "1 1 calc(50% - 6px)", minWidth: "calc(50% - 6px)",
        animation: `fadeUp 0.45s ease both`, animationDelay: `${delay}ms`,
        transition: "box-shadow .2s, transform .2s",
    }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(37,99,235,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
        {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton height={13} width="55%" /><Skeleton height={30} width="70%" /><Skeleton height={12} width="45%" />
            </div>
        ) : (
            <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{label}</p>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: accentBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={17} color={accent} />
                    </div>
                </div>
                <p style={{ fontSize: 28, fontWeight: 800, color: "var(--adm-text-primary)", margin: "0 0 10px", letterSpacing: "-0.5px", lineHeight: 1 }}>
                    {value ?? "—"}
                </p>
                {change !== undefined && change !== null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {positive
                            ? <FiArrowUpRight size={13} color={"var(--adm-success)"} />
                            : <FiArrowDownRight size={13} color={"var(--adm-danger)"} />}
                        <span style={{ fontSize: 12, fontWeight: 700, color: positive ? "var(--adm-success)" : "var(--adm-danger)" }}>{Math.abs(change)}%</span>
                        <span style={{ fontSize: 12, color: "var(--adm-muted)" }}>vs last month</span>
                    </div>
                ) : (
                    <div style={{ height: 18 }} />
                )}
            </>
        )}
    </div>
);

/* ─── Mini Stat Card — extracted from three copy-pasted inline card
   blocks (Total Products / Pending Orders / Active Vendors each had their
   own hand-duplicated JSX) into one component, reused below for those
   three plus every newly-added card. ─── */
const MiniStatCard = ({ icon: Icon, iconColor, iconBg, label, value, footer, footerColor, loading }) => (
    <div style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 14, padding: "20px", flex: 1, minWidth: 180 }}>
        {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Skeleton height={13} width="50%" /><Skeleton height={30} width="40%" /><Skeleton height={12} width="60%" /></div>
        ) : (
            <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={16} color={iconColor} />
                    </div>
                    <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", fontWeight: 500, margin: 0 }}>{label}</p>
                </div>
                <p style={{ fontSize: 30, fontWeight: 800, color: "var(--adm-text-primary)", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
                    {value ?? "—"}
                </p>
                <p style={{ fontSize: 12, color: footerColor || "var(--adm-muted)", fontWeight: footerColor ? 700 : 400, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    {footer}
                </p>
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
    // BUG FIX: backend/controllers/admin/dashboardController.js has always
    // computed a full order-status breakdown via $group — this page only
    // ever reduced it down to a single "pendingOrders" number and threw
    // the rest away. Nothing rendered the full distribution anywhere.
    const [statusBreakdown, setStatusBreakdown] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // Read once on mount — this never changes within a session, so it has
    // no business being re-read/re-parsed from localStorage on every
    // fetchData() call (including every manual Refresh click), which is
    // what the previous version did.
    const [adminName] = useState(() => {
        try { return JSON.parse(localStorage.getItem("adminAuth"))?.user?.name || "Admin"; } catch { return "Admin"; }
    });
    const navigate = useNavigate();
    const mounted = useRef(true);
    // Cancels the previous in-flight request set before a new one starts —
    // closes the race window where a rapid Refresh click (or an unmount)
    // could let an older request's response land after a newer one's and
    // silently overwrite fresher state with stale data.
    const abortRef = useRef(null);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; abortRef.current?.abort(); };
    }, []);

    const fetchData = useCallback(async (isRefresh = false) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const { signal } = controller;

        if (!isRefresh) setLoading(true);
        try {
            // 1. Dashboard stats + the handful of counts this page needs
            // that already exist on other admin endpoints (ops-summary,
            // delivery application stats) — reused as-is, no new backend
            // calls introduced for these.
            const [dashRes, opsRes, appRes] = await Promise.allSettled([
                api.get("/admin/dashboard", { signal }),
                api.get("/admin/ops-summary", { signal }),
                api.get("/admin/delivery/applications/stats", { signal }),
            ]);
            if (signal.aborted || !mounted.current) return;

            const dash = dashRes.status === "fulfilled" ? dashRes.value.data : {};
            const ops = opsRes.status === "fulfilled" ? opsRes.value.data : null;
            const appStats = appRes.status === "fulfilled" ? appRes.value.data?.data : null;

            const s = dash.stats || {};

            // Derive pending orders from ordersByStatus breakdown
            const statusMap = {};
            (dash.ordersByStatus || []).forEach(o => { statusMap[o._id] = o.count; });
            const pendingOrders = (statusMap.PLACED || 0) + (statusMap.CONFIRMED || 0);
            setStatusBreakdown(
                (dash.ordersByStatus || [])
                    .map((o) => ({ status: o._id, count: o.count }))
                    .sort((a, b) => b.count - a.count)
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
                outOfStockCount: s.outOfStock ?? null,
                pendingVendors: s.pendingVendors ?? null,
                // Today / live snapshot — todayRevenue & todayOrders were
                // already returned by /admin/dashboard and simply never
                // read anywhere on this page; activeOrders/activeRiders
                // come from the existing ops-summary aggregate.
                todayRevenue: s.todayRevenue ?? null,
                todayOrders: s.todayOrders ?? null,
                activeOrders: ops?.orders?.live ?? null,
                activeRiders: ops?.riders?.active ?? null,
                pendingRefunds: s.pendingRefunds ?? null,
                pendingApplications: appStats ? (appStats.submitted || 0) + (appStats.under_review || 0) : null,
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
                const { data: prods } = await api.get("/products/admin/all?limit=5", { signal });
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
            if (err.name === "CanceledError" || err.name === "AbortError") return; // superseded by a newer fetch, not a real failure
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

    // Realtime: reuse the ONE shared admin socket (no second connection) to
    // debounce-refresh the dashboard's own numbers when something that
    // would change them happens — same debounced-refetch-on-WS-event
    // pattern already used by AdminOrders.jsx/AdminRefundReturn.jsx. This
    // page has never had any WS wiring before; it previously only ever
    // updated via the manual Refresh button.
    const { lastMessage, connected } = useAdminWsContext();
    const wsRefreshTimer = useRef(null);
    useEffect(() => {
        if (!lastMessage) return;
        if (!["admin:order_event", "vendor:status_changed"].includes(lastMessage.type)) return;
        clearTimeout(wsRefreshTimer.current);
        wsRefreshTimer.current = setTimeout(() => fetchData(true), 1500);
        return () => clearTimeout(wsRefreshTimer.current);
    }, [lastMessage, fetchData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData(true);
        setRefreshing(false);
    };

    // Recomputed only when statusBreakdown actually changes — this used to
    // be an inline IIFE evaluated on every render of the whole dashboard
    // (including renders triggered by unrelated state, e.g. `refreshing`
    // toggling), rebuilding the STATUS_COLOR map and re-summing totals
    // every time for no reason.
    const statusRows = useMemo(() => {
        const total = statusBreakdown.reduce((sum, s) => sum + s.count, 0) || 1;
        const STATUS_COLOR = {
            DELIVERED: "var(--adm-success)", CANCELLED: "var(--adm-danger)", PLACED: "var(--adm-warning)",
            CONFIRMED: "var(--adm-primary)", PACKED: "var(--adm-primary)", READY_FOR_PICKUP: "var(--adm-warning)",
            SHIPPED: "var(--adm-primary)", OUT_FOR_DELIVERY: "var(--adm-warning)",
        };
        return statusBreakdown.map(({ status, count }) => ({
            status, count,
            pct: Math.round((count / total) * 100),
            color: STATUS_COLOR[status] || "var(--adm-muted)",
        }));
    }, [statusBreakdown]);

    return (
        <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "var(--adm-text-primary)", width: "100%", minWidth: 0, background: "var(--adm-bg)", minHeight: "100vh", padding: "0 0 40px" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes skpulse { 0%,100%{opacity:1} 50%{opacity:.45} }
                @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
                .db-row-hover:hover { background: var(--adm-surface-alt) !important; cursor: pointer; }
                .db-prod-row:hover  { background: var(--adm-surface-alt) !important; }
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
                .db-section-header:hover { background: var(--adm-bg) !important; }
                .db-section-header:active { transform: scale(0.995); }
            `}</style>

            {/* ── Header ── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap", animation: "fadeUp 0.3s ease both" }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", margin: 0, letterSpacing: "-0.3px" }}>Dashboard Overview</h1>
                    <p style={{ fontSize: 13, color: "var(--adm-muted)", margin: "4px 0 0" }}>
                        Welcome back, <span style={{ color: "var(--adm-primary)", fontWeight: 700 }}>{adminName}!</span>{" "}Here's your store at a glance.
                        <span style={{ marginLeft: 8, fontSize: 11, color: connected ? "var(--adm-success)" : "var(--adm-muted)" }}>
                            ● {connected ? "Live" : "Reconnecting…"}
                        </span>
                    </p>
                </div>
                <button onClick={handleRefresh} disabled={refreshing || loading}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 9, color: "var(--adm-text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: (refreshing || loading) ? 0.55 : 1, flexShrink: 0, transition: "opacity .2s" }}>
                    <FiRefreshCw size={13} style={{ animation: refreshing ? "skpulse 0.7s linear infinite" : "none" }} />
                    {refreshing ? "Refreshing…" : "Refresh"}
                </button>
            </div>

            {/* ── Primary stat cards ── */}
            <Section id="stats" title="Key Metrics" subtitle="Revenue, orders, customers & conversion" icon={FiTrendingUp} iconColor={"var(--adm-primary)"} iconBg={"var(--adm-primary-tint)"} delay={60}>
                <div className="db-stat-grid">
                    <StatCard
                        icon={FiDollarSign} label="Total Revenue"
                        value={stats?.revenue != null ? `₹${fmt(stats.revenue)}` : null}
                        change={stats?.revenueChange} positive={stats?.revenueChange >= 0}
                        accent={"var(--adm-success)"} accentBg={"var(--adm-success-tint)"} loading={loading} delay={60}
                    />
                    <StatCard
                        icon={FiShoppingBag} label="Total Orders"
                        value={stats?.totalOrders != null ? fmt(stats.totalOrders) : null}
                        change={stats?.ordersChange} positive={stats?.ordersChange >= 0}
                        accent={"var(--adm-primary)"} accentBg={"var(--adm-primary-tint)"} loading={loading} delay={100}
                    />
                    <StatCard
                        icon={FiUsers} label="Total Customers"
                        value={stats?.totalCustomers != null ? fmt(stats.totalCustomers) : null}
                        change={stats?.customersChange} positive={stats?.customersChange >= 0}
                        accent={"#8b5cf6"} accentBg={"#f5f3ff"} loading={loading} delay={140}
                    />
                    <StatCard
                        icon={FiTrendingUp} label="Conversion Rate"
                        value={stats?.conversionRate != null ? `${Number(stats.conversionRate).toFixed(2)}%` : null}
                        change={stats?.conversionChange} positive={stats?.conversionChange >= 0}
                        accent={"var(--adm-warning)"} accentBg={"var(--adm-warning-tint)"} loading={loading} delay={180}
                    />
                </div>
            </Section>

            {/* ── Secondary cards ── */}
            <Section id="secondary" title="Store Overview" subtitle="Products, pending orders & vendors" icon={FiPackage} iconColor={"#8b5cf6"} iconBg={"#f5f3ff"} delay={200}>
                <div className="db-sec-grid">
                    <MiniStatCard
                        icon={FiPackage} iconColor={"#8b5cf6"} iconBg={"#f5f3ff"} loading={loading}
                        label="Total Products" value={stats?.totalProducts != null ? fmt(stats.totalProducts) : null}
                        footer="Active listings"
                    />
                    <MiniStatCard
                        icon={FiClock} iconColor={"var(--adm-warning)"} iconBg={"var(--adm-warning-tint)"} loading={loading}
                        label="Pending Orders" value={stats?.pendingOrders != null ? fmt(stats.pendingOrders) : null}
                        footer={stats?.pendingOrders > 0 ? <><FiAlertCircle size={11} /> Needs attention</> : "✓ All clear"}
                        footerColor={stats?.pendingOrders > 0 ? "var(--adm-danger)" : "var(--adm-success)"}
                    />
                    <MiniStatCard
                        icon={FiGrid} iconColor={"var(--adm-success)"} iconBg={"var(--adm-success-tint)"} loading={loading}
                        label="Active Vendors" value={stats?.activeVendors != null ? fmt(stats.activeVendors) : null}
                        footer={stats?.pendingVendors > 0 ? `${stats.pendingVendors} pending approval` : "Partner vendors"}
                        footerColor={stats?.pendingVendors > 0 ? "var(--adm-warning)" : undefined}
                    />
                </div>
            </Section>

            {/* ── Live Snapshot — the metrics a production quick-commerce
                admin dashboard needs that /admin/dashboard already returns
                (todayRevenue/todayOrders/pendingVendors/pendingRefunds/
                outOfStock) but this page never rendered, plus Active
                Orders/Active Delivery Partners from the existing
                ops-summary endpoint. Deliberately excludes Assignment
                Queue, the realtime event timeline, and Scheduler/WebSocket
                status — those already live on the Operations Dashboard
                (/admin/operations) and showing them here too would just be
                the same numbers twice. ── */}
            <Section id="live-snapshot" title="Live Snapshot" subtitle="Today's activity & items needing attention" icon={FiTrendingUp} iconColor={"var(--adm-primary)"} iconBg={"var(--adm-primary-tint)"} delay={240}
                extra={<Link to="operations" style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-primary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: "var(--adm-primary-tint)", border: "1px solid #dbeafe", borderRadius: 8 }} onClick={e => e.stopPropagation()}>Ops Dashboard →</Link>}
            >
                <div className="db-sec-grid">
                    <MiniStatCard icon={FiDollarSign} iconColor={"var(--adm-success)"} iconBg={"var(--adm-success-tint)"} loading={loading}
                        label="Revenue Today" value={stats?.todayRevenue != null ? `₹${fmt(stats.todayRevenue)}` : null} footer="Since midnight" />
                    <MiniStatCard icon={FiShoppingBag} iconColor={"var(--adm-primary)"} iconBg={"var(--adm-primary-tint)"} loading={loading}
                        label="Orders Today" value={stats?.todayOrders != null ? fmt(stats.todayOrders) : null} footer="Since midnight" />
                    <MiniStatCard icon={FiTruck} iconColor={"#f97316"} iconBg={"#fff7ed"} loading={loading}
                        label="Active Orders" value={stats?.activeOrders != null ? fmt(stats.activeOrders) : null} footer="Not yet delivered/cancelled" />
                    <MiniStatCard icon={FiUserCheck} iconColor={"var(--adm-info)"} iconBg={"var(--adm-info-tint)"} loading={loading}
                        label="Active Delivery Partners" value={stats?.activeRiders != null ? fmt(stats.activeRiders) : null} footer="Online now" />
                    <MiniStatCard icon={FiGrid} iconColor={"var(--adm-warning)"} iconBg={"var(--adm-warning-tint)"} loading={loading}
                        label="Pending Vendor Approval" value={stats?.pendingVendors != null ? fmt(stats.pendingVendors) : null}
                        footer={stats?.pendingVendors > 0 ? "Needs review" : "✓ All clear"} footerColor={stats?.pendingVendors > 0 ? "var(--adm-warning)" : "var(--adm-success)"} />
                    <MiniStatCard icon={FiUserCheck} iconColor={"var(--adm-warning)"} iconBg={"var(--adm-warning-tint)"} loading={loading}
                        label="Pending Delivery Applications" value={stats?.pendingApplications != null ? fmt(stats.pendingApplications) : null}
                        footer={stats?.pendingApplications > 0 ? "Needs review" : "✓ All clear"} footerColor={stats?.pendingApplications > 0 ? "var(--adm-warning)" : "var(--adm-success)"} />
                    <MiniStatCard icon={FiRefreshCcw} iconColor={"var(--adm-danger)"} iconBg={"var(--adm-danger-tint)"} loading={loading}
                        label="Pending Refunds" value={stats?.pendingRefunds != null ? fmt(stats.pendingRefunds) : null}
                        footer={stats?.pendingRefunds > 0 ? "Needs review" : "✓ All clear"} footerColor={stats?.pendingRefunds > 0 ? "var(--adm-danger)" : "var(--adm-success)"} />
                    <MiniStatCard icon={FiAlertTriangle} iconColor={"var(--adm-danger)"} iconBg={"var(--adm-danger-tint)"} loading={loading}
                        label="Out of Stock" value={stats?.outOfStockCount != null ? fmt(stats.outOfStockCount) : null}
                        footer={stats?.outOfStockCount > 0 ? "Restock needed" : "✓ All in stock"} footerColor={stats?.outOfStockCount > 0 ? "var(--adm-danger)" : "var(--adm-success)"} />
                </div>
            </Section>

            {/* ── Chart + Top Products ── */}
            <Section id="analytics" title="Sales Analytics" subtitle="Revenue trend & top performing products" icon={FiDollarSign} iconColor={"var(--adm-success)"} iconBg={"var(--adm-success-tint)"} delay={300}>
                <div className="db-chart-grid" style={{ gap: 16, marginBottom: 0, alignItems: "start" }}>

                    {/* Sales Chart */}
                    <div style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 14, padding: "20px 20px 16px", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                            <div>
                                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Sales Overview</h2>
                                <p style={{ fontSize: 12, color: "var(--adm-muted)", margin: "3px 0 0" }}>Revenue trend — Last 30 days</p>
                            </div>
                        </div>

                        {loading ? <Skeleton height={230} /> : chartData.length === 0 ? (
                            <div style={{ height: 230, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--adm-muted)" }}>
                                <FiInbox size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
                                <p style={{ fontSize: 13, margin: 0 }}>No order data available yet</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={"var(--adm-primary)"} stopOpacity={0.18} />
                                            <stop offset="95%" stopColor={"var(--adm-primary)"} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={"var(--adm-border-soft)"} />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--adm-muted)" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "var(--adm-muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtRev} width={52} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area type="monotone" dataKey="revenue" stroke={"var(--adm-primary)"} strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: "var(--adm-primary)", strokeWidth: 0 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Top Selling Products */}
                    <div style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid var(--adm-border-soft)` }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Top Selling Products</h2>
                            <p style={{ fontSize: 12, color: "var(--adm-muted)", margin: "2px 0 0" }}>Best performers by sales count</p>
                        </div>

                        {loading ? (
                            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                                {[0, 1, 2, 3, 4].map(i => (
                                    <div key={i} style={{ display: "flex", gap: 10 }}>
                                        <Skeleton height={30} width={30} radius={8} />
                                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                                            <Skeleton height={12} width="70%" /><Skeleton height={10} width="40%" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : topProducts.length === 0 ? (
                            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--adm-muted)" }}>
                                <FiPackage size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                                <p style={{ fontSize: 13, margin: 0 }}>No product data yet</p>
                            </div>
                        ) : topProducts.map((p, i) => (
                            <div key={i} className="db-prod-row"
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < topProducts.length - 1 ? `1px solid var(--adm-border-soft)` : "none", transition: "background .12s" }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--adm-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--adm-primary)", flexShrink: 0 }}>
                                    {p.rank}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                                    <p style={{ fontSize: 11, color: "var(--adm-muted)", margin: "2px 0 0" }}>{p.cat}</p>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>₹{fmt(p.price)}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 3 }}>
                                        <span style={{ fontSize: 10, color: "var(--adm-muted)" }}>{fmt(p.sales)} sold</span>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5,
                                            color: p.stock > 20 ? "var(--adm-success)" : p.stock > 5 ? "var(--adm-warning)" : "var(--adm-danger)",
                                            background: p.stock > 20 ? "var(--adm-success-tint)" : p.stock > 5 ? "var(--adm-warning-tint)" : "var(--adm-danger-tint)",
                                        }}>
                                            {p.stock} left
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order Status Breakdown — the full ordersByStatus aggregation
                    the backend has always computed, previously discarded
                    down to a single "pendingOrders" number with nothing
                    else ever rendered anywhere. */}
                <div style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 14, padding: "18px 20px", marginTop: 16 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--adm-text-primary)", margin: "0 0 3px" }}>Order Status Breakdown</h2>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", margin: "0 0 14px" }}>All-time distribution across every order status</p>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={14} />)}
                        </div>
                    ) : statusBreakdown.length === 0 ? (
                        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--adm-muted)" }}>
                            <p style={{ fontSize: 13, margin: 0 }}>No orders yet</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {statusRows.map(({ status, count, pct, color }) => (
                                <div key={status} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-text-secondary)", width: 150, flexShrink: 0, textTransform: "capitalize" }}>
                                        {status.toLowerCase().replace(/_/g, " ")}
                                    </span>
                                    <div style={{ flex: 1, height: 8, background: "var(--adm-border-soft)", borderRadius: 4, overflow: "hidden" }}>
                                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s ease" }} />
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-primary)", width: 70, textAlign: "right", flexShrink: 0 }}>
                                        {fmt(count)} <span style={{ color: "var(--adm-muted)", fontWeight: 500 }}>({pct}%)</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Section>

            {/* ── Recent Orders ── */}
            <Section id="orders" title="Recent Orders" subtitle="Latest customer orders from your store" icon={FiShoppingBag} iconColor={"var(--adm-warning)"} iconBg={"var(--adm-warning-tint)"} delay={380}
                extra={<Link to="/admin/orders" style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-primary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: "var(--adm-primary-tint)", border: `1px solid #dbeafe`, borderRadius: 8 }} onClick={e => e.stopPropagation()}>View All →</Link>}
            >
                <div style={{ background: "var(--adm-surface)", border: `1px solid var(--adm-border)`, borderRadius: 14, overflow: "hidden" }}>

                    {/* Table header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.8fr 0.9fr 1.1fr 0.9fr", padding: "10px 20px", background: "var(--adm-bg)", borderBottom: `1px solid var(--adm-border)` }}>
                        {["ORDER ID", "CUSTOMER", "PRODUCT", "AMOUNT", "STATUS", "DATE"].map(h => (
                            <span key={h} style={{ fontSize: 10, fontWeight: 800, color: "var(--adm-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</span>
                        ))}
                    </div>

                    {loading ? (
                        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={34} />)}
                        </div>
                    ) : recentOrders.length === 0 ? (
                        <EmptyState icon={FiShoppingBag} title="No orders yet" description="Orders will appear here once customers start placing them." />
                    ) : recentOrders.map((order, i) => {
                        return (
                            <div key={order._id} onClick={() => navigate("/admin/orders")}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1.2fr 1fr 1.8fr 0.9fr 1.1fr 0.9fr",
                                    padding: "14px 20px",
                                    borderBottom: i < recentOrders.length - 1 ? `1px solid var(--adm-border-soft)` : "none",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    transition: "background .15s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "var(--adm-bg)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                            >
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-primary)" }}>#{order._id.slice(-6).toUpperCase()}</span>
                                <span style={{ fontSize: 13, color: "var(--adm-text-secondary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.customerName || "—"}</span>
                                <span style={{ fontSize: 13, color: "var(--adm-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
                                    {order.items?.[0]?.name || "—"}
                                    {order.items?.length > 1 && <span style={{ color: "var(--adm-muted)", fontSize: 11 }}> +{order.items.length - 1}</span>}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--adm-text-primary)" }}>₹{fmt(order.totalAmount)}</span>
                                <span>
                                    <StatusBadge status={order.orderStatus} />
                                </span>
                                <span style={{ fontSize: 12, color: "var(--adm-muted)" }}>
                                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </Section>

            {/* ── Quick Actions ── */}
            <Section id="quick-actions" title="Quick Actions" subtitle="Jump to key sections" icon={FiGrid} iconColor={"#8b5cf6"} iconBg={"#f5f3ff"} delay={300}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, padding: "0 16px 16px" }}>
                    {[
                        { to: "map", icon: "🗺️", label: "Live Map", desc: "Users, orders & riders", bg: "linear-gradient(135deg, #2563eb, #3b82f6)" },
                        { to: "local-delivery", icon: "🚴", label: "Local Delivery", desc: "Dispatch & track", bg: "linear-gradient(135deg, #f97316, #fb923c)" },
                        { to: "orders", icon: "📦", label: "All Orders", desc: "Manage & process", bg: "linear-gradient(135deg, #10b981, #34d399)" },
                        { to: "settlements", icon: "💰", label: "Settlements", desc: "Vendor payouts", bg: "linear-gradient(135deg, #8b5cf6, #a78bfa)" },
                    ].map((a) => (
                        <Link key={a.to} to={a.to} style={{
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 12,
                            padding: "14px 16px", borderRadius: 12, background: "var(--adm-surface)",
                            border: `1px solid var(--adm-border)`, transition: "all 0.15s",
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--adm-primary)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.1)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--adm-border)"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                            <div style={{
                                width: 40, height: 40, borderRadius: 10, background: a.bg,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 18, flexShrink: 0,
                            }}>{a.icon}</div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{a.label}</div>
                                <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>{a.desc}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </Section>
        </div>
    );

};

export default AdminDashboard;