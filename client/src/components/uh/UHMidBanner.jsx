/**
 * UHMidBanner — Promotional mid-page banner(s) between product sections
 * Supports single or dual banner layout
 */
import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const UHMidBanner = memo(({ banners = [] }) => {
    const navigate = useNavigate();

    const handleClick = useCallback((b) => {
        if (!b.link) return;
        if (b.link.startsWith("http")) window.open(b.link, "_blank", "noopener");
        else navigate(b.link);
    }, [navigate]);

    if (!banners.length) return null;

    return (
        <div className={`uhmb-wrap ${banners.length === 1 ? "uhmb-single" : "uhmb-dual"}`}>
            <style>{CSS}</style>
            {banners.slice(0, 2).map((b, i) => (
                <div
                    key={b._id || i}
                    className="uhmb-card"
                    onClick={() => handleClick(b)}
                    style={{ cursor: b.link ? "pointer" : "default" }}
                >
                    <img
                        src={b.image?.url || "/placeholder.png"}
                        alt={b.title || "Promo"}
                        className="uhmb-img"
                        loading="lazy"
                        draggable={false}
                    />
                    {(b.title || b.subtitle) && (
                        <div className="uhmb-text">
                            {b.title && <h4 className="uhmb-title">{b.title}</h4>}
                            {b.subtitle && <p className="uhmb-sub">{b.subtitle}</p>}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
});

UHMidBanner.displayName = "UHMidBanner";

const CSS = `
.uhmb-wrap{display:grid;gap:14px;padding:4px 0}
.uhmb-single{grid-template-columns:1fr}
.uhmb-dual{grid-template-columns:1fr 1fr}
.uhmb-card{position:relative;border-radius:14px;overflow:hidden;transition:all .25s;box-shadow:0 2px 8px rgba(0,0,0,.06);border:1px solid #e5e7eb}
.uhmb-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.1);transform:translateY(-2px)}
.uhmb-img{width:100%;height:100%;object-fit:cover;display:block;aspect-ratio:2.5/1}
.uhmb-text{position:absolute;bottom:0;left:0;right:0;padding:16px 20px;background:linear-gradient(transparent,rgba(0,0,0,.5));pointer-events:none}
.uhmb-title{color:#fff;font-size:clamp(13px,2.2vw,18px);font-weight:800;margin:0 0 2px;line-height:1.2;letter-spacing:-.2px}
.uhmb-sub{color:rgba(255,255,255,.85);font-size:clamp(10px,1.5vw,12px);margin:0;font-weight:500}
@media(max-width:640px){
  .uhmb-dual{grid-template-columns:1fr}
  .uhmb-img{aspect-ratio:2.8/1}
  .uhmb-text{padding:12px 14px}
}
`;

export default UHMidBanner;
