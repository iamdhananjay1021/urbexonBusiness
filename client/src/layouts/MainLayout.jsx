import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Outlet, useLocation } from "react-router-dom";

export default function MainLayout() {
    const { pathname } = useLocation();

    // Hide main navbar on Urbexon Hour pages
    const isUrbexonHour = pathname === "/urbexon-hour" || pathname.startsWith("/uh-");

    // Pages where BOTH Navbar and Footer should be hidden
    const noNavFooterPaths = [
        "/login",
        "/register",
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
    const hideNavAndFooter = noNavFooterPaths.some(p => pathname.startsWith(p));

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
