/**
 * UHCategoryStrip — Horizontal scrollable category pills for Urbexon Hour
 * Fetches UH categories from backend, shows icon + name
 */
import { memo, useRef, useCallback } from "react";

const UHCategoryStrip = memo(({ categories = [], activeCategory, onSelect }) => {
    const scrollRef = useRef(null);

    const scroll = useCallback((dir) => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollBy({ left: dir * 200, behavior: "smooth" });
    }, []);

    if (!categories.length) return null;

    return (
        <div className="uhcs-wrap">
            <style>{CSS}</style>
            <button className="uhcs-arrow uhcs-left" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
            <div className="uhcs-scroll" ref={scrollRef}>
                <button
                    className={`uhcs-pill ${!activeCategory ? "on" : ""}`}
                    onClick={() => onSelect(null)}
                >
                    <span className="uhcs-emoji">🏪</span>
                    <span className="uhcs-label">All</span>
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat._id || cat.slug || cat.name}
                        className={`uhcs-pill ${activeCategory === cat.name ? "on" : ""}`}
                        onClick={() => onSelect(activeCategory === cat.name ? null : cat.name)}
                    >
                        {cat.image?.url ? (
                            <img src={cat.image.url} alt={cat.name} className="uhcs-img" loading="lazy" />
                        ) : (
                            <span className="uhcs-emoji">{cat.emoji || "📦"}</span>
                        )}
                        <span className="uhcs-label">{cat.name}</span>
                    </button>
                ))}
            </div>
            <button className="uhcs-arrow uhcs-right" onClick={() => scroll(1)} aria-label="Scroll right">›</button>
        </div>
    );
});

UHCategoryStrip.displayName = "UHCategoryStrip";

const CSS = `
.uhcs-wrap{position:relative;padding:0}
.uhcs-scroll{display:flex;gap:10px;overflow-x:auto;padding:8px 4px 14px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.uhcs-scroll::-webkit-scrollbar{display:none}
.uhcs-pill{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:76px;padding:14px 10px;background:#fff;border:1.5px solid #e8ecf1;border-radius:16px;cursor:pointer;transition:all .25s cubic-bezier(.34,.1,.68,1);font-family:inherit;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.03)}
.uhcs-pill:hover{border-color:#c7d2fe;background:linear-gradient(135deg,#f8faff,#f0f4ff);transform:translateY(-3px);box-shadow:0 6px 20px rgba(99,102,241,.1)}
.uhcs-pill.on{border-color:#6366f1;background:linear-gradient(135deg,#eef2ff,#e0e7ff);box-shadow:0 4px 16px rgba(99,102,241,.18);transform:translateY(-2px)}
.uhcs-pill.on .uhcs-label{color:#4338ca;font-weight:800}
.uhcs-emoji{font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.06))}
.uhcs-img{width:40px;height:40px;border-radius:12px;object-fit:cover;border:1.5px solid #e8ecf1;transition:all .2s}
.uhcs-pill:hover .uhcs-img,.uhcs-pill.on .uhcs-img{border-color:#6366f1;transform:scale(1.05)}
.uhcs-label{font-size:11px;font-weight:600;color:#475569;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:68px;line-height:1.2;transition:color .2s}
.uhcs-arrow{position:absolute;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.97);border:1px solid #e8ecf1;color:#334155;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;opacity:0;transition:all .25s;box-shadow:0 2px 10px rgba(0,0,0,.1)}
.uhcs-wrap:hover .uhcs-arrow{opacity:1}
.uhcs-left{left:0}
.uhcs-right{right:0}
.uhcs-arrow:hover{background:#fff;transform:translateY(-50%) scale(1.1);box-shadow:0 4px 14px rgba(0,0,0,.15)}
@media(max-width:640px){
  .uhcs-arrow{display:none}
  .uhcs-pill{min-width:66px;padding:10px 7px;gap:6px;border-radius:14px}
  .uhcs-emoji{font-size:24px}
  .uhcs-img{width:34px;height:34px}
  .uhcs-label{font-size:10px;max-width:58px}
}
`;

export default UHCategoryStrip;
