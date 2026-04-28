import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaBell,
    FaCheck,
    FaFireAlt,
    FaGift,
    FaShoppingCart,
    FaTag,
    FaTimes,
    FaTrash,
} from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";

const TYPE_STYLES = {
    price_drop: {
        icon: FaTag,
        iconClass: "bg-emerald-100 text-emerald-700",
    },
    back_in_stock: {
        icon: FaGift,
        iconClass: "bg-blue-100 text-blue-700",
    },
    deal_alert: {
        icon: FaFireAlt,
        iconClass: "bg-orange-100 text-orange-700",
    },
    wishlist_reminder: {
        icon: FaBell,
        iconClass: "bg-pink-100 text-pink-700",
    },
    cart_reminder: {
        icon: FaShoppingCart,
        iconClass: "bg-amber-100 text-amber-700",
    },
    general: {
        icon: FaBell,
        iconClass: "bg-slate-100 text-slate-700",
    },
};

const NotificationCenter = ({ variant = "desktop" }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEnabled = Boolean(user?._id);
    const isMobile = variant === "mobile";

    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const rootRef = useRef(null);

    const refreshUnread = useCallback(async () => {
        if (!isEnabled) {
            setUnread(0);
            return;
        }

        try {
            const { data } = await api.get("/user-notifications/unread-count");
            setUnread(typeof data?.count === "number" ? data.count : 0);
        } catch {
            // Keep the last known badge state on transient failures.
        }
    }, [isEnabled]);

    const fetchNotifications = useCallback(async (pg = 1) => {
        if (!isEnabled) return;

        setLoading(true);
        try {
            const { data } = await api.get(`/user-notifications?page=${pg}&limit=15`);
            const nextNotifications = Array.isArray(data?.notifications) ? data.notifications : [];
            const totalPages = Math.max(1, data?.totalPages || data?.pages || 1);

            setNotifications((prev) => (pg === 1 ? nextNotifications : [...prev, ...nextNotifications]));
            setHasMore(pg < totalPages);
            setPage(pg);

            if (typeof data?.unreadCount === "number") {
                setUnread(data.unreadCount);
            }
        } catch {
            if (pg === 1) {
                setNotifications([]);
                setHasMore(false);
            }
        } finally {
            setLoading(false);
        }
    }, [isEnabled]);

    useEffect(() => {
        if (!isEnabled) {
            setOpen(false);
            setNotifications([]);
            setUnread(0);
            setPage(1);
            setHasMore(false);
            return;
        }

        refreshUnread();

        const interval = setInterval(refreshUnread, 60000);

        let focusTimeout;
        const handleFocus = () => {
            clearTimeout(focusTimeout);
            // Delay request by 2 seconds to prevent rapid spam when switching tabs
            focusTimeout = setTimeout(refreshUnread, 2000);
        };
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleFocus);

        return () => {
            clearInterval(interval);
            clearTimeout(focusTimeout);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleFocus);
        };
    }, [isEnabled, refreshUnread]);

    useEffect(() => {
        if (!isEnabled) return;

        const handleRealtimeNotification = () => {
            refreshUnread();
            if (open) {
                fetchNotifications(1);
            }
        };

        window.addEventListener("ux-notification", handleRealtimeNotification);
        return () => window.removeEventListener("ux-notification", handleRealtimeNotification);
    }, [fetchNotifications, isEnabled, open, refreshUnread]);

    useEffect(() => {
        if (!open) return;

        const handleOutsideClick = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    const handleOpen = () => {
        if (!isEnabled) {
            navigate("/login");
            return;
        }

        if (!open) {
            fetchNotifications(1);
        }
        setOpen((prev) => !prev);
    };

    const markRead = async (id) => {
        const target = notifications.find((item) => item._id === id);
        if (!target || target.isRead) return;

        try {
            await api.put(`/user-notifications/${id}/read`);
            setNotifications((prev) =>
                prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
            );
            setUnread((prev) => Math.max(0, prev - 1));
        } catch {
            // Silent retry candidate; the next refresh will resync.
        }
    };

    const markAllRead = async () => {
        try {
            await api.put("/user-notifications/read-all");
            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
            setUnread(0);
        } catch {
            // Silent retry candidate; the next refresh will resync.
        }
    };

    const handleNotificationClick = async (notification) => {
        if (!notification?.isRead) {
            await markRead(notification._id);
        }

        if (notification?.link) {
            navigate(notification.link);
            setOpen(false);
        }
    };

    const deleteNotification = async (event, notification) => {
        event.stopPropagation();

        try {
            await api.delete(`/user-notifications/${notification._id}`);
            setNotifications((prev) => prev.filter((item) => item._id !== notification._id));
            if (!notification.isRead) {
                setUnread((prev) => Math.max(0, prev - 1));
            }
        } catch {
            // Silent retry candidate; the next refresh will resync.
        }
    };

    const timeAgo = (date) => {
        const timestamp = new Date(date).getTime();
        if (Number.isNaN(timestamp)) return "Just now";

        const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        if (seconds < 60) return "Just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const buttonClassName = isMobile
        ? "w-10 h-10 border-none bg-transparent rounded flex items-center justify-center text-white cursor-pointer relative hover:bg-white/10 transition-colors"
        : "flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2.5 py-1.5 rounded text-[13px] font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap relative";

    const dropdownClassName = isMobile
        ? "fixed left-2 right-2 top-[3.9rem] max-h-[min(28rem,calc(100vh-5rem))] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[950] overflow-hidden flex flex-col"
        : "absolute right-0 top-full mt-2 w-[22rem] max-h-[28rem] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[950] overflow-hidden flex flex-col";

    return (
        <div className="relative flex-shrink-0" ref={rootRef}>
            <button
                type="button"
                className={buttonClassName}
                onClick={handleOpen}
                aria-label="Notifications"
                aria-expanded={open}
            >
                <FaBell size={18} className="shrink-0 text-white" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
                {!isMobile && (
                    <span className="hidden xl:inline text-[13px] font-semibold">Notifications</span>
                )}
            </button>

            {open && (
                <div className={dropdownClassName}>
                    <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className="text-base font-bold text-gray-900">Notifications</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Your latest account alerts</p>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {unread > 0 && (
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                        onClick={markAllRead}
                                    >
                                        <FaCheck size={10} />
                                        Mark all
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
                                    onClick={() => setOpen(false)}
                                    aria-label="Close notifications"
                                >
                                    <FaTimes size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {!loading && notifications.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                                    <FaBell size={18} />
                                </div>
                                <p className="text-sm font-semibold text-gray-700 mt-3">No notifications yet</p>
                                <p className="text-xs text-gray-500 mt-1">New price drops and alerts will appear here.</p>
                            </div>
                        ) : (
                            notifications.map((notification) => {
                                const config = TYPE_STYLES[notification.type] || TYPE_STYLES.general;
                                const Icon = config.icon;

                                return (
                                    <div
                                        key={notification._id}
                                        className={`flex gap-3 p-4 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0 hover:bg-gray-50 group relative ${notification.isRead ? "bg-white" : "bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-200"}`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.iconClass}`}>
                                            <Icon size={14} />
                                        </span>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-gray-900 truncate">
                                                        {notification.title}
                                                    </div>
                                                    <p className="text-sm text-gray-600 leading-5 mt-1 break-words">
                                                        {notification.message}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="p-2 text-gray-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                                                    onClick={(event) => deleteNotification(event, notification)}
                                                    aria-label="Delete notification"
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between gap-3 mt-2">
                                                <span className="text-xs text-gray-500 font-medium">
                                                    {timeAgo(notification.createdAt)}
                                                </span>
                                                {!notification.isRead && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
                                                        New
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {notification.image && (
                                            <img
                                                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-sm ring-1 ring-gray-200/70"
                                                src={notification.image}
                                                alt=""
                                                onError={(event) => {
                                                    event.currentTarget.style.display = "none";
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })
                        )}

                        {loading && (
                            <div className="px-6 py-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                                <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                                Loading notifications...
                            </div>
                        )}
                    </div>

                    {hasMore && (
                        <button
                            type="button"
                            className="w-full py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 border-t border-gray-100 transition-colors disabled:opacity-50 disabled:cursor-default"
                            onClick={() => fetchNotifications(page + 1)}
                            disabled={loading}
                        >
                            View more
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
