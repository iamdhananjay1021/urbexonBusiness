import { forwardRef, useId } from "react";
import { cn } from "./utils/cn";

/** Signal Design System — Radio. Same flattened-sibling pattern as Checkbox (see its comment). */
const Radio = forwardRef(({ label, description, className = "", id, ...rest }, ref) => {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <label htmlFor={inputId} className={cn("inline-flex items-start gap-2.5 cursor-pointer group", className)}>
      <span className="relative flex-shrink-0 mt-0.5 h-4 w-4">
        <input
          ref={ref}
          id={inputId}
          type="radio"
          className="peer absolute inset-0 h-4 w-4 opacity-0 cursor-pointer"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-full border transition-colors duration-150",
            "border-strong bg-surface",
            "peer-checked:border-[var(--accent-primary)]",
            "peer-focus-visible:outline-none peer-focus-visible:[box-shadow:0_0_0_3px_var(--focus-ring)]",
            "peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"
          )}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent scale-0 peer-checked:scale-100 transition-transform duration-150"
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

Radio.displayName = "Radio";
export default Radio;
