import { useEffect, useState } from "react";
import { cn } from "./utils/cn";

/**
 * Signal Design System — Navbar (shell)
 * Storefront pattern from the approved nav spec: light bg, sticky, shadow-xs
 * on scroll, logo/nav/actions as slots so each app's real content composes in
 * during the page-wiring phase — this is the shell only, not final content.
 */
const Navbar = ({ logo, center, actions, className = "" }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-[600] bg-surface transition-shadow duration-150 h-16",
        scrolled && "shadow-xs",
        className
      )}
    >
      <div className="h-full max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center gap-4">
        <div className="flex-shrink-0">{logo}</div>
        <div className="flex-1 min-w-0 flex justify-center">{center}</div>
        <div className="flex-shrink-0 flex items-center gap-3">{actions}</div>
      </div>
    </header>
  );
};

export default Navbar;
