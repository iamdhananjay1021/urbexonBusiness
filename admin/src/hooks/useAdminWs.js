/**
 * useAdminWs — WebSocket hook for admin panel
 * Auto-connects using adminAuth token, reconnects on disconnect.
 * Returns: { lastMessage, connected }
 * ✅ Production domain support: uses current origin
 */
import { useEffect, useRef, useState, useCallback } from "react";

// Get WebSocket base URL - use current origin in production
const getWSBase = () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000/api";
    // If API URL contains full backend domain, use it; otherwise use current origin
    if (apiUrl.includes("://")) {
        return apiUrl.replace("/api", "").replace("http://", "ws://").replace("https://", "wss://");
    }
    // Production: use current window origin (admin-panel domain)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws_domain = window.location.origin.replace(/^https?:\/\//, "");
    return `${protocol}//${ws_domain}`;
};

const WS_BASE = getWSBase();

export default function useAdminWs(onMessage) {
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const cbRef = useRef(onMessage);
    const mountedRef = useRef(true);
    cbRef.current = onMessage;

    const connect = useCallback(() => {
        if (!mountedRef.current) return;
        try {
            const raw = localStorage.getItem("adminAuth");
            const auth = raw ? JSON.parse(raw) : null;
            if (!auth?.token) return;

            if (wsRef.current && wsRef.current.readyState < 2) return; // already open/connecting

            const tkn = encodeURIComponent(auth.token);
            const basePath = WS_BASE.endsWith("/") ? WS_BASE.slice(0, -1) : WS_BASE;
            const ws = new WebSocket(`${basePath}/ws?token=${tkn}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("[Admin WS] Connected to:", `${basePath}/ws`);
                if (mountedRef.current) setConnected(true);
            };
            ws.onclose = () => {
                if (mountedRef.current) {
                    setConnected(false);
                    reconnectTimer.current = setTimeout(connect, 5000);
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
        return () => {
            mountedRef.current = false;
            clearTimeout(reconnectTimer.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, [connect]);

    return { connected };
}
