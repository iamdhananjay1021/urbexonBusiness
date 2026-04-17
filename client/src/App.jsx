import ErrorBoundary from "./components/ErrorBoundary";
import { Toast, useToast } from "./components/Toast";
import GlobalWebSocket from "./components/GlobalWebSocket";
import { BrowserRouter as Router } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";

import { AuthProvider } from "./contexts/AuthContext";

const AppRoutes = lazy(() => import("./routes/AppRoutes"));

const Loader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ee" }}>
    <div style={{ width: 40, height: 40, border: "3px solid #e8e4d9", borderTop: "3px solid #c9a84c", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  const { toast, showToast } = useToast();

  useEffect(() => {
    const handler = (e) => showToast(e.detail.message, e.detail.type || "error");
    window.addEventListener("api:error", handler);
    return () => window.removeEventListener("api:error", handler);
  }, [showToast]);

  // ✅ SAHI — Toast ko Router ke andar, AuthProvider ke andar rakha
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <GlobalWebSocket />
          <AppRoutes />
          <Toast toast={toast} />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
