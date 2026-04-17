/**
 * CategoryBrowser.jsx — Myntra-style Category Explorer
 * ✅ Dynamic categories from API
 * ✅ Horizontal scroll category circles with images
 * ✅ Click to expand subcategories (fetched dynamically)
 * ✅ Subcategory click → navigates to category page with subcategory filter
 * ✅ Fully responsive
 */
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchActiveCategories, fetchCategorySubcategories } from "../api/categoryApi";

/* ── CSS ── */
const CSS = `
/* ═══ CATEGORY BROWSER ═══ */
.cb-root {
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    background: #fff;
    padding: 0 0 4px;
    position: relative;
}

/* ── Scrollable category strip ── */
.cb-strip-wrap {
    position: relative;
    overflow: hidden;
}
.cb-strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 16px 16px 8px;
}
.cb-strip::-webkit-scrollbar { display: none; }

/* ── Arrow buttons ── */
.cb-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
    width: 32px; height: 32px;
    border-radius: 50%;
    border: 1px solid #e5e7eb;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all .15s;
    color: #374151;
    font-size: 14px;
}
.cb-arrow:hover { background: #f9fafb; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
.cb-arrow-l { left: 4px; }
.cb-arrow-r { right: 4px; }
@media (max-width: 768px) { .cb-arrow { display: none; } }

/* ── Category item ── */
.cb-item {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 4px 6px 8px;
    border-radius: 12px;
    transition: all .2s;
    min-width: 72px;
    max-width: 84px;
    position: relative;
}
.cb-item:hover { background: #f8f9fa; }
.cb-item.active {
    background: #fff0f6;
}
.cb-item.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(135deg, #ff3f6c, #ff6b8a);
}

/* ── Circle icon ── */
.cb-circle {
    width: 56px; height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: all .25s cubic-bezier(.34,1.56,.64,1);
    border: 2px solid transparent;
    background: #f3f4f6;
}
.cb-item:hover .cb-circle { transform: scale(1.08); }
.cb-item.active .cb-circle {
    border-color: #ff3f6c;
    box-shadow: 0 0 0 3px rgba(255,63,108,.15);
}
.cb-circle img {
    width: 100%; height: 100%;
    object-fit: cover;
    border-radius: 50%;
}
.cb-circle-emoji {
    font-size: 26px;
    line-height: 1;
}

/* ── Label ── */
.cb-label {
    font-size: 10px;
    font-weight: 600;
    color: #374151;
    text-align: center;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80px;
    letter-spacing: .01em;
}
.cb-item.active .cb-label {
    color: #ff3f6c;
    font-weight: 700;
}

/* ═══ SUBCATEGORY PANEL ═══ */
.cb-sub-panel {
    overflow: hidden;
    transition: max-height .35s cubic-bezier(.4,0,.2,1), opacity .25s ease;
    max-height: 0;
    opacity: 0;
}
.cb-sub-panel.open {
    max-height: 500px;
    opacity: 1;
}

.cb-sub-inner {
    padding: 12px 16px 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    border-top: 1px solid #f3f4f6;
    animation: cb-fadeIn .3s ease;
}

@keyframes cb-fadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: none; }
}

/* ── Subcategory chip ── */
.cb-sub-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px 8px 8px;
    border-radius: 24px;
    border: 1px solid #e5e7eb;
    background: #fff;
    cursor: pointer;
    transition: all .2s;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    font-family: inherit;
}
.cb-sub-chip:hover {
    border-color: #ff3f6c;
    background: #fff5f7;
    color: #ff3f6c;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255,63,108,.1);
}
.cb-sub-chip:active { transform: scale(.97); }

.cb-sub-thumb {
    width: 32px; height: 32px;
    border-radius: 50%;
    object-fit: cover;
    background: #f3f4f6;
    flex-shrink: 0;
}

.cb-sub-count {
    font-size: 10px;
    font-weight: 500;
    color: #9ca3af;
    margin-left: 2px;
}

/* ── View All pill ── */
.cb-sub-viewall {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 24px;
    border: 1px dashed #d1d5db;
    background: #fafafa;
    cursor: pointer;
    transition: all .2s;
    font-size: 12px;
    font-weight: 700;
    color: #6b7280;
    font-family: inherit;
}
.cb-sub-viewall:hover {
    border-color: #ff3f6c;
    color: #ff3f6c;
    background: #fff5f7;
}

/* ── Loading ── */
.cb-sub-loading {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
}
.cb-sub-skel {
    width: 100px; height: 40px;
    border-radius: 24px;
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 200% 100%;
    animation: cb-shimmer 1.5s infinite;
}
@keyframes cb-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ── Section header ── */
.cb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 0;
}
.cb-title {
    font-size: 15px;
    font-weight: 800;
    color: #111827;
    letter-spacing: -.01em;
}
.cb-subtitle {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 500;
}

/* ── Responsive ── */
@media (min-width: 768px) {
    .cb-strip { padding: 16px 20px 8px; gap: 8px; }
    .cb-sub-inner { padding: 14px 20px 18px; }
    .cb-header { padding: 18px 20px 0; }
    .cb-item { min-width: 80px; max-width: 92px; }
    .cb-circle { width: 64px; height: 64px; }
    .cb-label { font-size: 11px; max-width: 88px; }
}
@media (min-width: 1024px) {
    .cb-strip { padding: 16px 24px 10px; gap: 10px; }
    .cb-sub-inner { padding: 16px 24px 20px; gap: 10px; }
    .cb-header { padding: 20px 24px 0; }
    .cb-item { min-width: 88px; max-width: 100px; }
    .cb-circle { width: 68px; height: 68px; }
    .cb-label { font-size: 11px; max-width: 96px; }
}
`;

const CategoryBrowser = memo(({ categories: propCategories, onCategorySelect, activeCategory: externalActive, title, subtitle, type }) => {
    const navigate = useNavigate();
    const stripRef = useRef(null);

    const [categories, setCategories] = useState(propCategories || []);
    const [activeSlug, setActiveSlug] = useState(null);
    const [subcategories, setSubcategories] = useState([]);
    const [subLoading, setSubLoading] = useState(false);
    const [showArrows, setShowArrows] = useState({ left: false, right: false });

    // Callback mode: parent controls active state
    const isCallbackMode = typeof onCategorySelect === "function";

    // If categories are not passed as prop, fetch them
    useEffect(() => {
        if (propCategories?.length) { setCategories(propCategories); return; }
        const params = type ? { params: { type } } : undefined;
        fetchActiveCategories(params)
            .then(r => setCategories(r.data || []))
            .catch(() => { });
    }, [propCategories, type]);

    // Check scroll arrows
    const checkArrows = useCallback(() => {
        const el = stripRef.current;
        if (!el) return;
        setShowArrows({
            left: el.scrollLeft > 10,
            right: el.scrollLeft + el.clientWidth < el.scrollWidth - 10,
        });
    }, []);

    useEffect(() => {
        checkArrows();
        const el = stripRef.current;
        if (el) el.addEventListener("scroll", checkArrows, { passive: true });
        window.addEventListener("resize", checkArrows, { passive: true });
        return () => {
            if (el) el.removeEventListener("scroll", checkArrows);
            window.removeEventListener("resize", checkArrows);
        };
    }, [categories, checkArrows]);

    const scroll = (dir) => {
        const el = stripRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * 260, behavior: "smooth" });
    };

    // Handle category click — toggle subcategories OR callback mode
    const handleCategoryClick = useCallback(async (cat) => {
        if (isCallbackMode) {
            // Callback mode: notify parent, no subcategory expansion
            const catName = cat.name;
            onCategorySelect(externalActive === catName ? null : catName);
            return;
        }

        if (activeSlug === cat.slug) {
            // Toggle off
            setActiveSlug(null);
            setSubcategories([]);
            return;
        }

        setActiveSlug(cat.slug);
        setSubLoading(true);
        setSubcategories([]);

        try {
            const { data } = await fetchCategorySubcategories(cat.slug);
            setSubcategories(data.subcategories || []);
        } catch {
            setSubcategories([]);
        } finally {
            setSubLoading(false);
        }
    }, [activeSlug, isCallbackMode, onCategorySelect, externalActive]);

    const handleSubcategoryClick = useCallback((catSlug, subcatName) => {
        navigate(`/category/${catSlug}?subcategory=${encodeURIComponent(subcatName)}`);
    }, [navigate]);

    const handleViewAll = useCallback((catSlug) => {
        navigate(`/category/${catSlug}`);
    }, [navigate]);

    if (!categories.length) return null;

    return (
        <div className="cb-root">
            <style>{CSS}</style>

            {/* Header */}
            <div className="cb-header">
                <div>
                    <div className="cb-title">{title || "Shop by Category"}</div>
                    <div className="cb-subtitle">{subtitle || (isCallbackMode ? "Tap to filter" : "Tap to explore subcategories")}</div>
                </div>
            </div>

            {/* Scrollable category strip */}
            <div className="cb-strip-wrap">
                {showArrows.left && (
                    <button className="cb-arrow cb-arrow-l" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
                )}
                <div className="cb-strip" ref={stripRef}>
                    {categories.map(cat => {
                        const isActive = isCallbackMode ? externalActive === cat.name : activeSlug === cat.slug;
                        return (
                            <div
                                key={cat._id}
                                className={`cb-item${isActive ? " active" : ""}`}
                                onClick={() => handleCategoryClick(cat)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => e.key === "Enter" && handleCategoryClick(cat)}
                            >
                                <div className="cb-circle" style={{ background: cat.lightColor || "#f3f4f6" }}>
                                    {cat.image?.url
                                        ? <img src={cat.image.url} alt={cat.name} loading="lazy" />
                                        : <span className="cb-circle-emoji">{cat.emoji || "🛍️"}</span>
                                    }
                                </div>
                                <span className="cb-label">{cat.name}</span>
                            </div>
                        );
                    })}
                </div>
                {showArrows.right && (
                    <button className="cb-arrow cb-arrow-r" onClick={() => scroll(1)} aria-label="Scroll right">›</button>
                )}
            </div>

            {/* Subcategory panel */}
            <div className={`cb-sub-panel${activeSlug ? " open" : ""}`}>
                {subLoading ? (
                    <div className="cb-sub-loading">
                        {[90, 110, 80, 100, 95].map((w, i) => (
                            <div key={i} className="cb-sub-skel" style={{ width: w }} />
                        ))}
                    </div>
                ) : subcategories.length > 0 ? (
                    <div className="cb-sub-inner">
                        {subcategories.map(sub => (
                            <button
                                key={sub.name}
                                className="cb-sub-chip"
                                onClick={() => handleSubcategoryClick(activeSlug, sub.name)}
                            >
                                {sub.image && (
                                    <img className="cb-sub-thumb" src={sub.image} alt={sub.name} loading="lazy" />
                                )}
                                <span>{sub.name}</span>
                                <span className="cb-sub-count">({sub.count})</span>
                            </button>
                        ))}
                        <button
                            className="cb-sub-viewall"
                            onClick={() => handleViewAll(activeSlug)}
                        >
                            View All →
                        </button>
                    </div>
                ) : activeSlug && !subLoading ? (
                    <div className="cb-sub-inner">
                        <button
                            className="cb-sub-viewall"
                            onClick={() => handleViewAll(activeSlug)}
                        >
                            Browse All Products →
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
});

CategoryBrowser.displayName = "CategoryBrowser";
export default CategoryBrowser;
