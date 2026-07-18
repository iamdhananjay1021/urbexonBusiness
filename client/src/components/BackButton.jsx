/**
 * BackButton.jsx — single shared "go back" control for the whole client app.
 *
 * Previously every page hand-rolled its own back button — different icon
 * sizes, different positions (top-left, centered in a header row, floating
 * over content), different hover styles, and a couple of different "smart
 * back" implementations (some pages did a blind `navigate(-1)`, which exits
 * the site entirely when the page was opened directly via refresh/deep
 * link/notification tap, since there's no in-app history to go back to).
 *
 * This component is the one implementation, reused everywhere:
 * - Same icon, same size, same hover/active treatment.
 * - Smart back: uses real in-app history (`navigate(-1)`) when it exists;
 *   otherwise falls back to a caller-supplied route instead of leaving the
 *   app. React Router stamps `location.key === "default"` exactly when a
 *   page was opened with no history the router itself pushed.
 * - Three layout variants for the contexts that exist in this app:
 *     - default: a fixed, top-left circular button for ordinary content
 *       pages (Profile, Cart, ProductDetails, etc).
 *     - inline: a plain (non-fixed) icon button for pages that already
 *       have their own bespoke header bar (Checkout, UHCheckout, Login,
 *       Register) — same icon/style, laid out inline instead of floating.
 *     - inline with a `label` — same inline control, plus a descriptive
 *       text label (e.g. "Back to Orders") for the couple of pages
 *       (OrderDetails) where a bare icon would lose useful context an
 *       explicit label already gave the user.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { cn } from "../design-system/utils/cn";

const BackButton = ({ fallback = "/", variant = "default", label, onClick, className = "", "aria-label": ariaLabel = "Go back" }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleClick = () => {
        if (onClick) return onClick();
        if (location.key !== "default") navigate(-1);
        else navigate(fallback);
    };

    if (label) {
        return (
            <button
                type="button"
                onClick={handleClick}
                aria-label={ariaLabel}
                className={cn("inline-flex items-center gap-1.5 text-muted hover:text-primary text-xs font-bold uppercase tracking-wide transition-colors bg-transparent border-none cursor-pointer p-0", className)}
            >
                <FiArrowLeft size={10} aria-hidden="true" /> {label}
            </button>
        );
    }

    const base = "inline-flex items-center justify-center rounded-full bg-surface border border-default text-secondary shadow-sm hover:text-accent hover:border-[var(--accent-primary)] active:scale-95 transition-all duration-150 focus-ring-accent";

    if (variant === "inline") {
        return (
            <button
                type="button"
                onClick={handleClick}
                aria-label={ariaLabel}
                className={cn(base, "w-9 h-9 flex-shrink-0", className)}
            >
                <FiArrowLeft size={16} aria-hidden="true" />
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={ariaLabel}
            className={cn(base, "fixed top-[calc(var(--nav-h,0px)+env(safe-area-inset-top,0px)+14px)] left-4 z-[590] w-10 h-10", className)}
        >
            <FiArrowLeft size={17} aria-hidden="true" />
        </button>
    );
};

export default BackButton;
