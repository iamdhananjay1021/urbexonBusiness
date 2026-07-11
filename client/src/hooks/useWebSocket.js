/**
 * useWebSocket.js — Client-side WebSocket hook
 * Real-time order updates, notifications
 */

import { useEffect, useRef, useCallback, useState } from "react";

// WebSocket URL: explicit env var → runtime hostname detection → fallback
const WS_BASE = import.meta.env.VITE_WS_URL
    || (typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "ws://localhost:9000" : "wss://api.urbexon.in");

// Module-level circuit breaker
let globalWsFailures = 0;
let globalWsBlockedUntil = 0;

const isTokenExpired = (token) => {
    if (!token) return true;
    try {
        const payloadStr = token.split('.')[1];
        if (!payloadStr) return true;
        return JSON.parse(atob(payloadStr)).exp * 1000 <= Date.now();
    } catch {
        return true;
    }
};

export const useWebSocket = (token, { onMessage, onConnect, onDisconnect } = {}) => {
    const wsRef = useRef(null);
    const pingRef = useRef(null);
    const reconnectRef = useRef(null);
    const intentionalCloseRef = useRef(false);
    const backoffRef = useRef(3000);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);

    // BUG FIX: callers overwhelmingly pass inline arrow functions for
    // onMessage/onConnect/onDisconnect (a new identity every render). The
    // socket's event handlers are set up once, inside connect() — without
    // this ref indirection they'd keep calling whichever closure existed
    // at connect() time, silently going stale on every subsequent render
    // (any state/props referenced inside the caller's callback would be
    // frozen at connection time). Refs always resolve to the latest
    // version, and — as a bonus — connect() no longer needs to be
    // recreated when these callbacks change identity.
    const onMessageRef = useRef(onMessage);
    const onConnectRef = useRef(onConnect);
    const onDisconnectRef = useRef(onDisconnect);
    useEffect(() => {
        onMessageRef.current = onMessage;
        onConnectRef.current = onConnect;
        onDisconnectRef.current = onDisconnect;
    }, [onMessage, onConnect, onDisconnect]);

    const connect = useCallback(() => {
        if (!token) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        if (document.hidden) return;

        if (Date.now() < globalWsBlockedUntil) return;
        if (isTokenExpired(token)) return;

        const wsUrl = `${WS_BASE}/ws?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            globalWsFailures = 0;
            backoffRef.current = 3000;
            console.log(`[Client WS] Connected to: ${WS_BASE}`);
            onConnectRef.current?.();

            pingRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 25000);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "pong") return;
                setLastMessage(data);
                onMessageRef.current?.(data);
            } catch { /* ignore */ }
        };

        ws.onclose = () => {
            setIsConnected(false);
            clearInterval(pingRef.current);
            wsRef.current = null;
            onDisconnectRef.current?.();

            if (intentionalCloseRef.current) {
                intentionalCloseRef.current = false;
                return; // Component unmounted, don't trigger reconnect
            }

            globalWsFailures += 1;
            if (globalWsFailures >= 5) globalWsBlockedUntil = Date.now() + 30000;

            if (globalWsFailures < 15 && Date.now() >= globalWsBlockedUntil) {
                const delay = backoffRef.current;
                backoffRef.current = Math.min(delay * 2, 60000);
                reconnectRef.current = setTimeout(connect, delay);
            }
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [token]);

    const disconnect = useCallback(() => {
        intentionalCloseRef.current = true;
        clearInterval(pingRef.current);
        clearTimeout(reconnectRef.current);
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const send = useCallback((type, payload = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, payload }));
        }
    }, []);

    useEffect(() => {
        let timer = null;
        if (token) {
            // Debounce mount to prevent React thrashing
            timer = setTimeout(connect, 500);
        }

        // Reconnect when tab becomes visible
        const onVisChange = () => {
            if (!document.hidden && token && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
                globalWsFailures = 0;
                backoffRef.current = 3000;
                clearTimeout(reconnectRef.current);
                connect();
            }
        };
        document.addEventListener("visibilitychange", onVisChange);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisChange);
            disconnect();
        };
    }, [token]);

    return { isConnected, lastMessage, send, disconnect };
};

export default useWebSocket;
