/**
 * AdminSearchAnalytics.jsx — what users search for.
 * Wires GET /products/admin/search-analytics (new). The zero-result
 * table is the merchandising signal: demand the catalog doesn't serve.
 */
import { useEffect, useState } from "react";
import adminApi from "../api/adminApi";
import { FiSearch, FiTrendingUp, FiAlertCircle } from "react-icons/fi";
import { Card, ErrorState, Select } from "../components/ui";

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

const AdminSearchAnalytics = () => {
    const [days, setDays] = useState("30");
    // BUG FIX: ecommerce and Urbexon Hour searches used to be indistinguishable
    // in one shared bucket (and UH searches never even reached the backend —
    // see UrbexonHour.jsx / SearchLog.js) — this filter is only useful now
    // that the two are tracked separately.
    const [source, setSource] = useState("all");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setLoading(true);
        adminApi.get("/products/admin/search-analytics", { params: { days, source } })
            .then(r => { setData(r.data); setError(""); })
            .catch(() => setError("Failed to load search analytics"))
            .finally(() => setLoading(false));
    }, [days, source]);

    const s = data?.summary || {};
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
    const SourceBadge = ({ v }) => (
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20, textTransform: "uppercase", letterSpacing: ".04em", background: v === "urbexon_hour" ? "var(--adm-warning-tint, #fef3c7)" : "var(--adm-primary-tint)", color: v === "urbexon_hour" ? "var(--adm-warning, #b45309)" : "var(--adm-primary)" }}>
            {v === "urbexon_hour" ? "UH" : "Eco"}
        </span>
    );

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <FiSearch color="var(--adm-primary)" /> Search Analytics
                    </h1>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>
                        What customers look for — and what they don't find
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <Select value={source} onChange={e => setSource(e.target.value)} style={{ width: 150 }}>
                        <option value="all">All storefronts</option>
                        <option value="ecommerce">Ecommerce</option>
                        <option value="urbexon_hour">Urbexon Hour</option>
                    </Select>
                    <Select value={days} onChange={e => setDays(e.target.value)} style={{ width: 140 }}>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </Select>
                </div>
            </div>

            {error && <div style={{ marginBottom: 14 }}><ErrorState message={error} /></div>}

            {/* Summary */}
            <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                {[
                    ["Total searches", s.totalSearches, "primary"],
                    ["Unique terms", s.uniqueTerms, "primary"],
                    ["Zero-result terms", s.zeroResultTerms, "danger"],
                ].map(([label, val, tone]) => (
                    <Card key={label} style={{ flex: 1, minWidth: 150 }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: tone === "danger" ? "var(--adm-danger)" : "var(--adm-text-primary)", lineHeight: 1 }}>
                            {loading ? "…" : (val ?? 0).toLocaleString()}
                        </p>
                        <p style={{ fontSize: 10.5, color: "var(--adm-muted)", marginTop: 5, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>{label}</p>
                    </Card>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
                {/* Top searches */}
                <Card padded={false} style={{ overflow: "hidden" }}>
                    <p style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", borderBottom: "1px solid var(--adm-border)", display: "flex", alignItems: "center", gap: 7 }}>
                        <FiTrendingUp color="var(--adm-success)" /> Top Searches
                    </p>
                    <Table
                        cols={source === "all" ? ["Term", "Store", "Searches", "Results", "Last"] : ["Term", "Searches", "Results", "Last"]}
                        empty={loading ? "Loading…" : "No searches logged yet"}
                        rows={(data?.topSearches || []).map(t => (
                            <tr key={`${t.term}-${t.source}`} style={{ borderTop: "1px solid var(--adm-border)" }}>
                                <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--adm-text-primary)" }}>{t.term}</td>
                                {source === "all" && <td style={{ padding: "8px 12px" }}><SourceBadge v={t.source} /></td>}
                                <td style={{ padding: "8px 12px" }}>{t.count}</td>
                                <td style={{ padding: "8px 12px", color: t.lastResultCount === 0 ? "var(--adm-danger)" : "var(--adm-text-secondary)" }}>{t.lastResultCount}</td>
                                <td style={{ padding: "8px 12px", color: "var(--adm-muted)", whiteSpace: "nowrap" }}>{fmtDate(t.lastSearchedAt)}</td>
                            </tr>
                        ))}
                    />
                </Card>

                {/* Zero-result searches */}
                <Card padded={false} style={{ overflow: "hidden", borderTop: "3px solid var(--adm-danger)" }}>
                    <p style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", borderBottom: "1px solid var(--adm-border)", display: "flex", alignItems: "center", gap: 7 }}>
                        <FiAlertCircle color="var(--adm-danger)" /> Zero-Result Searches
                        <span style={{ fontSize: 10, color: "var(--adm-muted)", fontWeight: 500 }}>— demand you're not serving</span>
                    </p>
                    <Table
                        cols={source === "all" ? ["Term", "Store", "Times searched", "Last"] : ["Term", "Times searched", "Last"]}
                        empty={loading ? "Loading…" : "Great — every search found something"}
                        rows={(data?.zeroResultSearches || []).map(t => (
                            <tr key={`${t.term}-${t.source}`} style={{ borderTop: "1px solid var(--adm-border)" }}>
                                <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--adm-text-primary)" }}>{t.term}</td>
                                {source === "all" && <td style={{ padding: "8px 12px" }}><SourceBadge v={t.source} /></td>}
                                <td style={{ padding: "8px 12px", color: "var(--adm-danger)", fontWeight: 700 }}>{t.count}</td>
                                <td style={{ padding: "8px 12px", color: "var(--adm-muted)", whiteSpace: "nowrap" }}>{fmtDate(t.lastSearchedAt)}</td>
                            </tr>
                        ))}
                    />
                </Card>
            </div>
        </div>
    );
};

export default AdminSearchAnalytics;
