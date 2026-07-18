/** FilterSkeleton — sidebar placeholder while facets load. */
import { memo } from "react";

const Line = ({ w = "w-full" }) => (
    <div className={`h-3.5 ${w} rounded-full bg-[var(--color-graphite-100)] animate-pulse`} />
);

const FilterSkeleton = memo(() => (
    <div className="flex flex-col gap-6 py-2" aria-busy="true" aria-label="Loading filters">
        {[0, 1, 2, 3].map((g) => (
            <div key={g} className="flex flex-col gap-3">
                <Line w="w-24" />
                <Line w="w-4/5" />
                <Line w="w-3/5" />
                <Line w="w-2/3" />
            </div>
        ))}
    </div>
));
FilterSkeleton.displayName = "FilterSkeleton";
export default FilterSkeleton;
