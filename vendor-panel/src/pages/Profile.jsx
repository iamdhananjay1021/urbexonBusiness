/**
 * Profile.jsx — v3.0 Production
 * Matches Figma: Profile Picture, Basic Info, Shop Status, Shop Details, Business Address
 */
import { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import {
  FiCamera,
  FiSave,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiGlobe
} from "react-icons/fi";

const Profile = () => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [categoryList, setCategoryList] = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    api.get("/categories", { params: { type: "urbexon_hour" } })
      .then(({ data }) => {
        const cats = Array.isArray(data) ? data : data.categories || [];
        setCategoryList(cats.filter(c => c.isActive !== false).map(c => c.name));
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    api.get("/vendor/me")
      .then(r => setVendor(r.data.vendor))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      const fields = ["shopDescription", "shopCategory", "whatsapp", "website"];
      fields.forEach(f => { if (vendor[f] !== undefined) fd.append(f, vendor[f]); });
      fd.append("address", JSON.stringify(vendor.address || {}));
      await api.put("/vendor/me", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setMsg({ text: "Changes saved successfully!", type: "success" });
    } catch (err) {
      setMsg({ text: err.response?.data?.message || "Failed to save", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("ownerPhoto", file);
    try {
      const { data } = await api.put("/vendor/me", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setVendor(data.vendor);
    } catch (err) {
      setMsg({ text: err.response?.data?.message || "Failed to upload photo", type: "error" });
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);
    }
  };

  const set = (key, val) => setVendor(prev => ({ ...prev, [key]: val }));
  const setAddr = (key, val) => setVendor(prev => ({ ...prev, address: { ...prev.address, [key]: val } }));

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!vendor) return (
    <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Profile not found</div>
  );

  const initials = (vendor.ownerName || vendor.shopName || "V").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const StatusBadge = () => {
    const cfg = {
      approved: { label: "Verified", bg: "#d1fae5", c: "#065f46", icon: FiCheckCircle },
      pending: { label: "Pending", bg: "#fef3c7", c: "#92400e", icon: FiClock },
      rejected: { label: "Rejected", bg: "#fee2e2", c: "#b91c1c", icon: FiXCircle },
    }[vendor.status] || { label: vendor.status, bg: "#f3f4f6", c: "#374151", icon: FiClock };

    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: cfg.bg, color: cfg.c,
        fontSize: 12, fontWeight: 700,
        padding: "4px 10px", borderRadius: 20,
      }}>
        <cfg.icon size={12} />
        {cfg.label}
      </span>
    );
  };

  const Field = ({ label, children }) => (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );

  const ReadOnlyInput = ({ value, label }) => (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={value || ""}
        readOnly
        style={{
          width: "100%", padding: "10px 12px",
          border: "1.5px solid #f3f4f6", borderRadius: 10,
          fontSize: 13, color: "#6b7280", outline: "none",
          fontFamily: "inherit", boxSizing: "border-box",
          background: "#f9fafb", cursor: "not-allowed",
        }}
      />
    </div>
  );

  const Input = ({ value, onChange, placeholder, type = "text", icon: Icon }) => (
    <div style={{ position: "relative" }}>
      {Icon && <Icon size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />}
      <input
        type={type}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: Icon ? "10px 12px 10px 34px" : "10px 12px",
          border: "1.5px solid #e5e7eb", borderRadius: 10,
          fontSize: 13, color: "#111827", outline: "none",
          fontFamily: "inherit", boxSizing: "border-box",
          transition: "border-color 0.2s",
        }}
        onFocus={e => e.target.style.borderColor = "#7c3aed"}
        onBlur={e => e.target.style.borderColor = "#e5e7eb"}
      />
    </div>
  );

  const Card = ({ title, children }) => (
    <div style={{
      background: "#fff", borderRadius: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      padding: 24, marginBottom: 16,
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #f3f4f6" }}>
        {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 900 }}>
      <style>{`
        .profile-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-bottom: 16px; }
        .address-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 768px) {
          .profile-grid { grid-template-columns: 1fr !important; }
          .address-grid { grid-template-columns: 1fr !important; }
          .info-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Profile</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Manage your vendor profile and shop information</p>
      </div>

      {msg.text && (
        <div style={{
          background: msg.type === "success" ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: msg.type === "success" ? "#065f46" : "#b91c1c",
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          fontSize: 13, fontWeight: 600,
        }}>{msg.text}</div>
      )}

      <div className="profile-grid">
        {/* Profile Picture */}
        <Card title="Profile Picture">
          <div style={{ textAlign: "center" }}>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 12 }}>
              <div style={{
                width: 100, height: 100, borderRadius: "50%",
                background: vendor.documents?.ownerPhoto
                  ? `url(${vendor.documents.ownerPhoto}) center/cover`
                  : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, fontWeight: 800, color: "#fff",
                margin: "0 auto",
              }}>
                {!vendor.documents?.ownerPhoto && initials}
              </div>
              <button onClick={() => fileRef.current?.click()} style={{
                position: "absolute", bottom: 2, right: 2,
                width: 30, height: 30, borderRadius: "50%",
                background: "#fff", border: "2px solid #e5e7eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}>
                <FiCamera size={13} color="#374151" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>JPG, PNG or GIF. Max 2MB</div>
          </div>
        </Card>

        {/* Basic Info */}
        <Card title="Basic Information">
          <div className="info-grid">
            <Field label="Vendor Name">
              <ReadOnlyInput value={vendor.ownerName} />
            </Field>
            <Field label="Shop Name">
              <ReadOnlyInput value={vendor.shopName} />
            </Field>
            <Field label="Email">
              <ReadOnlyInput value={vendor.email} />
            </Field>
            <Field label="Phone">
              <ReadOnlyInput value={vendor.phone} />
            </Field>
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#9ca3af" }}>
              Contact support to update name, email, or phone
            </div>
          </div>
        </Card>
      </div>

      <div className="profile-grid">
        {/* Shop Status */}
        <Card title="Shop Status">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Shop Open</span>
            <div style={{
              width: 44, height: 24, borderRadius: 12,
              background: vendor.isOpen ? "#7c3aed" : "#e5e7eb",
              position: "relative", cursor: "pointer",
              transition: "background 0.2s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 3,
                left: vendor.isOpen ? 23 : 3,
                transition: "left 0.2s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Verified Vendor</span>
            <StatusBadge />
          </div>
        </Card>

        {/* Shop Details */}
        <Card title="Shop Details">
          <div style={{ marginBottom: 16 }}>
            <Field label="Shop Description">
              <textarea
                value={vendor.shopDescription || ""}
                onChange={e => set("shopDescription", e.target.value)}
                placeholder="Tell customers about your shop..."
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid #e5e7eb", borderRadius: 10,
                  fontSize: 13, color: "#111827", outline: "none",
                  fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = "#7c3aed"}
                onBlur={e => e.target.style.borderColor = "#e5e7eb"}
              />
            </Field>
          </div>
          <div className="info-grid">
            <Field label="Category">
              <select
                value={vendor.shopCategory || ""}
                onChange={e => set("shopCategory", e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid #e5e7eb", borderRadius: 10,
                  fontSize: 13, color: "#111827", outline: "none",
                  fontFamily: "inherit", background: "#fff", cursor: "pointer",
                }}
              >
                <option value="">Select category</option>
                {categoryList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Website">
              <Input
                value={vendor.website || ""}
                onChange={v => set("website", v)}
                placeholder="https://example.com"
                icon={FiGlobe}
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* Business Address */}
      <Card title="Business Address">
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
          <Field label="Street Address">
            <div style={{ position: "relative" }}>
              {/* <FiStore size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} /> */}
              <input
                value={vendor.address?.line1 || ""}
                onChange={e => setAddr("line1", e.target.value)}
                placeholder="123 Business Street"
                style={{
                  width: "100%", padding: "10px 12px 10px 34px",
                  border: "1.5px solid #e5e7eb", borderRadius: 10,
                  fontSize: 13, color: "#111827", outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = "#7c3aed"}
                onBlur={e => e.target.style.borderColor = "#e5e7eb"}
              />
            </div>
          </Field>
        </div>
        <div className="address-grid">
          <Field label="City">
            <Input value={vendor.address?.city} onChange={v => setAddr("city", v)} placeholder="Mumbai" />
          </Field>
          <Field label="State">
            <Input value={vendor.address?.state} onChange={v => setAddr("state", v)} placeholder="Maharashtra" />
          </Field>
          <Field label="PIN Code">
            <Input value={vendor.address?.pincode} onChange={v => setAddr("pincode", v)} placeholder="400001" />
          </Field>
        </div>
      </Card>

      {/* Save Button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 24px",
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          color: "#fff", border: "none", borderRadius: 12,
          fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1, transition: "all 0.2s",
        }}>
          <FiSave size={15} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

    </div>
  );
};

export default Profile;