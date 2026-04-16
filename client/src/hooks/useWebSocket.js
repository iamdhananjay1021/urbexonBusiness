/**
 * useWebSocket.js — Client-side WebSocket hook
 * Real-time order updates, notifications
 */

import { useEffect, useRef, useCallback, useState } from "react";

// Determine WS URL: production → api.urbexon.in, dev → localhost:9000
const getWSBase = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    // If explicit API URL and NOT localhost, derive WS from it
    if (apiUrl && !apiUrl.includes("localhost")) {
        return apiUrl.replace("/api", "").replace("http://", "ws://").replace("https://", "wss://");
    }
    // Runtime detection: if browser is on production domain, use api.urbexon.in
    if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
        return "wss://api.urbexon.in";
    }
    // Local dev fallback
    return "ws://localhost:9000";
};

const WS_BASE = getWSBase();

export const useWebSocket = (token, { onMessage, onConnect, onDisconnect } = {}) => {
    const wsRef = useRef(null);
    const pingRef = useRef(null);
    const reconnectRef = useRef(null);
    const reconnectCount = useRef(0);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);

    const connect = useCallback(() => {
        if (!token) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        // Construct WebSocket URL: ensure clean path without duplication
        const basePath = WS_BASE.endsWith("/") ? WS_BASE.slice(0, -1) : WS_BASE;
        const wsUrl = `${basePath}/ws?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            reconnectCount.current = 0;
            console.log(`[Client WS] Connected to: ${basePath}/ws`);
            onConnect?.();

            // Ping every 25s to keep alive
            pingRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 25000);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "pong") return; // ignore pings
                setLastMessage(data);
                onMessage?.(data);
            } catch { /* ignore */ }
        };

        ws.onclose = () => {
            setIsConnected(false);
            clearInterval(pingRef.current);
            onDisconnect?.();

            // Auto reconnect with backoff (max 30s)
            if (reconnectCount.current < 10) {
                const delay = Math.min(1000 * 2 ** reconnectCount.current, 30000);
                reconnectCount.current++;
                reconnectRef.current = setTimeout(connect, delay);
            }
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [token, onMessage, onConnect, onDisconnect]);

    const disconnect = useCallback(() => {
        clearInterval(pingRef.current);
        clearTimeout(reconnectRef.current);
        wsRef.current?.close();
        wsRef.current = null;
        reconnectCount.current = 99; // prevent reconnect
    }, []);

    const send = useCallback((type, payload = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, payload }));
        }
    }, []);

    useEffect(() => {
        if (token) connect();
        return disconnect;
    }, [token]);

    return { isConnected, lastMessage, send, disconnect };
};

export default useWebSocket;
