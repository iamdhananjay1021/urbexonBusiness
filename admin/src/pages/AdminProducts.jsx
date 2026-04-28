import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../api/adminApi";
import {
    FaPlus, FaSync, FaEdit, FaTrash, FaSearch,
    FaBoxOpen, FaBoxes, FaChevronLeft, FaChevronRight, FaLink,
} from "react-icons/fa";

const PAGE_SIZE = 10;

const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    * { box-sizing: border-box; }

    .adm-wrap { font-family: 'Plus Jakarta Sans', sans-serif; }

    @keyframes adm-spin  { to{transform:rotate(360deg)} }
    @keyframes row-in    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slide-in  { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes card-in   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

    .uk-prod-row {
        animation: row-in 0.18s ease both;
        transition: background 0.12s;
    }
    .uk-prod-row:hover { background: #f8faff !important; }

    .uk-prod-card {
        animation: card-in 0.2s ease both;
        transition: box-shadow 0.15s, transform 0.15s;
    }
    .uk-prod-card:hover {
        box-shadow: 0 4px 20px rgba(37,99,235,0.1) !important;
        transform: translateY(-1px);
    }

    .uk-img-wrap { overflow: hidden; }
    .uk-img-wrap img { transition: transform 0.3s ease; }
    .uk-prod-row:hover .uk-img-wrap img,
    .uk-prod-card:hover .uk-img-wrap img { transform: scale(1.15); }

    .uk-action-btn { transition: all 0.15s ease; }
    .uk-action-btn:hover { opacity: 0.85; transform: scale(1.06); }

    .uk-search-input:focus {
        outline: none;
        border-color: #2563eb !important;
        box-shadow: 0 0 0 3px rgba(37,99,235,0.1) !important;
    }

    .uk-stat-card {
        transition: box-shadow 0.15s, transform 0.15s;
    }
    .uk-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
    }

    .uk-refresh-btn:hover {
        background: #eff6ff !important;
        border-color: #93c5fd !important;
        color: #2563eb !important;
    }
    .uk-page-btn:hover:not(:disabled) {
        background: #eff6ff !important;
        border-color: #93c5fd !important;
        color: #2563eb !important;
    }

    /* ── Responsive ── */
    .uk-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }
    .uk-table-header { display: grid; }
    .uk-table-row    { display: grid; }
    .uk-mobile-cards { display: none; }

    @media (max-width: 900px) {
        .uk-stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 640px) {
        .uk-stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .uk-table-header { display: none !important; }
        .uk-table-row    { display: none !important; }
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
`;

const AdminProducts = () => {
    const [products, setProducts] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
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

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);

    useEffect(() => { setCurrentPage(1); }, [search]);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            const { data } = await api.get("/products/admin/all");
            const list = Array.isArray(data) ? data : (data?.products || []);
            setProducts(list); setFiltered(list);
        } catch { setError("Failed to load products"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const searchTimer = useRef(null);
    useEffect(() => {
        clearTimeout(searchTimer.current);
        if (!search.trim() && !statsFilter) return setFiltered(products);
        if (!search.trim() && statsFilter) {
            if (statsFilter === "inStock") return setFiltered(products.filter(p => p.inStock));
            if (statsFilter === "oos") return setFiltered(products.filter(p => !p.inStock));
            return setFiltered(products);
        }
        searchTimer.current = setTimeout(() => {
            const q = search.toLowerCase();
            let list = products;
            if (statsFilter === "inStock") list = list.filter(p => p.inStock);
            else if (statsFilter === "oos") list = list.filter(p => !p.inStock);
            if (q) list = list.filter(p =>
                p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
            );
            setFiltered(list);
        }, 300);
        return () => clearTimeout(searchTimer.current);
    }, [search, products, statsFilter]);

    const deleteHandler = useCallback(async (id) => {
        try {
            setDeletingId(id);
            await api.delete(`/products/admin/${id}`);
            setProducts(prev => prev.filter(x => x._id !== id));
            setFiltered(prev => prev.filter(x => x._id !== id));
            showToast("success", "Product deleted");
        } catch { showToast("error", "Failed to delete"); }
        finally { setDeletingId(null); setConfirmId(null); }
    }, [showToast]);

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
            setFiltered(prev => prev.map(x => x._id === product._id ? updated : x));
            setEditingStockId(null);
            showToast("success", `Stock updated to ${newStock}`);
        } catch { showToast("error", "Failed to update stock"); }
        finally { setSavingStockId(null); }
    }, [stockInput, showToast]);

    const refreshProducts = useCallback(async () => {
        setRefreshing(true);
        await fetchProducts();
        setCurrentPage(1);
        setTimeout(() => setRefreshing(false), 500);
    }, [fetchProducts]);

    const formatCat = (cat) =>
        cat?.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "—";

    const stockInfo = (product) => {
        const n = Number(product.stock ?? 0);
        if (!product.inStock) return { label: "Out of Stock", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
        if (n <= 5) return { label: `${n} left`, color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
        return { label: `${n} left`, color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" };
    };

    const getPageNumbers = () => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, "…", totalPages];
        if (currentPage >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages];
    };

    // ── Loading ──
    if (loading) return (
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <style>{`@keyframes adm-spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ textAlign: "center" }}>
                <div style={{
                    width: 40, height: 40,
                    border: "3px solid #dbeafe",
                    borderTopColor: "#2563eb",
                    borderRadius: "50%",
                    animation: "adm-spin 0.8s linear infinite",
                    margin: "0 auto 14px",
                }} />
                <p style={{ color: "#94a3b8", fontSize: 13, fontFamily: "sans-serif" }}>Loading products...</p>
            </div>
        </div>
    );

    // ── Error ──
    if (error) return (
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
            <div style={{
                textAlign: "center", background: "#fff",
                border: "1px solid #fee2e2", borderRadius: 16,
                padding: "36px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                width: "100%", maxWidth: 360,
            }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>⚠️</p>
                <p style={{ color: "#1e293b", fontWeight: 700, marginBottom: 16, fontSize: 15 }}>{error}</p>
                <button onClick={fetchProducts} style={{
                    padding: "9px 24px", background: "#2563eb", color: "#fff",
                    border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14,
                    cursor: "pointer", width: "100%",
                }}>Retry</button>
            </div>
        </div>
    );

    const StockCell = ({ product }) => {
        const isES = editingStockId === product._id;
        const si = stockInfo(product);
        if (isES) return (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
                        background: "#fff", border: "2px solid #2563eb",
                        borderRadius: 7, color: "#1e293b",
                        fontSize: 13, fontWeight: 700,
                        outline: "none", fontFamily: "inherit",
                        boxShadow: "0 0 0 3px rgba(37,99,235,0.1)",
                    }}
                />
                <button onClick={() => handleStockSave(product)} disabled={savingStockId === product._id}
                    style={{ padding: "5px 9px", borderRadius: 6, background: "#2563eb", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {savingStockId === product._id ? "…" : "✓"}
                </button>
                <button onClick={() => setEditingStockId(null)}
                    style={{ padding: "5px 8px", borderRadius: 6, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ✕
                </button>
            </div>
        );
        return (
            <button
                onClick={() => { setEditingStockId(product._id); setStockInput(String(product.stock ?? 0)); }}
                style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 20,
                    border: `1px solid ${si.border}`,
                    background: si.bg, color: si.color,
                    fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "opacity 0.15s",
                    whiteSpace: "nowrap",
                }}
            >
                <FaBoxes size={8} /> {si.label}
                <span style={{ fontSize: 9, opacity: 0.5 }}>✎</span>
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
                        background: "#eef2ff", border: "1px solid #e0e7ff", color: "#6366f1",
                        textDecoration: "none",
                    }}>
                    <FaEdit size={12} />
                </Link>
                {isIC ? (
                    <div style={{ display: "flex", gap: 3 }}>
                        <button onClick={() => deleteHandler(product._id)}
                            style={{ padding: "5px 10px", borderRadius: 7, background: "#ef4444", color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Yes
                        </button>
                        <button onClick={() => setConfirmId(null)}
                            style={{ padding: "5px 9px", borderRadius: 7, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            No
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setConfirmId(product._id)} className="uk-action-btn"
                        style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444",
                            cursor: "pointer",
                        }}>
                        <FaTrash size={12} />
                    </button>
                )}
            </div>
        );
    };

    // ── Main ──
    return (
        <div className="adm-wrap" style={{ minHeight: "100vh", background: "#f0f4ff", padding: "24px 16px 60px" }}>
            <style>{STYLES}</style>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
                    zIndex: 9999, display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 20px", borderRadius: 10,
                    background: toast.type === "success" ? "#059669" : "#ef4444",
                    color: "#fff", fontWeight: 700, fontSize: 13,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
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
                        <h1 style={{
                            fontWeight: 800, fontSize: 24,
                            color: "#0f172a", margin: 0,
                            letterSpacing: "-0.03em",
                        }}>Products</h1>
                        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
                            {products.length} total · {filtered.length} showing
                            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
                        </p>
                    </div>
                    <div className="uk-header-btns" style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={refreshProducts}
                            disabled={refreshing}
                            className="uk-refresh-btn"
                            style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "9px 15px", borderRadius: 9,
                                background: "#fff", border: "1px solid #e2e8f0",
                                color: "#64748b", fontSize: 13, fontWeight: 600,
                                cursor: "pointer", fontFamily: "inherit",
                                transition: "all 0.15s",
                            }}
                        >
                            <FaSync size={10} style={{ animation: refreshing ? "adm-spin 0.8s linear infinite" : "none" }} />
                            Refresh
                        </button>
                        <Link to="/admin/products/new" style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "9px 18px", borderRadius: 9,
                            background: "#2563eb", color: "#fff",
                            fontWeight: 700, fontSize: 13,
                            textDecoration: "none",
                            boxShadow: "0 3px 10px rgba(37,99,235,0.35)",
                            transition: "all 0.15s",
                        }}>
                            <FaPlus size={10} /> Add Product
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="uk-stats-grid">
                    {[
                        { label: "Total", value: products.length, color: "#2563eb", bg: "#eff6ff", icon: "📦", border: "#bfdbfe", filter: null },
                        { label: "In Stock", value: products.filter(p => p.inStock).length, color: "#059669", bg: "#f0fdf4", icon: "✅", border: "#bbf7d0", filter: "inStock" },
                        { label: "Out of Stock", value: products.filter(p => !p.inStock).length, color: "#ef4444", bg: "#fef2f2", icon: "❌", border: "#fecaca", filter: "oos" },
                        {
                            label: "Avg Price",
                            value: `₹${products.length
                                ? Math.round(products.reduce((s, p) => s + p.price, 0) / products.length).toLocaleString("en-IN")
                                : 0}`,
                            color: "#7c3aed", bg: "#f5f3ff", icon: "💰", border: "#ddd6fe", filter: "avg",
                        },
                    ].map(({ label, value, color, bg, icon, border, filter }) => (
                        <div key={label} className="uk-stat-card" onClick={() => {
                            if (filter === "avg") return;
                            setStatsFilter(prev => prev === filter ? null : filter);
                            setCurrentPage(1);
                        }} style={{
                            background: statsFilter === filter ? bg : "#fff",
                            border: `1.5px solid ${statsFilter === filter ? color : border}`,
                            borderRadius: 12,
                            padding: "14px 16px",
                            boxShadow: statsFilter === filter ? `0 2px 12px ${color}22` : "0 1px 4px rgba(0,0,0,0.04)",
                            cursor: filter !== "avg" ? "pointer" : "default",
                            transition: "all 0.2s",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <p style={{ fontSize: 10, color: statsFilter === filter ? color : "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                                    {label}
                                    {statsFilter === filter && filter !== null && <span style={{ marginLeft: 4, fontSize: 10 }}>✕</span>}
                                </p>
                                <div style={{
                                    width: 30, height: 30, borderRadius: 8,
                                    background: bg,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 14,
                                }}>
                                    {icon}
                                </div>
                            </div>
                            <p style={{ fontWeight: 800, fontSize: 22, color, margin: 0, letterSpacing: "-0.02em" }}>
                                {value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div style={{ position: "relative", marginBottom: 16 }}>
                    <FaSearch size={12} style={{
                        position: "absolute", left: 14, top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8", pointerEvents: "none",
                    }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name or category..."
                        className="uk-search-input"
                        style={{
                            width: "100%",
                            paddingLeft: 38, paddingRight: search ? 38 : 14,
                            paddingTop: 11, paddingBottom: 11,
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            color: "#1e293b", fontSize: 13,
                            fontFamily: "inherit",
                            boxSizing: "border-box",
                            transition: "border-color 0.15s, box-shadow 0.15s",
                        }}
                    />
                    {search && (
                        <button onClick={() => setSearch("")} style={{
                            position: "absolute", right: 12, top: "50%",
                            transform: "translateY(-50%)",
                            background: "none", border: "none",
                            color: "#94a3b8", cursor: "pointer", fontSize: 15, lineHeight: 1,
                        }}>✕</button>
                    )}
                </div>

                {/* Empty */}
                {filtered.length === 0 ? (
                    <div style={{
                        background: "#fff", border: "1px dashed #cbd5e1",
                        borderRadius: 14, padding: "56px 20px", textAlign: "center",
                    }}>
                        <FaBoxOpen size={36} style={{ color: "#cbd5e1", display: "block", margin: "0 auto 14px" }} />
                        <p style={{ fontWeight: 700, color: "#94a3b8", fontSize: 15 }}>
                            {search ? `No results for "${search}"` : "No products yet"}
                        </p>
                        {!search && (
                            <Link to="/admin/products/new" style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                marginTop: 16, padding: "9px 20px", borderRadius: 9,
                                background: "#2563eb", color: "#fff",
                                fontWeight: 700, fontSize: 13, textDecoration: "none",
                            }}>
                                <FaPlus size={10} /> Add First Product
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        {/* ── DESKTOP TABLE ── */}
                        <div style={{
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 14,
                            overflow: "hidden",
                            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                        }}>
                            {/* Table Header */}
                            <div className="uk-table-header" style={{
                                gridTemplateColumns: "32px 44px 1fr 130px 85px 130px 90px",
                                gap: 10, padding: "11px 18px",
                                background: "#f8fafc",
                                borderBottom: "1px solid #e2e8f0",
                                fontSize: 10, fontWeight: 800,
                                color: "#94a3b8",
                                letterSpacing: "0.09em",
                                textTransform: "uppercase",
                            }}>
                                <div>#</div>
                                <div>Img</div>
                                <div>Product</div>
                                <div>Category</div>
                                <div>Price</div>
                                <div>Stock</div>
                                <div style={{ textAlign: "right" }}>Actions</div>
                            </div>

                            {/* Table Rows */}
                            {paginated.map((product, idx) => {
                                const img = product.images?.[0]?.url || product.image?.url || product.image || null;

                                return (
                                    <div
                                        key={product._id}
                                        className="uk-prod-row uk-table-row"
                                        style={{
                                            gridTemplateColumns: "32px 44px 1fr 130px 85px 130px 90px",
                                            gap: 10, padding: "12px 18px",
                                            alignItems: "center",
                                            borderBottom: "1px solid #f1f5f9",
                                            background: "#fff",
                                            opacity: deletingId === product._id ? 0.4 : 1,
                                            transition: "opacity 0.2s",
                                        }}
                                    >
                                        <div style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 700 }}>
                                            {pageStart + idx + 1}
                                        </div>

                                        <div className="uk-img-wrap" style={{
                                            width: 38, height: 38,
                                            background: "#f8fafc", border: "1px solid #e2e8f0",
                                            borderRadius: 8, overflow: "hidden",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            flexShrink: 0,
                                        }}>
                                            {img
                                                ? <img src={img} alt={product.name} loading="lazy" decoding="async"
                                                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3 }} />
                                                : <FaBoxOpen size={13} style={{ color: "#cbd5e1" }} />
                                            }
                                        </div>

                                        <div style={{ minWidth: 0 }}>
                                            <p style={{
                                                fontWeight: 700, fontSize: 13,
                                                color: "#1e293b", margin: 0,
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}>
                                                {product.name}
                                            </p>
                                            {product.slug ? (
                                                <div style={{
                                                    display: "inline-flex", alignItems: "center", gap: 3,
                                                    marginTop: 3, fontSize: 10, color: "#6366f1",
                                                    background: "#eef2ff", border: "1px solid #e0e7ff",
                                                    padding: "2px 7px", borderRadius: 4,
                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                    maxWidth: "100%",
                                                }}>
                                                    <FaLink size={7} /> {product.slug}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: 10, color: "#f59e0b", marginTop: 3, display: "block" }}>⚠ no slug</span>
                                            )}
                                        </div>

                                        <div>
                                            <span style={{
                                                background: "#fefce8", border: "1px solid #fde68a",
                                                color: "#92400e", fontSize: 10, fontWeight: 700,
                                                padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
                                            }}>
                                                {formatCat(product.category)}
                                            </span>
                                        </div>

                                        <div style={{ fontWeight: 800, fontSize: 13, color: "#2563eb" }}>
                                            ₹{Number(product.price || 0).toLocaleString("en-IN")}
                                        </div>

                                        <StockCell product={product} />
                                        <ActionBtns product={product} />
                                    </div>
                                );
                            })}

                            {/* Pagination */}
                            <div style={{
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 18px",
                                background: "#f8fafc",
                                borderTop: "1px solid #e2e8f0",
                                flexWrap: "wrap", gap: 10,
                            }}>
                                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                                    Showing{" "}
                                    <b style={{ color: "#475569" }}>{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}</b>
                                    {" "}of{" "}
                                    <b style={{ color: "#475569" }}>{filtered.length}</b>
                                </p>
                                {totalPages > 1 && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <button
                                            onClick={() => setCurrentPage(p => p - 1)}
                                            disabled={currentPage === 1}
                                            className="uk-page-btn"
                                            style={{
                                                width: 32, height: 32, borderRadius: 8,
                                                background: "#fff", border: "1px solid #e2e8f0",
                                                color: "#64748b", cursor: "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                opacity: currentPage === 1 ? 0.35 : 1,
                                                transition: "all 0.15s",
                                            }}>
                                            <FaChevronLeft size={9} />
                                        </button>
                                        {getPageNumbers().map((pg, i) =>
                                            pg === "…" ? (
                                                <span key={`e-${i}`} style={{ padding: "0 4px", color: "#cbd5e1", fontSize: 13 }}>…</span>
                                            ) : (
                                                <button key={pg} onClick={() => setCurrentPage(pg)}
                                                    style={{
                                                        width: 32, height: 32, borderRadius: 8,
                                                        background: currentPage === pg ? "#2563eb" : "#fff",
                                                        border: currentPage === pg ? "1px solid #2563eb" : "1px solid #e2e8f0",
                                                        color: currentPage === pg ? "#fff" : "#475569",
                                                        fontSize: 12, fontWeight: 700,
                                                        cursor: "pointer", fontFamily: "inherit",
                                                        transition: "all 0.15s",
                                                    }}>
                                                    {pg}
                                                </button>
                                            )
                                        )}
                                        <button
                                            onClick={() => setCurrentPage(p => p + 1)}
                                            disabled={currentPage === totalPages}
                                            className="uk-page-btn"
                                            style={{
                                                width: 32, height: 32, borderRadius: 8,
                                                background: "#fff", border: "1px solid #e2e8f0",
                                                color: "#64748b", cursor: "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                opacity: currentPage === totalPages ? 0.35 : 1,
                                                transition: "all 0.15s",
                                            }}>
                                            <FaChevronRight size={9} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── MOBILE CARDS ── */}
                        <div className="uk-mobile-cards" style={{ display: "none" }}>
                            {paginated.map((product, idx) => {
                                const img = product.images?.[0]?.url || product.image?.url || product.image || null;
                                const si = stockInfo(product);

                                return (
                                    <div
                                        key={product._id}
                                        className="uk-prod-card"
                                        style={{
                                            background: "#fff",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: 14,
                                            padding: "14px",
                                            marginBottom: 10,
                                            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                                            opacity: deletingId === product._id ? 0.4 : 1,
                                            animationDelay: `${idx * 0.04}s`,
                                        }}
                                    >
                                        {/* Card Top Row — clickable to navigate */}
                                        <Link to={`/admin/products/${product._id}/edit`} style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                                            {/* Image */}
                                            <div className="uk-img-wrap" style={{
                                                width: 56, height: 56, flexShrink: 0,
                                                background: "#f8fafc", border: "1px solid #e2e8f0",
                                                borderRadius: 10, overflow: "hidden",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}>
                                                {img
                                                    ? <img src={img} alt={product.name} loading="lazy"
                                                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                                                    : <FaBoxOpen size={18} style={{ color: "#cbd5e1" }} />
                                                }
                                            </div>

                                            {/* Name + Meta */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontWeight: 700, fontSize: 14,
                                                    color: "#0f172a", margin: "0 0 4px",
                                                    lineHeight: 1.3,
                                                }}>
                                                    {product.name}
                                                </p>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                                                    <span style={{
                                                        background: "#fefce8", border: "1px solid #fde68a",
                                                        color: "#92400e", fontSize: 10, fontWeight: 700,
                                                        padding: "2px 8px", borderRadius: 20,
                                                    }}>
                                                        {formatCat(product.category)}
                                                    </span>
                                                    {product.slug && (
                                                        <div style={{
                                                            display: "inline-flex", alignItems: "center", gap: 3,
                                                            fontSize: 10, color: "#6366f1",
                                                            background: "#eef2ff", border: "1px solid #e0e7ff",
                                                            padding: "2px 7px", borderRadius: 4,
                                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                            maxWidth: 140,
                                                        }}>
                                                            <FaLink size={7} /> {product.slug}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Price */}
                                            <div style={{ fontWeight: 800, fontSize: 15, color: "#2563eb", flexShrink: 0 }}>
                                                ₹{Number(product.price || 0).toLocaleString("en-IN")}
                                            </div>
                                        </Link>

                                        {/* Card Bottom Row */}
                                        <div style={{
                                            display: "flex", alignItems: "center",
                                            justifyContent: "space-between",
                                            paddingTop: 10,
                                            borderTop: "1px solid #f1f5f9",
                                        }}>
                                            <StockCell product={product} />
                                            <ActionBtns product={product} />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Mobile Pagination */}
                            {totalPages > 1 && (
                                <div style={{
                                    display: "flex", alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "12px 4px",
                                }}>
                                    <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                                        <b style={{ color: "#475569" }}>{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}</b>
                                        {" "}of{" "}
                                        <b style={{ color: "#475569" }}>{filtered.length}</b>
                                    </p>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button
                                            onClick={() => setCurrentPage(p => p - 1)}
                                            disabled={currentPage === 1}
                                            style={{
                                                padding: "7px 14px", borderRadius: 8,
                                                background: "#fff", border: "1px solid #e2e8f0",
                                                color: "#64748b", cursor: "pointer",
                                                fontWeight: 600, fontSize: 12,
                                                opacity: currentPage === 1 ? 0.35 : 1,
                                                display: "flex", alignItems: "center", gap: 5,
                                            }}>
                                            <FaChevronLeft size={9} /> Prev
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => p + 1)}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                padding: "7px 14px", borderRadius: 8,
                                                background: "#fff", border: "1px solid #e2e8f0",
                                                color: "#64748b", cursor: "pointer",
                                                fontWeight: 600, fontSize: 12,
                                                opacity: currentPage === totalPages ? 0.35 : 1,
                                                display: "flex", alignItems: "center", gap: 5,
                                            }}>
                                            Next <FaChevronRight size={9} />
                                        </button>
                                    </div>
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