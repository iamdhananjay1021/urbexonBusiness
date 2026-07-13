/**
 * StatTile.jsx — the one metric/stat-card system for the admin panel.
 * Replaces the near-duplicate local StatCard/Stat components each page
 * hand-rolled independently (AdminDashboard.jsx's StatCard, AdminMapDashboard
 * .jsx's Stat) — same icon-box + label + value shape, three separate
 * implementations before this.
 */
const StatTile = ({ icon: Icon, label, value, tone = "primary", sublabel, onClick }) => (
    <div
        className={`adm-stat-tile${onClick ? " adm-stat-tile-clickable" : ""}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
    >
        {Icon && (
            <div className={`adm-stat-tile-icon adm-stat-tile-icon-${tone}`}>
                <Icon size={16} />
            </div>
        )}
        <div className="adm-stat-tile-body">
            <div className="adm-stat-tile-value">{value}</div>
            <div className="adm-stat-tile-label">{label}</div>
            {sublabel && <div className="adm-stat-tile-sublabel">{sublabel}</div>}
        </div>
    </div>
);

export default StatTile;
