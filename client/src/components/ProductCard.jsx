/**
 * ProductCard.jsx — v3 Professional Redesign
 * ─────────────────────────────────────────────
 * • Taller square-ish image (aspect-[3/4]) — product gets more real estate
 * • Floating badges — discount chip top-left, wishlist top-right
 * • Clean white body with tight, intentional type scale
 * • Amazon-style price block (₹ superscript + big integer)
 * • Two CTAs: solid yellow "Add to Cart" + ghost "Buy Now"
 * • Urbexon Hour: violet gradient top-bar accent
 * • Hover: subtle lift + image zoom, no jank
 * All hooks / handlers / OOS logic UNCHANGED
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

/* ─── Star row ─────────────────────────────────────────────── */
const StarRating = ({ rating }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) stars.push(<FaStar key={i} size={9} />);
        else if (i === Math.ceil(rating) && rating % 1 >= 0.4) stars.push(<FaStarHalfAlt key={i} size={9} />);
        else stars.push(<FaRegStar key={i} size={9} />);
    }
    return <>{stars}</>;
};

/* ─── Skeleton ─────────────────────────────────────────────── */
const Skeleton = () => (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#f0f0f0] flex flex-col w-full h-full">
        <div className="w-full aspect-[4/3] bg-[#f3f0ec] animate-pulse" />
        <div className="p-3 flex flex-col gap-2">
            <div className="h-2 w-1/4 bg-[#ece8e3] rounded-full animate-pulse" />
            <div className="h-3 bg-[#ece8e3] rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-[#ece8e3] rounded animate-pulse" />
            <div className="h-6 w-2/5 bg-[#ece8e3] rounded animate-pulse mt-0.5" />
            <div className="h-8 bg-[#f5e97a] rounded-xl animate-pulse mt-1.5" />
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════ */
const ProductCard = memo(({ product, onAddToCart, onBuyNow, hideActions = false, footer }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { cartItems, addItem } = useCart();

    if (!product) return <Skeleton />;

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

    /* ── stock calc (unchanged) ── */
    const getStock = p => {
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
    const isUH = product.productType === "urbexon_hour" || !!product.vendorId;
    const isOOS = !isUH && (product.inStock === false || stockNum <= 0);
    const isLowStock = !isOOS && !isUH && stockNum > 0 && stockNum <= 5;
    const hasVariants = !!(product?.sizes?.length > 0 || product?.colorVariants?.length > 0);

    const rating = Number(product.rating || 0);
    const numReviews = Number(product.numReviews || 0);
    const price = Number(product.price || 0);
    const mrp = Number(product.mrp || product.originalPrice || product.compareAtPrice || 0);
    const hasDisc = mrp > price && mrp > 0;
    const discPct = hasDisc ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const savedAmt = hasDisc ? (mrp - price).toLocaleString("en-IN") : 0;

    const isUrbexonHourProduct = !!product.vendorId || product.productType === 'urbexon_hour';
    // Navigation rules:
    // - Urbexon Hour / vendor-managed products -> UH product page
    // - Ecommerce products -> ecommerce product details
    const productUrl = isUrbexonHourProduct
        ? `/uh-product/${product.slug || productId}`
        : `/products/${product.slug || productId}`;

    /* ── handlers (all unchanged) ── */
    const handleCart = useCallback(e => {
        e.stopPropagation();
        if (hasVariants) { navigate(productUrl); return; }
        if (inCart || isOOS) return;

        // ✅ FIX: Defensively set productType before adding to cart.
        // Any product with a `vendorId` is an Urbexon Hour product. This
        // ensures products from vendor pages are added to the correct UH cart.
        const itemToAdd = {
            ...product,
            productType: product.vendorId ? 'urbexon_hour' : (product.productType || 'ecommerce'),
        };

        if (onAddToCart) onAddToCart(itemToAdd); else addItem(itemToAdd);
        setFlash(true); setTimeout(() => setFlash(false), 1400);
    }, [inCart, isOOS, onAddToCart, product, addItem, hasVariants, navigate, productUrl]);

    const handleBuy = useCallback(e => {
        e.stopPropagation();
        if (hasVariants) { navigate(productUrl); return; }
        if (isOOS) return

        // ✅ FIX: Defensively set productType for Buy Now.
        // Any product with a `vendorId` is an Urbexon Hour product.
        const item = {
            ...product,
            quantity: 1,
            productType: product.vendorId ? 'urbexon_hour' : (product.productType || 'ecommerce'),
        };

        if (onBuyNow) { onBuyNow(item); return; }
        try { sessionStorage.setItem("ux_buy_now_item", JSON.stringify(item)); } catch { }

        // ✅ FIX: Navigate to the correct checkout page based on product type.
        const isUrbexonHourItem = item.productType === 'urbexon_hour';
        const checkoutUrl = isUrbexonHourItem ? "/uh-checkout" : "/checkout";
        navigate(checkoutUrl, { state: { buyNowItem: item } });
    }, [isOOS, onBuyNow, product, navigate, hasVariants, productUrl]);

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

    /* ── price parts for superscript style ── */
    const priceInt = Math.floor(price);
    const priceDec = price % 1 > 0 ? ("." + (price % 1).toFixed(2).slice(2)) : "";

    /* ════════════════════════════════════════════════════════ */
    return (
        <div
            onClick={() => navigate(productUrl)}
            className="
        group relative flex flex-col w-full h-full
        bg-white rounded-2xl overflow-hidden cursor-pointer
        border border-[#e8e8e8]
        shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.02)]
        hover:shadow-[0_8px_32px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]
        hover:-translate-y-[3px]
        transition-all duration-300 ease-out
        active:scale-[0.99] active:shadow-none
      "
        >
            {/* ══ Urbexon Hour — top accent bar ══ */}
            {isUH && (
                <div className="
          absolute top-0 inset-x-0 z-20 h-[3px]
          bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500
        " />
            )}

            {/* ══ IMAGE ZONE ══════════════════════════════════════ */}
            <div className="
        relative w-full aspect-[4/3] shrink-0 overflow-hidden
        bg-gradient-to-br from-[#fafafa] to-[#f2f2f2]
      ">
                {/* skeleton shimmer */}
                {!imgLoaded && (
                    <div className="absolute inset-0 bg-[#ece9e4] animate-pulse" />
                )}

                {/* product image */}
                <img
                    src={image}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setImgLoaded(true)}
                    onError={e => { e.target.src = "/placeholder.png"; setImgLoaded(true); }}
                    className={`
            absolute inset-0 w-full h-full object-contain
            px-3 py-3
            mix-blend-multiply
            transition-transform duration-500 ease-out
            group-hover:scale-[1.06]
            ${imgLoaded ? "opacity-100" : "opacity-0"}
          `}
                />

                {/* ── Discount chip — top-left ── */}
                {hasDisc && !isOOS && (
                    <div className={`
            absolute ${isUH ? "top-5" : "top-3"} left-3 z-10
            flex flex-col items-center
            bg-[#CC0C39] text-white
            rounded-xl px-2 py-1 shadow-md
          `}>
                        <span className="text-[11px] font-black leading-none">{discPct}%</span>
                        <span className="text-[8px] font-semibold leading-none opacity-90 mt-0.5">OFF</span>
                    </div>
                )}

                {/* ── UH speed badge — top-left (when no discount) ── */}
                {isUH && !hasDisc && !isOOS && (
                    <div className="absolute top-5 left-3 z-10 flex items-center gap-1
                          bg-violet-600 text-white text-[9px] font-extrabold
                          px-2 py-1 rounded-full shadow-md tracking-wide">
                        <FaBolt size={7} /> 45 MIN
                    </div>
                )}

                {/* ── UH + discount — show both ── */}
                {isUH && hasDisc && !isOOS && (
                    <div className="absolute top-[68px] left-3 z-10 flex items-center gap-1
                          bg-violet-600 text-white text-[9px] font-extrabold
                          px-2 py-1 rounded-full shadow-md tracking-wide">
                        <FaBolt size={7} /> 45 MIN
                    </div>
                )}

                {/* ── Wishlist button — top-right ── */}
                <button
                    onClick={handleWish}
                    aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                    className="
            absolute top-3 right-3 z-10
            w-8 h-8 rounded-full
            bg-white/90 backdrop-blur-sm
            flex items-center justify-center
            shadow-[0_1px_6px_rgba(0,0,0,0.12)]
            border border-white/60
            transition-all duration-200
            hover:scale-110 hover:bg-white
            active:scale-95
          "
                >
                    {inWishlist
                        ? <FaHeart size={12} className="text-red-500" />
                        : <FaRegHeart size={12} className="text-[#bbb] group-hover:text-[#999] transition-colors" />}
                </button>

                {/* ── Low stock ribbon — bottom ── */}
                {isLowStock && (
                    <div className="
            absolute bottom-0 inset-x-0 z-10
            bg-gradient-to-r from-amber-500 to-orange-500
            text-white text-[10px] font-bold
            text-center py-1 tracking-wide
          ">
                        ⚡ Only {stockNum} left
                    </div>
                )}

                {/* ── OOS overlay ── */}
                {isOOS && (
                    <div className="
            absolute inset-0 z-[4]
            bg-white/70 backdrop-blur-[3px]
            flex flex-col items-center justify-center gap-3
          ">
                        <div className="
              bg-[#1c1917]/80 text-white
              text-[11px] font-extrabold tracking-[0.15em] uppercase
              border border-white/20 px-5 py-2 rounded-full
              shadow-lg
            ">
                            Out of Stock
                        </div>

                        {notifyDone ? (
                            <span className="flex items-center gap-1.5 text-[#007600] text-[10px] font-bold
                               bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                                <FaBell size={9} /> Notified ✓
                            </span>
                        ) : notifyInput ? (
                            <div
                                className="flex w-[82%] max-w-[200px] rounded-full overflow-hidden
                            border border-[#1c1917]/20 shadow-lg bg-white"
                                onClick={e => e.stopPropagation()}
                            >
                                <input
                                    className="flex-1 min-w-0 px-3 py-1.5 text-[11px] outline-none
                             bg-transparent text-[#1c1917] placeholder:text-stone-400"
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
                             disabled:opacity-60 hover:bg-[#2d2926] transition-colors"
                                >
                                    {notifyLoading ? "…" : "GO"}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleNotify}
                                className="
                  flex items-center gap-1.5
                  bg-white text-[#1c1917]
                  text-[10px] font-bold uppercase tracking-wide
                  px-4 py-1.5 rounded-full
                  border border-[#1c1917]/10
                  hover:bg-stone-50 transition-colors shadow-md
                "
                            >
                                <FaBell size={9} /> Notify Me
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ══ BODY ══════════════════════════════════════════════ */}
            <div className="flex flex-col flex-1 min-w-0 px-3 pt-2 pb-3">

                {/* Brand */}
                {product.brand && (
                    <p className="text-[9px] font-bold text-[#b0a99f] uppercase tracking-[0.12em] truncate mb-0.5">
                        {product.brand}
                    </p>
                )}

                {/* Product name */}
                <h3 className="
          text-[12px] leading-[1.35] font-medium
          text-[#0f1111]
          line-clamp-2
          mb-1.5
          capitalize
          group-hover:text-[#C7511F]
          transition-colors duration-150
        ">
                    {product.name}
                </h3>

                {/* Stars */}
                {numReviews > 0 ? (
                    <div className="flex items-center gap-1 mb-1.5">
                        <span className="flex items-center gap-[2px] text-[#FF9900]">
                            <StarRating rating={rating} />
                        </span>
                        <span className="text-[10px] text-[#007185] font-medium">
                            {rating.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-[#bbb]">
                            ({numReviews.toLocaleString()})
                        </span>
                    </div>
                ) : (
                    <div className="mb-1.5 text-[10px] text-[#c8c2bb] italic">No reviews yet</div>
                )}

                {/* Delivery line */}
                {isUH && !isOOS ? (
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700
                             border border-violet-200 text-[9px] font-bold
                             px-1.5 py-[2px] rounded-full tracking-wide">
                            <FaBolt size={7} /> EXPRESS
                        </span>
                        <span className="text-[10px] text-[#007600] font-semibold">45 min delivery</span>
                    </div>
                ) : !isOOS ? (
                    <p className="text-[10px] text-[#565959] mb-1.5">
                        FREE delivery <span className="font-semibold text-[#007600]">Tomorrow</span>
                    </p>
                ) : (
                    <p className="text-[10px] text-[#CC0C39] font-semibold mb-1.5">Currently unavailable</p>
                )}

                {/* Low stock text */}
                {isLowStock && !isOOS && (
                    <p className="text-[10px] text-[#CC0C39] font-semibold mb-1.5">
                        Only {stockNum} left — order soon
                    </p>
                )}

                {/* ── Price block ─────────────────────────────── */}
                <div className="mt-auto mb-2">
                    {!isOOS ? (
                        <>
                            {/* Main price */}
                            <div className="flex items-start gap-0.5 leading-none mb-0.5">
                                <span className="text-[11px] font-medium text-[#B12704] mt-[2px]">₹</span>
                                <span className="text-[18px] sm:text-[20px] font-semibold text-[#B12704] tracking-tight">
                                    {priceInt.toLocaleString("en-IN")}
                                </span>
                                {priceDec && (
                                    <span className="text-[11px] font-medium text-[#B12704] mt-[2px]">{priceDec}</span>
                                )}
                            </div>

                            {/* MRP + savings */}
                            {hasDisc && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-[#888]">
                                        M.R.P.: <span className="line-through">₹{mrp.toLocaleString("en-IN")}</span>
                                    </span>
                                    <span className="text-[10px] text-white font-semibold
                                   bg-[#CC0C39] px-1.5 py-[1px] rounded-md">
                                        Save ₹{savedAmt}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-[12px] text-[#c0bbb5] font-medium">Price unavailable</p>
                    )}
                </div>

                {/* ── CTA Buttons ──────────────────────────────── */}
                {!hideActions && (
                    <div className="flex flex-col gap-1.5">
                        {isOOS ? (
                            /* OOS — Notify Me CTA */
                            <button
                                onClick={handleNotify}
                                className="
                  flex items-center justify-center gap-1.5 w-full py-2
                  bg-[#FFD814] hover:bg-[#F0C14B]
                  border border-[#FCD200] rounded-xl
                  text-[11px] font-bold text-[#111]
                  transition-all duration-200
                  shadow-sm hover:shadow-md active:scale-[0.98]
                "
                            >
                                <FaBell size={10} />
                                {notifyDone ? "Subscribed ✓" : "Notify When Available"}
                            </button>
                        ) : (
                            <>
                                {/* Add to Cart — primary */}
                                <button
                                    onClick={handleCart}
                                    disabled={inCart && !hasVariants}
                                    className={`
                    flex items-center justify-center gap-1.5 w-full py-2
                    rounded-xl text-[11px] font-bold
                    transition-all duration-200
                    shadow-sm hover:shadow-md active:scale-[0.98]
                    ${inCart && !hasVariants
                                            ? "bg-[#e8f5e8] border border-[#a8d5a8] text-[#2a7a2a] cursor-default shadow-none"
                                            : "bg-[#FFD814] hover:bg-[#F7CA00] border border-[#F2C200] text-[#111]"}
                  `}
                                >
                                    {hasVariants ? (
                                        <><FaShoppingCart size={10} /> Select Options</>
                                    ) : inCart || flash ? (
                                        <><FaCheckCircle size={10} /> Added to Cart</>
                                    ) : (
                                        <><FaShoppingCart size={10} /> Add to Cart</>
                                    )}
                                </button>

                                {/* Buy Now — secondary */}
                                <button
                                    onClick={handleBuy}
                                    className="
                    flex items-center justify-center gap-1.5 w-full py-2
                    bg-[#FF9500] hover:bg-[#E88800]
                    border border-[#E88800] rounded-xl
                    text-[11px] font-bold text-white
                    transition-all duration-200
                    shadow-sm hover:shadow-md active:scale-[0.98]
                  "
                                >
                                    <FaBolt size={10} /> Buy Now
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