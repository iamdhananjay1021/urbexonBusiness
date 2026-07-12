/**
 * LiveTrackingMap.jsx — canonical live order-tracking map.
 * React Leaflet + OpenStreetMap tiles only — no Google Maps, no paid APIs.
 *
 * ONE reusable implementation. This repo has no shared package between its
 * four separate Vite apps (client/vendor-panel/delivery-panel/admin — each
 * has its own package.json/node_modules, confirmed no workspaces config
 * exists), so "one engine, no duplicate map logic" means this exact file is
 * copied consistently into each app's src/components/, the same pattern
 * already used elsewhere in this session for other cross-app duplication
 * fixes — NOT four independently-hand-rolled near-clones (which is what
 * existed before: client/LiveTrackingMap.jsx, delivery-panel/DeliveryMap.jsx,
 * and admin/AdminTrackingMap.jsx had each drifted slightly apart).
 *
 * Shows: vendor (pickup) marker, customer (destination) marker, a rider
 * marker that SMOOTHLY interpolates between GPS fixes instead of snapping,
 * a dashed "as the crow flies" route line to whichever leg is currently
 * active (no paid turn-by-turn routing API exists or is wired in anywhere
 * in this codebase — a straight line + the real haversine-based distance/
 * ETA the backend already computes is the free-only-compliant choice), and
 * a distance/ETA/status overlay.
 */
import { useEffect, useRef, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ── Fix Leaflet default marker icons in Vite ──────────────── */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

/* ── Icons ──────────────────────────────────────────────────── */
const riderIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:32px;height:32px;">
        <div style="position:absolute;inset:0;background:rgba(59,130,246,0.2);border-radius:50%;animation:ltm-pulse 2s infinite"></div>
        <div style="position:absolute;top:6px;left:6px;width:20px;height:20px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px">🏍️</div>
    </div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16],
});
const destIcon = L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:24px;height:24px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px">📍</div>
        <div style="width:2px;height:8px;background:#ef4444"></div>
    </div>`,
    iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36],
});
const storeIcon = L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:24px;height:24px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px">🏪</div>
        <div style="width:2px;height:8px;background:#3b82f6"></div>
    </div>`,
    iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36],
});

/* ── Smoothly interpolate the rider marker between GPS fixes —
   default Leaflet <Marker> just teleports on position change; this lerps
   over ~900ms via requestAnimationFrame so it glides instead of jumping. ── */
const useSmoothPosition = (target, durationMs = 900) => {
    const [pos, setPos] = useState(target || null);
    const posRef = useRef(target || null);
    const rafRef = useRef(null);
    const fromRef = useRef(target || null);
    const targetKey = target ? `${target[0]},${target[1]}` : null;

    useEffect(() => {
        if (!target) { setPos(null); posRef.current = null; fromRef.current = null; return; }
        if (!fromRef.current) { fromRef.current = target; posRef.current = target; setPos(target); return; }

        // BUG FIX: this used to always lerp from fromRef's OLD committed
        // value — if a new GPS fix arrived before the previous ~900ms
        // animation finished, fromRef.current was still the PREVIOUS
        // target (not wherever the marker actually was on screen), so the
        // marker visibly snapped backward before re-interpolating forward.
        // Starting from posRef (the live, currently-rendered position)
        // instead removes that discontinuity.
        const start = performance.now();
        const [fromLat, fromLng] = posRef.current || fromRef.current;
        const [toLat, toLng] = target;
        cancelAnimationFrame(rafRef.current);

        const step = (now) => {
            const t = Math.min(1, (now - start) / durationMs);
            const next = [fromLat + (toLat - fromLat) * t, fromLng + (toLng - fromLng) * t];
            posRef.current = next;
            setPos(next);
            if (t < 1) rafRef.current = requestAnimationFrame(step);
            else fromRef.current = target;
        };
        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetKey, durationMs]);

    return pos;
};

/* ── Auto-fit bounds to whichever markers are actually present ── */
const FitBounds = ({ positions }) => {
    const map = useMap();
    const prevKey = useRef("");
    useEffect(() => {
        const valid = positions.filter(Boolean);
        if (valid.length === 0) return;
        const key = valid.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join("|");
        if (key === prevKey.current) return;
        prevKey.current = key;
        if (valid.length === 1) map.setView(valid[0], 15, { animate: true });
        else map.fitBounds(L.latLngBounds(valid), { padding: [40, 40], maxZoom: 16, animate: true });
    }, [positions, map]);
    return null;
};

const STATUS_META = {
    PENDING: { label: "Finding a rider…", color: "#64748b" },
    SEARCHING_RIDER: { label: "Finding a rider…", color: "#64748b" },
    ASSIGNED: { label: "Rider Assigned", color: "#3b82f6" },
    ARRIVING_VENDOR: { label: "Heading to Store", color: "#3b82f6" },
    PICKED_UP: { label: "Picked Up", color: "#8b5cf6" },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "#f59e0b" },
    DELIVERED: { label: "Delivered", color: "#10b981" },
};

/**
 * @param riderLat/riderLng/riderName  — live rider position (null if unknown)
 * @param vendorLat/vendorLng/vendorLabel — pickup point
 * @param destLat/destLng/destLabel — delivery address
 * @param leg — "TO_VENDOR" | "TO_CUSTOMER", decides which line is emphasized
 * @param distanceKm/etaText — pre-computed by the backend (never recomputed client-side)
 * @param status — raw delivery.status string, mapped via STATUS_META
 * @param stale — true if the location feed is known to be behind
 * @param showFullRoute — also draw a faint vendor→destination overview line
 */
/* 16-point compass label from a 0-360° bearing — readable at a glance,
   unlike a raw degree number. */
const headingToCompass = (deg) => {
    if (deg == null) return null;
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(deg / 22.5) % 16];
};

const LiveTrackingMap = ({
    riderLat, riderLng, riderName = "Delivery Partner",
    vendorLat, vendorLng, vendorLabel = "Pickup Point",
    destLat, destLng, destLabel = "Delivery Address",
    leg = "TO_CUSTOMER",
    distanceKm = null, etaText = null, status = null,
    speedKmph = null, headingDeg = null,
    height = 260, stale = false, lastUpdated,
    showFullRoute = true,
    style = {},
}) => {
    const rawRiderPos = useMemo(() => (riderLat != null && riderLng != null ? [riderLat, riderLng] : null), [riderLat, riderLng]);
    const riderPos = useSmoothPosition(rawRiderPos);
    const vendorPos = useMemo(() => (vendorLat != null && vendorLng != null ? [vendorLat, vendorLng] : null), [vendorLat, vendorLng]);
    const destPos = useMemo(() => (destLat != null && destLng != null ? [destLat, destLng] : null), [destLat, destLng]);
    const activeTargetPos = leg === "TO_VENDOR" ? vendorPos : destPos;
    const center = riderPos || destPos || vendorPos || [20.5937, 78.9629];
    const meta = STATUS_META[status] || null;

    return (
        <div style={{ position: "relative", ...style }}>
            <style>{`
                @keyframes ltm-pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.8);opacity:0}}
                .leaflet-container{border-radius:10px;font-family:inherit}
                .leaflet-control-attribution{font-size:9px!important;background:rgba(255,255,255,.8)!important}
            `}</style>

            <MapContainer center={center} zoom={15} style={{ height, width: "100%", borderRadius: 10, zIndex: 0 }} scrollWheelZoom={false} zoomControl={true}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <FitBounds positions={[riderPos, vendorPos, destPos]} />

                {/* Faint full-trip overview (store → customer) */}
                {showFullRoute && vendorPos && destPos && (
                    <Polyline positions={[vendorPos, destPos]} pathOptions={{ color: "#94a3b8", weight: 2, opacity: 0.5, dashArray: "2 8" }} />
                )}

                {/* Active leg — rider to whichever waypoint matters right now */}
                {riderPos && activeTargetPos && (
                    <Polyline positions={[riderPos, activeTargetPos]} pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.85, dashArray: "6 8" }} />
                )}

                {riderPos && (
                    <Marker position={riderPos} icon={riderIcon}>
                        <Popup>
                            <div style={{ textAlign: "center", minWidth: 100 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>🏍️ {riderName}</div>
                                <div style={{ fontSize: 11, color: stale ? "#dc2626" : "#64748b" }}>
                                    {stale
                                        ? `Last seen ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-IN") : "a while ago"} — reconnecting…`
                                        : lastUpdated ? `Updated: ${new Date(lastUpdated).toLocaleTimeString("en-IN")}` : "Live location"}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {vendorPos && (
                    <Marker position={vendorPos} icon={storeIcon}>
                        <Popup><div style={{ textAlign: "center", fontWeight: 700, fontSize: 12 }}>🏪 {vendorLabel}</div></Popup>
                    </Marker>
                )}

                {destPos && (
                    <Marker position={destPos} icon={destIcon}>
                        <Popup><div style={{ textAlign: "center", fontWeight: 700, fontSize: 12 }}>📍 {destLabel}</div></Popup>
                    </Marker>
                )}
            </MapContainer>

            {/* Distance / ETA / status overlay */}
            {(distanceKm != null || etaText || meta || speedKmph != null || headingDeg != null) && (
                <div style={{
                    position: "absolute", left: 8, top: 8, zIndex: 500,
                    background: "rgba(255,255,255,.95)", borderRadius: 8, padding: "6px 10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,.15)", display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700,
                }}>
                    {meta && <span style={{ color: meta.color }}>● {meta.label}</span>}
                    {distanceKm != null && <span style={{ color: "#1e293b" }}>{distanceKm.toFixed(1)} km</span>}
                    {etaText && <span style={{ color: "#1e293b" }}>• {etaText}</span>}
                    {speedKmph != null && <span style={{ color: "#64748b" }}>• {speedKmph.toFixed(0)} km/h</span>}
                    {headingDeg != null && <span style={{ color: "#64748b" }}>• {headingToCompass(headingDeg)}</span>}
                </div>
            )}
        </div>
    );
};

export default LiveTrackingMap;
