
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
const Support = lazy(() => import("../pages/Support"));
const SupportTicketDetail = lazy(() => import("../pages/SupportTicketDetail"));
const Reviews = lazy(() => import("../pages/Reviews"));
const Wallet = lazy(() => import("../pages/Wallet"));
const Returns = lazy(() => import("../pages/Returns"));
const ReturnDetail = lazy(() => import("../pages/ReturnDetail"));

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
  if (!vendor) return <Navigate to="/login" replace />;
  // BUG FIX: a user can select "vendor" as their role at signup without
  // ever submitting the actual vendor application — AuthContext already
  // tolerates the resulting 404 on /vendor/me and keeps them "logged in"
  // with a bare profile (no `status` field, since no Vendor document
  // exists yet), but nothing here used to check that before letting them
  // into the Dashboard shell. Every widget on Dashboard/Earnings/etc. then
  // independently hit /vendor/subscription, /vendor/earnings, and friends
  // — all 404ing the same way, with no indication to the vendor of what
  // was actually wrong. A real (even pending/rejected) application always
  // has a `status`; only the never-applied case lacks it entirely.
  if (!vendor.status) return <Navigate to="/apply" replace />;
  return children;
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

// BUG FIX: /apply needs different rules than PublicRoute — an
// authenticated-but-never-applied vendor (no `status`; see PrivateRoute)
// must be able to reach this page, otherwise PrivateRoute's redirect here
// would immediately bounce right back to /dashboard (infinite loop).
// Only someone who already has a real application (any status) — or isn't
// logged in at all — follows the normal rules.
const ApplyRoute = ({ children }) => {
  const { vendor, loading } = useAuth();
  if (loading) return <Loader />;
  if (vendor?.status) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => (
  <Suspense fallback={<Loader />}>
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/apply" element={<ApplyRoute><VendorApply /></ApplyRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

      {/* Routes accessible to anyone */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

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

        {/* Returns — same gate as Orders (SubscriptionRoute): returns are a
            view over order data, matching the backend's own
            requireActiveSubscription gate on /vendor/returns. */}
        <Route path="returns" element={<SubscriptionRoute><Returns /></SubscriptionRoute>} />
        <Route path="returns/:id" element={<SubscriptionRoute><ReturnDetail /></SubscriptionRoute>} />
        <Route path="earnings" element={<SubscriptionRoute><Earnings /></SubscriptionRoute>} />

        {/* Profile and settings always accessible */}
        <Route path="profile" element={<Profile />} />

        <Route path="settings" element={<Settings />} />
        <Route path="bank-details" element={<ApprovedRoute><BankDetails /></ApprovedRoute>} />

        {/* Support — approved vendor only, deliberately NOT SubscriptionRoute:
            vendors must be able to raise tickets (incl. about billing) even
            when their subscription has lapsed. */}
        <Route path="support" element={<ApprovedRoute><Support /></ApprovedRoute>} />
        <Route path="support/:id" element={<ApprovedRoute><SupportTicketDetail /></ApprovedRoute>} />

        {/* Reviews — approved only, no subscription gate (same reasoning as Support) */}
        <Route path="reviews" element={<ApprovedRoute><Reviews /></ApprovedRoute>} />

        {/* Wallet — approved only, deliberately NOT SubscriptionRoute: the
            backend wallet routes themselves have no subscription gate
            (protectVendor + requireApprovedVendor only, see
            vendorRoutes.js) — a vendor's earned money must stay visible
            even if their subscription has lapsed. */}
        <Route path="wallet" element={<ApprovedRoute><Wallet /></ApprovedRoute>} />
      </Route>

      {/* Catch All */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;
