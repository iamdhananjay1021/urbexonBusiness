import { FiChevronUp, FiChevronDown } from "react-icons/fi";
import { cn } from "./utils/cn";
import Skeleton from "./Skeleton";
import EmptyState from "./EmptyState";

/**
 * Signal Design System — Table
 * columns: [{ key, header, render?, sortable?, align? }]
 * Proper th scope, aria-sort on sortable headers, real empty/loading states
 * (not a bare "No data").
 */
const Table = ({
  columns,
  rows,
  rowKey = "_id",
  sortKey,
  sortDir,
  onSort,
  loading = false,
  emptyTitle = "No results",
  emptyDescription = "There's nothing to show here yet.",
  emptyAction,
  onRowClick,
  className = "",
}) => {
  if (!loading && (!rows || rows.length === 0)) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className={cn("w-full overflow-x-auto rounded-[var(--radius-md)] border border-default", className)}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-canvas">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={
                  col.sortable && sortKey === col.key
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className={cn(
                  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-secondary whitespace-nowrap",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort?.(col.key)}
                    className="inline-flex items-center gap-1 hover:text-primary focus-ring-accent rounded"
                  >
                    {col.header}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? (
                        <FiChevronUp className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <FiChevronDown className="h-3 w-3" aria-hidden="true" />
                      )
                    ) : null}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-t border-default">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={row[rowKey]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-t border-default h-[52px] transition-colors duration-100",
                    onRowClick && "cursor-pointer hover:bg-canvas"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-primary",
                        col.align === "right" ? "text-right" : "text-left"
                      )}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
