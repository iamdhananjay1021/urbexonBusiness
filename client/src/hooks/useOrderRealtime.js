import { useEffect, useRef } from "react";

const getApiBase = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl && !apiUrl.includes("localhost")) return apiUrl;
    if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
        return "https://api.urbexon.in/api";
    }
    return "http://localhost:9000/api";
};

export const useOrderRealtime = ({ enabled = true, onStatusUpdate }) => {
    const retryRef = useRef(null);
    const sourceRef = useRef(null);
    // FIX: track consecutive failures to stop infinite 401 loop
    const failCountRef = useRef(0);
    const MAX_RETRIES = 5;

    useEffect(() => {
        if (!enabled) return undefined;

        const authRaw = localStorage.getItem("auth");
        const token = authRaw ? JSON.parse(authRaw)?.token : null;

        // FIX: if no token at all, don't even try to connect
        if (!token) return undefined;

        const connect = () => {
            // FIX: stop retrying after MAX_RETRIES consecutive failures
            // This prevents the infinite 401 loop seen in console
            if (failCountRef.current >= MAX_RETRIES) {
                console.warn("[OrderRealtime] Max retries reached — stopping SSE reconnect");
                return;
            }

            const url = `${getApiBase()}/orders/stream?token=${encodeURIComponent(token)}`;
            const source = new EventSource(url);
            sourceRef.current = source;

            source.addEventListener("connected", () => {
                // FIX: reset fail count on successful connection
                failCountRef.current = 0;
            });

            source.addEventListener("order_status_updated", (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    onStatusUpdate?.(payload);
                } catch {
                    // ignore invalid payload
                }
            });

            source.onerror = () => {
                source.close();
                sourceRef.current = null;
                failCountRef.current += 1;

                // FIX: if we've hit max retries, stop — no more reconnect attempts
                if (failCountRef.current >= MAX_RETRIES) {
                    console.warn("[OrderRealtime] SSE failed too many times — stopped retrying");
                    return;
                }

                // Exponential backoff: 3s, 6s, 12s, 24s, 48s
                const delay = Math.min(3000 * Math.pow(2, failCountRef.current - 1), 48000);
                retryRef.current = setTimeout(connect, delay);
            };
        };

        connect();

        return () => {
            clearTimeout(retryRef.current);
            sourceRef.current?.close();
            sourceRef.current = null;
        };
    }, [enabled]); // FIX: onStatusUpdate removed from deps — it causes reconnect on every render
};