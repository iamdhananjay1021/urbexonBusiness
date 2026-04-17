import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Outlet, useLocation } from "react-router-dom";

export default function MainLayout() {
    const { pathname } = useLocation();

    // Hide main navbar on Urbexon Hour pages
    const isUrbexonHour = pathname === "/urbexon-hour" || pathname.startsWith("/uh-");

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f7f4ee" }}>
            <Navbar />
            <main style={{ flex: 1 }}>
                <Outlet />
            </main>
            {!isUrbexonHour && <Footer />}
        </div>
    );
}
