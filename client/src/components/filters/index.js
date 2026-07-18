// Global filtering system — barrel export.
// Any listing page: wrap in <FilterProvider>, render <FilterSidebar/> +
// <FilterChips/> (+ <FilterDrawer/> for mobile) and read products from
// useFilterContext(). No page-specific filter code needed.
export { default as FilterSidebar } from "./FilterSidebar";
export { default as FilterGroup } from "./FilterGroup";
export { default as FilterCheckbox } from "./FilterCheckbox";
export { default as FilterPriceSlider } from "./FilterPriceSlider";
export { default as FilterChips } from "./FilterChips";
export { default as FilterDrawer } from "./FilterDrawer";
export { default as FilterSkeleton } from "./FilterSkeleton";
