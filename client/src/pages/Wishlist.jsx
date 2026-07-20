/**
 * Wishlist.jsx — User Wishlist Page
 * Route: /wishlist
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as wishlistApi from "../api/wishlistApi";
import { useCart } from "../hooks/useCart";
import { FiHeart, FiShoppingCart, FiZap } from "react-icons/fi";
import SEO from "../components/SEO";
import Loader from "../design-system/Loader";
import Button from "../design-system/Button";
import ProductCard from "../components/ProductCard";
import { EmptyState } from "../design-system/EmptyState";
import { showToast } from "../utils/toast";

const Wishlist = () => {
  const navigate = useNavigate();
  const { addItem, cartItems } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wishlistApi.getWishlist()
      .then(({ data }) => setProducts(data.products || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const remove = async (id) => {
    setProducts(p => p.filter(x => x._id !== id));
    try { await wishlistApi.removeFromWishlist(id); } catch { /* remove-from-wishlist failed — intentionally silent, no UI change on error */ }
  };

  const addToCart = (product) => {
    // BUG FIX: defaulted straight to "ecommerce" whenever productType was
    // missing, without checking vendorId first — the same defensive check
    // ProductCard.jsx already applies. A wishlisted UH product missing an
    // explicit productType tag would silently land in the ecommerce cart
    // (and from there, the ecommerce checkout) instead of the UH one.
    addItem({ ...product, productType: product.vendorId ? "urbexon_hour" : (product.productType || "ecommerce"), quantity: 1 });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Loader size="lg" />
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas px-[clamp(12px,4vw,40px)] py-8">
      <SEO title="My Wishlist" noindex />
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center gap-3 mb-7 flex-wrap justify-between">
          <h1 className="text-[clamp(20px,3vw,26px)] font-bold text-primary font-display flex items-center gap-2.5">
            <FiHeart className="text-[var(--color-error-500)] fill-[var(--color-error-500)]" size={20} aria-hidden="true" />
            My Wishlist <span className="text-[15px] text-muted font-medium">({products.length})</span>
          </h1>
          {products.length > 0 && (
            <Button
              variant="primary"
              onClick={() => { products.forEach(p => addToCart(p)); showToast("All items added to cart!", "success"); }}
            >
              Add All to Cart
            </Button>
          )}
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={FiHeart}
            title="Your Wishlist is Empty"
            description="Save your favorite products"
            action={<Button variant="primary" onClick={() => navigate("/")}>Start Shopping →</Button>}
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {products.map(product => {
              const inCart = cartItems.some(c => c._id === product._id);
              return (
                <div key={product._id} className="flex flex-col gap-2">
                  {/* Global card — navigation (incl. UH → /uh-product) is handled
                      inside it; heart is forced on and removes from this list. */}
                  <ProductCard
                    product={product}
                    hideActions
                    wishlisted
                    onWishlistToggle={() => remove(product._id)}
                  />
                  {product.productType === "urbexon_hour" && (
                    <div className="text-[9px] font-bold text-accent flex items-center gap-1 -mt-1">
                      <FiZap size={8} aria-hidden="true" />Urbexon Hour
                    </div>
                  )}
                  <Button
                    variant={inCart ? "primary" : "outline"}
                    size="sm"
                    icon={FiShoppingCart}
                    onClick={() => addToCart(product)}
                  >
                    {inCart ? "In Cart" : "Add to Cart"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default Wishlist;
