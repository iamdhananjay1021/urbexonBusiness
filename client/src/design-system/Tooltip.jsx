import { useId } from "react";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Tooltip
 * CSS-only (group-hover + focus-within) — no floating-ui dependency needed
 * for simple fixed-placement tooltips. Shows on hover AND keyboard focus
 * (not hover-only) for accessibility; content is always in the DOM with
 * aria-describedby wired to the trigger, so screen readers get it regardless
 * of visual hover state.
 */
const PLACEMENT_CLASSES = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const Tooltip = ({ children, content, placement = "top", className = "" }) => {
  const id = useId();

  return (
    <span className={cn("relative inline-flex group", className)}>
      <span aria-describedby={id} tabIndex={-1} className="inline-flex">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-graphite-900)] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-md transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          PLACEMENT_CLASSES[placement]
        )}
      >
        {content}
      </span>
    </span>
  );
};

export default Tooltip;
