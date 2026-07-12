/**
 * Button.jsx — the one button system for the admin panel.
 * Replaces the dozens of hand-rolled `<button style={{...}}>` blocks
 * scattered across pages (each with its own padding/radius/font-size).
 */
const Button = ({
    variant = "primary", // primary | secondary | success | danger | ghost
    size = "md", // sm | md | lg
    icon: Icon,
    loading = false,
    disabled = false,
    className = "",
    children,
    ...rest
}) => (
    <button
        className={`adm-btn adm-btn-${variant} adm-btn-${size} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
    >
        {loading ? <span className="adm-btn-spinner" /> : Icon ? <Icon size={size === "sm" ? 12 : 14} /> : null}
        {children}
    </button>
);

export default Button;
