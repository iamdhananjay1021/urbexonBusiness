import { FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi";
import { cn } from "./utils/cn";

/** Signal Design System — Alert. Inline, persistent banner (page/section-level), not a toast. */
const CONFIG = {
  success: { icon: FiCheckCircle, bg: "bg-success-tint", text: "text-success", iconColor: "text-[var(--color-success-500)]" },
  error: { icon: FiAlertCircle, bg: "bg-error-tint", text: "text-error", iconColor: "text-[var(--color-error-500)]" },
  warning: { icon: FiAlertTriangle, bg: "bg-warning-tint", text: "text-warning", iconColor: "text-[var(--color-warning-500)]" },
  info: { icon: FiInfo, bg: "bg-info-tint", text: "text-info", iconColor: "text-[var(--color-info-500)]" },
};

const Alert = ({ variant = "info", title, children, onDismiss, className = "" }) => {
  const { icon: Icon, bg, text, iconColor } = CONFIG[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-[var(--radius-md)] p-3.5", bg, className)}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconColor)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className={cn("text-sm font-semibold", text)}>{title}</p>}
        {children && <p className={cn("text-sm mt-0.5", text)}>{children}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn("flex-shrink-0 rounded-full p-1 hover:bg-black/5", text)}
        >
          <FiX className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default Alert;
