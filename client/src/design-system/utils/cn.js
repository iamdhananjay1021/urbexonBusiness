/** Tiny classnames joiner — avoids adding clsx/tailwind-merge as new dependencies. */
export function cn(...args) {
  return args
    .flat(Infinity)
    .filter(Boolean)
    .join(" ");
}
