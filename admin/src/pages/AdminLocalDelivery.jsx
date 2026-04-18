import { useEffect, useState, useRef, useCallback } from "react";
import api from "../api/adminApi";
import useAdminWs from "../hooks/useAdminWs";
import { FiTruck, FiUser, FiPhone, FiFileText, FiX, FiRefreshCw, FiMapPin, FiLoader, FiNavigation, FiClock, FiCheckCircle, FiWifi, FiWifiOff } from "react-icons/fi";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const T = { bg: "#f8fafc", white: "#fff", border: "#e2e8f0", text: "#1e293b", muted: "#475569", hint: "#94a3b8", blue: "#2563eb", blueBg: "#eff6ff", green: "#10b981", amber: "#f59e0b", red: "#ef4444" };

const SHOP = { lat: 26.41922, lng: 82.53598 };

const haversine = (lat1, lng1, lat2, lng2) => {
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* custom icons */
const shopIcon = new L.Icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/869/869636.png", iconSize: [30, 30], iconAnchor: [15, 30] });
const orderIcon = new L.Icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", iconSize: [24, 24], iconAnchor: [12, 24] });
const riderIcon = new L.Icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/3448/3448339.png", iconSize: [26, 26], iconAnchor: [13, 26] });

const providers = [
    { value: "LOCAL_RIDER", label: "Local Rider", icon: FiTruck },
    { value: "VENDOR_SELF", label: "Vendor Self", icon: FiUser },
    { value: "SHIPROCKET", label: "Shiprocket", icon: FiMapPin },
];

const STATUS_COLORS = {
    PLACED: { color: T.amber, bg: "#fef3c7" },
    CONFIRMED: { color: T.blue, bg: T.blueBg },
    PACKED: { color: "#8b5cf6", bg: "#f5f3ff" },
    SHIPPED: { color: "#0ea5e9", bg: "#f0f9ff" },
    READY_FOR_PICKUP: { color: T.green, bg: "#ecfdf5" },
};

/* ── Assign Modal with Online Rider Selection ── */
const AssignModal = ({ order, onlineRiders, onConfirm, onClose, saving }) => {
    const [provider, setProvider] = useState("LOCAL_RIDER");
    const [selectedRider, setSelectedRider] = useState("");
    const [riderName, setRiderName] = useState("");
    const [riderPhone, setRiderPhone] = useState("");
    const [note, setNote] = useState("");

    const ridersSorted = (onlineRiders || []).map(r => ({
        ...r,
        distance: r.location?.lat ? haversine(SHOP.lat, SHOP.lng, r.location.lat, r.location.lng) : null,
    })).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={onClose}>
            <div style={{ background: T.white, borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflow: "auto" }}
                onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>Assign Delivery</h3>
                        <p style={{ fontSize: 12, color: T.hint, margin: "3px 0 0" }}>#{order._id.slice(-8).toUpperCase()} · {order.customerName}</p>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.hint, padding: 4 }}><FiX size={18} /></button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Provider selector */}
                    <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>Provider</label>
                        <div style={{ display: "flex", gap: 8 }}>
                            {providers.map(p => (
                                <button key={p.value} onClick={() => { setProvider(p.value); setSelectedRider(""); }} style={{
                                    flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                                    border: provider === p.value ? `2px solid ${T.blue}` : `1px solid ${T.border}`,
                                    background: provider === p.value ? T.blueBg : T.white,
                                    color: provider === p.value ? T.blue : T.muted, fontSize: 12, fontWeight: 700,
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                }}>
                                    <p.icon size={12} /> {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rider selection for LOCAL_RIDER */}
                    {provider === "LOCAL_RIDER" && (
                        <>
                            {ridersSorted.length > 0 && (
                                <div>
                                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
                                        Online Riders ({ridersSorted.length})
                                    </label>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                                        {ridersSorted.map(r => (
                                            <button key={r._id} onClick={() => { setSelectedRider(r._id); setRiderName(r.name); setRiderPhone(r.phone); }}
                                                style={{
                                                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                                    padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                                    border: selectedRider === r._id ? `2px solid ${T.green}` : `1px solid ${T.border}`,
                                                    background: selectedRider === r._id ? "#ecfdf5" : T.white,
                                                }}>
                                                <div>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.name}</span>
                                                    <span style={{ fontSize: 11, color: T.hint, marginLeft: 8 }}>{r.vehicleType} · {r.phone}</span>
                                                </div>
                                                <div style={{ textAlign: "right" }}>
                                                    {r.distance != null && (
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: r.distance < 5 ? T.green : T.amber }}>
                                                            {r.distance.toFixed(1)} km
                                                        </span>
                                                    )}
                                                    {r.stats?.totalDeliveries > 0 && (
                                                        <span style={{ fontSize: 10, color: T.hint, display: "block" }}>{r.stats.totalDeliveries} trips</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ fontSize: 11, color: T.hint, textAlign: "center" }}>— or enter manually —</div>

                            <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>Rider Name</label>
                                <div style={{ position: "relative" }}>
                                    <FiUser size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.hint }} />
                                    <input value={riderName} onChange={e => { setRiderName(e.target.value); setSelectedRider(""); }} placeholder="Enter rider name"
                                        style={{ width: "100%", padding: "9px 12px 9px 32px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>Rider Phone</label>
                                <div style={{ position: "relative" }}>
                                    <FiPhone size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.hint }} />
                                    <input value={riderPhone} onChange={e => { setRiderPhone(e.target.value); setSelectedRider(""); }} placeholder="10-digit number"
                                        style={{ width: "100%", padding: "9px 12px 9px 32px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Note */}
                    <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>Note (optional)</label>
                        <div style={{ position: "relative" }}>
                            <FiFileText size={13} style={{ position: "absolute", left: 10, top: 12, color: T.hint }} />
                            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Internal note" rows={2}
                                style={{ width: "100%", padding: "9px 12px 9px 32px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button onClick={() => onConfirm({ provider, riderName, riderPhone, riderId: selectedRider || undefined, note })} disabled={saving}
                        style={{ flex: 1, padding: 11, background: T.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: saving ? 0.6 : 1 }}>
                        {saving ? <FiLoader size={13} style={{ animation: "ld-spin .8s linear infinite" }} /> : <FiTruck size={13} />}
                        {saving ? "Assigning…" : selectedRider ? "Assign to Rider" : "Assign Delivery"}
                    </button>
                    <button onClick={onClose} style={{ padding: "11px 18px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.muted, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

/* ── Dispatch Map ── */
const DispatchMap = ({ orders, riders }) => {
    const orderMarkers = orders.filter(o => o.latitude && o.longitude);
    const riderMarkers = (riders || []).filter(r => r.location?.lat && r.location?.lng);

    if (orderMarkers.length === 0 && riderMarkers.length === 0) return null;

    return (
        <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}`, marginBottom: 20 }}>
            <MapContainer center={[SHOP.lat, SHOP.lng]} zoom={12} style={{ height: 300, width: "100%" }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                {/* Shop */}
                <Marker position={[SHOP.lat, SHOP.lng]} icon={shopIcon}><Popup>🏪 Urbexon Store</Popup></Marker>
                <Circle center={[SHOP.lat, SHOP.lng]} radius={15000} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.04, weight: 1 }} />
                {/* Orders */}
                {orderMarkers.map(o => (
                    <Marker key={o._id} position={[o.latitude, o.longitude]} icon={orderIcon}>
                        <Popup>
                            <strong>#{o._id.slice(-8).toUpperCase()}</strong><br />
                            {o.customerName}<br />
                            {o.delivery?.distanceKm?.toFixed(1)} km · ₹{o.totalAmount}
                        </Popup>
                    </Marker>
                ))}
                {/* Riders */}
                {riderMarkers.map(r => (
                    <Marker key={r._id} position={[r.location.lat, r.location.lng]} icon={riderIcon}>
                        <Popup>
                            🏍️ {r.name}<br />
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
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);
    const [showMap, setShowMap] = useState(true);
    const [newOrderFlash, setNewOrderFlash] = useState(false);
    const timerRef = useRef(null);
    const loadRef = useRef(null);

    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [ordersRes, ridersRes] = await Promise.all([
                api.get("/orders/admin/local-delivery?limit=50"),
                api.get("/admin/delivery-boys/online"),
            ]);
            setOrders(ordersRes.data.orders || []);
            setOnlineRiders(ridersRes.data.riders || []);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    }, []);

    loadRef.current = load;

    // WebSocket: auto-refresh on new UH orders or status changes
    const { connected } = useAdminWs(useCallback((msg) => {
        const t = msg.type;
        if (t === "new_order" || t === "order_status_updated" || t === "delivery_assigned" || t === "new_delivery_request") {
            setNewOrderFlash(true);
            setTimeout(() => setNewOrderFlash(false), 3000);
            loadRef.current?.();
        }
    }, []));

    // Auto-refresh every 15s
    useEffect(() => {
        load();
        timerRef.current = setInterval(load, 15000);
        return () => clearInterval(timerRef.current);
    }, [load]);

    const handleAssign = async ({ provider, riderName, riderPhone, riderId, note }) => {
        try {
            setAssigningId(modal._id);
            await api.put(`/orders/admin/local-delivery/${modal._id}/assign`, { provider, riderName, riderPhone, riderId, note });
            showToast("success", `Delivery assigned — ${provider.replace("_", " ")}`);
            setModal(null);
            await load();
        } catch (err) {
            showToast("error", err.response?.data?.message || "Assignment failed");
        } finally {
            setAssigningId(null);
        }
    };

    const assigned = orders.filter(o => o.delivery?.assignedTo || o.delivery?.riderName);
    const unassigned = orders.filter(o => !o.delivery?.assignedTo && !o.delivery?.riderName);

    return (
        <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: T.text }}>
            <style>{`@keyframes ld-spin{to{transform:rotate(360deg)}} @keyframes ld-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse-green{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.3)}50%{box-shadow:0 0 0 6px rgba(16,185,129,0)}}`}</style>

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.type === "error" ? "#fef2f2" : "#f0fdf4", border: `1px solid ${toast.type === "error" ? "#fecaca" : "#bbf7d0"}`, color: toast.type === "error" ? T.red : T.green, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", maxWidth: 340, animation: "ld-fade .2s ease" }}>
                    {toast.msg}
                </div>
            )}

            {/* New Order Flash Banner */}
            {newOrderFlash && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9998, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", padding: "10px 20px", textAlign: "center", fontSize: 14, fontWeight: 700, animation: "ld-fade .2s ease" }}>
                    New order / status update received — refreshing...
                </div>
            )}

            {/* Modal */}
            {modal && <AssignModal order={modal} onlineRiders={onlineRiders} onConfirm={handleAssign} onClose={() => setModal(null)} saving={!!assigningId} />}

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Urbexon Hour Dispatch</h1>
                        {connected ? <FiWifi size={14} color={T.green} title="Live" /> : <FiWifiOff size={14} color={T.hint} title="Disconnected" />}
                    </div>
                    <p style={{ fontSize: 13, color: T.hint, marginTop: 3 }}>
                        {orders.length} orders · {onlineRiders.length} riders online · {connected ? "Live" : "Polling 15s"}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setShowMap(p => !p)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: showMap ? T.blueBg : T.white, border: `1px solid ${showMap ? T.blue : T.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: showMap ? T.blue : T.muted }}>
                        <FiMapPin size={13} /> Map
                    </button>
                    <button onClick={load} disabled={loading}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.muted }}>
                        <FiRefreshCw size={13} style={{ animation: loading ? "ld-spin .8s linear infinite" : "none" }} />
                        {loading ? "Loading…" : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                    { label: "Unassigned", count: unassigned.length, color: T.amber, bg: "#fef3c7" },
                    { label: "Assigned", count: assigned.length, color: T.green, bg: "#ecfdf5" },
                    { label: "Riders Online", count: onlineRiders.length, color: T.blue, bg: T.blueBg },
                ].map(s => (
                    <div key={s.label} style={{ flex: "1 1 120px", padding: "12px 16px", borderRadius: 10, background: s.bg, border: `1px solid ${s.color}22` }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: s.color, opacity: 0.8 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: T.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

            {/* Map */}
            {showMap && <DispatchMap orders={orders} riders={onlineRiders} />}

            {/* Empty */}
            {!loading && orders.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, color: T.hint }}>
                    <FiTruck size={36} style={{ marginBottom: 10, opacity: 0.3 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: T.muted, margin: "0 0 4px" }}>No active Urbexon Hour orders</p>
                    <p style={{ fontSize: 13, margin: 0 }}>New orders will appear here automatically</p>
                </div>
            )}

            {/* Unassigned orders first */}
            {unassigned.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: T.amber, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                        <FiClock size={14} /> Awaiting Assignment ({unassigned.length})
                    </h3>
                    <div style={{ display: "grid", gap: 10 }}>
                        {unassigned.map((o, i) => <OrderCard key={o._id} o={o} i={i} onAssign={setModal} onRefresh={load} />)}
                    </div>
                </div>
            )}

            {/* Assigned orders */}
            {assigned.length > 0 && (
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: T.green, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                        <FiCheckCircle size={14} /> Assigned ({assigned.length})
                    </h3>
                    <div style={{ display: "grid", gap: 10 }}>
                        {assigned.map((o, i) => <OrderCard key={o._id} o={o} i={i} onAssign={setModal} onRefresh={load} />)}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ── Order Card ── */
const OrderCard = ({ o, i, onAssign, onRefresh }) => {
    const st = STATUS_COLORS[o.orderStatus] || STATUS_COLORS.PLACED;
    const hasRider = o.delivery?.assignedTo || o.delivery?.riderName;

    return (
        <div style={{ border: `1px solid ${hasRider ? "#bbf7d0" : T.border}`, borderRadius: 12, padding: 16, background: T.white, animation: `ld-fade 0.2s ease ${i * 40}ms both` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>#{o._id.slice(-8).toUpperCase()}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: st.color, background: st.bg }}>{o.orderStatus}</span>
                        {hasRider && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: T.green, background: "#ecfdf5" }}>
                                🏍️ {o.delivery.riderName}
                            </span>
                        )}
                    </div>
                    <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: T.text }}>{o.customerName}</p>
                    <p style={{ margin: "0 0 4px", fontSize: 12, color: T.muted, maxWidth: 400 }}>{o.address}</p>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.hint, marginTop: 6, flexWrap: "wrap" }}>
                        <span><FiNavigation size={10} style={{ marginRight: 3 }} />{Number(o.delivery?.distanceKm || 0).toFixed(1)} km</span>
                        <span>₹{Number(o.totalAmount || 0).toLocaleString("en-IN")}</span>
                        {o.delivery?.provider && <span style={{ color: T.blue, fontWeight: 600 }}>{o.delivery.provider.replace("_", " ")}</span>}
                        {o.delivery?.assignedAt && <span><FiClock size={10} style={{ marginRight: 3 }} />{new Date(o.delivery.assignedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                    {o.delivery?.status && (
                        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                            {["ASSIGNED", "ARRIVING_VENDOR", "PICKED_UP", "OUT_FOR_DELIVERY"].map(step => {
                                const steps = ["ASSIGNED", "ARRIVING_VENDOR", "PICKED_UP", "OUT_FOR_DELIVERY"];
                                const ci = steps.indexOf(o.delivery.status);
                                const si = steps.indexOf(step);
                                return (
                                    <span key={step} style={{
                                        padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700,
                                        background: si < ci ? "#d1fae5" : si === ci ? T.green : "#f8fafc",
                                        color: si < ci ? "#065f46" : si === ci ? "#fff" : T.hint,
                                        border: `1px solid ${si <= ci ? T.green : T.border}`,
                                    }}>{step.replace(/_/g, " ")}</span>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
                    <button onClick={() => onAssign(o)}
                        style={{ padding: "10px 18px", background: hasRider ? T.white : T.blue, color: hasRider ? T.blue : "#fff", border: hasRider ? `1px solid ${T.blue}` : "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                        <FiTruck size={13} /> {hasRider ? "Reassign" : "Assign"}
                    </button>
                    {!hasRider && (
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                    await api.post(`/admin/orders/${o._id}/start-assignment`);
                                    if (typeof onRefresh === "function") onRefresh();
                                } catch (err) { console.error("Auto-assign failed:", err); }
                            }}
                            style={{ padding: "6px 12px", background: "#fff7ed", color: T.amber, border: `1px solid #fed7aa`, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                        >
                            <FiNavigation size={11} /> Auto-Assign
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminLocalDelivery;
