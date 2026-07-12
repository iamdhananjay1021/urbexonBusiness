import { useEffect, useState, useRef, useCallback } from "react";
import api from "../api/adminApi";
import { useAdminWsContext } from "../contexts/AdminWsContext";
import { FiTruck, FiUser, FiPhone, FiFileText, FiRefreshCw, FiMapPin, FiNavigation, FiClock, FiCheckCircle, FiWifi, FiWifiOff, FiZap } from "react-icons/fi";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button, Badge, EmptyState, ErrorState, Modal, FormField, Input } from "../components/ui";

const SHOP = { lat: 26.41922, lng: 82.53598 };

const haversine = (lat1, lng1, lat2, lng2) => {
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const shopIcon = new L.Icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/869/869636.png", iconSize: [30, 30], iconAnchor: [15, 30] });
const orderIcon = new L.Icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", iconSize: [24, 24], iconAnchor: [12, 24] });
const riderIcon = new L.Icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/3448/3448339.png", iconSize: [26, 26], iconAnchor: [13, 26] });

const providers = [
    { value: "LOCAL_RIDER", label: "Local Rider", icon: FiTruck },
    { value: "VENDOR_SELF", label: "Vendor Self", icon: FiUser },
    { value: "SHIPROCKET", label: "Shiprocket", icon: FiMapPin },
];

const STATUS_TONE = {
    PLACED: "warning",
    CONFIRMED: "primary",
    PACKED: "info",
    SHIPPED: "info",
    READY_FOR_PICKUP: "success",
};

const DELIVERY_STEPS = ["ASSIGNED", "ARRIVING_VENDOR", "PICKED_UP", "OUT_FOR_DELIVERY"];

/* ── Assign Modal ── */
const AssignModal = ({ order, onlineRiders, onConfirm, onClose, saving }) => {
    const [provider, setProvider] = useState("LOCAL_RIDER");
    const [selectedRider, setSelectedRider] = useState("");
    const [riderName, setRiderName] = useState("");
    const [riderPhone, setRiderPhone] = useState("");
    const [note, setNote] = useState("");

    // Reset the form every time a *different* order opens in this modal —
    // previously state from the last-assigned order could leak into the
    // next one since AssignModal is a persistent instance, not remounted.
    useEffect(() => {
        if (!order) return;
        setProvider("LOCAL_RIDER");
        setSelectedRider("");
        setRiderName("");
        setRiderPhone("");
        setNote("");
    }, [order?._id]);

    const ridersSorted = (onlineRiders || []).map(r => ({
        ...r,
        distance: r.location?.lat ? haversine(SHOP.lat, SHOP.lng, r.location.lat, r.location.lng) : null,
    })).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

    const canSubmit = provider !== "LOCAL_RIDER" || selectedRider || (riderName.trim() && riderPhone.trim());

    if (!order) return null;

    return (
        <Modal
            open={!!order}
            onClose={onClose}
            title="Assign delivery"
            width={460}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button
                        variant="primary" icon={FiTruck} loading={saving} disabled={!canSubmit}
                        onClick={() => onConfirm({ provider, riderName, riderPhone, riderId: selectedRider || undefined, note })}
                    >
                        {selectedRider ? "Assign to rider" : "Assign delivery"}
                    </Button>
                </>
            )}
        >
            <p style={{ fontSize: 12, color: "var(--adm-muted)", margin: "-8px 0 16px" }}>
                #{order._id.slice(-8).toUpperCase()} · {order.customerName}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <FormField label="Provider">
                    <div style={{ display: "flex", gap: 8 }}>
                        {providers.map(p => (
                            <button key={p.value} type="button" onClick={() => { setProvider(p.value); setSelectedRider(""); }} style={{
                                flex: 1, padding: "10px 8px", borderRadius: "var(--adm-radius-md)", cursor: "pointer", fontFamily: "inherit",
                                border: provider === p.value ? "2px solid var(--adm-primary)" : "1px solid var(--adm-border)",
                                background: provider === p.value ? "var(--adm-primary-tint)" : "var(--adm-surface)",
                                color: provider === p.value ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontSize: 12, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                            }}>
                                <p.icon size={12} /> {p.label}
                            </button>
                        ))}
                    </div>
                </FormField>

                {provider === "LOCAL_RIDER" && (
                    <>
                        {ridersSorted.length > 0 && (
                            <FormField label={`Online riders (${ridersSorted.length})`}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                                    {ridersSorted.map(r => (
                                        <button key={r._id} type="button" onClick={() => { setSelectedRider(r._id); setRiderName(r.name); setRiderPhone(r.phone); }}
                                            style={{
                                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                                padding: "8px 12px", borderRadius: "var(--adm-radius-md)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                                border: selectedRider === r._id ? "2px solid var(--adm-success)" : "1px solid var(--adm-border)",
                                                background: selectedRider === r._id ? "var(--adm-success-tint)" : "var(--adm-surface)",
                                            }}>
                                            <div>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)" }}>{r.name}</span>
                                                <span style={{ fontSize: 11, color: "var(--adm-muted)", marginLeft: 8 }}>{r.vehicleType} · {r.phone}</span>
                                            </div>
                                            <div style={{ textAlign: "right" }}>
                                                {r.distance != null && (
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: r.distance < 5 ? "var(--adm-success)" : "var(--adm-warning)" }}>
                                                        {r.distance.toFixed(1)} km
                                                    </span>
                                                )}
                                                {r.stats?.totalDeliveries > 0 && (
                                                    <span style={{ fontSize: 10, color: "var(--adm-muted)", display: "block" }}>{r.stats.totalDeliveries} trips</span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </FormField>
                        )}

                        <div style={{ fontSize: 11, color: "var(--adm-muted)", textAlign: "center" }}>— or enter manually —</div>

                        <FormField label="Rider name">
                            <div style={{ position: "relative" }}>
                                <FiUser size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--adm-muted)" }} />
                                <Input value={riderName} onChange={e => { setRiderName(e.target.value); setSelectedRider(""); }} placeholder="Enter rider name"
                                    style={{ width: "100%", boxSizing: "border-box", paddingLeft: 32 }} />
                            </div>
                        </FormField>
                        <FormField label="Rider phone">
                            <div style={{ position: "relative" }}>
                                <FiPhone size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--adm-muted)" }} />
                                <Input value={riderPhone} onChange={e => { setRiderPhone(e.target.value); setSelectedRider(""); }} placeholder="10-digit number"
                                    style={{ width: "100%", boxSizing: "border-box", paddingLeft: 32 }} />
                            </div>
                        </FormField>
                    </>
                )}

                <FormField label="Note (optional)">
                    <div style={{ position: "relative" }}>
                        <FiFileText size={13} style={{ position: "absolute", left: 10, top: 12, color: "var(--adm-muted)" }} />
                        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Internal note" rows={2}
                            style={{ width: "100%", padding: "9px 12px 9px 32px", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", color: "var(--adm-text-primary)", background: "var(--adm-surface)" }} />
                    </div>
                </FormField>
            </div>
        </Modal>
    );
};

/* ── Dispatch Map ── */
const DispatchMap = ({ orders, riders }) => {
    const orderMarkers = orders.filter(o => o.latitude && o.longitude);
    const riderMarkers = (riders || []).filter(r => r.location?.lat && r.location?.lng);

    if (orderMarkers.length === 0 && riderMarkers.length === 0) return null;

    return (
        <div style={{ borderRadius: "var(--adm-radius-lg)", overflow: "hidden", border: "1px solid var(--adm-border)", marginBottom: 20 }}>
            <MapContainer center={[SHOP.lat, SHOP.lng]} zoom={12} style={{ height: 300, width: "100%" }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                <Marker position={[SHOP.lat, SHOP.lng]} icon={shopIcon}><Popup>Urbexon store</Popup></Marker>
                <Circle center={[SHOP.lat, SHOP.lng]} radius={15000} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.04, weight: 1 }} />
                {orderMarkers.map(o => (
                    <Marker key={o._id} position={[o.latitude, o.longitude]} icon={orderIcon}>
                        <Popup>
                            <strong>#{o._id.slice(-8).toUpperCase()}</strong><br />
                            {o.customerName}<br />
                            {o.delivery?.distanceKm?.toFixed(1)} km · ₹{o.totalAmount}
                        </Popup>
                    </Marker>
                ))}
                {riderMarkers.map(r => (
                    <Marker key={r._id} position={[r.location.lat, r.location.lng]} icon={riderIcon}>
                        <Popup>
                            {r.name}<br />
                            {r.vehicleType} · {r.phone}<br />
                            {haversine(SHOP.lat, SHOP.lng, r.location.lat, r.location.lng).toFixed(1)} km from store
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

const AdminLocalDelivery = () => {
    const [orders, setOrders] = useState([]);
    const [onlineRiders, setOnlineRiders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [assigningId, setAssigningId] = useState(null);
    const [autoAssigningIds, setAutoAssigningIds] = useState(() => new Set());
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);
    const [showMap, setShowMap] = useState(true);
    const [newOrderFlash, setNewOrderFlash] = useState(false);

    const timerRef = useRef(null);
    const loadRef = useRef(null);
    const mountedRef = useRef(true);
    const inFlightRef = useRef(false);          // prevents overlapping fetches (WS + poll racing)
    const lastLoadAtRef = useRef(0);
    const toastTimerRef = useRef(null);
    const flashTimerRef = useRef(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const showToast = (type, msg) => {
        if (!mountedRef.current) return;
        clearTimeout(toastTimerRef.current);
        setToast({ type, msg });
        toastTimerRef.current = setTimeout(() => mountedRef.current && setToast(null), 3500);
    };

    // Single source of truth for fetching. `inFlightRef` stops a WebSocket
    // push and the 15s poll from firing two overlapping requests at once —
    // previously both could hit the API within milliseconds of each other.
    const load = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        lastLoadAtRef.current = Date.now();
        try {
            setLoading(true);
            const [ordersRes, ridersRes] = await Promise.all([
                api.get("/orders/admin/local-delivery?limit=50"),
                api.get("/admin/delivery-boys/online"),
            ]);
            if (!mountedRef.current) return;
            setOrders(ordersRes.data.orders || []);
            setOnlineRiders(ridersRes.data.riders || []);
            setError("");
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err.response?.data?.message || "Failed to load");
        } finally {
            inFlightRef.current = false;
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    loadRef.current = load;

    const { connected, lastMessage: adminWsMessage } = useAdminWsContext();

    useEffect(() => {
        const t = adminWsMessage?.type;
        if (t === "new_order" || t === "order_status_updated" || t === "delivery_assigned" || t === "new_delivery_request") {
            setNewOrderFlash(true);
            clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => mountedRef.current && setNewOrderFlash(false), 3000);
            loadRef.current?.();
        }
        return () => clearTimeout(flashTimerRef.current);
    }, [adminWsMessage]);

    // Poll every 15s as a fallback for when the socket is down. When it's
    // connected, skip a poll tick if a load already happened in the last 10s
    // (via a WS push) instead of redundantly re-fetching.
    useEffect(() => {
        load();
        timerRef.current = setInterval(() => {
            if (connected && Date.now() - lastLoadAtRef.current < 10000) return;
            load();
        }, 15000);
        return () => clearInterval(timerRef.current);
    }, [load, connected]);

    const handleAssign = async ({ provider, riderName, riderPhone, riderId, note }) => {
        const orderId = modal._id;
        try {
            setAssigningId(orderId);
            await api.put(`/orders/admin/local-delivery/${orderId}/assign`, { provider, riderName, riderPhone, riderId, note });
            showToast("success", `Delivery assigned — ${provider.replace(/_/g, " ")}`);
            setModal(null);
            await load();
        } catch (err) {
            showToast("error", err.response?.data?.message || "Assignment failed");
        } finally {
            if (mountedRef.current) setAssigningId(null);
        }
    };

    const handleAutoAssign = async (order) => {
        const id = order._id;
        if (autoAssigningIds.has(id)) return; // guards against double-click firing two requests
        setAutoAssigningIds(prev => new Set(prev).add(id));
        try {
            await api.post(`/admin/orders/${id}/start-assignment`);
            showToast("success", "Auto-assignment started");
            await load();
        } catch (err) {
            showToast("error", err.response?.data?.message || "Auto-assign failed");
        } finally {
            if (mountedRef.current) {
                setAutoAssigningIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        }
    };

    const assigned = orders.filter(o => o.delivery?.assignedTo || o.delivery?.riderName);
    const unassigned = orders.filter(o => !o.delivery?.assignedTo && !o.delivery?.riderName);

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)" }}>
            <style>{`
                @keyframes ld-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
                .ld-card{transition:border-color .15s ease, box-shadow .15s ease}
                .ld-card:hover{border-color:var(--adm-border-strong,var(--adm-border));box-shadow:var(--adm-shadow-sm,0 1px 4px rgba(0,0,0,.04))}
                .ld-stat:hover{transform:translateY(-1px)}
                .ld-stat{transition:transform .15s ease}
            `}</style>

            {toast && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 9999,
                    background: toast.type === "error" ? "var(--adm-danger-tint)" : "var(--adm-success-tint)",
                    border: `1px solid ${toast.type === "error" ? "var(--adm-danger)" : "var(--adm-success)"}`,
                    color: toast.type === "error" ? "var(--adm-danger)" : "var(--adm-success)",
                    padding: "10px 16px", borderRadius: "var(--adm-radius-md)", fontSize: 13, fontWeight: 600,
                    boxShadow: "var(--adm-shadow-md)", maxWidth: 340, animation: "ld-fade .2s ease",
                }}>
                    {toast.msg}
                </div>
            )}

            {newOrderFlash && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9998, background: "linear-gradient(135deg, var(--adm-success), var(--adm-success-hover))", color: "var(--adm-text-on-accent)", padding: "10px 20px", textAlign: "center", fontSize: 14, fontWeight: 700, animation: "ld-fade .2s ease" }}>
                    New order or status update received — refreshing…
                </div>
            )}

            <AssignModal order={modal} onlineRiders={onlineRiders} onConfirm={handleAssign} onClose={() => setModal(null)} saving={!!assigningId} />

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Urbexon Hour dispatch</h1>
                        {connected
                            ? <FiWifi size={14} color="var(--adm-success)" title="Live" />
                            : <FiWifiOff size={14} color="var(--adm-muted)" title="Disconnected" />}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 3 }}>
                        {orders.length} orders · {onlineRiders.length} riders online · {connected ? "Live" : "Polling every 15s"}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant={showMap ? "primary" : "secondary"} size="sm" icon={FiMapPin} onClick={() => setShowMap(p => !p)}>Map</Button>
                    <Button variant="secondary" size="sm" icon={FiRefreshCw} loading={loading} onClick={load}>
                        {loading ? "Loading…" : "Refresh"}
                    </Button>
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                    { label: "Unassigned", count: unassigned.length, tone: "warning" },
                    { label: "Assigned", count: assigned.length, tone: "success" },
                    { label: "Riders online", count: onlineRiders.length, tone: "primary" },
                ].map(s => (
                    <div key={s.label} className="ld-stat" style={{
                        flex: "1 1 160px", padding: "14px 18px", borderRadius: "var(--adm-radius-lg)",
                        background: `var(--adm-${s.tone}-tint)`,
                        border: `1px solid color-mix(in srgb, var(--adm-${s.tone}) 25%, transparent)`,
                    }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: `var(--adm-${s.tone})`, lineHeight: 1.1 }}>{s.count}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: `var(--adm-${s.tone})`, opacity: 0.85, marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {error && <div style={{ marginBottom: 16 }}><ErrorState message={error} onRetry={load} /></div>}

            {showMap && <DispatchMap orders={orders} riders={onlineRiders} />}

            {!loading && orders.length === 0 && (
                <EmptyState icon={FiTruck} title="No active Urbexon Hour orders" description="New orders will appear here automatically." />
            )}

            {unassigned.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-warning)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                        <FiClock size={14} /> Awaiting assignment ({unassigned.length})
                    </h3>
                    <div style={{ display: "grid", gap: 10 }}>
                        {unassigned.map((o, i) => (
                            <OrderCard
                                key={o._id} o={o} i={i} onAssign={setModal}
                                autoAssigning={autoAssigningIds.has(o._id)}
                                onAutoAssign={handleAutoAssign}
                            />
                        ))}
                    </div>
                </div>
            )}

            {assigned.length > 0 && (
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-success)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                        <FiCheckCircle size={14} /> Assigned ({assigned.length})
                    </h3>
                    <div style={{ display: "grid", gap: 10 }}>
                        {assigned.map((o, i) => (
                            <OrderCard
                                key={o._id} o={o} i={i} onAssign={setModal}
                                autoAssigning={autoAssigningIds.has(o._id)}
                                onAutoAssign={handleAutoAssign}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ── Order Card ── */
const OrderCard = ({ o, i, onAssign, autoAssigning, onAutoAssign }) => {
    const statusTone = STATUS_TONE[o.orderStatus] || "warning";
    const hasRider = o.delivery?.assignedTo || o.delivery?.riderName;

    return (
        <div className="ld-card" style={{ border: `1px solid ${hasRider ? "var(--adm-success)" : "var(--adm-border)"}`, borderRadius: "var(--adm-radius-lg)", padding: 16, background: "var(--adm-surface)", animation: `ld-fade 0.2s ease ${Math.min(i, 10) * 40}ms both` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--adm-text-primary)" }}>#{o._id.slice(-8).toUpperCase()}</span>
                        <Badge tone="success">UH</Badge>
                        <Badge tone={statusTone}>{o.orderStatus}</Badge>
                        {hasRider && <Badge tone="success">{o.delivery.riderName}</Badge>}
                    </div>
                    <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)" }}>{o.customerName}</p>
                    <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--adm-text-secondary)", maxWidth: 400 }}>{o.address}</p>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--adm-muted)", marginTop: 6, flexWrap: "wrap" }}>
                        <span><FiNavigation size={10} style={{ marginRight: 3 }} />{Number(o.delivery?.distanceKm || 0).toFixed(1)} km</span>
                        <span>₹{Number(o.totalAmount || 0).toLocaleString("en-IN")}</span>
                        {o.delivery?.provider && <span style={{ color: "var(--adm-primary)", fontWeight: 600 }}>{o.delivery.provider.replace(/_/g, " ")}</span>}
                        {o.delivery?.assignedAt && <span><FiClock size={10} style={{ marginRight: 3 }} />{new Date(o.delivery.assignedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>

                    {/* Progress steps now only render for orders that actually have
                        a rider/delivery assigned — previously this showed for
                        unassigned orders too, which was confusing clutter since
                        there's nothing to track yet. */}
                    {hasRider && o.delivery?.status && (
                        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                            {DELIVERY_STEPS.map(step => {
                                const ci = DELIVERY_STEPS.indexOf(o.delivery.status);
                                const si = DELIVERY_STEPS.indexOf(step);
                                return (
                                    <span key={step} style={{
                                        padding: "3px 9px", borderRadius: "var(--adm-radius-md)", fontSize: 9.5, fontWeight: 700,
                                        background: si < ci ? "var(--adm-success-tint)" : si === ci ? "var(--adm-success)" : "var(--adm-surface-alt)",
                                        color: si < ci ? "var(--adm-success-hover)" : si === ci ? "var(--adm-text-on-accent)" : "var(--adm-muted)",
                                        border: `1px solid ${si <= ci ? "var(--adm-success)" : "var(--adm-border)"}`,
                                    }}>{step.replace(/_/g, " ")}</span>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
                    <Button variant={hasRider ? "secondary" : "primary"} icon={FiTruck} onClick={() => onAssign(o)}>
                        {hasRider ? "Reassign" : "Assign"}
                    </Button>
                    {!hasRider && (
                        <Button
                            variant="secondary" size="sm" icon={FiZap} loading={autoAssigning} disabled={autoAssigning}
                            style={{ color: "var(--adm-warning)", borderColor: "var(--adm-warning)", background: "var(--adm-warning-tint)" }}
                            onClick={(e) => { e.stopPropagation(); onAutoAssign(o); }}
                        >
                            {autoAssigning ? "Assigning…" : "Auto-assign"}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminLocalDelivery;