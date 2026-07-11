import { useEffect, useRef, useState } from "react";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Dropdown
 * Simple trigger + menu pattern. Closes on outside click, Escape, or item
 * select. role="menu"/"menuitem" with arrow-key navigation for a11y.
 */
const Dropdown = ({ trigger, items = [], align = "right", className = "" }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleMenuKeyDown = (e, idx) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemRefs.current[idx + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemRefs.current[idx - 1]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="focus-ring-accent rounded-[var(--radius-sm)]"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-1.5 min-w-[180px] rounded-[var(--radius-md)] bg-surface border border-default shadow-md py-1.5",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, idx) =>
            item.divider ? (
              <div key={`div-${idx}`} className="my-1.5 border-t border-default" role="separator" />
            ) : (
              <button
                key={item.label}
                ref={(el) => (itemRefs.current[idx] = el)}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onKeyDown={(e) => handleMenuKeyDown(e, idx)}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors duration-100",
                  item.danger ? "text-error hover:bg-error-tint" : "text-primary hover:bg-[var(--color-graphite-100)]",
                  item.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
              >
                {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
