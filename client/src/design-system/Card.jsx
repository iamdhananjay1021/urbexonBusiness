import { cn } from "./utils/cn";

/**
 * Signal Design System — Card
 * Base surface: white/dark-surface bg, subtle border, resting shadow-xs,
 * hover shadow-sm if interactive. Padding density controlled via `padding`.
 */
const PADDING_CLASSES = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const Card = ({ children, interactive = false, padding = "md", className = "", ...rest }) => (
  <div
    className={cn(
      "bg-surface border border-default rounded-[var(--radius-md)] shadow-xs transition-shadow duration-150",
      interactive && "hover:shadow-sm cursor-pointer",
      PADDING_CLASSES[padding],
      className
    )}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = "" }) => (
  <div className={cn("flex items-center justify-between mb-3", className)}>{children}</div>
);

export const CardTitle = ({ children, className = "" }) => (
  <h3 className={cn("text-[15px] font-semibold text-primary font-display", className)}>{children}</h3>
);

export const CardFooter = ({ children, className = "" }) => (
  <div className={cn("flex items-center justify-between mt-4 pt-3 border-t border-default", className)}>
    {children}
  </div>
);

export default Card;
