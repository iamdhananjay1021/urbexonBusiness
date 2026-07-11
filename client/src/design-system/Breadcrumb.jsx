import { Link } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";
import { cn } from "./utils/cn";

/** Signal Design System — Breadcrumb. Last item is the current page (not a link). */
const Breadcrumb = ({ items = [], className = "" }) => (
  <nav aria-label="Breadcrumb" className={cn("flex items-center flex-wrap gap-1.5 text-sm", className)}>
    <ol className="flex items-center flex-wrap gap-1.5">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <li key={item.label} className="flex items-center gap-1.5">
            {idx > 0 && <FiChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
            {isLast || !item.href ? (
              <span aria-current={isLast ? "page" : undefined} className="text-primary font-medium">
                {item.label}
              </span>
            ) : (
              <Link to={item.href} className="text-secondary hover:text-accent transition-colors">
                {item.label}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default Breadcrumb;
