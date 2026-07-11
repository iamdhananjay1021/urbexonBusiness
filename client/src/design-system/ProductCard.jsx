import { FiHeart, FiStar } from "react-icons/fi";
import Card from "./Card";
import Badge from "./Badge";
import { cn } from "./utils/cn";
import { imgUrl, imgSrcSet } from "../utils/imageUrl";

/**
 * Signal Design System — ProductCard
 * Field names match the real Product schema confirmed during the backend
 * audit (name, price, mrp, images[0].url, rating, numReviews, inStock,
 * productType). This is a presentational component only — no cart/wishlist
 * logic wired in; the caller passes onAddToCart/onWishlistToggle handlers so
 * existing business logic stays untouched when this is wired into real pages.
 */
const ProductCard = ({
  product,
  wishlisted = false,
  onWishlistToggle,
  onClick,
  isHour = false,
  className = "",
}) => {
  const { name, price, mrp, images, rating, numReviews, inStock } = product;
  const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return (
    <Card
      interactive
      padding="none"
      onClick={onClick}
      className={cn("overflow-hidden flex flex-col", className)}
    >
      <div className="relative aspect-square bg-canvas">
        <img
          src={imgUrl.card(images?.[0]?.url || "") || "/placeholder.png"}
          srcSet={imgSrcSet(images?.[0]?.url, 400)}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.png";
          }}
        />
        {discount > 0 && (
          <Badge variant={isHour ? "hour" : "accent"} className="absolute top-2 left-2">
            {discount}% OFF
          </Badge>
        )}
        {!inStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-[var(--bg-overlay)]">
            <span className="text-white text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-graphite-900)]">
              Out of stock
            </span>
          </span>
        )}
        {onWishlistToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWishlistToggle();
            }}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={wishlisted}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-surface/90 flex items-center justify-center shadow-sm"
          >
            <FiHeart
              className={cn("h-4 w-4", wishlisted ? "fill-[var(--color-error-500)] text-[var(--color-error-500)]" : "text-secondary")}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm text-primary font-medium line-clamp-2 leading-snug">{name}</p>

        {rating > 0 && (
          <div className="flex items-center gap-1 text-xs text-secondary">
            <FiStar className="h-3 w-3 fill-[var(--color-warning-500)] text-[var(--color-warning-500)]" aria-hidden="true" />
            <span className="font-medium text-primary">{rating.toFixed(1)}</span>
            {numReviews > 0 && <span>({numReviews})</span>}
          </div>
        )}

        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-[15px] font-semibold text-primary">₹{price?.toLocaleString("en-IN")}</span>
          {mrp > price && (
            <span className="text-xs text-muted line-through">₹{mrp.toLocaleString("en-IN")}</span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProductCard;
