import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SEO from "../components/SEO";
import api from "../api/axios";
import ProductCard from "../components/ProductCard";
import { FaFire } from "react-icons/fa";

/* ════════════════════════════════════
   COUNTDOWN HOOK
════════════════════════════════════ */
const useCountdown = (dealEndsAt) => {
    const calc = () => {
        const diff = new Date(dealEndsAt) - new Date();
        if (diff <= 0) return null;
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        return { d, h, m, s };
    };
    const [time, setTime] = useState(calc);
    useEffect(() => {
        if (!dealEndsAt) return;
        const t = setInterval(() => setTime(calc()), 1000);
        return () => clearInterval(t);
    }, [dealEndsAt]);
    return time;
};

/* ════════════════════════════════════
   DEAL PRODUCT CARD WRAPPER
════════════════════════════════════ */
const DealCountdownDisplay = ({ countdown }) => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
        {[[countdown.d, "D"], [countdown.h, "H"], [countdown.m, "M"], [countdown.s, "S"]].map(([v, l]) => (
            <span key={l} style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, minWidth: 28, textAlign: "center" }}>
                {String(v).padStart(2, "0")}{l}
            </span>
        ))}
    </div>
);

const DealProductCard = ({ product }) => {
    const countdown = useCountdown(product.dealEndsAt);
    const countdownJSX = countdown ? <DealCountdownDisplay countdown={countdown} /> : null;

    return (
        <ProductCard
            product={product}
            footer={countdownJSX}
        />
    );
};

/* ════════════════════════════════════
   SKELETON
════════════════════════════════════ */
const SkeletonCard = () => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full w-full shadow-sm">
        <div className="w-full aspect-[4/5] bg-gray-100 animate-pulse shrink-0" />
        <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
            <div className="h-2 w-1/3 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
            <div className="mt-auto pt-2 space-y-2">
                <div className="h-4 w-2/5 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
            </div>
        </div>
    </div>
);

/* ════════════════════════════════════
   MAIN DEALS PAGE
════════════════════════════════════ */
const Deals = () => {
    const navigate = useNavigate();
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const { data } = await api.get("/products/deals");
                setDeals(data.products || (Array.isArray(data) ? data : []));
            } catch {
                setError("Failed to load deals. Please try again.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100vh", background: "#faf9f7" }}>
            <SEO title="Deals & Offers" description="Grab the hottest deals and limited-time offers on Urbexon. Save big on fashion, electronics, and more." path="/deals" />

            {/* Header Banner */}
            <div style={{ background: "linear-gradient(135deg, #1c1917 0%, #1a1740 60%, #c9a84c22 100%)", padding: "48px clamp(16px,5vw,80px)" }}>
                <div style={{ maxWidth: 1440, margin: "0 auto" }}>
                    <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase", color: "#c9a84c", marginBottom: 10 }}>
                        ✦ Limited Time
                    </p>
                    <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 700, color: "#fff", lineHeight: 1.15, margin: 0 }}>
                        Hot <span style={{ color: "#c9a84c" }}>Deals</span>
                    </h1>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,.55)", marginTop: 10, maxWidth: 480 }}>
                        Best discounts on top products — grab them before they expire!
                    </p>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: 1440, margin: "0 auto", padding: "48px clamp(16px,5vw,80px) 80px" }}>

                {/* Loading */}
                {loading && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                        {Array(10).fill(0).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div style={{ textAlign: "center", padding: "80px 20px" }}>
                        <p style={{ fontSize: 14, color: "#dc2626", marginBottom: 16 }}>{error}</p>
                        <button onClick={() => window.location.reload()}
                            style={{ padding: "10px 24px", background: "#1c1917", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                            Try Again
                        </button>
                    </div>
                )}

                {/* Empty */}
                {!loading && !error && deals.length === 0 && (
                    <div style={{ textAlign: "center", padding: "100px 20px" }}>
                        <p style={{ fontSize: 52, marginBottom: 16 }}>🔥</p>
                        <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.8rem", color: "#1a1740", marginBottom: 8 }}>
                            No Active Deals
                        </h3>
                        <p style={{ fontSize: 14, color: "#a8a29e", marginBottom: 28 }}>
                            Check back soon — new deals drop regularly!
                        </p>
                        <button onClick={() => navigate("/")}
                            style={{ padding: "12px 28px", background: "#1c1917", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontFamily: "inherit" }}>
                            Browse All Products
                        </button>
                    </div>
                )}

                {/* Deals Grid */}
                {!loading && !error && deals.length > 0 && (
                    <>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
                            <FaFire style={{ color: "#f59e0b" }} />
                            <p style={{ fontSize: 14, color: "#78716c", fontWeight: 500 }}>
                                <b style={{ color: "#1c1917" }}>{deals.length}</b> active deal{deals.length !== 1 ? "s" : ""} — hurry, limited time!
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                            {deals.map(p => <DealProductCard key={p._id || p.id} product={p} />)}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Deals;