/**
 * Delivery Partner Login — Urbexon V3
 * Full-screen split layout · Inline styles · Responsive · Production ready
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { FaEye, FaEyeSlash, FaBolt, FaMotorcycle } from "react-icons/fa";

/* ─── shared primitive styles ─── */
const S = {
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "#6b7280",
    marginBottom: 7,
  },
  input: {
    width: "100%",
    padding: "13px 16px",
    fontSize: 15,
    color: "#111827",
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: 12,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.18s, box-shadow 0.18s",
  },
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !pass.trim()) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      await login({ identifier: identifier.trim(), password: pass.trim() });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                @keyframes dl-spin { to { transform: rotate(360deg); } }
                @keyframes dl-fadein { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                .dl-inp:focus { border-color: #10b981 !important; box-shadow: 0 0 0 4px rgba(16,185,129,0.1) !important; }
                .dl-inp::placeholder { color: #9ca3af; }
                .dl-btn-primary { transition: background 0.18s, transform 0.12s; }
                .dl-btn-primary:hover:not(:disabled) { background: #059669 !important; transform: translateY(-1px); }
                .dl-btn-primary:active:not(:disabled) { transform: translateY(0); }
                .dl-btn-ghost:hover { background: #f3f4f6 !important; border-color: #d1d5db !important; }
                .dl-eye:hover { color: #374151 !important; }
                .dl-link:hover { color: #059669 !important; }
                @media (max-width: 767px) {
                    .dl-split-left { display: none !important; }
                    .dl-split-right { width: 100% !important; min-height: 100vh; }
                    .dl-form-inner { padding: 32px 24px !important; }
                }
                @media (min-width: 768px) {
                    .dl-mobile-header { display: none !important; }
                }
            `}</style>

      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" }}>

        {/* ── LEFT PANEL ── */}
        <div className="dl-split-left" style={{
          width: "45%",
          background: "linear-gradient(160deg, #064e3b 0%, #065f46 40%, #0f172a 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 52px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* background blobs */}
          <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(52,211,153,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(16,185,129,0.06)", pointerEvents: "none" }} />

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FaBolt size={18} style={{ color: "#34d399" }} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Urbexon</span>
          </div>

          {/* Hero text */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 99, padding: "6px 14px", marginBottom: 24 }}>
              <FaMotorcycle size={13} style={{ color: "#34d399" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6ee7b7", letterSpacing: "0.06em", textTransform: "uppercase" }}>Delivery Partner Portal</span>
            </div>
            <h1 style={{ fontSize: 38, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 18 }}>
              Deliver with<br />
              <span style={{ color: "#34d399" }}>Urbexon</span>
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, maxWidth: 320 }}>
              Join thousands of delivery partners earning on their own schedule across India.
            </p>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 32, position: "relative", zIndex: 1 }}>
            {[["10K+", "Active riders"], ["₹500+", "Avg. daily earn"], ["45 min", "Avg. delivery"]].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{v}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3, fontWeight: 500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="dl-split-right" style={{
          flex: 1,
          background: "#f9fafb",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "40px 24px",
          minHeight: "100vh",
        }}>
          {/* Mobile-only header */}
          <div className="dl-mobile-header" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36, alignSelf: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#064e3b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaBolt size={16} style={{ color: "#34d399" }} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>Urbexon</span>
          </div>

          <div className="dl-form-inner" style={{
            width: "100%",
            maxWidth: 440,
            background: "#fff",
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            padding: "40px 40px 36px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            animation: "dl-fadein 0.4s ease-out",
          }}>
            {/* Heading */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.025em", marginBottom: 6 }}>
                Welcome back
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280" }}>
                Sign in to your delivery partner account
              </p>
            </div>

            <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Email / Phone */}
              <div>
                <label style={S.label}>Email or phone</label>
                <input
                  className="dl-inp"
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Email"
                  required
                  autoComplete="username"
                  style={S.input}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                  <label style={{ ...S.label, marginBottom: 0 }}>Password</label>
                  <Link to="/forgot-password" className="dl-link" style={{ fontSize: 12.5, fontWeight: 600, color: "#10b981", textDecoration: "none", transition: "color 0.15s" }}>
                    Forgot password?
                  </Link>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    className="dl-inp"
                    type={show ? "text" : "password"}
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    autoComplete="current-password"
                    style={{ ...S.input, paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    className="dl-eye"
                    onClick={() => setShow(s => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "#9ca3af", display: "flex", alignItems: "center",
                      padding: 4, transition: "color 0.15s",
                    }}
                  >
                    {show ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 12, padding: "12px 16px",
                  fontSize: 13.5, color: "#dc2626", fontWeight: 500, lineHeight: 1.5,
                }}>
                  <span style={{ flexShrink: 0, fontSize: 14 }}>⚠️</span>
                  {error}
                </div>
              )}

              {/* Sign in button */}
              <button
                type="submit"
                disabled={loading}
                className="dl-btn-primary"
                style={{
                  width: "100%", padding: "15px",
                  background: "#059669",
                  border: "none", borderRadius: 12,
                  fontSize: 15, fontWeight: 700, color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 10,
                  fontFamily: "inherit",
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <>
                    <svg style={{ animation: "dl-spin 0.7s linear infinite", width: 18, height: 18, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Signing in…
                  </>
                ) : "Sign in"}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 20px" }}>
              <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
              <span style={{ fontSize: 12, color: "#d1d5db", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
            </div>

            {/* Register CTA */}
            <Link
              to="/register"
              className="dl-btn-ghost"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "14px", borderRadius: 12,
                border: "1.5px solid #e5e7eb", background: "#f9fafb",
                fontSize: 14, fontWeight: 600, color: "#374151",
                textDecoration: "none", transition: "all 0.18s",
              }}
            >
              <FaMotorcycle size={15} style={{ color: "#10b981" }} />
              Apply as a new delivery partner
            </Link>

            {/* Help */}
            <div style={{
              marginTop: 20, padding: "16px 18px",
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 12,
            }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#065f46", marginBottom: 6 }}>Need help?</p>
              <p style={{ fontSize: 12, color: "#047857", lineHeight: 1.8, margin: 0 }}>
                📞 <strong>+91-8808485840</strong><br />
                ✉️ <strong>support@urbexon.in</strong>
              </p>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 24, textAlign: "center" }}>
            🔒 Protected by 256-bit encryption
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;