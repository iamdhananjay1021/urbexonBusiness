/**
 * FilterCheckbox — one selectable value row (checkbox or radio behaviour
 * is decided by the caller via `checked` + onChange; count shown right).
 * Optional `swatch` renders a color dot (Color facet).
 */
import { memo } from "react";
import { FiCheck } from "react-icons/fi";

const FilterCheckbox = memo(({ label, count, checked, onChange, swatch, type = "checkbox" }) => (
    <label className="group flex items-center gap-2.5 py-[7px] cursor-pointer select-none min-w-0">
        <input
            type={type}
            checked={checked}
            onChange={onChange}
            className="sr-only"
        />
        <span
            aria-hidden="true"
            className={`w-[18px] h-[18px] flex items-center justify-center shrink-0 border transition-all duration-150
                        ${type === "radio" ? "rounded-full" : "rounded-[5px]"}
                        ${checked
                    ? "bg-accent border-[var(--accent-primary)]"
                    : "bg-white border-strong group-hover:border-[var(--color-graphite-400)]"}`}
        >
            {checked && (type === "radio"
                ? <span className="w-2 h-2 rounded-full bg-white" />
                : <FiCheck size={12} className="text-white" strokeWidth={3} />)}
        </span>
        {swatch && (
            <span
                aria-hidden="true"
                className="w-4 h-4 rounded-full border border-default shrink-0"
                style={{ background: swatch }}
            />
        )}
        <span className={`flex-1 min-w-0 truncate text-[13px] capitalize transition-colors duration-150
                          ${checked ? "text-primary font-semibold" : "text-secondary group-hover:text-primary"}`}>
            {label}
        </span>
        {count != null && (
            <span className="text-[11px] text-muted tabular-nums shrink-0">({count})</span>
        )}
    </label>
));
FilterCheckbox.displayName = "FilterCheckbox";
export default FilterCheckbox;
