/**
 * useDeliveryWs.js — the one WebSocket connection primitive for the
 * delivery rider app.
 *
 * Previously Dashboard.jsx and ActiveOrders.jsx each independently
 * reimplemented ~90 lines of identical connect/reconnect/backoff/ping/
 * visibility-change logic, differing only in what each did with an
 * incoming message. This hook owns the connection; the caller supplies an
 * `onMessage(msg)` callback for its own page-specific handling — nothing
 * about the reconnect mechanics needs to be duplicated again.
 *
 * The connection effect intentionally has an empty dependency array and
 * always calls the *latest* onMessage via a ref, so passing a new inline
 * callback on every render (as both pages do) never tears down and
 * reconnects the socket.
 */
import { useEffect, useRef } from "react";

const MAX_RETRIES = 15;

export const useDeliveryWs = (onMessage) => {
    const wsRef = useRef(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        const authRaw = localStorage.getItem("deliveryAuth");
        const token = authRaw ? JSON.parse(authRaw)?.token : null;
        if (!token) return;

        // WebSocket URL: explicit env var → runtime hostname detection → fallback
        const wsBase = import.meta.env.VITE_WS_URL
            || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
                ? "ws://localhost:9000" : "wss://api.urbexon.in");

        let ws, pingInterval, retryTimeout, mounted = true, backoff = 3000, retries = 0;

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
                        onMessageRef.current?.(msg);
                    } catch { /* ignore malformed frame */ }
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
        return () => {
            mounted = false;
            clearInterval(pingInterval);
            clearTimeout(retryTimeout);
            document.removeEventListener("visibilitychange", onVisChange);
            ws?.close();
        };
    }, []);

    return wsRef;
};

export default useDeliveryWs;
