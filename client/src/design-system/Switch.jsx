import { forwardRef, useId } from "react";
import { cn } from "./utils/cn";

/** Signal Design System — Switch (toggle). role="switch" for correct a11y semantics. */
const Switch = forwardRef(({ label, description, className = "", id, ...rest }, ref) => {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <label htmlFor={inputId} className={cn("inline-flex items-start gap-3 cursor-pointer group", className)}>
      <span className="relative flex-shrink-0 h-6 w-10">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          className="peer absolute inset-0 h-6 w-10 opacity-0 cursor-pointer"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-full transition-colors duration-150",
            "bg-[var(--color-graphite-300)] peer-checked:bg-accent",
            "peer-focus-visible:outline-none peer-focus-visible:[box-shadow:0_0_0_3px_var(--focus-ring)]",
            "peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"
          )}
        />
        <span
          aria-hidden="true"
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-4"
        />
      </span>
      {(label || description) && (
        <span className="text-sm leading-tight">
          {label && <span className="text-primary font-medium">{label}</span>}
          {description && <span className="block text-xs text-secondary mt-0.5">{description}</span>}
        </span>
      )}
    </label>
  );
});

Switch.displayName = "Switch";
export default Switch;
