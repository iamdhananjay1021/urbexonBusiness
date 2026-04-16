/**
 * useWebSocket.js — Client-side WebSocket hook
 * Real-time order updates, notifications
 */

import { useEffect, useRef, useCallback, useState } from "react";

const WS_BASE = (import.meta.env.VITE_WS_URL || "http://localhost:9000")
    .replace("http://", "ws://")
    .replace("https://", "wss://");

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

        const wsUrl = `${WS_BASE}/ws?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            reconnectCount.current = 0;
            console.log("[WS] Connected");
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
