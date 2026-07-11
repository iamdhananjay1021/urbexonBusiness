import { cn } from "./utils/cn";

/** Signal Design System — Footer (shell). Composable columns + bottom bar, content supplied by caller. */
const Footer = ({ columns = [], bottomBar, className = "" }) => (
  <footer className={cn("bg-[var(--color-graphite-900)] text-[var(--color-graphite-300)]", className)}>
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
      {columns.map((col) => (
        <div key={col.title}>
          <h4 className="text-white text-sm font-semibold font-display mb-3">{col.title}</h4>
          <ul className="flex flex-col gap-2">
            {col.links.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-sm hover:text-white transition-colors">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    {bottomBar && (
      <div className="border-t border-[var(--color-graphite-700)] py-4">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 text-xs text-[var(--color-graphite-400)]">
          {bottomBar}
        </div>
      </div>
    )}
  </footer>
);

export default Footer;
