import { useNavigate } from "react-router-dom";
import { CATEGORIES } from "../data/categories";

const ShopByCategory = () => {
    const navigate = useNavigate();

    return (
        <section className="py-12 bg-white font-sans">
            <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
                <div className="flex items-baseline justify-between mb-8">
                    <div>
                        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#c8a96e] mb-1.5">
                            Browse
                        </p>
                        <h2 className="font-serif text-[28px] sm:text-[32px] font-semibold text-[#1c1917] tracking-tight m-0">
                            Shop by Category
                        </h2>
                    </div>
                    <button
                        onClick={() => navigate("/")}
                        className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#1c1917] border-b border-[#1c1917] pb-[1px] hover:text-[#c8a96e] hover:border-[#c8a96e] transition-colors flex-shrink-0 bg-transparent cursor-pointer"
                    >
                        View All →
                    </button>
                </div>

                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3 sm:gap-4">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.value}
                            onClick={() => navigate(`/?category=${encodeURIComponent(cat.value)}`)}
                            className="group relative flex flex-col items-center gap-3 p-4 sm:p-5 text-center bg-white border border-[#e7e5e1] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-[#c8a96e] hover:shadow-[0_6px_24px_rgba(28,25,23,0.09)] hover:-translate-y-0.5 active:scale-[0.98]"
                        >
                            {/* Bottom gold accent line */}
                            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#c8a96e] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />

                            <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-[#f5f2ec] rounded-full text-2xl sm:text-[28px] transition-all duration-300 group-hover:scale-[1.12] group-hover:bg-[#fdf6ea]">
                                <span>{cat.icon}</span>
                            </div>
                            <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.04em] uppercase text-[#1c1917] group-hover:text-[#c8a96e] transition-colors line-clamp-2 leading-snug">
                                {cat.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ShopByCategory;