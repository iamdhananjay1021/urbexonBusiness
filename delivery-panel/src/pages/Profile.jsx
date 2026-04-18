/**
 * Delivery Profile — Production v5.0
 * Urbexon design + real API integration
 * ✅ Dynamic document section with re-upload, status badges, fullscreen viewer
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { G, fmt } from "../utils/theme";

const Profile = () => {
  const { rider, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(rider);
  const [editMode, setEditMode] = useState(false);
  const [city, setCity] = useState(rider?.city || "");
  const [vehicleNumber, setVehicleNumber] = useState(rider?.vehicleNumber || "");
  const [vehicleModel, setVehicleModel] = useState(rider?.vehicleModel || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [notifOn, setNotifOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fullscreenDoc, setFullscreenDoc] = useState(null);
  const [uploading, setUploading] = useState({});
  const fileRefs = useRef({});

  // ── Bank details state ──
  const [bankEdit, setBankEdit] = useState(false);
  const [bankForm, setBankForm] = useState({ accountHolder: "", accountNumber: "", ifsc: "", bankName: "", branch: "", upiId: "" });
  const [bankSaving, setBankSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get("/delivery/status");
      if (data.rider) {
        setProfile(data.rider);
        setCity(data.rider.city || "");
        setVehicleNumber(data.rider.vehicleNumber || "");
        setVehicleModel(data.rider.vehicleModel || "");
        const bd = data.rider.bankDetails || {};
        setBankForm({ accountHolder: bd.accountHolder || "", accountNumber: bd.accountNumber || "", ifsc: bd.ifsc || "", bankName: bd.bankName || "", branch: bd.branch || "", upiId: bd.upiId || "" });
      }
    } catch (err) {
      console.error("[Profile]", err.message);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch("/delivery/profile", { city, vehicleNumber, vehicleModel });
      setMsg("Profile updated successfully!");
      setEditMode(false);
      if (data.rider) setProfile(data.rider);
    } catch {
      setMsg("Update failed. Try again.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const handleDocUpload = async (field, file) => {
    if (!file) return;
    setUploading(p => ({ ...p, [field]: true }));
    try {
      const fd = new FormData();
      fd.append(field, file);
      const { data } = await api.patch("/delivery/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (data.rider) {
        setProfile(data.rider);
        setMsg("Document uploaded! Under review.");
      }
    } catch { setMsg("Upload failed. Try again."); }
    finally {
      setUploading(p => ({ ...p, [field]: false }));
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const r = profile || rider;
  const docs = r?.documents || {};
  const bd = r?.bankDetails || {};
  const hasBankDetails = !!(bd.accountNumber || bd.upiId);

  const saveBank = async () => {
    if (!bankForm.accountNumber && !bankForm.upiId) { setMsg("Add bank account or UPI ID"); setTimeout(() => setMsg(""), 3000); return; }
    setBankSaving(true);
    try {
      const { data } = await api.patch("/delivery/bank-details", bankForm);
      setMsg("Bank details updated!");
      setBankEdit(false);
      if (data.bankDetails) setProfile(p => ({ ...p, bankDetails: data.bankDetails }));
    } catch { setMsg("Failed to update bank details"); }
    finally { setBankSaving(false); setTimeout(() => setMsg(""), 3000); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${G.green100}`, borderTopColor: G.brand, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ animation: "slideUp .25s ease" }}>
      {/* ── Success / Error Message ── */}
      {msg && (
        <div style={{ margin: "12px var(--px) 0", background: G.green50, border: `1px solid #86efac`, color: "#15803d", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* ── Profile Card ── */}
      <div style={{ padding: "20px var(--px) 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: G.navy, color: G.brand, fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {(r?.name?.[0] || "R").toUpperCase()}
          </div>
          {r?.status === "approved" && (
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 20, height: 20, background: G.brand, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: `2px solid ${G.white}` }}>✓</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: G.text }}>{r?.name || "Rider"}</div>
          <div style={{ fontSize: 12, color: G.textSub, marginTop: 2 }}>{r?.phone}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: r?.status === "approved" ? G.green100 : r?.status === "rejected" ? G.red50 : G.amber50, color: r?.status === "approved" ? "#065f46" : r?.status === "rejected" ? G.red600 : G.amber600 }}>
              {r?.status === "approved" ? "✓ Verified" : r?.status === "rejected" ? "✕ Rejected" : "⏳ Pending"}
            </span>
            {r?.rating > 0 && <span style={{ fontSize: 12, color: G.text, fontWeight: 600 }}>⭐ {Number(r.rating).toFixed(1)}</span>}
          </div>
        </div>
        <button onClick={() => setEditMode(!editMode)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: G.textSub, padding: 4 }}>✏️</button>
      </div>

      {/* ── Stats ── */}
      <div style={{ margin: "0 var(--px)" }}>
        <div className="ud-profile-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden" }}>
          {[
            { label: "Total Deliveries", value: (r?.totalDeliveries || 0).toLocaleString("en-IN") },
            { label: "Vehicle", value: r?.vehicleType ? r.vehicleType.charAt(0).toUpperCase() + r.vehicleType.slice(1) : "—", sub: vehicleNumber },
            { label: "Total Earnings", value: fmt(r?.totalEarnings), green: true },
            { label: "This Week", value: r?.weekDeliveries || 0 },
          ].map((s, i) => (
            <div key={i} style={{ padding: "14px 16px", borderRight: i % 2 === 0 ? `1px solid ${G.border}` : "none", borderBottom: i < 2 ? `1px solid ${G.border}` : "none" }}>
              <div style={{ fontSize: 11, color: G.textSub }}>{s.label}</div>
              <div style={{ fontSize: s.green ? 18 : 20, fontWeight: 800, color: s.green ? G.brand : G.text, marginTop: 2 }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 11, color: G.textSub }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Contact Info ── */}
      <div style={{ margin: "16px var(--px) 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Contact Information</div>
        <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, padding: "0 16px" }}>
          {[
            { icon: "📞", label: "Phone Number", value: r?.phone || "—" },
            { icon: "✉️", label: "Email Address", value: r?.email || "—" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", borderBottom: i === 0 ? `1px solid ${G.borderLight}` : "none" }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: G.textSub }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Edit Section ── */}
      {editMode && (
        <div style={{ margin: "16px var(--px) 0", animation: "slideUp .2s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Edit Details</div>
          <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, padding: "14px 16px" }}>
            {[
              { label: "City", val: city, set: setCity },
              { label: "Vehicle Number", val: vehicleNumber, set: setVehicleNumber },
              { label: "Vehicle Model", val: vehicleModel, set: setVehicleModel },
            ].map((f, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: G.textSub, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</div>
                <input
                  type="text"
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${G.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => { e.target.style.borderColor = G.brand; }}
                  onBlur={e => { e.target.style.borderColor = G.border; }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditMode(false)} style={{ flex: 1, padding: "10px", border: `1px solid ${G.border}`, borderRadius: 8, background: "none", color: G.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 8, background: G.brand, color: G.white, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Documents ── */}
      <div style={{ margin: "16px var(--px) 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Documents</div>
        <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden" }}>
          {[
            { key: "aadhaarPhoto", label: "Aadhaar Card", icon: "🪪" },
            { key: "licensePhoto", label: "Driving License", icon: "📄" },
            { key: "vehicleRc", label: "Vehicle RC", icon: "🚗" },
            { key: "selfie", label: "Selfie", icon: "🤳" },
          ].map((doc, i, arr) => {
            const url = docs[doc.key];
            const status = r?.documentStatus?.[doc.key] || "pending";
            const note = r?.documentNotes?.[doc.key] || "";
            const isUploading = uploading[doc.key];
            const statusCfg = status === "approved" ? { bg: "#d1fae5", color: "#065f46", label: "✓ Approved" }
              : status === "rejected" ? { bg: "#fee2e2", color: "#b91c1c", label: "✕ Rejected" }
                : { bg: "#fef3c7", color: "#92400e", label: "⏳ Pending" };

            return (
              <div key={doc.key} style={{ padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${G.borderLight}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{doc.icon}</span>
                  {url ? (
                    <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: `1px solid ${G.border}`, cursor: "pointer", flexShrink: 0 }}
                      onClick={() => setFullscreenDoc({ url, label: doc.label })}>
                      <img src={url} alt={doc.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                    </div>
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: "#f8fafc", border: `1px dashed ${G.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: G.textMuted }}>N/A</span>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{doc.label}</div>
                    <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: statusCfg.bg, color: statusCfg.color }}>
                      {statusCfg.label}
                    </span>
                    {note && status === "rejected" && (
                      <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 3, lineHeight: 1.3 }}>📝 {note}</div>
                    )}
                  </div>
                  {/* Re-upload button (show when rejected, pending-no-url, or always for update) */}
                  <div style={{ flexShrink: 0 }}>
                    <input type="file" accept="image/*,application/pdf" ref={el => fileRefs.current[doc.key] = el} style={{ display: "none" }}
                      onChange={e => { if (e.target.files[0]) handleDocUpload(doc.key, e.target.files[0]); e.target.value = ""; }} />
                    <button
                      onClick={() => fileRefs.current[doc.key]?.click()}
                      disabled={isUploading}
                      style={{ padding: "6px 10px", border: `1px solid ${status === "rejected" ? "#fca5a5" : G.border}`, borderRadius: 8, background: status === "rejected" ? "#fef2f2" : "#f8fafc", color: status === "rejected" ? "#b91c1c" : G.textSub, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: isUploading ? 0.5 : 1 }}
                    >
                      {isUploading ? "…" : url ? "↻" : "Upload"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Fullscreen Document Viewer ── */}
      {fullscreenDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onClick={() => setFullscreenDoc(null)}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{fullscreenDoc.label}</div>
          <img src={fullscreenDoc.url} alt={fullscreenDoc.label} style={{ maxWidth: "92vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setFullscreenDoc(null)} style={{ marginTop: 16, padding: "8px 24px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
        </div>
      )}

      {/* ── Settings ── */}
      <div style={{ margin: "16px var(--px) 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 10 }}>Settings</div>
        <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 12, padding: "0 16px" }}>
          {/* Notifications toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${G.borderLight}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>Notifications</div>
                <div style={{ fontSize: 11, color: G.textSub }}>Receive order alerts</div>
              </div>
            </div>
            <button
              onClick={() => setNotifOn(!notifOn)}
              style={{ width: 44, height: 24, background: notifOn ? G.brand : "#d1d5db", borderRadius: 12, position: "relative", cursor: "pointer", border: "none", transition: "background .2s" }}
            >
              <div style={{ width: 18, height: 18, background: G.white, borderRadius: "50%", position: "absolute", top: 3, left: notifOn ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </div>
          {/* Bank / UPI details */}
          <div style={{ padding: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>💳</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>Bank / UPI Details</div>
                  <div style={{ fontSize: 11, color: G.textSub }}>
                    {hasBankDetails ? (bd.bankName ? `${bd.bankName} ••${bd.accountNumber?.slice(-4) || ""}` : bd.upiId || "Added") : "Not added yet"}
                  </div>
                </div>
              </div>
              <button onClick={() => setBankEdit(!bankEdit)} style={{ background: "none", border: "none", fontSize: bankEdit ? 13 : 16, color: bankEdit ? G.red600 : G.textMuted, cursor: "pointer", fontWeight: 600 }}>
                {bankEdit ? "✕" : "›"}
              </button>
            </div>
            {bankEdit && (
              <div style={{ marginTop: 12, animation: "slideUp .2s ease" }}>
                {[
                  { key: "accountHolder", label: "Account Holder Name" },
                  { key: "accountNumber", label: "Account Number" },
                  { key: "ifsc", label: "IFSC Code" },
                  { key: "bankName", label: "Bank Name" },
                  { key: "branch", label: "Branch" },
                  { key: "upiId", label: "UPI ID (e.g. name@upi)" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: G.textSub, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</div>
                    <input
                      type="text" value={bankForm[f.key]} onChange={e => setBankForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${G.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => { e.target.style.borderColor = G.brand; }} onBlur={e => { e.target.style.borderColor = G.border; }}
                    />
                  </div>
                ))}
                <button onClick={saveBank} disabled={bankSaving} style={{ width: "100%", padding: "10px", border: "none", borderRadius: 8, background: G.brand, color: G.white, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: bankSaving ? 0.6 : 1, marginTop: 4 }}>
                  {bankSaving ? "Saving…" : "Save Bank Details"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Logout ── */}
      <div style={{ padding: "16px var(--px) 8px" }}>
        <button
          onClick={handleLogout}
          style={{ width: "100%", padding: 13, background: G.red50, border: `1px solid #fecaca`, borderRadius: 10, color: G.red600, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          🚪 Logout
        </button>
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
};

export default Profile;
