import { cn } from "./utils/cn";

/**
 * Signal Design System — Skeleton
 * Shape-matched loading placeholder (pass className to match the real
 * content's dimensions, per the approved spec — no generic gray boxes).
 * Shimmer respects prefers-reduced-motion via the global rule in tokens.css.
 */
const Skeleton = ({ className = "", rounded = "rounded-[var(--radius-sm)]" }) => (
  <div
    aria-hidden="true"
    className={cn(
      rounded,
      "bg-[linear-gradient(90deg,var(--color-graphite-100)_25%,var(--color-graphite-50)_50%,var(--color-graphite-100)_75%)]",
      "bg-[length:200%_100%] animate-[skeletonShimmer_1.2s_ease-in-out_infinite]",
      className
    )}
  />
);

export const SkeletonText = ({ lines = 3, className = "" }) => (
  <div className={cn("flex flex-col gap-2", className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
    ))}
  </div>
);

export const SkeletonCard = ({ className = "" }) => (
  <div className={cn("rounded-[var(--radius-md)] border border-default p-4", className)}>
    <Skeleton className="h-32 w-full mb-3" rounded="rounded-[var(--radius-sm)]" />
    <Skeleton className="h-4 w-3/4 mb-2" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);

export default Skeleton;
