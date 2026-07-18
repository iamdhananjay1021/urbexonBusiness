import { Toast, useToast } from "./components/Toast";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { BrowserRouter as Router } from "react-router-dom";
import { AdminAuthProvider } from "./auth/AdminAuthContext";
import AppRoutes from "./routes/AppRoutes";
import "./App.css";

function App() {
    const { toast, showToast } = useToast();
    useEffect(() => {
        const h = (e) => showToast(e.detail.message, e.detail.type || "error");
        window.addEventListener("api:error", h);
        return () => window.removeEventListener("api:error", h);
    }, [showToast]);

    // Admin broadcast announcements (see pages/Admin.jsx admin:broadcast
    // handling) — same toast pipeline as api:error, just a different
    // trigger event and a longer duration since it's meant to be read.
    useEffect(() => {
        const h = (e) => showToast(e.detail.message, "info", 6000);
        window.addEventListener("ux-broadcast", h);
        return () => window.removeEventListener("ux-broadcast", h);
    }, [showToast]);
    return (
        <><ErrorBoundary>
            <Router>
                <AdminAuthProvider>
                    <AppRoutes />
                </AdminAuthProvider>
            </Router>
        </ErrorBoundary><Toast toast={toast} /></>
    );
}

export default App;