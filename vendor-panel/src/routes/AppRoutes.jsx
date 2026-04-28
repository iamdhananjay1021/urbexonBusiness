/**
 * AppRoutes.jsx — Production v3.1
 * ✅ SubscriptionRoute: approved + active subscription required
 * ✅ ApprovedRoute: approved vendor required (subscription page itself accessible)
 * ✅ React.lazy code splitting
 */
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Layout from "../components/Layout";
import Login from "../pages/Login";
import VerifyEmail from "../pages/VerifyEmail";

const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const VendorApply = lazy(() => import("../pages/VendorApply"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const ProductList = lazy(() => import("../pages/products/ProductList"));
const ProductForm = lazy(() => import("../pages/products/ProductForm"));
const Orders = lazy(() => import("../pages/Orders"));
const OrderDetail = lazy(() => import("../pages/OrderDetail"));
const Earnings = lazy(() => import("../pages/Earnings"));
const Profile = lazy(() => import("../pages/Profile"));
const Settings = lazy(() => import("../pages/Settings"));
const Subscription = lazy(() => import("../pages/Subscription"));
const BankDetails = lazy(() => import("../pages/BankDetails"));

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

/**
 * SubscriptionRoute — approved + active subscription required
 * If subscription is inactive/expired, redirect to /subscription page
 */
const SubscriptionRoute = ({ children }) => {
  const { vendor, loading } = useAuth();
  if (loading) return <Loader />;
  if (!vendor) return <Navigate to="/login" replace />;
  if (vendor.status !== "approved") return <Navigate to="/dashboard" replace />;

  const now = new Date();
  const sub = vendor.subscription;
  const isSubActive = sub?.isActive && sub?.expiryDate && new Date(sub.expiryDate) > now;

  if (!isSubActive) {
    return <Navigate to="/subscription" replace />;
  }

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
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/apply" element={<PublicRoute><VendorApply /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />

      {/* Protected Routes */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Subscription page — approved vendor only (no sub required to VIEW/BUY) */}
        <Route path="subscription" element={<ApprovedRoute><Subscription /></ApprovedRoute>} />

        {/* These routes need BOTH approval AND active subscription */}
        <Route path="products" element={<SubscriptionRoute><ProductList /></SubscriptionRoute>} />
        <Route path="products/new" element={<SubscriptionRoute><ProductForm /></SubscriptionRoute>} />
        <Route path="products/:id/edit" element={<SubscriptionRoute><ProductForm /></SubscriptionRoute>} />
        <Route path="orders" element={<SubscriptionRoute><Orders /></SubscriptionRoute>} />
        <Route path="orders/:id" element={<SubscriptionRoute><OrderDetail /></SubscriptionRoute>} />
        <Route path="earnings" element={<SubscriptionRoute><Earnings /></SubscriptionRoute>} />

        {/* Profile and settings always accessible */}
        <Route path="profile" element={<Profile />} />

        <Route path="settings" element={<Settings />} />
        <Route path="bank-details" element={<ApprovedRoute><BankDetails /></ApprovedRoute>} />
      </Route>

      {/* Catch All */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;

