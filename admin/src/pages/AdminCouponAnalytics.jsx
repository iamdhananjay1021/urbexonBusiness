/**
 * AdminCouponAnalytics.jsx — Coupon Engine dashboard.
 * Wires GET /coupons/admin/analytics — everything here reads from the
 * CouponUsage ledger (services/couponEngine.js writes it on every
 * markCouponUsage call), no new tracking was needed to build this.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import adminApi from "../api/adminApi";
import { FiBarChart2, FiTrendingUp, FiUsers, FiTag, FiArrowLeft } from "react-icons/fi";
import { Card, ErrorState, Select } from "../components/ui";

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <p style={{ fontWeight: 700, color: "var(--adm-text-primary)", margin: "0 0 4px" }}>{fmtDate(label)}</p>
            <p style={{ margin: 0, color: "var(--adm-muted)" }}>{payload[0].payload.redemptions} redemptions</p>
            <p style={{ margin: 0, color: "var(--adm-success)", fontWeight: 600 }}>{fmtMoney(payload[0].payload.discount)} given</p>
        </div>
    );
};

const Table = ({ rows, cols, empty }) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
            <tr style={{ background: "var(--adm-surface-alt)", textAlign: "left" }}>
                {cols.map(c => (
                    <th key={c} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{c}</th>
                ))}
            </tr>
        </thead>
        <tbody>
            {rows.length === 0 ? (
                <tr><td colSpan={cols.length} style={{ padding: 20, textAlign: "center", color: "var(--adm-muted)" }}>{empty}</td></tr>
            ) : rows}
        </tbody>
    </table>
);

const AdminCouponAnalytics = () => {
    const navigate = useNavigate();
    const [days, setDays] = useState("30");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setLoading(true);
        adminApi.get("/coupons/admin/analytics", { params: { days } })
            .then(r => { setData(r.data); setError(""); })
            .catch(() => setError("Failed to load coupon analytics"))
            .finally(() => setLoading(false));
    }, [days]);

    const s = data?.summary || {};

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: 980, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <button onClick={() => navigate("/admin/coupons")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--adm-muted)", padding: 0, marginBottom: 6, fontFamily: "inherit" }}>
                        <FiArrowLeft size={12} /> Back to Coupons
                    </button>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <FiBarChart2 color="var(--adm-primary)" /> Coupon Analytics
                    </h1>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>
                        Redemptions, discount given, top coupons and customers
                    </p>
                </div>
                <Select value={days} onChange={e => setDays(e.target.value)} style={{ width: 140 }}>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                </Select>
            </div>

            {error && <div style={{ marginBottom: 14 }}><ErrorState message={error} /></div>}

            {/* Summary */}
            <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                {[
                    ["Redemptions", s.totalRedemptions, "primary"],
                    ["Discount Given", s.totalDiscountGiven, "success", true],
                    ["Avg Discount / Redemption", s.avgDiscount, "primary", true],
                    ["Unique Coupons Used", s.uniqueCouponsUsed, "primary"],
                    ["Coupons Created (all time)", s.totalCouponsCreated, "neutral"],
                ].map(([label, val, tone, money]) => (
                    <Card key={label} style={{ flex: 1, minWidth: 140 }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: tone === "success" ? "var(--adm-success)" : "var(--adm-text-primary)", lineHeight: 1 }}>
                            {loading ? "…" : money ? fmtMoney(val) : (val ?? 0).toLocaleString("en-IN")}
                        </p>
                        <p style={{ fontSize: 10.5, color: "var(--adm-muted)", marginTop: 5, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>{label}</p>
                    </Card>
                ))}
            </div>

            {/* Trend chart */}
            <Card style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <FiTrendingUp size={13} color="var(--adm-success)" /> Redemptions over time
                </p>
                {loading ? (
                    <div style={{ height: 200 }} />
                ) : !data?.byDay?.length ? (
                    <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-muted)", fontSize: 13 }}>
                        No redemptions in this period yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={data.byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="couponGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--adm-primary)" stopOpacity={0.18} />
                                    <stop offset="95%" stopColor="var(--adm-primary)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--adm-border-soft)" />
                            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: "var(--adm-muted)" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "var(--adm-muted)" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey="redemptions" stroke="var(--adm-primary)" strokeWidth={2.5} fill="url(#couponGrad)" dot={false} activeDot={{ r: 5, fill: "var(--adm-primary)", strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
                {/* Top coupons */}
                <Card padded={false} style={{ overflow: "hidden" }}>
                    <p style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", borderBottom: "1px solid var(--adm-border)", display: "flex", alignItems: "center", gap: 7 }}>
                        <FiTag color="var(--adm-primary)" /> Top Coupons
                    </p>
                    <Table
                        cols={["Code", "Redemptions", "Discount Given"]}
                        empty={loading ? "Loading…" : "No redemptions yet"}
                        rows={(data?.topCoupons || []).map(c => (
                            <tr key={c.couponId} style={{ borderTop: "1px solid var(--adm-border)" }}>
                                <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--adm-text-primary)", letterSpacing: 0.5 }}>{c.code}</td>
                                <td style={{ padding: "8px 12px" }}>{c.redemptions}</td>
                                <td style={{ padding: "8px 12px", color: "var(--adm-success)", fontWeight: 600 }}>{fmtMoney(c.totalDiscount)}</td>
                            </tr>
                        ))}
                    />
                </Card>

                {/* Top customers */}
                <Card padded={false} style={{ overflow: "hidden" }}>
                    <p style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", borderBottom: "1px solid var(--adm-border)", display: "flex", alignItems: "center", gap: 7 }}>
                        <FiUsers color="var(--adm-primary)" /> Top Customers
                    </p>
                    <Table
                        cols={["Customer", "Redemptions", "Discount Received"]}
                        empty={loading ? "Loading…" : "No redemptions yet"}
                        rows={(data?.topCustomers || []).map(c => (
                            <tr key={c.userId} style={{ borderTop: "1px solid var(--adm-border)" }}>
                                <td style={{ padding: "8px 12px" }}>
                                    <div style={{ fontWeight: 600, color: "var(--adm-text-primary)" }}>{c.name}</div>
                                    {c.email && <div style={{ fontSize: 10.5, color: "var(--adm-muted)" }}>{c.email}</div>}
                                </td>
                                <td style={{ padding: "8px 12px" }}>{c.redemptions}</td>
                                <td style={{ padding: "8px 12px", color: "var(--adm-success)", fontWeight: 600 }}>{fmtMoney(c.totalDiscount)}</td>
                            </tr>
                        ))}
                    />
                </Card>
            </div>

            {/* By module */}
            {!!data?.byModule?.length && (
                <Card style={{ marginTop: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", marginBottom: 10 }}>By Module</p>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        {data.byModule.map((m) => (
                            <div key={m.module}>
                                <p style={{ fontSize: 11, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 700 }}>
                                    {m.module === "VENDOR_SUBSCRIPTION" ? "Vendor Subscriptions" : "Orders"}
                                </p>
                                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-text-primary)", marginTop: 2 }}>
                                    {m.redemptions} redemptions · {fmtMoney(m.totalDiscount)}
                                </p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default AdminCouponAnalytics;
