import { cn } from "./utils/cn";

/** Signal Design System — Badge. Simple label/count pill, semantic color variants. */
const VARIANT_CLASSES = {
  neutral: "bg-[var(--color-graphite-100)] text-secondary",
  accent: "bg-accent-tint text-accent",
  success: "bg-success-tint text-success",
  error: "bg-error-tint text-error",
  warning: "bg-warning-tint text-warning",
  info: "bg-info-tint text-info",
  hour: "bg-hour-tint text-on-hour",
};

const Badge = ({ children, variant = "neutral", className = "" }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
      VARIANT_CLASSES[variant],
      className
    )}
  >
    {children}
  </span>
);

export default Badge;
