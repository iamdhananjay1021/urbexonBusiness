/**
 * UHHero — Urbexon Hour's always-visible branded hero.
 * Previously the only "hero" on the homepage was the CMS `heroBanners`
 * carousel — if no admin banner was uploaded, users saw a blank gap
 * between the trust strip and Flash Deals. This renders unconditionally
 * (real copy, no image asset dependency); the CMS carousel still renders
 * directly below it when banners exist, so nothing dynamic is removed.
 * Same Signal tokens as the rest of the page (amber = --accent-hour).
 */
import { FaBolt, FaArrowRight, FaClock } from "react-icons/fa";

const UHHero = ({ deliveryMin = 45, deliveryMax = 120, onShopNow }) => (
    <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-amber-100)] via-white to-[var(--color-amber-100)] border-b border-[var(--color-amber-100)]">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-12 py-8 lg:py-12">
            <div className="flex items-center gap-8 lg:gap-14 justify-between">
                <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 bg-white border border-[var(--color-amber-100)] text-[var(--accent-hour-hover)] text-[10px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4 shadow-sm">
                        <FaBolt size={9} /> Urbexon Hour
                    </div>
                    <h1 className="text-[clamp(22px,4.5vw,40px)] font-extrabold leading-tight text-primary tracking-tight mb-2.5">
                        Everything you need,<br />
                        delivered in{" "}
                        <span className="bg-gradient-to-r from-[var(--accent-hour)] to-[var(--accent-hour-hover)] bg-clip-text text-transparent">
                            {deliveryMin} minutes
                        </span>
                    </h1>
                    <p className="text-sm lg:text-base text-secondary mb-6 max-w-[440px] leading-relaxed">
                        Fresh groceries, daily essentials & more from local vendors, delivered straight to your door.
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={onShopNow}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-hour hover:bg-hour-hover text-white text-sm font-bold shadow-[0_4px_16px_rgba(242,169,59,0.35)] hover:-translate-y-0.5 hover:shadow-[0_6px_22px_rgba(242,169,59,0.45)] transition-all"
                        >
                            Shop Now <FaArrowRight size={12} />
                        </button>
                        <span className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-[var(--color-amber-100)] text-[13px] font-bold text-primary">
                            <FaClock size={13} className="text-[var(--accent-hour)]" /> {deliveryMin}–{deliveryMax} min Delivery
                        </span>
                    </div>
                </div>

                {/* Decorative delivery-time dial — no image asset needed */}
                <div className="hidden md:flex flex-shrink-0 relative w-[150px] h-[150px] lg:w-[190px] lg:h-[190px] items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-[3px] border-[var(--color-amber-100)]" />
                    <div className="absolute inset-0 rounded-full border-[3px] border-t-[var(--accent-hour)] border-r-[var(--accent-hour)] border-b-transparent border-l-transparent rotate-45" />
                    <div className="relative flex flex-col items-center justify-center gap-0.5">
                        <FaBolt size={20} className="text-[var(--accent-hour)] mb-0.5" />
                        <span className="text-[clamp(28px,5vw,40px)] font-black text-primary leading-none tabular-nums">{deliveryMin}</span>
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-none">min delivery</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default UHHero;
