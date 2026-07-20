import { Toast, useToast } from "./components/Toast";
import { useEffect } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AppRoutes from "./routes/AppRoutes";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

export default function App() {
  const { toast, showToast } = useToast();

  useEffect(() => {
    const h = (e) => showToast(e.detail.message, e.detail.type || "error");
    window.addEventListener("api:error", h);
    return () => window.removeEventListener("api:error", h);
  }, [showToast]);

  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>

      <Toast toast={toast} />
    </ErrorBoundary>
  );
}