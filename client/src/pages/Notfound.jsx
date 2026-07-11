import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiHome } from "react-icons/fi";
import SEO from "../components/SEO";
import Button from "../design-system/Button";

const NotFound = () => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-canvas flex items-center justify-center px-5 py-10 text-center">
            <SEO title="Page Not Found" description="The page you're looking for doesn't exist." noindex />
            <div>
                <p className="font-display font-bold text-[var(--color-graphite-200)] leading-none mb-2" style={{ fontSize: "clamp(6rem, 20vw, 10rem)" }}>
                    404
                </p>
                <h1 className="font-display font-bold text-primary mb-3" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
                    Page Not Found
                </h1>
                <p className="text-sm text-secondary mb-8 max-w-[360px] mx-auto">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                    <Button variant="outline" icon={FiArrowLeft} onClick={() => navigate(-1)}>
                        Go Back
                    </Button>
                    <Button variant="primary" icon={FiHome} onClick={() => navigate("/")}>
                        Home
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
