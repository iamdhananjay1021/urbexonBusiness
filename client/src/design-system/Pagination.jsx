import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Pagination
 * Generates a compact page list with ellipsis for large ranges
 * (e.g. 1 … 4 5 [6] 7 8 … 20). All controls are real <button>s with labels.
 */
const getPageList = (current, total) => {
  const pages = [];
  const neighborRange = 1;
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= current - neighborRange && p <= current + neighborRange)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }
  return pages;
};

const Pagination = ({ page, totalPages, onChange, className = "" }) => {
  if (totalPages <= 1) return null;
  const pages = getPageList(page, totalPages);

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-sm)] text-secondary hover:bg-[var(--color-graphite-100)] disabled:opacity-30 disabled:pointer-events-none focus-ring-accent"
      >
        <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`ellipsis-${idx}`} className="h-9 w-9 flex items-center justify-center text-muted text-sm">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-[var(--radius-sm)] text-sm font-medium focus-ring-accent",
              p === page ? "bg-accent text-white" : "text-secondary hover:bg-[var(--color-graphite-100)]"
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-sm)] text-secondary hover:bg-[var(--color-graphite-100)] disabled:opacity-30 disabled:pointer-events-none focus-ring-accent"
      >
        <FiChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
};

export default Pagination;
