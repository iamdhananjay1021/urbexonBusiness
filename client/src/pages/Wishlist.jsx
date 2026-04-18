/**
 * Wishlist.jsx — User Wishlist Page
 * Route: /wishlist
 */
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useCart } from "../hooks/useCart";
import { FaHeart, FaShoppingCart, FaTrash, FaBolt } from "react-icons/fa";
import SEO from "../components/SEO";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const CSS = `
*{box-sizing:border-box}
.wl-root{min-height:100vh;background:#f7f4ee;padding:32px clamp(12px,4vw,40px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wl-inner{max-width:1100px;margin:0 auto}
.wl-head{display:flex;align-items:center;gap:12px;margin-bottom:28px;flex-wrap:wrap;justify-content:space-between}
.wl-title{font-size:clamp(20px,3vw,26px);font-weight:800;color:#1a1740;display:flex;align-items:center;gap:10px}
.wl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.wl-card{background:#fff;border:1px solid #e8e4d9;border-radius:12px;overflow:hidden;position:relative;transition:all .2s}
.wl-card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(26,23,64,.1);border-color:#c9a84c}
.wl-img{width:100%;aspect-ratio:1;object-fit:cover;background:#f7f4ee;display:block}
.wl-rm{position:absolute;top:10px;right:10px;width:30px;height:30px;background:#fff;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#ef4444;box-shadow:0 2px 8px rgba(0,0,0,.12);transition:all .2s}
.wl-rm:hover{background:#fef2f2;transform:scale(1.1)}
.wl-body{padding:12px}
.wl-cat{font-size:9px;font-weight:700;color:#c9a84c;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}
.wl-name{font-size:13px;font-weight:600;color:#1a1740;line-height:1.35;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wl-price{font-size:16px;font-weight:800;color:#1a1740}
.wl-mrp{font-size:11px;color:#94a3b8;text-decoration:line-through;margin-left:6px}
.wl-disc{font-size:10px;font-weight:700;color:#ef4444;margin-left:5px}
.wl-add{width:100%;padding:9px;border:1.5px solid #1a1740;background:transparent;color:#1a1740;font-weight:700;font-size:11px;letter-spacing:1px;cursor:pointer;transition:all .2s;margin-top:8px;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:6px}
.wl-add:hover,.wl-add.added{background:#1a1740;color:#c9a84c}
.wl-empty{text-align:center;padding:80px 20px;background:#fff;border-radius:16px;border:1px solid #e8e4d9}
`;

const Wishlist = () => {
  const navigate = useNavigate();
  const { addItem, cartItems } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/wishlist")
      .then(({ data }) => setProducts(data.products || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const remove = async (id) => {
    setProducts(p => p.filter(x => x._id !== id));
    try { await api.delete(`/wishlist/${id}`); } catch { }
  };

  const addToCart = (product) => {
    addItem({ ...product, productType: product.productType || "ecommerce", quantity: 1 });
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ee" }}>
      <div style={{ width: 34, height: 34, border: "3px solid #e8e4d9", borderTop: "3px solid #c9a84c", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );

  return (
    <div className="wl-root">
      <SEO title="My Wishlist" noindex />
      <style>{CSS}</style>
      <div className="wl-inner">
        <div className="wl-head">
          <h1 className="wl-title"><FaHeart color="#ef4444" size={20} />My Wishlist <span style={{ fontSize: 15, color: "#94a3b8", fontWeight: 500 }}>({products.length})</span></h1>
          {products.length > 0 && (
            <button onClick={() => { products.forEach(p => addToCart(p)); alert("Sab items cart mein add ho gaye!"); }} style={{ padding: "9px 18px", background: "#1a1740", border: "none", color: "#c9a84c", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              Sab Cart Mein Add Karein
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <div className="wl-empty">
            <div style={{ fontSize: 56, marginBottom: 16, opacity: .3 }}>🤍</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1740", marginBottom: 8 }}>Wishlist Khali Hai</h2>
            <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>Apne pasandida products save karein</p>
            <button onClick={() => navigate("/")} style={{ padding: "11px 24px", background: "#1a1740", border: "none", color: "#c9a84c", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              Shopping Karein →
            </button>
          </div>
        ) : (
          <div className="wl-grid">
            {products.map(product => {
              const disc = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
              const inCart = cartItems.some(c => c._id === product._id);
              return (
                <div key={product._id} className="wl-card">
                  <Link to={`/products/${product.slug || product._id}`}>
                    <img className="wl-img" src={product.images?.[0]?.url || "/placeholder.png"} alt={product.name} onError={e => { e.target.src = "/placeholder.png"; }} />
                  </Link>
                  <button className="wl-rm" onClick={() => remove(product._id)}><FaTrash size={11} /></button>
                  <div className="wl-body">
                    {product.category && <div className="wl-cat">{product.category}</div>}
                    <div className="wl-name">{product.name}</div>
                    <div>
                      <span className="wl-price">{fmt(product.price)}</span>
                      {product.mrp > product.price && <span className="wl-mrp">{fmt(product.mrp)}</span>}
                      {disc > 0 && <span className="wl-disc">{disc}% OFF</span>}
                    </div>
                    {product.productType === "urbexon_hour" && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#c9a84c", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><FaBolt size={8} />Urbexon Hour</div>
                    )}
                    <button className={`wl-add ${inCart ? "added" : ""}`} onClick={() => addToCart(product)}>
                      <FaShoppingCart size={11} />{inCart ? "Cart Mein Hai" : "Cart Mein Add Karein"}
                    </button>
                  </div>
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
