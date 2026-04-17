/**
 * AdminMapDashboard.jsx — Live Map Dashboard
 * ✅ White/Creamy light theme
 * ✅ Full dynamic — all data from API
 * ✅ 2-col layout: Map + Region panel
 * ✅ Urbexon + Urbexon Hour mode breakdown
 * ✅ 30s auto-refresh
 */
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api/adminApi";
import {
    FiMapPin, FiUsers, FiShoppingBag, FiTruck,
    FiRefreshCw, FiEye, FiZap, FiPackage,
    FiDollarSign, FiGlobe, FiBarChart2,
} from "react-icons/fi";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

/* ── Cluster bubble ── */
const clusterIcon = (count) => {
    const size = count >= 100 ? 48 : count >= 10 ? 40 : 34;
    return L.divIcon({
        className: "",
        html: `<div style="
            width:${size}px;height:${size}px;
            background:#2563eb;border:3px solid rgba(255,255,255,.95);border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-weight:800;font-size:${count >= 100 ? 14 : 13}px;
            font-family:'DM Sans',system-ui,sans-serif;
            box-shadow:0 4px 14px rgba(37,99,235,.35);cursor:pointer;
        ">${count}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -20],
    });
};

const riderIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:32px;height:32px">
        <div style="position:absolute;inset:0;background:rgba(239,68,68,.2);border-radius:50%;animation:mp-pulse 2s infinite"></div>
        <div style="position:absolute;top:6px;left:6px;width:20px;height:20px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:11px">🏍️</div>
    </div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16],
});

const destIcon = L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:18px;height:18px;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:10px">📍</div>
    </div>`,
    iconSize: [18, 18], iconAnchor: [9, 18], popupAnchor: [0, -18],
});

const FitBounds = ({ positions }) => {
    const map = useMap();
    const prev = useRef("");
    useEffect(() => {
        const v = positions.filter(Boolean);
        if (!v.length) return;
        const key = v.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("|");
        if (key === prev.current) return;
        prev.current = key;
        if (v.length === 1) map.setView(v[0], 10, { animate: true });
        else map.fitBounds(L.latLngBounds(v), { padding: [40, 40], maxZoom: 12, animate: true });
    }, [positions, map]);
    return null;
};

/* ── Light Theme Palette ── */
const D = {
    bg: "#f8f7f4",       /* creamy page bg */
    card: "#ffffff",       /* white cards */
    cardAlt: "#faf9f7",       /* footer / alt */
    border: "#e5e7eb",
    borderLight: "#f0ede8",
    text: "#0f172a",
    sub: "#64748b",
    muted: "#94a3b8",

    blue: "#2563eb",
    blueBg: "rgba(37,99,235,.08)",
    blueBorder: "rgba(37,99,235,.2)",

    green: "#16a34a",
    greenBg: "rgba(22,163,74,.08)",
    greenBorder: "rgba(22,163,74,.2)",

    amber: "#d97706",
    amberBg: "rgba(217,119,6,.08)",
    amberBorder: "rgba(217,119,6,.2)",

    red: "#dc2626",
    redBg: "rgba(220,38,38,.08)",
    redBorder: "rgba(220,38,38,.2)",

    violet: "#7c3aed",
    violetBg: "rgba(124,58,237,.08)",
    violetBorder: "rgba(124,58,237,.2)",

    cyan: "#0891b2",
};

const STATUS_COLORS = {
    PLACED: "#d97706", CONFIRMED: "#2563eb", PACKED: "#7c3aed",
    SHIPPED: "#0891b2", OUT_FOR_DELIVERY: "#ea580c",
    DELIVERED: "#16a34a", CANCELLED: "#dc2626",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box}
@keyframes mp-pulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.8);opacity:0}}
@keyframes mp-spin{to{transform:rotate(360deg)}}
@keyframes mp-fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.mp-fade{animation:mp-fadeIn .3s ease both}
.mp-bar{transition:width .6s cubic-bezier(.22,1,.36,1)}
.mp-card{transition:transform .15s,box-shadow .15s}
.mp-card:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.09)}
.mp-scroll::-webkit-scrollbar{width:5px}
.mp-scroll::-webkit-scrollbar-track{background:transparent}
.mp-scroll::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}
.mp-pill{transition:all .15s;cursor:pointer}.mp-pill:hover{opacity:.85}
.leaflet-container{background:#e8e4dd!important}
.leaflet-control-zoom a{background:#fff!important;color:#374151!important;border-color:#e5e7eb!important}
.leaflet-control-attribution{background:rgba(248,247,244,.9)!important;color:#94a3b8!important;font-size:9px!important}
.leaflet-popup-content-wrapper{border-radius:10px!important;box-shadow:0 4px 20px rgba(0,0,0,.12)!important}
@media(max-width:1024px){.mp-layout{flex-direction:column!important}.mp-map-col{min-height:380px!important}.mp-region-col{width:100%!important;max-height:400px!important}}
@media(max-width:640px){.mp-stats{grid-template-columns:1fr 1fr!important}.mp-hdr{flex-direction:column!important;align-items:flex-start!important;gap:10px!important}.mp-mode-cards{grid-template-columns:1fr!important}}
`;

/* ── Stat Card ── */
const Stat = ({ icon: Icon, label, value, color, bg, border }) => (
    <div className="mp-card" style={{
        background: D.card, borderRadius: 14, padding: "14px 16px",
        border: `1px solid ${border || D.border}`,
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,.04)",
    }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={18} color={color} />
        </div>
        <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: D.text, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: D.sub, fontWeight: 500, marginTop: 3 }}>{label}</div>
        </div>
    </div>
);

/* ═════════════ MAIN ═════════════ */
const AdminMapDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [view, setView] = useState("all");
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const { data: res } = await api.get(`/admin/map-data?days=${days}`);
            setData(res);
        } catch (err) {
            console.error("[MapDashboard]", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

    const refresh = () => { setRefreshing(true); load(); };

    const allPositions = useMemo(() => {
        if (!data) return [];
        const pts = [];
        if (view === "all" || view === "orders")
            (data.regionClusters || []).forEach(c => { if (c.lat && c.lng) pts.push([c.lat, c.lng]); });
        if (view === "users")
            data.userLocations?.forEach(u => { if (u.lat && u.lng) pts.push([u.lat, u.lng]); });
        if (view === "all" || view === "deliveries")
            data.activeDeliveries?.forEach(d => {
                if (d.riderLat && d.riderLng) pts.push([d.riderLat, d.riderLng]);
                if (d.customerLat && d.customerLng) pts.push([d.customerLat, d.customerLng]);
            });
        return pts;
    }, [data, view]);

    const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", background: D.bg, gap: 12, fontFamily: "'DM Sans',sans-serif", color: D.sub }}>
            <style>{CSS}</style>
            <div style={{ width: 32, height: 32, border: `3px solid ${D.border}`, borderTopColor: D.blue, borderRadius: "50%", animation: "mp-spin .8s linear infinite" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading map data…</span>
        </div>
    );

    const mb = data?.modeBreakdown || {};

    return (
        <div style={{ fontFamily: "'DM Sans',-apple-system,sans-serif", color: D.text, background: D.bg, minHeight: "100vh", padding: "20px 20px 40px" }}>
            <style>{CSS}</style>

            {/* ═══ HEADER ═══ */}
            <div className="mp-hdr" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(18px,3vw,22px)", fontWeight: 900, margin: 0, color: D.text, display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, background: D.blueBg, border: `1px solid ${D.blueBorder}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            <FiGlobe size={16} color={D.blue} />
                        </span>
                        Live Map Dashboard
                    </h1>
                    <p style={{ fontSize: 12, color: D.muted, margin: "4px 0 0 43px", fontWeight: 500 }}>
                        User locations · order origins · active deliveries — India
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={days} onChange={e => { setDays(Number(e.target.value)); setLoading(true); }}
                        style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${D.border}`, fontSize: 12, fontWeight: 600, color: D.text, background: D.card, cursor: "pointer", outline: "none" }}>
                        {[7, 30, 60, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}
                    </select>
                    <button onClick={refresh} disabled={refreshing} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                        borderRadius: 9, border: `1px solid ${D.border}`, background: D.card,
                        fontSize: 12, fontWeight: 600, color: D.text, cursor: "pointer", outline: "none",
                        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                    }}>
                        <FiRefreshCw size={13} style={{ animation: refreshing ? "mp-spin .8s linear infinite" : "none", color: D.blue }} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ═══ STAT CARDS ═══ */}
            <div className="mp-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
                <Stat icon={FiUsers} label="Users with Location" value={data?.totalUsers || 0} color={D.blue} bg={D.blueBg} border={D.blueBorder} />
                <Stat icon={FiShoppingBag} label="Orders with GPS" value={data?.totalOrders || 0} color={D.green} bg={D.greenBg} border={D.greenBorder} />
                <Stat icon={FiTruck} label="Active Deliveries" value={data?.totalActiveDeliveries || 0} color={D.red} bg={D.redBg} border={D.redBorder} />
            </div>

            {/* ═══ MODE BREAKDOWN ═══ */}
            <div className="mp-mode-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {/* Ecommerce */}
                <div className="mp-card" style={{ background: D.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${D.blueBorder}`, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: D.blueBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FiPackage size={16} color={D.blue} />
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: D.muted, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".4px" }}>Urbexon E-Commerce</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                            <span style={{ fontSize: 20, fontWeight: 900, color: D.text }}>{mb.ecom || 0}</span>
                            <span style={{ fontSize: 13, color: D.green, fontWeight: 700 }}>{fmt(mb.ecomRevenue)}</span>
                        </div>
                    </div>
                </div>
                {/* Urbexon Hour */}
                <div className="mp-card" style={{ background: D.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${D.violetBorder}`, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: D.violetBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FiZap size={16} color={D.violet} />
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: D.muted, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".4px" }}>Urbexon Hour (Express)</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                            <span style={{ fontSize: 20, fontWeight: 900, color: D.text }}>{mb.uh || 0}</span>
                            <span style={{ fontSize: 13, color: D.violet, fontWeight: 700 }}>{fmt(mb.uhRevenue)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ VIEW PILLS ═══ */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {[
                    { key: "all", label: "All", icon: FiEye, color: D.blue },
                    { key: "users", label: "Users", icon: FiUsers, color: D.blue },
                    { key: "orders", label: "Orders", icon: FiShoppingBag, color: D.amber },
                    { key: "deliveries", label: "Live Deliveries", icon: FiTruck, color: D.red },
                ].map(v => (
                    <button key={v.key} className="mp-pill" onClick={() => setView(v.key)} style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                        borderRadius: 8, border: `1.5px solid ${view === v.key ? v.color : D.border}`,
                        background: view === v.key ? `${v.color}12` : D.card,
                        color: view === v.key ? v.color : D.sub,
                        fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none",
                        boxShadow: view === v.key ? `0 2px 8px ${v.color}22` : "none",
                    }}>
                        <v.icon size={13} /> {v.label}
                    </button>
                ))}
            </div>

            {/* ═══ MAP + REGION PANEL ═══ */}
            <div className="mp-layout" style={{ display: "flex", gap: 14, alignItems: "stretch" }}>

                {/* ── Map ── */}
                <div className="mp-map-col" style={{
                    flex: "1 1 0", minWidth: 0, borderRadius: 16, overflow: "hidden",
                    border: `1px solid ${D.border}`, position: "relative",
                    boxShadow: "0 2px 12px rgba(0,0,0,.06)",
                }}>
                    <MapContainer
                        center={[22.5937, 78.9629]} zoom={5}
                        style={{ height: "calc(100vh - 420px)", minHeight: 440, width: "100%" }}
                        scrollWheelZoom
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        />
                        {allPositions.length > 0 && <FitBounds positions={allPositions} />}

                        {/* Order clusters */}
                        {(view === "all" || view === "orders") && (data?.regionClusters || []).map((c, i) =>
                            c.count > 0 ? (
                                <Marker key={`rc-${i}`} position={[c.lat, c.lng]} icon={clusterIcon(c.count)}>
                                    <Popup>
                                        <div style={{ fontSize: 12, lineHeight: 1.8, minWidth: 160, fontFamily: "'DM Sans',sans-serif" }}>
                                            <strong style={{ fontSize: 14, color: D.text }}>{c.count} Orders</strong><br />
                                            <span style={{ color: D.green, fontWeight: 700 }}>💰 {`₹${(c.revenue || 0).toLocaleString("en-IN")}`}</span><br />
                                            {c.ecom > 0 && <span style={{ color: D.blue }}>📦 Ecommerce: {c.ecom}<br /></span>}
                                            {c.uh > 0 && <span style={{ color: D.violet }}>⚡ Urbexon Hour: {c.uh}<br /></span>}
                                        </div>
                                    </Popup>
                                </Marker>
                            ) : null
                        )}

                        {/* Order dots */}
                        {view === "orders" && data?.orderLocations?.map(o =>
                            o.lat && o.lng ? (
                                <CircleMarker key={`ol-${o.id}`} center={[o.lat, o.lng]} radius={5}
                                    pathOptions={{ fillColor: STATUS_COLORS[o.status] || D.green, fillOpacity: .85, color: "#fff", weight: 1.5 }}>
                                    <Popup>
                                        <div style={{ fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif" }}>
                                            <strong style={{ color: D.text }}>📦 {o.customer}</strong><br />
                                            <span style={{ color: D.muted }}>{o.invoice}</span><br />
                                            <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, color: "#fff", background: STATUS_COLORS[o.status] || "#94a3b8" }}>
                                                {o.status?.replace(/_/g, " ")}
                                            </span>
                                            <span style={{ marginLeft: 6, fontWeight: 700, color: D.text }}>{fmt(o.amount)}</span><br />
                                            <span style={{ color: D.muted, fontSize: 10 }}>
                                                {o.mode === "URBEXON_HOUR" ? "⚡ Urbexon Hour" : "📦 Ecommerce"} · {new Date(o.date).toLocaleDateString("en-IN")}
                                            </span>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ) : null
                        )}

                        {/* Users */}
                        {view === "users" && data?.userLocations?.map(u =>
                            u.lat && u.lng ? (
                                <CircleMarker key={`u-${u.id}`} center={[u.lat, u.lng]} radius={5}
                                    pathOptions={{ fillColor: D.blue, fillOpacity: .8, color: "#fff", weight: 1.5 }}>
                                    <Popup>
                                        <div style={{ fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif" }}>
                                            <strong style={{ color: D.text }}>👤 {u.name}</strong><br />
                                            {u.email && <span style={{ color: D.muted }}>{u.email}<br /></span>}
                                            {u.city && <span style={{ color: D.sub }}>📍 {u.city}{u.state ? `, ${u.state}` : ""}</span>}
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ) : null
                        )}

                        {/* Active deliveries */}
                        {(view === "all" || view === "deliveries") && data?.activeDeliveries?.map(d => (
                            <span key={`d-${d.id}`}>
                                {d.riderLat && d.riderLng && (
                                    <Marker position={[d.riderLat, d.riderLng]} icon={riderIcon}>
                                        <Popup>
                                            <div style={{ fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif" }}>
                                                <strong style={{ color: D.text }}>🏍️ {d.riderName || "Rider"}</strong><br />
                                                {d.riderPhone && <span style={{ color: D.muted }}>📞 {d.riderPhone}<br /></span>}
                                                <span style={{ color: D.sub }}>Delivering: {d.invoice}</span><br />
                                                <strong style={{ color: D.green }}>{fmt(d.amount)}</strong>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}
                                {d.customerLat && d.customerLng && (
                                    <Marker position={[d.customerLat, d.customerLng]} icon={destIcon}>
                                        <Popup>
                                            <div style={{ fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif" }}>
                                                <strong style={{ color: D.text }}>📍 {d.customer}</strong><br />
                                                <span style={{ color: D.muted }}>{d.address?.slice(0, 80)}</span>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}
                            </span>
                        ))}
                    </MapContainer>

                    {/* Legend */}
                    <div style={{
                        position: "absolute", bottom: 30, left: 10, zIndex: 999,
                        background: "rgba(255,255,255,.92)", backdropFilter: "blur(8px)",
                        borderRadius: 10, padding: "8px 12px",
                        border: `1px solid ${D.border}`,
                        display: "flex", gap: 12, flexWrap: "wrap",
                        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                    }}>
                        {[
                            { color: D.blue, label: "Orders" },
                            { color: "#3b82f6", label: "Users" },
                            { color: D.red, label: "Riders" },
                            { color: D.amber, label: "Destination" },
                        ].map(l => (
                            <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: D.sub, fontWeight: 600 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />{l.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Region Panel ── */}
                <div className="mp-region-col" style={{
                    width: 360, flexShrink: 0, background: D.card, borderRadius: 16,
                    border: `1px solid ${D.border}`, display: "flex", flexDirection: "column",
                    overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)",
                }}>
                    <div style={{ padding: "14px 18px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: D.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FiBarChart2 size={15} color={D.green} />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: D.text }}>Orders by Region — India</div>
                            <div style={{ fontSize: 10, color: D.muted, marginTop: 1 }}>
                                {data?.totalOrders || 0} orders · {data?.stateWise?.length || 0} states
                            </div>
                        </div>
                    </div>

                    <div className="mp-scroll" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                        {!(data?.stateWise?.length) ? (
                            <div style={{ padding: 32, textAlign: "center", color: D.muted, fontSize: 13 }}>
                                <FiMapPin size={24} style={{ marginBottom: 8, opacity: .4 }} /><br />
                                No regional data yet
                            </div>
                        ) : (data.stateWise || []).map((s, i) => {
                            const maxVal = (data.stateWise[0]?.orders || 1) + (data.stateWise[0]?.users || 0);
                            const val = (s.orders || 0) + (s.users || 0);
                            const barPct = Math.max(3, (val / maxVal) * 100);
                            return (
                                <div key={s.state} className="mp-fade" style={{
                                    padding: "11px 18px", borderBottom: `1px solid ${D.borderLight}`,
                                    display: "flex", alignItems: "center", gap: 12,
                                    animationDelay: `${i * 25}ms`,
                                }}>
                                    <div style={{
                                        width: 27, height: 27, borderRadius: 7, flexShrink: 0,
                                        background: i === 0 ? D.greenBg : i === 1 ? D.blueBg : i === 2 ? D.amberBg : "#f1f5f9",
                                        border: `1px solid ${i === 0 ? D.greenBorder : i === 1 ? D.blueBorder : i === 2 ? D.amberBorder : D.border}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 11, fontWeight: 800,
                                        color: i === 0 ? D.green : i === 1 ? D.blue : i === 2 ? D.amber : D.muted,
                                    }}>{i + 1}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.state}</span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: D.green, flexShrink: 0, marginLeft: 8 }}>{fmt(s.revenue)}</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 10, fontSize: 10, color: D.muted, marginBottom: 5 }}>
                                            {s.users > 0 && <span>👤 {s.users}</span>}
                                            {s.orders > 0 && <span>📦 {s.orders}</span>}
                                        </div>
                                        <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2 }}>
                                            <div className="mp-bar" style={{
                                                height: 4, borderRadius: 2, width: `${barPct}%`,
                                                background: `linear-gradient(90deg,${D.blue},${D.cyan})`,
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{
                        padding: "10px 18px", borderTop: `1px solid ${D.border}`,
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: D.cardAlt,
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: D.muted, letterSpacing: ".5px" }}>TOTAL</span>
                        <div style={{ display: "flex", gap: 12, fontSize: 12, fontWeight: 700 }}>
                            <span style={{ color: D.blue }}>👤 {data?.totalUsers || 0}</span>
                            <span style={{ color: D.amber }}>📦 {data?.totalOrders || 0}</span>
                            <span style={{ color: D.green }}>
                                {fmt((mb.ecomRevenue || 0) + (mb.uhRevenue || 0))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ BOTTOM: Top Cities + Order Clusters ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginTop: 16 }}>

                {/* Top Cities */}
                {data?.topCities?.length > 0 && (
                    <div style={{ background: D.card, borderRadius: 14, border: `1px solid ${D.border}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: D.blueBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FiUsers size={14} color={D.blue} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: D.text }}>Top Cities (Users)</span>
                        </div>
                        <div className="mp-scroll" style={{ maxHeight: 360, overflowY: "auto" }}>
                            {data.topCities.map((c, i) => {
                                const w = Math.max(4, (c.count / (data.topCities[0]?.count || 1)) * 100);
                                return (
                                    <div key={c.city} className="mp-fade" style={{
                                        padding: "10px 18px", borderBottom: `1px solid ${D.borderLight}`,
                                        display: "flex", alignItems: "center", gap: 12,
                                        animationDelay: `${i * 25}ms`,
                                    }}>
                                        <div style={{
                                            width: 27, height: 27, borderRadius: 7, flexShrink: 0,
                                            background: i < 3 ? D.amberBg : "#f1f5f9",
                                            border: `1px solid ${i < 3 ? D.amberBorder : D.border}`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: i < 3 ? 12 : 11, fontWeight: 800,
                                            color: i < 3 ? D.amber : D.muted,
                                        }}>{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: D.text }}>{c.city}</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: D.blue }}>{c.count} users</span>
                                            </div>
                                            <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2 }}>
                                                <div className="mp-bar" style={{ height: 4, borderRadius: 2, width: `${w}%`, background: `linear-gradient(90deg,${D.blue},${D.violet})` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Order Clusters Revenue */}
                {(data?.regionClusters || []).length > 0 && (
                    <div style={{ background: D.card, borderRadius: 14, border: `1px solid ${D.border}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: D.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FiDollarSign size={14} color={D.green} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: D.text }}>Order Clusters (Revenue)</span>
                        </div>
                        <div className="mp-scroll" style={{ maxHeight: 360, overflowY: "auto" }}>
                            {data.regionClusters.slice(0, 15).map((c, i) => {
                                const w = Math.max(4, ((c.revenue || 0) / (data.regionClusters[0]?.revenue || 1)) * 100);
                                return (
                                    <div key={i} className="mp-fade" style={{
                                        padding: "10px 18px", borderBottom: `1px solid ${D.borderLight}`,
                                        display: "flex", alignItems: "center", gap: 12,
                                        animationDelay: `${i * 25}ms`,
                                    }}>
                                        <div style={{
                                            width: 27, height: 27, borderRadius: 7, flexShrink: 0,
                                            background: D.greenBg, border: `1px solid ${D.greenBorder}`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 11, fontWeight: 800, color: D.green,
                                        }}>{c.count}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <span style={{ fontSize: 12, color: D.sub }}>
                                                    {c.lat?.toFixed(1)}°N, {c.lng?.toFixed(1)}°E
                                                </span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: D.green }}>{fmt(c.revenue)}</span>
                                            </div>
                                            <div style={{ display: "flex", gap: 8, fontSize: 10, color: D.muted, marginBottom: 4 }}>
                                                {c.ecom > 0 && <span style={{ color: D.blue }}>📦 {c.ecom} Ecom</span>}
                                                {c.uh > 0 && <span style={{ color: D.violet }}>⚡ {c.uh} UH</span>}
                                            </div>
                                            <div style={{ height: 3, background: "#f1f5f9", borderRadius: 2 }}>
                                                <div className="mp-bar" style={{ height: 3, borderRadius: 2, width: `${w}%`, background: `linear-gradient(90deg,${D.green},${D.amber})` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminMapDashboard;