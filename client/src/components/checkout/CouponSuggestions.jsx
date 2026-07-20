/**
 * CouponSuggestions.jsx — "Available coupons" panel for cart/checkout.
 * Fetches ranked, cart-context coupons from POST /coupons/eligible
 * (includes near-misses with a `reason`, e.g. "Add ₹120 more to unlock")
 * so the panel can show real usable codes AND explain why a code isn't
 * usable yet, instead of just hiding it.
 */
import { useEffect, useState } from "react";
import { getEligibleCoupons } from "../../api/couponApi";
import { FiTag, FiCheck } from "react-icons/fi";

const CouponSuggestions = ({ itemsTotal, orderMode, appliedCode, onApply }) => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getEligibleCoupons({ itemsTotal, orderMode })
            .then(({ data }) => { if (!cancelled) setCoupons(data?.coupons || []); })
            .catch(() => { if (!cancelled) setCoupons([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // Re-fetch only when the order total crosses a meaningful boundary
        // isn't worth the complexity here — cart/checkout pages already
        // re-render this on real item changes, and the list is cheap.
    }, [itemsTotal, orderMode]);

    if (loading || coupons.length === 0) return null;

    return (
        <div className="mt-3 flex flex-col gap-2">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wide flex items-center gap-1.5">
                <FiTag size={11} /> Available coupons
            </p>
            {coupons.slice(0, 4).map((c) => {
                const isApplied = appliedCode === c.code;
                return (
                    <button
                        key={c.couponId}
                        type="button"
                        disabled={!c.eligible || isApplied}
                        onClick={() => onApply(c.code)}
                        className={`text-left rounded-[var(--radius-sm)] border px-3 py-2 transition-colors ${
                            isApplied
                                ? "border-[var(--color-success-100)] bg-success-tint cursor-default"
                                : c.eligible
                                    ? "border-default hover:border-[var(--accent-primary)] cursor-pointer"
                                    : "border-default opacity-60 cursor-not-allowed"
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-primary">{c.code}</span>
                            {isApplied
                                ? <FiCheck size={13} className="text-success" />
                                : c.eligible && <span className="text-[11px] font-semibold text-accent">Apply</span>}
                        </div>
                        <p className="text-[11px] text-secondary mt-0.5">{c.description || (c.eligible ? "Tap to apply" : c.reason)}</p>
                    </button>
                );
            })}
        </div>
    );
};

export default CouponSuggestions;
