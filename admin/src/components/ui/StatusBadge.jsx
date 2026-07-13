/**
 * StatusBadge.jsx — one status→color mapping for the whole admin panel.
 * Every page previously hand-mapped its own status strings to its own
 * locally-defined colors (order statuses in AdminOrders.jsx, vendor
 * statuses in AdminVendors.jsx, rider statuses in AdminDeliveryBoys.jsx,
 * subscription/plan statuses in AdminSubscriptions.jsx, refund statuses in
 * AdminRefundReturn.jsx) — five independent copies of the same idea, each
 * with slightly different colors for conceptually-identical states (e.g.
 * "pending" was amber in one page, blue in another). This is the single
 * lookup every page should use going forward; unknown/未-mapped strings
 * fall back to a readable neutral chip instead of silently rendering
 * unstyled text.
 */
import Badge from "./Badge";

const STATUS_MAP = {
    // Order lifecycle
    PLACED: { tone: "info", label: "Placed" },
    CONFIRMED: { tone: "primary", label: "Confirmed" },
    PACKED: { tone: "primary", label: "Packed" },
    READY_FOR_PICKUP: { tone: "warning", label: "Ready for Pickup" },
    SEARCHING_RIDER: { tone: "warning", label: "Finding Rider" },
    ASSIGNED: { tone: "primary", label: "Rider Assigned" },
    ARRIVING_VENDOR: { tone: "primary", label: "Heading to Store" },
    PICKED_UP: { tone: "info", label: "Picked Up" },
    OUT_FOR_DELIVERY: { tone: "warning", label: "Out for Delivery" },
    SHIPPED: { tone: "info", label: "Shipped" },
    DELIVERED: { tone: "success", label: "Delivered" },
    CANCELLED: { tone: "danger", label: "Cancelled" },
    FAILED: { tone: "danger", label: "Failed" },
    REFUNDED: { tone: "neutral", label: "Refunded" },

    // Return / replacement flow
    RETURN_REQUESTED: { tone: "warning", label: "Return Requested" },
    REPLACEMENT_REQUESTED: { tone: "info", label: "Replacement Requested" },
    REPLACEMENT_APPROVED: { tone: "success", label: "Replacement Approved" },

    // Vendor / rider / document approval
    approved: { tone: "success", label: "Approved" },
    pending: { tone: "warning", label: "Pending" },
    under_review: { tone: "info", label: "Under Review" },
    rejected: { tone: "danger", label: "Rejected" },
    suspended: { tone: "danger", label: "Suspended" },

    // Refund / return / replacement lifecycle (AdminRefundReturn.jsx)
    NONE: { tone: "neutral", label: "None" },
    REQUESTED: { tone: "warning", label: "Requested" },
    PROCESSED: { tone: "success", label: "Processed" },
    APPROVED: { tone: "success", label: "Approved" },
    REJECTED: { tone: "danger", label: "Rejected" },

    // Subscription lifecycle (AdminSubscriptions.jsx)
    active: { tone: "success", label: "Active" },
    expired: { tone: "danger", label: "Expired" },
    cancelled: { tone: "neutral", label: "Cancelled" },
    pending_payment: { tone: "warning", label: "Pending Payment" },
    inactive: { tone: "neutral", label: "Inactive" },
    none: { tone: "neutral", label: "No Plan" },

    // Payout / settlement
    PAID: { tone: "success", label: "Paid" },
    UNPAID: { tone: "warning", label: "Unpaid" },
    PROCESSING: { tone: "info", label: "Processing" },

    // Generic online/offline
    online: { tone: "success", label: "Online" },
    offline: { tone: "neutral", label: "Offline" },

    // Support ticket lifecycle + priority (AdminCustomerSupport.jsx)
    open: { tone: "info", label: "Open" },
    in_progress: { tone: "primary", label: "In Progress" },
    waiting_customer: { tone: "warning", label: "Waiting Customer" },
    resolved: { tone: "success", label: "Resolved" },
    closed: { tone: "neutral", label: "Closed" },
    low: { tone: "neutral", label: "Low" },
    normal: { tone: "info", label: "Normal" },
    high: { tone: "warning", label: "High" },
    urgent: { tone: "danger", label: "Urgent" },
};

const StatusBadge = ({ status, dot = true, className = "" }) => {
    const key = typeof status === "string" ? status : String(status ?? "");
    const cfg = STATUS_MAP[key] || { tone: "neutral", label: key.replace(/_/g, " ") || "Unknown" };
    return (
        <Badge tone={cfg.tone} dot={dot} className={className}>
            {cfg.label}
        </Badge>
    );
};

export default StatusBadge;
