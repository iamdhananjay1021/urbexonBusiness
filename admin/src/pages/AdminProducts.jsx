import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../api/adminApi";
import {
    FaPlus, FaSync, FaEdit, FaTrash,
    FaBoxOpen, FaBoxes,
} from "react-icons/fa";
import {
    Button, Badge, Card, Table, Pagination, SearchBar,
    EmptyState, ErrorState, Skeleton,
} from "../components/ui";

const PAGE_SIZE = 10;

const COLUMNS = [
    { key: "idx", label: "#", width: 32 },
    { key: "img", label: "Img", width: 44 },
    { key: "product", label: "Product" },
    { key: "category", label: "Category", width: 130 },
    { key: "price", label: "Price", width: 90 },
    { key: "stock", label: "Stock", width: 130 },
    { key: "actions", label: "Actions", width: 90 },
];

/* ═══════════════════════════════════════════════════
   STYLES
   Key fix: the desktop table now lives inside a
   horizontally-scrolling wrapper with an enforced
   min-width, so on tablet-width screens (641–1024px)
   the columns no longer get crushed/broken — they
   scroll instead. The mobile-card breakpoint was also
   raised from 640px to 768px so tablets get the roomier
   card layout rather than a squeezed table.
═══════════════════════════════════════════════════ */
const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    * { box-sizing: border-box; }

    .adm-wrap { font-family: 'Plus Jakarta Sans', sans-serif; }

    @keyframes adm-spin  { to{transform:rotate(360deg)} }
    @keyframes row-in    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slide-in  { from{opacity:0;transform:translate(-50%,-10px)} to{opacity:1;transform:translate(-50%,0)} }
    @keyframes card-in   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

    .uk-prod-card {
        animation: card-in 0.2s ease both;
        transition: box-shadow 0.15s, transform 0.15s;
    }
    .uk-prod-card:hover {
        box-shadow: var(--adm-shadow-md) !important;
        transform: translateY(-1px);
    }

    .uk-img-wrap { overflow: hidden; }
    .uk-img-wrap img { transition: transform 0.3s ease; }
    .uk-prod-card:hover .uk-img-wrap img { transform: scale(1.15); }
    tr:hover .uk-img-wrap img { transform: scale(1.15); }

    .uk-action-btn { transition: all 0.15s ease; }
    .uk-action-btn:hover { opacity: 0.85; transform: scale(1.06); }

    .uk-stat-card {
        transition: box-shadow 0.15s, transform 0.15s;
    }
    .uk-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--adm-shadow-md) !important;
    }

    /* ── Table scroll wrapper — prevents column crushing ── */
    .uk-table-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border-radius: var(--adm-radius-lg, 14px);
        scrollbar-width: thin;
    }
    .uk-table-scroll table { min-width: 760px; width: 100%; }
    .uk-table-scroll::-webkit-scrollbar { height: 6px; }
    .uk-table-scroll::-webkit-scrollbar-thumb { background: var(--adm-border); border-radius: 999px; }
    /* more breathing room per row + let the product name show in full */
    .uk-table-scroll td, .uk-table-scroll th { padding: 16px 14px !important; vertical-align: middle; }
    .uk-table-scroll td:first-child, .uk-table-scroll th:first-child { padding-left: 18px !important; }

    .uk-color-dots { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }

    /* ── Responsive ── */
    .uk-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }
    .uk-desktop-list { display: block; }
    .uk-mobile-cards { display: none; }

    @media (max-width: 1024px) {
        .uk-stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
        .uk-desktop-list { display: none !important; }
        .uk-mobile-cards { display: block !important; }
        .uk-header-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
        }
        .uk-header-btns {
            width: 100%;
            justify-content: stretch !important;
        }
        .uk-header-btns a,
        .uk-header-btns button {
            flex: 1;
            justify-content: center;
        }
    }

    @media (max-width: 640px) {
        .uk-stats-grid { gap: 8px; }
        .uk-stat-icon { width: 26px !important; height: 26px !important; font-size: 12px !important; }
        .uk-stat-value { font-size: 19px !important; }
    }

    @media (max-width: 380px) {
        .uk-stats-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
    }
`;

const AdminProducts = () => {
    const [products, setProducts] = useState([]);
    // [FIX] Previously fetched with no page/limit at all — the ENTIRE
    // catalog was loaded into the browser and held in memory on every
    // visit to this page, then filtered/paginated client-side. The
    // backend endpoint (adminGetAllProducts) already fully supports
    // page/limit/search/inStock server-side — this page just never used
    // it. Now `products` holds only the current page.
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [deletingId, setDeletingId] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [toast, setToast] = useState(null);
    const [editingStockId, setEditingStockId] = useState(null);
    const [stockInput, setStockInput] = useState("");
    const [statsFilter, setStatsFilter] = useState(null);
    const [savingStockId, setSavingStockId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    // Whole-catalog counts for the stat tiles — independent of the
    // current search/page, fetched separately (limit:1, only `total` is
    // read) so the stat row stays accurate without pulling full lists.
    const [counts, setCounts] = useState({ total: 0, inStock: 0, oos: 0 });

    const pageStart = (currentPage - 1) * PAGE_SIZE;

    useEffect(() => { setCurrentPage(1); }, [search, statsFilter]);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchProducts = useCallback(async (page = currentPage, searchTerm = search, filter = statsFilter) => {
        try {
            setListLoading(true); setError(null);
            const params = { page, limit: PAGE_SIZE };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (filter === "inStock") params.inStock = "true";
            if (filter === "oos") params.inStock = "false";
            const { data } = await api.get("/products/admin/all", { params });
            setProducts(data.products || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
        } catch { setError("Failed to load products"); }
        finally { setLoading(false); setListLoading(false); }
    }, [currentPage, search, statsFilter]);

    const fetchCounts = useCallback(async () => {
        try {
            const [all, inStock, oos] = await Promise.all([
                api.get("/products/admin/all", { params: { page: 1, limit: 1 } }),
                api.get("/products/admin/all", { params: { page: 1, limit: 1, inStock: "true" } }),
                api.get("/products/admin/all", { params: { page: 1, limit: 1, inStock: "false" } }),
            ]);
            setCounts({ total: all.data.total || 0, inStock: inStock.data.total || 0, oos: oos.data.total || 0 });
        } catch { /* stat tiles just show stale/zero counts on failure — non-critical */ }
    }, []);

    useEffect(() => { fetchCounts(); }, [fetchCounts]);

    const searchTimer = useRef(null);
    useEffect(() => {
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            fetchProducts(1, search, statsFilter);
        }, 300);
        return () => clearTimeout(searchTimer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, statsFilter]);

    useEffect(() => {
        fetchProducts(currentPage, search, statsFilter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    const deleteHandler = useCallback(async (id) => {
        try {
            setDeletingId(id);
            await api.delete(`/products/admin/${id}`);
            setProducts(prev => prev.filter(x => x._id !== id));
            setTotal(prev => Math.max(0, prev - 1));
            fetchCounts();
            showToast("success", "Product deleted");
        } catch { showToast("error", "Failed to delete"); }
        finally { setDeletingId(null); setConfirmId(null); }
    }, [showToast, fetchCounts]);

    const handleStockSave = useCallback(async (product) => {
        const newStock = parseInt(stockInput, 10);
        if (isNaN(newStock) || newStock < 0) { showToast("error", "Invalid stock"); return; }
        try {
            setSavingStockId(product._id);
            const fd = new FormData();
            fd.append("name", product.name);
            fd.append("price", product.price);
            fd.append("category", product.category);
            fd.append("stock", newStock);
            fd.append("productType", product.productType || "ecommerce");
            fd.append("isCustomizable", product.isCustomizable ? "true" : "false");
            fd.append("sizes", JSON.stringify(product.sizes || []));
            fd.append("highlights", JSON.stringify(
                product.highlights instanceof Map
                    ? Object.fromEntries(product.highlights)
                    : (product.highlights || {})
            ));
            await api.put(`/products/admin/${product._id}`, fd);
            const updated = { ...product, stock: newStock, inStock: newStock > 0 };
            setProducts(prev => prev.map(x => x._id === product._id ? updated : x));
            fetchCounts();
            setEditingStockId(null);
            showToast("success", `Stock updated to ${newStock}`);
        } catch { showToast("error", "Failed to update stock"); }
        finally { setSavingStockId(null); }
    }, [stockInput, showToast, fetchCounts]);

    const refreshProducts = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchProducts(1, search, statsFilter), fetchCounts()]);
        setCurrentPage(1);
        setTimeout(() => setRefreshing(false), 500);
    }, [fetchProducts, fetchCounts, search, statsFilter]);

    const formatCat = (cat) =>
        cat?.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "—";

    const stockInfo = (product) => {
        const n = Number(product.stock ?? 0);
        if (!product.inStock) return { label: "Out of Stock", tone: "danger" };
        if (n <= 5) return { label: `${n} left`, tone: "warning" };
        return { label: `${n} left`, tone: "success" };
    };

    // ── Loading ──
    if (loading) return (
        <div className="adm-wrap" style={{ minHeight: "100vh", background: "var(--adm-bg)", padding: "24px 16px 60px" }}>
            <style>{STYLES}</style>
            <div style={{ maxWidth: 1080, margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 12 }}>
                    <div>
                        <Skeleton width={140} height={26} />
                        <div style={{ marginTop: 8 }}><Skeleton width={200} height={13} /></div>
                    </div>
                    <Skeleton width={160} height={38} radius={9} />
                </div>
                <div className="uk-stats-grid">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} height={84} radius={12} />)}
                </div>
                <div style={{ marginBottom: 16 }}><Skeleton height={46} radius={10} /></div>
                <div className="uk-table-scroll">
                    <Table columns={COLUMNS} rows={[]} loading skeletonRows={6} />
                </div>
            </div>
        </div>
    );

    // ── Error ──
    if (error) return (
        <div className="adm-wrap" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", background: "var(--adm-bg)" }}>
            <style>{STYLES}</style>
            <div style={{ width: "100%", maxWidth: 360 }}>
                <ErrorState message={error} onRetry={fetchProducts} />
            </div>
        </div>
    );

    const StockCell = ({ product }) => {
        const isES = editingStockId === product._id;
        const si = stockInfo(product);
        if (isES) return (
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                <input
                    type="number" min="0"
                    value={stockInput}
                    onChange={e => setStockInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") handleStockSave(product);
                        if (e.key === "Escape") setEditingStockId(null);
                    }}
                    autoFocus
                    style={{
                        width: 56, padding: "5px 8px",
                        background: "var(--adm-surface)", border: "2px solid var(--adm-primary)",
                        borderRadius: 7, color: "var(--adm-text-primary)",
                        fontSize: 13, fontWeight: 700,
                        outline: "none", fontFamily: "inherit",
                        boxShadow: "0 0 0 3px var(--adm-primary-tint)",
                    }}
                />
                <Button variant="primary" size="sm" onClick={() => handleStockSave(product)} loading={savingStockId === product._id}>
                    ✓
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingStockId(null)}>
                    ✕
                </Button>
            </div>
        );
        return (
            <button
                onClick={() => { setEditingStockId(product._id); setStockInput(String(product.stock ?? 0)); }}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
            >
                <Badge tone={si.tone}>
                    <FaBoxes size={8} /> {si.label}
                    <span style={{ fontSize: 9, opacity: 0.5 }}>✎</span>
                </Badge>
            </button>
        );
    };

    const ActionBtns = ({ product }) => {
        const isIC = confirmId === product._id;
        return (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, alignItems: "center" }}>
                <Link to={`/admin/products/${product._id}/edit`} className="uk-action-btn"
                    style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "var(--adm-primary-tint)", border: "1px solid var(--adm-primary-tint)", color: "var(--adm-primary)",
                        textDecoration: "none", flexShrink: 0,
                    }}>
                    <FaEdit size={12} />
                </Link>
                {isIC ? (
                    <div style={{ display: "flex", gap: 3 }}>
                        <Button variant="danger" size="sm" onClick={() => deleteHandler(product._id)}>Yes</Button>
                        <Button variant="secondary" size="sm" onClick={() => setConfirmId(null)}>No</Button>
                    </div>
                ) : (
                    <button onClick={() => setConfirmId(product._id)} className="uk-action-btn"
                        style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "var(--adm-danger-tint)", border: "1px solid var(--adm-danger-tint)", color: "var(--adm-danger)",
                            cursor: "pointer", flexShrink: 0,
                        }}>
                        <FaTrash size={12} />
                    </button>
                )}
            </div>
        );
    };

    // [FIX] "Avg Price" previously averaged over the entire in-memory
    // catalog; now that `products` only ever holds the current page, this
    // is deliberately scoped to "this page" (labeled as such) rather than
    // silently becoming a different, misleading number.
    const validPrices = products.map(p => Number(p.price) || 0);
    const avgPrice = validPrices.length
        ? Math.round(validPrices.reduce((s, v) => s + v, 0) / validPrices.length)
        : 0;

    const STATS = [
        { label: "Total", value: counts.total, tone: "primary", icon: "📦", filter: null },
        { label: "In Stock", value: counts.inStock, tone: "success", icon: "✅", filter: "inStock" },
        { label: "Out of Stock", value: counts.oos, tone: "danger", icon: "❌", filter: "oos" },
        { label: "Avg Price (page)", value: `₹${avgPrice.toLocaleString("en-IN")}`, tone: "info", icon: "💰", filter: "avg" },
    ];

    const renderProductRow = (product, idx) => {
        const img = product.images?.[0]?.url || product.image?.url || product.image || null;
        return (
            <tr key={product._id} style={{ opacity: deletingId === product._id ? 0.4 : 1 }}>
                <td style={{ color: "var(--adm-muted)", fontWeight: 700 }}>{pageStart + idx + 1}</td>
                <td>
                    <div className="uk-img-wrap" style={{
                        width: 38, height: 38,
                        background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border)",
                        borderRadius: 8, overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                    }}>
                        {img
                            ? <img src={img} alt={product.name} loading="lazy" decoding="async"
                                style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3 }} />
                            : <FaBoxOpen size={13} style={{ color: "var(--adm-border)" }} />
                        }
                    </div>
                </td>
                <td style={{ minWidth: 0 }}>
                    {/* full name, no truncation — wraps onto a second line instead of cutting off */}
                    <p style={{
                        fontWeight: 700, fontSize: 13.5, lineHeight: 1.4,
                        color: "var(--adm-text-primary)", margin: 0,
                        whiteSpace: "normal", wordBreak: "break-word",
                        maxWidth: 320,
                    }} title={product.slug ? `/${product.slug}` : undefined}>
                        {product.name}
                    </p>
                    {!product.slug && (
                        <span style={{ fontSize: 10, color: "var(--adm-warning)", marginTop: 3, display: "block" }}>⚠ no slug</span>
                    )}
                    {product.colorVariants && product.colorVariants.length > 0 && (
                        <div className="uk-color-dots" style={{ marginTop: 6 }}>
                            {product.colorVariants.map((c, i) => (
                                <div key={i} title={c.name} style={{ width: 12, height: 12, borderRadius: "50%", background: c.hex || "#ccc", border: "1px solid var(--adm-border)" }} />
                            ))}
                        </div>
                    )}
                </td>
                <td>
                    <Badge tone="warning">{formatCat(product.category)}</Badge>
                </td>
                <td style={{ fontWeight: 800, color: "var(--adm-primary)", whiteSpace: "nowrap" }}>
                    ₹{Number(product.price || 0).toLocaleString("en-IN")}
                </td>
                <td><StockCell product={product} /></td>
                <td style={{ textAlign: "right" }}><ActionBtns product={product} /></td>
            </tr>
        );
    };

    // ── Main ──
    return (
        <div className="adm-wrap" style={{ minHeight: "100vh", background: "var(--adm-bg)", padding: "24px 16px 60px" }}>
            <style>{STYLES}</style>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 16, left: "50%",
                    zIndex: 9999, display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 20px", borderRadius: 10,
                    background: toast.type === "success" ? "var(--adm-success)" : "var(--adm-danger)",
                    color: "var(--adm-text-on-accent)", fontWeight: 700, fontSize: 13,
                    boxShadow: "var(--adm-shadow-lg)",
                    whiteSpace: "nowrap", animation: "slide-in 0.2s ease",
                    maxWidth: "90vw",
                }}>
                    {toast.type === "success" ? "✓" : "✕"} {toast.msg}
                </div>
            )}

            <div style={{ maxWidth: 1080, margin: "0 auto" }}>

                {/* Header */}
                <div className="uk-header-row" style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 24, flexWrap: "wrap", gap: 12,
                }}>
                    <div>
                        <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--adm-primary)", margin: "0 0 4px" }}>
                            Catalog
                        </p>
                        <h1 style={{
                            fontWeight: 800, fontSize: 24,
                            color: "var(--adm-text-primary)", margin: 0,
                            letterSpacing: "-0.03em",
                        }}>Products</h1>
                        <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 3 }}>
                            {counts.total} total · {products.length} showing
                            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
                        </p>
                    </div>
                    <div className="uk-header-btns" style={{ display: "flex", gap: 8 }}>
                        <Button variant="secondary" icon={FaSync} loading={refreshing} onClick={refreshProducts}>
                            Refresh
                        </Button>
                        <Link to="/admin/products/new" className="adm-btn adm-btn-primary adm-btn-md">
                            <FaPlus size={10} /> Add Product
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="uk-stats-grid">
                    {STATS.map(({ label, value, tone, icon, filter }) => {
                        const active = statsFilter === filter;
                        return (
                            <Card
                                key={label}
                                className="uk-stat-card"
                                style={{
                                    cursor: filter !== "avg" ? "pointer" : "default",
                                    padding: "14px 16px",
                                    borderColor: active ? `var(--adm-${tone})` : undefined,
                                    background: active ? `var(--adm-${tone}-tint)` : undefined,
                                }}
                            >
                                <div
                                    onClick={() => {
                                        if (filter === "avg") return;
                                        setStatsFilter(prev => prev === filter ? null : filter);
                                        setCurrentPage(1);
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                        <p style={{ fontSize: 10, color: active ? `var(--adm-${tone})` : "var(--adm-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                                            {label}
                                            {active && filter !== null && <span style={{ marginLeft: 4, fontSize: 10 }}>✕</span>}
                                        </p>
                                        <div className="uk-stat-icon" style={{
                                            width: 30, height: 30, borderRadius: 8,
                                            background: `var(--adm-${tone}-tint)`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 14, flexShrink: 0,
                                        }}>
                                            {icon}
                                        </div>
                                    </div>
                                    <p className="uk-stat-value" style={{ fontWeight: 800, fontSize: 22, color: `var(--adm-${tone})`, margin: 0, letterSpacing: "-0.02em" }}>
                                        {value}
                                    </p>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Search */}
                <div style={{ marginBottom: 16 }}>
                    <SearchBar value={search} onChange={setSearch} placeholder="Search by name or category..." />
                </div>

                {/* Empty */}
                {products.length === 0 && !listLoading ? (
                    <EmptyState
                        icon={FaBoxOpen}
                        title={search ? `No results for "${search}"` : "No products yet"}
                        description={!search ? "Add your first product to get started." : undefined}
                        action={!search && (
                            <Link to="/admin/products/new" className="adm-btn adm-btn-primary adm-btn-md">
                                <FaPlus size={10} /> Add First Product
                            </Link>
                        )}
                    />
                ) : (
                    <>
                        {/* ── DESKTOP / TABLET TABLE (scrolls horizontally instead of breaking) ── */}
                        <div className="uk-desktop-list">
                            <div className="uk-table-scroll">
                                <Table columns={COLUMNS} rows={products} loading={listLoading} renderRow={renderProductRow} />
                            </div>

                            <div style={{
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 4px",
                                flexWrap: "wrap", gap: 10,
                            }}>
                                <p style={{ fontSize: 12, color: "var(--adm-muted)", margin: 0 }}>
                                    Showing{" "}
                                    <b style={{ color: "var(--adm-text-secondary)" }}>{pageStart + 1}–{Math.min(pageStart + products.length, total)}</b>
                                    {" "}of{" "}
                                    <b style={{ color: "var(--adm-text-secondary)" }}>{total}</b>
                                </p>
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            </div>
                        </div>

                        {/* ── MOBILE / TABLET CARDS ── */}
                        <div className="uk-mobile-cards">
                            {products.map((product, idx) => {
                                const img = product.images?.[0]?.url || product.image?.url || product.image || null;

                                return (
                                    <Card
                                        key={product._id}
                                        className="uk-prod-card"
                                        style={{ padding: 14, marginBottom: 10, opacity: deletingId === product._id ? 0.4 : 1, animationDelay: `${idx * 0.04}s` }}
                                    >
                                        {/* Card Top Row — clickable to navigate */}
                                        <Link to={`/admin/products/${product._id}/edit`} style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                                            {/* Image */}
                                            <div className="uk-img-wrap" style={{
                                                width: 56, height: 56, flexShrink: 0,
                                                background: "var(--adm-surface-alt)", border: "1px solid var(--adm-border)",
                                                borderRadius: 10, overflow: "hidden",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}>
                                                {img
                                                    ? <img src={img} alt={product.name} loading="lazy"
                                                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                                                    : <FaBoxOpen size={18} style={{ color: "var(--adm-border)" }} />
                                                }
                                            </div>

                                            {/* Name + Meta */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontWeight: 700, fontSize: 14,
                                                    color: "var(--adm-text-primary)", margin: "0 0 4px",
                                                    lineHeight: 1.3,
                                                    overflow: "hidden", textOverflow: "ellipsis",
                                                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                                }}>
                                                    {product.name}
                                                </p>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                                                    <Badge tone="warning">{formatCat(product.category)}</Badge>
                                                    {!product.slug && (
                                                        <span style={{ fontSize: 10, color: "var(--adm-warning)" }}>⚠ no slug</span>
                                                    )}
                                                    {product.colorVariants && product.colorVariants.length > 0 && (
                                                        <div className="uk-color-dots" style={{ marginLeft: 4 }}>
                                                            {product.colorVariants.map((c, i) => (
                                                                <div key={i} title={c.name} style={{ width: 10, height: 10, borderRadius: "50%", background: c.hex || "#ccc", border: "1px solid var(--adm-border)" }} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Price */}
                                            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--adm-primary)", flexShrink: 0, whiteSpace: "nowrap" }}>
                                                ₹{Number(product.price || 0).toLocaleString("en-IN")}
                                            </div>
                                        </Link>

                                        {/* Card Bottom Row */}
                                        <div style={{
                                            display: "flex", alignItems: "center",
                                            justifyContent: "space-between",
                                            paddingTop: 10,
                                            borderTop: "1px solid var(--adm-border-soft)",
                                            flexWrap: "wrap", gap: 8,
                                        }}>
                                            <StockCell product={product} />
                                            <ActionBtns product={product} />
                                        </div>
                                    </Card>
                                );
                            })}

                            {/* Mobile Pagination */}
                            {totalPages > 1 && (
                                <div style={{
                                    display: "flex", alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "12px 4px", flexWrap: "wrap", gap: 10,
                                }}>
                                    <p style={{ fontSize: 12, color: "var(--adm-muted)", margin: 0 }}>
                                        <b style={{ color: "var(--adm-text-secondary)" }}>{pageStart + 1}–{Math.min(pageStart + products.length, total)}</b>
                                        {" "}of{" "}
                                        <b style={{ color: "var(--adm-text-secondary)" }}>{total}</b>
                                    </p>
                                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminProducts;