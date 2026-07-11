/**
 * GlobalWebSocket — connects as soon as user is logged in,
 * dispatches window events for any page to listen to.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

const WS_BASE = import.meta.env.VITE_WS_URL
    || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "ws://localhost:9000" : "wss://api.urbexon.in");

// Unlike useWebSocket.js, this always-mounted socket had no pre-flight
// expiry check — a reconnect scheduled while the access token was already
// expired would open a socket doomed to be rejected server-side, then
// retry with the SAME stale token again on the next backoff tick.
const isTokenExpired = (token) => {
    if (!token) return true;
    try {
        const payloadStr = token.split(".")[1];
        if (!payloadStr) return true;
        return JSON.parse(atob(payloadStr)).exp * 1000 <= Date.now();
    } catch {
        return true;
    }
};

export default function GlobalWebSocket() {
    const { token } = useAuth();
    const wsRef = useRef(null);
    const pingRef = useRef(null);
    const reconnectRef = useRef(null);
    const backoffRef = useRef(3000);
    const retriesRef = useRef(0);

    useEffect(() => {
        if (!token) return;

        let mounted = true;

        const connect = () => {
            if (!mounted || retriesRef.current >= 15) return;
            if (document.hidden) return;
            if (isTokenExpired(token)) return; // wait for the access token to be refreshed first

            try {
                const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log("[Client WS] Connected to:", WS_BASE);
                    backoffRef.current = 3000;
                    retriesRef.current = 0;
                    pingRef.current = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
                    }, 25000);
                };

                ws.onmessage = (e) => {
                    try {
                        const msg = JSON.parse(e.data);
                        if (msg.type === "pong" || msg.type === "connected") return;
                        window.dispatchEvent(new CustomEvent("client:ws_message", { detail: msg }));
                        // Forward notification-type messages for NotificationCenter
                        if (msg.type === "notification") {
                            window.dispatchEvent(new CustomEvent("ux-notification", { detail: msg.payload || msg }));
                        }
                    } catch { /* ignore */ }
                };

                ws.onclose = () => {
                    clearInterval(pingRef.current);
                    if (mounted && retriesRef.current < 15) {
                        retriesRef.current++;
                        reconnectRef.current = setTimeout(connect, backoffRef.current);
                        backoffRef.current = Math.min(backoffRef.current * 2, 60000);
                    }
                };

                ws.onerror = () => ws.close();
            } catch (err) {
                console.error("[Client WS] Error:", err);
            }
        };

        const onVisChange = () => {
            if (!document.hidden && mounted && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
                retriesRef.current = 0;
                backoffRef.current = 3000;
                clearTimeout(reconnectRef.current);
                connect();
            }
        };
        document.addEventListener("visibilitychange", onVisChange);

        connect();

        return () => {
            mounted = false;
            clearInterval(pingRef.current);
            clearTimeout(reconnectRef.current);
            document.removeEventListener("visibilitychange", onVisChange);
            wsRef.current?.close();
        };
    }, [token]);

    return null; // renders nothing
}
