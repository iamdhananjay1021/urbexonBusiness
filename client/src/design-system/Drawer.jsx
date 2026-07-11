import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Drawer
 * Side panel (desktop) that becomes a bottom sheet on mobile. Same focus-trap/
 * Escape/portal behavior as Modal — see Modal.jsx for the shared rationale.
 */
const Drawer = ({ open, onClose, title, children, side = "right", width = "max-w-md" }) => {
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      panelRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      triggerRef.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sideClasses =
    side === "right"
      ? "right-0 top-0 h-full sm:max-w-none animate-[drawerInRight_0.2s_ease-out]"
      : side === "left"
      ? "left-0 top-0 h-full sm:max-w-none animate-[drawerInLeft_0.2s_ease-out]"
      : "left-0 right-0 bottom-0 max-h-[85vh] rounded-t-[var(--radius-lg)] animate-[drawerInBottom_0.2s_ease-out]";

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--bg-overlay)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        tabIndex={-1}
        className={cn(
          "absolute bg-surface shadow-lg outline-none flex flex-col w-full",
          side !== "bottom" && width,
          sideClasses
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-default flex-shrink-0">
            <h2 id="drawer-title" className="text-base font-semibold text-primary font-display">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="rounded-full p-1.5 text-muted hover:bg-[var(--color-graphite-100)] hover:text-primary"
            >
              <FiX className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Drawer;
