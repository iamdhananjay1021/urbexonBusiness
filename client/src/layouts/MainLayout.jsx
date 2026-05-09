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

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f7f4ee" }}>
            {!hideNavAndFooter && <Navbar />}
            <main style={{ flex: 1 }}>
                <Outlet />
            </main>
            {!hideNavAndFooter && !isUrbexonHour && <Footer />}
        </div>
    );
}
