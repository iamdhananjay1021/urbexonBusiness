/**
 * NotificationCenter.jsx — Bell icon + dropdown for user notifications
 * Shows unread count badge, notification list, mark as read, click-to-navigate
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheck, FaTrash, FaTimes } from "react-icons/fa";
import api from "../api/axios";

const NotificationCenter = () => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const dropRef = useRef(null);

    // Fetch unread count on mount
    useEffect(() => {
        const fetchCount = async () => {
            try {
                const { data } = await api.get("/user-notifications/unread-count");
                setUnread(data.count || 0);
            } catch { /* silent */ }
        };
        fetchCount();
        const interval = setInterval(fetchCount, 60000); // Poll every 60s
        return () => clearInterval(interval);
    }, []);

    // Listen for real-time WebSocket notifications
    useEffect(() => {
        const handler = (e) => {
            if (e.detail?.type) {
                setUnread(prev => prev + 1);
                // Prepend to list if dropdown is open
                if (open) {
                    setNotifications(prev => [{
                        _id: Date.now().toString(),
                        ...e.detail,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                    }, ...prev]);
                }
            }
        };
        window.addEventListener("ux-notification", handler);
        return () => window.removeEventListener("ux-notification", handler);
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const fetchNotifications = useCallback(async (pg = 1) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/user-notifications?page=${pg}&limit=15`);
            if (pg === 1) {
                setNotifications(data.notifications || []);
            } else {
                setNotifications(prev => [...prev, ...(data.notifications || [])]);
            }
            setHasMore(data.page < data.totalPages);
            setPage(pg);
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    const handleOpen = () => {
        if (!open) {
            fetchNotifications(1);
        }
        setOpen(!open);
    };

    const markRead = async (id) => {
        try {
            await api.put(`/user-notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnread(prev => Math.max(0, prev - 1));
        } catch { /* silent */ }
    };

    const markAllRead = async () => {
        try {
            await api.put("/user-notifications/read-all");
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnread(0);
        } catch { /* silent */ }
    };

    const handleClick = (n) => {
        if (!n.isRead) markRead(n._id);
        if (n.link) {
            navigate(n.link);
            setOpen(false);
        }
    };

    const deleteNotification = async (e, id) => {
        e.stopPropagation();
        try {
            await api.delete(`/user-notifications/${id}`);
            setNotifications(prev => prev.filter(n => n._id !== id));
        } catch { /* silent */ }
    };

    const timeAgo = (date) => {
        const s = Math.floor((Date.now() - new Date(date)) / 1000);
        if (s < 60) return "Just now";
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
        return `${Math.floor(s / 86400)}d ago`;
    };

    const typeIcon = (type) => {
        switch (type) {
            case "price_drop": return "📉";
            case "back_in_stock": return "🎉";
            case "deal_alert": return "🔥";
            case "wishlist_reminder": return "💫";
            case "cart_reminder": return "🛒";
            default: return "🔔";
        }
    };

    return (
        <div className="nc-wrap" ref={dropRef}>
            <button className="ux-icon-btn" onClick={handleOpen} aria-label="Notifications">
                <FaBell size={20} color="#374151" />
                {unread > 0 && (
                    <span className="ux-badge ux-badge-red">{unread > 9 ? "9+" : unread}</span>
                )}
                <span className="ux-icon-btn-lbl">Alerts</span>
            </button>

            {open && (
                <div className="nc-drop">
                    <div className="nc-head">
                        <h4>Notifications</h4>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {unread > 0 && (
                                <button className="nc-mark-all" onClick={markAllRead}>
                                    <FaCheck size={10} /> Mark all read
                                </button>
                            )}
                            <button className="nc-close" onClick={() => setOpen(false)}>
                                <FaTimes size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="nc-list">
                        {notifications.length === 0 && !loading && (
                            <div className="nc-empty">No notifications yet</div>
                        )}
                        {notifications.map(n => (
                            <div
                                key={n._id}
                                className={`nc-item${n.isRead ? "" : " nc-unread"}`}
                                onClick={() => handleClick(n)}
                            >
                                <span className="nc-emoji">{typeIcon(n.type)}</span>
                                <div className="nc-body">
                                    <div className="nc-title">{n.title}</div>
                                    <div className="nc-msg">{n.message}</div>
                                    <div className="nc-time">{timeAgo(n.createdAt)}</div>
                                </div>
                                {n.image && <img className="nc-img" src={n.image} alt="" />}
                                <button className="nc-del" onClick={(e) => deleteNotification(e, n._id)}>
                                    <FaTrash size={10} />
                                </button>
                            </div>
                        ))}
                        {hasMore && (
                            <button className="nc-more" onClick={() => fetchNotifications(page + 1)} disabled={loading}>
                                {loading ? "Loading..." : "Load more"}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .nc-wrap { position: relative; }
                .nc-drop {
                    position: absolute; top: calc(100% + 8px); right: -20px;
                    width: 360px; max-height: 480px; background: #fff;
                    border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.15);
                    z-index: 9999; overflow: hidden;
                    display: flex; flex-direction: column;
                }
                .nc-head {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 14px 16px; border-bottom: 1px solid #f0f0f0;
                }
                .nc-head h4 { margin: 0; font-size: 16px; font-weight: 700; color: #111; }
                .nc-mark-all {
                    background: none; border: none; color: #2563eb; font-size: 12px;
                    cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 600;
                }
                .nc-close { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 4px; }
                .nc-list { overflow-y: auto; flex: 1; }
                .nc-empty { padding: 40px 16px; text-align: center; color: #9ca3af; font-size: 14px; }
                .nc-item {
                    display: flex; align-items: flex-start; gap: 10px;
                    padding: 12px 16px; cursor: pointer; transition: background .15s;
                    position: relative; border-bottom: 1px solid #f9f9f9;
                }
                .nc-item:hover { background: #f8fafc; }
                .nc-unread { background: #eff6ff; }
                .nc-unread:hover { background: #dbeafe; }
                .nc-emoji { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
                .nc-body { flex: 1; min-width: 0; }
                .nc-title { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 2px; }
                .nc-msg { font-size: 12px; color: #6b7280; line-height: 1.4; }
                .nc-time { font-size: 11px; color: #9ca3af; margin-top: 4px; }
                .nc-img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
                .nc-del {
                    position: absolute; top: 8px; right: 8px;
                    background: none; border: none; color: #d1d5db; cursor: pointer;
                    opacity: 0; transition: opacity .15s;
                }
                .nc-item:hover .nc-del { opacity: 1; }
                .nc-del:hover { color: #ef4444; }
                .nc-more {
                    display: block; width: 100%; padding: 12px;
                    background: none; border: none; border-top: 1px solid #f0f0f0;
                    color: #2563eb; font-size: 13px; font-weight: 600; cursor: pointer;
                }
                .nc-more:hover { background: #f8fafc; }
                @media (max-width: 480px) {
                    .nc-drop { width: calc(100vw - 16px); right: -60px; }
                }
            `}</style>
        </div>
    );
};

export default NotificationCenter;
