/**
 * FilterGroup — one collapsible section of the sidebar (Brand, Color, …).
 * Smooth expand/collapse via the CSS grid-rows transition; content stays
 * mounted so checkbox state never resets.
 */
import { memo, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

const FilterGroup = memo(({ title, count = 0, defaultOpen = true, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-[var(--color-graphite-100)] py-1">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="w-full flex items-center justify-between py-3 text-left cursor-pointer
                           focus-visible:outline-none focus-ring-accent rounded-lg"
            >
                <span className="text-[12px] font-bold text-primary uppercase tracking-[0.08em] flex items-center gap-2">
                    {title}
                    {count > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white
                                         text-[10px] font-bold flex items-center justify-center normal-case tracking-normal">
                            {count}
                        </span>
                    )}
                </span>
                <FiChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
            </button>
            <div
                className={`grid transition-[grid-template-rows] duration-250 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                aria-hidden={!open}
            >
                <div className="overflow-hidden">
                    <div className="pb-4">{children}</div>
                </div>
            </div>
        </div>
    );
});
FilterGroup.displayName = "FilterGroup";
export default FilterGroup;
