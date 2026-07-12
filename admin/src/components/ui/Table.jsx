/**
 * Table.jsx — the one table system for the admin panel: sticky header,
 * horizontal-scroll wrapper for responsiveness, built-in loading skeleton
 * and empty state so every page gets these "for free" instead of each
 * page hand-rolling its own (an audit found zero shared table primitive
 * existed before this — every page built its own <table> from scratch).
 */
import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";

/**
 * @param columns — [{ key, label, width? }]
 * @param loading — shows a skeleton-row placeholder instead of rows
 * @param skeletonRows — how many placeholder rows while loading
 * @param empty — shown when rows.length === 0 and not loading ({ icon, title, description })
 * @param renderRow — (row, index) => <tr>...</tr> — full control over cell rendering,
 *   since row shapes vary wildly page to page (orders vs vendors vs riders)
 */
const Table = ({ columns, rows = [], loading = false, skeletonRows = 6, empty, renderRow }) => (
    <div className="adm-table-wrap">
        <table className="adm-table">
            <thead>
                <tr>
                    {columns.map((col) => (
                        <th key={col.key} style={col.width ? { width: col.width } : undefined}>{col.label}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    Array.from({ length: skeletonRows }).map((_, i) => (
                        <tr key={`sk-${i}`}>
                            {columns.map((col) => (
                                <td key={col.key}><Skeleton height={14} width="80%" /></td>
                            ))}
                        </tr>
                    ))
                ) : rows.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} style={{ padding: 0 }}>
                            <EmptyState {...(empty || {})} />
                        </td>
                    </tr>
                ) : (
                    rows.map((row, i) => renderRow(row, i))
                )}
            </tbody>
        </table>
    </div>
);

export default Table;
