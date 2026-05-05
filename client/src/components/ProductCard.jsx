/**
 * ProductCard.jsx — Final Production Version
 * Pure Tailwind · Fixed image height · OOS bug fixed · Full body always visible
 * BUG FIXES: null safety for product, stock handling, navigation URL fallback
 * UI: Preserved original styling - no visual changes
 */
import { useState, useCallback, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import { useAuth } from "../contexts/AuthContext";
import {
    FaStar, FaShoppingCart, FaBolt,
    FaCheckCircle, FaHeart, FaRegHeart, FaBell,
} from "react-icons/fa";
import { imgUrl } from "../utils/imageUrl";
import api from "../api/axios";

const ProductCard = memo(({ product, onAddToCart, onBuyNow, hideActions = false, footer }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { cartItems, addItem } = useCart();

    // ═══════════════════════════════════════════════════════
    // NULL SAFETY - Guard against null/undefined product
    // BUG FIX: Prevent crash when product is null/undefined
    // ═══════════════════════════════════════════════════════
    if (!product) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col w-full h-[280px]">
                <div className="h-[170px] sm:h-[190px] lg:h-[210px] bg-[#ede9e4] animate-pulse shrink-0" />
                <div className="px-2.5 pt-2 pb-1 sm:px-3 sm:pt-2.5 flex flex-col gap-1.5">
                    <div className="h-2 w-1/3 bg-[#ede9e4] rounded animate-pulse" />
                    <div className="h-3 bg-[#ede9e4] rounded animate-pulse" />
                    <div className="h-3 w-4/5 bg-[#ede9e4] rounded animate-pulse" />
                    <div className="h-4 w-2/5 bg-[#ede9e4] rounded animate-pulse mt-1" />
                </div>
            </div>
        );
    }

    // BUG FIX: Handle both _id and id fields
    const productId = product._id || product.id || "";
    const { inWishlist, toggle: toggleWish } = useWishlist(productId);

    // BUG FIX: Check cart correctly with productId fallback
    const inCart = cartItems.some(i => i._id === productId || i.productId === productId);

    const [flash, setFlash] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [notifyInput, setNotifyInput] = useState(false);
    const [notifyEmail, setNotifyEmail] = useState("");
    const [notifyLoading, setNotifyLoading] = useState(false);
    const [notifyDone, setNotifyDone] = useState(() => {
        try { return productId && localStorage.getItem(`notify_${productId}`) === "1"; } catch { return false; }
    });

    /* ── Image ── */
    const image = imgUrl.card(product?.images?.[0]?.url || product?.image || "");

    /* ── Stock — FIXED: Calculate real data from all variants (sizes/colors) ── */
    const getStock = (p) => {
        if (!p) return 0;

        let calculatedStock = 0;
        let hasVariantStock = false;

        if (p.sizes && p.sizes.length > 0) {
            calculatedStock = p.sizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
            hasVariantStock = true;
        } else if (p.colorVariants && p.colorVariants.length > 0 && p.colorVariants.some(v => v.stock !== undefined)) {
            calculatedStock = p.colorVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
            hasVariantStock = true;
        }

        if (hasVariantStock) return calculatedStock;

        if (p.inStock === true && (p.stock === undefined || p.stock === null)) return 10;
        return Number(p.stock || 0);
    }
    const stockNum = getStock(product);

    // BUG FIX: Consistent OOS logic
    const isOOS = product.inStock === false || stockNum <= 0;
    const isLowStock = !isOOS && stockNum > 0 && stockNum <= 5;

    /* ── Numbers ── */
    const rating = Number(product.rating || 0);
    const numReviews = Number(product.numReviews || 0);
    const price = Number(product.price || 0);
    const mrp = Number(product.mrp || product.originalPrice || product.compareAtPrice || 0);
    const hasDisc = mrp > price && mrp > 0;
    const discPct = hasDisc ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const saving = hasDisc ? mrp - price : 0;

    // BUG FIX: Ensure productUrl always has valid fallback
    const productUrl = `/products/${product.slug || productId}`;

    /* ── Handlers ── */
    const handleCart = useCallback(e => {
        e.stopPropagation();
        if (inCart || isOOS) return;
        if (onAddToCart) onAddToCart(product); else addItem(product);
        setFlash(true); setTimeout(() => setFlash(false), 1400);
    }, [inCart, isOOS, onAddToCart, product, addItem]);

    const handleBuy = useCallback(e => {
        e.stopPropagation();
        if (isOOS) return;
        if (onBuyNow) { onBuyNow(product); return; }
        const item = { ...product, quantity: 1 };
        try { sessionStorage.setItem("ux_buy_now_item", JSON.stringify(item)); } catch { }
        navigate("/checkout", { state: { buyNowItem: item } });
    }, [isOOS, onBuyNow, product, navigate]);

    const handleWish = useCallback(e => {
        e.stopPropagation();
        if (!user) {
            navigate("/login", { state: { from: location.pathname } });
            return;
        }
        toggleWish();
    }, [user, navigate, location.pathname, toggleWish]);

    const handleNotify = useCallback(async e => {
        e.stopPropagation();
        if (!notifyInput) { setNotifyInput(true); return; }
        if (!notifyEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) return;
        try {
            setNotifyLoading(true);
            await api.post("/stock-notify/subscribe", { productId: productId, email: notifyEmail.trim() });
            setNotifyDone(true); setNotifyInput(false);
            try { localStorage.setItem(`notify_${productId}`, "1"); } catch { }
        } catch { } finally { setNotifyLoading(false); }
    }, [notifyInput, notifyEmail, productId]);

    const cartCls = inCart
        ? "bg-green-50 text-green-700 border border-green-200 cursor-default"
        : flash ? "bg-green-500 text-white"
            : "bg-[#1c1917] text-white hover:bg-[#2d2926]";
    const mobCartCls = inCart
        ? "bg-green-50 text-green-700 cursor-default"
        : flash ? "bg-green-500 text-white"
            : "bg-[#1c1917] text-white";

    return (
        <div
            onClick={() => navigate(productUrl)}
            className="group relative flex flex-col w-full bg-white border border-stone-200 rounded-xl
        overflow-hidden cursor-pointer transition-all duration-200 
        hover:-translate-y-1 hover:shadow-lg
        hover:border-amber-400 active:scale-[0.99]"
        >
            {/* Wishlist */}
            <button onClick={handleWish} aria-label="Wishlist"
                className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90
          backdrop-blur-sm flex items-center justify-center shadow-sm
          transition-all hover:scale-110 hover:bg-white">
                {inWishlist
                    ? <FaHeart size={12} className="text-red-500" />
                    : <FaRegHeart size={12} className="text-stone-400" />}
            </button>

            {/* ─── IMAGE — fixed height, never overflows ─── */}
            <div className="relative bg-stone-100 aspect-square shrink-0 overflow-hidden">
                {!imgLoaded && <div className="absolute inset-0 bg-[#ede9e4] animate-pulse" />}
                <img
                    src={image} alt={product.name}
                    loading="lazy" decoding="async"
                    onLoad={() => setImgLoaded(true)}
                    onError={e => { e.target.src = "/placeholder.png"; setImgLoaded(true); }}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105
            ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                />

                {/* Discount pill */}
                {hasDisc && !isOOS && (
                    <span className="absolute top-2 left-2 z-[2] bg-red-500 text-white
            text-[10px] font-bold px-2 py-1 rounded-md">
                        -{discPct}%
                    </span>
                )}
                {/* Low stock */}
                {isLowStock && (
                    <span className="absolute bottom-2 left-2 z-[2] bg-amber-500 text-white
            text-[10px] font-bold px-2 py-1 rounded-md">
                        ⚡ {stockNum} left
                    </span>
                )}

                {/* OOS overlay */}
                {isOOS && (
                    <div className="absolute inset-0 z-[4] bg-black/52 backdrop-blur-[1px]
            flex flex-col items-center justify-center gap-2">
                        <span className="bg-black/65 text-white text-[11px] font-extrabold
              tracking-[0.13em] uppercase border border-white/20 px-3.5 py-1.5">
                            Out of Stock
                        </span>
                        {notifyDone ? (
                            <span className="flex items-center gap-1 text-lime-400 text-[9px] font-bold tracking-wide">
                                <FaBell size={9} /> We'll notify you
                            </span>
                        ) : notifyInput ? (
                            <div className="flex w-[80%] max-w-[200px]" onClick={e => e.stopPropagation()}>
                                <input
                                    className="flex-1 min-w-0 px-2 py-1.5 text-[10px] outline-none
                    bg-white text-[#1c1917] placeholder:text-stone-400"
                                    type="email" placeholder="your@email.com"
                                    value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleNotify(e)} autoFocus
                                />
                                <button onClick={handleNotify} disabled={notifyLoading}
                                    className="px-2.5 bg-[#1c1917] text-white text-[9px] font-extrabold
                    disabled:opacity-60 hover:bg-[#2d2926] transition-colors">
                                    {notifyLoading ? "…" : "GO"}
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleNotify}
                                className="flex items-center gap-1.5 bg-white text-[#1c1917]
                  text-[9px] font-extrabold tracking-wide uppercase px-3 py-1.5
                  hover:bg-stone-100 transition-colors">
                                <FaBell size={9} /> Notify Me
                            </button>
                        )}
                    </div>
                )}

            </div>

            {/* ─── BODY — always fully visible ─── */}
            <div className="flex flex-col flex-1 min-w-0 px-2.5 pt-2 pb-1 sm:px-3 sm:pt-2.5">
                {/* Category */}
                <p className="text-[7.5px] sm:text-[8px] font-extrabold tracking-[0.14em] uppercase
          text-[#c8a96e] truncate mb-0.5">
                    {product.category || "General"}{product.brand ? ` · ${product.brand}` : ""}
                </p>

                {/* Name */}
                <h3 className="text-[11px] sm:text-[12px] font-medium text-[#1c1917]
          leading-[1.35] line-clamp-2 min-h-[2.7em] mb-1 break-words">
                    {product.name}
                </h3>

                {/* Rating */}
                {numReviews > 0 ? (
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="flex items-center gap-[3px] bg-[#388e3c] text-white
              text-[8.5px] font-bold px-1.5 py-[2px] rounded-[3px]">
                            {rating.toFixed(1)} <FaStar size={7} />
                        </span>
                        <span className="text-[9.5px] text-[#a8a29e]">({numReviews.toLocaleString()} reviews)</span>
                    </div>
                ) : (
                    <div className="mb-1 h-[16px] text-[9.5px] text-[#a8a29e] flex items-center">No reviews yet</div>
                )}

                {/* Stock status */}
                <div className="flex items-center gap-1.5 mb-1.5 text-[8.5px] font-bold">
                    {isOOS
                        ? <><span className="w-[5px] h-[5px] rounded-full bg-stone-300 shrink-0" /><span className="text-stone-400">Out of Stock</span></>
                        : isLowStock
                            ? <><span className="w-[5px] h-[5px] rounded-full bg-amber-500 shrink-0" /><span className="text-amber-700">Only {stockNum} left</span></>
                            : <><span className="w-[5px] h-[5px] rounded-full bg-green-500 shrink-0 animate-pulse" /><span className="text-green-700">In Stock</span></>
                    }
                </div>

                {/* Price */}
                <div className="mt-auto pb-2">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`text-[14px] sm:text-[15px] font-bold
              font-['Cormorant_Garamond',serif]
              ${isOOS ? "text-stone-400" : "text-[#1c1917]"}`}>
                            ₹{price.toLocaleString("en-IN")}
                        </span>
                        {hasDisc && !isOOS && (
                            <span className="text-[9.5px] text-stone-400 line-through">
                                ₹{mrp.toLocaleString("en-IN")}
                            </span>
                        )}
                    </div>
                    {hasDisc && !isOOS && saving > 0 && (
                        <p className="text-[8.5px] sm:text-[9px] font-bold text-green-700 mt-0.5">
                            Save ₹{saving.toLocaleString("en-IN")}
                        </p>
                    )}
                </div>
            </div>

            {/* ─── MOBILE CTA BAR ─── */}
            {!hideActions && (
                <div className="flex border-t border-[#e7e5e1] md:hidden shrink-0">
                    {isOOS ? (
                        <button onClick={handleNotify}
                            className="flex-1 flex items-center justify-center gap-1.5
                py-2.5 text-[9px] font-extrabold tracking-wide bg-[#1c1917] text-white">
                            <FaBell size={9} />{notifyDone ? "Subscribed ✓" : "Notify Me"}
                        </button>
                    ) : (
                        <>
                            <button onClick={handleCart} disabled={inCart}
                                className={`flex-1 flex items-center justify-center gap-1
                  py-2.5 text-[9px] font-extrabold tracking-wide
                  border-r border-[#e7e5e1] transition-colors ${mobCartCls}`}>
                                {inCart ? <><FaCheckCircle size={8} /> Added</>
                                    : flash ? <>✓</>
                                        : <><FaShoppingCart size={8} /> Add</>}
                            </button>
                            <button onClick={handleBuy}
                                className="flex-1 flex items-center justify-center gap-1
                  py-2.5 text-[9px] font-extrabold tracking-wide
                  bg-[#c8a96e] text-white hover:bg-[#a8894e] transition-colors">
                                <FaBolt size={8} /> Buy
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
});

ProductCard.displayName = "ProductCard";
export default ProductCard;
