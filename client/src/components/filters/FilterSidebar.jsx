/**
 * FilterSidebar — THE reusable filter panel. Every group below is
 * generated from the /products/filters facet payload; nothing is
 * hardcoded, so when Admin adds new brands/attributes they appear here
 * automatically. Used as-is on desktop (sticky) and inside the mobile
 * FilterDrawer.
 */
import { memo, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { useFilterContext } from "../../context/FilterContext";
import FilterGroup from "./FilterGroup";
import FilterCheckbox from "./FilterCheckbox";
import FilterPriceSlider from "./FilterPriceSlider";
import FilterSkeleton from "./FilterSkeleton";

const includesCI = (list, v) => list.some((x) => x.toLowerCase() === String(v).toLowerCase());

/* Brand list with an inline search box once it grows past 8 entries */
const BrandList = memo(({ brands, selected, onToggle }) => {
    const [q, setQ] = useState("");
    const visible = useMemo(() => {
        const query = q.trim().toLowerCase();
        const list = query ? brands.filter((b) => b.value.toLowerCase().includes(query)) : brands;
        return list.slice(0, 12);
    }, [brands, q]);

    return (
        <>
            {brands.length > 8 && (
                <div className="flex items-center gap-2 h-9 px-3 mb-2 rounded-lg bg-[var(--color-graphite-50)]
                                focus-within:bg-white focus-within:shadow-[0_0_0_2px_var(--focus-ring)] transition-all duration-200">
                    <FiSearch size={12} className="text-muted shrink-0" aria-hidden="true" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search brands"
                        aria-label="Search brands"
                        className="flex-1 min-w-0 bg-transparent border-none outline-none text-[12.5px] text-primary placeholder:text-muted"
                    />
                </div>
            )}
            {visible.map(({ value, count }) => (
                <FilterCheckbox
                    key={value} label={value} count={count}
                    checked={includesCI(selected, value)}
                    onChange={() => onToggle("brand", value)}
                />
            ))}
            {visible.length === 0 && (
                <p className="text-[12px] text-muted py-1">No matching brands</p>
            )}
        </>
    );
});
BrandList.displayName = "BrandList";

const FilterSidebar = () => {
    const f = useFilterContext();
    const { facets, facetsLoading } = f;

    if (facetsLoading && !facets) return <FilterSkeleton />;
    if (!facets) return null;

    const showPrice = facets.priceRange && facets.priceRange.max > facets.priceRange.min;

    return (
        <div className="flex flex-col">
            {/* ── Subcategory ── */}
            {facets.subcategories?.length > 0 && (
                <FilterGroup title="Category" count={f.subcategory ? 1 : 0}>
                    {facets.subcategories.slice(0, 12).map(({ value, count }) => (
                        <FilterCheckbox
                            key={value} type="radio" label={value} count={count}
                            checked={f.subcategory.toLowerCase() === value.toLowerCase()}
                            onChange={() => f.setValue("subcategory",
                                f.subcategory.toLowerCase() === value.toLowerCase() ? "" : value)}
                        />
                    ))}
                </FilterGroup>
            )}

            {/* ── Brand (with search) ── */}
            {facets.brands?.length > 0 && (
                <FilterGroup title="Brand" count={f.brand.length}>
                    <BrandList brands={facets.brands} selected={f.brand} onToggle={f.toggleValue} />
                </FilterGroup>
            )}

            {/* ── Price ── */}
            {showPrice && (
                <FilterGroup title="Price" count={f.priceMin || f.priceMax ? 1 : 0}>
                    <FilterPriceSlider
                        min={facets.priceRange.min}
                        max={facets.priceRange.max}
                        valueMin={f.priceMin}
                        valueMax={f.priceMax}
                        onCommit={f.setPriceRange}
                    />
                </FilterGroup>
            )}

            {/* ── Color (swatches) ── */}
            {facets.colors?.length > 0 && (
                <FilterGroup title="Color" count={f.color.length}>
                    {facets.colors.slice(0, 12).map(({ value, count, hex }) => (
                        <FilterCheckbox
                            key={value} label={value} count={count}
                            swatch={hex || value}
                            checked={includesCI(f.color, value)}
                            onChange={() => f.toggleValue("color", value)}
                        />
                    ))}
                </FilterGroup>
            )}

            {/* ── Size ── */}
            {facets.sizes?.length > 0 && (
                <FilterGroup title="Size" count={f.size.length}>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {facets.sizes.slice(0, 16).map(({ value }) => {
                            const active = includesCI(f.size, value);
                            return (
                                <button
                                    key={value}
                                    onClick={() => f.toggleValue("size", value)}
                                    aria-pressed={active}
                                    className={`min-w-[40px] h-9 px-2.5 rounded-lg text-[12px] font-semibold border
                                                transition-colors duration-200 focus-ring-accent
                                                ${active
                                            ? "bg-accent border-[var(--accent-primary)] text-white"
                                            : "bg-white border-strong text-secondary hover:border-[var(--color-graphite-400)] hover:text-primary"}`}
                                >
                                    {value}
                                </button>
                            );
                        })}
                    </div>
                </FilterGroup>
            )}

            {/* ── Rating ── */}
            {facets.ratings?.length > 0 && (
                <FilterGroup title="Customer Rating" count={f.rating ? 1 : 0}>
                    {facets.ratings.map(({ value, label, count }) => (
                        <FilterCheckbox
                            key={value} type="radio" label={label} count={count}
                            checked={f.rating === value}
                            onChange={() => f.setValue("rating", f.rating === value ? "" : value)}
                        />
                    ))}
                </FilterGroup>
            )}

            {/* ── Discount ── */}
            {facets.discounts?.length > 0 && (
                <FilterGroup title="Discount" count={f.discount ? 1 : 0}>
                    {facets.discounts.map(({ value, label, count }) => (
                        <FilterCheckbox
                            key={value} type="radio" label={label} count={count}
                            checked={f.discount === value}
                            onChange={() => f.setValue("discount", f.discount === value ? "" : value)}
                        />
                    ))}
                </FilterGroup>
            )}

            {/* ── Dynamic attribute groups — fabric, fit, ram, storage, … ── */}
            {facets.attributes?.map(({ key, values }) => (
                <FilterGroup key={key} title={key} count={(f.attrs[key] || []).length} defaultOpen={false}>
                    {values.slice(0, 12).map(({ value, count }) => (
                        <FilterCheckbox
                            key={value} label={value} count={count}
                            checked={includesCI(f.attrs[key] || [], value)}
                            onChange={() => f.toggleValue(`attr_${key}`, value)}
                        />
                    ))}
                </FilterGroup>
            ))}

            {/* ── Availability ── */}
            <FilterGroup title="Availability" count={f.availability === "all" ? 1 : 0} defaultOpen={false}>
                <FilterCheckbox
                    label="Include out of stock"
                    checked={f.availability === "all"}
                    onChange={() => f.setValue("availability", f.availability === "all" ? "" : "all")}
                />
            </FilterGroup>
        </div>
    );
};

export default memo(FilterSidebar);
