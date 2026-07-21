/**
 * CategoryCircles.jsx — Myntra-style round category shortcuts.
 * A horizontally-scrollable strip of circular category icons that sits
 * directly under the hero. 100% admin-driven: it renders whatever active
 * ecommerce categories exist (Admin → Categories), using each category's
 * uploaded image (falling back to its emoji). Adding / reordering a
 * category in admin changes this strip with zero code changes.
 */
import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { imgUrl } from "../../utils/imageUrl";

const CategoryCircles = memo(({ categories = [], loading }) => {
    const navigate = useNavigate();
    if (!loading && categories.length === 0) return null;

    const items = loading ? Array.from({ length: 10 }) : categories;

    return (
        <section className="bg-white border-b border-[#f0f0f2]">
            <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-10 py-4 sm:py-6">
                <div className="flex gap-5 sm:gap-7 overflow-x-auto pb-1 sm:justify-center sm:flex-wrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {items.map((cat, i) => loading ? (
                        <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                            <div className="w-[62px] h-[62px] sm:w-[76px] sm:h-[76px] rounded-full bg-[#f5f5f6] animate-pulse" />
                            <div className="w-12 h-2.5 rounded-full bg-[#f5f5f6] animate-pulse" />
                        </div>
                    ) : (
                        <button
                            key={cat._id || cat.slug}
                            onClick={() => navigate(`/category/${cat.slug}`)}
                            className="group flex flex-col items-center gap-2 flex-shrink-0 w-[70px] sm:w-[84px] bg-transparent border-none cursor-pointer p-0"
                        >
                            <span className="w-[62px] h-[62px] sm:w-[76px] sm:h-[76px] rounded-full overflow-hidden flex items-center justify-center bg-[#f5f5f6] border-2 border-[#eaeaec] text-2xl leading-none transition-all duration-200 group-hover:border-[#ff3f6c] group-hover:shadow-[0_6px_18px_rgba(255,63,108,0.22)] group-hover:-translate-y-0.5">
                                {cat.image?.url
                                    ? <img src={imgUrl.thumbnail(cat.image.url)} alt={cat.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                    : <span>{cat.emoji || "🛍️"}</span>}
                            </span>
                            <span className="text-[11px] sm:text-[12.5px] font-semibold text-[#282c3f] text-center leading-tight line-clamp-2 max-w-full group-hover:text-[#ff3f6c] transition-colors">
                                {cat.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
});

CategoryCircles.displayName = "CategoryCircles";
export default CategoryCircles;
