import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
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
import { fetchActiveCategories } from "../api/categoryApi";
import api from "../api/axios";
import NotificationCenter from "./NotificationCenter";
import { selectEcommerceTotalItems, selectUHTotalItems } from "../features/cart/cartSlice";

/* ─── Helpers ─────────────────────────────────────────── */
const isUHCat = (c) =>
    c?.productType === "urbexon_hour" || c?.productType === "urbexon-hour" ||
    c?.type === "urbexon_hour" || c?.type === "urbexon-hour" || Boolean(c?.isUrbexonHour);

const getInitial = (name) => name?.[0]?.toUpperCase() || "U";
const firstName = (name) => name?.split(" ")[0] || "";

/* ═══════════════════════════════════════════════════════
   NAVBAR COMPONENT — Minimalist White Design
   Font: DM Sans (Google Fonts) — clean, modern, geometric
═══════════════════════════════════════════════════════ */
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

    const [ecoCategories, setEcoCategories] = useState([]);
    const [uhCategories, setUhCategories] = useState([]);
    const [navHidden, setNavHidden] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [searchOverlay, setSearchOverlay] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [mobileSearch, setMobileSearch] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);

    const userMenuRef = useRef(null);
    const mobileSearchRef = useRef(null);
    const suggestTimer = useRef(null);
    const lastScrollY = useRef(0);

    const uhCatPath = (slug) => `/urbexon-hour/${slug}`;
    const isCatActive = (slug) => location.pathname === `/category/${slug}`;
    const isUHCatActive = (slug) => location.pathname === `/urbexon-hour/${slug}`;

    /* ── Fetch categories ── */
    useEffect(() => {
        fetchActiveCategories()
            .then((res) => {
                if (res?.data?.length) setEcoCategories(res.data.filter((c) => !isUHCat(c)));
            }).catch(() => { });

        const parse = (res) =>
            Array.isArray(res?.data?.data) ? res.data.data
                : Array.isArray(res?.data?.categories) ? res.data.categories
                    : Array.isArray(res?.data) ? res.data : [];

        (async () => {
            try {
                const endpoints = [
                    "/categories?type=urbexon-hour&isActive=true",
                    "/categories?productType=urbexon_hour&isActive=true",
                    "/categories?productType=urbexon-hour&isActive=true",
                ];
                for (const ep of endpoints) {
                    const res = await api.get(ep).catch(() => null);
                    const cats = parse(res).filter(isUHCat);
                    if (cats.length > 0) { setUhCategories(cats); return; }
                }
                const allRes = await fetchActiveCategories().catch(() => null);
                const all = Array.isArray(allRes?.data) ? allRes.data : [];
                const uhOnly = all.filter(isUHCat);
                if (uhOnly.length > 0) setUhCategories(uhOnly);
            } catch { }
        })();
    }, []);

    /* ── Scroll hide ── */
    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY;
            if (!mobileMenuOpen && !searchOverlay) setNavHidden(y > lastScrollY.current && y > 80);
            lastScrollY.current = y;
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [mobileMenuOpen, searchOverlay]);

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

    /* ── Suggestions ── */
    useEffect(() => {
        clearTimeout(suggestTimer.current);
        if (searchQuery.trim().length < 2) { setSuggestions([]); return; }
        suggestTimer.current = setTimeout(() => {
            const typeParam = isUH ? "&productType=urbexon-hour" : "&productType=ecommerce";
            api.get(`/products/suggestions?q=${encodeURIComponent(searchQuery.trim())}${typeParam}`)
                .then((r) => setSuggestions(Array.isArray(r.data) ? r.data : []))
                .catch(() => setSuggestions([]));
        }, 280);
        return () => clearTimeout(suggestTimer.current);
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
        } catch { }
        setSuggestions([]); setSearchFocused(false); setMobileMenuOpen(false); setSearchOverlay(false);
        navigate(isUH ? `/urbexon-hour?search=${encodeURIComponent(query)}` : `/?search=${encodeURIComponent(query)}`);
    }, [navigate, isUH]);

    const hasCategories = isUH ? uhCategories.length > 0 : ecoCategories.length > 0;
    const shouldShowCatBar = hasCategories && showCategoryBar;

    const defaultTags = isUH
        ? ["Grocery", "Snacks", "Drinks", "Fresh", "Dairy", "Bakery"]
        : ["Mobile", "Laptop", "TV", "Fashion", "Shoes", "Watches"];

    /* ─────────────────────────────────────────────────────────────
       UH accent: amber-500 / ecommerce accent: slate-900
       Both on white background — clean & minimal with fixed contrast
    ───────────────────────────────────────────────────────────── */
    const accent = isUH ? "#f59e0b" : "#1f2937";   // amber-500 : slate-900 (darkened for contrast)
    const accentLight = isUH ? "#fffbeb" : "#f8fafc";   // amber-50  : slate-50
    const uhPill = "bg-amber-500 text-white";
    const hotPill = "bg-rose-500 text-white";

    return (
        <>
            {/* ════════════════════════════════════════
                GOOGLE FONT IMPORT — DM Sans
            ════════════════════════════════════════ */}
            <style>{`
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

                /* Search input — no browser outline ring */
                .ux-search-input:focus { outline: none; box-shadow: none; }

                /* Subtle border-bottom active indicator for catbar */
                .ux-cat-active  { border-bottom-color: currentColor !important; }
            `}</style>

            {/* ════════════════════════════════════════
                DESKTOP TOP BAR
            ════════════════════════════════════════ */}
            <div
                id="urbexon-navbar"
                className={`hidden md:block fixed top-0 left-0 right-0 z-[600] transition-transform duration-300 ${navHidden ? "-translate-y-full" : "translate-y-0"}`}
            >
                {/* ── Main bar: white with bottom shadow ── */}
                <div className="bg-white border-b border-gray-100 shadow-[0_1px_12px_rgba(0,0,0,0.06)]">
                    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-[60px] flex items-center gap-4">

                        {/* Logo */}
                        <button
                            className="flex items-baseline gap-0 bg-transparent border-none cursor-pointer flex-shrink-0 pr-3"
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

                        {/* Location — xl+ only */}
                        <button
                            className="hidden xl:flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 transition-all flex-shrink-0 max-w-[190px]"
                            onClick={() => setLocModalOpen(true)}
                        >
                            <FaMapMarkerAlt size={12} className="text-amber-500 flex-shrink-0" />
                            <div className="text-left min-w-0">
                                <div className="text-[10px] font-medium text-gray-500 leading-none mb-[3px] flex items-center gap-1">
                                    Deliver to <FaChevronDown size={7} className="text-gray-400" />
                                </div>
                                <div className="text-[12px] font-semibold text-gray-900 truncate max-w-[120px] leading-tight">
                                    {locationData?.label || locationData?.city || "Select location"}
                                </div>
                            </div>
                        </button>

                        {/* Search ── flex-1 with max-width cap */}
                        <div className="flex-1 max-w-[640px] relative">
                            <form
                                className="flex items-stretch bg-gray-50 border border-gray-200 rounded-xl overflow-hidden h-[40px] focus-within:border-gray-400 focus-within:bg-white transition-all"
                                onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }}
                            >
                                <span className="flex items-center pl-3.5 text-gray-400 flex-shrink-0">
                                    <FaSearch size={13} />
                                </span>
                                <input
                                    className="ux-search-input flex-1 px-3 border-none bg-transparent text-[13.5px] font-medium text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                                    placeholder={isUH ? "Search Urbexon Hour products…" : "Search products, brands and more"}
                                />
                                {!!searchQuery && (
                                    <button type="button"
                                        className="flex items-center justify-center bg-transparent border-none cursor-pointer px-2 text-gray-300 hover:text-gray-500 transition-colors"
                                        onClick={() => { setSearchQuery(""); setSuggestions([]); }}>
                                        <FaTimes size={12} />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className={`border-none cursor-pointer px-4 flex items-center gap-1.5 text-[12.5px] font-semibold flex-shrink-0 transition-colors rounded-r-xl
                                        ${isUH
                                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                                            : "bg-gray-800 hover:bg-gray-900 text-white"
                                        }`}
                                >
                                    <FaSearch size={13} />
                                    <span className="hidden lg:inline">Search</span>
                                </button>
                            </form>

                            {/* Suggestions dropdown */}
                            {searchFocused && (suggestions.length > 0 || (searchQuery.length < 2 && recentSearches.length > 0)) && (
                                <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white rounded-xl border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.1)] z-[700] max-h-[400px] overflow-y-auto py-2 animate-[fadeDown_0.15s_ease]">
                                    {suggestions.length > 0 ? (
                                        <>
                                            <div className="px-4 pt-1.5 pb-1 text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Suggestions</div>
                                            {suggestions.map((s, i) => (
                                                <div key={s?._id || i}
                                                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onMouseDown={() => { navigate(isUH ? `/uh-product/${s.slug || s._id}` : `/products/${s.slug || s._id}`); setSuggestions([]); setSearchQuery(""); }}>
                                                    <img className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0 border border-gray-100"
                                                        src={s?.images?.[0]?.url || "/placeholder.png"} alt={s?.name}
                                                        onError={(e) => { e.currentTarget.src = "/placeholder.png"; }} />
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
                                                <div key={i} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onMouseDown={() => handleSearch(t)}>
                                                    <FaSearch size={11} className="text-gray-300 flex-shrink-0" />
                                                    <span className="text-[13px] font-medium text-gray-700">{t}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* UH Toggle pill */}
                        <button
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-semibold text-[12px] cursor-pointer flex-shrink-0 whitespace-nowrap transition-all
                                ${isUH
                                    ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900"
                                }`}
                            onClick={() => navigate(isUH ? "/" : "/urbexon-hour")}
                        >
                            <FaBolt size={11} className={isUH ? "text-amber-500" : "text-gray-400"} />
                            <span>{isUH ? "Back to Store" : "Urbexon Hour"}</span>
                        </button>

                        {/* ── Action buttons ── */}
                        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                            {isAuth ? (
                                <>
                                    {!isUH && (
                                        <>
                                            <button
                                                className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-all whitespace-nowrap"
                                                onClick={() => go("/wishlist")}>
                                                <FaHeart size={15} className="text-rose-400" />
                                                <span className="hidden xl:inline">Wishlist</span>
                                            </button>
                                            <NotificationCenter theme="light" />
                                        </>
                                    )}

                                    {/* Cart(s) */}
                                    {isUH ? (
                                        <button
                                            className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-semibold text-gray-700 relative transition-all whitespace-nowrap"
                                            onClick={() => go("/uh-cart")}>
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
                                                    onClick={() => go("/uh-cart")}>
                                                    <FaBolt size={15} className="text-amber-500" />
                                                    <span className="absolute -top-0.5 right-0 min-w-[14px] h-[14px] bg-rose-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center px-0.5">
                                                        {uhCount > 9 ? "9+" : uhCount}
                                                    </span>
                                                </button>
                                            )}
                                            <button
                                                className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-semibold text-gray-800 relative transition-all whitespace-nowrap"
                                                onClick={() => go("/cart")}>
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

                                    {/* User avatar + dropdown */}
                                    <div className="relative ml-1" ref={userMenuRef}>
                                        <button
                                            className="flex items-center gap-2 bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-pointer px-2 py-1.5 rounded-lg transition-all"
                                            onClick={() => setUserMenuOpen((s) => !s)}>
                                            <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                                                {getInitial(user?.name)}
                                            </div>
                                            <span className="hidden xl:block text-[13px] font-medium text-gray-800 max-w-[80px] truncate">
                                                {firstName(user?.name)}
                                            </span>
                                            <FaChevronDown size={9} className={`hidden xl:block text-gray-500 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
                                        </button>

                                        {userMenuOpen && (
                                            <div className="absolute right-0 top-[calc(100%+8px)] bg-white rounded-2xl border border-gray-100 shadow-[0_12px_40px_rgba(0,0,0,0.12)] min-w-[220px] z-[800] overflow-hidden animate-[dropDown_0.18s_ease]">
                                                {/* Header */}
                                                <div className="px-4 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                                                        {getInitial(user?.name)}
                                                    </div>
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
                                                    <button key={path}
                                                        className="flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer w-full text-left text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors border-t border-gray-50"
                                                        onClick={() => go(path)}>
                                                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">{icon}</span>
                                                        {label}
                                                    </button>
                                                ))}
                                                <div className="h-px bg-gray-100 mx-4" />
                                                <button
                                                    className="flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer w-full text-left text-[13px] font-medium text-rose-500 hover:bg-rose-50 transition-colors"
                                                    onClick={handleLogout}>
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
                                /* ── Guest ── */
                                <>
                                    {isUH ? (
                                        <button
                                            className="flex items-center gap-1.5 bg-transparent border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-semibold text-gray-800 relative transition-all whitespace-nowrap"
                                            onClick={() => go("/uh-cart")}>
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
                                            onClick={() => go("/cart")}>
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
                                        onClick={() => go("/login")}>
                                        Login
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Desktop Category Bar ── */}
                {shouldShowCatBar && (
                    <div className="bg-white border-b border-gray-100">
                        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 flex items-center overflow-x-auto ux-scrollbar-hide gap-0">
                            {isUH ? (
                                <>
                                    <button
                                        className={`px-5 py-2.5 bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0 text-[12.5px] font-medium border-b-2 transition-all flex items-center gap-1.5
                                            ${location.pathname === "/urbexon-hour"
                                                ? "text-amber-600 border-amber-500 font-semibold"
                                                : "text-gray-500 border-transparent hover:text-gray-800"}`}
                                        onClick={() => navigate("/urbexon-hour")}
                                    >
                                        All
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">EXPRESS</span>
                                    </button>
                                    {uhCategories.map((cat) => (
                                        <button key={cat._id || cat.id}
                                            className={`px-5 py-2.5 bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0 text-[12.5px] font-medium border-b-2 transition-all flex items-center gap-1.5
                                                ${isUHCatActive(cat.slug)
                                                    ? "text-amber-600 border-amber-500 font-semibold"
                                                    : "text-gray-500 border-transparent hover:text-gray-800"}`}
                                            onClick={() => navigate(uhCatPath(cat.slug))}>
                                            {cat.name}
                                            {cat.isFast && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">FAST</span>}
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {ecoCategories.map((cat) => (
                                        <button key={cat._id || cat.id}
                                            className={`px-5 py-2.5 bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0 text-[12.5px] font-medium border-b-2 transition-all flex items-center gap-1.5
                                                ${isCatActive(cat.slug)
                                                    ? "text-gray-900 border-gray-900 font-semibold"
                                                    : "text-gray-500 border-transparent hover:text-gray-800"}`}
                                            onClick={() => navigate(`/category/${cat.slug}`)}>
                                            {cat.name}
                                            {cat.isHot && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">HOT</span>}
                                        </button>
                                    ))}
                                    <button
                                        className={`px-5 py-2.5 bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0 text-[12.5px] font-medium border-b-2 transition-all flex items-center gap-1.5
                                            ${location.pathname === "/deals"
                                                ? "text-gray-900 border-gray-900 font-semibold"
                                                : "text-gray-500 border-transparent hover:text-gray-800"}`}
                                        onClick={() => navigate("/deals")}>
                                        Deals
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">HOT</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ════════════════════════════════════════
                MOBILE NAVBAR
                FIX SUMMARY:
                • overflow-hidden on parent — stops visual bleed
                • min-w-0 on search wrapper — CRITICAL: allows
                  flex child to actually shrink
                • flex-shrink-0 on icon group — never compressed
                • w-9 h-9 icons instead of w-10 h-10 (saves 16px)
                • px-2 sm:px-3 — tighter on narrow phones
                • gap-1.5 between columns — saves 2px
            ════════════════════════════════════════ */}
            <div
                id="urbexon-navbar"
                className={`md:hidden fixed top-0 left-0 right-0 z-[600] transition-transform duration-300 bg-white border-b border-gray-100 shadow-[0_1px_8px_rgba(0,0,0,0.06)] ${navHidden ? "-translate-y-full" : "translate-y-0"}`}
            >
                <div className="flex items-center h-[54px] px-2 xs:px-3 gap-1.5">

                    {/* Logo — fixed, never grows, never shrinks */}
                    <button
                        className="flex items-baseline gap-0 bg-transparent border-none cursor-pointer flex-shrink-0 flex-grow-0"
                        onClick={() => go(isUH ? "/urbexon-hour" : "/")}
                    >
                        <span className="text-[18px] font-bold text-gray-900 tracking-[-0.3px] leading-none">
                            urbexon
                        </span>
                        {isUH && (
                            <span className="ml-1 text-[11px] font-semibold text-amber-500 tracking-wide uppercase leading-none self-end mb-[1px]">
                                hour
                            </span>
                        )}
                    </button>

                    {/* Search trigger — flex-1 min-w-0 is the KEY fix */}
                    <div
                        className="flex-1 min-w-0 flex items-center bg-gray-50 border border-gray-200 rounded-lg h-9 px-3 gap-2 cursor-pointer hover:border-gray-300 transition-colors"
                        onClick={() => setSearchOverlay(true)}
                    >
                        <FaSearch size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="text-[12.5px] text-gray-400 truncate leading-none">
                            {isUH ? "Search Urbexon Hour…" : "Search products…"}
                        </span>
                    </div>

                    {/* Right icon group — flex-shrink-0 ensures it's never clipped */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {isUH ? (
                            <button
                                className="w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer relative hover:bg-gray-100 transition-colors"
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
                                {isAuth && <NotificationCenter variant="mobile" theme="light" />}
                                {uhCount > 0 && (
                                    <button
                                        className="w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer relative hover:bg-gray-100 transition-colors"
                                        onClick={() => go("/uh-cart")}
                                    >
                                        <FaBolt size={17} className="text-amber-500" />
                                        <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-rose-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center px-0.5">
                                            {uhCount > 9 ? "9+" : uhCount}
                                        </span>
                                    </button>
                                )}
                                <button
                                    className="w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer relative hover:bg-gray-100 transition-colors"
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
                            className="w-9 h-9 border-none bg-transparent rounded-lg flex items-center justify-center text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setMobileMenuOpen((s) => !s)}
                        >
                            <FaBars size={17} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════
                SPACERS
            ════════════════════════════════════════ */}
            <div className="hidden md:block" style={{ height: shouldShowCatBar ? "calc(60px + 45px)" : "60px" }} />
            <div className="md:hidden h-[54px]" />

            {/* ════════════════════════════════════════
                MOBILE BOTTOM NAV
            ════════════════════════════════════════ */}
            <div
                id="urbexon-navbar"
                className="md:hidden fixed bottom-0 left-0 right-0 z-[600] bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
            >
                <div className="flex items-stretch h-[56px]">
                    {[
                        { icon: <FaHome size={17} />, label: "Home", path: "/" },
                        { icon: <FaTag size={17} />, label: "Deals", path: "/deals" },
                        { icon: <FaBolt size={17} />, label: "UH", path: isUH ? "/" : "/urbexon-hour", isUHBtn: true },
                        { icon: <FaHeart size={17} />, label: "Wishlist", path: "/wishlist" },
                    ].map(({ icon, label, path, isUHBtn }) => {
                        const active = isUHBtn ? isUH : location.pathname === path;
                        return (
                            <button key={label}
                                className={`flex-1 flex flex-col items-center justify-center gap-[3px] bg-transparent border-none cursor-pointer text-[9.5px] font-semibold transition-colors
                                    ${active
                                        ? (isUHBtn ? "text-amber-500" : "text-gray-900")
                                        : "text-gray-400 hover:text-gray-700"
                                    }`}
                                onClick={() => navigate(path)}>
                                {icon}
                                <span>{label}</span>
                            </button>
                        );
                    })}
                    <button
                        className={`flex-1 flex flex-col items-center justify-center gap-[3px] bg-transparent border-none cursor-pointer text-[9.5px] font-semibold transition-colors
                            ${["/profile", "/login"].includes(location.pathname) ? "text-gray-900" : "text-gray-400 hover:text-gray-700"}`}
                        onClick={() => go(isAuth ? "/profile" : "/login")}>
                        <FaUser size={17} />
                        <span>{isAuth ? "Account" : "Login"}</span>
                    </button>
                </div>
            </div>

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
                {/* Header */}
                {isAuth ? (
                    <div className="relative bg-gray-50 border-b border-gray-100 px-4 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                            {getInitial(user?.name)}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-gray-900 leading-tight">{user?.name}</div>
                            <div className="text-[11px] text-gray-600 break-all mt-0.5">{user?.email}</div>
                        </div>
                        <button
                            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-200 border-none text-gray-700 cursor-pointer flex items-center justify-center hover:bg-gray-300 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}>
                            <FaTimes size={13} />
                        </button>
                    </div>
                ) : (
                    <div className="relative bg-gray-50 border-b border-gray-100 px-4 py-4">
                        <div className="text-[15px] font-semibold text-gray-900 mb-3">Welcome to Urbexon</div>
                        <div className="flex gap-2">
                            <button
                                className="flex-1 h-9 rounded-lg bg-gray-800 border-none text-[12.5px] font-semibold text-white cursor-pointer hover:bg-gray-900 transition-colors"
                                onClick={() => go("/login")}>Login</button>
                            <button
                                className="flex-1 h-9 rounded-lg bg-transparent border border-gray-300 text-[12.5px] font-semibold text-gray-800 cursor-pointer hover:border-gray-400 transition-colors"
                                onClick={() => go("/register")}>Register</button>
                        </div>
                        <button
                            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-gray-200 border-none text-gray-700 cursor-pointer flex items-center justify-center hover:bg-gray-300 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}>
                            <FaTimes size={13} />
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {/* My Account section */}
                    {isAuth && (
                        <>
                            <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-b border-gray-100">My Account</div>
                            {[
                                { icon: <FaUser size={12} />, label: "My Profile", path: "/profile" },
                                { icon: <FaBox size={12} />, label: "My Orders", path: "/orders" },
                                { icon: <FaHeart size={12} />, label: "My Wishlist", path: "/wishlist" },
                            ].map(({ icon, label, path }) => (
                                <div key={path}
                                    className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                    onClick={() => go(path)}>
                                    <div className="flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">{icon}</span>
                                        <span className="text-[13.5px] font-medium text-gray-800">{label}</span>
                                    </div>
                                    <FaChevronRight size={10} className="text-gray-300" />
                                </div>
                            ))}
                        </>
                    )}

                    {/* Location */}
                    <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-b border-gray-100">Location</div>
                    <div
                        className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                        onClick={() => { setMobileMenuOpen(false); setLocModalOpen(true); }}>
                        <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <FaMapMarkerAlt size={12} className="text-amber-500" />
                            </span>
                            <span className="text-[13.5px] font-medium text-gray-800 truncate">
                                {locationData?.label || locationData?.city || "Set Location"}
                            </span>
                        </div>
                        <FaChevronRight size={10} className="text-gray-300" />
                    </div>

                    {/* Categories */}
                    <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-b border-gray-100">
                        {isUH ? "Urbexon Hour" : "Shop by Category"}
                    </div>

                    {isUH ? (
                        <>
                            <div
                                className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                onClick={() => go("/urbexon-hour")}>
                                <div className="flex items-center gap-3">
                                    <span className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                                        <FaBolt size={12} className="text-amber-500" />
                                    </span>
                                    <span className="text-[13.5px] font-medium text-gray-800">All UH Products</span>
                                </div>
                                <FaChevronRight size={10} className="text-gray-300" />
                            </div>
                            {uhCategories.map((cat) => (
                                <div key={cat._id || cat.id}
                                    className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                    onClick={() => go(uhCatPath(cat.slug))}>
                                    <span className="text-[13.5px] font-medium text-gray-800 truncate">{cat.name}</span>
                                    <FaChevronRight size={10} className="text-gray-300" />
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            {ecoCategories.map((cat) => (
                                <div key={cat._id || cat.id}
                                    className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                    onClick={() => go(`/category/${cat.slug}`)}>
                                    <span className="text-[13.5px] font-medium text-gray-800 truncate">{cat.name}</span>
                                    <FaChevronRight size={10} className="text-gray-300" />
                                </div>
                            ))}
                            <div
                                className="min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                onClick={() => go("/deals")}>
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

                    {/* Switch mode */}
                    <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-b border-gray-100">Switch Mode</div>
                    <div
                        className={`min-h-[46px] px-4 flex items-center justify-between gap-3 cursor-pointer border-b border-gray-50 transition-colors
                            ${isUH ? "bg-gray-50 hover:bg-gray-100" : "bg-amber-50 hover:bg-amber-100"}`}
                        onClick={() => go(isUH ? "/" : "/urbexon-hour")}>
                        <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                                ${isUH ? "bg-gray-200 text-gray-600" : "bg-amber-100 text-amber-600"}`}>
                                {isUH ? <FaShoppingCart size={12} /> : <FaBolt size={12} />}
                            </span>
                            <span className={`text-[13.5px] font-semibold ${isUH ? "text-gray-700" : "text-amber-700"}`}>
                                {isUH ? "Back to Store" : "Urbexon Hour — 45 min Delivery"}
                            </span>
                        </div>
                        <FaChevronRight size={10} className="text-gray-300" />
                    </div>

                    {/* Logout */}
                    {isAuth && (
                        <>
                            <div className="h-px bg-gray-100 mt-2" />
                            <div
                                className="min-h-[46px] px-4 flex items-center gap-3 cursor-pointer bg-white hover:bg-rose-50 transition-colors text-[13.5px] font-medium text-rose-500"
                                onClick={handleLogout}>
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
                <div
                    id="urbexon-navbar"
                    className="fixed inset-0 z-[950] bg-white animate-[fadeIn_0.15s_ease]"
                >
                    {/* Top bar */}
                    <div className="flex items-center gap-2 px-2 h-[54px] bg-white border-b border-gray-100">
                        <button
                            className="w-9 h-9 bg-transparent border-none text-gray-600 cursor-pointer flex items-center justify-center flex-shrink-0 rounded-lg hover:bg-gray-100 transition-colors"
                            onClick={() => setSearchOverlay(false)}>
                            <FaArrowLeft size={15} />
                        </button>
                        <form
                            className="flex-1 flex items-stretch bg-gray-50 border border-gray-200 rounded-xl overflow-hidden h-[38px] focus-within:border-gray-400"
                            onSubmit={(e) => { e.preventDefault(); handleSearch(mobileSearch); }}>
                            <input
                                ref={mobileSearchRef}
                                className="ux-search-input flex-1 px-3.5 border-none bg-transparent text-[15px] font-medium text-gray-800 placeholder:text-gray-400"
                                type="text"
                                value={mobileSearch}
                                onChange={(e) => setMobileSearch(e.target.value)}
                                placeholder={isUH ? "Search Urbexon Hour…" : "Search products, brands…"} />
                            <button
                                type="submit"
                                className={`border-none px-3.5 cursor-pointer flex items-center transition-colors
                                    ${isUH ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-gray-800 hover:bg-gray-900 text-white"}`}>
                                <FaSearch size={14} />
                            </button>
                        </form>
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto">
                        {recentSearches.length > 0 && (
                            <>
                                <div className="text-[10.5px] font-bold text-gray-400 tracking-widest uppercase mb-2">Recent Searches</div>
                                {recentSearches.slice(0, 6).map((t, i) => (
                                    <div key={i}
                                        className="flex items-center gap-3 py-2.5 border-b border-gray-50 cursor-pointer hover:text-gray-900 transition-colors"
                                        onClick={() => handleSearch(t)}>
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
                                <button key={t}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-[12.5px] font-medium text-gray-600 cursor-pointer hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-all"
                                    onClick={() => handleSearch(t)}>
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