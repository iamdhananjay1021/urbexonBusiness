/**
 * Layout.jsx — Vendor Portal v3.0
 * Matches Figma design: dark sidebar, clean content area
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import {
  FiGrid, FiPackage, FiShoppingCart, FiDollarSign,
  FiUser, FiSettings, FiLogOut, FiMenu, FiX, FiBell,
  FiSearch, FiChevronDown,
} from "react-icons/fi";

const NAV = [
  { to: "/dashboard", icon: FiGrid, label: "Dashboard" },
  { to: "/products", icon: FiPackage, label: "My Products" },
  { to: "/orders", icon: FiShoppingCart, label: "Orders" },
  { to: "/earnings", icon: FiDollarSign, label: "Earnings" },
  { to: "/profile", icon: FiUser, label: "Profile" },
  { to: "/settings", icon: FiSettings, label: "Settings" },
];

const Layout = () => {
  const { vendor, logout } = useAuth();
  const { unreadCount, notifications, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [search, setSearch] = useState("");

  const handleLogout = useCallback(() => { logout(); navigate("/login"); }, [logout, navigate]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const initials = useMemo(() => (vendor?.ownerName || vendor?.shopName || "V")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(), [vendor?.ownerName, vendor?.shopName]);

  const Sidebar = () => (
    <aside style={{
      width: 240,
      background: "#0f0d2e",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900, color: "#fff",
          }}>U</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>URBEXON</div>
            <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2, marginTop: 1 }}>VENDOR PORTAL</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px", borderRadius: 10, marginBottom: 2,
            textDecoration: "none", fontSize: 13, fontWeight: 600,
            transition: "all 0.15s",
            background: isActive ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "transparent",
            color: isActive ? "#fff" : "#9ca3af",
          })}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Vendor info + sign out */}
      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f9fafb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {vendor?.shopName || "My Shop"}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Vendor Account</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          display: "flex", alignItems: "center", gap: 10,
          width: "100%", padding: "10px 14px", border: "none",
          background: "transparent", color: "#ef4444", cursor: "pointer",
          fontSize: 13, fontWeight: 600, borderRadius: 10,
          transition: "background 0.15s",
        }}>
          <FiLogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f0f4ff", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {/* Desktop Sidebar */}
      <div className="desktop-sidebar">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 49,
          }} />
          <div style={{ position: "fixed", left: 0, top: 0, zIndex: 50, height: "100vh" }}>
            <Sidebar />
          </div>
        </>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {/* Top Bar */}
        <header style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 20px",
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} style={{
            display: "none", background: "none", border: "none", cursor: "pointer", color: "#374151",
          }}>
            <FiMenu size={20} />
          </button>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 480, position: "relative" }}>
            <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="text"
              placeholder="Search products, orders..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px 8px 34px",
                border: "1.5px solid #e5e7eb", borderRadius: 10,
                fontSize: 13, color: "#111827", background: "#f9fafb",
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {/* Notifications */}
            <div style={{ position: "relative" }}>
              <button onClick={() => { setShowNotifs(!showNotifs); markAllRead(); }} style={{
                position: "relative", background: "none", border: "none",
                cursor: "pointer", color: "#374151", padding: 6,
              }}>
                <FiBell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: 2, right: 2,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "#ef4444", color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </button>

              {showNotifs && (
                <>
                  <div onClick={() => setShowNotifs(false)} style={{ position: "fixed", inset: 0, zIndex: 48 }} />
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 8px)",
                    width: 320, background: "#fff", border: "1px solid #e5e7eb",
                    borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                    zIndex: 49, overflow: "hidden",
                  }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", fontWeight: 700, fontSize: 13, color: "#111827" }}>
                      Notifications
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                        No notifications yet
                      </div>
                    ) : notifications.slice(0, 6).map((n, i) => (
                      <div key={i} style={{
                        padding: "12px 16px",
                        borderBottom: i < notifications.length - 1 ? "1px solid #f9fafb" : "none",
                        background: n.read ? "#fff" : "#faf5ff",
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{n.body}</div>
                        <div style={{ fontSize: 10, color: "#d1d5db", marginTop: 4 }}>
                          {new Date(n.createdAt).toLocaleTimeString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Profile */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff",
              }}>{initials}</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  {vendor?.ownerName?.split(" ")[0] || "Vendor"}
                </span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>Vendor Account</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: 24, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        * { box-sizing: border-box; }
        input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
      `}</style>
    </div>
  );
};

export default Layout;