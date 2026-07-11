import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ── Fix Leaflet default marker icons in Vite ──────────────── */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

/* ── Custom rider icon (pulsing blue dot) ──────────────────── */
const riderIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:32px;height:32px;">
        <div style="position:absolute;inset:0;background:rgba(59,130,246,0.2);border-radius:50%;animation:lm-pulse 2s infinite"></div>
        <div style="position:absolute;top:6px;left:6px;width:20px;height:20px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px">🏍️</div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
});

/* ── Destination icon (red pin) ────────────────────────────── */
const destIcon = L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:24px;height:24px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px">📍</div>
        <div style="width:2px;height:8px;background:#ef4444"></div>
    </div>`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
});

/* ── Component to auto-pan map when rider moves ────────────── */
const AutoPan = ({ position, destination }) => {
    const map = useMap();
    const prevPos = useRef(null);

    useEffect(() => {
        if (!position) return;
        const [lat, lng] = position;
        const moved =
            !prevPos.current ||
            Math.abs(prevPos.current[0] - lat) > 0.0001 ||
            Math.abs(prevPos.current[1] - lng) > 0.0001;

        if (moved) {
            prevPos.current = position;
            if (destination) {
                const bounds = L.latLngBounds([position, destination]);
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
            } else {
                map.setView(position, map.getZoom() || 15, { animate: true });
            }
        }
    }, [position, destination, map]);

    return null;
};

/* ── Main Map Component ────────────────────────────────────── */
const LiveTrackingMap = ({
    riderLat,
    riderLng,
    riderName = "Delivery Partner",
    destLat,
    destLng,
    destLabel = "Delivery Address",
    height = 260,
    lastUpdated,
    stale = false,
    style = {},
}) => {
    const riderPos = useMemo(
        () => (riderLat && riderLng ? [riderLat, riderLng] : null),
        [riderLat, riderLng]
    );
    const destPos = useMemo(
        () => (destLat && destLng ? [destLat, destLng] : null),
        [destLat, destLng]
    );
    const center = riderPos || destPos || [20.5937, 78.9629]; // India center fallback

    return (
        <div style={{ position: "relative", ...style }}>
            <style>{`
                @keyframes lm-pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.8);opacity:0}}
                .leaflet-container{font-family:'DM Sans',sans-serif;border-radius:10px}
                .leaflet-control-attribution{font-size:9px!important;background:rgba(255,255,255,.8)!important}
            `}</style>
            <MapContainer
                center={center}
                zoom={15}
                style={{ height, width: "100%", borderRadius: 10, zIndex: 0 }}
                scrollWheelZoom={false}
                zoomControl={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <AutoPan position={riderPos} destination={destPos} />

                {riderPos && (
                    <Marker position={riderPos} icon={riderIcon}>
                        <Popup>
                            <div style={{ textAlign: "center", minWidth: 100 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                                    🏍️ {riderName}
                                </div>
                                <div style={{ fontSize: 11, color: stale ? "#dc2626" : "#64748b" }}>
                                    {stale
                                        ? `Last seen ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-IN") : "a while ago"} — reconnecting…`
                                        : lastUpdated
                                            ? `Updated: ${new Date(lastUpdated).toLocaleTimeString("en-IN")}`
                                            : "Live location"}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {destPos && (
                    <Marker position={destPos} icon={destIcon}>
                        <Popup>
                            <div style={{ textAlign: "center", minWidth: 100 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>📍 {destLabel}</div>
                            </div>
                        </Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
};

export default LiveTrackingMap;
