/**
 * Pagination.jsx — the one pagination system for the admin panel.
 * Replaces 4+ independent hand-rolled implementations (AdminOrders,
 * AdminProducts, AdminSettlements, AdminVendors all had near-identical
 * "if totalPages <= 5 show all, else show a window around current" logic
 * duplicated with slightly different styling each time).
 */
const pageWindow = (current, total, size = 5) => {
    if (total <= size) return Array.from({ length: total }, (_, i) => i + 1);
    let start = Math.max(1, current - Math.floor(size / 2));
    let end = start + size - 1;
    if (end > total) { end = total; start = end - size + 1; }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

const Pagination = ({ currentPage, totalPages, onPageChange, disabled = false }) => {
    if (!totalPages || totalPages <= 1) return null;
    const pages = pageWindow(currentPage, totalPages);

    return (
        <nav className="adm-pagination" aria-label="Pagination">
            <button
                className="adm-page-btn"
                disabled={disabled || currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                aria-label="Previous page"
            >
                ‹
            </button>
            {pages[0] > 1 && <span style={{ color: "var(--adm-muted)", fontSize: 12 }}>…</span>}
            {pages.map((p) => (
                <button
                    key={p}
                    className={`adm-page-btn${p === currentPage ? " active" : ""}`}
                    disabled={disabled}
                    onClick={() => onPageChange(p)}
                    aria-current={p === currentPage || undefined}
                >
                    {p}
                </button>
            ))}
            {pages[pages.length - 1] < totalPages && <span style={{ color: "var(--adm-muted)", fontSize: 12 }}>…</span>}
            <button
                className="adm-page-btn"
                disabled={disabled || currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                aria-label="Next page"
            >
                ›
            </button>
        </nav>
    );
};

export default Pagination;
