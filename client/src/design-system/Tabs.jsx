import { useRef } from "react";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Tabs
 * role="tablist"/"tab"/"tabpanel" with full arrow-key navigation (WAI-ARIA
 * tabs pattern). Controlled component — caller owns active state.
 */
const Tabs = ({ tabs, active, onChange, className = "" }) => {
  const tabRefs = useRef([]);

  const handleKeyDown = (e, idx) => {
    let nextIdx = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      tabRefs.current[nextIdx]?.focus();
      onChange(tabs[nextIdx].value);
    }
  };

  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-1 border-b border-default overflow-x-auto scrollbar-hide", className)}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            ref={(el) => (tabRefs.current[idx] = el)}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-ring-accent whitespace-nowrap",
              isActive ? "text-accent" : "text-secondary hover:text-primary"
            )}
          >
            {tab.label}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export const TabPanel = ({ active, value, children }) =>
  active === value ? (
    <div role="tabpanel" tabIndex={0}>
      {children}
    </div>
  ) : null;

export default Tabs;
