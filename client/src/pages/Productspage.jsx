/**
 * Productspage.jsx — All Products Listing with Unified Cards
 * Shows all ecommerce products with filtering, sorting, and category filtering
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import api from "../api/axios";
import ProductCardUnified from "../components/ProductCardUnified";
import { FaChevronDown, FaSortAmountDown } from "react-icons/fa";

const SORT_OPTIONS = [
    { val: "newest", label: "Newest First" },
    { val: "price_asc", label: "Price: Low to High" },
    { val: "price_desc", label: "Price: High to Low" },
    { val: "rating", label: "Top Rated" },
    { val: "discount", label: "Best Discount" },
];

/* ─────────────────────────────────────────
   SKELETON CARD
───────────────────────────────────────── */
const SkeletonCard = () => (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", aspectRatio: "3/4", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, background: "linear-gradient(90deg,#f0ece4 25%,#e8e4da 50%,#f0ece4 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s ease-in-out infinite" }} />
        <div style={{ padding: "12px 14px 14px" }}>
            <div style={{ height: 10, width: "40%", background: "#f0ede8", marginBottom: 8, borderRadius: 2 }} />
            <div style={{ height: 13, width: "80%", background: "#f0ede8", marginBottom: 6, borderRadius: 2 }} />
            <div style={{ height: 20, width: "35%", background: "#f0ede8", borderRadius: 2 }} />
        </div>
    </div>
);

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
const AllProducts = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
    const [sort, setSort] = useState(searchParams.get("sort") || "newest");
    const [category, setCategory] = useState(searchParams.get("category") || "");
    const [sortOpen, setSortOpen] = useState(false);

    const pageSize = 24;

    useEffect(() => {
        setLoading(true);
        setError(null);

        let url = `/products?page=${page}&limit=${pageSize}&sort=${sort}&productType=ecommerce`;
        if (category) {
            url += `&category=${encodeURIComponent(category)}`;
        }

        api.get(url)
            .then(r => {
                setProducts(r.data?.products || []);
                setTotal(r.data?.total || 0);
            })
            .catch(err => setError((err.response?.data?.error || "Failed to load products")))
            .finally(() => setLoading(false));
    }, [page, sort, category]);

    const handleSort = (newSort) => {
        setSort(newSort);
        setPage(1);
        const params = { sort: newSort, page: 1 };
        if (category) params.category = category;
        setSearchParams(params);
        setSortOpen(false);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        const params = { sort, page: newPage };
        if (category) params.category = category;
        setSearchParams(params);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const totalPages = Math.ceil(total / pageSize);
    const categoryDisplay = category ? " - " + category.replace(/-/g, " ").toUpperCase() : "";

    return (
        <div style={{ background: "#fff", minHeight: "100vh" }}>
            <SEO title={`Products${categoryDisplay}`} description={`Browse ${total || ""} products on Urbexon. Find the best deals on fashion, electronics, and more.`} path="/products" />
            <style>{`
                @keyframes shimmer {
                    0%, 100% { background-position: 200% 0; }
                    50% { background-position: -200% 0; }
                }
                .products-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 20px;
                    width: 100%;
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }
                @media (max-width: 1024px) {
                    .products-container {
                        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                        gap: 16px;
                        padding: 30px 16px;
                    }
                }
                @media (max-width: 640px) {
                    .products-container {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 12px;
                        padding: 20px 12px;
                    }
                }
            `}</style>

            {/* Header */}
            <div style={{ borderBottom: "1px solid #e8e4d9", padding: "24px 20px", background: "#f9f7f3", position: "sticky", top: 0, zIndex: 10 }}>
                <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1c1917", marginBottom: 4 }}>
                            All Products{categoryDisplay}
                        </h1>
                        <p style={{ fontSize: 13, color: "#78716c" }}>{loading ? "Loading..." : `Showing ${products.length} of ${total.toLocaleString()} products`}</p>
                    </div>
                    <div style={{ position: "relative" }}>
                        <button onClick={() => setSortOpen(!sortOpen)}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#1c1917", color: "#fff", border: "none", cursor: "pointer", borderRadius: 6, fontSize: 13, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                            <FaSortAmountDown size={14} />
                            {SORT_OPTIONS.find(o => o.val === sort)?.label || "Sort"}
                            <FaChevronDown size={10} style={{ transform: sortOpen ? "rotate(180deg)" : "", transition: "transform .2s" }} />
                        </button>
                        {sortOpen && (
                            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: "#fff", border: "1px solid #e8e4d9", borderRadius: 6, minWidth: 180, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 100 }}>
                                {SORT_OPTIONS.map(opt => (
                                    <button key={opt.val} onClick={() => handleSort(opt.val)}
                                        style={{ width: "100%", padding: "12px 16px", border: "none", background: sort === opt.val ? "#f3f4ff" : "transparent", color: sort === opt.val ? "#6366f1" : "#1c1917", textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: sort === opt.val ? 600 : 500, fontFamily: "inherit", borderBottom: opt.val !== SORT_OPTIONS[SORT_OPTIONS.length - 1].val ? "1px solid #e8e4d9" : "none" }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            {!loading && error && (
                <div style={{ textAlign: "center", padding: "100px 20px" }}>
                    <p style={{ fontSize: 52, marginBottom: 16 }}>😕</p>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1c1917", marginBottom: 8 }}>{error}</h3>
                    <button onClick={() => window.location.reload()}
                        style={{ padding: "10px 24px", background: "#1c1917", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", borderRadius: 6 }}>
                        Try Again
                    </button>
                </div>
            )}

            {!loading && !error && products.length === 0 && (
                <div style={{ textAlign: "center", padding: "100px 20px" }}>
                    <p style={{ fontSize: 52, marginBottom: 16 }}>📦</p>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1c1917", marginBottom: 8 }}>No Products Found</h3>
                    <p style={{ fontSize: 14, color: "#78716c", marginBottom: 24 }}>Try adjusting your filters or check back soon!</p>
                </div>
            )}

            {(loading || products.length > 0) && (
                <>
                    <div className="products-container">
                        {loading ? Array(pageSize).fill(0).map((_, i) => <SkeletonCard key={i} />) : products.map(p => <ProductCardUnified key={p._id} product={p} variant="default" />)}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "40px 20px", flexWrap: "wrap" }}>
                            <button onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1}
                                style={{ padding: "8px 12px", background: page === 1 ? "#e8e4d9" : "#1c1917", color: page === 1 ? "#a8a29e" : "#fff", border: "none", cursor: page === 1 ? "default" : "pointer", borderRadius: 4, fontWeight: 600, fontFamily: "inherit" }}>
                                Previous
                            </button>
                            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                const pageNum = Math.max(1, page - 2) + i;
                                if (pageNum > totalPages) return null;
                                return (
                                    <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                                        style={{ padding: "8px 12px", background: page === pageNum ? "#1c1917" : "#e8e4d9", color: page === pageNum ? "#fff" : "#1c1917", border: "none", cursor: "pointer", borderRadius: 4, fontWeight: 600, fontFamily: "inherit" }}>
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                                style={{ padding: "8px 12px", background: page === totalPages ? "#e8e4d9" : "#1c1917", color: page === totalPages ? "#a8a29e" : "#fff", border: "none", cursor: page === totalPages ? "default" : "pointer", borderRadius: 4, fontWeight: 600, fontFamily: "inherit" }}>
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AllProducts;
