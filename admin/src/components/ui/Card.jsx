/**
 * Card.jsx — the one card system for the admin panel.
 */
export const Card = ({ children, padded = true, className = "", style }) => (
    <div className={`adm-card ${padded ? "adm-card-pad" : ""} ${className}`} style={style}>
        {children}
    </div>
);

export const CardHeader = ({ title, action, className = "" }) => (
    <div className={`adm-card-header ${className}`}>
        <h3 className="adm-card-title">{title}</h3>
        {action}
    </div>
);

export default Card;
