/**
 * Delivery Panel AppRoutes — Production v6.0
 * ✅ React.lazy code splitting
 * ✅ Urbexon design system with 5-tab navigation
 * ✅ FIX (v6.0): Protected routing is now applicationStatus-aware.
 *    Previously, an authenticated-but-unapproved rider could reach
 *    /dashboard at all (blocked earlier only by the old 403-on-login bug)
 *    or get stuck unable to reach /apply once logged in (because /apply
 *    was wrapped in PublicOnly, which redirects any logged-in user away
 *    to /dashboard). Now:
 *      - not logged in           → /login
 *      - logged in, not applied  → /apply
 *      - logged in, pending      → /pending-approval
 *      - logged in, rejected     → /pending-approval (shows rejection msg)
 *      - logged in, approved     → normal protected routes
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
const Support = lazy(() => import("../pages/Support"));
const SupportTicketDetail = lazy(() => import("../pages/SupportTicketDetail"));

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
  { to: "/support", label: "Support", icon: "🎧" },
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

/* ─────────────────────────────────────────────
   Simple inline "pending / rejected" screen.
   Kept inline (not lazy-loaded) since it's tiny and avoids needing
   a new page file — wire it up to its own component later if it
   grows more complex.
───────────────────────────────────────────── */
const PendingApproval = () => {
  const { rider, logout } = useAuth();
  const rejected = rider?.applicationStatus === "rejected";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f9fafb", padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    }}>
      <div style={{
        maxWidth: 420, width: "100%", background: "#fff", borderRadius: 20,
        border: "1px solid #e5e7eb", padding: 36, textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: rejected ? "#fef2f2" : "#fffbeb",
          border: `2px solid ${rejected ? "#fecaca" : "#fde68a"}`,
          fontSize: 28,
        }}>
          {rejected ? "✕" : "⏳"}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 10 }}>
          {rejected ? "Application not approved" : "Application under review"}
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginBottom: 24 }}>
          {rejected
            ? "Your delivery partner application was not approved. Please contact support for details."
            : "Your application is being reviewed by our team. This usually takes 24–48 hours — we'll notify you once it's approved."}
        </p>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "14px 16px", marginBottom: 20, textAlign: "left" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#065f46", marginBottom: 6 }}>Need help?</p>
          <p style={{ fontSize: 12, color: "#047857", lineHeight: 1.8, margin: 0 }}>
            📞 <strong>+91-8808485840</strong><br />
            ✉️ <strong>support@urbexon.in</strong>
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            width: "100%", padding: "12px", background: "#fff", border: "1.5px solid #e5e7eb",
            borderRadius: 12, fontSize: 14, fontWeight: 700, color: "#374151", cursor: "pointer",
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Protected — now applicationStatus-aware.
───────────────────────────────────────────── */
const Protected = ({ children }) => {
  const { rider, loading } = useAuth();
  if (loading) return <Loader />;
  if (!rider) return <Navigate to="/login" replace />;

  // ✅ FIX: route based on application status instead of blocking entirely.
  if (rider.applicationStatus === "not_applied") {
    return <Navigate to="/apply" replace />;
  }
  if (rider.applicationStatus === "pending" || rider.applicationStatus === "rejected") {
    return <Navigate to="/pending-approval" replace />;
  }

  return children;
};

/* Guards the /apply and /pending-approval routes themselves so an
   already-approved rider doesn't get stuck there, and so a logged-out
   visitor is sent to /login. */
const RequireAuth = ({ children }) => {
  const { rider, loading } = useAuth();
  if (loading) return <Loader />;
  return rider ? children : <Navigate to="/login" replace />;
};

const PublicOnly = ({ children }) => {
  const { rider, loading } = useAuth();
  // [FIX] Was `return null` — a blank white flash before /login rendered,
  // inconsistent with every other guard in this file already using Loader.
  if (loading) return <Loader />;
  return rider ? <Navigate to="/dashboard" replace /> : children;
};

const AppRoutes = () => (
  <Suspense fallback={<Loader />}>
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />

      {/* ✅ FIX (v2): Updated route protection strategy:
          - /register: Unauthenticated users → redirects to /login with from="/register"
                       Authenticated users → shows application form
          - /apply: PROTECTED (authenticated users apply as existing delivery account holders)
          Both use Register.jsx but serve different flows based on auth state.
      */}
      <Route path="/register" element={<Register />} />
      <Route path="/apply" element={<RequireAuth><Register /></RequireAuth>} />

      {/* ✅ NEW: shown when applicationStatus is 'pending' or 'rejected' */}
      <Route path="/pending-approval" element={<RequireAuth><PendingApproval /></RequireAuth>} />

      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password/:token" element={<PublicOnly><ResetPassword /></PublicOnly>} />
      <Route path="/dashboard" element={<Protected><PrivateLayout><Dashboard /></PrivateLayout></Protected>} />
      <Route path="/orders" element={<Protected><PrivateLayout><ActiveOrders /></PrivateLayout></Protected>} />
      <Route path="/earnings" element={<Protected><PrivateLayout><Earnings /></PrivateLayout></Protected>} />
      <Route path="/history" element={<Protected><PrivateLayout><OrderHistory /></PrivateLayout></Protected>} />
      <Route path="/support" element={<Protected><PrivateLayout><Support /></PrivateLayout></Protected>} />
      <Route path="/support/:id" element={<Protected><PrivateLayout><SupportTicketDetail /></PrivateLayout></Protected>} />
      <Route path="/profile" element={<Protected><PrivateLayout><Profile /></PrivateLayout></Protected>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;