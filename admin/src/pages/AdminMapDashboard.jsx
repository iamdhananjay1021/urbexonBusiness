/**
 * AdminMapDashboard.jsx — Live Map Dashboard
 * ✅ Fully responsive — mobile safe, no overflow
 * ✅ Map properly contained, no z-index bleed
 * ✅ Sidebar-safe layout
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

/* ─── Icons ─────────────────────────────────────────────── */
const clusterIcon = (count) => {
    const size = count >= 100 ? 46 : count >= 10 ? 38 : 32;
    return L.divIcon({
        className: "",
        html: `<div style="
            width:${size}px;height:${size}px;
            background:#2563eb;border:3px solid rgba(255,255,255,.95);border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-weight:800;font-size:${count >= 100 ? 13 : 12}px;
            font-family:'DM Sans',system-ui,sans-serif;
            box-shadow:0 4px 14px rgba(37,99,235,.35);cursor:pointer;
        ">${count}</div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -20],
    });
};

const riderIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:30px;height:30px">
        <div style="position:absolute;inset:0;background:rgba(239,68,68,.18);border-radius:50%;animation:mp-pulse 2s infinite"></div>
        <div style="position:absolute;top:5px;left:5px;width:20px;height:20px;background:#ef4444;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:10px">🏍️</div>
    </div>`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15],
});

const destIcon = L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:9px">📍</div>`,
    iconSize: [16, 16], iconAnchor: [8, 16], popupAnchor: [0, -16],
});

/* ─── FitBounds helper ───────────────────────────────────── */
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

/* ─── Palette ────────────────────────────────────────────── */
const D = {
    bg: "#f8f7f4", card: "#ffffff", cardAlt: "#faf9f7",
    border: "#e5e7eb", borderLight: "#f0ede8",
    text: "#0f172a", sub: "#64748b", muted: "#94a3b8",
    blue: "#2563eb", blueBg: "rgba(37,99,235,.08)", blueBorder: "rgba(37,99,235,.2)",
    green: "#16a34a", greenBg: "rgba(22,163,74,.08)", greenBorder: "rgba(22,163,74,.2)",
    amber: "#d97706", amberBg: "rgba(217,119,6,.08)", amberBorder: "rgba(217,119,6,.2)",
    red: "#dc2626", redBg: "rgba(220,38,38,.08)", redBorder: "rgba(220,38,38,.2)",
    violet: "#7c3aed", violetBg: "rgba(124,58,237,.08)", violetBorder: "rgba(124,58,237,.2)",
    cyan: "#0891b2",
};

const STATUS_COLORS = {
    PLACED: "#d97706", CONFIRMED: "#2563eb", PACKED: "#7c3aed",
    SHIPPED: "#0891b2", OUT_FOR_DELIVERY: "#ea580c",
    DELIVERED: "#16a34a", CANCELLED: "#dc2626",
};

/* ─── Global CSS ─────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box}

@keyframes mp-pulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.8);opacity:0}}
@keyframes mp-spin{to{transform:rotate(360deg)}}
@keyframes mp-fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

.mp-fade{animation:mp-fadeIn .3s ease both}
.mp-bar{transition:width .6s cubic-bezier(.22,1,.36,1)}
.mp-card{transition:transform .15s,box-shadow .15s}
.mp-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.mp-pill{transition:all .15s;cursor:pointer;outline:none}
.mp-pill:hover{opacity:.85}

.mp-scroll::-webkit-scrollbar{width:4px}
.mp-scroll::-webkit-scrollbar-track{background:transparent}
.mp-scroll::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}

/* ── Leaflet overrides — CRITICAL for no overflow ── */
.leaflet-container{
    background:#e8e4dd !important;
    /* Ensure map never bleeds outside its container */
    position:relative !important;
    z-index:0 !important;
}
/* Prevent leaflet controls from bleeding */
.leaflet-top,.leaflet-bottom{z-index:1 !important}
.leaflet-pane{z-index:0 !important}
.leaflet-tile-pane{z-index:1 !important}
.leaflet-overlay-pane{z-index:2 !important}
.leaflet-marker-pane{z-index:3 !important}
.leaflet-popup-pane{z-index:4 !important}
.leaflet-control{z-index:5 !important}

.leaflet-control-zoom a{background:#fff!important;color:#374151!important;border-color:#e5e7eb!important}
.leaflet-control-attribution{background:rgba(248,247,244,.9)!important;color:#94a3b8!important;font-size:9px!important}
.leaflet-popup-content-wrapper{border-radius:10px!important;box-shadow:0 4px 20px rgba(0,0,0,.12)!important;font-family:'DM Sans',sans-serif!important}
.leaflet-popup-tip-container{display:none}

/* ── Map wrapper — clips overflow ── */
.mp-map-wrap{
    position:relative;
    border-radius:14px;
    overflow:hidden;       /* THIS is the key — clips the map */
    isolation:isolate;     /* new stacking context, prevents z-index bleed */
    border:1px solid #e5e7eb;
    box-shadow:0 2px 12px rgba(0,0,0,.06);
    flex:1 1 0;
    min-width:0;
}

/* ── Layout responsive ── */
.mp-2col{
    display:flex;
    gap:14px;
    align-items:stretch;
}
.mp-region-col{
    width:340px;
    flex-shrink:0;
}
@media(max-width:1024px){
    .mp-2col{flex-direction:column}
    .mp-region-col{width:100%;max-height:340px}
}

.mp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px}
.mp-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}

@media(max-width:640px){
    .mp-hdr{flex-direction:column!important;align-items:flex-start!important;gap:10px!important}
    .mp-mode-grid{grid-template-columns:1fr!important}
    .mp-stats{grid-template-columns:1fr 1fr!important}
    .mp-pills{flex-wrap:wrap}
    .mp-hdr-actions{flex-wrap:wrap;gap:6px!important}
}

.mp-bottom-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(300px,1fr));
    gap:14px;
    margin-top:16px;
}
`;

/* ─── Sub-components ─────────────────────────────────────── */
const Stat = ({ icon: Icon, label, value, color, bg, border }) => (
    <div className="mp-card" style={{
        background: D.card, borderRadius: 13, padding: "13px 15px",
        border: `1px solid ${border || D.border}`,
        display: "flex", alignItems: "center", gap: 11,
        boxShadow: "0 1px 4px rgba(0,0,0,.04)",
    }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={17} color={color} />
        </div>
        <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: D.text, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: D.sub, fontWeight: 500, marginTop: 3 }}>{label}</div>
        </div>
    </div>
);

const ModeCard = ({ icon: Icon, title, count, revenue, color, bg, border }) => (
    <div className="mp-card" style={{
        background: D.card, borderRadius: 12, padding: "13px 15px",
        border: `1px solid ${border}`,
        display: "flex", alignItems: "center", gap: 11,
        boxShadow: "0 1px 4px rgba(0,0,0,.04)",
    }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={15} color={color} />
        </div>
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: D.muted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: D.text }}>{count}</span>
                <span style={{ fontSize: 12, color: color, fontWeight: 700 }}>{revenue}</span>
            </div>
        </div>
    </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, color, bg }) => (
    <div style={{ padding: "13px 16px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={14} color={color} />
        </div>
        <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: D.text }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: D.muted, marginTop: 1 }}>{subtitle}</div>}
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════ */
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
    useEffect(() => {
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [load]);

    const refresh = () => { setRefreshing(true); load(); };

    const allPositions = useMemo(() => {
        if (!data) return [];
        const pts = [];
        if (view === "all" || view === "orders")
            (data.regionClusters || []).forEach(c => { if (c.lat && c.lng) pts.push([c.lat, c.lng]); });
        if (view === "users")
            (data.userLocations || []).forEach(u => { if (u.lat && u.lng) pts.push([u.lat, u.lng]); });
        if (view === "all" || view === "deliveries")
            (data.activeDeliveries || []).forEach(d => {
                if (d.riderLat && d.riderLng) pts.push([d.riderLat, d.riderLng]);
                if (d.customerLat && d.customerLng) pts.push([d.customerLat, d.customerLng]);
            });
        return pts;
    }, [data, view]);

    const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
    const mb = data?.modeBreakdown || {};

    /* ── Loading ── */
    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", background: D.bg, gap: 12, fontFamily: "'DM Sans',sans-serif", color: D.sub }}>
            <style>{CSS}</style>
            <div style={{ width: 30, height: 30, border: `3px solid ${D.border}`, borderTopColor: D.blue, borderRadius: "50%", animation: "mp-spin .8s linear infinite" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading map data…</span>
        </div>
    );

    return (
        <div style={{ fontFamily: "'DM Sans',-apple-system,sans-serif", color: D.text, background: D.bg, minHeight: "100vh", padding: "16px 16px 40px" }}>
            <style>{CSS}</style>

            {/* ═══ HEADER ═══ */}
            <div className="mp-hdr" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(17px,3vw,21px)", fontWeight: 900, margin: 0, color: D.text, display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 32, height: 32, borderRadius: 10, background: D.blueBg, border: `1px solid ${D.blueBorder}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FiGlobe size={15} color={D.blue} />
                        </span>
                        Live Map Dashboard
                    </h1>
                    <p style={{ fontSize: 11, color: D.muted, margin: "3px 0 0 41px", fontWeight: 500 }}>
                        Users · orders · deliveries — India
                    </p>
                </div>
                <div className="mp-hdr-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                        value={days}
                        onChange={e => { setDays(Number(e.target.value)); setLoading(true); }}
                        style={{ padding: "7px 11px", borderRadius: 9, border: `1px solid ${D.border}`, fontSize: 12, fontWeight: 600, color: D.text, background: D.card, cursor: "pointer", outline: "none" }}
                    >
                        {[7, 30, 60, 90].map(d => <option key={d} value={d}>Last {d}d</option>)}
                    </select>
                    <button
                        onClick={refresh}
                        disabled={refreshing}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: `1px solid ${D.border}`, background: D.card, fontSize: 12, fontWeight: 600, color: D.text, cursor: "pointer", outline: "none" }}
                    >
                        <FiRefreshCw size={12} style={{ animation: refreshing ? "mp-spin .8s linear infinite" : "none", color: D.blue }} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ═══ STATS ═══ */}
            <div className="mp-stats">
                <Stat icon={FiUsers} label="Users w/ Location" value={data?.totalUsers || 0} color={D.blue} bg={D.blueBg} border={D.blueBorder} />
                <Stat icon={FiShoppingBag} label="Orders w/ GPS" value={data?.totalOrders || 0} color={D.green} bg={D.greenBg} border={D.greenBorder} />
                <Stat icon={FiTruck} label="Active Deliveries" value={data?.totalActiveDeliveries || 0} color={D.red} bg={D.redBg} border={D.redBorder} />
            </div>

            {/* ═══ MODE BREAKDOWN ═══ */}
            <div className="mp-mode-grid">
                <ModeCard icon={FiPackage} title="Urbexon E-Commerce" count={mb.ecom || 0} revenue={fmt(mb.ecomRevenue)} color={D.blue} bg={D.blueBg} border={D.blueBorder} />
                <ModeCard icon={FiZap} title="Urbexon Hour (Express)" count={mb.uh || 0} revenue={fmt(mb.uhRevenue)} color={D.violet} bg={D.violetBg} border={D.violetBorder} />
            </div>

            {/* ═══ VIEW PILLS ═══ */}
            <div className="mp-pills" style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
                {[
                    { key: "all", label: "All", icon: FiEye, color: D.blue },
                    { key: "users", label: "Users", icon: FiUsers, color: D.blue },
                    { key: "orders", label: "Orders", icon: FiShoppingBag, color: D.amber },
                    { key: "deliveries", label: "Live Deliveries", icon: FiTruck, color: D.red },
                ].map(v => (
                    <button key={v.key} className="mp-pill" onClick={() => setView(v.key)} style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "7px 13px",
                        borderRadius: 8, border: `1.5px solid ${view === v.key ? v.color : D.border}`,
                        background: view === v.key ? `${v.color}12` : D.card,
                        color: view === v.key ? v.color : D.sub,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        boxShadow: view === v.key ? `0 2px 8px ${v.color}22` : "none",
                        whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                        <v.icon size={12} /> {v.label}
                    </button>
                ))}
            </div>

            {/* ═══ MAP + REGION PANEL ═══ */}
            <div className="mp-2col">

                {/* ── Map wrapper — overflow:hidden clips the map ── */}
                <div className="mp-map-wrap">
                    <MapContainer
                        center={[22.5937, 78.9629]}
                        zoom={5}
                        scrollWheelZoom
                        style={{
                            /* Fixed height — never 100vh on mobile */
                            height: "min(55vw, 520px)",
                            minHeight: 320,
                            width: "100%",
                            display: "block",
                        }}
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
                                        <div style={{ fontSize: 12, lineHeight: 1.8, minWidth: 150, fontFamily: "'DM Sans',sans-serif" }}>
                                            <strong style={{ fontSize: 13, color: D.text }}>{c.count} Orders</strong><br />
                                            <span style={{ color: D.green, fontWeight: 700 }}>💰 {fmt(c.revenue)}</span><br />
                                            {c.ecom > 0 && <span style={{ color: D.blue }}>📦 Ecom: {c.ecom}<br /></span>}
                                            {c.uh > 0 && <span style={{ color: D.violet }}>⚡ UH: {c.uh}<br /></span>}
                                        </div>
                                    </Popup>
                                </Marker>
                            ) : null
                        )}

                        {/* Order dots */}
                        {view === "orders" && (data?.orderLocations || []).map(o =>
                            o.lat && o.lng ? (
                                <CircleMarker key={`ol-${o.id}`} center={[o.lat, o.lng]} radius={5}
                                    pathOptions={{ fillColor: STATUS_COLORS[o.status] || D.green, fillOpacity: .85, color: "#fff", weight: 1.5 }}>
                                    <Popup>
                                        <div style={{ fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif" }}>
                                            <strong style={{ color: D.text }}>📦 {o.customer}</strong><br />
                                            <span style={{ color: D.muted }}>{o.invoice}</span><br />
                                            <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, color: "#fff", background: STATUS_COLORS[o.status] || "#94a3b8" }}>
                                                {o.status?.replace(/_/g, " ")}
                                            </span>
                                            <span style={{ marginLeft: 6, fontWeight: 700, color: D.text }}>{fmt(o.amount)}</span>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ) : null
                        )}

                        {/* Users */}
                        {view === "users" && (data?.userLocations || []).map(u =>
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
                        {(view === "all" || view === "deliveries") && (data?.activeDeliveries || []).map(d => (
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

                    {/* Legend overlay */}
                    <div style={{
                        position: "absolute", bottom: 12, left: 10, zIndex: 5,
                        background: "rgba(255,255,255,.92)", backdropFilter: "blur(8px)",
                        borderRadius: 9, padding: "7px 11px",
                        border: `1px solid ${D.border}`,
                        display: "flex", gap: 10, flexWrap: "wrap",
                        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                        pointerEvents: "none",
                    }}>
                        {[
                            { color: D.blue, label: "Orders" },
                            { color: "#3b82f6", label: "Users" },
                            { color: D.red, label: "Riders" },
                            { color: D.amber, label: "Destination" },
                        ].map(l => (
                            <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: D.sub, fontWeight: 600 }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                                {l.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Region Panel ── */}
                <div className="mp-region-col" style={{
                    background: D.card, borderRadius: 14,
                    border: `1px solid ${D.border}`, display: "flex", flexDirection: "column",
                    overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.05)",
                }}>
                    <SectionHeader
                        icon={FiBarChart2} color={D.green} bg={D.greenBg}
                        title="Orders by Region — India"
                        subtitle={`${data?.totalOrders || 0} orders · ${data?.stateWise?.length || 0} states`}
                    />
                    <div className="mp-scroll" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                        {!(data?.stateWise?.length) ? (
                            <div style={{ padding: 32, textAlign: "center", color: D.muted, fontSize: 13 }}>
                                <FiMapPin size={22} style={{ marginBottom: 8, opacity: .4 }} /><br />No regional data
                            </div>
                        ) : (data.stateWise || []).map((s, i) => {
                            const maxVal = (data.stateWise[0]?.orders || 1) + (data.stateWise[0]?.users || 0);
                            const val = (s.orders || 0) + (s.users || 0);
                            const pct = Math.max(3, (val / maxVal) * 100);
                            const rankColor = [D.green, D.blue, D.amber][i] || D.muted;
                            const rankBg = [D.greenBg, D.blueBg, D.amberBg][i] || "#f1f5f9";
                            const rankBdr = [D.greenBorder, D.blueBorder, D.amberBorder][i] || D.border;
                            return (
                                <div key={s.state} className="mp-fade" style={{
                                    padding: "10px 16px", borderBottom: `1px solid ${D.borderLight}`,
                                    display: "flex", alignItems: "center", gap: 11,
                                    animationDelay: `${i * 20}ms`,
                                }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: rankBg, border: `1px solid ${rankBdr}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: rankColor }}>
                                        {i + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.state}</span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: D.green, flexShrink: 0, marginLeft: 8 }}>{fmt(s.revenue)}</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, fontSize: 10, color: D.muted, marginBottom: 4 }}>
                                            {s.users > 0 && <span>👤 {s.users}</span>}
                                            {s.orders > 0 && <span>📦 {s.orders}</span>}
                                        </div>
                                        <div style={{ height: 3, background: "#f1f5f9", borderRadius: 2 }}>
                                            <div className="mp-bar" style={{ height: 3, borderRadius: 2, width: `${pct}%`, background: `linear-gradient(90deg,${D.blue},${D.cyan})` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ padding: "10px 16px", borderTop: `1px solid ${D.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: D.cardAlt }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: D.muted, letterSpacing: ".5px" }}>TOTAL</span>
                        <div style={{ display: "flex", gap: 10, fontSize: 11, fontWeight: 700 }}>
                            <span style={{ color: D.blue }}>👤 {data?.totalUsers || 0}</span>
                            <span style={{ color: D.amber }}>📦 {data?.totalOrders || 0}</span>
                            <span style={{ color: D.green }}>{fmt((mb.ecomRevenue || 0) + (mb.uhRevenue || 0))}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ BOTTOM PANELS ═══ */}
            <div className="mp-bottom-grid">

                {/* Top Cities */}
                {(data?.topCities?.length > 0) && (
                    <div style={{ background: D.card, borderRadius: 13, border: `1px solid ${D.border}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                        <SectionHeader icon={FiUsers} color={D.blue} bg={D.blueBg} title="Top Cities (Users)" />
                        <div className="mp-scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
                            {data.topCities.map((c, i) => {
                                const w = Math.max(4, (c.count / (data.topCities[0]?.count || 1)) * 100);
                                return (
                                    <div key={c.city} className="mp-fade" style={{ padding: "10px 16px", borderBottom: `1px solid ${D.borderLight}`, display: "flex", alignItems: "center", gap: 11, animationDelay: `${i * 20}ms` }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: i < 3 ? D.amberBg : "#f1f5f9", border: `1px solid ${i < 3 ? D.amberBorder : D.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: i < 3 ? 13 : 10, fontWeight: 800, color: i < 3 ? D.amber : D.muted }}>
                                            {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: D.text }}>{c.city}</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: D.blue }}>{c.count} users</span>
                                            </div>
                                            <div style={{ height: 3, background: "#f1f5f9", borderRadius: 2 }}>
                                                <div className="mp-bar" style={{ height: 3, borderRadius: 2, width: `${w}%`, background: `linear-gradient(90deg,${D.blue},${D.violet})` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Order Clusters Revenue */}
                {(data?.regionClusters?.length > 0) && (
                    <div style={{ background: D.card, borderRadius: 13, border: `1px solid ${D.border}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                        <SectionHeader icon={FiDollarSign} color={D.green} bg={D.greenBg} title="Order Clusters (Revenue)" />
                        <div className="mp-scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
                            {data.regionClusters.slice(0, 15).map((c, i) => {
                                const w = Math.max(4, ((c.revenue || 0) / (data.regionClusters[0]?.revenue || 1)) * 100);
                                return (
                                    <div key={i} className="mp-fade" style={{ padding: "10px 16px", borderBottom: `1px solid ${D.borderLight}`, display: "flex", alignItems: "center", gap: 11, animationDelay: `${i * 20}ms` }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: D.greenBg, border: `1px solid ${D.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: D.green }}>
                                            {c.count}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                                <span style={{ fontSize: 11, color: D.sub }}>{c.lat?.toFixed(1)}°N, {c.lng?.toFixed(1)}°E</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: D.green }}>{fmt(c.revenue)}</span>
                                            </div>
                                            <div style={{ display: "flex", gap: 7, fontSize: 10, color: D.muted, marginBottom: 4 }}>
                                                {c.ecom > 0 && <span style={{ color: D.blue }}>📦 {c.ecom}</span>}
                                                {c.uh > 0 && <span style={{ color: D.violet }}>⚡ {c.uh}</span>}
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