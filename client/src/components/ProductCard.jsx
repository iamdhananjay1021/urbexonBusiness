/**
 * ProductCard.jsx — Premium Redesign
 * aspect-[4/3] image (wider/shorter) · hover elevation · capitalize name
 * All hooks/handlers/OOS logic UNCHANGED
 */
import { useState, useCallback, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import { useAuth } from "../contexts/AuthContext";
import {
    FaStar, FaStarHalfAlt, FaRegStar,
    FaShoppingCart, FaBolt,
    FaCheckCircle, FaHeart, FaRegHeart, FaBell,
} from "react-icons/fa";
import { imgUrl } from "../utils/imageUrl";
import api from "../api/axios";

const StarRating = ({ rating }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) stars.push(<FaStar key={i} size={10} />);
        else if (i === Math.ceil(rating) && rating % 1 >= 0.4) stars.push(<FaStarHalfAlt key={i} size={10} />);
        else stars.push(<FaRegStar key={i} size={10} />);
    }
    return <>{stars}</>;
};

const ProductCard = memo(({ product, onAddToCart, onBuyNow, hideActions = false, footer }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { cartItems, addItem } = useCart();

    /* ── skeleton ── */
    if (!product) {
        return (
            <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col w-full h-full">
                <div className="w-full aspect-[4/5] sm:aspect-[4/3] bg-[#f0ede8] animate-pulse" />
                <div className="px-3 pt-3 pb-4 sm:px-4 flex flex-col gap-2">
                    <div className="h-2 w-1/3 bg-[#ede9e4] rounded animate-pulse" />
                    <div className="h-3 bg-[#ede9e4] rounded animate-pulse" />
                    <div className="h-3 w-4/5 bg-[#ede9e4] rounded animate-pulse" />
                    <div className="h-6 w-2/5 bg-[#ede9e4] rounded animate-pulse mt-1" />
                </div>
            </div>
        );
    }

    const productId = product._id || product.id || "";
    const { inWishlist, toggle: toggleWish } = useWishlist(productId);
    const inCart = cartItems.some(i => i._id === productId || i.productId === productId);

    const [flash, setFlash] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [notifyInput, setNotifyInput] = useState(false);
    const [notifyEmail, setNotifyEmail] = useState("");
    const [notifyLoading, setNotifyLoading] = useState(false);
    const [notifyDone, setNotifyDone] = useState(() => {
        try { return productId && localStorage.getItem(`notify_${productId}`) === "1"; } catch { return false; }
    });

    const image = imgUrl.card(product?.images?.[0]?.url || product?.image || "");

    /* ── stock ── */
    const getStock = (p) => {
        if (!p) return 0;
        let calc = 0, hasV = false;
        if (p.sizes?.length > 0) {
            calc = p.sizes.reduce((s, x) => s + (Number(x.stock) || 0), 0); hasV = true;
        } else if (p.colorVariants?.length > 0 && p.colorVariants.some(v => v.stock !== undefined)) {
            calc = p.colorVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0); hasV = true;
        }
        if (hasV) return calc;
        if (p.inStock === true && p.stock == null) return 10;
        return Number(p.stock || 0);
    };

    const stockNum = getStock(product);
    const isOOS = product.inStock === false || stockNum <= 0;
    const isLowStock = !isOOS && stockNum > 0 && stockNum <= 5;
    const hasVariants = !!(product?.sizes?.length > 0 || product?.colorVariants?.length > 0);
    const isUH = product.productType === "urbexon_hour";

    const rating = Number(product.rating || 0);
    const numReviews = Number(product.numReviews || 0);
    const price = Number(product.price || 0);
    const mrp = Number(product.mrp || product.originalPrice || product.compareAtPrice || 0);
    const hasDisc = mrp > price && mrp > 0;
    const discPct = hasDisc ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const savedAmt = hasDisc ? (mrp - price).toLocaleString("en-IN") : 0;
    const productUrl = `/products/${product.slug || productId}`;

    /* ── handlers (all unchanged) ── */
    const handleCart = useCallback(e => {
        e.stopPropagation();
        if (hasVariants) { navigate(productUrl); return; }
        if (inCart || isOOS) return;
        if (onAddToCart) onAddToCart(product); else addItem(product);
        setFlash(true); setTimeout(() => setFlash(false), 1400);
    }, [inCart, isOOS, onAddToCart, product, addItem]);

    const handleBuy = useCallback(e => {
        e.stopPropagation();
        if (hasVariants) { navigate(productUrl); return; }
        if (isOOS) return;
        if (onBuyNow) { onBuyNow(product); return; }
        const item = { ...product, quantity: 1 };
        try { sessionStorage.setItem("ux_buy_now_item", JSON.stringify(item)); } catch { }
        navigate("/checkout", { state: { buyNowItem: item } });
    }, [isOOS, onBuyNow, product, navigate]);

    const handleWish = useCallback(e => {
        e.stopPropagation();
        if (!user) { navigate("/login", { state: { from: location.pathname } }); return; }
        toggleWish();
    }, [user, navigate, location.pathname, toggleWish]);

    const handleNotify = useCallback(async e => {
        e.stopPropagation();
        if (!notifyInput) { setNotifyInput(true); return; }
        if (!notifyEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) return;
        try {
            setNotifyLoading(true);
            await api.post("/stock-notify/subscribe", { productId, email: notifyEmail.trim() });
            setNotifyDone(true); setNotifyInput(false);
            try { localStorage.setItem(`notify_${productId}`, "1"); } catch { }
        } catch { } finally { setNotifyLoading(false); }
    }, [notifyInput, notifyEmail, productId]);

    return (
        <div
            onClick={() => navigate(productUrl)}
            className="group relative flex flex-col w-full h-full bg-white
                       rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer
                       border border-[#ebebeb]
                       shadow-[0_2px_8px_rgba(0,0,0,0.06)]
                       hover:shadow-[0_12px_40px_rgba(0,0,0,0.13)]
                       hover:-translate-y-1
                       transition-all duration-300 ease-out
                       active:scale-[0.985]"
        >
            {/* ── Wishlist ── */}
            <button
                onClick={handleWish}
                aria-label="Wishlist"
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full
                           bg-white shadow-md flex items-center justify-center
                           border border-[#f0f0f0]
                           transition-all duration-200 hover:scale-110"
            >
                {inWishlist
                    ? <FaHeart size={12} className="text-red-500" />
                    : <FaRegHeart size={12} className="text-[#aaa]" />}
            </button>

            {/* ── Urbexon Hour badge ── */}
            {isUH && (
                <span className="absolute top-3 left-3 z-10 bg-violet-600 text-white
                                 text-[9px] font-extrabold px-2 py-1 rounded-full
                                 flex items-center gap-1 tracking-wide shadow-md">
                    <FaBolt size={7} /> 45 MIN
                </span>
            )}

            {/* ══════════════════════════════════════
                IMAGE
            ══════════════════════════════════════ */}
            <div className="relative aspect-[4/5] sm:aspect-[4/3] w-full shrink-0 overflow-hidden
                            bg-gradient-to-b from-[#f7f7f7] to-[#efefef]">

                {!imgLoaded && (
                    <div className="absolute inset-0 bg-[#ece8e3] animate-pulse" />
                )}
                <img
                    src={image}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setImgLoaded(true)}
                    onError={e => { e.target.src = "/placeholder.png"; setImgLoaded(true); }}
                    className={`absolute inset-0 w-full h-full object-contain px-2 pb-2 pt-11 sm:px-5 sm:pb-5 sm:pt-12
                                mix-blend-multiply
                                transition-transform duration-500 ease-out
                                group-hover:scale-[1.06]
                                ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                />

                {/* Discount badge — top-left flush corner */}
                {hasDisc && !isOOS && (
                    <span className={`absolute ${isUH ? "top-9" : "top-0"} left-0 z-[2]
                                     bg-[#CC0C39] text-white
                                     text-[10px] font-semibold tracking-wide
                                     px-2.5 py-[5px]
                                     rounded-br-2xl`}>
                        {discPct}% off
                    </span>
                )}

                {/* Low stock */}
                {isLowStock && (
                    <span className="absolute bottom-2.5 left-3 z-[2]
                                     bg-amber-500 text-white text-[10px] font-bold
                                     px-2.5 py-1 rounded-full shadow">
                        ⚡ Only {stockNum} left
                    </span>
                )}

                {/* OOS overlay */}
                {isOOS && (
                    <div className="absolute inset-0 z-[4] bg-black/45 backdrop-blur-[2px]
                                    flex flex-col items-center justify-center gap-3">
                        <span className="bg-black/70 text-white text-[11px] font-extrabold
                                         tracking-[0.15em] uppercase border border-white/20
                                         px-4 py-2 rounded-full">
                            Out of Stock
                        </span>
                        {notifyDone ? (
                            <span className="flex items-center gap-1 text-lime-400 text-[10px] font-bold">
                                <FaBell size={9} /> We'll notify you
                            </span>
                        ) : notifyInput ? (
                            <div className="flex w-[80%] max-w-[210px] rounded-full overflow-hidden
                                            border border-white/30 shadow-lg"
                                onClick={e => e.stopPropagation()}>
                                <input
                                    className="flex-1 min-w-0 px-3 py-1.5 text-[11px] outline-none
                                               bg-white text-[#1c1917] placeholder:text-stone-400"
                                    type="email" placeholder="your@email.com"
                                    value={notifyEmail}
                                    onChange={e => setNotifyEmail(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleNotify(e)}
                                    autoFocus
                                />
                                <button
                                    onClick={handleNotify}
                                    disabled={notifyLoading}
                                    className="px-3 bg-[#1c1917] text-white text-[9px] font-extrabold
                                               disabled:opacity-60 hover:bg-[#2d2926] transition-colors">
                                    {notifyLoading ? "…" : "GO"}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleNotify}
                                className="flex items-center gap-1.5 bg-white text-[#1c1917]
                                           text-[10px] font-bold uppercase tracking-wide
                                           px-4 py-1.5 rounded-full
                                           hover:bg-stone-50 transition-colors shadow-md">
                                <FaBell size={9} /> Notify Me
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════
                BODY
            ══════════════════════════════════════ */}
            <div className="flex flex-col flex-1 min-w-0 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-3 sm:pb-4">

                {/* Brand */}
                {product.brand && (
                    <p className="text-[9px] sm:text-[10px] font-semibold text-[#aaa] uppercase tracking-[0.1em] truncate mb-1">
                        {product.brand}
                    </p>
                )}

                {/* Product name */}
                <h3 className="text-[12px] sm:text-[13px] text-[#007185] hover:text-[#C7511F]
                               font-medium leading-snug line-clamp-2 min-h-[2.4em] mb-1.5 sm:mb-2
                               break-words transition-colors duration-150 capitalize">
                    {product.name}
                </h3>

                {/* Stars + count */}
                {numReviews > 0 ? (
                    <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                        <span className="flex items-center gap-[2px] text-[#FF9900]">
                            <StarRating rating={rating} />
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-[#007185]">
                            {numReviews.toLocaleString()}
                        </span>
                    </div>
                ) : (
                    <div className="mb-1.5 sm:mb-2 text-[10px] sm:text-[11px] text-[#bbb]">Be the first to review</div>
                )}

                {/* Delivery line */}
                {isUH && !isOOS ? (
                    <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                        <span className="bg-violet-600 text-white text-[9px] font-bold
                                         px-2 py-[2px] rounded-full tracking-wide">FAST</span>
                        <span className="text-[10px] sm:text-[11px] text-[#007600] font-medium">Delivery in 45 min</span>
                    </div>
                ) : !isOOS ? (
                    <p className="text-[10px] sm:text-[11px] text-[#555] mb-1.5 sm:mb-2">
                        FREE delivery{" "}
                        <span className="font-semibold text-[#007600]">Tomorrow</span>
                    </p>
                ) : (
                    <p className="text-[10px] sm:text-[11px] text-[#CC0C39] font-medium mb-1.5 sm:mb-2">Currently unavailable</p>
                )}

                {/* Only X left */}
                {isLowStock && !isOOS && (
                    <p className="text-[10px] sm:text-[11px] text-[#CC0C39] mb-1.5 sm:mb-2">Only {stockNum} left in stock</p>
                )}

                {/* ── Price ── */}
                <div className="mt-auto mb-2 sm:mb-3">
                    {!isOOS ? (
                        <>
                            <div className="flex items-baseline gap-[1px]">
                                <span className="text-[12px] font-medium text-[#B12704]
                                                 self-start mt-[2px] leading-7">₹</span>
                                <span className="text-[18px] sm:text-[24px] font-semibold text-[#B12704]
                                                 leading-none tracking-tight">
                                    {price.toLocaleString("en-IN")}
                                </span>
                            </div>
                            {hasDisc && (
                                <p className="text-[10px] sm:text-[11px] text-[#999] mt-0.5">
                                    M.R.P.:{" "}
                                    <span className="line-through">
                                        ₹{mrp.toLocaleString("en-IN")}
                                    </span>
                                    <span className="text-[#CC0C39] ml-1.5 font-medium">
                                        Save ₹{savedAmt}
                                    </span>
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-[13px] sm:text-[14px] text-[#ccc] font-medium">Unavailable</p>
                    )}
                </div>

                {/* ── CTA Buttons ── */}
                {!hideActions && (
                    <div className="flex flex-col gap-1.5 sm:gap-2">
                        {isOOS ? (
                            <button
                                onClick={handleNotify}
                                className="flex items-center justify-center gap-1.5 sm:gap-2 w-full py-2 sm:py-2.5
                                           bg-[#FFD814] hover:bg-[#F0C14B]
                                           border border-[#FCD200] rounded-full
                                           text-[11px] sm:text-[12px] font-semibold text-[#111]
                                           transition-all duration-200
                                           shadow-sm hover:shadow-md active:scale-[0.98]">
                                <FaBell size={11} />
                                {notifyDone ? "Subscribed ✓" : "Notify Me"}
                            </button>
                        ) : (
                            <>
                                {/* Add to Cart */}
                                <button
                                    onClick={handleCart}
                                    disabled={inCart && !hasVariants}
                                    className={`flex items-center justify-center gap-1.5 sm:gap-2 w-full py-2 sm:py-2.5
                                                rounded-full text-[11px] sm:text-[12px] font-semibold border
                                                transition-all duration-200
                                                shadow-sm hover:shadow-md active:scale-[0.98]
                                                ${inCart && !hasVariants
                                            ? "bg-[#e6f4e6] border-[#a8d8a8] text-[#2d7a2d] cursor-default shadow-none"
                                            : "bg-[#FFD814] hover:bg-[#F0C14B] border-[#FCD200] text-[#111]"
                                        }`}>
                                    {hasVariants ? (
                                        <><FaShoppingCart size={11} /> Select Options</>
                                    ) : inCart || flash ? (
                                        <><FaCheckCircle size={11} /> Added to Cart</>
                                    ) : (
                                        <><FaShoppingCart size={11} /> Add to Cart</>
                                    )}
                                </button>

                                {/* Buy Now */}
                                <button
                                    onClick={handleBuy}
                                    className="flex items-center justify-center gap-1.5 sm:gap-2 w-full py-2 sm:py-2.5
                                               bg-[#FFA41C] hover:bg-[#FA8900]
                                               border border-[#FF8F00] rounded-full
                                               text-[11px] sm:text-[12px] font-semibold text-[#111]
                                               transition-all duration-200
                                               shadow-sm hover:shadow-md active:scale-[0.98]">
                                    <FaBolt size={11} /> Buy Now
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {footer}
        </div>
    );
});

ProductCard.displayName = "ProductCard";
export default ProductCard;




/**
//  * ProductCard.jsx — Final Production Version
//  * Pure Tailwind · Fixed image height · OOS bug fixed · Full body always visible
//  * BUG FIXES: null safety for product, stock handling, navigation URL fallback
//  * UI: Preserved original styling - no visual changes
//  */
// import { useState, useCallback, memo } from "react";
// import { useNavigate, useLocation } from "react-router-dom";
// import { useCart } from "../hooks/useCart";
// import { useWishlist } from "../hooks/useWishlist";
// import { useAuth } from "../contexts/AuthContext";
// import {
//     FaStar, FaShoppingCart, FaBolt,
//     FaCheckCircle, FaHeart, FaRegHeart, FaBell,
// } from "react-icons/fa";
// import { imgUrl } from "../utils/imageUrl";
// import api from "../api/axios";

// const ProductCard = memo(({ product, onAddToCart, onBuyNow, hideActions = false, footer }) => {
//     const navigate = useNavigate();
//     const location = useLocation();
//     const { user } = useAuth();
//     const { cartItems, addItem } = useCart();

//     // ═══════════════════════════════════════════════════════
//     // NULL SAFETY - Guard against null/undefined product
//     // BUG FIX: Prevent crash when product is null/undefined
//     // ═══════════════════════════════════════════════════════
//     if (!product) {
//         return (
//             <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col w-full h-full">
//                 <div className="w-full aspect-[3/4] bg-[#ede9e4] animate-pulse shrink-0" />
//                 <div className="px-2.5 pt-2 pb-1 sm:px-3 sm:pt-2.5 flex flex-col gap-1.5">
//                     <div className="h-2 w-1/3 bg-[#ede9e4] rounded animate-pulse" />
//                     <div className="h-3 bg-[#ede9e4] rounded animate-pulse" />
//                     <div className="h-3 w-4/5 bg-[#ede9e4] rounded animate-pulse" />
//                     <div className="h-4 w-2/5 bg-[#ede9e4] rounded animate-pulse mt-1" />
//                 </div>
//             </div>
//         );
//     }

//     // BUG FIX: Handle both _id and id fields
//     const productId = product._id || product.id || "";
//     const { inWishlist, toggle: toggleWish } = useWishlist(productId);

//     // BUG FIX: Check cart correctly with productId fallback
//     const inCart = cartItems.some(i => i._id === productId || i.productId === productId);

//     const [flash, setFlash] = useState(false);
//     const [imgLoaded, setImgLoaded] = useState(false);
//     const [notifyInput, setNotifyInput] = useState(false);
//     const [notifyEmail, setNotifyEmail] = useState("");
//     const [notifyLoading, setNotifyLoading] = useState(false);
//     const [notifyDone, setNotifyDone] = useState(() => {
//         try { return productId && localStorage.getItem(`notify_${productId}`) === "1"; } catch { return false; }
//     });

//     /* ── Image ── */
//     const image = imgUrl.card(product?.images?.[0]?.url || product?.image || "");

//     /* ── Stock — FIXED: Calculate real data from all variants (sizes/colors) ── */
//     const getStock = (p) => {
//         if (!p) return 0;

//         let calculatedStock = 0;
//         let hasVariantStock = false;

//         if (p.sizes && p.sizes.length > 0) {
//             calculatedStock = p.sizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
//             hasVariantStock = true;
//         } else if (p.colorVariants && p.colorVariants.length > 0 && p.colorVariants.some(v => v.stock !== undefined)) {
//             calculatedStock = p.colorVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
//             hasVariantStock = true;
//         }

//         if (hasVariantStock) return calculatedStock;

//         if (p.inStock === true && (p.stock === undefined || p.stock === null)) return 10;
//         return Number(p.stock || 0);
//     }
//     const stockNum = getStock(product);

//     // BUG FIX: Consistent OOS logic
//     const isOOS = product.inStock === false || stockNum <= 0;
//     const isLowStock = !isOOS && stockNum > 0 && stockNum <= 5;

//     /* ── Variant Check ── */
//     const hasVariants = (product?.sizes && product.sizes.length > 0) || (product?.colorVariants && product.colorVariants.length > 0);

//     /* ── Numbers ── */
//     const rating = Number(product.rating || 0);
//     const numReviews = Number(product.numReviews || 0);
//     const price = Number(product.price || 0);
//     const mrp = Number(product.mrp || product.originalPrice || product.compareAtPrice || 0);
//     const hasDisc = mrp > price && mrp > 0;
//     const discPct = hasDisc ? Math.round(((mrp - price) / mrp) * 100) : 0;
//     const saving = hasDisc ? mrp - price : 0;

//     // BUG FIX: Ensure productUrl always has valid fallback
//     const productUrl = `/products/${product.slug || productId}`;

//     /* ── Handlers ── */
//     const handleCart = useCallback(e => {
//         e.stopPropagation();
//         // If product has sizes/colors, force them to visit the product page
//         if (hasVariants) {
//             navigate(productUrl);
//             return;
//         }
//         if (inCart || isOOS) return;
//         if (onAddToCart) onAddToCart(product); else addItem(product);
//         setFlash(true); setTimeout(() => setFlash(false), 1400);
//     }, [inCart, isOOS, onAddToCart, product, addItem]);

//     const handleBuy = useCallback(e => {
//         e.stopPropagation();
//         if (hasVariants) {
//             navigate(productUrl);
//             return;
//         }
//         if (isOOS) return;
//         if (onBuyNow) { onBuyNow(product); return; }
//         const item = { ...product, quantity: 1 };
//         try { sessionStorage.setItem("ux_buy_now_item", JSON.stringify(item)); } catch { }
//         navigate("/checkout", { state: { buyNowItem: item } });
//     }, [isOOS, onBuyNow, product, navigate]);

//     const handleWish = useCallback(e => {
//         e.stopPropagation();
//         if (!user) {
//             navigate("/login", { state: { from: location.pathname } });
//             return;
//         }
//         toggleWish();
//     }, [user, navigate, location.pathname, toggleWish]);

//     const handleNotify = useCallback(async e => {
//         e.stopPropagation();
//         if (!notifyInput) { setNotifyInput(true); return; }
//         if (!notifyEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) return;
//         try {
//             setNotifyLoading(true);
//             await api.post("/stock-notify/subscribe", { productId: productId, email: notifyEmail.trim() });
//             setNotifyDone(true); setNotifyInput(false);
//             try { localStorage.setItem(`notify_${productId}`, "1"); } catch { }
//         } catch { } finally { setNotifyLoading(false); }
//     }, [notifyInput, notifyEmail, productId]);

//     const cartCls = inCart
//         ? "bg-green-50 text-green-700 border border-green-200 cursor-default"
//         : flash ? "bg-green-500 text-white"
//             : "bg-[#1c1917] text-white hover:bg-[#2d2926]";
//     const mobCartCls = inCart
//         ? "bg-green-50 text-green-700 cursor-default"
//         : flash ? "bg-green-500 text-white"
//             : "bg-[#1c1917] text-white";

//     return (
//         <div
//             onClick={() => navigate(productUrl)}
//             className="group relative flex flex-col w-full h-full bg-white rounded-lg
//         overflow-hidden cursor-pointer transition-all duration-300
//         hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] active:scale-[0.99] border border-transparent hover:border-stone-200"
//         >
//             {/* Wishlist */}
//             <button onClick={handleWish} aria-label="Wishlist"
//                 className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90
//           backdrop-blur-sm flex items-center justify-center shadow-sm
//           transition-all hover:scale-110 hover:bg-white">
//                 {inWishlist
//                     ? <FaHeart size={12} className="text-red-500" />
//                     : <FaRegHeart size={12} className="text-stone-400" />}
//             </button>

//             {/* Urbexon Hour Badge for mixed lists */}
//             {product.productType === "urbexon_hour" && (
//                 <span className="absolute top-2 left-2 z-10 bg-violet-600 text-white
//             text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-md flex items-center gap-1">
//                     <FaBolt size={7} /> 45 MIN
//                 </span>
//             )}

//             {/* ─── IMAGE — fixed height, never overflows ─── */}
//             <div className="relative bg-[#f9f9f9] aspect-[3/4] shrink-0 overflow-hidden">
//                 {!imgLoaded && <div className="absolute inset-0 bg-[#ede9e4] animate-pulse" />}
//                 <img
//                     src={image} alt={product.name}
//                     loading="lazy" decoding="async"
//                     onLoad={() => setImgLoaded(true)}
//                     onError={e => { e.target.src = "/placeholder.png"; setImgLoaded(true); }}
//                     className={`absolute inset-0 w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105
//             ${imgLoaded ? "opacity-100" : "opacity-0"}`}
//                 />

//                 {/* Discount pill */}
//                 {/* Adjust position if UH badge exists */}
//                 {hasDisc && !isOOS && !product.productType !== "urbexon_hour" && (
//                     <span className={`absolute ${product.productType === "urbexon_hour" ? "top-7" : "top-2"} left-2 z-[2] bg-red-500 text-white
//             text-[10px] font-bold px-2 py-1 rounded-md`}>
//                         -{discPct}%
//                     </span>
//                 )}
//                 {/* Low stock */}
//                 {isLowStock && (
//                     <span className="absolute bottom-2 left-2 z-[2] bg-amber-500 text-white
//             text-[10px] font-bold px-2 py-1 rounded-md">
//                         ⚡ {stockNum} left
//                     </span>
//                 )}

//                 {/* OOS overlay */}
//                 {isOOS && (
//                     <div className="absolute inset-0 z-[4] bg-black/52 backdrop-blur-[1px]
//             flex flex-col items-center justify-center gap-2">
//                         <span className="bg-black/65 text-white text-[11px] font-extrabold
//               tracking-[0.13em] uppercase border border-white/20 px-3.5 py-1.5">
//                             Out of Stock
//                         </span>
//                         {notifyDone ? (
//                             <span className="flex items-center gap-1 text-lime-400 text-[9px] font-bold tracking-wide">
//                                 <FaBell size={9} /> We'll notify you
//                             </span>
//                         ) : notifyInput ? (
//                             <div className="flex w-[80%] max-w-[200px]" onClick={e => e.stopPropagation()}>
//                                 <input
//                                     className="flex-1 min-w-0 px-2 py-1.5 text-[10px] outline-none
//                     bg-white text-[#1c1917] placeholder:text-stone-400"
//                                     type="email" placeholder="your@email.com"
//                                     value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
//                                     onKeyDown={e => e.key === "Enter" && handleNotify(e)} autoFocus
//                                 />
//                                 <button onClick={handleNotify} disabled={notifyLoading}
//                                     className="px-2.5 bg-[#1c1917] text-white text-[9px] font-extrabold
//                     disabled:opacity-60 hover:bg-[#2d2926] transition-colors">
//                                     {notifyLoading ? "…" : "GO"}
//                                 </button>
//                             </div>
//                         ) : (
//                             <button onClick={handleNotify}
//                                 className="flex items-center gap-1.5 bg-white text-[#1c1917]
//                   text-[9px] font-extrabold tracking-wide uppercase px-3 py-1.5
//                   hover:bg-stone-100 transition-colors">
//                                 <FaBell size={9} /> Notify Me
//                             </button>
//                         )}
//                     </div>
//                 )}

//             </div>

//             {/* ─── BODY — always fully visible ─── */}
//             <div className="flex flex-col flex-1 min-w-0 px-2 pt-2 pb-1.5 sm:px-3 sm:pt-2.5">
//                 {/* Category */}
//                 <p className="text-[9px] sm:text-[10px] font-bold tracking-[0.1em] uppercase
//           text-stone-500 truncate mb-0.5">
//                     {product.category || "General"}{product.brand ? ` · ${product.brand}` : ""}
//                 </p>

//                 {/* Name */}
//                 <h3 className="text-[12px] sm:text-[13px] font-semibold text-[#1c1917]
//           leading-snug line-clamp-2 min-h-[2.7em] mb-1 break-words">
//                     {product.name}
//                 </h3>

//                 {/* Rating */}
//                 {numReviews > 0 ? (
//                     <div className="flex items-center gap-1.5 mb-1">
//                         <span className="flex items-center gap-[3px] text-amber-500
//               text-[11px] font-bold">
//                             {rating.toFixed(1)} <FaStar size={9} />
//                         </span>
//                         <span className="text-[10px] text-stone-400">({numReviews.toLocaleString()})</span>
//                     </div>
//                 ) : (
//                     <div className="mb-1 h-[16px] text-[10px] text-stone-400 flex items-center">No reviews yet</div>
//                 )}

//                 {/* Stock status */}
//                 <div className="flex items-center gap-1.5 mb-1 text-[9.5px] font-bold uppercase tracking-wider">
//                     {isOOS
//                         ? <span className="text-red-500">Out of Stock</span>
//                         : isLowStock
//                             ? <span className="text-amber-500">Only {stockNum} left</span>
//                             : <span className="text-emerald-600">In Stock</span>
//                     }
//                 </div>

//                 {/* Price */}
//                 <div className="mt-auto pb-1">
//                     <div className="flex items-center gap-2 flex-wrap">
//                         <span className={`text-[14px] sm:text-[16px] font-bold
//               ${isOOS ? "text-stone-400" : "text-[#1c1917]"}`}>
//                             ₹{price.toLocaleString("en-IN")}
//                         </span>
//                         {hasDisc && !isOOS && (
//                             <span className="text-[11px] text-stone-400 line-through">
//                                 ₹{mrp.toLocaleString("en-IN")}
//                             </span>
//                         )}
//                         {hasDisc && !isOOS && (
//                             <span className="text-[10px] font-bold text-red-500">
//                                 ({discPct}% OFF)
//                             </span>
//                         )}
//                     </div>
//                 </div>
//             </div>

//             {/* ─── MOBILE CTA BAR ─── */}
//             {!hideActions && (
//                 <div className="flex border-t border-stone-100 md:hidden shrink-0">
//                     {isOOS ? (
//                         <button onClick={handleNotify}
//                             className="flex-1 flex items-center justify-center gap-1.5
//                 py-2.5 text-[9px] font-extrabold tracking-wide bg-[#1c1917] text-white">
//                             <FaBell size={9} />{notifyDone ? "Subscribed ✓" : "Notify Me"}
//                         </button>
//                     ) : (
//                         <>
//                             <button onClick={handleCart} disabled={inCart}
//                                 className={`flex-1 flex items-center justify-center gap-1.5
//                   py-2.5 text-[10px] font-extrabold tracking-wide
//                   border-r border-stone-100 transition-colors ${mobCartCls}`}>
//                                 {hasVariants ? <>Select Options</>
//                                     : inCart ? <><FaCheckCircle size={10} /> Added</>
//                                         : flash ? <><FaCheckCircle size={10} /> Added</>
//                                             : <><FaShoppingCart size={10} /> Cart</>}
//                             </button>
//                             <button onClick={handleBuy}
//                                 className="flex-1 flex items-center justify-center gap-1.5
//                   py-2.5 text-[10px] font-bold tracking-wide
//                   bg-[#1c1917] text-white hover:bg-[#2d2926] transition-colors">
//                                 <FaBolt size={10} /> Buy
//                             </button>
//                         </>
//                     )}
//                 </div>
//             )}
//             {footer}
//         </div>
//     );
// });

// ProductCard.displayName = "ProductCard";
// export default ProductCard;
