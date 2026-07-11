/**
 * Navbar.jsx — v4.1 Production
 *
 * v4.0 → v4.1 CHANGES (alignment / responsive pass only — zero functional changes)
 * ──────────────────────────────────────────────────────────────────────
 * - Mobile header rows (logo row, delivery-location row, search row) now
 *   share one consistent horizontal padding (px-3) instead of three
 *   slightly different values (px-2.5 xs:px-3 / px-3 / px-2.5 xs:px-3).
 *   Previously the "Deliver to" row and search bar didn't line up with
 *   the logo row above them.
 * - Category strip is shared between desktop and mobile but desktop uses
 *   px-4 lg:px-8 while mobile rows use px-3 — the strip now takes a
 *   `mobile` flag and matches whichever header it's docked to, so chips
 *   line up with the content above instead of sitting slightly indented.
 * - Desktop Row 1 gap tightened at md/lg (gap-2 lg:gap-3) so the toggle
 *   pill + action icons don't crowd/overflow between the md and lg
 *   breakpoints, where the "Deliver to" block is still hidden.
 * - Added a compact icon-only "Deliver to" button for the md→lg gap
 *   (visible only in that range) so location is never fully unreachable
 *   on mid-size desktop/tablet widths — full label version still takes
 *   over at lg+.
 * - Mobile icon cluster gap set to a safe minimum (gap-0.5) with
 *   flex-shrink-0 on every button so 4–5 icons + logo + UH pill never
 *   wrap or overlap on narrow (320–360px) screens.
 * - No handler, effect, ref, state, route, or API call was touched.
 *
 * v4.2 CHANGE (this pass)
 * ──────────────────────────────────────────────────────────────────────
 * - Desktop header used to render TWO search bars stacked on top of each
 *   other: the compact Row 1 search (next to logo/toggle) AND a second,
 *   large centered search bar in its own Row 2 right below it. Both were
 *   fully functional and independently wired to the same state, so it
 *   just looked like a duplicate search box. Row 2 has been removed —
 *   Row 1's search bar is now the only desktop search input. Mobile was
 *   never affected (it only ever had its single tap-to-open search row),
 *   so no mobile changes were needed here.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo } from "react";
import {
    FaSearch, FaShoppingCart, FaTimes, FaUser, FaBox,
    FaSignOutAlt, FaChevronDown, FaBolt, FaHeart,
    FaChevronRight, FaMapMarkerAlt, FaBars,
    FaHome, FaTag, FaArrowLeft,
} from "react-icons/fa";
import { useSelector } from "react-redux";
import { useAuth } from "../contexts/AuthContext";
import { useLocation2 } from "../contexts/LocationContext";
import LocationModal from "./LocationModal";
import { getProductSuggestions } from "../api/productApi";
import NotificationCenter from "./NotificationCenter";
import VendorStoreDropdown from "./VendorStoreDropdown";
import { selectEcommerceTotalItems, selectUHTotalItems } from "../features/cart/cartSlice";
import { Avatar, Badge } from "../design-system";
import { useUHLocation } from "../contexts/UHLocationContext";

/* ─── Helpers ─────────────────────────────────────────── */
const firstName = (name) => name?.split(" ")[0] || "";

const GLOBAL_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

    #urbexon-navbar, #urbexon-navbar * {
        font-family: 'DM Sans', sans-serif;
    }

    @keyframes dropDown  { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
    @keyframes fadeIn    { from { opacity:0; }                             to { opacity:1; }                  }
    @keyframes fadeDown  { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
    @keyframes slideUp   { from { opacity:0; transform:translateY(6px);  } to { opacity:1; transform:none; } }

    .ux-scrollbar-hide::-webkit-scrollbar { display: none; }
    .ux-scrollbar-hide { scrollbar-width: none; }

    .ux-search-input:focus { outline: none; box-shadow: none; }
    .ux-cat-active { border-bottom-color: currentColor !important; }
`;

/* ═══════════════════════════════════════════════════════
   CATEGORY STRIP — memoized, mostly-static tree that only
   needs to change when categories/active-path change.
   Reused verbatim on both desktop (row 3) and mobile (row 4).
   `mobile` flag only changes outer horizontal padding so chips
   stay aligned with whichever header (desktop/mobile) hosts it.
═══════════════════════════════════════════════════════ */
const CatIcon = memo(({ cat }) => (
    <span className="w-[18px] h-[18px] rounded-full overflow-hidden flex-shrink-0 bg-black/5 flex items-center justify-center text-[11px] leading-none">
        {cat.image?.url
            ? <img src={cat.image.url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : <span>{cat.emoji || "🛍️"}</span>}
    </span>
));
CatIcon.displayName = "CatIcon";

/* Icon-on-top category chip — Flipkart-style: square icon, label below,
   active state shown as a colored bottom border + bold label instead of
   a filled pill. Used for the desktop strip. */
const IconTopCat = memo(({ icon, label, active, badge, badgeVariant, activeColorClass, onClick }) => (
    <button
        className={`flex flex-col items-center gap-1.5 px-3.5 pt-2 pb-2.5 border-b-[3px] cursor-pointer flex-shrink-0 min-w-[68px] max-w-[84px] transition-all
            ${active ? `${activeColorClass} text-gray-900` : "border-transparent text-gray-600 hover:text-gray-900"}`}
        onClick={onClick}
    >
        <span className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50 flex items-center justify-center text-[15px] leading-none">
            {icon}
        </span>
        <span className={`text-[11.5px] leading-tight truncate max-w-full ${active ? "font-bold" : "font-medium"}`}>{label}</span>
        {badge && <Badge variant={badgeVariant} className="!text-[8px] !px-1 !py-0 mt-0.5">{badge}</Badge>}
    </button>
));
IconTopCat.displayName = "IconTopCat";

const DesktopCategoryBar = memo(({ isUH, scrolled, uhCategories, ecoCategories, pathname, onSelectAll, onSelectCat, onSelectDeals, mobile = false, variant = "pill" }) => {
    const isUHCatActive = (s) => pathname === `/urbexon-hour/${s}`;
    const isCatActive = (s) => pathname === `/category/${s}`;

    /* ── Icon-on-top variant (desktop, Flipkart-style) ── */
    if (variant === "iconTop") {
        return (
            <div className={`border-b border-gray-100 transition-colors duration-300 ${scrolled ? "bg-white/90 backdrop-blur-md" : "bg-white"}`}>
                <div className={`${mobile ? "max-w-full px-3" : "max-w-[1400px] mx-auto px-4 lg:px-8"} flex items-center overflow-x-auto ux-scrollbar-hide gap-0.5 lg:gap-1`}>
                    {isUH ? (
                        <>
                            <IconTopCat
                                icon={<FaBolt size={14} className="text-amber-500" />}
                                label="All"
                                badge="EXPRESS" badgeVariant="hour"
                                active={pathname === "/urbexon-hour"}
                                activeColorClass="border-amber-500"
                                onClick={onSelectAll}
                            />
                            {uhCategories.map((cat) => (
                                <IconTopCat
                                    key={cat._id || cat.id}
                                    icon={<CatIcon cat={cat} />}
                                    label={cat.name}
                                    badge={cat.isFast ? "FAST" : null} badgeVariant="hour"
                                    active={isUHCatActive(cat.slug)}
                                    activeColorClass="border-amber-500"
                                    onClick={() => onSelectCat(cat.slug)}
                                />
                            ))}
                        </>
                    ) : (
                        <>
                            {ecoCategories.map((cat) => (
                                <IconTopCat
                                    key={cat._id || cat.id}
                                    icon={<CatIcon cat={cat} />}
                                    label={cat.name}
                                    badge={cat.isHot ? "HOT" : null} badgeVariant="error"
                                    active={isCatActive(cat.slug)}
                                    activeColorClass="border-gray-900"
                                    onClick={() => onSelectCat(cat.slug)}
                                />
                            ))}
                            <IconTopCat
                                icon={<FaTag size={13} className="text-rose-500" />}
                                label="Deals"
                                badge="HOT" badgeVariant="error"
                                active={pathname === "/deals"}
                                activeColorClass="border-gray-900"
                                onClick={onSelectDeals}
                            />
                        </>
                    )}
                </div>
            </div>
        );
    }

    /* ── Pill variant (mobile, unchanged from before) ── */
    return (
        <div className={`border-b border-gray-100 transition-colors duration-300 ${scrolled ? "bg-white/90 backdrop-blur-md" : "bg-white"}`}>
            <div className={`${mobile ? "max-w-full px-3" : "max-w-[1400px] mx-auto px-4 lg:px-8"} flex items-center overflow-x-auto ux-scrollbar-hide gap-1.5 py-1.5`}>
                {isUH ? (
                    <>
                        <button
                            className={`px-4 py-1.5 border cursor-pointer whitespace-nowrap flex-shrink-0 text-[12.5px] font-semibold rounded-full transition-all flex items-center gap-1.5
                                ${pathname === "/urbexon-hour" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-transparent text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600"}`}
                            onClick={onSelectAll}
                        >
                            All
                            <Badge variant="hour" className="!bg-white/25 !text-white">EXPRESS</Badge>
                        </button>
                        {uhCategories.map((cat) => (
                            <button
                                key={cat._id || cat.id}
                                className={`px-4 py-1.5 border cursor-pointer whitespace-nowrap flex-shrink-0 text-[12.5px] font-semibold rounded-full transition-all flex items-center gap-1.5
                                    ${isUHCatActive(cat.slug) ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-transparent text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600"}`}
                                onClick={() => onSelectCat(cat.slug)}
                            >
                                <CatIcon cat={cat} />
                                {cat.name}
                                {cat.isFast && <Badge variant="hour" className={isUHCatActive(cat.slug) ? "!bg-white/25 !text-white" : ""}>FAST</Badge>}
                            </button>
                        ))}
                    </>
                ) : (
                    <>
                        {ecoCategories.map((cat) => (
                            <button
                                key={cat._id || cat.id}
                                className={`px-4 py-1.5 border cursor-pointer whitespace-nowrap flex-shrink-0 text-[12.5px] font-semibold rounded-full transition-all flex items-center gap-1.5
                                    ${isCatActive(cat.slug) ? "bg-gray-900 text-white border-gray-900 shadow-sm" : "bg-transparent text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"}`}
                                onClick={() => onSelectCat(cat.slug)}
                            >
                                <CatIcon cat={cat} />
                                {cat.name}
                                {cat.isHot && <Badge variant="error" className={isCatActive(cat.slug) ? "!bg-white/25 !text-white" : ""}>HOT</Badge>}
                            </button>
                        ))}
                        <button
                            className={`px-4 py-1.5 border cursor-pointer whitespace-nowrap flex-shrink-0 text-[12.5px] font-semibold rounded-full transition-all flex items-center gap-1.5
                                ${pathname === "/deals" ? "bg-gray-900 text-white border-gray-900 shadow-sm" : "bg-transparent text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"}`}
                            onClick={onSelectDeals}
                        >
                            Deals
                            <Badge variant="error" className={pathname === "/deals" ? "!bg-white/25 !text-white" : ""}>HOT</Badge>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});
DesktopCategoryBar.displayName = "DesktopCategoryBar";

/* ═══════════════════════════════════════════════════════
   SEARCH SUGGESTIONS DROPDOWN — its own memoized piece so
   typing doesn't re-render the logo/cart/avatar cluster.
═══════════════════════════════════════════════════════ */
const SuggestionsDropdown = memo(({ suggestions, recentSearches, onPickSuggestion, onPickRecent }) => (
    <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl border border-gray-100 shadow-[0_12px_36px_rgba(0,0,0,0.12)] z-[700] max-h-[400px] overflow-y-auto py-2 animate-[fadeDown_0.15s_ease]">
        {suggestions.length > 0 ? (
            <>
                <div className="px-4 pt-1.5 pb-1 text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Suggestions</div>
                {suggestions.map((s, i) => (
                    <div
                        key={s?._id || i}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                        onMouseDown={() => onPickSuggestion(s)}
                    >
                        <img
                            className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0 border border-gray-100"
                            src={s?.images?.[0]?.url || "/placeholder.png"} alt={s?.name}
                            loading="lazy" decoding="async"
                            onError={(e) => { e.currentTarget.src = "/placeholder.png"; }}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-gray-800 truncate">{s?.name}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{s?.brand || s?.category || "Product"}</div>
                        </div>
                    </div>
                ))}
            </>
        ) : (
            <>
                <div className="px-4 pt-1.5 pb-1 text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Recent</div>
                {recentSearches.slice(0, 6).map((t, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors" onMouseDown={() => onPickRecent(t)}>
                        <FaSearch size={11} className="text-gray-300 flex-shrink-0" />
                        <span className="text-[13px] font-medium text-gray-700">{t}</span>
                    </div>
                ))}
            </>
        )}
    </div>
));
SuggestionsDropdown.displayName = "SuggestionsDropdown";

/* ═══════════════════════════════════════════════════════
   MOBILE BOTTOM NAV — static structure, memoized
═══════════════════════════════════════════════════════ */
const MobileBottomNav = memo(({ scrolled, isUH, pathname, isAuth, onNavigate }) => {
    const items = [
        { icon: <FaHome size={17} />, label: "Home", path: "/" },
        { icon: <FaTag size={17} />, label: "Deals", path: "/deals" },
        { icon: <FaBolt size={17} />, label: "UH", path: isUH ? "/" : "/urbexon-hour", isUHBtn: true },
        { icon: <FaHeart size={17} />, label: "Wishlist", path: "/wishlist" },
    ];
    return (
        <div className={`md:hidden fixed bottom-0 left-0 right-0 z-[600] border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] transition-colors duration-300 ${scrolled ? "bg-white/90 backdrop-blur-md" : "bg-white"}`}>
            <div className="flex items-stretch h-[58px]">
                {items.map(({ icon, label, path, isUHBtn }) => {
                    const active = isUHBtn ? isUH : pathname === path;
                    return (
                        <button
                            key={label}
                            className={`flex-1 flex flex-col items-center justify-center gap-[3px] bg-transparent border-none cursor-pointer text-[9.5px] font-semibold transition-colors
                                ${active ? (isUHBtn ? "text-amber-500" : "text-gray-900") : "text-gray-400 hover:text-gray-700"}`}
                            onClick={() => onNavigate(path)}
                        >
                            {icon}
                            <span>{label}</span>
                        </button>
                    );
                })}
                <button
                    className={`flex-1 flex flex-col items-center justify-center gap-[3px] bg-transparent border-none cursor-pointer text-[9.5px] font-semibold transition-colors
                        ${["/profile", "/login"].includes(pathname) ? "text-gray-900" : "text-gray-400 hover:text-gray-700"}`}
                    onClick={() => onNavigate(isAuth ? "/profile" : "/login")}
                >
                    <FaUser size={17} />
                    <span>{isAuth ? "Account" : "Login"}</span>
                </button>
            </div>
        </div>
    );
});
MobileBottomNav.displayName = "MobileBottomNav";

/* ═══════════════════════════════════════════════════════════════
   NAVBAR COMPONENT — Premium sticky layout
   Font: DM Sans (Google Fonts) — clean, modern, geometric
═══════════════════════════════════════════════════════════════ */
const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { locationData, modalOpen: locModalOpen, setModalOpen: setLocModalOpen } = useLocation2();
    const isAuth = Boolean(user);

    const isUH = location.pathname.startsWith("/urbexon-hour") || location.pathname.startsWith("/uh-");

    const showCategoryBar = (() => {
        const path = location.pathname;
        if (isUH) {
            return path === "/urbexon-hour" || /^\/urbexon-hour\/[a-zA-Z0-9-]+$/.test(path);
        }
        const ecommerceAllowedPaths = ["/", "/products", "/deals"];
        return ecommerceAllowedPaths.includes(path) || path.startsWith("/category/");
    })();

    const ecoCount = useSelector(selectEcommerceTotalItems);
    const uhCount = useSelector(selectUHTotalItems);

    const [navHidden, setNavHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [searchOverlay, setSearchOverlay] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [mobileSearch, setMobileSearch] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);

    const { uhPincode } = useUHLocation();
    const userMenuRef = useRef(null);
    const mobileSearchRef = useRef(null);
    const suggestTimer = useRef(null);
    const lastScrollY = useRef(0);
    const scrolledRef = useRef(false);
    const navHiddenRef = useRef(false);
    const rafPending = useRef(false);
    const desktopHeaderRef = useRef(null);
    const mobileHeaderRef = useRef(null);
    const [desktopHeaderH, setDesktopHeaderH] = useState(null);
    const [mobileHeaderH, setMobileHeaderH] = useState(null);

    const uhCatPath = (slug) => `/urbexon-hour/${slug}`;
    const { categories: ecoCategories } = useCategories("ecommerce");
    const { categories: uhCategories } = useCategories("urbexon_hour");

    /* ── Scroll hide — throttled via rAF, and only sets state when the
         derived boolean actually changes, instead of on every pixel. ── */
    useEffect(() => {
        const onScroll = () => {
            if (rafPending.current) return;
            rafPending.current = true;
            requestAnimationFrame(() => {
                rafPending.current = false;
                const y = window.scrollY;
                const nextScrolled = y > 20;
                if (nextScrolled !== scrolledRef.current) {
                    scrolledRef.current = nextScrolled;
                    setScrolled(nextScrolled);
                }
                if (!mobileMenuOpen && !searchOverlay) {
                    const nextHidden = y > lastScrollY.current && y > 80;
                    if (nextHidden !== navHiddenRef.current) {
                        navHiddenRef.current = nextHidden;
                        setNavHidden(nextHidden);
                    }
                }
                lastScrollY.current = y;
            });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [mobileMenuOpen, searchOverlay]);

    /* ── Measure real header height so the layout spacers below the fixed
         header never drift out of sync with it (avoids content either
         gapping away from the header or getting tucked under it). ── */
    useLayoutEffect(() => {
        const measure = () => {
            if (desktopHeaderRef.current) setDesktopHeaderH(desktopHeaderRef.current.offsetHeight);
            if (mobileHeaderRef.current) setMobileHeaderH(mobileHeaderRef.current.offsetHeight);
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (desktopHeaderRef.current) ro.observe(desktopHeaderRef.current);
        if (mobileHeaderRef.current) ro.observe(mobileHeaderRef.current);
        window.addEventListener("resize", measure);
        return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
        // Mount-only: ResizeObserver already reacts to any height change
        // (category bar appearing/disappearing, font load, etc.) on its own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Body lock ── */
    useEffect(() => {
        const lock = mobileMenuOpen || searchOverlay;
        if (lock) {
            const top = window.scrollY;
            Object.assign(document.body.style, { position: "fixed", top: `-${top}px`, left: "0", right: "0", overflowY: "scroll" });
        } else {
            const top = parseInt(document.body.style.top || "0", 10) * -1;
            Object.assign(document.body.style, { position: "", top: "", left: "", right: "", overflowY: "" });
            if (top) window.scrollTo(0, top);
        }
        return () => {
            const top = parseInt(document.body.style.top || "0", 10) * -1;
            Object.assign(document.body.style, { position: "", top: "", left: "", right: "", overflowY: "" });
            if (top) window.scrollTo(0, top);
        };
    }, [mobileMenuOpen, searchOverlay]);

    /* ── Outside click ── */
    useEffect(() => {
        const fn = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
        };
        document.addEventListener("mousedown", fn);
        return () => document.removeEventListener("mousedown", fn);
    }, []);

    /* ── Escape ── */
    useEffect(() => {
        const fn = (e) => {
            if (e.key === "Escape") { setMobileMenuOpen(false); setSearchOverlay(false); setUserMenuOpen(false); }
        };
        document.addEventListener("keydown", fn);
        return () => document.removeEventListener("keydown", fn);
    }, []);

    /* ── Route change ── */
    useEffect(() => {
        setMobileMenuOpen(false); setSearchOverlay(false); setUserMenuOpen(false);
    }, [location.pathname]);

    /* ── Recent searches ── */
    useEffect(() => {
        try { setRecentSearches(JSON.parse(localStorage.getItem("ux-search-history")) || []); }
        catch { setRecentSearches([]); }
    }, [location.pathname]);

    /* ── Mobile search focus ── */
    useEffect(() => {
        if (searchOverlay) {
            const t = setTimeout(() => mobileSearchRef.current?.focus(), 100);
            return () => clearTimeout(t);
        }
        setMobileSearch("");
    }, [searchOverlay]);

    /* ── Suggestions ──
       BUG FIX: no AbortController meant that if a slower earlier request
       resolved after a newer one (typing "a" then quickly "ab"), its
       response could land last and overwrite the more recent, more
       relevant suggestions with stale ones. Aborting the in-flight
       request whenever a new one is scheduled/unmounted closes that race,
       same pattern already used in ProductDetails.jsx. */
    useEffect(() => {
        clearTimeout(suggestTimer.current);
        if (searchQuery.trim().length < 2) { setSuggestions([]); return; }
        const ctrl = new AbortController();
        suggestTimer.current = setTimeout(() => {
            getProductSuggestions(searchQuery.trim(), isUH ? "urbexon-hour" : "ecommerce", { signal: ctrl.signal })
                .then((r) => setSuggestions(Array.isArray(r.data) ? r.data : []))
                .catch((err) => { if (err.code !== "ERR_CANCELED") setSuggestions([]); });
        }, 280);
        return () => { clearTimeout(suggestTimer.current); ctrl.abort(); };
    }, [searchQuery, isUH]);

    /* ── Handlers ── */
    const go = useCallback((path) => {
        setMobileMenuOpen(false); setUserMenuOpen(false); navigate(path);
    }, [navigate]);

    const handleLogout = useCallback(() => {
        logout(); setUserMenuOpen(false); setMobileMenuOpen(false);
        navigate("/login", { replace: true });
    }, [logout, navigate]);

    const handleSearch = useCallback((q) => {
        const query = (q || "").trim();
        if (!query) return;
        try {
            const key = "ux-search-history";
            const hist = (JSON.parse(localStorage.getItem(key)) || []).filter((h) => h.toLowerCase() !== query.toLowerCase());
            hist.unshift(query);
            localStorage.setItem(key, JSON.stringify(hist.slice(0, 15)));
            setRecentSearches(hist.slice(0, 15));
        } catch { /* localStorage write/parse failed (quota, parse error) — search still proceeds without history save */ }
        setSuggestions([]); setSearchFocused(false); setMobileMenuOpen(false); setSearchOverlay(false);
        navigate(isUH ? `/urbexon-hour?search=${encodeURIComponent(query)}` : `/?search=${encodeURIComponent(query)}`);
    }, [navigate, isUH]);

    const pickSuggestion = useCallback((s) => {
        navigate(isUH ? `/uh-product/${s.slug || s._id}` : `/products/${s.slug || s._id}`);
        setSuggestions([]); setSearchQuery("");
    }, [navigate, isUH]);

    const hasCategories = isUH ? uhCategories.length > 0 : ecoCategories.length > 0;
    const shouldShowCatBar = hasCategories && showCategoryBar;

    const defaultTags = isUH
        ? ["Grocery", "Snacks", "Drinks", "Fresh", "Dairy", "Bakery"]
        : ["Mobile", "Laptop", "TV", "Fashion", "Shoes", "Watches"];

    const deliveryLabel = locationData?.label || locationData?.city || "Select delivery location";
    const uhPincodeLabel = uhPincode?.area || uhPincode?.city || uhPincode?.code || "Set delivery pincode";
    const vendorDropdownPincode = isUH ? uhPincode?.code : locationData?.pincode;
    const vendorDropdownLabel = isUH ? uhPincodeLabel : deliveryLabel;

    return (
        <>
            <style>{GLOBAL_STYLE}</style>

            {/* ════════════════════════════════════════
                DESKTOP — SINGLE-ROW STICKY HEADER (Flipkart-style)
                Row 1: logo · UH toggle · search (stretches) · location · actions
                Row 2: icon-on-top category strip
                (the old second, large centered search row has been
                removed — Row 1's search is the only desktop search bar)
            ════════════════════════════════════════ */}
            <div
                id="urbexon-navbar"
                ref={desktopHeaderRef}
                className={`hidden md:block fixed top-0 left-0 right-0 z-[600] transition-transform duration-300 ${navHidden ? "-translate-y-full" : "translate-y-0"}`}
            >
                <div className={`shadow-[0_1px_12px_rgba(0,0,0,0.06)] transition-colors duration-300 ${shouldShowCatBar ? "" : "border-b border-gray-100"} ${scrolled ? "bg-white/90 backdrop-blur-md" : "bg-white"}`}>

                    {/* ── Row 1: logo · UH toggle · search · location · actions ── */}
                    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-[68px] flex items-center gap-3 lg:gap-4">
                        <button
                            className="flex items-baseline gap-0 bg-transparent border-none cursor-pointer flex-shrink-0"
                            onClick={() => go(isUH ? "/urbexon-hour" : "/")}
                        >
                            <span className="text-[22px] font-bold text-gray-900 tracking-[-0.5px] leading-none">
                                urbexon
                            </span>
                            {isUH && (
                                <span className="ml-1 text-[13px] font-semibold text-amber-500 tracking-wide uppercase leading-none self-end mb-[1px]">
                                    hour
                                </span>
                            )}
                        </button>

                        {/* UH Toggle pill — Flipkart "Minutes"-style stacked icon+label chip */}
                        <button
                            className={`flex flex-col items-center justify-center gap-0.5 px-3.5 py-1.5 rounded-xl border font-bold text-[10.5px] cursor-pointer flex-shrink-0 whitespace-nowrap transition-all leading-none
                                ${isUH ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900"}`}
                            onClick={() => navigate(isUH ? "/" : "/urbexon-hour")}
                        >
                            <FaBolt size={14} className={isUH ? "text-amber-500" : "text-gray-400"} />
                            <span>{isUH ? "Store" : "Hour"}</span>
                        </button>

                        {/* Search — stretches to fill the space between the toggle and
                            location/actions, Flipkart-style. This is now the ONLY
                            desktop search bar. */}
                        <div className="flex-1 min-w-0 relative">
                            <form
                                className="flex items-stretch bg-gray-50 border border-gray-200 rounded-xl overflow-hidden h-[42px] focus-within:border-gray-400 focus-within:bg-white focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.08)] transition-all"
                                onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }}
                            >
                                <span className="flex items-center pl-4 text-gray-400 flex-shrink-0">
                                    <FaSearch size={14} />
                                </span>
                                <input
                                    className="ux-search-input flex-1 min-w-0 px-3 border-none bg-transparent text-[13.5px] font-medium text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                                    placeholder={isUH ? "Search Urbexon Hour products…" : "Search for Products, Brands and More"}
                                />
                                {!!searchQuery && (
                                    <button
                                        type="button"
                                        className="flex items-center justify-center bg-transparent border-none cursor-pointer px-2 text-gray-300 hover:text-gray-500 transition-colors"
                                        onClick={() => { setSearchQuery(""); setSuggestions([]); }}
                                    >
                                        <FaTimes size={13} />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className={`border-none cursor-pointer px-4 flex items-center flex-shrink-0 transition-colors
                                        ${isUH ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-gray-800 hover:bg-gray-900 text-white"}`}
                                >
                                    <FaSearch size={14} />
                                </button>
                            </form>

                            {searchFocused && (suggestions.length > 0 || (searchQuery.length < 2 && recentSearches.length > 0)) && (
                                <SuggestionsDropdown
                                    suggestions={suggestions}
                                    recentSearches={recentSearches}
                                    onPickSuggestion={pickSuggestion}
                                    onPickRecent={handleSearch}
                                />
                            )}
                        </div>

                        {/* Delivery location — ecommerce opens the LocationModal; Urbexon
                            Hour is read-only here (owns its own pincode flow on the page
                            itself, via the "Change" button in its LocationBar) so this
                            pill can never show a different value than that page. */}
                        {/* Compact icon-only version — fills the md→lg gap where the
                            full label version below is still hidden, so location stays
                            reachable instead of vanishing at tablet/mid-desktop widths. */}
                        <button
                            className="hidden md:flex lg:hidden items-center justify-center w-9 h-9 rounded-lg bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 transition-all flex-shrink-0"
                            onClick={() => isUH ? navigate("/urbexon-hour") : setLocModalOpen(true)}
                            title={isUH ? uhPincodeLabel : deliveryLabel}
                        >
                            <FaMapMarkerAlt size={14} className={isUH ? "text-amber-500" : "text-gray-500"} />
                        </button>

                        <button
                            className="hidden lg:flex items-center gap-1.5 cursor-pointer px-2.5 py-2 rounded-lg bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 transition-all flex-shrink-0 max-w-[190px]"
                            onClick={() => isUH ? navigate("/urbexon-hour") : setLocModalOpen(true)}
                        >
                            <FaMapMarkerAlt size={15} className={`flex-shrink-0 ${isUH ? "text-amber-500" : "text-gray-500"}`} />
                            <span className={`text-[13px] font-semibold truncate leading-tight ${isUH ? "text-gray-800" : (locationData?.label || locationData?.city ? "text-gray-800" : "text-blue-600")}`}>
                                {isUH ? uhPincodeLabel : deliveryLabel}
                            </span>
                            <FaChevronDown size={9} className="text-gray-400 flex-shrink-0" />
                        </button>

                        {/* Vendor Store — real vendors near the resolved pincode, so the
                            user can jump straight to a vendor's own store and buy direct. */}
                        <VendorStoreDropdown pincode={vendorDropdownPincode} pincodeLabel={vendorDropdownLabel} variant="desktop" />

                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 lg:gap-1 flex-shrink-0">
                            {!isUH && <NotificationCenter theme="light" />}
                            {isAuth ? (
                                <>
                                    {!isUH && (
                                        <button
                                            className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-all whitespace-nowrap"
                                            onClick={() => go("/wishlist")}
                                        >
                                            <FaHeart size={15} className="text-rose-400" />
                                            <span className="hidden xl:inline">Wishlist</span>
                                        </button>
                                    )}

                                    {isUH ? (
                                        <button
                                            className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-semibold text-gray-700 relative transition-all whitespace-nowrap"
                                            onClick={() => go("/uh-cart")}
                                        >
                                            <FaBolt size={15} className="text-amber-500" />
                                            <span className="hidden xl:inline">UH Cart</span>
                                            {uhCount > 0 && (
                                                <span className="absolute -top-0.5 right-0 min-w-[16px] h-4 bg-amber-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center px-0.5">
                                                    {uhCount > 9 ? "9+" : uhCount}
                                                </span>
                                            )}
                                        </button>
                                    ) : (
                                        <>
                                            {uhCount > 0 && (
                                                <button
                                                    className="flex items-center bg-transparent border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer px-2.5 py-1.5 rounded-lg text-gray-600 relative transition-all"
                                                    onClick={() => go("/uh-cart")}
                                                >
                                                    <FaBolt size={15} className="text-amber-500" />
                                                    <span className="absolute -top-0.5 right-0 min-w-[14px] h-[14px] bg-rose-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center px-0.5">
                                                        {uhCount > 9 ? "9+" : uhCount}
                                                    </span>
                                                </button>
                                            )}
                                            <button
                                                className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-semibold text-gray-800 relative transition-all whitespace-nowrap"
                                                onClick={() => go("/cart")}
                                            >
                                                <FaShoppingCart size={15} />
                                                <span className="hidden xl:inline">Cart</span>
                                                {ecoCount > 0 && (
                                                    <span className="absolute -top-0.5 right-0 min-w-[16px] h-4 bg-gray-800 text-white rounded-full text-[9px] font-bold flex items-center justify-center px-0.5">
                                                        {ecoCount > 9 ? "9+" : ecoCount}
                                                    </span>
                                                )}
                                            </button>
                                        </>
                                    )}

                                    <div className="relative ml-1" ref={userMenuRef}>
                                        <button
                                            className="flex items-center gap-2 bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-pointer px-2 py-1.5 rounded-lg transition-all"
                                            onClick={() => setUserMenuOpen((s) => !s)}
                                        >
                                            <Avatar name={user?.name} size="sm" />
                                            <span className="hidden xl:block text-[13px] font-medium text-gray-800 max-w-[80px] truncate">
                                                {firstName(user?.name)}
                                            </span>
                                            <FaChevronDown size={9} className={`hidden xl:block text-gray-500 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
                                        </button>

                                        {userMenuOpen && (
                                            <div className="absolute right-0 top-[calc(100%+8px)] bg-white rounded-2xl border border-gray-100 shadow-[0_12px_40px_rgba(0,0,0,0.12)] min-w-[220px] z-[800] overflow-hidden animate-[dropDown_0.18s_ease]">
                                                <div className="px-4 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                                                    <Avatar name={user?.name} size="md" />
                                                    <div className="min-w-0">
                                                        <div className="text-[13px] font-semibold text-gray-900 leading-tight">{user?.name}</div>
                                                        <div className="text-[11px] text-gray-600 break-all mt-0.5">{user?.email}</div>
                                                    </div>
                                                </div>
                                                {[
                                                    { icon: <FaUser size={12} />, label: "My Profile", path: "/profile" },
                                                    { icon: <FaBox size={12} />, label: "My Orders", path: "/orders" },
                                                    { icon: <FaHeart size={12} />, label: "Wishlist", path: "/wishlist" },
                                                ].map(({ icon, label, path }) => (
                                                    <button
                                                        key={path}
                                                        className="flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer w-full text-left text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors border-t border-gray-50"
                                                        onClick={() => go(path)}
                                                    >
                                                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">{icon}</span>
                                                        {label}
                                                    </button>
                                                ))}
                                                <div className="h-px bg-gray-100 mx-4" />
                                                <button
                                                    className="flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer w-full text-left text-[13px] font-medium text-rose-500 hover:bg-rose-50 transition-colors"
                                                    onClick={handleLogout}
                                                >
                                                    <span className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                                                        <FaSignOutAlt size={11} className="text-rose-500" />
                                                    </span>
                                                    Logout
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {isUH ? (
                                        <button
                                            className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-semibold text-gray-800 relative transition-all whitespace-nowrap"
                                            onClick={() => go("/uh-cart")}
                                        >
                                            <FaBolt size={15} className="text-amber-500" />
                                            <span className="hidden xl:inline">UH Cart</span>
                                            {uhCount > 0 && (
                                                <span className="absolute -top-0.5 right-0 min-w-[16px] h-4 bg-amber-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center px-0.5">
                                                    {uhCount > 9 ? "9+" : uhCount}
                                                </span>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-semibold text-gray-800 relative transition-all whitespace-nowrap"
                                            onClick={() => go("/cart")}
                                        >
                                            <FaShoppingCart size={15} />
                                            <span className="hidden xl:inline">Cart</span>
                                            {ecoCount > 0 && (
                                                <span className="absolute -top-0.5 right-0 min-w-[16px] h-4 bg-gray-800 text-white rounded-full text-[9px] font-bold flex items-center justify-center px-0.5">
                                                    {ecoCount > 9 ? "9+" : ecoCount}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        className="ml-1 px-5 py-1.5 bg-gray-800 border-none rounded-lg cursor-pointer text-[13px] font-semibold text-white hover:bg-gray-900 transition-colors whitespace-nowrap"
                                        onClick={() => go("/login")}
                                    >
                                        Login
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {shouldShowCatBar && (
                    <DesktopCategoryBar
                        isUH={isUH}
                        scrolled={scrolled}
                        uhCategories={uhCategories}
                        ecoCategories={ecoCategories}
                        pathname={location.pathname}
                        onSelectAll={() => navigate("/urbexon-hour")}
                        onSelectCat={(slug) => navigate(isUH ? uhCatPath(slug) : `/category/${slug}`)}
                        onSelectDeals={() => navigate("/deals")}
                    />
                )}
            </div>

            {/* ════════════════════════════════════════
                MOBILE — logo/actions · location · large search · categories
                All four rows below share the same px-3 horizontal padding
                so their content lines up in a single vertical column.
                (Unchanged — mobile never had the duplicate-search issue,
                it only ever renders this one tap-to-open search row.)
            ════════════════════════════════════════ */}
            <div
                id="urbexon-navbar"
                ref={mobileHeaderRef}
                className={`md:hidden fixed top-0 left-0 right-0 z-[600] transition-all duration-300 shadow-[0_1px_8px_rgba(0,0,0,0.06)] ${shouldShowCatBar ? "" : "border-b border-gray-100"} ${navHidden ? "-translate-y-full" : "translate-y-0"} ${scrolled ? "bg-white/90 backdrop-blur-md" : "bg-white"}`}
            >
                {/* Row 1: logo + icon cluster */}
                <div className="flex items-center h-[52px] px-3 gap-1.5">
                    <button
                        className="flex items-baseline gap-0 bg-transparent border-none cursor-pointer flex-shrink-0 min-w-0"
                        onClick={() => go(isUH ? "/urbexon-hour" : "/")}
                    >
                        <span className="text-[19px] font-bold text-gray-900 tracking-[-0.3px] leading-none truncate">
                            urbexon
                        </span>
                        {isUH && (
                            <span className="ml-1 text-[11px] font-semibold text-amber-500 tracking-wide uppercase leading-none self-end mb-[1px] flex-shrink-0">
                                hour
                            </span>
                        )}
                    </button>

                    <button
                        className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full border font-semibold text-[10.5px] cursor-pointer flex-shrink-0 whitespace-nowrap transition-all
                            ${isUH ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}
                        onClick={() => navigate(isUH ? "/" : "/urbexon-hour")}
                    >
                        <FaBolt size={9} className={isUH ? "text-amber-500" : "text-gray-400"} />
                        <span>{isUH ? "Store" : "UH"}</span>
                    </button>

                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {isUH ? (
                            <button
                                className="w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer relative hover:bg-gray-100 transition-colors flex-shrink-0"
                                onClick={() => go("/uh-cart")}
                            >
                                <FaBolt size={17} className="text-amber-500" />
                                {uhCount > 0 && (
                                    <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-amber-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center px-0.5">
                                        {uhCount > 9 ? "9+" : uhCount}
                                    </span>
                                )}
                            </button>
                        ) : (
                            <>
                                <NotificationCenter variant="mobile" theme="light" />
                                {uhCount > 0 && (
                                    <button
                                        className="w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer relative hover:bg-gray-100 transition-colors flex-shrink-0"
                                        onClick={() => go("/uh-cart")}
                                    >
                                        <FaBolt size={17} className="text-amber-500" />
                                        <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-rose-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center px-0.5">
                                            {uhCount > 9 ? "9+" : uhCount}
                                        </span>
                                    </button>
                                )}
                                <button
                                    className="w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer relative hover:bg-gray-100 transition-colors flex-shrink-0"
                                    onClick={() => go("/cart")}
                                >
                                    <FaShoppingCart size={17} />
                                    {ecoCount > 0 && (
                                        <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-gray-900 text-white rounded-full text-[8px] font-bold flex items-center justify-center px-0.5">
                                            {ecoCount > 9 ? "9+" : ecoCount}
                                        </span>
                                    )}
                                </button>
                            </>
                        )}
                        <button
                            className="w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors flex-shrink-0"
                            onClick={() => setMobileMenuOpen((s) => !s)}
                        >
                            <FaBars size={17} />
                        </button>
                    </div>
                </div>

                {/* Row 2: delivery location + Vendor Store. Ecommerce opens the
                    LocationModal; Urbexon Hour is read-only (owns its own pincode
                    flow further down the page) so this can't disagree with it. */}
                <div className="flex items-center gap-1 border-t border-gray-50 px-3">
                    <button
                        className="flex-1 min-w-0 flex items-center gap-2 h-[36px] bg-transparent border-none cursor-pointer active:bg-gray-50 transition-colors"
                        onClick={() => isUH ? navigate("/urbexon-hour") : setLocModalOpen(true)}
                    >
                        <FaMapMarkerAlt size={12} className="text-amber-500 flex-shrink-0" />
                        <span className="text-[10px] text-gray-500 font-medium flex-shrink-0">Deliver to</span>
                        <span className="text-[12.5px] font-semibold text-gray-900 truncate min-w-0 flex-1 text-left">
                            {isUH ? uhPincodeLabel : deliveryLabel}
                        </span>
                        <FaChevronDown size={9} className="text-gray-400 flex-shrink-0" />
                    </button>
                    <VendorStoreDropdown pincode={vendorDropdownPincode} pincodeLabel={vendorDropdownLabel} variant="mobile" />
                </div>

                {/* Row 3: large tap-to-search bar */}
                <div className="px-3 pb-2.5 pt-1.5">
                    <div
                        className="flex items-center bg-gray-50 border border-gray-200 rounded-xl h-11 px-3.5 gap-2.5 cursor-pointer active:border-gray-300 transition-colors"
                        onClick={() => setSearchOverlay(true)}
                    >
                        <FaSearch size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="text-[13.5px] text-gray-400 truncate leading-none">
                            {isUH ? "Search Urbexon Hour…" : "Search products, brands and more"}
                        </span>
                    </div>
                </div>

                {/* Row 4: category strip — same memoized component as desktop,
                    padding matched to the rows above via the `mobile` flag */}
                {shouldShowCatBar && (
                    <DesktopCategoryBar
                        mobile
                        isUH={isUH}
                        scrolled={scrolled}
                        uhCategories={uhCategories}
                        ecoCategories={ecoCategories}
                        pathname={location.pathname}
                        onSelectAll={() => navigate("/urbexon-hour")}
                        onSelectCat={(slug) => navigate(isUH ? uhCatPath(slug) : `/category/${slug}`)}
                        onSelectDeals={() => navigate("/deals")}
                    />
                )}
            </div>

            {/* ════════════════════════════════════════
                SPACERS — must track the real rendered header height.
                Fallback defaults updated to reflect the removed desktop
                Row 2 (68px header row instead of 68+64) before the
                ResizeObserver reports the real measured height.
            ════════════════════════════════════════ */}
            <div className="hidden md:block" style={{ height: desktopHeaderH ?? (shouldShowCatBar ? 102 : 68) }} />
            <div className="md:hidden" style={{ height: mobileHeaderH ?? (shouldShowCatBar ? 194 : 148) }} />

            <MobileBottomNav
                scrolled={scrolled}
                isUH={isUH}
                pathname={location.pathname}
                isAuth={isAuth}
                onNavigate={(path) => navigate(path)}
            />

            {/* ════════════════════════════════════════
                MOBILE BACKDROP
            ════════════════════════════════════════ */}
            <div
                className={`fixed inset-0 bg-black/40 z-[900] transition-opacity duration-250 ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={() => setMobileMenuOpen(false)}
            />

            {/* ════════════════════════════════════════
                MOBILE SLIDE MENU
            ════════════════════════════════════════ */}
            <div
                id="urbexon-navbar"
                className={`fixed top-0 left-0 bottom-0 w-[min(80vw,300px)] bg-white z-[901] flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
                {isAuth ? (
                    <div className="relative bg-gray-50 border-b border-gray-100 px-4 py-4 flex items-center gap-3">
                        <Avatar name={user?.name} size="md" />
                        <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-gray-900 leading-tight">{user?.name}</div>
                            <div className="text-[11px] text-gray-600 break-all mt-0.5">{user?.email}</div>
                        </div>
                        <button
                            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-200 border-none text-gray-700 cursor-pointer flex items-center justify-center hover:bg-gray-300 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            <FaTimes size={13} />
                        </button>
                    </div>
                ) : (
                    <div className="relative bg-gray-50 border-b border-gray-100 px-4 py-4">
                        <div className="text-[15px] font-semibold text-gray-900 mb-3">Welcome to Urbexon</div>
                        <div className="flex gap-2">
                            <button className="flex-1 h-9 rounded-lg bg-gray-800 border-none text-[12.5px] font-semibold text-white cursor-pointer hover:bg-gray-900 transition-colors" onClick={() => go("/login")}>Login</button>
                            <button className="flex-1 h-9 rounded-lg bg-transparent border border-gray-300 text-[12.5px] font-semibold text-gray-800 cursor-pointer hover:border-gray-400 transition-colors" onClick={() => go("/register")}>Register</button>
                        </div>
                        <button
                            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-200 border-none text-gray-700 cursor-pointer flex items-center justify-center hover:bg-gray-300 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            <FaTimes size={13} />
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {isAuth && (
                        <>
                            <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-b border-gray-100">My Account</div>
                            {[
                                { icon: <FaUser size={12} />, label: "My Profile", path: "/profile" },
                                { icon: <FaBox size={12} />, label: "My Orders", path: "/orders" },
                                { icon: <FaHeart size={12} />, label: "My Wishlist", path: "/wishlist" },
                            ].map(({ icon, label, path }) => (
                                <div key={path} className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors" onClick={() => go(path)}>
                                    <div className="flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">{icon}</span>
                                        <span className="text-[13.5px] font-medium text-gray-800">{label}</span>
                                    </div>
                                    <FaChevronRight size={10} className="text-gray-300" />
                                </div>
                            ))}
                        </>
                    )}

                    <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-b border-gray-100">Location</div>
                    <div
                        className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                        onClick={() => { setMobileMenuOpen(false); setLocModalOpen(true); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <FaMapMarkerAlt size={12} className="text-amber-500" />
                            </span>
                            <span className="text-[13.5px] font-medium text-gray-800 truncate">
                                {deliveryLabel}
                            </span>
                        </div>
                        <FaChevronRight size={10} className="text-gray-300" />
                    </div>

                    <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-b border-gray-100">
                        {isUH ? "Urbexon Hour" : "Shop by Category"}
                    </div>

                    {isUH ? (
                        <>
                            <div className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors" onClick={() => go("/urbexon-hour")}>
                                <div className="flex items-center gap-3">
                                    <span className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                                        <FaBolt size={12} className="text-amber-500" />
                                    </span>
                                    <span className="text-[13.5px] font-medium text-gray-800">All UH Products</span>
                                </div>
                                <FaChevronRight size={10} className="text-gray-300" />
                            </div>
                            {uhCategories.map((cat) => (
                                <div key={cat._id || cat.id} className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors" onClick={() => go(uhCatPath(cat.slug))}>
                                    <span className="text-[13.5px] font-medium text-gray-800 truncate">{cat.name}</span>
                                    <FaChevronRight size={10} className="text-gray-300" />
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            {ecoCategories.map((cat) => (
                                <div key={cat._id || cat.id} className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors" onClick={() => go(`/category/${cat.slug}`)}>
                                    <span className="text-[13.5px] font-medium text-gray-800 truncate">{cat.name}</span>
                                    <FaChevronRight size={10} className="text-gray-300" />
                                </div>
                            ))}
                            <div className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors" onClick={() => go("/deals")}>
                                <div className="flex items-center gap-3">
                                    <span className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                                        <FaTag size={12} className="text-rose-500" />
                                    </span>
                                    <span className="text-[13.5px] font-medium text-gray-800">Deals &amp; Offers</span>
                                </div>
                                <FaChevronRight size={10} className="text-gray-300" />
                            </div>
                        </>
                    )}

                    <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-b border-gray-100">Switch Mode</div>
                    <div
                        className={`min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer border-b border-gray-50 transition-colors ${isUH ? "bg-gray-50 hover:bg-gray-100" : "bg-amber-50 hover:bg-amber-100"}`}
                        onClick={() => go(isUH ? "/" : "/urbexon-hour")}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isUH ? "bg-gray-200 text-gray-600" : "bg-amber-100 text-amber-600"}`}>
                                {isUH ? <FaShoppingCart size={12} /> : <FaBolt size={12} />}
                            </span>
                            <span className={`text-[13.5px] font-semibold ${isUH ? "text-gray-700" : "text-amber-700"}`}>
                                {isUH ? "Back to Store" : "Urbexon Hour — 45 min Delivery"}
                            </span>
                        </div>
                        <FaChevronRight size={10} className="text-gray-300" />
                    </div>

                    {isAuth && (
                        <>
                            <div className="h-px bg-gray-100 mt-2" />
                            <div className="min-h-[46px] px-4 flex items-center gap-3 cursor-pointer bg-white hover:bg-rose-50 transition-colors text-[13.5px] font-medium text-rose-500" onClick={handleLogout}>
                                <span className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                                    <FaSignOutAlt size={12} className="text-rose-500" />
                                </span>
                                Logout
                            </div>
                        </>
                    )}
                    <div className="h-6" />
                </div>
            </div>

            {/* ════════════════════════════════════════
                MOBILE SEARCH OVERLAY
            ════════════════════════════════════════ */}
            {searchOverlay && (
                <div id="urbexon-navbar" className="fixed inset-0 z-[950] bg-white animate-[fadeIn_0.15s_ease]">
                    <div className="flex items-center gap-2 px-2 h-[54px] bg-white border-b border-gray-100">
                        <button
                            className="w-9 h-9 bg-transparent border-none text-gray-600 cursor-pointer flex items-center justify-center flex-shrink-0 rounded-lg hover:bg-gray-100 transition-colors"
                            onClick={() => setSearchOverlay(false)}
                        >
                            <FaArrowLeft size={15} />
                        </button>
                        <form
                            className="flex-1 flex items-stretch bg-gray-50 border border-gray-200 rounded-xl overflow-hidden h-[38px] focus-within:border-gray-400"
                            onSubmit={(e) => { e.preventDefault(); handleSearch(mobileSearch); }}
                        >
                            <input
                                ref={mobileSearchRef}
                                className="ux-search-input flex-1 px-3.5 border-none bg-transparent text-[15px] font-medium text-gray-800 placeholder:text-gray-400"
                                type="text"
                                value={mobileSearch}
                                onChange={(e) => setMobileSearch(e.target.value)}
                                placeholder={isUH ? "Search Urbexon Hour…" : "Search products, brands…"}
                            />
                            <button
                                type="submit"
                                className={`border-none px-3.5 cursor-pointer flex items-center transition-colors ${isUH ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-gray-800 hover:bg-gray-900 text-white"}`}
                            >
                                <FaSearch size={14} />
                            </button>
                        </form>
                    </div>

                    <div className="p-4 overflow-y-auto">
                        {recentSearches.length > 0 && (
                            <>
                                <div className="text-[10.5px] font-bold text-gray-400 tracking-widest uppercase mb-2">Recent Searches</div>
                                {recentSearches.slice(0, 6).map((t, i) => (
                                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 cursor-pointer hover:text-gray-900 transition-colors" onClick={() => handleSearch(t)}>
                                        <FaSearch size={11} className="text-gray-300 flex-shrink-0" />
                                        <span className="text-[13.5px] font-medium text-gray-700">{t}</span>
                                    </div>
                                ))}
                                <div className="h-5" />
                            </>
                        )}
                        <div className="text-[10.5px] font-bold text-gray-400 tracking-widest uppercase mb-3">Trending</div>
                        <div className="flex flex-wrap gap-2">
                            {defaultTags.map((t) => (
                                <button
                                    key={t}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-[12.5px] font-medium text-gray-600 cursor-pointer hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-all"
                                    onClick={() => handleSearch(t)}
                                >
                                    <FaSearch size={10} />{t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {locModalOpen && <LocationModal onClose={() => setLocModalOpen(false)} />}
        </>
    );
};

export default Navbar;