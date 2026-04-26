/**
 * ProductCardUnified.jsx — Production-Ready Unified Product Card
 * Used across: Home, Products, Category, Deals, Urbexon Hour
 * Features: Proper styling, hover effects, cart/wishlist functionality
 */
import { useCallback, useState, memo } from "react";
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
    const [hovered, setHovered] = useState(false);
    const [flashAdded, setFlashAdded] = useState(false);

    // Data extraction
    const inCart = cartItems.some(i => i._id === product._id);
    const isOOS = product.inStock === false || Number(product.stock ?? 0) === 0;
    const hasDisc = product.mrp && Number(product.mrp) > Number(product.price);
    const discPct = hasDisc ? Math.round(((Number(product.mrp) - Number(product.price)) / Number(product.mrp)) * 100) : null;
    const imgSrc = product.images?.[0]?.url || product.image || "";

    // Handlers
    const handleCart = useCallback((e) => {
        e.stopPropagation();
        if (inCart || isOOS) return;
        addItem(product);
        setFlashAdded(true);
        setTimeout(() => setFlashAdded(false), 1400);
    }, [inCart, isOOS, product, addItem]);

    const handleQuickView = useCallback((e) => {
        e.stopPropagation();
        navigate(`/products/${product.slug || product._id}`);
    }, [navigate, product]);

    // Styles based on variant
    const containerStyles = {
        default: {
            background: "#fff",
            border: `1px solid ${hovered ? "#c9a84c" : "#e8e4d9"}`,
            borderRadius: 8,
            overflow: "hidden",
            cursor: "pointer",
            transition: "all .2s ease",
            transform: hovered ? "translateY(-2px)" : "translateY(0)",
            boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.08)" : "none",
            aspectRatio: "3/4",
            display: "flex",
            flexDirection: "column",
        },
        deal: {
            background: "#fff",
            border: `1px solid ${hovered ? "#c9a84c" : "#e8e4d9"}`,
            borderRadius: 8,
            overflow: "hidden",
            cursor: "pointer",
            transition: "all .28s cubic-bezier(.22,1,.36,1)",
            transform: hovered ? "translateY(-4px)" : "translateY(0)",
            boxShadow: hovered ? "0 12px 36px rgba(28,25,23,.12)" : "0 2px 8px rgba(0,0,0,.04)",
            aspectRatio: "3/4",
            display: "flex",
            flexDirection: "column",
        },
        compact: {
            background: "#fff",
            border: "1px solid #e8e4d9",
            borderRadius: 6,
            overflow: "hidden",
            cursor: "pointer",
            transition: "all .2s ease",
            transform: hovered ? "scale(1.02)" : "scale(1)",
            boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
            aspectRatio: "3/4",
            display: "flex",
            flexDirection: "column",
        },
    };

    return (
        <div
            onClick={handleQuickView}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={containerStyles[variant]}
        >
            {/* Image Container */}
            <div style={{ position: "relative", background: "#f7f4ee", overflow: "hidden", aspectRatio: "3/4", flexShrink: 0 }}>
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={product.name}
                        loading="lazy"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: "center",
                            display: "block",
                            transform: hovered ? "scale(1.06)" : "scale(1)",
                            transition: "transform .5s cubic-bezier(.34,1.1,.64,1)",
                            filter: isOOS ? "grayscale(.7) opacity(.6)" : "none",
                        }}
                    />
                ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#d1ccc7", fontSize: 40 }}>
                        📦
                    </div>
                )}

                {/* Badges */}
                <div style={{ position: "absolute", top: 10, left: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {!isOOS && discPct && (
                        <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 4 }}>
                            -{discPct}%
                        </span>
                    )}
                    {isOOS && (
                        <span style={{ background: "#1c1917", color: "#fff", fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 4 }}>
                            SOLD OUT
                        </span>
                    )}
                    {showDealBadge && !isOOS && (
                        <span style={{ background: "#f59e0b", color: "#fff", fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 4 }}>
                            🔥 DEAL
                        </span>
                    )}
                </div>

                {/* Hover Buttons - Stacked */}
                {variant !== "compact" && (
                    <div style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,.95))",
                        padding: "12px 10px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        transform: hovered ? "translateY(0)" : "translateY(100%)",
                        transition: "transform .25s cubic-bezier(.22,1,.36,1)",
                        zIndex: 2,
                    }}>
                        <button
                            onClick={handleCart}
                            disabled={inCart || isOOS}
                            style={{
                                width: "100%",
                                padding: "10px 0",
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: ".08em",
                                textTransform: "uppercase",
                                border: "none",
                                cursor: inCart || isOOS ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                background: inCart ? "#dcfce7" : flashAdded ? "#22c55e" : isOOS ? "#f5f5f5" : "#1c1917",
                                color: inCart ? "#15803d" : flashAdded ? "#fff" : isOOS ? "#a1a1aa" : "#fff",
                                fontFamily: "inherit",
                                borderRadius: 5,
                                transition: "all .15s ease",
                            }}
                        >
                            {inCart ? <><FaCheckCircle size={10} /> In Cart</> : flashAdded ? <>✓ Added!</> : <><FaShoppingCart size={10} /> Add to Cart</>}
                        </button>
                        <button
                            onClick={handleQuickView}
                            disabled={isOOS}
                            style={{
                                width: "100%",
                                padding: "10px 0",
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: ".08em",
                                textTransform: "uppercase",
                                background: isOOS ? "#f5f5f5" : "#c9a84c",
                                color: isOOS ? "#a1a1aa" : "#fff",
                                border: "none",
                                cursor: isOOS ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                transition: "all .15s ease",
                                fontFamily: "inherit",
                                borderRadius: 5,
                                opacity: isOOS ? 0.6 : 1,
                            }}
                        >
                            <FaBolt size={10} /> Quick View
                        </button>
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Category */}
                <p style={{ fontSize: 9, fontWeight: 700, color: "#c9a84c", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 2 }}>
                    {product.category || "Product"}
                </p>

                {/* Brand */}
                {product.brand && (
                    <p style={{ fontSize: 9, fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>
                        {product.brand}
                    </p>
                )}

                {/* Name */}
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1c1917", lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {product.name}
                </h3>

                {/* Quick Details/Specs */}
                {product.specs && product.specs.length > 0 && (
                    <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {product.specs.slice(0, 1).map((spec, i) => (
                            <span key={i}>
                                {spec.name}: <span style={{ fontWeight: 600 }}>{spec.value}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Stock Availability */}
                <div style={{ fontSize: 9, fontWeight: 600, marginBottom: 4 }}>
                    {isOOS ? (
                        <span style={{ color: "#dc2626" }}>❌ Out of Stock</span>
                    ) : (
                        <span style={{ color: "#16a34a" }}>✓ In Stock</span>
                    )}
                    {product.stock > 0 && product.stock <= 5 && !isOOS && (
                        <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 700 }}>Only {product.stock} left</span>
                    )}
                </div>

                {/* Rating */}
                {product.numReviews > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 1 }}>
                            {[...Array(5)].map((_, i) => (
                                <span key={i}>
                                    {i < Math.floor(product.rating || 0) ? (
                                        <FaStar size={9} color="#f59e0b" />
                                    ) : (
                                        <FaRegStar size={9} color="#d1d5db" />
                                    )}
                                </span>
                            ))}
                        </div>
                        <span style={{ fontSize: 9, color: "#9ca3af" }}>
                            {product.rating?.toFixed(1)} ({product.numReviews})
                        </span>
                    </div>
                )}

                {/* Price */}
                <div style={{ marginTop: "auto", display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: isOOS ? "#a8a29e" : "#1c1917" }}>
                        ₹{Number(product.price).toLocaleString("en-IN")}
                    </span>
                    {hasDisc && !isOOS && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textDecoration: "line-through" }}>
                            ₹{Number(product.mrp).toLocaleString("en-IN")}
                        </span>
                    )}
                </div>

                {/* Savings */}
                {hasDisc && !isOOS && (
                    <p style={{ fontSize: 9, color: "#16a34a", fontWeight: 700, marginTop: 2 }}>
                        Save ₹{(Number(product.mrp) - Number(product.price)).toLocaleString("en-IN")}
                    </p>
                )}

                {/* Deal Countdown */}
                {dealCountdown && (
                    <div style={{ marginTop: 10, padding: "6px 8px", background: "#fff8f0", border: "1px solid #fed7aa", borderRadius: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 8, color: "#dc2626", fontWeight: 800 }}>⏱ Ends in:</span>
                        <div style={{ display: "flex", gap: 3 }}>
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
