/**
 * Modal.jsx — the one accessible modal/dialog primitive for vendor-panel.
 * Previously every page hand-rolled its own fixed-overlay div (Layout.jsx's
 * mobile sidebar, Settings.jsx x2, Support.jsx, Wallet.jsx) — none with
 * dialog semantics, a focus trap, or an Escape handler. This wraps the
 * exact same visual shape (dark overlay, centered white panel) those all
 * already used, so swapping it in is a pure a11y fix, not a redesign.
 */
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const Modal = ({ open, onClose, title, children, width = 460, closeOnOverlayClick = true }) => {
    const panelRef = useRef(null);
    const previouslyFocused = useRef(null);

    useEffect(() => {
        if (!open) return;
        previouslyFocused.current = document.activeElement;
        const panel = panelRef.current;
        const focusable = panel?.querySelectorAll(FOCUSABLE_SELECTOR);
        (focusable?.[0] || panel)?.focus();

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose?.();
                return;
            }
            if (e.key === "Tab" && focusable?.length) {
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previouslyFocused.current?.focus?.();
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            onClick={closeOnOverlayClick ? onClose : undefined}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title || undefined}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: width, padding: 24, maxHeight: "90vh", overflowY: "auto", animation: "fadeUp .25s ease" }}
            >
                {children}
            </div>
        </div>
    );
};

export default Modal;
