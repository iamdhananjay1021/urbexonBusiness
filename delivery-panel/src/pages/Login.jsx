/**
 * Delivery Partner Login — Production v2.0
 * ✅ Forgot Password link added
 * ✅ Production-ready registration & training section
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { FaMotorcycle, FaEye, FaEyeSlash } from "react-icons/fa";

const CSS = `
*{box-sizing:border-box}
.dl-root{min-height:100vh;background:linear-gradient(135deg,#0f172a 0%,#134e2a 100%);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.dl-card{background:#fff;border-radius:16px;padding:36px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.dl-logo{text-align:center;margin-bottom:24px}
.dl-title{font-size:22px;font-weight:800;color:#1e293b;margin:0 0 4px}
.dl-sub{font-size:13px;color:#94a3b8;margin:0}
.dl-label{display:block;font-size:11px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;margin-top:14px}
.dl-inp{width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;transition:border .15s;font-family:inherit}
.dl-inp:focus{border-color:#22c55e}
.dl-pw{position:relative}
.dl-pw-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8}
.dl-btn{width:100%;padding:13px;background:#0f172a;border:none;color:#22c55e;font-size:14px;font-weight:800;letter-spacing:1.5px;border-radius:9px;cursor:pointer;margin-top:20px;transition:all .2s}
.dl-btn:hover{background:#1e293b}
.dl-btn:disabled{opacity:.5;cursor:not-allowed}
.dl-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-top:12px}
.dl-forgot{text-align:right;margin-top:8px}
.dl-forgot a{color:#22c55e;font-size:11px;font-weight:700;text-decoration:none}
.dl-section{margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0}
.dl-section-title{font-size:12px;font-weight:800;color:#1e293b;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}
.dl-action-btn{display:flex;align-items:center;gap:10px;width:100%;padding:12px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;font-weight:600;color:#22c55e;cursor:pointer;text-decoration:none;margin-bottom:8px;transition:all .2s}
.dl-action-btn:hover{background:#e2e8f0;border-color:#22c55e}
.dl-help{background:#f0fdf4;border:1px solid #dcfce7;border-radius:8px;padding:12px;font-size:11px;color:#166534;line-height:1.6}
.dl-help p{margin:0 0 6px}
.dl-link{text-align:center;margin-top:16px;font-size:13px;color:#64748b}
.dl-link a{color:#22c55e;font-weight:700;text-decoration:none}
`;

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await login(email.trim(), pass.trim());
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login fail ho gayi");
    } finally { setLoading(false); }
  };

  return (
    <div className="dl-root">
      <style>{CSS}</style>
      <div className="dl-card">
        <div className="dl-logo">
          <FaMotorcycle size={32} color="#22c55e" />
          <h1 className="dl-title">Delivery Partner</h1>
          <p className="dl-sub">URBEXON — Delivery App</p>
        </div>
        <form onSubmit={submit}>
          <label className="dl-label">Email</label>
          <input className="dl-inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="aapka@email.com" required />
          <label className="dl-label">Password</label>
          <div className="dl-pw">
            <input className="dl-inp" type={show ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} required minLength={8} placeholder="Min. 8 characters" style={{ paddingRight: 40 }} />
            <button type="button" className="dl-pw-btn" onClick={() => setShow(s => !s)}>
              {show ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            </button>
          </div>
          <div className="dl-forgot">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          {error && <div className="dl-err">{error}</div>}
          <button type="submit" className="dl-btn" disabled={loading}>
            {loading ? "Logging in…" : "LOGIN"}
          </button>
        </form>

        {/* Registration & Training Section */}
        <div className="dl-section">
          <div className="dl-section-title">🚀 Join Our Network</div>
          <Link to="/register" className="dl-action-btn">
            <FaMotorcycle size={14} />
            Register as New Partner
          </Link>
        </div>

        {/* Help Section */}
        <div className="dl-help">
          <p><strong>📞 Need Help?</strong></p>
          <p>Contact us: <strong>+91-1234-567890</strong></p>
          <p>Email: support@urbexon.in</p>
        </div>

        <div className="dl-link">
          New partner? <Link to="/register">Register karein</Link>
        </div>
      </div>
    </div>
  );
};
export default Login;
