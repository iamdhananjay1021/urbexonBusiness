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
import * as notificationApi from "../api/notificationApi";

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

/**
 * MODULE-LEVEL (shared) unread-count cache.
 *
 * Why this exists: NotificationCenter is mounted twice at once in the app
 * (variant="desktop" + variant="mobile", one hidden via CSS depending on
 * screen size). Each mounted instance used to keep its own `useRef` throttle,
 * so both instances independently called `/user-notifications/unread-count`
 * on mount — causing the duplicate network call you saw in devtools.
 *
 * By moving the throttle timestamp, in-flight flag, and a tiny subscriber
 * list to module scope (outside the component), ALL instances share the
 * same throttle window and the same in-flight request — only one network
 * call happens no matter how many <NotificationCenter> instances are mounted,
 * and every instance's badge stays in sync.
 */
let sharedUnreadCount = 0;
let sharedInFlight = false;
let sharedLastFetch = 0;
let sharedInFlightPromise = null;
const unreadSubscribers = new Set();

const notifySubscribers = (count) => {
    sharedUnreadCount = count;
    unreadSubscribers.forEach((fn) => fn(count));
};

const fetchUnreadShared = async (force = false) => {
    const now = Date.now();

    // Someone else already fetching — piggyback on that request instead of
    // firing a second one.
    if (sharedInFlight && sharedInFlightPromise) {
        return sharedInFlightPromise;
    }

    if (!force && now - sharedLastFetch < 3000) {
        return sharedUnreadCount;
    }

    sharedInFlight = true;
    sharedLastFetch = now;

    sharedInFlightPromise = (async () => {
        try {
            const { data } = await notificationApi.getUnreadCount();
            const count = typeof data?.count === "number" ? data.count : 0;
            notifySubscribers(count);
            return count;
        } catch {
            return sharedUnreadCount;
        } finally {
            sharedInFlight = false;
            sharedInFlightPromise = null;
        }
    })();

    return sharedInFlightPromise;
};

const NotificationCenter = ({ variant = "desktop", theme = "dark" }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEnabled = Boolean(user?._id);
    const isMobile = variant === "mobile";

    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(sharedUnreadCount);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const rootRef = useRef(null);
    const notificationFetchRef = useRef(false);

    // Subscribe to the shared unread-count cache so every mounted instance
    // (desktop + mobile) stays in sync without each one polling separately.
    useEffect(() => {
        if (!isEnabled) return undefined;
        const handler = (count) => setUnread(count);
        unreadSubscribers.add(handler);
        return () => unreadSubscribers.delete(handler);
    }, [isEnabled]);

    const refreshUnread = useCallback(async (force = false) => {
        if (!isEnabled) {
            setUnread(0);
            return;
        }
        await fetchUnreadShared(force);
    }, [isEnabled]);

    const fetchNotifications = useCallback(async (pg = 1) => {
        if (!isEnabled || notificationFetchRef.current) return;

        notificationFetchRef.current = true;
        setLoading(true);
        try {
            const { data } = await notificationApi.getNotifications(pg, 15);
            const nextNotifications = Array.isArray(data?.notifications) ? data.notifications : [];
            const totalPages = Math.max(1, data?.totalPages || data?.pages || 1);

            setNotifications((prev) => (pg === 1 ? nextNotifications : [...prev, ...nextNotifications]));
            setHasMore(pg < totalPages);
            setPage(pg);

            if (typeof data?.unreadCount === "number") {
                notifySubscribers(data.unreadCount);
            }
        } catch {
            if (pg === 1) {
                setNotifications([]);
                setHasMore(false);
            }
        } finally {
            setLoading(false);
            notificationFetchRef.current = false;
        }
    }, [isEnabled]);

    useEffect(() => {
        if (!isEnabled) {
            setOpen(false);
            setNotifications([]);
            setUnread(0);
            setPage(1);
            setHasMore(false);
            return undefined;
        }

        refreshUnread();

        const interval = setInterval(() => refreshUnread(), 300000);

        let focusTimeout;
        const handleFocus = () => {
            clearTimeout(focusTimeout);
            focusTimeout = setTimeout(() => refreshUnread(), 2000);
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
        if (!isEnabled) return undefined;

        const handleRealtimeNotification = () => {
            refreshUnread(true);
            if (open) {
                fetchNotifications(1);
            }
        };

        window.addEventListener("ux-notification", handleRealtimeNotification);
        return () => window.removeEventListener("ux-notification", handleRealtimeNotification);
    }, [fetchNotifications, isEnabled, open, refreshUnread]);

    useEffect(() => {
        if (!open) return undefined;

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
            await notificationApi.markNotificationRead(id);
            setNotifications((prev) =>
                prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
            );
            notifySubscribers(Math.max(0, sharedUnreadCount - 1));
        } catch {
            // Silent retry candidate
        }
    };

    const markAllRead = async () => {
        try {
            await notificationApi.markAllNotificationsRead();
            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
            notifySubscribers(0);
        } catch {
            // Silent retry candidate
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
            await notificationApi.deleteNotification(notification._id);
            setNotifications((prev) => prev.filter((item) => item._id !== notification._id));
            if (!notification.isRead) {
                notifySubscribers(Math.max(0, sharedUnreadCount - 1));
            }
        } catch {
            // Silent retry candidate
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

    const btnTextColor = theme === "dark" ? "text-white" : "text-gray-700";
    const btnHover = theme === "dark" ? "hover:bg-white/10" : "hover:bg-gray-100";

    const buttonClassName = isMobile
        ? `w-10 h-10 border-none bg-transparent rounded-lg flex items-center justify-center cursor-pointer relative transition-colors ${btnTextColor} ${btnHover}`
        : `flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2.5 py-2 rounded-lg relative transition-colors whitespace-nowrap ${btnTextColor} ${btnHover}`;

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
                <FaBell size={17} className={`shrink-0 ${theme === "dark" ? "text-white" : "text-gray-700"}`} />
                {unread > 0 && (
                    <span className={`absolute -top-0.5 right-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center px-0.5 ${theme === "dark" ? "bg-yellow-400 text-[#2874f0]" : "bg-red-500 text-white"}`}>
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
                {!isMobile && (
                    <span className="hidden lg:inline text-[13px] font-semibold">Notifications</span>
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