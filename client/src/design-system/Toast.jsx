import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from "react-icons/fi";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Toast
 * Transient, auto-dismissing notification (distinct from Alert, which is a
 * persistent inline banner). aria-live="polite" region so screen-reader
 * users get updates without navigating, per the approved a11y spec.
 *
 * NOTE: this is the design-system implementation. The existing app-level
 * Toast at src/components/Toast.jsx stays untouched for now — consolidation
 * happens during the page-wiring phase, not here, per "don't wire into pages
 * yet."
 */
const ToastContext = createContext(null);

const CONFIG = {
  success: { icon: FiCheckCircle, iconColor: "text-[var(--color-success-500)]" },
  error: { icon: FiAlertCircle, iconColor: "text-[var(--color-error-500)]" },
  warning: { icon: FiAlertTriangle, iconColor: "text-[var(--color-warning-500)]" },
  info: { icon: FiInfo, iconColor: "text-[var(--color-info-500)]" },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, { variant = "info", duration = 4000 } = {}) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          className="fixed top-4 right-4 z-[1100] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
        >
          {toasts.map((t) => {
            const { icon: Icon, iconColor } = CONFIG[t.variant];
            return (
              <div
                key={t.id}
                role="status"
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius-md)] bg-surface border border-default shadow-lg p-3.5",
                  "animate-[toastIn_0.2s_ease-out]"
                )}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconColor)} aria-hidden="true" />
                <p className="flex-1 text-sm text-primary">{t.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="flex-shrink-0 rounded-full p-1 text-muted hover:bg-[var(--color-graphite-100)]"
                >
                  <FiX className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};
