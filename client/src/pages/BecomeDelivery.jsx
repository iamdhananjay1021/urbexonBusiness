/**
 * BecomeDelivery.jsx — Delivery Partner Application
 * Route: /become-delivery
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import { FaMotorcycle, FaUpload, FaCheckCircle, FaArrowRight } from "react-icons/fa";
import SEO from "../components/SEO";

const CSS = `
*{box-sizing:border-box}
.bd-root{min-height:100vh;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.bd-hero{background:linear-gradient(135deg,#0f172a 0%,#134e2a 100%);color:#fff;padding:60px clamp(20px,6vw,80px);text-align:center}
.bd-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#22c55e;padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px}
.bd-title{font-size:clamp(26px,5vw,40px);font-weight:800;margin-bottom:12px}
.bd-body{max-width:680px;margin:0 auto;padding:40px clamp(16px,4vw,40px) 60px}
.bd-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px;margin-bottom:20px}
.bd-label{display:block;font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;margin-top:14px}
.bd-inp{width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13.5px;color:#1e293b;outline:none;transition:border .15s;font-family:inherit}
.bd-inp:focus{border-color:#22c55e}
.bd-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:540px){.bd-grid{grid-template-columns:1fr}}
.bd-upload{border:2px dashed #e2e8f0;border-radius:9px;padding:18px;text-align:center;cursor:pointer;transition:all .2s}
.bd-upload.has{border-color:#22c55e;background:#f0fdf4}
.bd-submit{width:100%;padding:15px;background:#0f172a;border:none;color:#22c55e;font-size:14px;font-weight:800;letter-spacing:2px;border-radius:10px;cursor:pointer;transition:all .2s;margin-top:8px}
.bd-submit:hover{background:#1e293b}
.bd-submit:disabled{opacity:.5;cursor:not-allowed}
`;

const BecomeDelivery = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState({});
  const [form, setForm] = useState({
    name: user?.name || "", phone: user?.phone || "",
    vehicleType: "motorcycle", vehicleNumber: "", vehicleModel: "", city: "",
  });

  useEffect(() => {
    if (!user) { navigate("/login", { state: { from: "/become-delivery" } }); return; }
    api.get("/delivery/status")
      .then(({ data }) => { if (data.registered) setStatus(data); else setStatus(false); })
      .catch(() => setStatus(false))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setFile = k => e => { const f = e.target.files[0]; if (f) setFiles(p => ({ ...p, [k]: f })); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.vehicleType) return setError("Naam, phone aur vehicle type zaroori hai");
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      Object.entries(files).forEach(([k, f]) => fd.append(k, f));
      await api.post("/delivery/register", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Registration fail ho gayi");
    } finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0fdf4" }}><div style={{ width: 32, height: 32, border: "3px solid #dcfce7", borderTop: "3px solid #22c55e", borderRadius: "50%", animation: "spin .8s linear infinite" }} /><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;

  if (status) {
    const cfg = { pending: { icon: "⏳", title: "Review Mein Hai", msg: "24-48 ghante mein update milega." }, approved: { icon: "✅", title: "Approved! Delivery Start Karein", msg: "App mein login karein." }, rejected: { icon: "❌", title: "Rejected", msg: status.rider?.adminNote || "Admin se contact karein." } };
    const c = cfg[status.status] || cfg.pending;
    return <div className="bd-root"><style>{CSS}</style><div style={{ padding: "80px 20px", textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>{c.icon}</div><h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1740", marginBottom: 8 }}>{c.title}</h2><p style={{ fontSize: 14, color: "#64748b" }}>{c.msg}</p></div></div>;
  }

  if (success) return <div className="bd-root"><style>{CSS}</style><div style={{ padding: "80px 20px", textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div><h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1740", marginBottom: 8 }}>Registration Ho Gayi!</h2><p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>24-48 ghante mein approve ho jaoge. App download karein.</p><button onClick={() => navigate("/")} style={{ padding: "11px 24px", background: "#0f172a", border: "none", color: "#22c55e", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Home Par Jayen</button></div></div>;

  return (
    <div className="bd-root">
      <SEO title="Become a Delivery Partner" description="Join Urbexon as a delivery partner. Flexible hours, guaranteed earnings, and instant payouts." path="/become-delivery" />
      <style>{CSS}</style>
      <div className="bd-hero">
        <div className="bd-badge"><FaMotorcycle size={11} />Delivery Partner</div>
        <h1 className="bd-title">Delivery Partner Banein<br /><span style={{ color: "#22c55e" }}>Apni Schedule Par Kamao</span></h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.65)", maxWidth: 400, margin: "0 auto" }}>Flexible hours, guaranteed earnings, aur instant payouts.</p>
      </div>
      <div className="bd-body">
        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 16px", borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <form onSubmit={submit}>
          <div className="bd-card">
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1740", marginBottom: 4 }}>Personal Details</div>
            <div className="bd-grid">
              <div><label className="bd-label">Full Name *</label><input className="bd-inp" value={form.name} onChange={set("name")} required /></div>
              <div><label className="bd-label">Phone *</label><input className="bd-inp" value={form.phone} onChange={set("phone")} required /></div>
              <div><label className="bd-label">City *</label><input className="bd-inp" value={form.city} onChange={set("city")} /></div>
            </div>
          </div>
          <div className="bd-card">
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1740", marginBottom: 4 }}>Vehicle Details</div>
            <div className="bd-grid">
              <div>
                <label className="bd-label">Vehicle Type *</label>
                <select className="bd-inp" value={form.vehicleType} onChange={set("vehicleType")}>
                  <option value="bicycle">Bicycle</option>
                  <option value="scooter">Scooter</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="car">Car</option>
                </select>
              </div>
              <div><label className="bd-label">Vehicle Number</label><input className="bd-inp" value={form.vehicleNumber} onChange={set("vehicleNumber")} placeholder="UP32 AB 1234" /></div>
              <div><label className="bd-label">Vehicle Model</label><input className="bd-inp" value={form.vehicleModel} onChange={set("vehicleModel")} placeholder="Honda Activa" /></div>
            </div>
          </div>
          <div className="bd-card">
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1740", marginBottom: 16 }}>Documents Upload</div>
            <div className="bd-grid">
              {[["aadhaarPhoto", "Aadhaar Card *"], ["licensePhoto", "Driving License *"], ["vehicleRc", "Vehicle RC"], ["selfie", "Selfie Photo"]].map(([k, l]) => (
                <div key={k}>
                  <label className="bd-label">{l}</label>
                  <label className={`bd-upload ${files[k] ? "has" : ""}`}>
                    <FaUpload size={16} color={files[k] ? "#22c55e" : "#94a3b8"} />
                    <div style={{ fontSize: 11, color: files[k] ? "#15803d" : "#94a3b8", marginTop: 6 }}>{files[k] ? files[k].name : "Choose file"}</div>
                    <input type="file" accept="image/*,.pdf" onChange={setFile(k)} style={{ display: "none" }} />
                  </label>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="bd-submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Registration Submit Karein ✓"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BecomeDelivery;
