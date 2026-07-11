import { forwardRef } from "react";

/**
 * Signal Design System — Button
 * Variants: primary | secondary | outline | ghost | danger | success | icon | hour
 * Sizes: sm (36px) | md (40px, default) | lg (44px)
 * Handles: hover/active/focus-visible/disabled/loading states per the approved spec.
 * Dark mode: automatic via CSS custom properties (no separate dark: classes needed
 * for the semantic tokens — --bg-surface/--text-primary/etc already swap under .dark).
 */

const SIZE_CLASSES = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
};

const ICON_SIZE_CLASSES = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-11 w-11",
};

const VARIANT_CLASSES = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-hover disabled:bg-[var(--color-graphite-200)] disabled:text-[var(--color-graphite-400)]",
  secondary:
    "bg-surface text-primary border border-strong hover:bg-canvas active:bg-[var(--color-graphite-100)] disabled:bg-[var(--color-graphite-100)] disabled:text-muted disabled:border-default",
  outline:
    "bg-transparent text-accent border border-[var(--accent-primary)] hover:bg-accent-tint active:bg-accent-tint disabled:text-[var(--color-graphite-400)] disabled:border-default",
  ghost:
    "bg-transparent text-primary hover:bg-[var(--color-graphite-100)] active:bg-[var(--color-graphite-200)] disabled:text-muted",
  danger:
    "bg-[var(--color-error-500)] text-white hover:bg-[var(--color-error-700)] active:bg-[var(--color-error-700)] disabled:bg-error-tint disabled:text-[var(--color-error-500)]/40",
  success:
    "bg-[var(--color-success-500)] text-white hover:bg-[var(--color-success-700)] active:bg-[var(--color-success-700)] disabled:bg-success-tint",
  hour:
    "bg-hour text-on-hour hover:bg-hour-hover active:bg-hour-hover disabled:bg-hour-tint disabled:text-[var(--color-graphite-400)]",
};

const Spinner = ({ className = "" }) => (
  <svg
    className={`animate-spin ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path
      className="opacity-90"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
    />
  </svg>
);

const Button = forwardRef(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      icon: Icon,
      iconOnly = false,
      "aria-label": ariaLabel,
      className = "",
      type = "button",
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const sizeClass = iconOnly ? ICON_SIZE_CLASSES[size] : SIZE_CLASSES[size];

    if (iconOnly && !ariaLabel) {
      // Icon-only buttons must always have an accessible name — fail loudly in dev
      // rather than silently shipping an unlabeled control (WCAG 4.1.2).
      if (import.meta.env?.DEV) {
        console.warn("[Button] iconOnly buttons require an aria-label.");
      }
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={iconOnly ? ariaLabel : undefined}
        aria-busy={loading || undefined}
        className={[
          "inline-flex items-center justify-center font-medium rounded-md",
          "transition-colors duration-150 ease-out select-none",
          "disabled:cursor-not-allowed disabled:pointer-events-none",
          "focus-ring-accent",
          sizeClass,
          VARIANT_CLASSES[variant],
          loading ? "relative" : "",
          className,
        ].join(" ")}
        {...rest}
      >
        {loading ? (
          <>
            <span className="invisible inline-flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              {!iconOnly && children}
            </span>
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner className="h-4 w-4" />
            </span>
          </>
        ) : (
          <>
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {!iconOnly && children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
