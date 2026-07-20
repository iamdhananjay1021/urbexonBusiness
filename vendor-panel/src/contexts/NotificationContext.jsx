import {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
} from "react";
import api from "../api/axios";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [toast, setToast] = useState(null);

    const wsRef = useRef(null);
    const reconnectRef = useRef(null);
    const pingRef = useRef(null);
    const backoffRef = useRef(5000);
    // Live-tracking needs the raw message stream (rider_location events)
    // and a way to send join_room — this context already owns the app's
    // one WebSocket connection, so extend it rather than opening a second
    // socket just for the tracking map.
    const [lastMessage, setLastMessage] = useState(null);
    // Exposed so useLiveTracking can re-join the order room on reconnect
    // (room membership is wiped server-side on disconnect and is not
    // auto-restored — the client must re-send join_room every time).
    const [connected, setConnected] = useState(false);

    const playSoundRef = useRef(() => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } catch {
            // silent fallback
        }
    });

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

    // BUG FIX: this used to only flip local React state — the unread badge
    // reset to 0 on every page refresh even though PlatformNotification was
    // persisting everything server-side the whole time (notificationEngine.js
    // has written to it for a while now; nothing ever read it back for
    // vendors). Now hydrates from /vendor/notifications on mount and
    // persists mark-all-read to the same store.
    useEffect(() => {
        api.get("/vendor/notifications?limit=30")
            .then(({ data }) => {
                const persisted = (data?.notifications || []).map((n) => ({
                    _id: n._id,
                    title: n.title,
                    body: n.message,
                    type: n.type || "info",
                    data: n.meta || {},
                    read: !!n.read,
                    createdAt: n.createdAt,
                }));
                setNotifications((prev) => (prev.length ? prev : persisted));
            })
            .catch(() => { /* non-fatal — badge just starts empty this session */ });
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, read: true }))
        );
        api.put("/vendor/notifications/read-all").catch(() => { });
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

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
                    backoffRef.current = 3000;
                    retries = 0;
                    setConnected(true);
                    pingRef.current = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "ping" }));
                        }
                    }, 25000);
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        setLastMessage(msg);

                        if (msg.type === "new_order") {
                            playSoundRef.current();
                            const orderAmount = Number(
                                msg.payload?.totalAmount
                                ?? msg.payload?.amount
                                ?? 0
                            );

                            addNotification({
                                title: "New Order",
                                body: `₹${orderAmount.toLocaleString("en-IN")} from ${msg.payload?.customerName || "Customer"}`,
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
                                title: "Order Update",
                                body: `Status: ${msg.payload?.status}`,
                                type: "update",
                            });
                        }

                        if (msg.type === "order_status_changed") {
                            playSoundRef.current();
                            addNotification({
                                title: "Order Status Changed",
                                body: `#${(msg.payload?.orderId || "").toString().slice(-6).toUpperCase()} -> ${msg.payload?.status?.replace(/_/g, " ")}`,
                                type: "update",
                                data: msg.payload,
                            });
                        }

                        // Support ticket updates (admin replied / status
                        // changed) — pushed by notificationEngine.notify with
                        // type "ticket_update"; the ticket detail page also
                        // live-refreshes off lastMessage.
                        if (msg.type === "ticket_update") {
                            playSoundRef.current();
                            addNotification({
                                title: msg.payload?.title || "Support update",
                                body: msg.payload?.message || "Your support ticket has an update",
                                type: "info",
                                data: msg.payload,
                            });
                        }

                        // NOTIFICATION GAP FIX: account status (approve/
                        // reject/suspend/reactivate), subscription (activate/
                        // deactivate/expire/expiring-soon), payout (approve/
                        // reject/complete), and low-stock events — pushed by
                        // notificationEngine.notify() from vendorApproval.js,
                        // sellerJobs.js, payoutController.js, and
                        // orderInventoryJobs.js. These were already persisted
                        // to the bell via PlatformNotification regardless;
                        // this adds the live toast+sound.
                        if (["vendor_status_changed", "subscription_update", "payout_update", "inventory_low", "review_received"].includes(msg.type)) {
                            playSoundRef.current();
                            addNotification({
                                title: msg.payload?.title || "Account update",
                                body: msg.payload?.message || "Your account has an update",
                                type: "info",
                                data: msg.payload,
                            });
                        }

                        // BUG FIX: admin broadcasts (POST /admin/broadcast,
                        // { type: "admin:broadcast", payload: { message,
                        // from, at } }) reached this exact socket already —
                        // nothing read the type, so it was silently dropped
                        // with zero visible effect for the vendor.
                        if (msg.type === "admin:broadcast" && msg.payload?.message) {
                            addNotification({
                                title: "Announcement",
                                body: msg.payload.message,
                                type: "info",
                            });
                        }
                    } catch (err) {
                        console.error("WS message error:", err);
                    }
                };

                ws.onclose = () => {
                    clearInterval(pingRef.current);
                    setConnected(false);
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

    const sendWs = useCallback((type, payload = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, ...payload }));
        }
    }, []);

    const value = useMemo(
        () => ({
            notifications,
            toast,
            unreadCount,
            addNotification,
            markAllRead,
            lastMessage,
            sendWs,
            connected,
        }),
        [notifications, toast, unreadCount, addNotification, markAllRead, lastMessage, sendWs, connected]
    );

    return (
        <NotificationContext.Provider value={value}>
            {children}

            {toast && (
                <div style={styles.toast}>
                    <div style={styles.title}>{toast.title}</div>
                    <div style={styles.body}>{toast.body}</div>

                    <button style={styles.close} onClick={() => setToast(null)}>
                        x
                    </button>
                </div>
            )}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
    return ctx;
};

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
