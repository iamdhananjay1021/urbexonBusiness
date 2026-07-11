import { useState } from "react";
import { cn } from "./utils/cn";

/** Signal Design System — Avatar. Falls back to initials on broken/missing image. */
const SIZE_CLASSES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U";

const Avatar = ({ src, name, size = "md", online, className = "" }) => {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;

  return (
    <span className={cn("relative inline-flex flex-shrink-0", SIZE_CLASSES[size], className)}>
      {showImage ? (
        <img
          src={src}
          alt={name ? `${name}'s avatar` : "User avatar"}
          onError={() => setErrored(true)}
          className="h-full w-full rounded-full object-cover border border-default"
        />
      ) : (
        <span
          role="img"
          aria-label={name ? `${name}'s avatar` : "User avatar"}
          className="h-full w-full rounded-full bg-accent-tint text-accent font-semibold flex items-center justify-center border border-default"
        >
          {getInitials(name)}
        </span>
      )}
      {online !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface",
            online ? "bg-[var(--color-success-500)]" : "bg-[var(--color-graphite-400)]"
          )}
        />
      )}
    </span>
  );
};

export default Avatar;
