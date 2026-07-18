/**
 * FilterPriceSlider — dual-thumb price range built from two overlapping
 * native <input type="range"> elements (keyboard accessible for free).
 * Local state while dragging; commits to the URL on release so we don't
 * push a history entry per pixel.
 */
import { memo, useEffect, useMemo, useState } from "react";

const FilterPriceSlider = memo(({ min, max, valueMin, valueMax, onCommit }) => {
    const lo = Number.isFinite(min) ? min : 0;
    const hi = Number.isFinite(max) && max > lo ? max : lo + 1;

    const [localMin, setLocalMin] = useState(valueMin !== "" ? Number(valueMin) : lo);
    const [localMax, setLocalMax] = useState(valueMax !== "" ? Number(valueMax) : hi);

    // Re-sync when the URL (or facet bounds) change from outside.
    useEffect(() => { setLocalMin(valueMin !== "" ? Number(valueMin) : lo); }, [valueMin, lo]);
    useEffect(() => { setLocalMax(valueMax !== "" ? Number(valueMax) : hi); }, [valueMax, hi]);

    const step = useMemo(() => Math.max(1, Math.round((hi - lo) / 100)), [lo, hi]);
    const pct = (v) => ((v - lo) / (hi - lo)) * 100;

    const commit = () => {
        const isDefault = localMin <= lo && localMax >= hi;
        onCommit(isDefault ? "" : localMin, isDefault ? "" : localMax);
    };

    return (
        <div className="px-0.5">
            <div className="flex items-center justify-between mb-3 text-[12px] font-semibold text-primary tabular-nums">
                <span>₹{Math.round(localMin).toLocaleString("en-IN")}</span>
                <span>₹{Math.round(localMax).toLocaleString("en-IN")}</span>
            </div>

            <div className="relative h-5">
                {/* Track */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-[var(--color-graphite-100)]" />
                {/* Active segment */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-accent"
                    style={{ left: `${pct(localMin)}%`, right: `${100 - pct(localMax)}%` }}
                />
                {/* Range thumbs — pointer-events only on the thumb itself */}
                <input
                    type="range" min={lo} max={hi} step={step} value={localMin}
                    aria-label="Minimum price"
                    onChange={(e) => setLocalMin(Math.min(Number(e.target.value), localMax - step))}
                    onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit}
                    className="ux-range absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
                />
                <input
                    type="range" min={lo} max={hi} step={step} value={localMax}
                    aria-label="Maximum price"
                    onChange={(e) => setLocalMax(Math.max(Number(e.target.value), localMin + step))}
                    onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit}
                    className="ux-range absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
                />
            </div>

            {/* Thumb styling — scoped once */}
            <style>{`
                .ux-range::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none; pointer-events: auto;
                    width: 16px; height: 16px; border-radius: 9999px;
                    background: #fff; border: 2px solid var(--accent-primary);
                    box-shadow: 0 1px 4px rgba(20,21,26,.15); cursor: grab;
                }
                .ux-range::-moz-range-thumb {
                    pointer-events: auto; width: 14px; height: 14px; border-radius: 9999px;
                    background: #fff; border: 2px solid var(--accent-primary);
                    box-shadow: 0 1px 4px rgba(20,21,26,.15); cursor: grab;
                }
                .ux-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px var(--focus-ring); }
            `}</style>
        </div>
    );
});
FilterPriceSlider.displayName = "FilterPriceSlider";
export default FilterPriceSlider;
