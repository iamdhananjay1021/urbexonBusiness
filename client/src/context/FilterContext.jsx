/**
 * FilterContext.jsx — shares ONE useFilters() instance between the page
 * grid, the desktop FilterSidebar, the selected-chips row, and the mobile
 * FilterDrawer, so they all read/write the same URL-synced state without
 * prop drilling.
 *
 * Usage (any listing page):
 *   <FilterProvider base={{ category: slug }}>
 *       …page content, sidebar, grid…
 *   </FilterProvider>
 */
import { createContext, useContext } from "react";
import useFilters from "../hooks/useFilters";

const FilterContext = createContext(null);

export const FilterProvider = ({ base, children }) => {
    const value = useFilters({ base });
    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilterContext = () => {
    const ctx = useContext(FilterContext);
    if (!ctx) throw new Error("useFilterContext must be used inside <FilterProvider>");
    return ctx;
};
