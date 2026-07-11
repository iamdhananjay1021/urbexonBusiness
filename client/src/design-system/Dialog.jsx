import Modal from "./Modal";
import Button from "./Button";

/**
 * Signal Design System — Dialog
 * Confirm/alert pattern built on Modal — for "Delete this?", "Are you sure?"
 * style interactions. Not a separate overlay implementation; reuses Modal's
 * focus-trap/Escape/portal behavior entirely.
 */
const Dialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary", // "primary" | "danger"
  loading = false,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    {description && <p className="text-sm text-secondary">{description}</p>}
  </Modal>
);

export default Dialog;
