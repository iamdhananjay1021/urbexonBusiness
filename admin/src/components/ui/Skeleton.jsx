/**
 * Skeleton.jsx — the one loading-placeholder system for the admin panel.
 */
const Skeleton = ({ width = "100%", height = 16, radius, className = "", style }) => (
    <div
        className={`adm-skeleton ${className}`}
        style={{ width, height, borderRadius: radius, ...style }}
        aria-hidden="true"
    />
);

export default Skeleton;
