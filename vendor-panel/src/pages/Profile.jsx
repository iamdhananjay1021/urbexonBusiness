/**
 * Profile.jsx — v3.3 Production
 * Matches Figma: Profile Picture, Basic Info, Shop Status, Shop Details, Business Address
 *
 * FIXES (v3.3) — full backend connectivity audit:
 * - ✅ Shop-Open toggle now calls the dedicated PATCH /vendor/toggle-shop
 *   endpoint instead of PUT /vendor/me. `isOpen` wasn't in updateMyProfile's
 *   whitelist before (now fixed there too, but toggle-shop is the purpose
 *   built, simpler endpoint for a pure flip and doesn't need a request body).
 * - ✅ "Website" field now actually persists — it was being sent every save
 *   but silently dropped (missing from both the Vendor schema and the
 *   backend whitelist; both fixed in Vendor.js / venderProfile.js).
 * - ✅ NEW: "WhatsApp Number" field — the field was already sent on every
 *   save() and already supported end-to-end on the backend, but there was
 *   no input for it anywhere in the UI, so vendors could never actually
 *   set it.
 * - ✅ NEW: "Accepting New Orders" toggle — backend field `acceptingOrders`
 *   already existed and was already whitelisted, but had zero UI control.
 *   This is an important operational switch (temporarily pause new orders
 *   without going fully "closed") that was completely inaccessible.
 * - ✅ NEW: "Delivery Mode" select (Self / Platform / Both) — backend field
 *   already existed and was already whitelisted, no UI control existed.
 * - ✅ NEW: "Delivery Radius (km)" field — backend field existed but was
 *   previously only reachable via the separate PUT /vendor/settings route;
 *   now also included in PUT /vendor/me so it saves through this same form.
 *
 * FIXES (v3.2):
 * - ✅ CRITICAL: Field, ReadOnlyInput, Input, Card, and StatusBadge were all
 *   defined INSIDE the Profile component's function body, so every keystroke
 *   re-render created new function references and React remounted the
 *   underlying <input> DOM node — losing focus after every character. Moved
 *   to module-level (outside Profile) so references stay stable.
 *
 * FIX (v3.1): Added a "Delivery Zone" card with a Serviceable Pincodes tag
 * input, wired into save() via `servicePincodes`.
 */
import { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import {
  FiCamera,
  FiSave,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiGlobe,
  FiMapPin,
  FiX,
  FiMessageCircle,
  FiTruck,
  FiPauseCircle,
} from "react-icons/fi";

/* ═══════════════════════════════════════════════════
   MODULE-LEVEL SUB-COMPONENTS
   Defined OUTSIDE Profile so their function references
   stay stable across re-renders (fixes input focus loss).
═══════════════════════════════════════════════════ */

const PincodeTagInput = ({ tags, onChange }) => {
  const [input, setInput] = useState("");

  const addTag = () => {
    const newTag = input.trim();
    if (newTag && /^\d{6}$/.test(newTag) && !tags.includes(newTag) && tags.length < 50) {
      onChange([...tags, newTag]);
      setInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  const removeTag = (tagToRemove) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={handleKeyDown}
          placeholder="Type a 6-digit pincode and press Enter"
          style={{
            flex: 1, padding: "10px 12px",
            border: "1.5px solid #e5e7eb", borderRadius: 10,
            fontSize: 13, color: "#111827", outline: "none",
            fontFamily: "inherit", boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#7c3aed")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
        />
        <button
          type="button"
          onClick={addTag}
          style={{
            padding: "10px 16px", border: "none", borderRadius: 10,
            background: "#f3f4f6", color: "#374151", fontSize: 13, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          Add
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {tags.length === 0 && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            No serviceable pincodes added yet. Urbexon Hour products won't be shown to any customer until you add at least one.
          </span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#ede9fe", color: "#5b21b6",
              fontSize: 12, fontWeight: 700,
              padding: "5px 10px", borderRadius: 20,
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", display: "flex" }}
            >
              <FiX size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

const STATUS_CFG = {
  approved: { label: "Verified", bg: "#d1fae5", c: "#065f46", icon: FiCheckCircle },
  pending: { label: "Pending", bg: "#fef3c7", c: "#92400e", icon: FiClock },
  rejected: { label: "Rejected", bg: "#fee2e2", c: "#b91c1c", icon: FiXCircle },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || { label: status, bg: "#f3f4f6", c: "#374151", icon: FiClock };
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

const ReadOnlyInput = ({ value }) => (
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

const Input = ({ value, onChange, placeholder, type = "text", icon: Icon, min, max }) => (
  <div style={{ position: "relative" }}>
    {Icon && <Icon size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />}
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
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

// Small reusable on/off switch used for both "Shop Open" and "Accepting Orders"
const Toggle = ({ checked, onChange, disabled }) => (
  <div
    role="switch"
    aria-checked={!!checked}
    tabIndex={0}
    onClick={disabled ? undefined : onChange}
    onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onChange(); } }}
    style={{
      width: 44, height: 24, borderRadius: 12,
      background: checked ? "#7c3aed" : "#e5e7eb",
      position: "relative", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      transition: "background 0.2s",
      flexShrink: 0,
    }}
  >
    <div style={{
      width: 18, height: 18, borderRadius: "50%", background: "#fff",
      position: "absolute", top: 3,
      left: checked ? 23 : 3,
      transition: "left 0.2s",
      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    }} />
  </div>
);

const DELIVERY_MODES = [
  { value: "self", label: "Self Delivery (I deliver my own orders)" },
  { value: "platform", label: "Platform Riders (Urbexon riders deliver)" },
  { value: "both", label: "Both — I choose per order" },
];

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
const Profile = () => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [togglingOrders, setTogglingOrders] = useState(false);
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
      .then(r => setVendor({ ...r.data.vendor, servicePincodes: r.data.vendor.servicePincodes || [] }))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      // ✅ FIX: "website" and "whatsapp" now actually persist (schema +
      // whitelist fixed on the backend). "deliveryMode" and "deliveryRadius"
      // added since the UI now exposes controls for them.
      const fields = ["shopDescription", "shopCategory", "whatsapp", "website", "deliveryMode", "deliveryRadius"];
      fields.forEach(f => { if (vendor[f] !== undefined && vendor[f] !== null) fd.append(f, vendor[f]); });
      fd.append("address", JSON.stringify(vendor.address || {}));
      fd.append("servicePincodes", JSON.stringify(vendor.servicePincodes || []));
      await api.put("/vendor/me", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setMsg({ text: "Changes saved successfully!", type: "success" });
    } catch (err) {
      setMsg({ text: err.response?.data?.message || "Failed to save", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);
    }
  };

  // ✅ FIX: uses the dedicated PATCH /vendor/toggle-shop endpoint (a pure
  // flip, no body needed) instead of PUT /vendor/me — isOpen wasn't
  // reliably persisted through the generic profile-save endpoint.
  const toggleShopStatus = async () => {
    if (togglingStatus || !vendor) return;
    const nextIsOpen = !vendor.isOpen;
    setTogglingStatus(true);
    setVendor(prev => ({ ...prev, isOpen: nextIsOpen })); // optimistic
    try {
      const { data } = await api.patch("/vendor/toggle-shop");
      setVendor(prev => ({ ...prev, isOpen: data.isOpen }));
      setMsg({ text: data.message || "Shop status updated", type: "success" });
    } catch (err) {
      setVendor(prev => ({ ...prev, isOpen: !nextIsOpen })); // rollback
      setMsg({ text: err.response?.data?.message || "Failed to update shop status", type: "error" });
    } finally {
      setTogglingStatus(false);
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);
    }
  };

  // ✅ NEW: "Accepting New Orders" — a separate, more granular switch from
  // isOpen (e.g. shop is physically open but temporarily overloaded and
  // wants to pause new incoming orders without going fully "closed").
  // Persists via PUT /vendor/me since `acceptingOrders` is a normal
  // whitelisted field there (no dedicated toggle route exists for it).
  const toggleAcceptingOrders = async () => {
    if (togglingOrders || !vendor) return;
    const next = !vendor.acceptingOrders;
    setTogglingOrders(true);
    setVendor(prev => ({ ...prev, acceptingOrders: next })); // optimistic
    try {
      const fd = new FormData();
      fd.append("acceptingOrders", String(next));
      const { data } = await api.put("/vendor/me", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (data?.vendor) setVendor(prev => ({ ...prev, acceptingOrders: data.vendor.acceptingOrders }));
      setMsg({ text: next ? "Now accepting new orders" : "Paused new orders", type: "success" });
    } catch (err) {
      setVendor(prev => ({ ...prev, acceptingOrders: !next })); // rollback
      setMsg({ text: err.response?.data?.message || "Failed to update order acceptance", type: "error" });
    } finally {
      setTogglingOrders(false);
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
      setVendor({ ...data.vendor, servicePincodes: data.vendor.servicePincodes || [] });
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
            <Field label="WhatsApp Number">
              <Input
                value={vendor.whatsapp || ""}
                onChange={v => set("whatsapp", v)}
                placeholder="10-digit WhatsApp number"
                icon={FiMessageCircle}
              />
            </Field>
            <div style={{ fontSize: 11, color: "#9ca3af", alignSelf: "end" }}>
              Contact support to update name, email, or phone
            </div>
          </div>
        </Card>
      </div>

      <div className="profile-grid">
        {/* Shop Status */}
        <Card title="Shop Status">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>Shop Open</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Customers can see &amp; browse your shop</div>
            </div>
            <Toggle checked={!!vendor.isOpen} onChange={toggleShopStatus} disabled={togglingStatus} />
          </div>

          {/* ✅ NEW: Accepting New Orders — distinct from isOpen. Shop can be
              visible/open but temporarily paused for new incoming orders. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FiPauseCircle size={13} color="#7c3aed" />
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>Accepting New Orders</span>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Turn off to pause new orders without closing your shop</div>
            </div>
            <Toggle checked={!!vendor.acceptingOrders} onChange={toggleAcceptingOrders} disabled={togglingOrders} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Verified Vendor</span>
            <StatusBadge status={vendor.status} />
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

      {/* ✅ NEW: Delivery Settings — deliveryMode + deliveryRadius both
          already existed on the backend model and were already whitelisted
          (deliveryMode) or route-supported (deliveryRadius), but had no UI
          anywhere in the app. */}
      <Card title="Delivery Settings">
        <div className="info-grid">
          <Field label="Delivery Mode">
            <select
              value={vendor.deliveryMode || "both"}
              onChange={e => set("deliveryMode", e.target.value)}
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid #e5e7eb", borderRadius: 10,
                fontSize: 13, color: "#111827", outline: "none",
                fontFamily: "inherit", background: "#fff", cursor: "pointer",
              }}
            >
              {DELIVERY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Delivery Radius (km)">
            <Input
              type="number"
              min={1}
              max={50}
              value={vendor.deliveryRadius ?? 5}
              onChange={v => set("deliveryRadius", v)}
              placeholder="5"
              icon={FiTruck}
            />
          </Field>
        </div>
      </Card>

      {/* Business Address */}
      <Card title="Business Address">
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
          <Field label="Street Address">
            <Input
              value={vendor.address?.line1 || ""}
              onChange={v => setAddr("line1", v)}
              placeholder="123 Business Street"
            />
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

      {/* Delivery Zone / Serviceable Pincodes — this is what actually
          controls which pincodes see this vendor's Urbexon Hour products. */}
      <Card title="Delivery Zone">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <FiMapPin size={14} color="#7c3aed" />
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Only customers checking these exact pincodes on Urbexon Hour will see your products. Business Address PIN Code above is just for your shop's address — it is NOT used for delivery matching.
          </span>
        </div>
        <Field label="Serviceable Pincodes">
          <PincodeTagInput
            tags={vendor.servicePincodes || []}
            onChange={(tags) => set("servicePincodes", tags)}
          />
        </Field>
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