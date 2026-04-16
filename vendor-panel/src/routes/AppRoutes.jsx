/**
 * AppRoutes.jsx — Production v3.0
 * ✅ React.lazy code splitting
 * ✅ Includes vendor application route
 */
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Layout from "../components/Layout";
import Login from "../pages/Login";

const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const VendorApply = lazy(() => import("../pages/VendorApply"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const ProductList = lazy(() => import("../pages/products/ProductList"));
const ProductForm = lazy(() => import("../pages/products/ProductForm"));
const Orders = lazy(() => import("../pages/Orders"));
const Earnings = lazy(() => import("../pages/Earnings"));
const Profile = lazy(() => import("../pages/Profile"));
const Settings = lazy(() => import("../pages/Settings"));

const Loader = () => (
  <div style={{
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
  }}>
    <div style={{
      width: "40px",
      height: "40px",
      border: "3px solid #e2e8f0",
      borderTopColor: "#5b5bf6",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { vendor, loading } = useAuth();

  if (loading) return <Loader />;

  return vendor ? children : <Navigate to="/login" replace />;
};

const ApprovedRoute = ({ children }) => {
  const { vendor, loading } = useAuth();

  if (loading) return <Loader />;
  if (!vendor) return <Navigate to="/login" replace />;
  if (vendor.status !== "approved") return <Navigate to="/dashboard" replace />;

  return children;
};

const PublicRoute = ({ children }) => {
  const { vendor, loading } = useAuth();

  if (loading) return <Loader />;

  return vendor ? <Navigate to="/dashboard" replace /> : children;
};

const AppRoutes = () => (
  <Suspense fallback={<Loader />}>
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/apply" element={<PublicRoute><VendorApply /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />

      {/* Protected Routes */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<ApprovedRoute><ProductList /></ApprovedRoute>} />
        <Route path="products/new" element={<ApprovedRoute><ProductForm /></ApprovedRoute>} />
        <Route path="products/:id/edit" element={<ApprovedRoute><ProductForm /></ApprovedRoute>} />
        <Route path="orders" element={<ApprovedRoute><Orders /></ApprovedRoute>} />
        <Route path="earnings" element={<ApprovedRoute><Earnings /></ApprovedRoute>} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch All */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;