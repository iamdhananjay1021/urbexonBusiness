/**
 * useAdminWs — WebSocket hook for admin panel
 * Auto-connects using adminAuth token, reconnects on disconnect.
 * Returns: { lastMessage, connected }
 * ✅ Production domain support: explicit VITE_WS_URL + hostname fallback
 */
import { useEffect, useRef, useState, useCallback } from "react";

// WebSocket URL: explicit env var → runtime hostname detection → fallback
const WS_BASE = import.meta.env.VITE_WS_URL
    || (typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "ws://localhost:9000" : "wss://api.urbexon.in");

export default function useAdminWs(onMessage) {
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const cbRef = useRef(onMessage);
    const mountedRef = useRef(true);
    const backoffRef = useRef(3000);
    const retriesRef = useRef(0);
    cbRef.current = onMessage;

    const connect = useCallback(() => {
        if (!mountedRef.current) return;
        if (retriesRef.current >= 15) return;
        if (document.hidden) return;
        try {
            const raw = localStorage.getItem("adminAuth");
            const auth = raw ? JSON.parse(raw) : null;
            if (!auth?.token) return;

            if (wsRef.current && wsRef.current.readyState < 2) return;

            const tkn = encodeURIComponent(auth.token);
            const ws = new WebSocket(`${WS_BASE}/ws?token=${tkn}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("[Admin WS] Connected to:", WS_BASE);
                if (mountedRef.current) setConnected(true);
                backoffRef.current = 3000;
                retriesRef.current = 0;
            };
            ws.onclose = () => {
                if (mountedRef.current) {
                    setConnected(false);
                    if (retriesRef.current < 15) {
                        retriesRef.current++;
                        reconnectTimer.current = setTimeout(connect, backoffRef.current);
                        backoffRef.current = Math.min(backoffRef.current * 2, 60000);
                    }
                }
            };
            ws.onerror = () => ws.close();
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (cbRef.current) cbRef.current(msg);
                } catch { /* ignore non-JSON */ }
            };
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        const onVisChange = () => {
            if (!document.hidden && mountedRef.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
                retriesRef.current = 0;
                backoffRef.current = 3000;
                clearTimeout(reconnectTimer.current);
                connect();
            }
        };
        document.addEventListener("visibilitychange", onVisChange);

        return () => {
            mountedRef.current = false;
            clearTimeout(reconnectTimer.current);
            document.removeEventListener("visibilitychange", onVisChange);
            if (wsRef.current) wsRef.current.close();
        };
    }, [connect]);

    return { connected };
}
