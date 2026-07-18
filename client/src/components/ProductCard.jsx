/**
 * ProductCard.jsx — v4 · THE global product card ("Signal" design system)
 * ─────────────────────────────────────────────
 * This is the single card component for the whole client app. The old
 * duplicates (design-system/ProductCard.jsx, ProductCardUnified.jsx, and
 * ProductDetails' inline RelatedCard) were deleted and every page now
 * renders this one, so the card style is identical everywhere.
 *
 * Two visual variants, one component:
 *   ECOMMERCE — 4:3 image, indigo accent, uniform CTA system.
 *   URBEXON HOUR — compact quick-commerce card (square image, ADD pill),
 *     same structure as before but amber-tokened instead of Myntra pink.
 *
 * All hooks / handlers / OOS / stock / routing logic UNCHANGED from v3.
 * Additive props (both optional, default behaviour identical):
 *   wishlisted        — force the heart state (Wishlist page knows it's true)
 *   onWishlistToggle  — override the internal wishlist toggle (Wishlist page
 *                       removes the item from its own list + API instead)
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
import { imgUrl, imgSrcSet } from "../utils/imageUrl";
import { useImagePreloaded } from "../hooks/useImagePreloaded";
import { subscribeStockNotify } from "../api/productApi";

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
    <div className="bg-white rounded-xl overflow-hidden border border-[var(--color-graphite-100)] flex flex-col w-full h-full">
        <div className="w-full aspect-[4/3] bg-[var(--color-graphite-100)] animate-pulse" />
        <div className="p-3 flex flex-col gap-2">
            <div className="h-2 w-1/4 bg-[var(--color-graphite-100)] rounded-full animate-pulse" />
            <div className="h-3 bg-[var(--color-graphite-100)] rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-[var(--color-graphite-100)] rounded animate-pulse" />
            <div className="h-6 w-2/5 bg-[var(--color-graphite-100)] rounded animate-pulse mt-0.5" />
            <div className="h-8 bg-[var(--color-graphite-100)] rounded-lg animate-pulse mt-1.5" />
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════ */
const ProductCard = memo(({ product, onAddToCart, onBuyNow, hideActions = false, footer, wishlisted, onWishlistToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { cartItems, addItem } = useCart();

    if (!product) return <Skeleton />;

    const productId = product._id || product.id || "";
    const { inWishlist, toggle: toggleWish } = useWishlist(productId);
    // Caller can force the heart state (e.g. Wishlist page — everything there
    // is wishlisted by definition, no need to wait for the check request).
    const isWished = wishlisted === undefined ? inWishlist : wishlisted;
    const inCart = cartItems.some(i => i._id === productId || i.productId === productId);

    const rawImage = product?.images?.[0]?.url || product?.image || "";
    const image = imgUrl.card(rawImage);
    const imageSrcSet = imgSrcSet(rawImage, 400);

    const [flash, setFlash] = useState(false);
    const [imgLoaded, markImgLoaded] = useImagePreloaded(image);
    const [notifyInput, setNotifyInput] = useState(false);
    const [notifyEmail, setNotifyEmail] = useState("");
    const [notifyLoading, setNotifyLoading] = useState(false);
    const [notifyDone, setNotifyDone] = useState(() => {
        try { return productId && localStorage.getItem(`notify_${productId}`) === "1"; } catch { return false; }
    });

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
        try { sessionStorage.setItem("ux_buy_now_item", JSON.stringify(item)); } catch { /* storage unavailable/quota exceeded — buy-now flow still proceeds via navigation */ }

        // ✅ FIX: Navigate to the correct checkout page based on product type.
        const isUrbexonHourItem = item.productType === 'urbexon_hour';
        const checkoutUrl = isUrbexonHourItem ? "/uh-checkout" : "/checkout";
        navigate(checkoutUrl, { state: { buyNowItem: item } });
    }, [isOOS, onBuyNow, product, navigate, hasVariants, productUrl]);

    const handleWish = useCallback(e => {
        e.stopPropagation();
        // Optional override — the Wishlist page removes from its own list +
        // API instead of the internal toggle. Default path is unchanged.
        if (onWishlistToggle) { onWishlistToggle(); return; }
        if (!user) { navigate("/login", { state: { from: location.pathname } }); return; }
        toggleWish();
    }, [user, navigate, location.pathname, toggleWish, onWishlistToggle]);

    const handleNotify = useCallback(async e => {
        e.stopPropagation();
        if (!notifyInput) { setNotifyInput(true); return; }
        if (!notifyEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) return;
        try {
            setNotifyLoading(true);
            await subscribeStockNotify({ productId, email: notifyEmail.trim() });
            setNotifyDone(true); setNotifyInput(false);
            try { localStorage.setItem(`notify_${productId}`, "1"); } catch { /* storage unavailable — notify state still shown via React state above */ }
        } catch { /* subscribe request failed */ } finally { setNotifyLoading(false); }
    }, [notifyInput, notifyEmail, productId]);

    /* ── price parts for superscript style ── */
    const priceInt = Math.floor(price);
    const priceDec = price % 1 > 0 ? ("." + (price % 1).toFixed(2).slice(2)) : "";

    /* ── how many selectable options (sizes / color variants) for UH "ADD" pill ── */
    const uhOptionsCount = product?.sizes?.length || product?.colorVariants?.length || 0;

    /* ════════════════════════════════════════════════════════
       URBEXON HOUR — Myntra/Ajio-style compact card
       (kept fully separate from the ecommerce card below —
        ecommerce markup/classes are untouched)
    ════════════════════════════════════════════════════════ */
    if (isUH) {
        return (
            <div
                onClick={() => navigate(productUrl)}
                className="
          group relative flex flex-col w-full h-full
          bg-white rounded-xl overflow-hidden cursor-pointer
          border border-[var(--color-graphite-100)] shadow-[var(--shadow-xs)]
          hover:shadow-[var(--shadow-md)] hover:border-default
          transition-all duration-200 ease-out
          active:scale-[0.99]
        "
            >
                {/* ── Image zone (square) ── */}
                <div className="relative w-full aspect-square bg-[var(--color-graphite-50)] overflow-hidden">
                    {!imgLoaded && (
                        <div className="absolute inset-0 bg-[var(--color-graphite-100)] animate-pulse" />
                    )}

                    <img
                        src={image}
                        srcSet={imageSrcSet}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        onLoad={markImgLoaded}
                        onError={e => { e.target.src = "/placeholder.png"; markImgLoaded(); }}
                        className={`
              absolute inset-0 w-full h-full object-cover
              transition-transform duration-500 ease-out
              group-hover:scale-[1.05]
              ${imgLoaded ? "opacity-100" : "opacity-0"}
            `}
                    />

                    {/* Wishlist — bottom-left small square button */}
                    <button
                        onClick={handleWish}
                        aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
                        className="
              absolute bottom-2 left-2 z-10
              w-7 h-7 rounded-md
              bg-white/95 backdrop-blur-sm
              flex items-center justify-center
              shadow-[0_1px_4px_rgba(0,0,0,0.15)]
              hover:scale-105 active:scale-95
              transition-transform duration-150
            "
                    >
                        {isWished
                            ? <FaHeart size={11} className="text-[var(--icon-error)]" />
                            : <FaRegHeart size={11} className="text-neutral-400" />}
                    </button>

                    {/* ADD pill — top-right */}
                    {!isOOS && (
                        <button
                            onClick={handleCart}
                            className="
                absolute top-2 right-2 z-10
                flex flex-col items-center justify-center
                min-w-[54px]
                bg-white border border-[var(--accent-hour-hover)] rounded-full
                px-3 py-1
                shadow-[0_1px_4px_rgba(0,0,0,0.1)]
                hover:bg-hour-tint active:scale-95
                transition-all duration-200
              "
                        >
                            {inCart && !hasVariants ? (
                                <FaCheckCircle size={11} className="text-[var(--icon-success)]" />
                            ) : (
                                <>
                                    <span className="text-[10px] font-extrabold text-[var(--accent-hour-hover)] leading-none tracking-wide">
                                        ADD
                                    </span>
                                    {hasVariants && uhOptionsCount > 0 && (
                                        <span className="text-[8px] text-neutral-500 leading-none mt-0.5 whitespace-nowrap">
                                            {uhOptionsCount} options
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                    )}

                    {/* OOS overlay */}
                    {isOOS && (
                        <div className="absolute inset-0 z-[4] bg-white/70 backdrop-blur-[3px] flex items-center justify-center">
                            <span className="
                bg-[var(--color-graphite-900)]/85 text-white
                text-[9px] font-extrabold tracking-[0.12em] uppercase
                px-3 py-1.5 rounded-full shadow-lg
              ">
                                Out of Stock
                            </span>
                        </div>
                    )}
                </div>

                {/* ── Body ── */}
                <div className="flex flex-col flex-1 min-w-0 px-2.5 pt-2 pb-2.5">
                    {product.brand && (
                        <p className="text-[12.5px] font-bold text-neutral-800 truncate leading-tight">
                            {product.brand}
                        </p>
                    )}

                    <p className="text-[11px] text-neutral-500 leading-snug line-clamp-2 mt-0.5 mb-1.5">
                        {product.name}
                    </p>

                    <p className="text-[10px] text-neutral-500 mb-1.5">1 pc</p>

                    {hasVariants && product?.sizes?.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mb-1.5">
                            {product.sizes.slice(0, 4).map((s, idx) => (
                                <span
                                    key={s._id || s.size || idx}
                                    className="text-[9.5px] font-medium text-neutral-800 border border-neutral-300 rounded px-1.5 py-[1px]"
                                >
                                    {s.size}
                                </span>
                            ))}
                            {product.sizes.length > 4 && (
                                <span className="text-[9.5px] font-medium text-neutral-500 border border-neutral-300 rounded px-1.5 py-[1px]">
                                    +{product.sizes.length - 4}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                        {!isOOS ? (
                            <>
                                <span className="text-[13.5px] font-bold text-neutral-900">
                                    ₹{priceInt.toLocaleString("en-IN")}
                                </span>
                                {hasDisc && (
                                    <span className="text-[11px] text-neutral-400 line-through">
                                        ₹{mrp.toLocaleString("en-IN")}
                                    </span>
                                )}
                                {hasDisc && (
                                    <span className="text-[11px] font-semibold text-success">
                                        {discPct}% Off
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-[11px] text-neutral-400 font-medium">Price unavailable</span>
                        )}
                    </div>
                </div>

                {footer}
            </div>
        );
    }

    /* ════════════════════════════════════════════════════════
       ECOMMERCE CARD — UNCHANGED (original v3 design below)
    ════════════════════════════════════════════════════════ */
    return (
        <div
            onClick={() => navigate(productUrl)}
            className="
        group relative flex flex-col w-full h-full
        bg-white rounded-xl overflow-hidden cursor-pointer
        border border-[var(--color-graphite-100)]
        shadow-[var(--shadow-xs)]
        hover:shadow-[var(--shadow-md)] hover:border-default
        hover:-translate-y-0.5
        transition-all duration-200 ease-out
        active:scale-[0.99] active:shadow-none
      "
        >
            {/* ══ IMAGE ZONE ══════════════════════════════════════ */}
            <div className="
        relative w-full aspect-[4/3] shrink-0 overflow-hidden
        bg-[var(--color-graphite-50)]
      ">
                {/* skeleton shimmer */}
                {!imgLoaded && (
                    <div className="absolute inset-0 bg-[var(--color-graphite-100)] animate-pulse" />
                )}

                {/* product image */}
                <img
                    src={image}
                    srcSet={imageSrcSet}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    onLoad={markImgLoaded}
                    onError={e => { e.target.src = "/placeholder.png"; markImgLoaded(); }}
                    className={`
            absolute inset-0 w-full h-full object-contain
            px-3 py-3
            mix-blend-multiply
            transition-transform duration-500 ease-out
            group-hover:scale-[1.04]
            ${imgLoaded ? "opacity-100" : "opacity-0"}
          `}
                />

                {/* ── Top-left badge stack: discount chip ── */}
                {!isOOS && hasDisc && (
                    <div className="absolute top-3 left-3 z-10">
                        <span className="bg-[var(--icon-error)] text-white text-[10px] font-bold px-2 py-1 rounded-md leading-none">
                            {discPct}% OFF
                        </span>
                    </div>
                )}

                {/* ── Wishlist button — top-right ── */}
                <button
                    onClick={handleWish}
                    aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
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
                    {isWished
                        ? <FaHeart size={12} className="text-[var(--icon-error)]" />
                        : <FaRegHeart size={12} className="text-neutral-300 group-hover:text-neutral-400 transition-colors" />}
                </button>

                {/* ── Low stock ribbon — bottom ── */}
                {isLowStock && (
                    <div className="
            absolute bottom-0 inset-x-0 z-10
            bg-[var(--icon-warning)]
            text-[var(--color-graphite-900)] text-[10px] font-bold
            text-center py-1 tracking-wide
          ">
                        Only {stockNum} left
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
              bg-[var(--color-graphite-900)]/85 text-white
              text-[11px] font-extrabold tracking-[0.15em] uppercase
              border border-white/20 px-5 py-2 rounded-full
              shadow-lg
            ">
                            Out of Stock
                        </div>

                        {notifyDone ? (
                            <span className="flex items-center gap-1.5 text-success text-[10px] font-bold
                               bg-success-tint px-3 py-1 rounded-full">
                                <FaBell size={9} /> Notified ✓
                            </span>
                        ) : notifyInput ? (
                            <div
                                className="flex w-[82%] max-w-[200px] rounded-full overflow-hidden
                            border border-neutral-300 shadow-lg bg-white"
                                onClick={e => e.stopPropagation()}
                            >
                                <input
                                    className="flex-1 min-w-0 px-3 py-1.5 text-[11px] outline-none
                             bg-transparent text-neutral-900 placeholder:text-neutral-400"
                                    type="email" placeholder="your@email.com"
                                    value={notifyEmail}
                                    onChange={e => setNotifyEmail(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleNotify(e)}
                                    autoFocus
                                />
                                <button
                                    onClick={handleNotify}
                                    disabled={notifyLoading}
                                    className="px-3 bg-[var(--color-graphite-900)] text-white text-[9px] font-extrabold
                             disabled:opacity-60 hover:bg-[var(--color-graphite-800)] transition-colors duration-200"
                                >
                                    {notifyLoading ? "…" : "GO"}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleNotify}
                                className="
                  flex items-center gap-1.5
                  bg-white text-neutral-900
                  text-[10px] font-bold uppercase tracking-wide
                  px-4 py-1.5 rounded-full
                  border border-neutral-200
                  hover:bg-neutral-50 transition-colors duration-200 shadow-md
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
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.12em] truncate mb-0.5">
                        {product.brand}
                    </p>
                )}

                {/* Product name */}
                <h3 className="
          text-[12px] leading-[1.35] font-medium
          text-neutral-900
          line-clamp-2
          mb-1.5
          capitalize
          group-hover:text-accent
          transition-colors duration-200
        ">
                    {product.name}
                </h3>

                {/* Stars */}
                {numReviews > 0 ? (
                    <div className="flex items-center gap-1 mb-1.5">
                        <span className="flex items-center gap-[2px] text-amber-400">
                            <StarRating rating={rating} />
                        </span>
                        <span className="text-[10px] text-neutral-700 font-semibold">
                            {rating.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                            ({numReviews.toLocaleString()})
                        </span>
                    </div>
                ) : (
                    <div className="mb-1.5 text-[10px] text-neutral-300 italic">No reviews yet</div>
                )}

                {/* Delivery line */}
                {!isOOS ? (
                    <p className="text-[10px] text-neutral-500 mb-1.5">
                        FREE delivery <span className="font-semibold text-success">Tomorrow</span>
                    </p>
                ) : (
                    <p className="text-[10px] text-error font-semibold mb-1.5">Currently unavailable</p>
                )}

                {/* Low stock text */}
                {isLowStock && !isOOS && (
                    <p className="text-[10px] text-error font-semibold mb-1.5">
                        Only {stockNum} left — order soon
                    </p>
                )}

                {/* ── Price block ─────────────────────────────── */}
                <div className="mt-auto mb-2">
                    {!isOOS ? (
                        <>
                            {/* Main price */}
                            <div className="flex items-start gap-0.5 leading-none mb-0.5">
                                <span className="text-[11px] font-semibold text-neutral-900 mt-[2px]">₹</span>
                                <span className="text-[18px] sm:text-[20px] font-bold text-neutral-900 tracking-tight">
                                    {priceInt.toLocaleString("en-IN")}
                                </span>
                                {priceDec && (
                                    <span className="text-[11px] font-semibold text-neutral-900 mt-[2px]">{priceDec}</span>
                                )}
                            </div>

                            {/* MRP + savings */}
                            {hasDisc && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-neutral-400">
                                        M.R.P.: <span className="line-through">₹{mrp.toLocaleString("en-IN")}</span>
                                    </span>
                                    <span className="text-[10px] text-success font-semibold
                                   bg-success-tint px-1.5 py-[1px] rounded-md">
                                        Save ₹{savedAmt}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-[12px] text-neutral-400 font-medium">Price unavailable</p>
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
                  bg-white hover:bg-accent-tint
                  border border-[var(--accent-primary)] rounded-lg
                  text-[11px] font-bold text-accent
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
                    rounded-lg text-[11px] font-bold
                    transition-all duration-200
                    shadow-sm hover:shadow-md active:scale-[0.98]
                    ${inCart && !hasVariants
                                            ? "bg-success-tint border border-[var(--icon-success)] text-success cursor-default shadow-none"
                                            : "bg-white hover:bg-accent-tint border border-[var(--accent-primary)] text-accent"}
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
                    bg-accent hover:bg-accent-hover
                    border border-transparent rounded-lg
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