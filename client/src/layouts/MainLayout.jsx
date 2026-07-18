import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Outlet, useLocation } from "react-router-dom";

export default function MainLayout() {
    const { pathname } = useLocation();

    const currentPath = pathname.toLowerCase();

    // Hide main navbar on Urbexon Hour pages
    const isUrbexonHour = currentPath.startsWith("/urbexon-hour") || currentPath.startsWith("/uh-");

    // Pages where BOTH Navbar and Footer should be hidden (within MainLayout routes)
    const noNavFooterPaths = [
        "/forgot-password",
        "/reset-password",
        "/checkout",
        "/uh-checkout",
        "/verify-invoice",
        "/order-success",
        "/cart",
        "/uh-cart",
        "/profile"
    ];

    const hideNavAndFooter = noNavFooterPaths.some(p => currentPath.startsWith(p));

    // Footer is WHITELISTED to discovery/content pages only — on app-style
    // pages (orders, wishlist, notifications, order details, …) the big
    // footer was pure noise under short content. Navbar logic is unchanged.
    const footerPaths = [
        "/products",        // listing + /products/:id detail
        "/category/",
        "/collections/",
        "/deals",
        "/vendor/",
        "/contact",
        "/privacy-policy",
        "/terms-conditions",
        "/refund-policy",
        "/become-vendor",
        "/about",
    ];
    const showFooter =
        !hideNavAndFooter &&
        !isUrbexonHour &&
        (currentPath === "/" || footerPaths.some(p => currentPath.startsWith(p)));

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-canvas)" }}>
            {!hideNavAndFooter && <Navbar />}
            {/* The navbar is fixed; every page starts below it via the
                --nav-h variable the navbar itself measures & publishes
                (ResizeObserver — category bar, font loads, breakpoints all
                accounted for). No hardcoded offsets anywhere. When the
                navbar is hidden/unmounted, --nav-h resets to 0px. */}
            <main style={{ flex: 1, paddingTop: "var(--nav-h, 0px)" }}>
                <Outlet />
            </main>
            {showFooter && <Footer />}
        </div>
    );
}
