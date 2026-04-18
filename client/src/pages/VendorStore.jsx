import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaStar, FaMapMarkerAlt, FaArrowLeft, FaStore, FaBox } from "react-icons/fa";
import api from "../api/axios";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";

const VendorStore = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [vendor, setVendor] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStore = async () => {
            try {
                setLoading(true);
                const { data } = await api.get(`/vendor/store/${slug}`);
                if (data.success) {
                    setVendor(data.vendor);
                    setProducts(data.products);
                } else {
                    setError("Store not found");
                }
            } catch {
                setError("Store not found");
            } finally {
                setLoading(false);
            }
        };
        fetchStore();
    }, [slug]);

    if (loading) {
        return (
            <div style={styles.loaderWrap}>
                <div style={styles.spinner} />
                <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
            </div>
        );
    }

    if (error || !vendor) {
        return (
            <div style={styles.errorWrap}>
                <FaStore size={48} color="#d6d3d1" />
                <h2 style={styles.errorTitle}>Store Not Found</h2>
                <p style={styles.errorMsg}>This vendor store doesn't exist or is no longer available.</p>
                <button onClick={() => navigate("/")} style={styles.homeBtn}>Go Home</button>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <SEO
                title={vendor?.shopName || "Vendor Store"}
                description={`Shop at ${vendor?.shopName || "this vendor"} on Urbexon. ${vendor?.address?.city ? `Located in ${vendor.address.city}.` : ""} Browse products and order now.`}
                path={`/vendor/${slug}`}
            />
            <style>{css}</style>

            {/* Banner */}
            <div style={{ ...styles.banner, backgroundImage: vendor.shopBanner ? `url(${vendor.shopBanner})` : undefined }}>
                <div style={styles.bannerOverlay} />
                <button onClick={() => navigate(-1)} style={styles.backBtn}>
                    <FaArrowLeft size={14} /> Back
                </button>
            </div>

            {/* Vendor Info */}
            <div style={styles.infoSection}>
                <div style={styles.infoInner}>
                    <div style={styles.logoWrap}>
                        {vendor.shopLogo
                            ? <img src={vendor.shopLogo} alt={vendor.shopName} style={styles.logo} />
                            : <div style={styles.logoFallback}>{vendor.shopName?.[0]?.toUpperCase() || "S"}</div>
                        }
                    </div>
                    <div style={styles.infoText}>
                        <h1 style={styles.shopName}>{vendor.shopName}</h1>
                        <div style={styles.metaRow}>
                            {vendor.shopCategory && <span style={styles.badge}>{vendor.shopCategory}</span>}
                            <span style={styles.ratingBadge}>
                                <FaStar size={12} color="#f59e0b" />
                                {(vendor.rating || 0).toFixed(1)}
                                {vendor.ratingCount > 0 && <span style={styles.ratingCount}>({vendor.ratingCount})</span>}
                            </span>
                            {(vendor.address?.city || vendor.address?.state) && (
                                <span style={styles.location}>
                                    <FaMapMarkerAlt size={11} />
                                    {[vendor.address.city, vendor.address.state].filter(Boolean).join(", ")}
                                </span>
                            )}
                        </div>
                        {vendor.shopDescription && <p style={styles.desc}>{vendor.shopDescription}</p>}
                        <div style={styles.statsRow}>
                            <div style={styles.stat}>
                                <FaBox size={14} color="#6366f1" />
                                <span><b>{products.length}</b> Products</span>
                            </div>
                            <div style={styles.stat}>
                                <FaStore size={14} color="#6366f1" />
                                <span><b>{vendor.totalOrders || 0}+</b> Orders</span>
                            </div>
                            <div style={{ ...styles.statusDot, background: vendor.isOpen ? "#22c55e" : "#ef4444" }}>
                                {vendor.isOpen ? "Open" : "Closed"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div style={styles.productsSection}>
                <h2 style={styles.productsTitle}>Products</h2>
                {products.length === 0 ? (
                    <div style={styles.emptyProducts}>
                        <FaBox size={40} color="#d6d3d1" />
                        <p>No products available yet.</p>
                    </div>
                ) : (
                    <div className="vs-products-grid">
                        {products.map(p => (
                            <ProductCard key={p._id} product={p} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
.vs-products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}
@media(max-width:640px){.vs-products-grid{grid-template-columns:repeat(2,1fr);gap:10px}}
`;

const styles = {
    page: { minHeight: "100vh", background: "#f7f4ee", fontFamily: "'DM Sans',sans-serif" },
    loaderWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ee" },
    spinner: { width: 36, height: 36, border: "3px solid #e8e4d9", borderTop: "3px solid #c9a84c", borderRadius: "50%", animation: "spin .8s linear infinite" },
    errorWrap: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f7f4ee", gap: 16, padding: 20, textAlign: "center" },
    errorTitle: { fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: "#1a1740", margin: 0 },
    errorMsg: { fontSize: 14, color: "#78716c", maxWidth: 360 },
    homeBtn: { padding: "12px 28px", background: "#1a1740", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" },

    banner: { height: 200, background: "linear-gradient(135deg,#1a1740 0%,#312e81 100%)", backgroundSize: "cover", backgroundPosition: "center", position: "relative" },
    bannerOverlay: { position: "absolute", inset: 0, background: "rgba(26,23,64,0.4)" },
    backBtn: { position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, zIndex: 2, borderRadius: 8 },

    infoSection: { maxWidth: 1200, margin: "0 auto", padding: "0 20px", marginTop: -40, position: "relative", zIndex: 2 },
    infoInner: { background: "#fff", borderRadius: 16, padding: "24px 28px", display: "flex", gap: 20, alignItems: "flex-start", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", flexWrap: "wrap" },
    logoWrap: { flexShrink: 0 },
    logo: { width: 80, height: 80, borderRadius: 16, objectFit: "cover", border: "3px solid #f7f4ee" },
    logoFallback: { width: 80, height: 80, borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 32, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
    infoText: { flex: 1, minWidth: 200 },
    shopName: { fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 700, color: "#1a1740", margin: "0 0 8px" },
    metaRow: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 },
    badge: { padding: "4px 12px", background: "#f0ecff", color: "#6366f1", fontSize: 12, fontWeight: 600, borderRadius: 20 },
    ratingBadge: { display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#1a1740" },
    ratingCount: { color: "#78716c", fontWeight: 400, fontSize: 12 },
    location: { display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#78716c" },
    desc: { fontSize: 14, color: "#78716c", lineHeight: 1.6, margin: "8px 0 12px", maxWidth: 600 },
    statsRow: { display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" },
    stat: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#444" },
    statusDot: { padding: "4px 12px", borderRadius: 20, color: "#fff", fontSize: 12, fontWeight: 600 },

    productsSection: { maxWidth: 1200, margin: "0 auto", padding: "32px 20px 60px" },
    productsTitle: { fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: "#1a1740", marginBottom: 20 },
    emptyProducts: { textAlign: "center", padding: "60px 20px", color: "#78716c", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
};

export default VendorStore;
