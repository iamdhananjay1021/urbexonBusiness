/**
 * FilterDrawer — mobile bottom sheet hosting the same FilterSidebar.
 * Filters apply live (URL-synced); "Show results" just closes the sheet.
 */
import { memo, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { useFilterContext } from "../../context/FilterContext";
import FilterSidebar from "./FilterSidebar";

const FilterDrawer = memo(({ open, onClose }) => {
    const { total, clearAll, hasActiveFilters } = useFilterContext();

    /* Body scroll lock while open */
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    /* Escape closes */
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                aria-hidden="true"
                className={`lg:hidden fixed inset-0 z-[700] bg-[var(--bg-overlay)] transition-opacity duration-250
                            ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            />
            {/* Sheet */}
            <div
                role="dialog" aria-modal="true" aria-label="Filters"
                className={`lg:hidden fixed left-0 right-0 bottom-0 z-[701] bg-white rounded-t-2xl
                            max-h-[82vh] flex flex-col shadow-[0_-8px_32px_rgba(20,21,26,.18)]
                            transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                            ${open ? "translate-y-0" : "translate-y-full"}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--color-graphite-100)] shrink-0">
                    <span className="text-[15px] font-bold text-primary">Filters</span>
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <button
                                onClick={clearAll}
                                className="text-[12px] font-semibold text-error px-2 py-1 rounded-lg focus-ring-accent"
                            >
                                Clear all
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            aria-label="Close filters"
                            className="w-8 h-8 rounded-full bg-[var(--color-graphite-50)] flex items-center justify-center
                                       text-secondary hover:text-primary transition-colors duration-200 focus-ring-accent"
                        >
                            <FiX size={15} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 pb-4">
                    {open && <FilterSidebar />}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--color-graphite-100)] shrink-0 bg-white">
                    <button
                        onClick={onClose}
                        className="w-full h-12 rounded-xl bg-accent hover:bg-accent-hover text-white
                                   text-sm font-bold transition-colors duration-200 focus-ring-accent"
                    >
                        Show {total.toLocaleString("en-IN")} results
                    </button>
                </div>
            </div>
        </>
    );
});
FilterDrawer.displayName = "FilterDrawer";
export default FilterDrawer;
