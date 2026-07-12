/**
 * AdminTrackingMap.jsx — canonical live order-tracking map (admin copy).
 * React Leaflet + OpenStreetMap tiles only — no Google Maps, no paid APIs.
 *
 * ONE reusable implementation, copied consistently into client/, vendor-panel/,
 * delivery-panel/, admin/ (no shared package exists between these four
 * independent Vite apps in this repo — see client/src/components/
 * LiveTrackingMap.jsx, the canonical source, for the full rationale).
 *
 * Unlike the other three copies, this one owns its OWN useLiveTracking call
 * (client/vendor-panel own theirs at the page level) since admin can render
 * many of these at once across an order list — each instance independently
 * tracks its own order via the ONE shared WebSocket connection the parent
 * page already opened (useAdminWs), filtered by orderId. It does NOT open
 * its own socket — `wsMessage`/`wsSend` are passed down from the page.
 */
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLiveTracking } from "../hooks/useLiveTracking";

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
        <div style="position:absolute;inset:0;background:rgba(59,130,246,0.2);border-radius:50%;animation:atm-pulse 2s infinite"></div>
        <div style="position:absolute;top:6px;left:6px;width:20px;height:20px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px">🏍️</div>
    </div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16],
});
const destIcon = L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:22px;height:22px;background:#ef4444;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px">📍</div>
        <div style="width:2px;height:6px;background:#ef4444"></div>
    </div>`,
    iconSize: [22, 30], iconAnchor: [11, 30], popupAnchor: [0, -30],
});
const storeIcon = L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:22px;height:22px;background:#3b82f6;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px">🏪</div>
        <div style="width:2px;height:6px;background:#3b82f6"></div>
    </div>`,
    iconSize: [22, 30], iconAnchor: [11, 30], popupAnchor: [0, -30],
});

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
        else map.fitBounds(L.latLngBounds(valid), { padding: [30, 30], maxZoom: 16, animate: true });
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

/* 16-point compass label from a 0-360° bearing — readable at a glance,
   unlike a raw degree number. */
const headingToCompass = (deg) => {
    if (deg == null) return null;
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(deg / 22.5) % 16];
};

/**
 * @param orderId — required; drives both the room-join and the poll fallback
 * @param api — the admin axios instance (adminApi)
 * @param wsMessage — latest parsed WS message from the PAGE's shared useAdminWs
 * @param wsSend — send function from the same shared connection
 * @param wsConnected — connected state from the same shared connection; used to re-join the order room on reconnect
 * @param destLat/destLng/destLabel — delivery address (from the order doc)
 * @param vendorLabel — pickup point label (coordinates come from the backend's own computation)
 */
const AdminTrackingMap = ({
    orderId,
    riderName = "Rider",
    destLat, destLng, destLabel = "Customer Address",
    vendorLabel = "Pickup Point",
    height = 200,
    api: apiInstance,
    wsMessage,
    wsSend,
    wsConnected = true,
}) => {
    const joinRoom = useCallback(() => {
        if (wsSend && orderId) wsSend("join_room", { room: `order:${orderId}` });
    }, [wsSend, orderId]);

    const fetchLocation = useCallback(async () => {
        if (!apiInstance || !orderId) return null;
        const { data } = await apiInstance.get(`/delivery/orders/${orderId}/rider-location`);
        return data;
    }, [apiInstance, orderId]);

    const tracking = useLiveTracking({ orderId, enabled: !!orderId, wsMessage, joinRoom, fetchLocation, connected: wsConnected });

    const riderPos = useSmoothPosition(tracking.riderPos);
    const vendorPos = tracking.vendorPos;
    const destPos = useMemo(() => (destLat != null && destLng != null ? [destLat, destLng] : tracking.destPos), [destLat, destLng, tracking.destPos]);
    const activeTargetPos = tracking.leg === "TO_VENDOR" ? vendorPos : destPos;
    const center = riderPos || destPos || vendorPos || [20.5937, 78.9629];
    const meta = STATUS_META[tracking.status] || null;

    if (!riderPos && !destPos && !vendorPos) {
        return (
            <div style={{ height, background: "#f8fafc", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
                📍 Rider location not available yet
            </div>
        );
    }

    return (
        <div style={{ position: "relative" }}>
            <style>{`
                @keyframes atm-pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.8);opacity:0}}
                .leaflet-container{border-radius:10px;font-family:inherit}
                .leaflet-control-attribution{font-size:8px!important;background:rgba(255,255,255,.7)!important}
            `}</style>
            <MapContainer center={center} zoom={15} style={{ height, width: "100%", borderRadius: 10, zIndex: 0 }} scrollWheelZoom={false} zoomControl={true}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <FitBounds positions={[riderPos, vendorPos, destPos]} />

                {vendorPos && destPos && (
                    <Polyline positions={[vendorPos, destPos]} pathOptions={{ color: "#94a3b8", weight: 2, opacity: 0.5, dashArray: "2 8" }} />
                )}
                {riderPos && activeTargetPos && (
                    <Polyline positions={[riderPos, activeTargetPos]} pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.85, dashArray: "6 8" }} />
                )}

                {riderPos && (
                    <Marker position={riderPos} icon={riderIcon}>
                        <Popup>
                            <div style={{ textAlign: "center", minWidth: 90 }}>
                                <div style={{ fontWeight: 700, fontSize: 12 }}>🏍️ {tracking.riderName || riderName}</div>
                                {tracking.lastUpdated && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Updated: {new Date(tracking.lastUpdated).toLocaleTimeString("en-IN")}</div>}
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

            {(tracking.distanceKm != null || tracking.etaText || meta || tracking.speedKmph != null || tracking.headingDeg != null) && (
                <div style={{
                    position: "absolute", left: 8, top: 8, zIndex: 500,
                    background: "rgba(255,255,255,.95)", borderRadius: 8, padding: "5px 9px",
                    boxShadow: "0 2px 8px rgba(0,0,0,.15)", display: "flex", alignItems: "center", gap: 7, fontSize: 10, fontWeight: 700,
                }}>
                    {meta && <span style={{ color: meta.color }}>● {meta.label}</span>}
                    {tracking.distanceKm != null && <span style={{ color: "#1e293b" }}>{tracking.distanceKm.toFixed(1)} km</span>}
                    {tracking.etaText && <span style={{ color: "#1e293b" }}>• {tracking.etaText}</span>}
                    {tracking.speedKmph != null && <span style={{ color: "#64748b" }}>• {tracking.speedKmph.toFixed(0)} km/h</span>}
                    {tracking.headingDeg != null && <span style={{ color: "#64748b" }}>• {headingToCompass(tracking.headingDeg)}</span>}
                </div>
            )}
        </div>
    );
};

export default AdminTrackingMap;
