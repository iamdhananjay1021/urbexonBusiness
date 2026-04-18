/**
 * BecomeVendor.jsx — Vendor Application Page
 * Route: /become-vendor
 * ✅ Full form with GST, PAN, Bank Details
 * ✅ Document upload
 * ✅ Pincode selection
 * ✅ Status check karta hai — agar apply ho chuka toh redirect
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import { FaStore, FaUser, FaBuilding, FaUniversity, FaMapMarkerAlt, FaUpload, FaCheckCircle, FaClock, FaTimes, FaArrowRight } from "react-icons/fa";
import SEO from "../components/SEO";

const CSS = `
*{box-sizing:border-box}
.bv-root{min-height:100vh;background:#f7f4ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.bv-hero{background:linear-gradient(135deg,#1a1740 0%,#252060 100%);color:#fff;padding:60px clamp(20px,6vw,80px);text-align:center}
.bv-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.4);color:#c9a84c;padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px}
.bv-title{font-size:clamp(26px,5vw,44px);font-weight:800;margin-bottom:12px}
.bv-desc{font-size:14px;color:rgba(255,255,255,.65);max-width:500px;margin:0 auto 32px;line-height:1.7}
.bv-perks{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;max-width:700px;margin:0 auto}
.bv-perk{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;text-align:center}
.bv-perk-icon{font-size:24px;margin-bottom:8px}
.bv-perk-label{font-size:12px;font-weight:700;color:rgba(255,255,255,.85)}
.bv-body{max-width:760px;margin:0 auto;padding:40px clamp(16px,4vw,40px) 60px}
.bv-card{background:#fff;border:1px solid #e8e4d9;border-radius:14px;padding:28px;margin-bottom:20px}
.bv-sec-title{font-size:16px;font-weight:800;color:#1a1740;margin-bottom:20px;display:flex;align-items:center;gap:10px}
.bv-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:600px){.bv-grid{grid-template-columns:1fr}}
.bv-field{margin-bottom:0}
.bv-label{display:block;font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px}
.bv-inp{width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13.5px;color:#1e293b;outline:none;transition:border .15s;background:#fafafe;font-family:inherit}
.bv-inp:focus{border-color:#c9a84c;background:#fff}
.bv-inp.full{grid-column:1/-1}
.bv-upload{border:2px dashed #e2e8f0;border-radius:9px;padding:20px;text-align:center;cursor:pointer;transition:all .2s;position:relative}
.bv-upload:hover,.bv-upload.has{border-color:#c9a84c;background:#fffbeb}
.bv-submit{width:100%;padding:15px;background:#1a1740;border:none;color:#c9a84c;font-size:14px;font-weight:800;letter-spacing:2px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;margin-top:8px}
.bv-submit:hover{background:#252060;box-shadow:0 8px 24px rgba(26,23,64,.2)}
.bv-submit:disabled{opacity:.5;cursor:not-allowed}
.status-box{background:#fff;border-radius:14px;border:2px solid;padding:32px;text-align:center;margin:40px auto;max-width:500px}
`;

const Field = ({ label, children, full }) => (
  <div style={full ? { gridColumn: "1/-1" } : {}}>
    <label className="bv-label">{label}</label>
    {children}
  </div>
);

const BecomeVendor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null); // null=loading, false=not-applied, {status}=applied
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState({});
  const [form, setForm] = useState({
    shopName: "", shopDescription: "", shopCategory: "",
    ownerName: user?.name || "", email: user?.email || "", phone: user?.phone || "",
    gstNumber: "", panNumber: "", businessType: "individual",
    addressLine1: "", addressLine2: "", city: "", state: "", pincode: "",
    bankHolder: "", bankAccount: "", bankIFSC: "", bankName: "",
  });

  useEffect(() => {
    if (!user) { navigate("/login", { state: { from: "/become-vendor" } }); return; }
    api.get("/vendor/status")
      .then(({ data }) => {
        if (data.registered) setStatus(data);
        else setStatus(false);
      })
      .catch(() => setStatus(false))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setFile = (k) => (e) => {
    const f = e.target.files[0];
    if (f) setFiles(p => ({ ...p, [k]: f }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.shopName || !form.ownerName || !form.phone || !form.email)
      return setError("Shop name, owner name, phone aur email zaroori hain");
    if (!form.pincode || !/^\d{6}$/.test(form.pincode))
      return setError("Valid 6-digit pincode daalen");

    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("address", JSON.stringify({
        line1: form.addressLine1, line2: form.addressLine2,
        city: form.city, state: form.state, pincode: form.pincode,
      }));
      fd.append("bankDetails", JSON.stringify({
        accountHolder: form.bankHolder, accountNumber: form.bankAccount,
        ifsc: form.bankIFSC, bankName: form.bankName,
      }));
      fd.append("servicePincodes", JSON.stringify([form.pincode]));
      Object.entries(files).forEach(([k, f]) => fd.append(k, f));

      await api.post("/vendor/register", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Application submit karne mein dikkat hui");
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ee" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e8e4d9", borderTop: "3px solid #c9a84c", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );

  // Already applied
  if (status) {
    const cfg = {
      pending: { color: "#f59e0b", bg: "#fffbeb", icon: "⏳", title: "Application Review Mein Hai", msg: "Aapki application review ho rahi hai. 24-48 ghante mein update milega." },
      approved: { color: "#059669", bg: "#f0fdf4", icon: "✅", title: "Aap Approved Vendor Hain!", msg: "Congratulations! Aap ab apna vendor dashboard use kar sakte hain." },
      rejected: { color: "#dc2626", bg: "#fef2f2", icon: "❌", title: "Application Rejected", msg: `Reason: ${status.rejectionReason || "Admin se contact karein."}` },
    };
    const c = cfg[status.status] || cfg.pending;
    return (
      <div className="bv-root">
        <style>{CSS}</style>
        <div style={{ padding: "60px 20px" }}>
          <div className="status-box" style={{ borderColor: c.color }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{c.icon}</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1740", marginBottom: 8 }}>{c.title}</h2>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24, lineHeight: 1.6 }}>{c.msg}</p>
            {status.status === "approved" && (
              <a href={import.meta.env.VITE_VENDOR_URL || import.meta.env.VITE_VENDOR_URL || "http://localhost:5175"} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "#1a1740", color: "#c9a84c", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                Vendor Dashboard <FaArrowRight size={11} />
              </a>
            )}
            {status.status === "rejected" && (
              <button onClick={() => setStatus(false)} style={{ padding: "11px 22px", background: "#1a1740", border: "none", color: "#c9a84c", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                Dobara Apply Karein
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (success) return (
    <div className="bv-root">
      <style>{CSS}</style>
      <div style={{ padding: "60px 20px" }}>
        <div className="status-box" style={{ borderColor: "#059669" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1740", marginBottom: 8 }}>Application Submit Ho Gayi!</h2>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            Hum aapki application 24-48 ghante mein review karenge.<br />Email par update milega.
          </p>
          <button onClick={() => navigate("/")} style={{ marginTop: 20, padding: "11px 24px", background: "#1a1740", border: "none", color: "#c9a84c", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
            Home Par Jayen
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bv-root">
      <SEO title="Become a Vendor" description="Start selling on Urbexon. Register as a vendor partner and reach lakhs of customers across India." path="/become-vendor" />
      <style>{CSS}</style>
      <div className="bv-hero">
        <div className="bv-badge"><FaStore size={11} />Vendor Partner Program</div>
        <h1 className="bv-title">Apna Business <span style={{ color: "#c9a84c" }}>Urbexon</span> Par Shuru Karein</h1>
        <p className="bv-desc">Lakhs of customers tak pahuncho. Apne products list karein aur zyada kamao.</p>
        <div className="bv-perks">
          {[["🚀", "Quick Setup"], ["💰", "Fast Payouts"], ["📊", "Live Analytics"], ["🛡️", "Secure Platform"]].map(([i, l]) => (
            <div key={l} className="bv-perk"><div className="bv-perk-icon">{i}</div><div className="bv-perk-label">{l}</div></div>
          ))}
        </div>
      </div>

      <div className="bv-body">
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 16px", borderRadius: 10, fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <FaTimes size={12} />{error}
          </div>
        )}

        <form onSubmit={submit}>
          {/* Shop Info */}
          <div className="bv-card">
            <div className="bv-sec-title"><FaStore color="#c9a84c" size={16} />Shop Information</div>
            <div className="bv-grid">
              <Field label="Shop Name *"><input className="bv-inp" value={form.shopName} onChange={set("shopName")} placeholder="Aapke shop ka naam" /></Field>
              <Field label="Shop Category"><input className="bv-inp" value={form.shopCategory} onChange={set("shopCategory")} placeholder="e.g. Food, Grocery" /></Field>
              <Field label="Shop Description" full={true}><textarea className="bv-inp" rows={3} value={form.shopDescription} onChange={set("shopDescription")} placeholder="Aapke shop ke baare mein batayen…" style={{ resize: "vertical" }} /></Field>
            </div>
          </div>

          {/* Owner Info */}
          <div className="bv-card">
            <div className="bv-sec-title"><FaUser color="#c9a84c" size={16} />Owner / Contact Details</div>
            <div className="bv-grid">
              <Field label="Owner Name *"><input className="bv-inp" value={form.ownerName} onChange={set("ownerName")} /></Field>
              <Field label="Email *"><input className="bv-inp" type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Phone *"><input className="bv-inp" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" /></Field>
              <Field label="Business Type">
                <select className="bv-inp" value={form.businessType} onChange={set("businessType")}>
                  <option value="individual">Individual</option>
                  <option value="proprietorship">Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="pvtltd">Pvt. Ltd.</option>
                </select>
              </Field>
              <Field label="GST Number"><input className="bv-inp" value={form.gstNumber} onChange={set("gstNumber")} placeholder="15-digit GST" /></Field>
              <Field label="PAN Number"><input className="bv-inp" value={form.panNumber} onChange={set("panNumber")} placeholder="AAAAA0000A" /></Field>
            </div>
          </div>

          {/* Address */}
          <div className="bv-card">
            <div className="bv-sec-title"><FaMapMarkerAlt color="#c9a84c" size={16} />Shop Address & Service Area</div>
            <div className="bv-grid">
              <Field label="Address Line 1 *" full={true}><input className="bv-inp" value={form.addressLine1} onChange={set("addressLine1")} placeholder="Shop no., Street" /></Field>
              <Field label="Address Line 2"><input className="bv-inp" value={form.addressLine2} onChange={set("addressLine2")} /></Field>
              <Field label="City *"><input className="bv-inp" value={form.city} onChange={set("city")} /></Field>
              <Field label="State *"><input className="bv-inp" value={form.state} onChange={set("state")} /></Field>
              <Field label="Pincode *"><input className="bv-inp" value={form.pincode} onChange={set("pincode")} placeholder="6-digit pincode" maxLength={6} /></Field>
            </div>
          </div>

          {/* Bank Details */}
          <div className="bv-card">
            <div className="bv-sec-title"><FaUniversity color="#c9a84c" size={16} />Bank Account Details</div>
            <div className="bv-grid">
              <Field label="Account Holder Name"><input className="bv-inp" value={form.bankHolder} onChange={set("bankHolder")} /></Field>
              <Field label="Account Number"><input className="bv-inp" value={form.bankAccount} onChange={set("bankAccount")} /></Field>
              <Field label="IFSC Code"><input className="bv-inp" value={form.bankIFSC} onChange={set("bankIFSC")} placeholder="SBIN0001234" /></Field>
              <Field label="Bank Name"><input className="bv-inp" value={form.bankName} onChange={set("bankName")} /></Field>
            </div>
          </div>

          {/* Documents */}
          <div className="bv-card">
            <div className="bv-sec-title"><FaUpload color="#c9a84c" size={16} />Documents Upload</div>
            <div className="bv-grid">
              {[
                ["shopLogo", "Shop Logo (Image)"],
                ["gstCertificate", "GST Certificate (PDF/Image)"],
                ["panCard", "PAN Card"],
                ["cancelledCheque", "Cancelled Cheque"],
              ].map(([k, label]) => (
                <Field key={k} label={label}>
                  <label className={`bv-upload ${files[k] ? "has" : ""}`}>
                    <FaUpload size={16} color={files[k] ? "#c9a84c" : "#94a3b8"} />
                    <div style={{ fontSize: 12, color: files[k] ? "#92400e" : "#94a3b8", marginTop: 6 }}>
                      {files[k] ? files[k].name : "File choose karein"}
                    </div>
                    <input type="file" accept="image/*,.pdf" onChange={setFile(k)} style={{ display: "none" }} />
                  </label>
                </Field>
              ))}
            </div>
          </div>

          <button type="submit" className="bv-submit" disabled={submitting}>
            {submitting ? "Submitting..." : <><FaCheckCircle size={14} />Application Submit Karein</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BecomeVendor;
