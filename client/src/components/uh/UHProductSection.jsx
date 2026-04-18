/**
 * UHProductSection — Horizontal scrollable product section (Zepto-style)
 * Title + "View All" + scrollable product cards
 */
import { memo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";

const UHProductSection = memo(({ title, subtitle, icon, products = [], viewAllLink, renderCard }) => {
    const scrollRef = useRef(null);
    const navigate = useNavigate();

    const scroll = useCallback((dir) => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollBy({ left: dir * 280, behavior: "smooth" });
    }, []);

    if (!products.length) return null;

    return (
        <div className="uhps-section">
            <style>{CSS}</style>
            <div className="uhps-header">
                <div className="uhps-title-row">
                    {icon && <span className="uhps-icon">{icon}</span>}
                    <div>
                        <h3 className="uhps-title">{title}</h3>
                        {subtitle && <p className="uhps-sub">{subtitle}</p>}
                    </div>
                </div>
                {viewAllLink && (
                    <button className="uhps-viewall" onClick={() => navigate(viewAllLink)}>
                        View All <FaChevronRight size={9} />
                    </button>
                )}
            </div>
            <div className="uhps-scroll-wrap">
                <button className="uhps-arrow uhps-arrow-l" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
                <div className="uhps-scroll" ref={scrollRef}>
                    {products.map((p) => (
                        <div key={p._id} className="uhps-card-slot">
                            {renderCard(p)}
                        </div>
                    ))}
                </div>
                <button className="uhps-arrow uhps-arrow-r" onClick={() => scroll(1)} aria-label="Scroll right">›</button>
            </div>
        </div>
    );
});

UHProductSection.displayName = "UHProductSection";

const CSS = `
.uhps-section{padding:24px 0 12px;position:relative}
.uhps-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px;padding:0 4px}
.uhps-title-row{display:flex;align-items:center;gap:12px}
.uhps-icon{font-size:26px;flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(0,0,0,.08))}
.uhps-title{font-size:clamp(16px,3vw,20px);font-weight:800;color:#0f172a;margin:0;letter-spacing:-.3px;line-height:1.2}
.uhps-sub{font-size:12px;color:#64748b;margin:3px 0 0;font-weight:500}
.uhps-viewall{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#3b82f6;font-weight:700;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.15);cursor:pointer;font-family:inherit;padding:7px 14px;border-radius:20px;transition:all .2s;white-space:nowrap;flex-shrink:0}
.uhps-viewall:hover{background:rgba(59,130,246,.1);border-color:#3b82f6;color:#2563eb}
.uhps-scroll-wrap{position:relative}
.uhps-scroll{display:flex;gap:12px;overflow-x:auto;padding:4px 4px 16px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.uhps-scroll::-webkit-scrollbar{display:none}
.uhps-card-slot{min-width:168px;max-width:185px;flex-shrink:0;scroll-snap-align:start}
.uhps-arrow{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.97);border:1px solid #e8ecf1;color:#334155;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:3;opacity:0;transition:all .25s;box-shadow:0 4px 16px rgba(0,0,0,.1)}
.uhps-scroll-wrap:hover .uhps-arrow{opacity:1}
.uhps-arrow-l{left:-6px}
.uhps-arrow-r{right:-6px}
.uhps-arrow:hover{background:#fff;transform:translateY(-50%) scale(1.08);box-shadow:0 6px 20px rgba(0,0,0,.15)}
@media(max-width:640px){
  .uhps-arrow{display:none}
  .uhps-card-slot{min-width:150px;max-width:168px}
  .uhps-section{padding:18px 0 8px}
}
`;

export default UHProductSection;
