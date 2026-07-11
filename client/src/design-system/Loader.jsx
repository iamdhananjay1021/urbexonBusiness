import { cn } from "./utils/cn";

/** Signal Design System — Loader. Accessible spinner (role="status" + sr-only label). */
const SIZE_CLASSES = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-9 w-9" };

const Loader = ({ size = "md", label = "Loading", className = "", fullPage = false }) => {
  const spinner = (
    <span role="status" className={cn("inline-flex items-center justify-center", className)}>
      <svg
        className={cn("animate-spin text-accent", SIZE_CLASSES[size])}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );

  if (!fullPage) return spinner;

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-canvas">
      {spinner}
    </div>
  );
};

export default Loader;
