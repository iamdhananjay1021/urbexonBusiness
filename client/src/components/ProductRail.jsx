/**
 * ProductRail — the reusable horizontal recommendation section.
 * One component renders ANY strategy the Recommendation Engine exposes:
 *
 *   <ProductRail type="trending" title="Trending Now" />
 *   <ProductRail type="popular-in-category" category="shirts" title="Popular in Shirts" />
 *   <ProductRail type="similar" productId={id} title="Similar Products" />
 *
 * Uses the global ProductCard so cards look identical everywhere.
 * Renders nothing (no empty section) when the strategy returns no items.
 */
import { memo, useRef } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import ProductCard from "./ProductCard";
import useRecommendations from "../hooks/useRecommendations";

const CARD_W = "w-[180px] min-w-[180px] sm:w-[190px] sm:min-w-[190px] lg:w-[220px] lg:min-w-[220px]";

const RailSkeleton = () => (
    <div className="flex gap-3 sm:gap-4 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`${CARD_W} shrink-0`}>
                <div className="bg-white rounded-xl border border-[var(--color-graphite-100)] overflow-hidden">
                    <div className="aspect-[4/3] bg-[var(--color-graphite-100)] animate-pulse" />
                    <div className="p-3 flex flex-col gap-2">
                        <div className="h-3 w-4/5 bg-[var(--color-graphite-100)] rounded animate-pulse" />
                        <div className="h-3 w-2/5 bg-[var(--color-graphite-100)] rounded animate-pulse" />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const ProductRail = memo(({ type, title, sub, category, productId, limit = 12, to, label = "View all" }) => {
    const { products, loading } = useRecommendations(type, { category, productId, limit });
    const rowRef = useRef(null);
    const scroll = (dir) => rowRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

    if (!loading && products.length === 0) return null;

    return (
        <section aria-label={title}>
            {/* Header — same pattern as Home's SecHead */}
            <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
                <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight leading-tight m-0">
                        {title}
                    </h2>
                    {sub && <p className="text-[13px] text-muted mt-1.5">{sub}</p>}
                </div>
                {to && (
                    <Link to={to}
                        className="group inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg
                                   border border-default bg-white text-xs font-semibold text-secondary
                                   no-underline whitespace-nowrap
                                   hover:border-strong hover:text-primary transition-colors duration-200">
                        {label}
                        <FaArrowRight size={9} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                )}
            </div>

            {loading ? <RailSkeleton /> : (
                <div className="relative group/rail">
                    <button onClick={() => scroll(-1)} aria-label="Scroll left"
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10
                                   w-9 h-9 rounded-full bg-white border border-strong shadow-md
                                   items-center justify-center text-secondary hover:text-primary
                                   transition-all duration-200 hidden md:flex
                                   opacity-0 group-hover/rail:opacity-100">
                        <FaChevronLeft size={11} />
                    </button>
                    <button onClick={() => scroll(1)} aria-label="Scroll right"
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10
                                   w-9 h-9 rounded-full bg-white border border-strong shadow-md
                                   items-center justify-center text-secondary hover:text-primary
                                   transition-all duration-200 hidden md:flex
                                   opacity-0 group-hover/rail:opacity-100">
                        <FaChevronRight size={11} />
                    </button>
                    <div ref={rowRef}
                        className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 pt-0.5
                                   scroll-smooth [scroll-snap-type:x_mandatory]
                                   [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {products.map((p) => (
                            <div key={p._id} className={`${CARD_W} shrink-0 [scroll-snap-align:start]`}>
                                <ProductCard product={p} hideActions />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
});
ProductRail.displayName = "ProductRail";
export default ProductRail;
