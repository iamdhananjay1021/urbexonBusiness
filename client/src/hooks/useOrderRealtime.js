import { useEffect, useRef } from "react";

const getApiBase = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl && !apiUrl.includes("localhost")) return apiUrl;
    // Runtime detection: if on production domain, use api.urbexon.in
    if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
        return "https://api.urbexon.in/api";
    }
    return "http://localhost:9000/api";
};

export const useOrderRealtime = ({ enabled = true, onStatusUpdate }) => {
    const retryRef = useRef(null);
    const sourceRef = useRef(null);

    useEffect(() => {
        if (!enabled) return undefined;

        const authRaw = localStorage.getItem("auth");
        const token = authRaw ? JSON.parse(authRaw)?.token : null;
        if (!token) return undefined;

        const connect = () => {
            const url = `${getApiBase()}/orders/stream?token=${encodeURIComponent(token)}`;
            const source = new EventSource(url);
            sourceRef.current = source;

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
                retryRef.current = setTimeout(connect, 3000);
            };
        };

        connect();

        return () => {
            clearTimeout(retryRef.current);
            sourceRef.current?.close();
        };
    }, [enabled, onStatusUpdate]);
};

// export default useOrderRealtime;
