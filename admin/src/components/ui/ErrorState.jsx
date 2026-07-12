import { FiAlertTriangle } from "react-icons/fi";
import Button from "./Button";

/**
 * ErrorState.jsx — the one error-display system for the admin panel.
 */
const ErrorState = ({ message = "Something went wrong.", onRetry }) => (
    <div className="adm-error" role="alert">
        <FiAlertTriangle size={18} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{message}</span>
        {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>
        )}
    </div>
);

export default ErrorState;
