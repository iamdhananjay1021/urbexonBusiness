import { forwardRef, useId } from "react";
import { cn } from "./utils/cn";

/** Signal Design System — Textarea. Mirrors Input's label/error/helper pattern. */
const Textarea = forwardRef(
  (
    {
      label,
      helperText,
      error,
      required = false,
      rows = 4,
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

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[13px] font-semibold text-primary mb-1.5"
          >
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          aria-required={required || undefined}
          className={cn(
            "w-full rounded-[var(--radius-sm)] bg-surface border transition-colors duration-150 px-3.5 py-2.5 text-sm",
            "text-primary placeholder:text-muted resize-y",
            "focus:outline-none focus-ring-accent",
            error
              ? "border-[var(--color-error-500)] focus:border-[var(--color-error-500)]"
              : "border-default focus:border-[var(--accent-primary)]",
            "disabled:bg-canvas disabled:text-muted disabled:cursor-not-allowed",
            className
          )}
          {...rest}
        />
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

Textarea.displayName = "Textarea";
export default Textarea;
