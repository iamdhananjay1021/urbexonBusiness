/**
 * Login.jsx — Production v3.0
 * Clean dark gradient login, matches Figma branding
 * ✅ Forgot Password link added
 * ✅ Production-ready registration section
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { FiMail, FiLock, FiAlertCircle, FiEye, FiEyeOff } from "react-icons/fi";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError("Please fill in all fields"); return; }

    try {
      setLoading(true);
      setError("");
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    width: "100%", padding: "12px 14px 12px 42px",
    border: "1.5px solid #e5e7eb", borderRadius: 10,
    fontSize: 14, color: "#111827", outline: "none",
    fontFamily: "inherit", transition: "all 0.2s",
    boxSizing: "border-box", background: "#f9fafb",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f0d2e 0%, #1e1b4b 50%, #312e81 100%)",
      padding: 20,
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        .login-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15) !important; background: #fff !important; }
        .login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(124,58,237,0.4); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div style={{
        background: "#fff", borderRadius: 20,
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        padding: "44px 40px", width: "100%", maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 900, color: "#fff",
          }}>U</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f0d2e", letterSpacing: 1 }}>URBEXON</div>
          </div>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", textAlign: "center", marginBottom: 6 }}>
          Vendor Portal
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 28 }}>
          Sign in to manage your shop and orders
        </p>

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            color: "#b91c1c", padding: "11px 14px", borderRadius: 10,
            fontSize: 13, marginBottom: 20,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <FiAlertCircle size={15} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <FiMail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="email"
                className="login-input"
                style={fieldStyle}
                placeholder="vendor@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <FiLock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type={showPwd ? "text" : "password"}
                className="login-input"
                style={{ ...fieldStyle, paddingRight: 42 }}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                disabled={loading}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#9ca3af", cursor: "pointer",
              }}>
                {showPwd ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            <div style={{ marginTop: 8, textAlign: "right" }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600, textDecoration: "none" }}>
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
              border: "none", borderRadius: 12,
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Signing in...
              </>
            ) : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
          {/* Register Section */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", margin: 0, marginBottom: 10 }}>
              ✨ New to Urbexon?
            </p>
            <a href="/apply" style={{
              display: "inline-block", width: "100%", padding: "11px",
              background: "#f3f4f6", border: "1.5px solid #e5e7eb",
              borderRadius: 10, color: "#7c3aed", fontSize: 14, fontWeight: 700,
              textDecoration: "none", textAlign: "center",
              transition: "all 0.2s", fontFamily: "inherit"
            }} onMouseEnter={e => {
              e.target.style.background = "#e5e7eb";
              e.target.style.borderColor = "#d1d5db";
            }} onMouseLeave={e => {
              e.target.style.background = "#f3f4f6";
              e.target.style.borderColor = "#e5e7eb";
            }}>
              Apply as Vendor Now
            </a>
            <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8, margin: 0 }}>
              Join our partner network and grow your business
            </p>
          </div>

          {/* Help Section */}
          <div style={{ marginTop: 16, padding: "12px 14px", background: "#f9fafb", borderRadius: 10, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginBottom: 8 }}>
              Need help? Contact our vendor support team
            </p>
            <a href="mailto:vendor-support@urbexon.in" style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600, textDecoration: "none" }}>
              vendor-support@urbexon.in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;