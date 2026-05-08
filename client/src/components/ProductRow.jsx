import { useRef, useCallback, useEffect } from "react";
import ProductCard from "./ProductCard";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const ProductRow = ({ title, products = [] }) => {
    const rowRef = useRef(null);

    // BUG FIX: Null safety - ensure products is always an array
    const safeProducts = Array.isArray(products) ? products : [];

    const scrollBy = useCallback((dir) => {
        rowRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => { };
    }, []);

    if (!safeProducts.length) return null;

    return (
        <section className="relative">
            {/* Section header */}
            <div className="flex items-center justify-between mb-4 px-4 sm:px-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#1c1917] tracking-tight">
                    {title}
                </h2>

                {/* Desktop nav arrows */}
                <div className="hidden md:flex gap-2">
                    <button
                        onClick={() => scrollBy(-1)}
                        className="w-9 h-9 rounded-full bg-[#f5f2ec] hover:bg-[#ede9e4] border border-[#e7e5e1] flex items-center justify-center text-[#1c1917] transition-all hover:scale-105"
                        aria-label="Scroll left"
                    >
                        <FaChevronLeft size={12} />
                    </button>
                    <button
                        onClick={() => scrollBy(1)}
                        className="w-9 h-9 rounded-full bg-[#f5f2ec] hover:bg-[#ede9e4] border border-[#e7e5e1] flex items-center justify-center text-[#1c1917] transition-all hover:scale-105"
                        aria-label="Scroll right"
                    >
                        <FaChevronRight size={12} />
                    </button>
                </div>
            </div>

            {/* Scroll container */}
            <div
                ref={rowRef}
                className="
          flex gap-3 sm:gap-4
          overflow-x-auto
          pb-4 px-4 sm:px-0
          snap-x snap-mandatory
          scroll-smooth
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
          items-stretch
        "
            >
                {safeProducts.map((product) => (
                    <div
                        key={product._id || product.id}
                        className="min-w-[155px] xs:min-w-[160px] sm:min-w-[210px] md:min-w-[240px] lg:min-w-[260px] flex-shrink-0 snap-start flex flex-col"
                    >
                        {/* hideActions=true for home page rows — no buy/cart on mobile bar */}
                        <ProductCard product={product} hideActions={false} />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ProductRow;