/**
 * Delivery Panel AppRoutes — Production v5.0
 * ✅ React.lazy code splitting
 * ✅ Urbexon design system with 5-tab navigation
 */
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { G } from "../utils/theme";
import Login from "../pages/Login";

const Register = lazy(() => import("../pages/Register"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const ActiveOrders = lazy(() => import("../pages/ActiveOrders"));
const Earnings = lazy(() => import("../pages/Earnings"));
const OrderHistory = lazy(() => import("../pages/OrderHistory"));
const Profile = lazy(() => import("../pages/Profile"));

const Loader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: G.bg }}>
    <div style={{ width: 32, height: 32, border: `3px solid ${G.green100}`, borderTopColor: G.brand, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
  </div>
);

/* ── Responsive CSS injected once ── */
const LAYOUT_CSS = `
.ud-shell{width:100%;max-width:480px;margin:0 auto;height:100vh;overflow:hidden;display:flex;flex-direction:column;background:${G.white};position:relative;--px:16px}
.ud-topbar{background:${G.navy};color:${G.white};height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 var(--px);position:sticky;top:0;z-index:100}
.ud-navbar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:${G.white};border-top:1px solid ${G.border};display:flex;z-index:200}
.ud-navlink{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 0 10px;text-decoration:none;gap:3px;transition:all .15s}
.ud-navlink:hover{background:#f9fafb}
.ud-order-card{transition:box-shadow .15s,transform .15s}
@media(min-width:768px){
 .ud-shell{max-width:900px;--px:24px;border-left:1px solid ${G.border};border-right:1px solid ${G.border};box-shadow:0 0 40px rgba(0,0,0,.06)}
 .ud-topbar{height:56px}
 .ud-topbar-brand{font-size:17px!important}
 .ud-navbar{max-width:900px;height:58px}
 .ud-navlink{gap:4px}
 .ud-nav-icon{font-size:20px!important}
 .ud-nav-label{font-size:11px!important}
 .ud-page{padding-bottom:80px!important}
 .ud-page-title{font-size:24px!important}
 .ud-hero-val{font-size:42px!important}
 .ud-stat-val{font-size:26px!important}
 .ud-order-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-1px)}
 .ud-doc-grid{grid-template-columns:1fr 1fr 1fr 1fr!important}
 .ud-doc-thumb{height:110px!important}
 .ud-bar-wrap{height:160px!important}
}
@media(min-width:1200px){
 .ud-shell{max-width:1080px;--px:32px}
 .ud-navbar{max-width:1080px}
 .ud-profile-stats{grid-template-columns:1fr 1fr 1fr 1fr!important}
}
`;

const TopBar = () => (
  <header className="ud-topbar">
    <div>
      <span className="ud-topbar-brand" style={{ fontSize: 15, fontWeight: 800, color: G.brand, letterSpacing: 1.5 }}>Urbexon</span>
      <span style={{ fontSize: 10, fontWeight: 400, color: "#64748b", letterSpacing: 1, marginLeft: 6 }}>DELIVERY</span>
    </div>
  </header>
);

const NAV = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/orders", label: "Active", icon: "📦" },
  { to: "/earnings", label: "Earnings", icon: "📈" },
  { to: "/history", label: "History", icon: "🕐" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

const Nav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="ud-navbar">
      {NAV.map(n => {
        const active = pathname === n.to;
        return (
          <Link key={n.to} to={n.to} className="ud-navlink">
            <span className="ud-nav-icon" style={{ fontSize: 18, lineHeight: 1, filter: active ? "none" : "grayscale(1) opacity(0.5)" }}>{n.icon}</span>
            <span className="ud-nav-label" style={{ fontSize: 10, fontWeight: 600, color: active ? G.brand : G.textMuted }}>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const PrivateLayout = ({ children }) => (
  <>
    <style>{LAYOUT_CSS}</style>
    <div className="ud-shell">
      <TopBar />
      <div className="ud-page" style={{ paddingBottom: 74, flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
      <Nav />
    </div>
  </>
);

const Protected = ({ children }) => {
  const { rider, loading } = useAuth();
  if (loading) return <Loader />;
  return rider ? children : <Navigate to="/login" replace />;
};

const PublicOnly = ({ children }) => {
  const { rider, loading } = useAuth();
  if (loading) return null;
  return rider ? <Navigate to="/dashboard" replace /> : children;
};

const AppRoutes = () => (
  <Suspense fallback={<Loader />}>
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password/:token" element={<PublicOnly><ResetPassword /></PublicOnly>} />
      <Route path="/dashboard" element={<Protected><PrivateLayout><Dashboard /></PrivateLayout></Protected>} />
      <Route path="/orders" element={<Protected><PrivateLayout><ActiveOrders /></PrivateLayout></Protected>} />
      <Route path="/earnings" element={<Protected><PrivateLayout><Earnings /></PrivateLayout></Protected>} />
      <Route path="/history" element={<Protected><PrivateLayout><OrderHistory /></PrivateLayout></Protected>} />
      <Route path="/profile" element={<Protected><PrivateLayout><Profile /></PrivateLayout></Protected>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;
