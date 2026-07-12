import { FiInbox } from "react-icons/fi";

/**
 * EmptyState.jsx — the one "nothing here" system for the admin panel.
 */
const EmptyState = ({ icon: Icon = FiInbox, title = "Nothing here yet", description, action }) => (
    <div className="adm-empty">
        <Icon size={32} className="adm-empty-icon" />
        <p className="adm-empty-title">{title}</p>
        {description && <p className="adm-empty-desc">{description}</p>}
        {action && <div style={{ marginTop: "var(--adm-space-4)" }}>{action}</div>}
    </div>
);

export default EmptyState;
