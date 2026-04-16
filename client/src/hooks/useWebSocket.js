/**
 * useWebSocket.js — Client-side WebSocket hook
 * Real-time order updates, notifications
 */

import { useEffect, useRef, useCallback, useState } from "react";

// Determine WS URL: use current origin for production, or VITE_WS_URL if set
const getWSBase = () => {
    const envUrl = import.meta.env.VITE_WS_URL;
    if (envUrl) {
        return envUrl.replace("http://", "ws://").replace("https://", "wss://");
    }
    // Production: use current window origin (frontend domain)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws_domain = window.location.origin.replace(/^https?:\/\//, "");
    return `${protocol}//${ws_domain}`;
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
