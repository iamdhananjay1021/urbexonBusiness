import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useAdminAuth } from "../auth/AdminAuthContext";
import { AdminWsProvider, useAdminWsContext } from "../contexts/AdminWsContext";
import api from "../api/adminApi";
import {
    FaThLarge, FaBox, FaClipboardList,
    FaSignOutAlt, FaBars, FaTimes, FaChevronRight, FaPlusCircle,
    FaImage, FaTags, FaStore, FaMapMarkerAlt, FaMoneyBillWave, FaUndoAlt, FaTruck,
    FaUsers, FaTicketAlt, FaBell, FaCheck, FaShoppingCart, FaExclamationTriangle, FaInfoCircle,
    FaGlobeAsia, FaCog, FaWallet, FaPercentage, FaDrawPolygon, FaTachometerAlt, FaLifeRing,
    FaLayerGroup, FaBolt, FaStar, FaBullhorn, FaEnvelope, FaChartLine,
} from "react-icons/fa";

/* ─── Pages that need zero padding (manage their own layout) ─── */
const FULLBLEED_ROUTES = ["refunds", "settlements", "payouts", "pincodes", "local-delivery", "map", "delivery-settings"];

/* FIX: previously `--admshell-text`, `--admshell-text-main` and
   `--admshell-border` were declared here but never referenced anywhere
   in the stylesheet — dead tokens. Replaced with tokens that are
   actually used everywhere the dark sidebar/notification-panel needs a
   text color, instead of the same hex values (#0f172a / #64748b)
   being retyped by hand in a dozen different places. */
/* FIX: sidebar used to be hardcoded near-black (#0f172a) regardless of
   the rest of the app's theme. Sidebar tokens now point at the same
   --adm-* variables the Orders page (and everything else) already uses,
   so the sidebar is light and consistent instead of a black slab. */
const ADMIN_STYLES = `
    :root {
        --admshell-bg:            var(--adm-bg);
        --admshell-sidebar:       var(--adm-surface);
        --admshell-sidebar-hover: var(--adm-surface-alt);
        --admshell-sidebar-text:  var(--adm-text-primary);
        --admshell-sidebar-muted: var(--adm-muted);
        --admshell-blue:          var(--adm-primary);
        --admshell-blue-dim:      rgba(59,130,246,0.12);
        --admshell-blue-light:    rgba(59,130,246,0.08);
        --admshell-red:           var(--adm-danger);
        --admshell-topbar:        var(--adm-surface);
        --admshell-topbar-text:   var(--adm-text-primary);
        --admshell-topbar-muted:  var(--adm-muted);
        --admshell-shadow:        0 1px 3px rgba(0,0,0,0.06);
        --admshell-sidebar-w:     250px;
        --admshell-topbar-h:      60px;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--admshell-bg); }

    .adm-root {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--adm-text-secondary); border-radius: 4px; }

    @keyframes adm-slideIn {
        from { transform: translateX(-100%); opacity: 0; }
        to   { transform: translateX(0); opacity: 1; }
    }
    @keyframes adm-fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
    }

    .adm-nav-link {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 9px 14px;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        color: var(--admshell-sidebar-muted);
        border-radius: 10px;
        border: none;
        transition: all 0.18s ease;
        margin-bottom: 2px;
        white-space: nowrap;
        position: relative;
    }
    .adm-nav-link:hover {
        color: var(--admshell-sidebar-text);
        background: var(--admshell-sidebar-hover);
    }
    .adm-nav-link.active {
        color: var(--admshell-blue);
        background: linear-gradient(135deg, rgba(59,130,246,0.14), rgba(59,130,246,0.05));
        font-weight: 600;
        box-shadow: inset 3px 0 0 var(--admshell-blue);
    }
    .adm-nav-icon {
        width: 30px; height: 30px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 8px;
        flex-shrink: 0;
        transition: all 0.18s;
    }
    .adm-nav-link.active .adm-nav-icon {
        background: rgba(59,130,246,0.18);
        color: var(--admshell-blue);
    }
    .adm-nav-link:not(.active) .adm-nav-icon {
        color: var(--admshell-sidebar-muted);
    }
    .adm-nav-link:hover:not(.active) .adm-nav-icon {
        color: var(--admshell-sidebar-text);
    }
    .adm-nav-section-label {
        font-size: 10px;
        font-weight: 700;
        color: var(--admshell-sidebar-muted);
        letter-spacing: 0.14em;
        padding: 14px 14px 6px;
        text-transform: uppercase;
    }
    .adm-logout-btn {
        width: 100%;
        display: flex; align-items: center; justify-content: center;
        gap: 8px;
        padding: 10px;
        border-radius: 10px;
        border: 1px solid rgba(239,68,68,0.2);
        background: rgba(239,68,68,0.08);
        color: var(--adm-danger);
        font-family: inherit;
        font-size: 13px; font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
    }
    .adm-logout-btn:hover {
        background: rgba(239,68,68,0.15);
        color: var(--adm-danger-hover);
        border-color: rgba(239,68,68,0.35);
    }
    .adm-mobile-btn {
        display: none;
        align-items: center; justify-content: center;
        width: 38px; height: 38px;
        background: var(--adm-surface-alt);
        border: 1.5px solid var(--adm-border);
        border-radius: 10px;
        color: var(--adm-text-secondary);
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.15s;
    }
    .adm-mobile-btn:hover {
        background: var(--adm-border);
        color: var(--adm-text-primary);
    }

    @media (max-width: 1023px) {
        .adm-desktop-sidebar { display: none !important; }
        .adm-mobile-btn      { display: flex !important; }
    }
    @media (max-width: 560px) {
        .adm-topbar-user-info { display: none !important; }
    }

    @keyframes adm-notifSlide {
        from { opacity: 0; transform: translateY(-8px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .adm-notif-panel {
        position: absolute; top: calc(100% + 8px); right: 0;
        width: 380px; max-height: 480px;
        background: var(--adm-surface); border: 1px solid var(--adm-border);
        box-shadow: 0 16px 48px rgba(0,0,0,0.12);
        z-index: 999; display: flex; flex-direction: column;
        animation: adm-notifSlide 0.15s ease;
        border-radius: 14px;
        overflow: hidden;
    }
    @media (max-width: 480px) {
        .adm-notif-panel { width: calc(100vw - 24px); right: -8px; }
    }
    @media (max-width: 640px) {
        .adm-main-content { padding: 12px !important; }
    }
    .adm-notif-item {
        display: flex; gap: 10px; padding: 12px 16px;
        border-bottom: 1px solid var(--adm-surface-alt);
        cursor: pointer; transition: background 0.12s;
    }
    .adm-notif-item:hover { background: var(--adm-bg); }
    .adm-notif-item.unread { background: var(--adm-primary-tint); }
    .adm-notif-item.unread:hover { background: #dbeafe; }
`;

/* FIX: brand mark used to be a gradient logo box + "UX" letters — per
   request, the sidebar no longer shows any avatar/logo graphic, just
   the text mark. */
const UXLogoSidebar = () => (
    <div>
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--admshell-sidebar-text)", lineHeight: 1, letterSpacing: "-0.03em" }}>UrbeXon</div>
        <div style={{ fontSize: 9, color: "var(--admshell-sidebar-muted)", letterSpacing: "0.16em", fontWeight: 600, marginTop: 4, textTransform: "uppercase" }}>Admin Console</div>
    </div>
);

/* Still used by the topbar user chip — only the sidebar's avatar/logo
   was removed, per request. */
const Avatar = ({ name, size = 34 }) => (
    <div style={{
        width: size, height: size, borderRadius: 10,
        background: "linear-gradient(135deg, var(--adm-primary), #6366f1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
        boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
    }}>
        {name?.[0]?.toUpperCase() || "A"}
    </div>
);

const NAV_SECTIONS = [
    {
        label: "Overview",
        items: [
            { to: ".", end: true, icon: FaThLarge, label: "Dashboard" },
            { to: "orders", icon: FaClipboardList, label: "Orders" },
            { to: "map", icon: FaGlobeAsia, label: "Live Map" },
        ],
    },
    {
        label: "Users",
        items: [
            { to: "customers", icon: FaUsers, label: "Customers" },
            { to: "delivery-boys", icon: FaTruck, label: "Delivery Boys" },
            { to: "support", icon: FaLifeRing, label: "Customer Support" },
        ],
    },
    {
        label: "Catalogue",
        items: [
            { to: "products", icon: FaBox, label: "Products" },
            { to: "products/new", icon: FaPlusCircle, label: "Add Product" },
            { to: "categories", icon: FaTags, label: "Categories" },
            { to: "collections", icon: FaLayerGroup, label: "Collections" },
            { to: "deals", icon: FaBolt, label: "Flash Deals" },
            { to: "reviews", icon: FaStar, label: "Reviews" },
            { to: "banners", icon: FaImage, label: "Banners" },
        ],
    },
    {
        label: "Partners",
        items: [
            { to: "vendors", icon: FaStore, label: "Vendors" },
            { to: "subscriptions", icon: FaTicketAlt, label: "Subscriptions" },
        ],
    },
    {
        label: "Marketing & Insights",
        items: [
            { to: "broadcast", icon: FaBullhorn, label: "Broadcast" },
            { to: "newsletter", icon: FaEnvelope, label: "Newsletter" },
            { to: "search-analytics", icon: FaChartLine, label: "Search Analytics" },
        ],
    },
    {
        label: "Operations",
        items: [
            { to: "operations", icon: FaTachometerAlt, label: "Ops Dashboard" },
            { to: "pincodes", icon: FaMapMarkerAlt, label: "Pincodes" },
            { to: "zones", icon: FaDrawPolygon, label: "Delivery Zones" },
            { to: "settlements", icon: FaMoneyBillWave, label: "Settlements" },
            // FIX: Payouts used to share FaMoneyBillWave with Settlements —
            // two adjacent nav items with the identical icon are hard to
            // tell apart at a glance. Gave Payouts its own icon.
            { to: "payouts", icon: FaWallet, label: "Payouts" },
            { to: "refunds", icon: FaUndoAlt, label: "Refunds" },
            // FIX: Coupons used to share FaTags with Categories (a
            // completely different section) — swapped to FaPercentage so
            // it reads as "discounts" at a glance instead of duplicating
            // the Categories icon.
            { to: "coupons", icon: FaPercentage, label: "Coupons" },
            { to: "local-delivery", icon: FaTruck, label: "Local Delivery" },
            { to: "delivery-settings", icon: FaCog, label: "Delivery Settings" },
            { to: "scheduler", icon: FaCog, label: "Scheduler" },
        ],
    },
];

const SidebarContent = memo(({ admin, logout, onClose }) => {
    const roleColor = admin?.role === "owner" ? "var(--adm-warning)" : "var(--adm-primary)";

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--admshell-sidebar)" }}>
            {/* Logo */}
            <div style={{ padding: "20px 18px 16px" }}>
                <UXLogoSidebar />
            </div>

            {/* User Card — text-only, no avatar/logo graphic */}
            <div style={{ margin: "0 12px 8px", padding: "12px 14px", background: "var(--adm-bg)", border: "1px solid var(--adm-border)", borderRadius: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--admshell-sidebar-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {admin?.name || "Admin"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--admshell-sidebar-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                        {admin?.email}
                    </div>
                </div>
                <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, background: `${roleColor}18`, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: roleColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: roleColor }} />
                    {admin?.role || "admin"}
                </div>
            </div>

            {/* Navigation */}
            <div style={{ flex: 1, padding: "4px 10px", overflowY: "auto" }}>
                {NAV_SECTIONS.map((section) => (
                    <div key={section.label}>
                        <div className="adm-nav-section-label">{section.label}</div>
                        <nav>
                            {section.items.map(({ to, end, icon: Icon, label }) => (
                                <NavLink key={to} to={to} end={end} onClick={onClose}
                                    className={({ isActive }) => `adm-nav-link${isActive ? " active" : ""}`}>
                                    {({ isActive }) => (
                                        <>
                                            <div className="adm-nav-icon"><Icon size={13} /></div>
                                            <span style={{ flex: 1 }}>{label}</span>
                                            {isActive && <FaChevronRight size={8} style={{ color: "var(--admshell-blue)", opacity: 0.5 }} />}
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                ))}
            </div>

            {/* Logout */}
            <div style={{ padding: "12px 12px 20px" }}>
                <button onClick={logout} className="adm-logout-btn">
                    <FaSignOutAlt size={11} /> Sign Out
                </button>
            </div>
        </div>
    );
});
SidebarContent.displayName = "SidebarContent";

/* ══════════════════════════════════════════
   NOTIFICATION ICON MAP
══════════════════════════════════════════ */
const NOTIF_ICONS = {
    order: { Icon: FaShoppingCart, color: "var(--adm-primary)", bg: "var(--adm-primary-tint)" },
    vendor: { Icon: FaStore, color: "#8b5cf6", bg: "#f5f3ff" },
    product: { Icon: FaBox, color: "var(--adm-warning)", bg: "var(--adm-warning-tint)" },
    user: { Icon: FaUsers, color: "var(--adm-success)", bg: "var(--adm-success-tint)" },
    alert: { Icon: FaExclamationTriangle, color: "var(--adm-danger)", bg: "var(--adm-danger-tint)" },
    info: { Icon: FaInfoCircle, color: "var(--adm-text-secondary)", bg: "var(--adm-bg)" },
    system: { Icon: FaInfoCircle, color: "var(--adm-text-secondary)", bg: "var(--adm-bg)" },
};

const timeAgo = (date) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "Just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};

/* ══════════════════════════════════════════
   NOTIFICATION DROPDOWN
══════════════════════════════════════════ */
const NotificationDropdown = ({ notifications, unreadCount, loading, onMarkRead, onMarkAllRead, onNavigate }) => (
    <div className="adm-notif-panel">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: "1px solid var(--adm-border)" }}>
            <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--admshell-topbar-text)" }}>Notifications</div>
                {unreadCount > 0 && <div style={{ fontSize: 11, color: "var(--admshell-topbar-muted)", marginTop: 1 }}>{unreadCount} unread</div>}
            </div>
            {unreadCount > 0 && (
                <button onClick={onMarkAllRead} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700, color: "var(--adm-primary)",
                    display: "flex", alignItems: "center", gap: 4,
                }}>
                    <FaCheck size={9} /> Mark all read
                </button>
            )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", maxHeight: 380 }}>
            {loading ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--adm-muted)", fontSize: 13 }}>Loading…</div>
            ) : notifications.length === 0 ? (
                <div style={{ padding: "48px 16px", textAlign: "center" }}>
                    <FaBell size={24} style={{ color: "var(--adm-border)", marginBottom: 10 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--admshell-topbar-muted)" }}>No notifications yet</div>
                    <div style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 4 }}>You'll be notified about orders, vendors & more</div>
                </div>
            ) : notifications.map(n => {
                const cfg = NOTIF_ICONS[n.icon] || NOTIF_ICONS[n.type] || NOTIF_ICONS.info;
                const { Icon, color, bg } = cfg;
                return (
                    <div key={n._id}
                        className={`adm-notif-item${!n.isRead ? " unread" : ""}`}
                        onClick={() => { onMarkRead(n._id); if (n.link) onNavigate(n.link); }}
                    >
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            <Icon size={13} color={color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: "var(--admshell-topbar-text)", lineHeight: 1.3 }}>{n.title}</div>
                            <div style={{ fontSize: 12, color: "var(--admshell-topbar-muted)", lineHeight: 1.3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                            <div style={{ fontSize: 10, color: "var(--adm-muted)", marginTop: 4, fontWeight: 500 }}>{timeAgo(n.createdAt)}</div>
                        </div>
                        {!n.isRead && (
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--adm-primary)", flexShrink: 0, marginTop: 4 }} />
                        )}
                    </div>
                );
            })}
        </div>
    </div>
);

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
const AdminShell = () => {
    const { admin, logout } = useAdminAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifLoading, setNotifLoading] = useState(false);
    const notifRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    /* Fetch unread count on mount + poll every 5 min */
    const fetchUnreadCount = useCallback(async () => {
        try {
            const { data } = await api.get("/admin/notifications/unread");
            setUnreadCount(data.unreadCount || 0);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchUnreadCount();
        // Polling interval increased from 30s to 5 mins (300000ms) to stop terminal log spam.
        // WebSockets (wsHandler) will instantly handle real-time notifications anyway.
        const interval = setInterval(fetchUnreadCount, 300000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    /* Global WebSocket — refresh notifications on any real-time event.
       Consumes the ONE shared connection from AdminWsContext instead of
       opening its own socket (see contexts/AdminWsContext.jsx). */
    const { lastMessage } = useAdminWsContext();
    useEffect(() => {
        if (!lastMessage || lastMessage.type === "connected" || lastMessage.type === "pong") return;
        fetchUnreadCount();
        // Dispatch event so child pages can react (e.g. AdminLocalDelivery, AdminOrders)
        window.dispatchEvent(new CustomEvent("admin:ws_message", { detail: lastMessage }));
    }, [lastMessage, fetchUnreadCount]);

    /* Fetch full list when dropdown opens */
    const fetchNotifications = useCallback(async () => {
        setNotifLoading(true);
        try {
            const { data } = await api.get("/admin/notifications?limit=20");
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch { /* silent */ }
        setNotifLoading(false);
    }, []);

    const toggleNotif = () => {
        const opening = !notifOpen;
        setNotifOpen(opening);
        if (opening) fetchNotifications();
    };

    /* Mark single as read */
    const markRead = async (id) => {
        try {
            await api.put(`/admin/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* silent */ }
    };

    /* Mark all as read */
    const markAllRead = async () => {
        try {
            await api.put("/admin/notifications/read-all");
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch { /* silent */ }
    };

    /* Close on outside click */
    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
        };
        if (notifOpen) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [notifOpen]);

    /* Current page label for breadcrumb */
    const currentLabel = (() => {
        const seg = location.pathname.replace(/.*\/admin\/?/, "").split("/")[0] || ".";
        const allItems = NAV_SECTIONS.flatMap(s => s.items);
        return allItems.find(n => n.to === seg || (n.to === "." && seg === "."))?.label || "Dashboard";
    })();

    /* Check if current page should be full-bleed (no padding) */
    const isFullBleed = FULLBLEED_ROUTES.some(r => {
        const seg = location.pathname.replace(/.*\/admin\/?/, "").split("/")[0];
        return seg === r;
    });

    const closeMobile = () => setMobileOpen(false);

    return (
        <div className="adm-root" style={{ height: "100vh", background: "var(--admshell-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <style>{ADMIN_STYLES}</style>

            {/* ── TOPBAR ── */}
            <header style={{
                height: "var(--admshell-topbar-h)",
                background: "var(--admshell-topbar)",
                borderBottom: "1px solid var(--adm-border)",
                padding: "0 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                position: "sticky", top: 0, zIndex: 50,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                gap: 12,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <button onClick={() => setMobileOpen(v => !v)} className="adm-mobile-btn" aria-label="Toggle menu">
                        {mobileOpen ? <FaTimes size={13} /> : <FaBars size={13} />}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--admshell-topbar-text)", letterSpacing: "-0.03em" }}>{currentLabel}</span>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {/* Notification Bell */}
                    <div ref={notifRef} style={{ position: "relative" }}>
                        <button onClick={toggleNotif} style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: notifOpen ? "var(--adm-primary-tint)" : "var(--adm-bg)",
                            border: `1.5px solid ${notifOpen ? "#bfdbfe" : "var(--adm-border)"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: notifOpen ? "var(--adm-primary)" : "var(--admshell-topbar-muted)", cursor: "pointer", position: "relative",
                            transition: "all 0.15s",
                        }}>
                            <FaBell size={13} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: "absolute", top: 4, right: 4,
                                    minWidth: 16, height: 16, borderRadius: 8,
                                    background: "var(--adm-danger)", border: "2px solid var(--adm-surface)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 9, fontWeight: 800, color: "#fff",
                                    padding: "0 4px", lineHeight: 1,
                                }}>
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {notifOpen && (
                            <NotificationDropdown
                                notifications={notifications}
                                unreadCount={unreadCount}
                                loading={notifLoading}
                                onMarkRead={markRead}
                                onMarkAllRead={markAllRead}
                                onNavigate={(link) => { setNotifOpen(false); navigate(link); }}
                            />
                        )}
                    </div>

                    {/* User Chip */}
                    <div className="adm-topbar-user-info" style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "var(--adm-bg)", border: "1.5px solid var(--adm-border)",
                        borderRadius: 12, padding: "5px 14px 5px 5px",
                        cursor: "default",
                    }}>
                        <Avatar name={admin?.name} size={34} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admshell-topbar-text)", lineHeight: 1.2 }}>{admin?.name || "Admin"}</div>
                            <div style={{ fontSize: 10, color: "var(--adm-muted)", textTransform: "capitalize", fontWeight: 500 }}>{admin?.role}</div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── BODY ── */}
            <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

                {/* Desktop Sidebar */}
                <aside
                    className="adm-desktop-sidebar"
                    style={{
                        width: "var(--admshell-sidebar-w)",
                        flexShrink: 0,
                        background: "var(--admshell-sidebar)",
                        height: "calc(100vh - var(--admshell-topbar-h))",
                        position: "sticky",
                        top: "var(--admshell-topbar-h)",
                        overflowY: "auto",
                    }}
                >
                    <SidebarContent admin={admin} logout={logout} onClose={closeMobile} />
                </aside>

                {/* Mobile Drawer Overlay */}
                {mobileOpen && (
                    <div onClick={closeMobile} style={{
                        position: "fixed", inset: 0, zIndex: 40,
                        background: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(4px)",
                        animation: "adm-fadeIn 0.15s ease",
                    }} />
                )}

                {/* Mobile Drawer */}
                {mobileOpen && (
                    <div style={{
                        position: "fixed", left: 0, top: 0, bottom: 0,
                        width: 270, background: "var(--admshell-sidebar)",
                        zIndex: 45, overflowY: "auto",
                        boxShadow: "8px 0 40px rgba(0,0,0,0.3)",
                        animation: "adm-slideIn 0.2s ease",
                    }}>
                        <SidebarContent admin={admin} logout={logout} onClose={closeMobile} />
                    </div>
                )}

                {/* ── Main content ── */}
                <main
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        overflowY: "auto",
                        overflowX: "hidden",
                        background: "var(--admshell-bg)",
                        padding: isFullBleed ? 0 : "24px",
                    }}
                    className={isFullBleed ? "" : "adm-main-content"}
                >
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

/* Wraps the shell in the ONE shared admin WebSocket connection — every
   descendant admin page consumes it via useAdminWsContext() instead of
   opening its own socket. */
const Admin = () => (
    <AdminWsProvider>
        <AdminShell />
    </AdminWsProvider>
);

export default Admin;