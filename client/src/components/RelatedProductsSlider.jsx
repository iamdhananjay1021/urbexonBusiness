/**
 * RelatedProductsSlider.jsx — v3
 * Full Tailwind · zero <style> blocks · all logic preserved
 */
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";

const RelatedProductsSlider = ({ products }) => {
    const sliderRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        const el = sliderRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    // BUG FIX: scroll fires far more often than the browser can paint —
    // coalesce the 2 setState calls to once per animation frame instead of
    // once per raw scroll event, so a scroll gesture doesn't queue dozens
    // of redundant re-renders.
    useEffect(() => {
        checkScroll();
        const el = sliderRef.current;
        if (!el) return;
        let rafId = null;
        const onScroll = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => { rafId = null; checkScroll(); });
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            el.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [products]);

    const scroll = dir => {
        if (!sliderRef.current) return;
        const cardWidth = sliderRef.current.querySelector(".rps-card")?.offsetWidth || 260;
        sliderRef.current.scrollBy({ left: dir === "left" ? -(cardWidth + 12) : (cardWidth + 12), behavior: "smooth" });
    };

    if (!products?.length) return null;

    return (
        <div className="relative group/slider">
            {/* ── Left arrow ── */}
            <button
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                aria-label="Scroll left"
                className={`
                    absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4
                    z-10 w-9 h-9 rounded-full
                    bg-white border border-neutral-200 shadow-md
                    flex items-center justify-center
                    text-neutral-500 hover:text-neutral-900
                    hover:border-neutral-300 hover:shadow-lg
                    transition-all duration-200
                    hidden md:flex
                    ${canScrollLeft
                        ? "opacity-0 group-hover/slider:opacity-100"
                        : "opacity-0 pointer-events-none"}
                `}
            >
                <ChevronLeft size={15} />
            </button>

            {/* ── Track ── */}
            <div
                ref={sliderRef}
                className="
                    flex gap-3 overflow-x-auto pb-2 pt-0.5
                    scroll-smooth [scroll-snap-type:x_mandatory]
                    [&::-webkit-scrollbar]:hidden
                    [-ms-overflow-style:none]
                    [scrollbar-width:none]
                "
            >
                {products.map(product => (
                    <div
                        key={product._id}
                        className="
                            rps-card shrink-0
                            w-[200px] sm:w-[220px] lg:w-[240px]
                            [scroll-snap-align:start]
                        "
                    >
                        <ProductCard product={product} />
                    </div>
                ))}
            </div>

            {/* ── Right arrow ── */}
            <button
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                aria-label="Scroll right"
                className={`
                    absolute right-0 top-1/2 -translate-y-1/2 translate-x-4
                    z-10 w-9 h-9 rounded-full
                    bg-white border border-neutral-200 shadow-md
                    flex items-center justify-center
                    text-neutral-500 hover:text-neutral-900
                    hover:border-neutral-300 hover:shadow-lg
                    transition-all duration-200
                    hidden md:flex
                    ${canScrollRight
                        ? "opacity-0 group-hover/slider:opacity-100"
                        : "opacity-0 pointer-events-none"}
                `}
            >
                <ChevronRight size={15} />
            </button>
        </div>
    );
};

export default RelatedProductsSlider;