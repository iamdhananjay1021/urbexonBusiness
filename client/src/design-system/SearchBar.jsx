import { FiSearch, FiX } from "react-icons/fi";
import { cn } from "./utils/cn";

/**
 * Signal Design System — SearchBar
 * Search icon + clear button + optional dropdown slot (suggestions/results)
 * rendered by the caller as children, positioned via the wrapping relative container.
 */
const SearchBar = ({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = "Search…",
  size = "md",
  className = "",
  children,
  ...rest
}) => {
  const sizeClass = { sm: "h-9 text-sm", md: "h-10 text-sm", lg: "h-11 text-base" }[size];

  return (
    <div className={cn("relative w-full", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(value);
        }}
      >
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn(
            "w-full rounded-full bg-surface border border-default pl-9 pr-9 transition-colors duration-150",
            "text-primary placeholder:text-muted",
            "focus:outline-none focus-ring-accent focus:border-[var(--accent-primary)]",
            sizeClass
          )}
          {...rest}
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted hover:text-primary"
          >
            <FiX className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>
      {children}
    </div>
  );
};

export default SearchBar;
