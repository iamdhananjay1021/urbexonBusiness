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

    useEffect(() => {
        checkScroll();
        const el = sliderRef.current;
        if (!el) return;
        el.addEventListener("scroll", checkScroll, { passive: true });
        window.addEventListener("resize", checkScroll);
        return () => {
            el.removeEventListener("scroll", checkScroll);
            window.removeEventListener("resize", checkScroll);
        };
    }, [products]);

    const scroll = (direction) => {
        if (!sliderRef.current) return;
        const cardWidth = sliderRef.current.querySelector(".rps-card")?.offsetWidth || 260;
        sliderRef.current.scrollBy({
            left: direction === "left" ? -(cardWidth + 16) : (cardWidth + 16),
            behavior: "smooth",
        });
    };

    if (!products || products.length === 0) return null;

    return (
        <>
            <style>{`
                .rps-wrap { position: relative; }
                .rps-track {
                    display: flex;
                    gap: 16px;
                    overflow-x: auto;
                    scroll-snap-type: x mandatory;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    padding-bottom: 4px;
                }
                .rps-track::-webkit-scrollbar { display: none; }
                .rps-card {
                    flex: 0 0 240px;
                    scroll-snap-align: start;
                }
                @media (min-width: 640px) { .rps-card { flex: 0 0 260px; } }
                @media (min-width: 1024px) { .rps-card { flex: 0 0 280px; } }
                .rps-arrow {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 10;
                    width: 36px; height: 36px;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(4px);
                    border: 1px solid #e7e5e4;
                    border-radius: 0;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                }
                .rps-arrow:hover { background: #1c1917; color: white; border-color: #1c1917; }
                .rps-arrow:disabled { opacity: 0; pointer-events: none; }
                .rps-arrow-left { left: -16px; }
                .rps-arrow-right { right: -16px; }
                @media (min-width: 1024px) {
                    .rps-arrow-left { left: -40px; }
                    .rps-arrow-right { right: -40px; }
                }
                @media (min-width: 1280px) {
                    .rps-arrow-left { left: -52px; }
                    .rps-arrow-right { right: -52px; }
                }
                @media (max-width: 640px) {
                    .rps-arrow { display: none; }
                }
            `}</style>

            <div className="rps-wrap">
                <button
                    className="rps-arrow rps-arrow-left"
                    onClick={() => scroll("left")}
                    disabled={!canScrollLeft}
                    aria-label="Scroll left"
                >
                    <ChevronLeft size={16} />
                </button>

                <div ref={sliderRef} className="rps-track">
                    {products.map((product) => (
                        <div key={product._id} className="rps-card">
                            <ProductCard product={product} />
                        </div>
                    ))}
                </div>

                <button
                    className="rps-arrow rps-arrow-right"
                    onClick={() => scroll("right")}
                    disabled={!canScrollRight}
                    aria-label="Scroll right"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </>
    );
};

export default RelatedProductsSlider;