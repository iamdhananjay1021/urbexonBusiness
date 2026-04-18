/**
 * UHBannerCarousel — Hero banner carousel for Urbexon Hour
 * Auto-slide, swipe support, smooth transitions, lazy images
 */
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";

const AUTOPLAY_MS = 4000;
const SWIPE_THRESHOLD = 50;

const UHBannerCarousel = memo(({ banners = [] }) => {
    const [idx, setIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    const touchRef = useRef({ startX: 0, startY: 0 });
    const timerRef = useRef(null);
    const navigate = useNavigate();

    const len = banners.length;

    // Autoplay
    useEffect(() => {
        if (len <= 1 || paused) return;
        timerRef.current = setInterval(() => setIdx(p => (p + 1) % len), AUTOPLAY_MS);
        return () => clearInterval(timerRef.current);
    }, [len, paused]);

    const goTo = useCallback((i) => setIdx(((i % len) + len) % len), [len]);

    const handleClick = useCallback((banner) => {
        if (banner.link) {
            if (banner.link.startsWith("http")) window.open(banner.link, "_blank", "noopener");
            else navigate(banner.link);
        }
    }, [navigate]);

    const onTouchStart = useCallback((e) => {
        touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
        setPaused(true);
    }, []);

    const onTouchEnd = useCallback((e) => {
        const dx = e.changedTouches[0].clientX - touchRef.current.startX;
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            setIdx(p => dx < 0 ? (p + 1) % len : (p - 1 + len) % len);
        }
        setPaused(false);
    }, [len]);

    if (!len) return null;

    return (
        <div
            className="uhb-carousel"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <style>{CSS}</style>
            <div className="uhb-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
                {banners.map((b, i) => (
                    <div
                        key={b._id || i}
                        className="uhb-slide"
                        onClick={() => handleClick(b)}
                        style={{ cursor: b.link ? "pointer" : "default" }}
                    >
                        <img
                            src={b.image?.url || "/placeholder.png"}
                            alt={b.title || "Banner"}
                            className="uhb-img"
                            loading={i === 0 ? "eager" : "lazy"}
                            draggable={false}
                        />
                        {(b.title || b.subtitle) && (
                            <div className="uhb-overlay">
                                {b.title && <h2 className="uhb-title">{b.title}</h2>}
                                {b.subtitle && <p className="uhb-sub">{b.subtitle}</p>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Dots */}
            {len > 1 && (
                <div className="uhb-dots">
                    {banners.map((_, i) => (
                        <button
                            key={i}
                            className={`uhb-dot ${i === idx ? "on" : ""}`}
                            onClick={(e) => { e.stopPropagation(); goTo(i); }}
                            aria-label={`Slide ${i + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Arrows (desktop) */}
            {len > 1 && (
                <>
                    <button className="uhb-arrow uhb-prev" onClick={() => goTo(idx - 1)} aria-label="Previous">‹</button>
                    <button className="uhb-arrow uhb-next" onClick={() => goTo(idx + 1)} aria-label="Next">›</button>
                </>
            )}
        </div>
    );
});

UHBannerCarousel.displayName = "UHBannerCarousel";

const CSS = `
.uhb-carousel{position:relative;width:100%;overflow:hidden;border-radius:18px;background:#e8ecf1;user-select:none;-webkit-user-select:none;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.uhb-track{display:flex;transition:transform .5s cubic-bezier(.4,0,.2,1);will-change:transform}
.uhb-slide{min-width:100%;position:relative;aspect-ratio:2.8/1;overflow:hidden}
.uhb-img{width:100%;height:100%;object-fit:cover;display:block}
.uhb-overlay{position:absolute;bottom:0;left:0;right:0;padding:28px 32px;background:linear-gradient(transparent 0%,rgba(0,0,0,.6) 100%);pointer-events:none}
.uhb-title{color:#fff;font-size:clamp(16px,3vw,28px);font-weight:800;margin:0 0 4px;line-height:1.2;letter-spacing:-.3px;text-shadow:0 2px 12px rgba(0,0,0,.4)}
.uhb-sub{color:rgba(255,255,255,.9);font-size:clamp(11px,1.8vw,14px);margin:0;font-weight:500}
.uhb-dots{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2}
.uhb-dot{width:8px;height:8px;border-radius:50%;border:none;background:rgba(255,255,255,.4);cursor:pointer;padding:0;transition:all .3s}
.uhb-dot.on{background:#fff;width:24px;border-radius:4px;box-shadow:0 1px 6px rgba(0,0,0,.2)}
.uhb-arrow{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.9);border:none;color:#0f172a;font-size:22px;font-weight:300;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;opacity:0;transition:all .25s;box-shadow:0 4px 16px rgba(0,0,0,.12);backdrop-filter:blur(6px)}
.uhb-carousel:hover .uhb-arrow{opacity:1}
.uhb-prev{left:14px}
.uhb-next{right:14px}
.uhb-arrow:hover{background:#fff;transform:translateY(-50%) scale(1.1);box-shadow:0 6px 20px rgba(0,0,0,.18)}
@media(max-width:640px){
  .uhb-slide{aspect-ratio:2/1}
  .uhb-overlay{padding:18px 20px}
  .uhb-arrow{display:none}
  .uhb-dot{width:6px;height:6px}
  .uhb-dot.on{width:18px}
  .uhb-carousel{border-radius:14px}
}
`;

export default UHBannerCarousel;
