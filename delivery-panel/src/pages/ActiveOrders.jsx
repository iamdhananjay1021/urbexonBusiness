/**
 * ActiveOrders — Production v4.0
 * Urbexon design + real-time WebSocket, FCM, GPS, OTP, status flow
 */
import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import { G, fmt, fmtDate } from "../utils/theme";
import DeliveryMap from "../components/DeliveryMap";
import { startAlert, stopAlert, playNotification } from "../utils/notificationSound";
import useFcm from "../hooks/useFcm";

/* ── GPS tracking ── */
const useLocationTracking = (activeOrderId) => {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!activeOrderId) { setPos(null); return; }
    const send = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setPos({ lat: coords.latitude, lng: coords.longitude });
          api.patch("/delivery/location", { orderId: activeOrderId, lat: coords.latitude, lng: coords.longitude }).catch(() => { });
        },
        () => { },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    };
    send();
    const t = setInterval(send, 10000);
    return () => clearInterval(t);
  }, [activeOrderId]);
  return pos;
};

const STATUS_BADGE = {
  PLACED: { bg: "#fef3c7", color: "#78350f", label: "New" },
  CONFIRMED: { bg: "#dbeafe", color: "#1d4ed8", label: "Confirmed" },
  PACKED: { bg: "#ede9fe", color: "#5b21b6", label: "Packed" },
  READY_FOR_PICKUP: { bg: "#fef9c3", color: "#854d0e", label: "Ready to Pick" },
  OUT_FOR_DELIVERY: { bg: "#fff3e0", color: "#e65100", label: "In Delivery" },
  DELIVERED: { bg: G.green100, color: "#065f46", label: "Delivered" },
};

const DELIVERY_STEPS = ["ASSIGNED", "ARRIVING_VENDOR", "PICKED_UP", "OUT_FOR_DELIVERY"];
const STEP_LABELS = { ASSIGNED: "Assigned", ARRIVING_VENDOR: "Heading to Store", PICKED_UP: "Picked Up", OUT_FOR_DELIVERY: "On the Way" };

const ActiveOrders = () => {
  const [tab, setTab] = useState("available");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otpMap, setOtpMap] = useState({});
  const [working, setWorking] = useState({});
  const [newAlert, setNewAlert] = useState(null);
  const [orderRequest, setOrderRequest] = useState(null);
  const countdownRef = useRef(null);
  const wsRef = useRef(null);

  const activeOrder = orders.find(o => o.orderStatus === "OUT_FOR_DELIVERY");
  const riderPos = useLocationTracking(activeOrder?._id);

  /* ── FCM ── */
  useFcm({
    onNewOrder: (data) => {
      if (data.accepted) { load(); return; }
      setNewAlert({ orderId: data.orderId, amount: data.amount, items: data.items, distanceKm: data.distanceKm, address: data.address, at: new Date() });
      startAlert();
      load();
      setTab("available");
    },
  });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/delivery/orders");
      setOrders(data.orders || []);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  /* ── Countdown timer for order request ── */
  const startCountdown = useCallback((seconds) => {
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setOrderRequest(prev => {
        if (!prev) { clearInterval(countdownRef.current); return null; }
        const remaining = prev.remainingSec - 1;
        if (remaining <= 0) { clearInterval(countdownRef.current); stopAlert(); return null; }
        return { ...prev, remainingSec: remaining };
      });
    }, 1000);
  }, []);

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
      if (document.hidden) return;
      try {
        ws = new WebSocket(`${wsBase}/ws?token=${token}`);
        wsRef.current = ws;
        ws.onopen = () => { console.log("[Delivery WS] Connected to:", wsBase); backoff = 3000; retries = 0; pingInterval = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" })); }, 25000); };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "rider:order_request") {
              const p = msg.payload || {};
              const timeoutSec = p.timeout || 30;
              setOrderRequest({ orderId: p.orderId, amount: p.amount, items: p.items, address: p.address, distanceKm: p.distanceKm, customerName: p.customerName, timeout: timeoutSec, remainingSec: timeoutSec });
              startAlert();
              startCountdown(timeoutSec);
              setTab("available");
              load();
            }
            if (msg.type === "rider:offer_expired" && msg.payload?.orderId === orderRequest?.orderId) {
              setOrderRequest(null); clearInterval(countdownRef.current); stopAlert();
            }
            if (msg.type === "rider:order_taken") {
              if (msg.payload?.orderId === orderRequest?.orderId) { setOrderRequest(null); clearInterval(countdownRef.current); stopAlert(); }
              load();
            }
            if (msg.type === "rider:order_assigned") { playNotification(); load(); }
            if (msg.type === "new_delivery_request" || msg.type === "new_order_available") {
              const p = msg.payload || {};
              setNewAlert({ orderId: p.orderId, amount: p.amount, items: p.items, address: p.address, distanceKm: p.distanceKm, at: new Date() });
              startAlert(); load(); setTab("available");
            }
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

    const onVisChange = () => { if (!document.hidden && (!ws || ws.readyState !== WebSocket.OPEN)) { retries = 0; backoff = 3000; clearTimeout(retryTimeout); connect(); } };
    document.addEventListener("visibilitychange", onVisChange);

    connect();
    return () => { mounted = false; clearInterval(pingInterval); clearTimeout(retryTimeout); document.removeEventListener("visibilitychange", onVisChange); clearInterval(countdownRef.current); stopAlert(); ws?.close(); };
  }, [load, startCountdown]);

  const dismissAlert = () => { setNewAlert(null); stopAlert(); };

  const doAction = async (orderId, action, body = {}) => {
    setWorking(p => ({ ...p, [orderId]: true }));
    try {
      if (action === "accept") {
        await api.patch(`/delivery/orders/${orderId}/accept`);
        if (orderRequest?.orderId === orderId) { setOrderRequest(null); clearInterval(countdownRef.current); stopAlert(); }
      }
      if (action === "reject") {
        await api.patch(`/delivery/orders/${orderId}/reject`);
        if (orderRequest?.orderId === orderId) { setOrderRequest(null); clearInterval(countdownRef.current); stopAlert(); }
      }
      if (action === "cancel") await api.patch(`/delivery/orders/${orderId}/cancel`, { reason: body.reason || "Rider cancelled" });
      if (action === "status") await api.patch(`/delivery/orders/${orderId}/status`, { status: body.status });
      if (action === "pickup") await api.patch(`/delivery/orders/${orderId}/pickup`);
      if (action === "deliver") await api.patch(`/delivery/orders/${orderId}/deliver`, { otp: body.otp });
      playNotification();
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Action failed");
    } finally { setWorking(p => ({ ...p, [orderId]: false })); }
  };

  const getStepIndex = (s) => DELIVERY_STEPS.indexOf(s);

  const filtered = orders.filter(o => {
    if (tab === "available") return o.orderStatus === "READY_FOR_PICKUP" && !o.delivery?.assignedTo;
    if (tab === "active") return ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "CONFIRMED", "PACKED"].includes(o.orderStatus) && !!o.delivery?.assignedTo;
    if (tab === "done") return o.orderStatus === "DELIVERED";
    return true;
  });

  const counts = {
    available: orders.filter(o => o.orderStatus === "READY_FOR_PICKUP" && !o.delivery?.assignedTo).length,
    active: orders.filter(o => ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "CONFIRMED", "PACKED"].includes(o.orderStatus) && !!o.delivery?.assignedTo).length,
    done: orders.filter(o => o.orderStatus === "DELIVERED").length,
  };

  const TABS = [
    { key: "available", label: `Available (${counts.available})`, icon: "📦" },
    { key: "active", label: `Active (${counts.active})`, icon: "🏍️" },
    { key: "done", label: `Delivered (${counts.done})`, icon: "✅" },
  ];

  return (
    <div style={{ padding: "0 0 16px", animation: "slideUp .25s ease" }}>
      {/* ── New Order Alert Banner ── */}
      {newAlert && (
        <div style={{ background: `linear-gradient(135deg,${G.navy},#1e293b)`, color: G.white, padding: "14px var(--px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, animation: "slideDown .3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: G.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, animation: "pulseGreen 2s infinite" }}>🔔</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Naya Order Aaya!</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", marginTop: 1 }}>
                {newAlert.items} items • {fmt(newAlert.amount)}{newAlert.distanceKm ? ` • ${newAlert.distanceKm} km` : ""}
              </div>
              {newAlert.address && <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 1 }}>{newAlert.address}</div>}
            </div>
          </div>
          <button onClick={dismissAlert} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, padding: "6px 10px", color: G.white, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕ Dismiss</button>
        </div>
      )}

      {/* ── Page Head ── */}
      <div style={{ padding: "20px var(--px) 4px" }}>
        <div className="ud-page-title" style={{ fontSize: 20, fontWeight: 800, color: G.text }}>Active Orders</div>
        <div style={{ fontSize: 13, color: G.textSub, marginTop: 2 }}>
          {counts.active + counts.available} orders in queue
          <span style={{ color: G.brand, fontWeight: 700, marginLeft: 8 }}>● Online</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 8, padding: "12px var(--px) 0", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === "available") dismissAlert(); }}
            style={{
              padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: tab === t.key ? "none" : `1.5px solid ${G.border}`,
              background: tab === t.key ? G.navy : G.white,
              color: tab === t.key ? G.brand : G.textSub,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ width: 24, height: 24, border: `3px solid ${G.green100}`, borderTopColor: G.brand, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, color: G.textMuted }}>Loading…</div>
        </div>
      ) : (
        <>
          {/* ── Incoming Order Request (Zomato-style countdown) ── */}
          {orderRequest && tab === "available" && (
            <div style={{ margin: "12px var(--px) 0", background: `linear-gradient(135deg,${G.navy},#1e293b)`, border: `2px solid ${G.brand}`, borderRadius: 16, padding: 20, color: G.white, animation: "slideDown .3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>🔔 New Delivery Request!</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: G.navy, color: G.brand, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 800, fontFamily: "monospace" }}>
                  ⏱ {orderRequest.remainingSec}s
                </div>
              </div>
              <div style={{ width: "100%", background: "rgba(255,255,255,.15)", borderRadius: 4, height: 4, marginBottom: 14 }}>
                <div style={{ height: 4, background: G.brand, borderRadius: 2, transition: "width 1s linear", width: `${(orderRequest.remainingSec / orderRequest.timeout) * 100}%` }} />
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>Amount</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: G.brand }}>{fmt(orderRequest.amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>Items</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{orderRequest.items || "—"}</div>
                </div>
                {orderRequest.distanceKm && (
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>Distance</div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{orderRequest.distanceKm} km</div>
                  </div>
                )}
              </div>
              {orderRequest.address && <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginBottom: 6 }}>📍 {orderRequest.address}</div>}
              {orderRequest.customerName && <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginBottom: 14 }}>Customer: {orderRequest.customerName}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => doAction(orderRequest.orderId, "accept")}
                  disabled={working[orderRequest.orderId]}
                  style={{ flex: 1, padding: "14px 20px", border: "none", borderRadius: 8, background: G.navy, color: G.brand, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, animation: "pulseGreen 2s infinite" }}
                >
                  🏍️ {working[orderRequest.orderId] ? "Accepting…" : "Accept ✓"}
                </button>
                <button
                  onClick={() => doAction(orderRequest.orderId, "reject")}
                  disabled={working[orderRequest.orderId]}
                  style={{ padding: "14px 20px", border: "1.5px solid #ef4444", borderRadius: 8, background: "rgba(239,68,68,.15)", color: "#ef4444", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  ⏭ Skip
                </button>
              </div>
            </div>
          )}

          {/* ── Empty State ── */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", margin: "12px var(--px) 0", background: G.white, borderRadius: 12, border: `1px solid ${G.border}` }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>
                {tab === "available" ? "📭" : tab === "active" ? "🏍️" : "✅"}
              </div>
              <div style={{ fontWeight: 600, color: G.textSub, marginBottom: 4 }}>
                {tab === "available" ? "No orders available" : tab === "active" ? "No active deliveries" : "No delivered orders yet"}
              </div>
              <div style={{ fontSize: 12, color: G.textMuted }}>
                {tab === "available" ? "Stay online! Orders will come in." : ""}
              </div>
            </div>
          ) : (
            /* ── Order Cards ── */
            filtered.map(order => {
              const sb = STATUS_BADGE[order.orderStatus] || { bg: "#f1f5f9", color: "#475569", label: order.orderStatus };
              const isWorking = working[order._id];

              return (
                <div key={order._id} className="ud-order-card" style={{ margin: "12px var(--px) 0", border: `1px solid ${G.border}`, borderRadius: 12, background: G.white, overflow: "hidden", animation: "slideUp .25s ease" }}>
                  {/* Card Header */}
                  <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${G.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: G.text }}>Order #{(order._id || "").slice(-6).toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>{fmtDate(order.createdAt)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {order.distanceFromRider != null && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: G.blue50, color: G.blue600, padding: "3px 9px", borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                          🛤️ {order.distanceFromRider} km
                        </span>
                      )}
                      {order.delivery?.distanceKm > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: G.amber50, color: G.amber600, padding: "3px 9px", borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                          🕐 {order.delivery.distanceKm.toFixed(1)} km
                        </span>
                      )}
                      <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: G.text }}>{fmt(order.totalAmount)}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: G.text, marginBottom: 8 }}>{order.customerName}</div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 13, color: G.textSub }}>
                      <span style={{ marginTop: 1 }}>📍</span><span style={{ lineHeight: 1.5 }}>{order.address}</span>
                    </div>
                    {order.phone && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13, color: G.textSub }}>
                        <span>📞</span><span>{order.phone}</span>
                      </div>
                    )}

                    {/* Items summary */}
                    <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 13px", marginTop: 8, fontSize: 12, color: G.textSub }}>
                      {(order.items || []).map((item, i) => (
                        <div key={i} style={{ marginBottom: 2 }}>{item.qty || item.quantity}× {item.name} <span style={{ color: G.textMuted }}>({fmt(item.price)})</span></div>
                      ))}
                      <div style={{ borderTop: `1px solid ${G.border}`, paddingTop: 6, marginTop: 6, fontWeight: 700, color: G.text, display: "flex", justifyContent: "space-between" }}>
                        <span>Payment: {order.payment?.method || "COD"}</span>
                        <span>{fmt(order.totalAmount)}</span>
                      </div>
                    </div>

                    {/* Live Map (for active delivery order) */}
                    {tab === "active" && riderPos && order._id === activeOrder?._id && (
                      <div style={{ borderRadius: 8, overflow: "hidden", marginTop: 12, border: `1px solid ${G.border}` }}>
                        <DeliveryMap
                          myLat={riderPos.lat}
                          myLng={riderPos.lng}
                          destLat={order.latitude || order.deliveryAddress?.lat}
                          destLng={order.longitude || order.deliveryAddress?.lng}
                          destLabel={order.address || "Customer"}
                          height={180}
                        />
                        <div style={{ padding: "6px 12px", fontSize: 10, color: G.textSub, background: "#f9fafb", display: "flex", justifyContent: "space-between" }}>
                          <span>📍 Live Tracking Active</span>
                          <span style={{ color: "#059669", fontWeight: 700 }}>● GPS ON</span>
                        </div>
                      </div>
                    )}

                    {/* Delivery Status Flow */}
                    {tab === "active" && order.delivery?.status && (
                      <div style={{ display: "flex", gap: 4, marginTop: 12, flexWrap: "wrap" }}>
                        {DELIVERY_STEPS.map((step, i) => {
                          const currentIdx = getStepIndex(order.delivery.status);
                          const isDone = i < currentIdx;
                          const isActive = i === currentIdx;
                          return (
                            <span key={step} style={{
                              padding: "4px 10px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                              background: isActive ? G.brand : isDone ? G.green100 : "#f8fafc",
                              color: isActive ? G.white : isDone ? "#065f46" : G.textMuted,
                              border: `1px solid ${isActive ? G.brand : isDone ? "#86efac" : G.border}`,
                            }}>
                              {STEP_LABELS[step]}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* OTP Delivery Confirmation */}
                    {tab === "active" && (order.delivery?.status === "OUT_FOR_DELIVERY" || order.orderStatus === "OUT_FOR_DELIVERY") && (
                      <div style={{ background: G.green50, border: `1.5px solid ${G.green100}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: G.green600, marginBottom: 4 }}>🔒 Enter OTP to confirm delivery</div>
                        <p style={{ fontSize: 11, color: G.textSub, marginBottom: 8 }}>Get 4-digit OTP from customer</p>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="● ● ● ●"
                          value={otpMap[order._id] || ""}
                          onChange={e => setOtpMap(p => ({ ...p, [order._id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                          style={{ width: "100%", padding: 12, border: `2px solid ${G.border}`, borderRadius: 8, fontFamily: "monospace", fontSize: 20, fontWeight: 700, letterSpacing: 8, textAlign: "center", outline: "none", marginBottom: 10 }}
                          onFocus={e => { e.target.style.borderColor = G.brand; }}
                          onBlur={e => { e.target.style.borderColor = G.border; }}
                        />
                        <button
                          disabled={!otpMap[order._id] || otpMap[order._id].length < 4 || isWorking}
                          onClick={() => doAction(order._id, "deliver", { otp: otpMap[order._id] })}
                          style={{ width: "100%", padding: "13px 20px", border: "none", borderRadius: 8, background: G.brand, color: G.white, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: (!otpMap[order._id] || otpMap[order._id].length < 4 || isWorking) ? 0.5 : 1 }}
                        >
                          {isWorking ? "Verifying…" : "✓ Confirm Delivery"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div style={{ padding: "0 16px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {order.phone && (
                      <a href={`tel:${order.phone}`} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: G.green50, color: "#15803d", border: `1.5px solid #86efac`, display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                        📞 Call
                      </a>
                    )}

                    {tab === "available" && (
                      <button onClick={() => doAction(order._id, "accept")} disabled={isWorking} style={{ flex: 1, padding: "10px 18px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: G.navy, color: G.brand, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isWorking ? 0.6 : 1 }}>
                        🏍️ {isWorking ? "Accepting…" : "Accept Order"}
                      </button>
                    )}

                    {tab === "active" && order.delivery?.status === "ASSIGNED" && (
                      <button onClick={() => doAction(order._id, "status", { status: "ARRIVING_VENDOR" })} disabled={isWorking} style={{ flex: 1, padding: "10px 18px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: G.blue600, color: G.white, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isWorking ? 0.6 : 1 }}>
                        🏪 {isWorking ? "Updating…" : "Heading to Store"}
                      </button>
                    )}

                    {tab === "active" && order.delivery?.status === "ARRIVING_VENDOR" && (
                      <button onClick={() => doAction(order._id, "pickup")} disabled={isWorking} style={{ flex: 1, padding: "10px 18px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: G.blue600, color: G.white, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isWorking ? 0.6 : 1 }}>
                        📦 {isWorking ? "Updating…" : "Picked Up from Store"}
                      </button>
                    )}

                    {tab === "active" && order.delivery?.status === "PICKED_UP" && (
                      <button onClick={() => doAction(order._id, "status", { status: "OUT_FOR_DELIVERY" })} disabled={isWorking} style={{ flex: 1, padding: "10px 18px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: G.brand, color: G.white, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isWorking ? 0.6 : 1 }}>
                        🚚 {isWorking ? "Updating…" : "Start Delivery"}
                      </button>
                    )}

                    {/* Cancel for early status orders */}
                    {tab === "active" && order.delivery?.status && ["ASSIGNED", "ARRIVING_VENDOR"].includes(order.delivery.status) && (
                      <button
                        onClick={() => { if (window.confirm("Cancel this delivery? Order will be reassigned.")) doAction(order._id, "cancel"); }}
                        disabled={isWorking}
                        style={{ padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(239,68,68,.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,.3)" }}
                      >
                        ✕ {isWorking ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
};

export default ActiveOrders;
