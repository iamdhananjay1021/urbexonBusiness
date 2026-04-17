import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { fetchCategoryBySlug, fetchCategorySubcategories } from "../api/categoryApi";
import ProductCardUnified from "../components/ProductCardUnified";
import {
    FaTimes, FaChevronDown, FaChevronUp,
    FaSortAmountDown, FaSearch,
} from "react-icons/fa";

const SORT_OPTIONS = [
    { val: "newest", label: "Newest First" },
    { val: "price_asc", label: "Price: Low to High" },
    { val: "price_desc", label: "Price: High to Low" },
    { val: "rating", label: "Top Rated" },
    { val: "discount", label: "Best Discount" },
];

/* ════════════════════════════════════════
   CATEGORY PAGE
════════════════════════════════════════ */
const CategoryPage = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [inView, setInView] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [sort, setSort] = useState(searchParams.get("sort") || "newest");
    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
    const [sortOpen, setSortOpen] = useState(false);
    const [activeSubcategory, setActiveSubcategory] = useState(searchParams.get("subcategory") || "");
    const [subcategories, setSubcategories] = useState([]);

    const LIMIT = 12;
    const [categoryLabel, setCategoryLabel] = useState(
        slug?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Products"
    );

    // Fetch proper category name + subcategories from API
    useEffect(() => {
        if (!slug) return;
        setCategoryLabel(slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
        fetchCategoryBySlug(slug)
            .then(r => { if (r.data?.name) setCategoryLabel(r.data.name); })
            .catch(() => { });
        fetchCategorySubcategories(slug)
            .then(r => setSubcategories(r.data?.subcategories || []))
            .catch(() => { });
    }, [slug]);

    // Sync subcategory from URL
    useEffect(() => {
        setActiveSubcategory(searchParams.get("subcategory") || "");
    }, [searchParams]);

    /* ── Fetch ── */
    const fetchProducts = useCallback(async (pg = 1, srt = sort, srch = search) => {
        try {
            setLoading(true);

            const params = new URLSearchParams({
                category: slug,
                sort: srt,
                limit: LIMIT,
                page: pg,
            });
            if (activeSubcategory) params.set("subcategory", activeSubcategory);
            if (srch.trim()) params.set("search", srch.trim());

            const { data } = await api.get(`/products?${params}`);
            const prods = Array.isArray(data) ? data : (data?.products || []);
            const totalCount = data?.total || prods.length;

            setProducts(pg === 1 ? prods : prev => [...prev, ...prods]);
            setTotal(pg === 1 ? totalCount : prev => prev);
            setHasMore(prods.length === LIMIT);
        } catch (e) {
            console.error("Category fetch error:", e);
        } finally {
            setLoading(false);
            setTimeout(() => setInView(true), 80);
        }
    }, [slug, sort, search, activeSubcategory]);

    // Re-fetch when slug/sort/search/subcategory changes
    useEffect(() => {
        setPage(1);
        setProducts([]);
        setInView(false);
        fetchProducts(1, sort, search);
    }, [slug, sort, search, activeSubcategory]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
    };

    const handleSort = (val) => {
        setSort(val);
        setSortOpen(false);
        setSearchParams(p => { p.set("sort", val); return p; });
    };

    const handleSubcategory = (name) => {
        setSearchParams(p => {
            if (name) p.set("subcategory", name);
            else p.delete("subcategory");
            return p;
        });
    };

    const loadMore = () => {
        const next = page + 1;
        setPage(next);
        fetchProducts(next, sort, search);
    };

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        .cp { font-family:'DM Sans',sans-serif; min-height:100vh; background:#f7f4ee; }
        .cp-skel { background:linear-gradient(90deg,#ede9e1 25%,#e5e1d8 50%,#ede9e1 75%); background-size:200% 100%; animation:cpShim 1.5s ease-in-out infinite; }
        @keyframes cpShim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .cp-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        @media (max-width:1024px) { .cp-grid { grid-template-columns:repeat(3,1fr); gap:14px; } }
        @media (max-width:640px)  { .cp-grid { grid-template-columns:repeat(2,1fr); gap:10px; } }
        @media (max-width:340px)  { .cp-grid { grid-template-columns:1fr; } }
        .cp-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        @media (max-width:520px) {
          .cp-toolbar { gap:8px; }
          .cp-toolbar-search { min-width:0!important; max-width:none!important; order:1; flex-basis:100%; }
          .cp-toolbar-count { order:3; font-size:11px!important; }
          .cp-toolbar-sort { order:2; margin-left:auto; }
          .cp-sort-label { display:none; }
        }
        .cp-sort-dd { position:absolute; top:calc(100% + 6px); right:0; background:#fff; border:1px solid #e8e4d9; min-width:200px; z-index:50; box-shadow:0 12px 32px rgba(0,0,0,.1); }
        @media (max-width:520px) { .cp-sort-dd { right:-8px; min-width:180px; } }
        .cp-sort-item { padding:10px 16px; font-size:13px; font-weight:500; color:#1c1917; cursor:pointer; transition:background .15s; }
        .cp-sort-item:hover { background:#f7f4ee; }
        .cp-sort-item.active { color:#c9a84c; font-weight:700; background:#fdf8ee; }
      `}</style>

            <div className="cp">

                {/* ── Hero banner ── */}
                <div style={{ background: "#1a1740", padding: "48px clamp(16px,5vw,80px) 40px" }}>
                    <div style={{ maxWidth: 1440, margin: "0 auto" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(201,168,76,.7)", marginBottom: 10 }}>
                            Urbexon · {categoryLabel}
                        </p>
                        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>
                            {categoryLabel}{activeSubcategory ? ` › ${activeSubcategory}` : ""}
                        </h1>
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", margin: 0 }}>
                            {loading ? "Loading products…" : `${total || products.length} products`}
                        </p>
                    </div>
                </div>

                {/* ── Toolbar ── */}
                <div style={{ background: "#fff", borderBottom: "1px solid #e8e4d9", position: "sticky", top: 64, zIndex: 40 }}>
                    <div className="cp-toolbar" style={{ maxWidth: 1440, margin: "0 auto", padding: "12px clamp(16px,5vw,80px)" }}>

                        {/* Search */}
                        <form className="cp-toolbar-search" onSubmit={handleSearch} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 180, maxWidth: 340, background: "#f7f4ee", border: "1px solid #e8e4d9", padding: "0 12px", height: 38 }}>
                            <FaSearch size={12} color="#a8a29e" />
                            <input
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder={`Search in ${categoryLabel}…`}
                                style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "#1c1917", width: "100%", fontFamily: "inherit" }}
                            />
                            {searchInput && (
                                <button type="button" onClick={() => { setSearchInput(""); setSearch(""); }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#a8a29e", padding: 0 }}>
                                    <FaTimes size={11} />
                                </button>
                            )}
                        </form>

                        {/* Results count */}
                        <span className="cp-toolbar-count" style={{ fontSize: 12, color: "#a8a29e", whiteSpace: "nowrap" }}>
                            {!loading && `${products.length} products`}
                        </span>

                        {/* Sort */}
                        <div className="cp-toolbar-sort" style={{ position: "relative", marginLeft: "auto" }}>
                            <button
                                onClick={() => setSortOpen(o => !o)}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", border: "1px solid #e8e4d9", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#1c1917", fontFamily: "inherit", height: 38 }}
                            >
                                <FaSortAmountDown size={12} />
                                <span className="cp-sort-label">{SORT_OPTIONS.find(s => s.val === sort)?.label || "Sort"}</span>
                                {sortOpen ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                            </button>
                            {sortOpen && (
                                <>
                                    <div onClick={() => setSortOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
                                    <div className="cp-sort-dd">
                                        {SORT_OPTIONS.map(opt => (
                                            <div key={opt.val} className={`cp-sort-item${sort === opt.val ? " active" : ""}`} onClick={() => handleSort(opt.val)}>
                                                {sort === opt.val && "✓ "}{opt.label}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Subcategory Filter Chips ── */}
                {subcategories.length > 0 && (
                    <div style={{ background: "#fafaf8", borderBottom: "1px solid #e8e4d9" }}>
                        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "10px clamp(16px,5vw,80px)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                                onClick={() => handleSubcategory("")}
                                style={{
                                    padding: "6px 16px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .2s",
                                    background: !activeSubcategory ? "#1a1740" : "#fff",
                                    color: !activeSubcategory ? "#fff" : "#374151",
                                    borderColor: !activeSubcategory ? "#1a1740" : "#d1d5db",
                                }}
                            >
                                All
                            </button>
                            {subcategories.map(sub => (
                                <button
                                    key={sub.name}
                                    onClick={() => handleSubcategory(sub.name)}
                                    style={{
                                        padding: "6px 16px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .2s",
                                        background: activeSubcategory === sub.name ? "#1a1740" : "#fff",
                                        color: activeSubcategory === sub.name ? "#fff" : "#374151",
                                        borderColor: activeSubcategory === sub.name ? "#1a1740" : "#d1d5db",
                                    }}
                                >
                                    {sub.name} <span style={{ fontSize: 10, opacity: .6 }}>({sub.count})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Products ── */}
                <div style={{ maxWidth: 1440, margin: "0 auto", padding: "32px clamp(16px,5vw,80px) 64px" }}>

                    {/* Skeleton */}
                    {loading && products.length === 0 && (
                        <div className="cp-grid">
                            {Array(12).fill(0).map((_, i) => (
                                <div key={i} style={{ aspectRatio: "3/4" }} className="cp-skel" />
                            ))}
                        </div>
                    )}

                    {/* Empty */}
                    {!loading && products.length === 0 && (
                        <div style={{ textAlign: "center", padding: "80px 20px" }}>
                            <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
                            <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.6rem", color: "#1a1740", marginBottom: 8 }}>
                                No products found
                            </h3>
                            <p style={{ fontSize: 13, color: "#a8a29e", marginBottom: 24 }}>
                                Try different search terms or browse other categories
                            </p>
                            <button onClick={() => navigate("/")}
                                style={{ padding: "12px 28px", background: "#1a1740", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, letterSpacing: ".08em" }}>
                                Back to Home
                            </button>
                        </div>
                    )}

                    {/* Grid */}
                    {products.length > 0 && (
                        <>
                            <div className="cp-grid">
                                {products.map((p) => (
                                    <ProductCardUnified key={p._id} product={p} variant="default" />
                                ))}
                            </div>

                            {/* Load more */}
                            {hasMore && (
                                <div style={{ textAlign: "center", marginTop: 48 }}>
                                    <button
                                        onClick={loadMore}
                                        disabled={loading}
                                        style={{ padding: "14px 40px", border: "1.5px solid #1a1740", background: "transparent", color: "#1a1740", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", transition: "all .2s", opacity: loading ? .6 : 1 }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "#1a1740"; e.currentTarget.style.color = "#fff"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#1a1740"; }}
                                    >
                                        {loading ? "Loading…" : "Load More"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default CategoryPage;