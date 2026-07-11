/**
 * ProductCardUnified.jsx — Production-Ready Unified Product Card
 * Used across: Home, Products, Category, Deals, Urbexon Hour
 * Features: Proper styling, hover effects, cart/wishlist functionality
 * BUG FIXES: null safety, stock handling, navigation URL fallback
 * UI: Preserved original styling - no visual changes
 */
import { useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { FaStar, FaRegStar, FaShoppingCart, FaBolt, FaCheckCircle } from "react-icons/fa";

const ProductCardUnified = memo(({
    product,
    variant = "default", // "default" | "deal" | "compact"
    showDealBadge = false,
    dealCountdown = null,
}) => {
    const navigate = useNavigate();
    const { cartItems, addItem } = useCart();

    // Local flash state for "Add to Cart" success feedback
    const [flashAdded, setFlashAdded] = useState(false);

    // ═══════════════════════════════════════════════════════
    // NULL SAFETY - Guard against null/undefined product
    // BUG FIX: Prevent crash when product is null/undefined
    // ═══════════════════════════════════════════════════════════════
    if (!product) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col w-full h-full shadow-sm">
                <div className="w-full aspect-[4/5] sm:aspect-[3/4] bg-gray-100 animate-pulse shrink-0" />
                <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
                    <div className="h-2 w-1/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-4/5 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                </div>
            </div>
        );
    }

    // BUG FIX: Handle both _id and id fields
    const productId = product._id || product.id || "";

    // Data extraction
    // BUG FIX: Check cart correctly with productId fallback
    const inCart = cartItems.some(i => i._id === productId || i.productId === productId);

    // BUG FIX: Consistent stock logic
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

    const hasDisc = product.mrp && Number(product.mrp) > Number(product.price);
    const discPct = hasDisc ? Math.round(((Number(product.mrp) - Number(product.price)) / Number(product.mrp)) * 100) : null;
    const imgSrc = product.images?.[0]?.url || product.image || "";

    // Handlers
    const handleCart = useCallback((e) => {
        e.stopPropagation();
        if (inCart || isOOS) return;

        // ✅ FIX: Defensively set productType before adding to cart.
        // Any product with a `vendorId` is an Urbexon Hour product.
        // This prevents products from vendor pages being added to the wrong cart.
        const itemToAdd = {
            ...product,
            productType: product.vendorId ? 'urbexon_hour' : (product.productType || 'ecommerce'),
        };
        addItem(itemToAdd);
        setFlashAdded(true);
        setTimeout(() => setFlashAdded(false), 1400);
    }, [inCart, isOOS, product, addItem]);

    const handleQuickView = useCallback((e) => {
        e.stopPropagation();
        const isUrbexonHourProduct = !!product.vendorId || product.productType === 'urbexon_hour';
        // Navigation: UH/vendor products -> UH product detail, Ecommerce -> ecommerce product detail
        const productUrl = isUrbexonHourProduct
            ? `/uh-product/${product.slug || productId}`
            : `/products/${product.slug || productId}`;
        navigate(productUrl);
    }, [navigate, product, productId]);

    // Styles based on variant
    const containerClasses = {
        default: "group relative bg-white border border-stone-200 hover:border-[#c9a84c] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col h-full",
        deal: "group relative bg-white border border-stone-200 hover:border-[#c9a84c] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-[0_12px_36px_rgba(28,25,23,0.12)] flex flex-col h-full",
        compact: "group relative bg-white border border-stone-200 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md flex flex-col h-full",
    };

    return (
        <div
            onClick={handleQuickView}
            className={containerClasses[variant]}
        >
            {/* Image Container */}
            <div className="relative bg-[#f9f9f9] overflow-hidden aspect-[4/5] sm:aspect-[3/4] shrink-0 w-full group">
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={product.name}
                        loading="lazy"
                        className={`absolute inset-0 w-full h-full object-contain p-4 sm:p-6 transition-transform duration-500 ease-out mix-blend-multiply group-hover:scale-105 ${isOOS ? "grayscale opacity-60" : ""}`}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[#d1ccc7] text-4xl">📦</div>
                )}

                {/* Badges */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
                    {!isOOS && discPct && (
                        <span className="bg-red-600 text-white text-[10px] font-extrabold px-2 py-1 rounded tracking-wide">
                            {discPct}% OFF
                        </span>
                    )}
                    {isOOS && (
                        <span className="bg-stone-900 text-white text-[9px] font-extrabold px-2 py-1 rounded tracking-wide">
                            SOLD OUT
                        </span>
                    )}
                    {showDealBadge && !isOOS && (
                        <span className="bg-amber-500 text-white text-[9px] font-extrabold px-2 py-1 rounded tracking-wide">
                            🔥 DEAL
                        </span>
                    )}
                </div>

                {/* Hover Buttons - Stacked */}
                {variant !== "compact" && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent p-2.5 flex flex-col gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-20 hidden md:flex">
                        <button
                            onClick={handleCart}
                            disabled={inCart || isOOS}
                            className={`w-full py-2.5 text-[11px] font-bold tracking-wider uppercase border-none rounded flex items-center justify-center gap-1.5 transition-colors ${inCart ? "bg-green-100 text-green-700 cursor-default" :
                                flashAdded ? "bg-green-500 text-white" :
                                    isOOS ? "bg-stone-100 text-stone-400 cursor-default" :
                                        "bg-stone-900 text-white hover:bg-stone-800 cursor-pointer"
                                }`}
                        >
                            {inCart ? <><FaCheckCircle size={11} /> In Cart</> : flashAdded ? <>✓ Added!</> : <><FaShoppingCart size={11} /> Add to Cart</>}
                        </button>
                        <button
                            onClick={handleQuickView}
                            disabled={isOOS}
                            className={`w-full py-2.5 text-[11px] font-bold tracking-wider uppercase border-none rounded flex items-center justify-center gap-1.5 transition-colors ${isOOS ? "bg-stone-100 text-stone-400 cursor-default opacity-60" : "bg-[#c9a84c] text-white hover:bg-[#b5953e] cursor-pointer"
                                }`}
                        >
                            <FaBolt size={11} /> Quick View
                        </button>
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className="p-3 sm:p-4 flex-1 flex flex-col gap-1 sm:gap-1.5 min-w-0">
                {/* Category */}
                <div className="flex justify-between items-center mb-0.5">
                    <p className="text-[9px] font-bold text-[#c9a84c] tracking-widest uppercase truncate">
                        {product.category || "Product"}
                    </p>
                    {product.brand && (
                        <p className="text-[9px] font-semibold text-gray-400 truncate max-w-[50%] text-right uppercase tracking-wider">
                            {product.brand}
                        </p>
                    )}
                </div>

                {/* Name */}
                <h3 className="text-[13px] sm:text-[14px] font-bold text-stone-900 leading-snug line-clamp-2 min-h-[2.6em] mb-1 group-hover:text-blue-600 transition-colors">
                    {product.name}
                </h3>

                {/* Quick Details/Specs */}
                {product.specs && product.specs.length > 0 && (
                    <div className="text-[10px] color-gray-500 mb-1 line-clamp-1 truncate">
                        {product.specs.slice(0, 1).map((spec, i) => (
                            <span key={i} className="text-gray-500">
                                {spec.name}: <span className="font-semibold text-gray-700">{spec.value}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Stock Availability */}
                <div className="text-[10px] font-semibold mb-1 flex items-center gap-2">
                    {isOOS ? (
                        <span className="text-red-600">❌ Out of Stock</span>
                    ) : (
                        <span className="text-green-600">✓ In Stock</span>
                    )}
                    {stockNum > 0 && stockNum <= 5 && !isOOS && (
                        <span className="text-amber-500 font-bold">Only {stockNum} left</span>
                    )}
                </div>

                {/* Rating */}
                {product.numReviews > 0 && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="flex gap-[1px]">
                            {[...Array(5)].map((_, i) => (
                                <span key={i}>
                                    {i < Math.floor(product.rating || 0) ? (
                                        <FaStar size={10} className="text-amber-500" />
                                    ) : (
                                        <FaRegStar size={10} className="text-gray-300" />
                                    )}
                                </span>
                            ))}
                        </div>
                        <span className="text-[10px] sm:text-[11px] text-gray-400 font-medium">
                            {product.rating?.toFixed(1)} ({product.numReviews})
                        </span>
                    </div>
                )}

                {/* Price */}
                <div className="mt-auto pt-2 flex items-baseline gap-1.5 flex-wrap">
                    <span className={`text-[15px] sm:text-[16px] font-extrabold ${isOOS ? "text-stone-400" : "text-stone-900"}`}>
                        ₹{Number(product.price).toLocaleString("en-IN")}
                    </span>
                    {hasDisc && !isOOS && (
                        <span className="text-[11px] sm:text-[12px] font-semibold text-gray-400 line-through">
                            ₹{Number(product.mrp).toLocaleString("en-IN")}
                        </span>
                    )}
                </div>

                {/* Savings */}
                {hasDisc && !isOOS && (
                    <p className="text-[10px] text-green-600 font-bold mt-0.5">
                        Save ₹{(Number(product.mrp) - Number(product.price)).toLocaleString("en-IN")}
                    </p>
                )}

                {/* Deal Countdown */}
                {dealCountdown && (
                    <div className="mt-2.5 p-2 bg-orange-50 border border-orange-200 rounded-md flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] text-red-600 font-extrabold uppercase tracking-wide">⏱ Ends in:</span>
                        <div className="flex gap-1 text-[11px] font-bold text-orange-800">
                            {dealCountdown}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

ProductCardUnified.displayName = "ProductCardUnified";

export default ProductCardUnified;