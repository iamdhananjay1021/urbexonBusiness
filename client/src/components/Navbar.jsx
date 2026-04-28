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
   NAVBAR COMPONENT
═══════════════════════════════════════════════════════ */
const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { locationData, modalOpen: locModalOpen, setModalOpen: setLocModalOpen } = useLocation2();
    const isAuth = Boolean(user);

    const isUH = location.pathname.startsWith("/urbexon-hour") || location.pathname.startsWith("/uh-");

    // Determine if the category bar should be visible based on the current route.
    const showCategoryBar = (() => {
        const path = location.pathname;

        // For Urbexon Hour, show on home and category pages.
        if (isUH) {
            return path === '/urbexon-hour' || /^\/urbexon-hour\/[a-zA-Z0-9-]+$/.test(path);
        }

        // For Ecommerce, show on home, products, category, and deals pages.
        const ecommerceAllowedPaths = ['/', '/products', '/deals'];
        return ecommerceAllowedPaths.includes(path) || path.startsWith('/category/');
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

    /* ── UH theme colors: clean indigo/violet instead of dark navy ── */
    const topBarBg = isUH ? "bg-violet-600" : "bg-[#2874f0]";
    const defaultTags = isUH
        ? ["Grocery", "Snacks", "Drinks", "Fresh", "Dairy", "Bakery"]
        : ["Mobile", "Laptop", "TV", "Fashion", "Shoes", "Watches"];

    return (
        <>
            {/* ══════════ DESKTOP TOP BAR ══════════ */}
            <div
                id="fk-desk-top"
                className={`hidden md:block fixed top-0 left-0 right-0 z-[600] transition-transform duration-300 ${topBarBg} ${navHidden ? "-translate-y-full" : "translate-y-0"}`}
            >
                <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-14 flex items-center gap-3">

                    {/* Logo */}
                    <button
                        className="flex items-end gap-1 bg-transparent border-none cursor-pointer flex-shrink-0 pr-2"
                        onClick={() => go(isUH ? "/urbexon-hour" : "/")}
                    >
                        <div>
                            <div className="text-xl font-extrabold text-white leading-none tracking-tight">
                                Urbexon
                                {isUH && <span className="text-yellow-300 ml-1">Hour</span>}
                            </div>
                            <div className="text-[9px] italic text-yellow-300 font-semibold mt-0.5">
                                {isUH ? "Express Delivery" : "Explore Plus"}
                            </div>
                        </div>
                    </button>

                    {/* Location */}
                    <button
                        className="hidden xl:flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded bg-transparent border-none flex-shrink-0 max-w-[180px] hover:bg-white/10 transition-colors"
                        onClick={() => setLocModalOpen(true)}
                    >
                        <FaMapMarkerAlt size={13} className="text-yellow-300 flex-shrink-0" />
                        <div className="text-left min-w-0">
                            <div className="text-[10px] font-semibold text-white/80 leading-none mb-0.5 flex items-center gap-1">
                                Deliver to <FaChevronDown size={7} />
                            </div>
                            <div className="text-xs font-bold text-white truncate max-w-[120px] leading-tight">
                                {locationData?.label || locationData?.city || "Select location"}
                            </div>
                        </div>
                    </button>

                    {/* Search */}
                    <div className="flex-1 max-w-[680px] relative">
                        <form
                            className="flex items-stretch bg-white rounded-sm overflow-hidden h-[38px] shadow focus-within:shadow-md transition-shadow"
                            onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }}
                        >
                            <input
                                className="flex-1 px-4 border-none outline-none text-[13.5px] font-medium text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                                placeholder={isUH ? "Search Urbexon Hour products…" : "Search for products, brands and more"}
                            />
                            {!!searchQuery && (
                                <button type="button" className="flex items-center justify-center bg-transparent border-none cursor-pointer px-2 text-gray-400 hover:text-gray-600"
                                    onClick={() => { setSearchQuery(""); setSuggestions([]); }}>
                                    <FaTimes size={13} />
                                </button>
                            )}
                            <button
                                type="submit"
                                className={`border-none cursor-pointer px-4 flex items-center gap-1.5 text-[13px] font-bold flex-shrink-0 transition-colors
                                    ${isUH ? "bg-violet-500 hover:bg-violet-600 text-white" : "bg-yellow-400 hover:bg-yellow-500 text-[#2874f0]"}`}
                            >
                                <FaSearch size={15} />
                                <span className="hidden lg:inline">Search</span>
                            </button>
                        </form>

                        {/* Suggestions */}
                        {searchFocused && (suggestions.length > 0 || (searchQuery.length < 2 && recentSearches.length > 0)) && (
                            <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white rounded shadow-xl z-[700] max-h-[400px] overflow-y-auto py-1.5 animate-[fadeDown_0.15s_ease]">
                                {suggestions.length > 0 ? (
                                    <>
                                        <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-gray-400 tracking-widest uppercase">Suggestions</div>
                                        {suggestions.map((s, i) => (
                                            <div key={s?._id || i}
                                                className="flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                                                onMouseDown={() => { navigate(isUH ? `/uh-product/${s.slug || s._id}` : `/products/${s.slug || s._id}`); setSuggestions([]); setSearchQuery(""); }}>
                                                <img className="w-9 h-9 rounded object-cover bg-gray-100 flex-shrink-0 border border-gray-200"
                                                    src={s?.images?.[0]?.url || "/placeholder.png"} alt={s?.name}
                                                    onError={(e) => { e.currentTarget.src = "/placeholder.png"; }} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[13px] font-medium text-gray-800 truncate">{s?.name}</div>
                                                    <div className="text-[11px] text-gray-500">{s?.brand || s?.category || "Product"}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-gray-400 tracking-widest uppercase">Recent</div>
                                        {recentSearches.slice(0, 6).map((t, i) => (
                                            <div key={i} className="flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
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

                    {/* UH Toggle */}
                    <button
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-bold text-xs cursor-pointer flex-shrink-0 whitespace-nowrap transition-all
                            ${isUH ? "bg-white text-violet-600 border-white" : "bg-white/10 text-white border-white/35 hover:bg-white/20 hover:border-white/60"}`}
                        onClick={() => navigate(isUH ? "/" : "/urbexon-hour")}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${isUH ? "bg-violet-500" : "bg-yellow-400"}`} />
                        <FaBolt size={12} />
                        <span className="hidden lg:inline">{isUH ? "Back to Store" : "Urbexon Hour"}</span>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                        {isAuth ? (
                            <>
                                {!isUH && (
                                    <>
                                        <button className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2.5 py-1.5 rounded text-[13px] font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                                            onClick={() => go("/wishlist")}>
                                            <FaHeart size={18} />
                                            <span className="hidden xl:inline text-[13px] font-semibold">Wishlist</span>
                                        </button>
                                        <NotificationCenter />
                                    </>
                                )}

                                {/* Cart */}
                                {isUH ? (
                                    <button className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2.5 py-1.5 rounded text-[13px] font-bold text-white relative hover:bg-white/10 transition-colors whitespace-nowrap"
                                        onClick={() => go("/uh-cart")}>
                                        <FaBolt size={18} className="text-yellow-300" />
                                        <span className="hidden xl:inline">UH Cart</span>
                                        {uhCount > 0 && <span className="absolute -top-0.5 right-0.5 min-w-[16px] h-4 bg-yellow-300 text-violet-700 rounded-full text-[9px] font-black flex items-center justify-center px-0.5">{uhCount > 9 ? "9+" : uhCount}</span>}
                                    </button>
                                ) : (
                                    <>
                                        {uhCount > 0 && (
                                            <button className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2.5 py-1.5 rounded text-white relative hover:bg-white/10 transition-colors"
                                                onClick={() => go("/uh-cart")}>
                                                <FaBolt size={18} className="text-yellow-300" />
                                                <span className="absolute -top-0.5 right-0.5 min-w-[15px] h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center px-0.5">{uhCount > 9 ? "9+" : uhCount}</span>
                                            </button>
                                        )}
                                        <button className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2.5 py-1.5 rounded text-[13px] font-bold text-white relative hover:bg-white/10 transition-colors whitespace-nowrap"
                                            onClick={() => go("/cart")}>
                                            <FaShoppingCart size={18} />
                                            <span className="hidden xl:inline">Cart</span>
                                            {ecoCount > 0 && <span className="absolute -top-0.5 right-0.5 min-w-[16px] h-4 bg-yellow-400 text-[#2874f0] rounded-full text-[9px] font-black flex items-center justify-center px-0.5">{ecoCount > 9 ? "9+" : ecoCount}</span>}
                                        </button>
                                    </>
                                )}

                                {/* User menu */}
                                <div className="relative" ref={userMenuRef}>
                                    <button className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2 py-1.5 rounded hover:bg-white/10 transition-colors"
                                        onClick={() => setUserMenuOpen((s) => !s)}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${isUH ? "bg-yellow-300 text-violet-700" : "bg-yellow-400 text-[#2874f0]"}`}>
                                            {getInitial(user?.name)}
                                        </div>
                                        <span className="hidden xl:block text-[13px] font-bold text-white max-w-[80px] truncate">{firstName(user?.name)}</span>
                                        <FaChevronDown size={10} className={`hidden xl:block text-white/70 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
                                    </button>

                                    {userMenuOpen && (
                                        <div className="absolute right-0 top-[calc(100%+8px)] bg-white rounded shadow-2xl min-w-[220px] z-[800] overflow-hidden border border-black/[0.08] animate-[dropDown_0.18s_ease]">
                                            <div className="px-4 py-4 bg-gradient-to-br from-[#2874f0] to-[#1a5dc8] flex items-center gap-2.5">
                                                <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-base font-extrabold text-[#2874f0] flex-shrink-0">{getInitial(user?.name)}</div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-white">{user?.name}</div>
                                                    <div className="text-[11px] text-white/60 break-all mt-0.5">{user?.email}</div>
                                                </div>
                                            </div>
                                            {[
                                                { icon: <FaUser size={13} />, label: "My Profile", path: "/profile", bg: "bg-blue-100 text-blue-600" },
                                                { icon: <FaBox size={13} />, label: "My Orders", path: "/orders", bg: "bg-green-100 text-green-700" },
                                                { icon: <FaHeart size={13} />, label: "Wishlist", path: "/wishlist", bg: "bg-red-100 text-red-600" },
                                            ].map(({ icon, label, path, bg }) => (
                                                <button key={path} className="flex items-center gap-2.5 px-4 py-3 bg-transparent border-none cursor-pointer w-full text-left text-[13px] font-medium text-gray-800 hover:bg-gray-50 hover:text-[#2874f0] transition-colors border-t border-gray-50"
                                                    onClick={() => go(path)}>
                                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>{icon}</span>
                                                    {label}
                                                </button>
                                            ))}
                                            <div className="h-px bg-gray-100" />
                                            <button className="flex items-center gap-2.5 px-4 py-3 bg-transparent border-none cursor-pointer w-full text-left text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100"
                                                onClick={handleLogout}>
                                                <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><FaSignOutAlt size={13} color="#ef4444" /></span>
                                                Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {isUH ? (
                                    <button className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2.5 py-1.5 rounded text-[13px] font-bold text-white relative hover:bg-white/10 whitespace-nowrap"
                                        onClick={() => go("/uh-cart")}>
                                        <FaBolt size={18} className="text-yellow-300" />
                                        <span className="hidden xl:inline">UH Cart</span>
                                        {uhCount > 0 && <span className="absolute -top-0.5 right-0.5 min-w-[16px] h-4 bg-yellow-300 text-violet-700 rounded-full text-[9px] font-black flex items-center justify-center px-0.5">{uhCount > 9 ? "9+" : uhCount}</span>}
                                    </button>
                                ) : (
                                    <button className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-2.5 py-1.5 rounded text-[13px] font-bold text-white relative hover:bg-white/10 whitespace-nowrap"
                                        onClick={() => go("/cart")}>
                                        <FaShoppingCart size={18} />
                                        <span className="hidden xl:inline">Cart</span>
                                        {ecoCount > 0 && <span className="absolute -top-0.5 right-0.5 min-w-[16px] h-4 bg-yellow-400 text-[#2874f0] rounded-full text-[9px] font-black flex items-center justify-center px-0.5">{ecoCount > 9 ? "9+" : ecoCount}</span>}
                                    </button>
                                )}
                                <button className="px-5 py-1.5 bg-white border-none rounded cursor-pointer text-[13px] font-bold text-[#2874f0] hover:bg-blue-50 transition-colors whitespace-nowrap"
                                    onClick={() => go("/login")}>Login</button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Desktop Category Bar ── */}
                {shouldShowCatBar && (
                    <div id="fk-desk-catbar" className={`border-b ${isUH ? "bg-violet-50 border-violet-200" : "bg-white border-gray-200"} shadow-sm`}>
                        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 flex items-center overflow-x-auto scrollbar-hide gap-0">
                            {isUH ? (
                                <>
                                    <button
                                        className={`px-5 py-2.5 bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0 text-[13px] font-medium border-b-[3px] transition-all flex items-center gap-1.5
                                            ${location.pathname === "/urbexon-hour" ? "text-violet-600 border-violet-600 font-bold" : "text-gray-700 border-transparent hover:text-violet-600 hover:border-violet-600"}`}
                                        onClick={() => navigate("/urbexon-hour")}
                                    >
                                        All <span className="bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">EXPRESS</span>
                                    </button>
                                    {uhCategories.map((cat) => (
                                        <button key={cat._id || cat.id}
                                            className={`px-5 py-2.5 bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0 text-[13px] font-medium border-b-[3px] transition-all flex items-center gap-1.5
                                                ${isUHCatActive(cat.slug) ? "text-violet-600 border-violet-600 font-bold" : "text-gray-700 border-transparent hover:text-violet-600 hover:border-violet-600"}`}
                                            onClick={() => navigate(uhCatPath(cat.slug))}>
                                            {cat.name}
                                            {cat.isFast && <span className="bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">FAST</span>}
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {ecoCategories.map((cat) => (
                                        <button key={cat._id || cat.id}
                                            className={`px-5 py-2.5 bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0 text-[13px] font-medium border-b-[3px] transition-all flex items-center gap-1.5
                                                ${isCatActive(cat.slug) ? "text-[#2874f0] border-[#2874f0] font-bold" : "text-gray-700 border-transparent hover:text-[#2874f0] hover:border-[#2874f0]"}`}
                                            onClick={() => navigate(`/category/${cat.slug}`)}>
                                            {cat.name}
                                            {cat.isHot && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">HOT</span>}
                                        </button>
                                    ))}
                                    <button
                                        className={`px-5 py-2.5 bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0 text-[13px] font-medium border-b-[3px] transition-all flex items-center gap-1.5
                                            ${location.pathname === "/deals" ? "text-[#2874f0] border-[#2874f0] font-bold" : "text-gray-700 border-transparent hover:text-[#2874f0] hover:border-[#2874f0]"}`}
                                        onClick={() => navigate("/deals")}>
                                        Deals <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">HOT</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ══════════ MOBILE NAVBAR ══════════ */}
            <div className={`md:hidden fixed top-0 left-0 right-0 z-[600] transition-transform duration-300 ${topBarBg} ${navHidden ? "-translate-y-full" : "translate-y-0"}`}>
                <div className="flex items-center gap-2 h-[54px] px-3">
                    <button className="flex items-end gap-0.5 bg-transparent border-none cursor-pointer flex-shrink-0" onClick={() => go(isUH ? "/urbexon-hour" : "/")}>
                        <span className="text-lg font-extrabold text-white tracking-tight">Urbexon</span>
                        {isUH && <span className="text-lg font-extrabold text-yellow-300 ml-1">Hour</span>}
                    </button>

                    <div className="flex-1 flex items-center bg-white rounded h-9 px-3 gap-2 cursor-pointer" onClick={() => setSearchOverlay(true)}>
                        <FaSearch size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="text-[13px] text-gray-400 truncate">{isUH ? "Search Urbexon Hour…" : "Search products, brands…"}</span>
                    </div>

                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {isUH ? (
                            <button className="w-10 h-10 border-none bg-transparent rounded flex items-center justify-center text-white cursor-pointer relative hover:bg-white/10 transition-colors"
                                onClick={() => go("/uh-cart")}>
                                <FaBolt size={18} />
                                {uhCount > 0 && <span className="absolute top-1 right-1 min-w-[15px] h-[15px] bg-yellow-300 text-violet-700 rounded-full text-[8px] font-black flex items-center justify-center px-0.5">{uhCount > 9 ? "9+" : uhCount}</span>}
                            </button>
                        ) : (
                            <>
                                {isAuth && <NotificationCenter variant="mobile" />}
                                {uhCount > 0 && (
                                    <button className="w-10 h-10 border-none bg-transparent rounded flex items-center justify-center text-white cursor-pointer relative hover:bg-white/10 transition-colors"
                                        onClick={() => go("/uh-cart")}>
                                        <FaBolt size={18} />
                                        <span className="absolute top-1 right-1 min-w-[15px] h-[15px] bg-red-500 text-white rounded-full text-[8px] font-black flex items-center justify-center px-0.5">{uhCount > 9 ? "9+" : uhCount}</span>
                                    </button>
                                )}
                                <button className="w-10 h-10 border-none bg-transparent rounded flex items-center justify-center text-white cursor-pointer relative hover:bg-white/10 transition-colors"
                                    onClick={() => go("/cart")}>
                                    <FaShoppingCart size={18} />
                                    {ecoCount > 0 && <span className="absolute top-1 right-1 min-w-[15px] h-[15px] bg-yellow-400 text-[#2874f0] rounded-full text-[8px] font-black flex items-center justify-center px-0.5">{ecoCount > 9 ? "9+" : ecoCount}</span>}
                                </button>
                            </>
                        )}
                        <button className="w-10 h-10 border-none bg-transparent rounded flex items-center justify-center text-white cursor-pointer hover:bg-white/10 transition-colors"
                            onClick={() => setMobileMenuOpen((s) => !s)}>
                            <FaBars size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════════ SPACERS ══════════ */}
            <div className="hidden md:block" style={{ height: shouldShowCatBar ? "calc(56px + 44px)" : "56px" }} />
            <div className="md:hidden h-[54px]" />

            {/* ══════════ MOBILE BOTTOM NAV ══════════ */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-[600] bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
                <div className="flex items-stretch h-14">
                    {[
                        { icon: <FaHome size={18} />, label: "Home", path: "/" },
                        { icon: <FaTag size={18} />, label: "Deals", path: "/deals" },
                        { icon: <FaBolt size={18} />, label: "UH", path: isUH ? "/" : "/urbexon-hour", isUHBtn: true },
                        { icon: <FaHeart size={18} />, label: "Wishlist", path: "/wishlist" },
                    ].map(({ icon, label, path, isUHBtn }) => {
                        const active = isUHBtn ? isUH : location.pathname === path;
                        return (
                            <button key={label}
                                className={`flex-1 flex flex-col items-center justify-center gap-0.5 bg-transparent border-none cursor-pointer text-[9.5px] font-semibold transition-colors
                                    ${active ? (isUHBtn ? "text-violet-600" : "text-[#2874f0]") : "text-gray-500 hover:text-[#2874f0]"}`}
                                onClick={() => navigate(path)}>
                                {icon}
                                <span>{label}</span>
                            </button>
                        );
                    })}
                    <button
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 bg-transparent border-none cursor-pointer text-[9.5px] font-semibold transition-colors
                            ${["/profile", "/login"].includes(location.pathname) ? "text-[#2874f0]" : "text-gray-500 hover:text-[#2874f0]"}`}
                        onClick={() => go(isAuth ? "/profile" : "/login")}>
                        <FaUser size={18} />
                        <span>{isAuth ? "Account" : "Login"}</span>
                    </button>
                </div>
            </div>

            {/* ══════════ MOBILE BACKDROP ══════════ */}
            <div
                className={`fixed inset-0 bg-black/50 z-[900] transition-opacity duration-250 ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={() => setMobileMenuOpen(false)}
            />

            {/* ══════════ MOBILE SLIDE MENU ══════════ */}
            <div className={`fixed top-0 left-0 bottom-0 w-[min(80vw,300px)] bg-white z-[901] flex flex-col shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
                {isAuth ? (
                    <div className="relative bg-gradient-to-br from-[#2874f0] to-[#1a5dc8] px-4 py-5 flex items-center gap-3">
                        <div className="w-[42px] h-[42px] rounded-full bg-yellow-400 flex items-center justify-center text-lg font-extrabold text-[#2874f0] flex-shrink-0">{getInitial(user?.name)}</div>
                        <div className="min-w-0">
                            <div className="text-[15px] font-bold text-white leading-tight">{user?.name}</div>
                            <div className="text-[11px] text-white/55 break-all mt-0.5">{user?.email}</div>
                        </div>
                        <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/15 border-none text-white cursor-pointer flex items-center justify-center hover:bg-white/25 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}><FaTimes size={14} /></button>
                    </div>
                ) : (
                    <div className="relative bg-gradient-to-br from-[#2874f0] to-[#1a5dc8] px-4 py-5">
                        <div className="text-base font-bold text-white mb-3">Welcome to Urbexon!</div>
                        <div className="flex gap-2">
                            <button className="flex-1 h-9 rounded bg-yellow-400 border-none text-xs font-bold text-[#2874f0] cursor-pointer hover:bg-yellow-300 transition-colors"
                                onClick={() => go("/login")}>Login</button>
                            <button className="flex-1 h-9 rounded bg-transparent border border-white/40 text-xs font-bold text-white cursor-pointer hover:border-white transition-colors"
                                onClick={() => go("/register")}>Register</button>
                        </div>
                        <button className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/15 border-none text-white cursor-pointer flex items-center justify-center hover:bg-white/25 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}><FaTimes size={14} /></button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {isAuth && (
                        <>
                            <div className="px-4 pt-3.5 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-t border-gray-100">My Account</div>
                            {[
                                { icon: <FaUser size={13} />, label: "My Profile", path: "/profile", bg: "bg-blue-100 text-[#2874f0]" },
                                { icon: <FaBox size={13} />, label: "My Orders", path: "/orders", bg: "bg-green-100 text-green-700" },
                                { icon: <FaHeart size={13} />, label: "My Wishlist", path: "/wishlist", bg: "bg-red-100 text-red-600" },
                            ].map(({ icon, label, path, bg }) => (
                                <div key={path} className="min-h-[46px] px-4 flex items-center justify-between gap-2.5 cursor-pointer bg-white border-t border-gray-50 hover:bg-gray-50 transition-colors text-[13.5px] font-medium text-gray-800"
                                    onClick={() => go(path)}>
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>{icon}</span>
                                        <span>{label}</span>
                                    </div>
                                    <FaChevronRight size={11} className="text-gray-300" />
                                </div>
                            ))}
                        </>
                    )}

                    <div className="px-4 pt-3.5 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-t border-gray-100">Location</div>
                    <div className="min-h-[46px] px-4 flex items-center justify-between gap-2.5 cursor-pointer bg-white border-t border-gray-50 hover:bg-gray-50 transition-colors text-[13.5px] font-medium text-gray-800"
                        onClick={() => { setMobileMenuOpen(false); setLocModalOpen(true); }}>
                        <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0"><FaMapMarkerAlt size={13} /></span>
                            <span>{locationData?.label || locationData?.city || "Set Location"}</span>
                        </div>
                        <FaChevronRight size={11} className="text-gray-300" />
                    </div>

                    <div className="px-4 pt-3.5 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-t border-gray-100">
                        {isUH ? "Urbexon Hour" : "Shop by Category"}
                    </div>

                    {isUH ? (
                        <>
                            <div className="min-h-[46px] px-4 flex items-center justify-between gap-2.5 cursor-pointer bg-white border-t border-gray-50 hover:bg-gray-50 transition-colors"
                                onClick={() => go("/urbexon-hour")}>
                                <div className="flex items-center gap-2.5">
                                    <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0"><FaBolt size={13} /></span>
                                    <span className="text-[13.5px] font-medium text-gray-800">All UH Products</span>
                                </div>
                                <FaChevronRight size={11} className="text-gray-300" />
                            </div>
                            {uhCategories.map((cat) => (
                                <div key={cat._id || cat.id} className="min-h-[46px] px-4 flex items-center justify-between gap-2.5 cursor-pointer bg-white border-t border-gray-50 hover:bg-gray-50 transition-colors"
                                    onClick={() => go(uhCatPath(cat.slug))}>
                                    <span className="text-[13.5px] font-medium text-gray-800 truncate">{cat.name}</span>
                                    <FaChevronRight size={11} className="text-gray-300" />
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            {ecoCategories.map((cat) => (
                                <div key={cat._id || cat.id} className="min-h-[46px] px-4 flex items-center justify-between gap-2.5 cursor-pointer bg-white border-t border-gray-50 hover:bg-gray-50 transition-colors"
                                    onClick={() => go(`/category/${cat.slug}`)}>
                                    <span className="text-[13.5px] font-medium text-gray-800 truncate">{cat.name}</span>
                                    <FaChevronRight size={11} className="text-gray-300" />
                                </div>
                            ))}
                            <div className="min-h-[46px] px-4 flex items-center justify-between gap-2.5 cursor-pointer bg-white border-t border-gray-50 hover:bg-gray-50 transition-colors"
                                onClick={() => go("/deals")}>
                                <div className="flex items-center gap-2.5">
                                    <span className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0"><FaTag size={13} /></span>
                                    <span className="text-[13.5px] font-medium text-gray-800">Deals &amp; Offers</span>
                                </div>
                                <FaChevronRight size={11} className="text-gray-300" />
                            </div>
                        </>
                    )}

                    <div className="px-4 pt-3.5 pb-1.5 text-[10px] font-bold text-gray-400 tracking-[1.5px] uppercase bg-gray-50 border-t border-gray-100">Switch Mode</div>
                    <div className={`min-h-[46px] px-4 flex items-center justify-between gap-2.5 cursor-pointer border-t border-gray-50 transition-colors ${isUH ? "bg-blue-50 hover:bg-blue-100" : "bg-violet-50 hover:bg-violet-100"}`}
                        onClick={() => go(isUH ? "/" : "/urbexon-hour")}>
                        <div className="flex items-center gap-2.5">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isUH ? "bg-blue-100 text-[#2874f0]" : "bg-violet-100 text-violet-600"}`}>
                                {isUH ? <FaShoppingCart size={13} /> : <FaBolt size={13} />}
                            </span>
                            <span className={`text-[13.5px] font-semibold ${isUH ? "text-[#2874f0]" : "text-violet-600"}`}>
                                {isUH ? "Back to Store" : "Urbexon Hour — 45min Delivery"}
                            </span>
                        </div>
                        <FaChevronRight size={11} className="text-gray-300" />
                    </div>

                    {isAuth && (
                        <>
                            <div className="px-4 pt-3.5 pb-1.5 bg-gray-50 border-t border-gray-100" />
                            <div className="min-h-[46px] px-4 flex items-center gap-2.5 cursor-pointer bg-white border-t border-gray-100 hover:bg-red-50 transition-colors text-[13.5px] font-semibold text-red-500"
                                onClick={handleLogout}>
                                <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><FaSignOutAlt size={13} color="#ef4444" /></span>
                                Logout
                            </div>
                        </>
                    )}
                    <div className="h-5" />
                </div>
            </div>

            {/* ══════════ MOBILE SEARCH OVERLAY ══════════ */}
            {searchOverlay && (
                <div className="fixed inset-0 z-[950] bg-white animate-[fadeIn_0.15s_ease]">
                    <div className={`${topBarBg} flex items-center gap-2 px-3 h-[54px]`}>
                        <button className="w-9 h-9 bg-transparent border-none text-white cursor-pointer flex items-center justify-center flex-shrink-0 rounded-full hover:bg-white/10 transition-colors"
                            onClick={() => setSearchOverlay(false)}>
                            <FaArrowLeft size={16} />
                        </button>
                        <form className="flex-1 flex items-stretch bg-white rounded overflow-hidden h-[38px]"
                            onSubmit={(e) => { e.preventDefault(); handleSearch(mobileSearch); }}>
                            <input ref={mobileSearchRef}
                                className="flex-1 px-3.5 border-none outline-none text-[15px] font-medium text-gray-800"
                                type="text" value={mobileSearch} onChange={(e) => setMobileSearch(e.target.value)}
                                placeholder={isUH ? "Search Urbexon Hour…" : "Search products, brands…"} />
                            <button type="submit" className={`border-none px-3.5 cursor-pointer flex items-center ${isUH ? "bg-violet-500 text-white" : "bg-yellow-400 text-[#2874f0]"}`}>
                                <FaSearch size={15} />
                            </button>
                        </form>
                    </div>
                    <div className="p-4">
                        {recentSearches.length > 0 ? (
                            <>
                                <div className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-2.5">Recent Searches</div>
                                {recentSearches.slice(0, 6).map((t, i) => (
                                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 cursor-pointer hover:text-[#2874f0] transition-colors"
                                        onClick={() => handleSearch(t)}>
                                        <FaSearch size={12} className="text-gray-300 flex-shrink-0" />
                                        <span className="text-[13.5px] font-medium text-gray-700">{t}</span>
                                    </div>
                                ))}
                                <div className="h-4" />
                            </>
                        ) : null}
                        <div className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-3">Trending</div>
                        <div className="flex flex-wrap gap-2">
                            {defaultTags.map((t) => (
                                <button key={t}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-[12.5px] font-medium text-gray-600 cursor-pointer hover:bg-blue-50 hover:border-[#2874f0] hover:text-[#2874f0] transition-all"
                                    onClick={() => handleSearch(t)}>
                                    <FaSearch size={10} />{t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {locModalOpen && <LocationModal onClose={() => setLocModalOpen(false)} />}

            <style>{`
                @keyframes dropDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes fadeDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
                .scrollbar-hide::-webkit-scrollbar { display:none; }
                .scrollbar-hide { scrollbar-width: none; }
            `}</style>
        </>
    );
};

export default Navbar;
