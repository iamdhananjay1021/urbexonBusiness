/**
 * FilterChips — the selected-filters row above the grid.
 * Each chip removes itself; "Clear all" resets every value filter.
 */
import { memo } from "react";
import { FiX } from "react-icons/fi";
import { useFilterContext } from "../../context/FilterContext";

const FilterChips = memo(() => {
    const { chips, removeChip, clearAll, hasActiveFilters } = useFilterContext();
    if (!hasActiveFilters) return null;

    return (
        <div className="flex items-center gap-2 flex-wrap" role="list" aria-label="Active filters">
            {chips.map((chip) => (
                <button
                    key={`${chip.group}:${chip.value}`}
                    role="listitem"
                    onClick={() => removeChip(chip)}
                    aria-label={`Remove filter ${chip.label}`}
                    className="group flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full
                               bg-accent-tint text-[12px] font-semibold text-[var(--accent-primary-hover)]
                               border border-transparent hover:border-[var(--accent-primary)]
                               transition-colors duration-200 capitalize focus-ring-accent"
                >
                    {chip.label}
                    <span className="w-4 h-4 rounded-full bg-white/70 flex items-center justify-center">
                        <FiX size={10} aria-hidden="true" />
                    </span>
                </button>
            ))}
            <button
                onClick={clearAll}
                className="h-8 px-3 rounded-full text-[12px] font-semibold text-secondary
                           hover:text-error transition-colors duration-200 focus-ring-accent"
            >
                Clear all
            </button>
        </div>
    );
});
FilterChips.displayName = "FilterChips";
export default FilterChips;
