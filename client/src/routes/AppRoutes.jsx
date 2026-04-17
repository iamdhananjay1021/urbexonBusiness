/**
 * AppRoutes.jsx — Production v2.0
 * ✅ /become-vendor, /become-delivery, /wishlist routes added
 * ✅ Role-based redirects
 */
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PageTransition from "../components/PageTransition";
import MainLayout from "../layouts/MainLayout";
import Login from "../pages/Login";

const Home = lazy(() => import("../pages/Home"));

const Register = lazy(() => import("../pages/Register"));
const Cart = lazy(() => import("../pages/Cart"));
const Checkout = lazy(() => import("../components/checkout/Checkout"));
const MyOrders = lazy(() => import("../pages/MyOrders"));
const OrderDetails = lazy(() => import("../pages/OrderDetails"));
const OrderSuccess = lazy(() => import("../pages/OrderSuccess"));
const ProductDetails = lazy(() => import("../components/ProductDetails"));
const Profile = lazy(() => import("../pages/Profile"));
const ForgotPassword = lazy(() => import("../pages/Forgotpassword"));
const ResetPassword = lazy(() => import("../pages/Resetpassword"));
const VerifyInvoice = lazy(() => import("../pages/Verifyinvoice"));
const PrivacyPolicy = lazy(() => import("../pages/PrivacyPolicy"));
const TermsConditions = lazy(() => import("../pages/TermsConditions"));
const RefundPolicy = lazy(() => import("../pages/RefundPolicy"));
const ContactUs = lazy(() => import("../pages/Contactus"));
const CategoryPage = lazy(() => import("../pages/Categorypage"));
const DealsPage = lazy(() => import("../pages/Dealspage"));
const ProductsPage = lazy(() => import("../pages/Productspage"));
const NotFound = lazy(() => import("../pages/Notfound"));
const UrbexonHour = lazy(() => import("../pages/UrbexonHour"));
const UHCart = lazy(() => import("../pages/UHCart"));
const UHCheckout = lazy(() => import("../pages/UHCheckout"));
const UHProductDetail = lazy(() => import("../pages/UHProductDetail"));
const Wishlist = lazy(() => import("../pages/Wishlist"));
const BecomeVendor = lazy(() => import("../pages/BecomeVendor"));
const BecomeDelivery = lazy(() => import("../pages/BecomeDelivery"));
const VendorStore = lazy(() => import("../pages/VendorStore"));
const Loader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ee" }}>
    <div style={{ width: 36, height: 36, border: "3px solid #e8e4d9", borderTop: "3px solid #c9a84c", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [pathname]);
  return null;
};

const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
};

const PublicOnly = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (user) {
    const from = location.state?.from || "/";
    return <Navigate to={from} replace />;
  }
  return children;
};

const AppRoutes = () => (
  <>
    <ScrollToTop />
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Public only */}
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/order-success/:id" element={<OrderSuccess />} />

        {/* Standalone pages (no MainLayout) */}
        <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
        <Route path="/uh-checkout" element={<RequireAuth><UHCheckout /></RequireAuth>} />
        <Route path="/uh-product/:id" element={<PageTransition><UHProductDetail /></PageTransition>} />

        {/* Main Layout routes */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/products" element={<PageTransition><ProductsPage /></PageTransition>} />
          <Route path="/category/:slug" element={<PageTransition><CategoryPage /></PageTransition>} />
          <Route path="/deals" element={<PageTransition><DealsPage /></PageTransition>} />
          <Route path="/products/:id" element={<PageTransition><ProductDetails /></PageTransition>} />
          <Route path="/urbexon-hour" element={<PageTransition><UrbexonHour /></PageTransition>} />
          <Route path="/privacy-policy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
          <Route path="/terms-conditions" element={<PageTransition><TermsConditions /></PageTransition>} />
          <Route path="/refund-policy" element={<PageTransition><RefundPolicy /></PageTransition>} />
          <Route path="/contact" element={<PageTransition><ContactUs /></PageTransition>} />
          <Route path="/verify-invoice" element={<PageTransition><VerifyInvoice /></PageTransition>} />
          <Route path="/become-vendor" element={<PageTransition><BecomeVendor /></PageTransition>} />
          <Route path="/become-delivery" element={<PageTransition><BecomeDelivery /></PageTransition>} />
          <Route path="/vendor/:slug" element={<PageTransition><VendorStore /></PageTransition>} />

          {/* Protected */}
          <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><MyOrders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetails /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/uh-cart" element={<RequireAuth><UHCart /></RequireAuth>} />
          <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </>
);

export default AppRoutes;
