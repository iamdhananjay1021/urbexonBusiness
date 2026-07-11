import { forwardRef, useId } from "react";
import { FiChevronDown } from "react-icons/fi";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Select
 * Uses a native <select> (best a11y/mobile support) styled to match Input,
 * with a custom chevron icon overlay.
 */
const Select = forwardRef(
  (
    {
      label,
      helperText,
      error,
      required = false,
      size = "md",
      placeholder,
      options = [],
      className = "",
      id,
      ...rest
    },
    ref
  ) => {
    const autoId = useId();
    const inputId = id || autoId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    const sizeClass = { sm: "h-9 text-sm", md: "h-10 text-sm", lg: "h-11 text-base" }[size];

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-[13px] font-semibold text-primary mb-1.5">
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            aria-required={required || undefined}
            className={cn(
              "w-full appearance-none rounded-[var(--radius-sm)] bg-surface border transition-colors duration-150 pl-3.5 pr-9",
              "text-primary",
              "focus:outline-none focus-ring-accent",
              error
                ? "border-[var(--color-error-500)] focus:border-[var(--color-error-500)]"
                : "border-default focus:border-[var(--accent-primary)]",
              "disabled:bg-canvas disabled:text-muted disabled:cursor-not-allowed",
              sizeClass,
              className
            )}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <FiChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
            aria-hidden="true"
          />
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-xs text-error">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-1.5 text-xs text-secondary">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
