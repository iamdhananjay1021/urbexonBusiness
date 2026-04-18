import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHome, FaSearch } from "react-icons/fa";
import SEO from "../components/SEO";

const NotFound = () => {
    const navigate = useNavigate();
    return (
        <div style={{ minHeight: "100vh", background: "#f7f4ee", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", padding: "40px 20px", textAlign: "center" }}>
            <SEO title="Page Not Found" description="The page you're looking for doesn't exist." noindex />
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
            <div>
                <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(6rem,20vw,10rem)", fontWeight: 700, color: "#e8e4d9", lineHeight: 1, margin: "0 0 8px" }}>404</p>
                <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 700, color: "#1a1740", marginBottom: 12 }}>Page Not Found</h1>
                <p style={{ fontSize: 14, color: "#78716c", marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => navigate(-1)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", border: "1.5px solid #1a1740", background: "transparent", color: "#1a1740", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        <FaArrowLeft size={11} /> Go Back
                    </button>
                    <button onClick={() => navigate("/")}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "#1a1740", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        <FaHome size={11} /> Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotFound;