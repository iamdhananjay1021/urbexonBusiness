/**
 * Delivery Partner Dashboard — Production v4.0
 * Urbexon design + real-time WebSocket, FCM push, GPS tracking
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import { G, fmt } from "../utils/theme";
import DeliveryMap from "../components/DeliveryMap";
import { startAlert, stopAlert, playNotification } from "../utils/notificationSound";
import useFcm from "../hooks/useFcm";

/* ── GPS tracking — watchPosition realtime + 15s fallback ── */
const useLocationTracking = (activeOrderId) => {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!activeOrderId || !navigator.geolocation) { setPos(null); return; }
    const sendLocation = (lat, lng) => {
      setPos({ lat, lng });
      api.patch("/delivery/location", { orderId: activeOrderId, lat, lng }).catch(() => { });
    };
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => sendLocation(coords.latitude, coords.longitude),
      () => { },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    const fallbackTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => sendLocation(coords.latitude, coords.longitude),
        () => { },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    }, 15000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(fallbackTimer);
    };
  }, [activeOrderId]);
  return pos;
};

const Dashboard = () => {
  const { rider, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [earningsData, setEarningsData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [status, setStatus] = useState("pending");
  const [notRegistered, setNotRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const wsRef = useRef(null);

  const activeOrder = orders.find(o => o.orderStatus === "OUT_FOR_DELIVERY");
  const riderPos = useLocationTracking(activeOrder?._id);

  const load = useCallback(async () => {
    try {
      const [ordersRes, earningsRes] = await Promise.allSettled([
        api.get("/delivery/orders"),
        api.get("/delivery/earnings"),
      ]);
      if (ordersRes.status === "fulfilled") {
        const d = ordersRes.value.data;
        setOrders(d.orders || []);
        setStats(d.stats || {});
        setIsOnline(d.isOnline || false);
        setStatus(d.status || "pending");
        setNotRegistered(false);
      } else if (ordersRes.reason?.response?.status === 404) {
        setNotRegistered(true);
      }
      if (earningsRes.status === "fulfilled") {
        setEarningsData(earningsRes.value.data);
      }
    } catch (err) {
      console.error("[Dashboard]", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── FCM push notifications ── */
  useFcm({
    onNewOrder: (data) => {
      playNotification();
      load();
      if (data.orderId) {
        setNewOrderAlert({ orderId: data.orderId, amount: data.amount, items: data.items, address: data.address, distanceKm: data.distanceKm, at: new Date() });
        startAlert();
      }
    },
  });

  /* ── WebSocket ── */
  useEffect(() => {
    const authRaw = localStorage.getItem("deliveryAuth");
    const token = authRaw ? JSON.parse(authRaw)?.token : null;
    if (!token) return;

    // WebSocket URL: explicit env var → runtime hostname detection → fallback
    const wsBase = import.meta.env.VITE_WS_URL
      || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "ws://localhost:9000" : "wss://api.urbexon.in");

    let ws, pingInterval, retryTimeout, mounted = true, backoff = 3000, retries = 0;
    const MAX_RETRIES = 15;

    const connect = () => {
      if (!mounted || retries >= MAX_RETRIES) return;
      if (document.hidden) return; // don't connect when tab is hidden
      try {
        ws = new WebSocket(`${wsBase}/ws?token=${token}`);
        wsRef.current = ws;
        ws.onopen = () => {
          console.log("[Delivery WS] Connected to:", wsBase);
          backoff = 3000;
          retries = 0;
          pingInterval = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" })); }, 25000);
        };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "rider:order_request" || msg.type === "new_order_available" || msg.type === "new_delivery_request") {
              const p = msg.payload || {};
              setNewOrderAlert({ orderId: p.orderId, amount: p.amount, items: p.items, address: p.address, distanceKm: p.distanceKm, at: new Date() });
              startAlert();
              load();
            }
            if (msg.type === "rider:order_assigned") { playNotification(); load(); }
          } catch { }
        };
        ws.onclose = () => {
          clearInterval(pingInterval);
          if (mounted && retries < MAX_RETRIES) {
            retries++;
            retryTimeout = setTimeout(connect, backoff);
            backoff = Math.min(backoff * 2, 60000);
          }
        };
        ws.onerror = () => ws.close();
      } catch (err) { console.error("[Delivery WS] Connection error:", err); }
    };

    // Reconnect when tab becomes visible again
    const onVisChange = () => { if (!document.hidden && (!ws || ws.readyState !== WebSocket.OPEN)) { retries = 0; backoff = 3000; clearTimeout(retryTimeout); connect(); } };
    document.addEventListener("visibilitychange", onVisChange);

    connect();
    return () => { mounted = false; clearInterval(pingInterval); clearTimeout(retryTimeout); document.removeEventListener("visibilitychange", onVisChange); stopAlert(); ws?.close(); };
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const { data } = await api.patch("/delivery/toggle-status");
      setIsOnline(data.isOnline);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    } finally { setToggling(false); }
  };

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${G.green100}`, borderTopColor: G.brand, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    </div>
  );

  /* ── Not registered ── */
  if (notRegistered) return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏍️</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: G.text, marginBottom: 6 }}>Delivery Partner Banein!</div>
      <div style={{ fontSize: 13, color: G.textSub, marginBottom: 24, lineHeight: 1.6 }}>
        Aapne abhi delivery partner ke liye apply nahi kiya hai.<br />Apply karein aur deliveries start karein.
      </div>
      <button onClick={() => navigate("/register")} style={{ background: G.navy, color: G.brand, border: "none", borderRadius: 10, padding: "13px 32px", fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: 1 }}>
        Apply Karein →
      </button>
    </div>
  );

  /* ── Pending ── */
  if (status === "pending") return (
    <div style={{ padding: 20 }}>
      <div style={{ background: G.amber50, border: "1px solid #fde68a", borderRadius: 12, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⏳</div>
        <div style={{ fontWeight: 700, color: "#78350f", fontSize: 16 }}>Application Under Review</div>
        <div style={{ fontSize: 13, color: "#92400e", marginTop: 6 }}>Your delivery partner application is pending admin approval.</div>
      </div>
    </div>
  );

  /* ── Rejected ── */
  if (status === "rejected") return (
    <div style={{ padding: 20 }}>
      <div style={{ background: G.red50, border: "1px solid #fecaca", borderRadius: 12, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>❌</div>
        <div style={{ fontWeight: 700, color: "#b91c1c", fontSize: 16 }}>Application Rejected</div>
        <div style={{ fontSize: 13, color: "#991b1b", marginTop: 6 }}>Please contact support for more information.</div>
      </div>
    </div>
  );

  const todayOrders = earningsData?.todayDeliveries ?? stats?.today ?? 0;
  const todayEarnings = earningsData?.todayEarnings ?? stats?.earnings ?? 0;
  const rating = earningsData?.rating ?? stats?.rating ?? 0;
  const assignedCount = orders.filter(o => ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "CONFIRMED", "PACKED"].includes(o.orderStatus) && o.delivery?.assignedTo).length;

  return (
    <div style={{ animation: "slideUp .25s ease" }}>
      {/* ── New Order Alert ── */}
      {newOrderAlert && (
        <div style={{ background: `linear-gradient(135deg,${G.navy},#1e293b)`, color: G.white, padding: "14px var(--px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, animation: "slideDown .3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: G.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, animation: "pulseGreen 2s infinite" }}>🔔</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Naya Order Aaya!</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", marginTop: 1 }}>
                {newOrderAlert.items} items • {fmt(newOrderAlert.amount)}
                {newOrderAlert.distanceKm ? ` • ${newOrderAlert.distanceKm} km` : ""}
              </div>
            </div>
          </div>
          <button onClick={() => { setNewOrderAlert(null); stopAlert(); navigate("/orders"); }} style={{ background: G.brand, border: "none", borderRadius: 8, padding: "7px 14px", color: G.white, cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>View</button>
          <button onClick={() => { setNewOrderAlert(null); stopAlert(); }} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, padding: 6, color: G.white, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* ── Online / Offline ── */}
      <div style={{ padding: "16px var(--px) 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: G.textSub }}>You are</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: isOnline ? G.brand : G.textSub, marginTop: 2 }}>
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
        <button
          onClick={toggleOnline}
          disabled={toggling}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: toggling ? "not-allowed" : "pointer", border: "none", background: isOnline ? "#dc2626" : G.brand, color: G.white, opacity: toggling ? 0.6 : 1 }}
        >
          {toggling ? "..." : isOnline ? "Go Offline" : "Go Online"}
        </button>
      </div>

      {/* ── Today's Summary ── */}
      <div style={{ margin: "0 var(--px)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Today's Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden" }}>
          {[
            { label: "Orders", value: todayOrders, green: false },
            { label: "Earned", value: fmt(todayEarnings), green: true },
            { label: "Rating", value: rating ? `${Number(rating).toFixed(1)} ⭐` : "—", green: false },
          ].map((s, i) => (
            <div key={i} style={{ padding: "16px 12px", borderRight: i < 2 ? `1px solid ${G.border}` : "none" }}>
              <div style={{ fontSize: 11, color: G.textSub, marginBottom: 4 }}>{s.label}</div>
              <div className="ud-stat-val" style={{ fontSize: 22, fontWeight: 800, color: s.green ? G.brand : G.text }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Current Order ── */}
      {activeOrder && (
        <div style={{ margin: "16px var(--px) 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Current Order</div>
          <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, background: G.white, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 12px", background: "#f9fafb", borderBottom: `1px solid ${G.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>Order #{activeOrder._id.slice(-7).toUpperCase()}</div>
                <div style={{ fontSize: 11, color: G.textSub, marginTop: 2 }}>{activeOrder.items?.length} items • {fmt(activeOrder.totalAmount)}</div>
              </div>
              <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#fff3e0", color: "#e65100" }}>In Delivery</span>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: G.text, marginBottom: 8 }}>{activeOrder.customerName}</div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4, fontSize: 13, color: G.textSub }}>
                <span>📍</span><span>{activeOrder.address}</span>
              </div>
              {activeOrder.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 13, color: G.textSub }}>
                  <span>📞</span><span>{activeOrder.phone}</span>
                </div>
              )}
              {activeOrder.distanceFromRider != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: G.textSub }}>
                  <span>✈️</span><span>{activeOrder.distanceFromRider} km away</span>
                </div>
              )}

              {/* Live Map */}
              {riderPos ? (
                <div style={{ borderRadius: 8, overflow: "hidden", marginTop: 12, border: `1px solid ${G.border}` }}>
                  <DeliveryMap
                    myLat={riderPos.lat}
                    myLng={riderPos.lng}
                    destLat={activeOrder.latitude || activeOrder.deliveryAddress?.lat}
                    destLng={activeOrder.longitude || activeOrder.deliveryAddress?.lng}
                    destLabel={activeOrder.address || "Customer"}
                    height={140}
                  />
                  <div style={{ padding: "6px 12px", fontSize: 10, color: G.green600, background: "#f9fafb", display: "flex", justifyContent: "space-between" }}>
                    <span>📍 Live Tracking Active</span>
                    <span style={{ fontWeight: 700, color: "#059669" }}>● GPS ON</span>
                  </div>
                </div>
              ) : (
                <div style={{ height: 100, background: "linear-gradient(135deg, #e8f5e9, #f1f8e9)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24 }}>🗺️</div>
                    <div style={{ fontSize: 10, color: G.green600, fontWeight: 700, marginTop: 4 }}>Acquiring GPS…</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: "0 var(--px) 14px" }}>
              <button onClick={() => navigate("/orders")} style={{ border: "none", borderRadius: 8, width: "100%", padding: "13px 20px", background: G.brand, color: G.white, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                View Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div style={{ margin: "16px var(--px) 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Quick Actions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={() => navigate("/orders")} style={{ border: `1px solid ${G.border}`, borderRadius: 12, padding: "18px 16px", cursor: "pointer", background: G.white, display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>Active Orders</div>
            <div style={{ fontSize: 11, color: G.textSub }}>{assignedCount} pending</div>
          </button>
          <button onClick={() => navigate("/earnings")} style={{ border: `1px solid ${G.border}`, borderRadius: 12, padding: "18px 16px", cursor: "pointer", background: G.white, display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
            <span style={{ fontSize: 20 }}>💰</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>My Earnings</div>
            <div style={{ fontSize: 11, color: G.textSub }}>{fmt(todayEarnings)} today</div>
          </button>
        </div>
      </div>

      {/* ── Spacer ── */}
      <div style={{ height: 20 }} />
    </div>
  );
};

export default Dashboard;
