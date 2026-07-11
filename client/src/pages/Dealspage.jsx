import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SEO from "../components/SEO";
import { getDeals } from "../api/productApi";
import ProductCard from "../components/ProductCard";
import { FiZap } from "react-icons/fi";
import Button from "../design-system/Button";
import { EmptyState, ErrorState } from "../design-system/EmptyState";
import { SkeletonCard as DSSkeletonCard } from "../design-system/Skeleton";

/* ════════════════════════════════════
   COUNTDOWN HOOK
════════════════════════════════════ */
const useCountdown = (dealEndsAt) => {
    const calc = () => {
        const diff = new Date(dealEndsAt) - new Date();
        if (diff <= 0) return null;
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        return { d, h, m, s };
    };
    const [time, setTime] = useState(calc);
    useEffect(() => {
        if (!dealEndsAt) return;
        const t = setInterval(() => setTime(calc()), 1000);
        return () => clearInterval(t);
    }, [dealEndsAt]);
    return time;
};

/* ════════════════════════════════════
   DEAL COUNTDOWN BADGE
   NOTE: uses the app's real ProductCard (../components/ProductCard) —
   left untouched, it owns real cart/wishlist business logic. Only the
   countdown badge styling below is migrated to Signal tokens.

   Ticks its OWN interval internally instead of the parent grid re-rendering
   every second — the previous DealProductCard wrapper ran useCountdown at
   the wrapper level and handed ProductCard a brand-new `footer` element
   every tick, which defeated ProductCard's React.memo for every deal card,
   every second, for as long as the page was open.
════════════════════════════════════ */
const DealCountdownDisplay = ({ dealEndsAt }) => {
    const countdown = useCountdown(dealEndsAt);
    if (!countdown) return null;
    return (
        <div className="flex gap-1.5 justify-center mt-1.5">
            {[[countdown.d, "D"], [countdown.h, "H"], [countdown.m, "M"], [countdown.s, "S"]].map(([v, l]) => (
                <span key={l} className="bg-warning-tint text-warning text-[11px] font-bold px-1.5 py-0.5 rounded min-w-[28px] text-center">
                    {String(v).padStart(2, "0")}{l}
                </span>
            ))}
        </div>
    );
};

/* ════════════════════════════════════
   MAIN DEALS PAGE
════════════════════════════════════ */
// Session-lifetime cache — same pattern as Home.jsx's _homeCache. Without
// it, navigating away and back (e.g. opening a deal then hitting Back)
// unmounted the whole grid and re-showed the skeleton for a full refetch,
// even though nothing about the deals list had actually changed in the
// last few seconds — which read as every product card/image "reloading".
const CACHE_TTL = 60 * 1000;
let _dealsCache = null;

const Deals = () => {
    const navigate = useNavigate();
    const [deals, setDeals] = useState(() => _dealsCache?.deals || []);
    const [loading, setLoading] = useState(() => !_dealsCache || Date.now() - (_dealsCache?._ts || 0) > CACHE_TTL);
    const [error, setError] = useState("");

    useEffect(() => {
        if (_dealsCache && Date.now() - _dealsCache._ts < CACHE_TTL) { setLoading(false); return; }
        (async () => {
            try {
                setLoading(true);
                const { data } = await getDeals();
                const list = data.products || (Array.isArray(data) ? data : []);
                setDeals(list);
                _dealsCache = { deals: list, _ts: Date.now() };
            } catch {
                setError("Failed to load deals. Please try again.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="min-h-screen bg-canvas">
            <SEO title="Deals & Offers" description="Grab the hottest deals and limited-time offers on Urbexon. Save big on fashion, electronics, and more." path="/deals" />

            {/* Header Banner */}
            <div className="bg-[var(--color-graphite-900)] px-[clamp(16px,5vw,80px)] py-12">
                <div className="max-w-[1440px] mx-auto">
                    <p className="text-[10px] font-extrabold tracking-[.2em] uppercase text-accent mb-2.5">
                        ✦ Limited Time
                    </p>
                    <h1 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-bold text-white leading-tight">
                        Hot <span className="text-accent">Deals</span>
                    </h1>
                    <p className="text-sm text-white/55 mt-2.5 max-w-[480px]">
                        Best discounts on top products — grab them before they expire!
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-[1440px] mx-auto px-[clamp(16px,5vw,80px)] pt-12 pb-20">

                {/* Loading */}
                {loading && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                        {Array(10).fill(0).map((_, i) => <DSSkeletonCard key={i} />)}
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <ErrorState
                        title="Couldn't load deals"
                        description={error}
                        action={<Button variant="primary" onClick={() => window.location.reload()}>Try Again</Button>}
                    />
                )}

                {/* Empty */}
                {!loading && !error && deals.length === 0 && (
                    <EmptyState
                        icon={FiZap}
                        title="No Active Deals"
                        description="Check back soon — new deals drop regularly!"
                        action={<Button variant="primary" onClick={() => navigate("/")}>Browse All Products</Button>}
                    />
                )}

                {/* Deals Grid */}
                {!loading && !error && deals.length > 0 && (
                    <>
                        <div className="flex items-center gap-2.5 mb-7">
                            <FiZap className="text-[var(--color-warning-500)]" aria-hidden="true" />
                            <p className="text-sm text-secondary font-medium">
                                <b className="text-primary">{deals.length}</b> active deal{deals.length !== 1 ? "s" : ""} — hurry, limited time!
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                            {deals.map(p => (
                                <ProductCard key={p._id || p.id} product={p} footer={<DealCountdownDisplay dealEndsAt={p.dealEndsAt} />} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Deals;
