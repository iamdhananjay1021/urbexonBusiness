/**
 * AdminDeals.jsx — Flash Deals Manager (Urbexon Hour).
 * Wires the 5 already-built backend endpoints that had no UI:
 *   GET  /products/admin/deals/metrics             — active deals + KPIs
 *   GET  /products/admin/deals/available-products  — dealable UH products
 *   POST /products/admin/deals/create              — create/update a deal
 *   DELETE /products/admin/deals/:productId        — remove a deal
 *   POST /products/admin/deals/refresh             — force cache refresh
 */
import { useCallback, useEffect, useState } from "react";
import adminApi from "../api/adminApi";
import { FiZap, FiTrash2, FiRefreshCw, FiSearch, FiPlus, FiEye, FiShoppingBag } from "react-icons/fi";
import { Button, Badge, Card, ErrorState, FormField, Input, Select } from "../components/ui";

const Stat = ({ icon: Icon, label, value, tone = "primary" }) => (
    <Card style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 160 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `var(--adm-${tone}-tint)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={16} color={`var(--adm-${tone})`} />
        </div>
        <div>
            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--adm-text-primary)", lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: 10.5, color: "var(--adm-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 }}>{label}</p>
        </div>
    </Card>
);

const AdminDeals = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");           // productId being removed / "refresh"
    const [toast, setToast] = useState("");

    /* Add-deal picker */
    const [q, setQ] = useState("");
    const [candidates, setCandidates] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState(null); // product object
    const [durationHours, setDurationHours] = useState("24");
    const [priority, setPriority] = useState("0");
    const [creating, setCreating] = useState(false);

    const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

    const loadMetrics = useCallback(() => {
        setLoading(true);
        adminApi.get("/products/admin/deals/metrics")
            .then(r => { setMetrics(r.data); setError(""); })
            .catch(() => setError("Failed to load deal metrics"))
            .finally(() => setLoading(false));
    }, []);
    useEffect(loadMetrics, [loadMetrics]);

    /* Debounced candidate search */
    useEffect(() => {
        const t = setTimeout(() => {
            setSearching(true);
            adminApi.get("/products/admin/deals/available-products", { params: q.trim() ? { search: q.trim() } : {} })
                .then(r => setCandidates(r.data?.products || []))
                .catch(() => setCandidates([]))
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    const createDeal = async () => {
        if (!selected) return;
        try {
            setCreating(true);
            await adminApi.post("/products/admin/deals/create", {
                productId: selected._id,
                durationHours: Number(durationHours) || 24,
                priority: Number(priority) || 0,
            });
            flash(`Deal live: ${selected.name}`);
            setSelected(null); setQ("");
            loadMetrics();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create deal");
        } finally { setCreating(false); }
    };

    const removeDeal = async (deal) => {
        if (!window.confirm(`End the deal on "${deal.name}"?`)) return;
        try {
            setBusy(deal._id);
            await adminApi.delete(`/products/admin/deals/${deal._id}`);
            flash("Deal removed");
            loadMetrics();
        } catch { setError("Failed to remove deal"); }
        finally { setBusy(""); }
    };

    const refreshDeals = async () => {
        try {
            setBusy("refresh");
            await adminApi.post("/products/admin/deals/refresh");
            flash("Flash deals cache refreshed");
            loadMetrics();
        } catch { setError("Refresh failed"); }
        finally { setBusy(""); }
    };

    const deals = metrics?.deals || [];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: 960, margin: "0 auto" }}>
            {toast && (
                <div style={{ position: "fixed", top: 18, right: 18, zIndex: 100, background: "var(--adm-success)", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, boxShadow: "var(--adm-shadow-md)" }}>
                    ✓ {toast}
                </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <FiZap color="var(--adm-warning)" /> Flash Deals
                    </h1>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>
                        Urbexon Hour flash sales — timers, priority & performance
                    </p>
                </div>
                <Button variant="secondary" icon={FiRefreshCw} loading={busy === "refresh"} onClick={refreshDeals}>
                    Refresh Cache
                </Button>
            </div>

            {error && <div style={{ marginBottom: 14 }}><ErrorState message={error} /></div>}

            {/* KPI row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                <Stat icon={FiZap} label="Active deals" value={loading ? "…" : (metrics?.totalActiveDeals ?? 0)} tone="warning" />
                <Stat icon={FiEye} label="Impressions" value={loading ? "…" : (metrics?.totalImpressions ?? 0).toLocaleString()} tone="primary" />
                <Stat icon={FiShoppingBag} label="Conversions" value={loading ? "…" : (metrics?.totalConversions ?? 0).toLocaleString()} tone="success" />
            </div>

            {/* ── Add a deal ── */}
            <Card style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)", marginBottom: 12 }}>
                    <FiPlus style={{ verticalAlign: "-2px" }} /> Put a product on flash sale
                </p>
                {!selected ? (
                    <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--adm-border)", borderRadius: 10, padding: "0 12px", background: "var(--adm-surface-alt)" }}>
                            <FiSearch size={13} color="var(--adm-muted)" />
                            <input
                                value={q} onChange={e => setQ(e.target.value)}
                                placeholder="Search in-stock Urbexon Hour products…"
                                style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 0", fontSize: 13, color: "var(--adm-text-primary)", fontFamily: "inherit" }}
                            />
                            {searching && <span style={{ fontSize: 11, color: "var(--adm-muted)" }}>…</span>}
                        </div>
                        <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                            {candidates.map(p => {
                                const disc = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
                                return (
                                    <button key={p._id} type="button" onClick={() => setSelected(p)}
                                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--adm-border)", borderRadius: 8, background: "var(--adm-surface)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--adm-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                                            <p style={{ fontSize: 10.5, color: "var(--adm-muted)" }}>{p.category} · stock {p.stock}</p>
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-primary)" }}>₹{p.price}</span>
                                        {disc > 0 && <Badge tone="success">{disc}% off</Badge>}
                                        {p.isDeal && <Badge tone="warning">already live</Badge>}
                                    </button>
                                );
                            })}
                            {!searching && candidates.length === 0 && (
                                <p style={{ fontSize: 12, color: "var(--adm-muted)", padding: 10, textAlign: "center" }}>No dealable products found</p>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div style={{ flex: 2, minWidth: 200 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 5 }}>Product</p>
                            <div style={{ padding: "9px 12px", border: "1px solid var(--adm-primary)", background: "var(--adm-primary-tint)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</span>
                                <button type="button" onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-muted)", fontSize: 13 }}>✕</button>
                            </div>
                        </div>
                        <FormField label="Duration">
                            <Select value={durationHours} onChange={e => setDurationHours(e.target.value)}>
                                {["3", "6", "12", "24", "48", "72"].map(h => <option key={h} value={h}>{h} hours</option>)}
                            </Select>
                        </FormField>
                        <FormField label="Priority (0–10)">
                            <Input type="number" min="0" max="10" value={priority} onChange={e => setPriority(e.target.value)} style={{ width: 90 }} />
                        </FormField>
                        <Button variant="primary" icon={FiZap} loading={creating} onClick={createDeal}>Go Live</Button>
                    </div>
                )}
            </Card>

            {/* ── Active deals table ── */}
            <Card padded={false} style={{ overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--adm-border)", display: "flex", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>Active Deals</p>
                    <span style={{ fontSize: 11, color: "var(--adm-muted)" }}>{deals.length} live</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: "var(--adm-surface-alt)", textAlign: "left" }}>
                                {["Product", "Vendor", "Price", "Disc%", "Prio", "Stock", "Sales", "Views", "CR", "Ends in", ""].map(h => (
                                    <th key={h} style={{ padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={11} style={{ padding: 24, textAlign: "center", color: "var(--adm-muted)" }}>Loading…</td></tr>
                            ) : deals.length === 0 ? (
                                <tr><td colSpan={11} style={{ padding: 24, textAlign: "center", color: "var(--adm-muted)" }}>
                                    No live deals — put a product on flash sale above ⚡
                                </td></tr>
                            ) : deals.map(d => (
                                <tr key={d._id} style={{ borderTop: "1px solid var(--adm-border)" }}>
                                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--adm-text-primary)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</td>
                                    <td style={{ padding: "10px 12px", color: "var(--adm-text-secondary)", whiteSpace: "nowrap" }}>{d.vendor}</td>
                                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>₹{d.price}{d.mrp ? <span style={{ color: "var(--adm-muted)", textDecoration: "line-through", marginLeft: 5, fontSize: 11 }}>₹{d.mrp}</span> : null}</td>
                                    <td style={{ padding: "10px 12px" }}><Badge tone="success">{d.discount}%</Badge></td>
                                    <td style={{ padding: "10px 12px" }}>{d.priority}</td>
                                    <td style={{ padding: "10px 12px", color: d.stock <= 5 ? "var(--adm-danger)" : "var(--adm-text-secondary)" }}>{d.stock}</td>
                                    <td style={{ padding: "10px 12px" }}>{d.sales}</td>
                                    <td style={{ padding: "10px 12px" }}>{d.views}</td>
                                    <td style={{ padding: "10px 12px" }}>{d.conversionRate}</td>
                                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--adm-warning)", fontWeight: 700 }}>{d.timeRemaining}</td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <button onClick={() => removeDeal(d)} disabled={busy === d._id} title="End deal"
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-danger)", opacity: busy === d._id ? 0.4 : 1 }}>
                                            <FiTrash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default AdminDeals;
