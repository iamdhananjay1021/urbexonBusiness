import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";

const getApiBase = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl && !apiUrl.includes("localhost")) return apiUrl;
    if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
        return "https://api.urbexon.in/api";
    }
    return "http://localhost:9000/api";
};

// Module-level circuit breaker (survives React unmount/remount loops)
let globalSseFailures = 0;
let globalSseBlockedUntil = 0;

// Helper: Check if token is expired locally before firing network request
const isTokenExpired = (token) => {
    if (!token) return true;
    try {
        const payloadStr = token.split('.')[1];
        if (!payloadStr) return true;
        const payload = JSON.parse(atob(payloadStr));
        return payload.exp * 1000 <= Date.now();
    } catch {
        return true;
    }
};

export const useOrderRealtime = ({ enabled = true, onStatusUpdate }) => {
    const authContext = useAuth();
    const tokenDep = authContext?.token || null;
    const sourceRef = useRef(null);

    useEffect(() => {
        if (!enabled || !tokenDep) return undefined;

        let isMounted = true;
        let timer = null;

        const connect = () => {
            if (!isMounted) return;

            // 1. Circuit Breaker Guard
            if (Date.now() < globalSseBlockedUntil) {
                return;
            }

            // 2. Pre-flight Expiry Guard (Prevents 401s from reaching network)
            if (isTokenExpired(tokenDep)) {
                console.warn("[OrderRealtime] Token expired locally. Aborting SSE.");
                api.get("/auth/profile").catch(() => { }); // Trigger Axios refresh/logout
                return;
            }

            const url = `${getApiBase()}/orders/stream?token=${encodeURIComponent(tokenDep)}`;
            const source = new EventSource(url);
            sourceRef.current = source;

            source.addEventListener("connected", () => {
                globalSseFailures = 0; // Reset circuit breaker on success
            });

            source.addEventListener("order_status_updated", (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    if (isMounted) onStatusUpdate?.(payload);
                } catch { }
            });

            source.onerror = () => {
                source.close();
                sourceRef.current = null;
                globalSseFailures += 1;

                // Trip circuit breaker for 30s if backend repeatedly rejects
                if (globalSseFailures >= 3) {
                    globalSseBlockedUntil = Date.now() + 30000;
                    console.error("[OrderRealtime] SSE failed repeatedly. Circuit breaker tripped.");
                }

                if (isMounted) {
                    api.get("/auth/profile").catch(() => { });
                }
            };
        };

        // 3. Mount Debounce (Prevents thrashing spam)
        timer = setTimeout(connect, 500);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (sourceRef.current) {
                sourceRef.current.close();
                sourceRef.current = null;
            }
        };
    }, [enabled, tokenDep]);
};