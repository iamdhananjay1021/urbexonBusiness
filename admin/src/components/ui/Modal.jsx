/**
 * Modal.jsx — the one modal system for the admin panel.
 *
 * - Closes on Escape and on overlay click
 * - Focuses the close button once when it opens (doesn't steal focus on
 *   every parent re-render — see note below)
 * - Traps Tab/Shift+Tab focus inside the modal while open
 * - Locks background scroll while open
 * - Restores focus to whatever triggered the modal, on close
 */
import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ open, onClose, title, children, footer, width = 480 }) => {
    const closeBtnRef = useRef(null);
    const dialogRef = useRef(null);
    const triggerElRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose; // always call the latest onClose, without re-running effects below

    // Focus the close button once, right when the modal opens, and remember
    // what had focus before so we can give it back on close.
    //
    // Deliberately depends only on [open] — NOT on [onClose]. onClose is
    // usually an inline arrow function from the parent (a new reference on
    // every parent render). If it were in this dependency array, every
    // keystroke in a form field inside the modal would re-render the parent,
    // recreate onClose, rerun this effect, and yank focus back onto the
    // close button mid-typing.
    useEffect(() => {
        if (!open) return;
        triggerElRef.current = document.activeElement;
        closeBtnRef.current?.focus();
        return () => {
            triggerElRef.current?.focus?.();
        };
    }, [open]);

    // Escape to close + Tab focus trap. Also only depends on [open].
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                onCloseRef.current?.();
                return;
            }
            if (e.key !== "Tab" || !dialogRef.current) return;

            const focusable = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open]);

    // Lock background scroll while the modal is open.
    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prevOverflow; };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="adm-modal-overlay"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <div
                ref={dialogRef}
                className="adm-modal"
                style={{ maxWidth: width }}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <div className="adm-modal-header">
                    <h3 className="adm-modal-title">{title}</h3>
                    <button
                        ref={closeBtnRef}
                        type="button"
                        className="adm-modal-close"
                        onClick={onClose}
                        aria-label="Close dialog"
                    >
                        <FiX size={16} />
                    </button>
                </div>
                <div className="adm-modal-body">{children}</div>
                {footer && <div className="adm-modal-footer">{footer}</div>}
            </div>
        </div>
    );
};

export default Modal;