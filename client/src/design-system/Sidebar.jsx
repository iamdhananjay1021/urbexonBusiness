import { useState } from "react";
import { NavLink } from "react-router-dom";
import { FiChevronsLeft, FiChevronsRight } from "react-icons/fi";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Sidebar (shell)
 * The shared dashboard shell for Admin/Vendor/Delivery per the approved
 * navigation spec: 264px expanded / 72px collapsed, dark graphite bg,
 * indigo left-border + tint on active item. This is the ONE shell all three
 * dashboard apps will use — only `items`/`logo` differ per app, fixing the
 * earlier audit finding that vendor-panel visually diverged from admin.
 */
const Sidebar = ({ items = [], logo, footer, defaultCollapsed = false }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <aside
      className={cn(
        "h-screen flex flex-col bg-[var(--color-graphite-900)] transition-[width] duration-200 flex-shrink-0",
        collapsed ? "w-[72px]" : "w-[264px]"
      )}
    >
      <div className="h-16 flex items-center px-4 flex-shrink-0 border-b border-[var(--color-graphite-700)]">
        {!collapsed && logo}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2.5 flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors duration-150 border-l-2",
                isActive
                  ? "bg-[rgba(118,120,236,0.16)] border-[var(--color-indigo-400)] text-white"
                  : "border-transparent text-[var(--color-graphite-400)] hover:bg-[var(--color-graphite-800)] hover:text-white"
              )
            }
          >
            {item.icon && <item.icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />}
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && footer && (
        <div className="px-2.5 py-3 border-t border-[var(--color-graphite-700)] flex-shrink-0">{footer}</div>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex-shrink-0 h-10 flex items-center justify-center border-t border-[var(--color-graphite-700)] text-[var(--color-graphite-400)] hover:text-white hover:bg-[var(--color-graphite-800)]"
      >
        {collapsed ? (
          <FiChevronsRight className="h-4 w-4" aria-hidden="true" />
        ) : (
          <FiChevronsLeft className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </aside>
  );
};

export default Sidebar;
