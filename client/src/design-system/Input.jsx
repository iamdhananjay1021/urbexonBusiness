import { forwardRef, useId } from "react";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Input
 * Sizes: sm (36px) | md (40px, default) | lg (44px)
 * Handles label, helper text, error state (with aria-describedby/aria-invalid),
 * leading/trailing icon slots, and dark mode automatically via semantic tokens.
 */
const SIZE_CLASSES = {
  sm: "h-9 text-sm px-3",
  md: "h-10 text-sm px-3.5",
  lg: "h-11 text-base px-4",
};

const Input = forwardRef(
  (
    {
      label,
      helperText,
      error,
      required = false,
      size = "md",
      leadingIcon: LeadingIcon,
      trailingIcon: TrailingIcon,
      onTrailingIconClick,
      trailingIconLabel,
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
        <div className="relative">
          {LeadingIcon && (
            <LeadingIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
              aria-hidden="true"
            />
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error || undefined}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            aria-required={required || undefined}
            className={cn(
              "w-full rounded-[var(--radius-sm)] bg-surface border transition-colors duration-150",
              "text-primary placeholder:text-muted",
              "focus:outline-none focus-ring-accent",
              error
                ? "border-[var(--color-error-500)] focus:border-[var(--color-error-500)]"
                : "border-default focus:border-[var(--accent-primary)]",
              "disabled:bg-canvas disabled:text-muted disabled:cursor-not-allowed",
              LeadingIcon ? "pl-9" : "",
              TrailingIcon ? "pr-9" : "",
              SIZE_CLASSES[size],
              className
            )}
            {...rest}
          />
          {TrailingIcon && (
            <button
              type="button"
              onClick={onTrailingIconClick}
              aria-label={trailingIconLabel}
              tabIndex={onTrailingIconClick ? 0 : -1}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted",
                onTrailingIconClick ? "cursor-pointer hover:text-primary" : "pointer-events-none"
              )}
            >
              <TrailingIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
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

Input.displayName = "Input";
export default Input;
