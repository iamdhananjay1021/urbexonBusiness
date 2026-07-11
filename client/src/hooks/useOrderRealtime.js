import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getProfile } from "../api/authApi";

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
                getProfile().catch(() => { }); // Trigger Axios refresh/logout
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
                } catch { /* malformed SSE payload — event silently ignored */ }
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
                    getProfile().catch(() => { });

                    // BUG FIX: a reconnect was never actually scheduled here —
                    // once the SSE connection errored (a reverse-proxy idle
                    // timeout after ~60s is the common case, but any transient
                    // network blip does it too), order-status updates silently
                    // stopped forever, with no visible sign to the user, until
                    // some unrelated code path happened to change tokenDep
                    // (forcing the effect to re-run). Retry with the same
                    // backoff spirit as the circuit breaker above.
                    clearTimeout(timer);
                    timer = setTimeout(connect, globalSseFailures >= 3 ? 30000 : 3000 * globalSseFailures);
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