/**
 * EditorialBannerGrid.jsx — Myntra-style clickable promo banner grid.
 *
 * Renders the admin's "mid" placement banners (Banner Studio → Placement:
 * Mid-Page) as a responsive image-tile grid. Each banner's `span`
 * (full / half / third) controls its tile width, its `link`/`linkType`
 * controls the click target, and text overlay (title / subtitle / button)
 * is shown ONLY when the admin fills it in — pure-image promo banners
 * (text baked into the artwork, the Myntra norm) render clean with no
 * overlay. Fully admin-driven: add a mid banner → a new tile appears here.
 *
 * NOTE: mid banners existed in the data model + admin for a while but were
 * never rendered anywhere on the site — creating one had no visible effect
 * until this component. Same class of gap the codebase documents for
 * Collections on the homepage.
 */
import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { imgUrl, imgSrcSet } from "../../utils/imageUrl";

/* span → column span + intrinsic aspect ratio (keeps tiles Myntra-wide) */
const SPAN = {
    full: "col-span-2 lg:col-span-6 aspect-[16/6] sm:aspect-[24/6]",
    half: "col-span-2 lg:col-span-3 aspect-[16/8]",
    third: "col-span-1 lg:col-span-2 aspect-[3/4] sm:aspect-[4/3]",
};

const EditorialBannerGrid = memo(({ banners = [], heading, eyebrow }) => {
    const navigate = useNavigate();
    if (!banners.length) return null;

    const go = (banner) => {
        const t = banner.link || "";
        if (!t) return;
        if (t.startsWith("http")) window.open(t, "_blank", "noopener");
        else navigate(t);
    };

    return (
        <section className="bg-white">
            <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-10 py-4 sm:py-6">
                {heading && (
                    <div className="text-center mb-5 sm:mb-6">
                        {eyebrow && (
                            <span className="inline-block text-[10px] font-bold tracking-[0.2em] uppercase text-[#ff3f6c] mb-1.5">
                                {eyebrow}
                            </span>
                        )}
                        <h2 className="text-lg sm:text-2xl font-extrabold text-[#282c3f] tracking-tight uppercase m-0">
                            {heading}
                        </h2>
                        <span className="block w-12 h-[3px] bg-[#ff3f6c] rounded-full mx-auto mt-3" />
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-4 auto-rows-auto">
                    {banners.map((b) => {
                        const hasOverlay = b.title || b.buttonText || b.subtitle;
                        const raw = b.image?.url || "";
                        return (
                            <button
                                key={b._id}
                                onClick={() => go(b)}
                                className={`group relative overflow-hidden rounded-xl bg-[#f5f5f6] border border-[#eaeaec] cursor-pointer p-0 ${SPAN[b.span] || SPAN.half} ${b.link ? "" : "cursor-default"}`}
                            >
                                {raw ? (
                                    <img
                                        src={imgUrl.detail(raw)}
                                        srcSet={imgSrcSet(raw, 800)}
                                        alt={b.title || "Promotion"}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#c9cbd3] text-sm font-semibold">
                                        {b.title || "Banner"}
                                    </div>
                                )}

                                {hasOverlay && (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                                        <div className="absolute left-0 right-0 bottom-0 p-3 sm:p-5 text-left">
                                            {b.subtitle && (
                                                <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.14em] uppercase text-white/85 mb-1 leading-none">
                                                    {b.subtitle}
                                                </p>
                                            )}
                                            {b.title && (
                                                <h3 className="text-sm sm:text-xl font-extrabold text-white leading-tight tracking-tight m-0 [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]">
                                                    {b.title}
                                                </h3>
                                            )}
                                            {b.buttonText && (
                                                <span className="inline-flex items-center gap-1.5 mt-2.5 sm:mt-3 h-8 sm:h-9 px-4 rounded-md bg-white text-[#282c3f] text-[11px] sm:text-xs font-bold group-hover:bg-[#ff3f6c] group-hover:text-white transition-colors">
                                                    {b.buttonText}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
});

EditorialBannerGrid.displayName = "EditorialBannerGrid";
export default EditorialBannerGrid;
