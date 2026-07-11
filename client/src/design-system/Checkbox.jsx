import { forwardRef, useEffect, useId, useRef } from "react";
import { FiCheck, FiMinus } from "react-icons/fi";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Checkbox
 * Visually hidden native input (keeps full keyboard/screen-reader semantics)
 * with a styled custom box. Supports indeterminate state.
 *
 * NOTE: all state-reactive elements below (ring, check icon, minus icon) are
 * kept as DIRECT SIBLINGS of the input — Tailwind's peer-* variants only
 * match direct siblings via the CSS general sibling combinator, not nested
 * descendants of a sibling.
 */
const Checkbox = forwardRef(
  ({ label, description, indeterminate = false, className = "", id, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    const innerRef = useRef(null);

    useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
      <label htmlFor={inputId} className={cn("inline-flex items-start gap-2.5 cursor-pointer group", className)}>
        <span className="relative flex-shrink-0 mt-0.5 h-4 w-4">
          <input
            ref={(node) => {
              innerRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            id={inputId}
            type="checkbox"
            className="peer absolute inset-0 h-4 w-4 opacity-0 cursor-pointer"
            {...rest}
          />
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 rounded-[4px] border transition-colors duration-150",
              "border-strong bg-surface",
              "peer-checked:bg-accent peer-checked:border-[var(--accent-primary)]",
              "peer-focus-visible:outline-none peer-focus-visible:[box-shadow:0_0_0_3px_var(--focus-ring)]",
              "peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"
            )}
          />
          <FiMinus
            aria-hidden="true"
            className="absolute inset-0 h-3 w-3 m-auto text-white opacity-0 peer-indeterminate:opacity-100"
          />
          <FiCheck
            aria-hidden="true"
            className="absolute inset-0 h-3 w-3 m-auto text-white opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
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
  }
);

Checkbox.displayName = "Checkbox";
export default Checkbox;
