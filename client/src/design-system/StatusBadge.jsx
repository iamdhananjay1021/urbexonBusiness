import Badge from "./Badge";
import { cn } from "./utils/cn";

/**
 * Signal Design System — StatusBadge
 * Maps the platform's real status strings (order/vendor/delivery/payment) to
 * a semantic variant automatically, so every status pill across Client/Admin/
 * Vendor/Delivery renders identically. Falls back to "neutral" for anything
 * not in the map, rather than throwing.
 */
const STATUS_MAP = {
  // Order lifecycle
  PLACED: "info",
  CONFIRMED: "info",
  PACKED: "info",
  READY_FOR_PICKUP: "info",
  SHIPPED: "info",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  CANCELLED: "error",
  // Payment
  PAID: "success",
  PENDING: "warning",
  FAILED: "error",
  REFUNDED: "neutral",
  // Vendor / Delivery approval
  approved: "success",
  pending: "warning",
  under_review: "warning",
  rejected: "error",
  suspended: "error",
  // Subscription
  active: "success",
  expired: "error",
  inactive: "neutral",
};

const DOT_CLASSES = {
  neutral: "bg-[var(--color-graphite-400)]",
  accent: "bg-accent",
  success: "bg-[var(--color-success-500)]",
  error: "bg-[var(--color-error-500)]",
  warning: "bg-[var(--color-warning-500)]",
  info: "bg-[var(--color-info-500)]",
  hour: "bg-hour",
};

const StatusBadge = ({ status, label, className = "" }) => {
  const variant = STATUS_MAP[status] || "neutral";
  const text = label || String(status || "").replace(/_/g, " ");

  return (
    <Badge variant={variant} className={cn("gap-1.5", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[variant])} aria-hidden="true" />
      <span className="capitalize">{text.toLowerCase()}</span>
    </Badge>
  );
};

export default StatusBadge;
