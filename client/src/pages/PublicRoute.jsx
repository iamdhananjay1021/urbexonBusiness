/**
 * PublicRoute.jsx
 *
 * Handles routes that should only be accessible to unauthenticated users.
 * If a logged-in user tries to access these pages, they are redirected to the dashboard.
 *
 * FIX: This component previously blocked access to reset-password if a token existed.
 * The logic is now corrected to allow access to the reset password page regardless of auth state.
 */
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const PublicRoute = () => {
    const { vendor } = useAuth();
    const location = useLocation();

    // Allow access to reset-password page even if logged in
    if (vendor && !location.pathname.includes('/reset-password')) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export default PublicRoute;