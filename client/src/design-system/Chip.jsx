import { FiX } from "react-icons/fi";
import { cn } from "./utils/cn";

/** Signal Design System — Chip. For filters, tags, selected-option pills. */
const Chip = ({ children, selected = false, onRemove, onClick, className = "" }) => {
  const Element = onClick ? "button" : "span";
  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
        selected
          ? "bg-accent-tint border-[var(--accent-primary)] text-accent"
          : "bg-surface border-default text-secondary hover:border-strong",
        onClick && "cursor-pointer focus-ring-accent",
        className
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove"
          className="rounded-full hover:bg-[var(--color-graphite-200)] p-0.5 -mr-1"
        >
          <FiX className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </Element>
  );
};

export default Chip;
