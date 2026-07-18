/**
 * AppRoutes.jsx — Production v2.0
 * ✅ /become-vendor, /wishlist routes added
 * ✅ Role-based redirects
 */
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PageTransition from "../components/PageTransition";
import MainLayout from "../layouts/MainLayout";

// BUG FIX: was a static import — Login (and everything it pulls in, incl.
// the Firebase SDK for Google sign-in) was being bundled into the main
// entry chunk and downloaded by every visitor on every page, even ones who
// never open /login. Every sibling route below is already lazy; this just
// brings Login in line with that existing pattern.
const Login = lazy(() => import("../pages/Login"));

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
const CollectionPage = lazy(() => import("../pages/CollectionPage"));
const CollectionsIndex = lazy(() => import("../pages/CollectionsIndex"));
const AboutUs = lazy(() => import("../pages/AboutUs"));
const DealsPage = lazy(() => import("../pages/Dealspage"));
const ProductsPage = lazy(() => import("../pages/Productspage"));
const NotFound = lazy(() => import("../pages/Notfound"));
const UrbexonHour = lazy(() => import("../pages/UrbexonHour"));
const UHCart = lazy(() => import("../pages/UHCart"));
const UHCheckout = lazy(() => import("../pages/UHCheckout"));
const UHProductDetail = lazy(() => import("../pages/UHProductDetail"));
const Wishlist = lazy(() => import("../pages/Wishlist"));
const Coupons = lazy(() => import("../pages/Coupons"));
const BecomeVendor = lazy(() => import("../pages/BecomeVendor"));
const BecomeDeliveryPartner = lazy(() => import("../pages/BecomeDeliveryPartner"));
const VendorStore = lazy(() => import("../pages/VendorStore"));

/* Route-chunk fallback. The spinner stays INVISIBLE for the first 350ms —
   fast chunk loads show only a canvas-coloured screen (no white/spinner
   "blink" between pages); the spinner fades in only on genuinely slow
   loads. Colours come from the design tokens, not the old beige/gold. */
const Loader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }}>
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      border: "3px solid var(--color-graphite-200)",
      borderTopColor: "var(--accent-primary)",
      opacity: 0,
      animation: "route-loader-in .2s ease .35s forwards, spin .8s linear infinite",
    }} />
    <style>{"@keyframes spin{to{transform:rotate(360deg)}} @keyframes route-loader-in{to{opacity:1}}"}</style>
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();

  // The browser's automatic scroll restoration fights SPA navigation: with
  // lazy chunks the new page's content mounts late, and Chrome then
  // "restores" the previous page's scroll offset — which is why a page
  // could open scrolled to the bottom. Take manual control once.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

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
        {/* Public only (outside MainLayout) */}
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

        {/* Standalone checkout pages (no MainLayout, no Footer) */}
        <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
        <Route path="/uh-checkout" element={<RequireAuth><UHCheckout /></RequireAuth>} />
        <Route path="/uh-product/:id" element={<PageTransition><UHProductDetail /></PageTransition>} />

        {/* Main Layout routes — all public + protected routes grouped here */}
        <Route element={<MainLayout />}>
          {/* Public pages */}
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/products" element={<PageTransition><ProductsPage /></PageTransition>} />
          <Route path="/category/:slug" element={<PageTransition><CategoryPage /></PageTransition>} />
          <Route path="/collections" element={<PageTransition><CollectionsIndex /></PageTransition>} />
          <Route path="/collections/:slug" element={<PageTransition><CollectionPage /></PageTransition>} />
          <Route path="/about" element={<PageTransition><AboutUs /></PageTransition>} />
          <Route path="/deals" element={<PageTransition><DealsPage /></PageTransition>} />
          <Route path="/products/:id" element={<PageTransition><ProductDetails /></PageTransition>} />

          {/* Urbexon Hour — base + category slug */}
          <Route path="/urbexon-hour" element={<PageTransition><UrbexonHour /></PageTransition>} />
          <Route path="/urbexon-hour/:slug" element={<PageTransition><UrbexonHour /></PageTransition>} />

          {/* Policy & Info pages */}
          <Route path="/privacy-policy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
          <Route path="/terms-conditions" element={<PageTransition><TermsConditions /></PageTransition>} />
          <Route path="/refund-policy" element={<PageTransition><RefundPolicy /></PageTransition>} />
          <Route path="/contact" element={<PageTransition><ContactUs /></PageTransition>} />
          <Route path="/verify-invoice" element={<PageTransition><VerifyInvoice /></PageTransition>} />
          <Route path="/become-vendor" element={<PageTransition><BecomeVendor /></PageTransition>} />
          <Route path="/become-delivery" element={<PageTransition><BecomeDeliveryPartner /></PageTransition>} />
          <Route path="/vendor/:slug" element={<PageTransition><VendorStore /></PageTransition>} />

          {/* Authentication — Password reset inside MainLayout */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
          <Route path="/uh-cart" element={<RequireAuth><UHCart /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><MyOrders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetails /></RequireAuth>} />
          <Route path="/order-success/:id" element={<RequireAuth><OrderSuccess /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
          <Route path="/coupons" element={<RequireAuth><Coupons /></RequireAuth>} />
        </Route>

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </>
);

export default AppRoutes;