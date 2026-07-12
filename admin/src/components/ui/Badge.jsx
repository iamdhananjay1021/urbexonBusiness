/**
 * Badge.jsx — the one status-chip system for the admin panel.
 * Replaces the 5+ independent StatusBadge/Badge/pill implementations found
 * across AdminOrders, AdminVendors, AdminDeliveryBoys, AdminSubscriptions,
 * AdminRefundReturn, AdminCustomers, AdminMapDashboard.
 */
const TONE_MAP = {
    primary: "adm-badge-primary",
    success: "adm-badge-success",
    warning: "adm-badge-warning",
    danger: "adm-badge-danger",
    info: "adm-badge-info",
    neutral: "adm-badge-neutral",
};

const Badge = ({ tone = "neutral", dot = false, children, className = "" }) => (
    <span className={`adm-badge ${TONE_MAP[tone] || TONE_MAP.neutral} ${className}`}>
        {dot && <span className="adm-badge-dot" />}
        {children}
    </span>
);

export default Badge;
