import {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useCallback,
} from "react";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [toast, setToast] = useState(null);

    const wsRef = useRef(null);
    const reconnectRef = useRef(null);
    const pingRef = useRef(null);
    const backoffRef = useRef(5000); // exponential backoff start

    // � Sound notification helper
    const playSoundRef = useRef(() => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            // Two-tone notification sound
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } catch { /* silent fallback */ }
    });

    // �🔔 Add notification
    const addNotification = useCallback((n) => {
        setNotifications((prev) =>
            [{ ...n, read: false, createdAt: new Date() }, ...prev].slice(0, 50)
        );

        setToast({
            title: n.title,
            body: n.body,
            type: n.type || "info",
        });

        setTimeout(() => setToast(null), 5000);
    }, []);

    // ✅ Mark all as read
    const markAllRead = useCallback(() => {
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, read: true }))
        );
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // 🌐 WebSocket Connection
    useEffect(() => {
        const raw = localStorage.getItem("vendorAuth");
        if (!raw) return;

        let token;
        try {
            token = JSON.parse(raw)?.token;
        } catch {
            return;
        }

        if (!token) return;

        // WebSocket URL: explicit env var → runtime hostname detection → fallback
        const wsBase = import.meta.env.VITE_WS_URL
            || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
                ? "ws://localhost:9000" : "wss://api.urbexon.in");

        let retries = 0;
        const MAX_RETRIES = 15;

        const connect = () => {
            if (retries >= MAX_RETRIES) return;
            if (document.hidden) return;
            try {
                const tkn = encodeURIComponent(token);
                const ws = new WebSocket(`${wsBase}/ws?token=${tkn}`);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log("[Vendor WS] Connected to:", wsBase);
                    backoffRef.current = 3000;
                    retries = 0;
                    pingRef.current = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "ping" }));
                        }
                    }, 25000);
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);

                        if (msg.type === "new_order") {
                            playSoundRef.current();
                            addNotification({
                                title: "🛍️ New Order",
                                body: `₹${Number(
                                    msg.payload?.totalAmount || 0
                                ).toLocaleString("en-IN")} from ${msg.payload?.customerName || "Customer"
                                    }`,
                                type: "order",
                                data: msg.payload,
                            });

                            window.dispatchEvent(
                                new CustomEvent("vendor:new_order", {
                                    detail: msg.payload,
                                })
                            );
                        }

                        if (msg.type === "order_status") {
                            playSoundRef.current();
                            addNotification({
                                title: "📦 Order Update",
                                body: `Status: ${msg.payload?.status}`,
                                type: "update",
                            });
                        }

                        if (msg.type === "order_status_changed") {
                            playSoundRef.current();
                            addNotification({
                                title: "📦 Order Status Changed",
                                body: `#${(msg.payload?.orderId || "").toString().slice(-6).toUpperCase()} → ${msg.payload?.status?.replace(/_/g, " ")}`,
                                type: "update",
                                data: msg.payload,
                            });
                        }
                    } catch (err) {
                        console.error("WS message error:", err);
                    }
                };

                ws.onclose = () => {
                    clearInterval(pingRef.current);
                    if (retries < MAX_RETRIES) {
                        retries++;
                        const delay = backoffRef.current;
                        backoffRef.current = Math.min(delay * 2, 60000);
                        reconnectRef.current = setTimeout(connect, delay);
                    }
                };

                ws.onerror = () => {
                    ws.close();
                };
            } catch (err) {
                console.error("[Vendor WS] Connection error:", err);
            }
        };

        // Reconnect when tab becomes visible
        const onVisChange = () => {
            if (!document.hidden && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
                retries = 0;
                backoffRef.current = 3000;
                clearTimeout(reconnectRef.current);
                connect();
            }
        };
        document.addEventListener("visibilitychange", onVisChange);

        connect();

        return () => {
            clearInterval(pingRef.current);
            clearTimeout(reconnectRef.current);
            document.removeEventListener("visibilitychange", onVisChange);
            wsRef.current?.close();
        };
    }, [addNotification]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                toast,
                unreadCount,
                addNotification,
                markAllRead,
            }}
        >
            {children}

            {/* 🔥 Global Toast UI */}
            {toast && (
                <div style={styles.toast}>
                    <div style={styles.title}>{toast.title}</div>
                    <div style={styles.body}>{toast.body}</div>

                    <button style={styles.close} onClick={() => setToast(null)}>
                        ×
                    </button>
                </div>
            )}
        </NotificationContext.Provider>
    );
};

// 🎯 Hook
export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
    return ctx;
};

// 🎨 Styles
const styles = {
    toast: {
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "#0f0d2e",
        color: "#fff",
        padding: "14px 20px",
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        zIndex: 9999,
        maxWidth: 300,
    },
    title: {
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 4,
    },
    body: {
        fontSize: 12,
        color: "#9ca3af",
    },
    close: {
        position: "absolute",
        top: 6,
        right: 10,
        background: "none",
        border: "none",
        color: "#aaa",
        cursor: "pointer",
    },
};