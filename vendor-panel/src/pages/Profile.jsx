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
  FiUser,
  FiShoppingBag,
  FiNavigation,
  FiHome,
  FiHash,
} from "react-icons/fi";

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
   Kept in one place so the palette stays consistent
   everywhere it's used below.
═══════════════════════════════════════════════════ */
const T = {
  brand: "#7c3aed",
  brandDeep: "#4f46e5",
  ink: "#111827",
  sub: "#6b7280",
  faint: "#9ca3af",
  border: "#efeaf9",
  pageBg: "#f6f4fc",
  cardShadow: "0 1px 3px rgba(28,17,52,0.05), 0 1px 2px rgba(28,17,52,0.04)",
  success: "#16a34a",
  successBg: "#ecfdf3",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
};

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
            flex: 1, padding: "11px 14px",
            border: `1.5px solid ${T.border}`, borderRadius: 12,
            fontSize: 13, color: T.ink, outline: "none",
            fontFamily: "inherit", boxSizing: "border-box", background: "#fbfaff",
          }}
          onFocus={(e) => (e.target.style.borderColor = T.brand)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
        <button
          type="button"
          onClick={addTag}
          style={{
            padding: "11px 18px", border: "none", borderRadius: 12,
            background: T.ink, color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          Add
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {tags.length === 0 && (
          <span style={{ fontSize: 12, color: T.faint }}>
            No serviceable pincodes added yet. Urbexon Hour products won't be shown to any customer until you add at least one.
          </span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#f3edfe", color: "#5b21b6",
              fontSize: 12, fontWeight: 700,
              padding: "6px 10px 6px 12px", borderRadius: 20,
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{ background: "rgba(124,58,237,0.12)", border: "none", borderRadius: "50%", width: 16, height: 16, cursor: "pointer", color: T.brand, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <FiX size={10} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

const STATUS_CFG = {
  approved: { label: "Verified", bg: T.successBg, c: T.success, icon: FiCheckCircle },
  pending: { label: "Pending", bg: "#fff7e6", c: "#b45309", icon: FiClock },
  rejected: { label: "Rejected", bg: T.dangerBg, c: T.danger, icon: FiXCircle },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || { label: status, bg: "#f3f4f6", c: "#374151", icon: FiClock };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: cfg.bg, color: cfg.c,
      fontSize: 12, fontWeight: 700,
      padding: "5px 11px", borderRadius: 20,
    }}>
      <cfg.icon size={12} />
      {cfg.label}
    </span>
  );
};

const Field = ({ label, hint, children }) => (
  <div>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
      {label}
    </label>
    {children}
    {hint && <p style={{ fontSize: 11, color: T.faint, marginTop: 5, lineHeight: 1.5 }}>{hint}</p>}
  </div>
);

const ReadOnlyInput = ({ value }) => (
  <input
    type="text"
    value={value || ""}
    readOnly
    style={{
      width: "100%", padding: "11px 14px",
      border: `1.5px solid ${T.border}`, borderRadius: 12,
      fontSize: 13, color: T.sub, outline: "none",
      fontFamily: "inherit", boxSizing: "border-box",
      background: "#faf9fd", cursor: "not-allowed",
    }}
  />
);

const Input = ({ value, onChange, placeholder, type = "text", icon: Icon, min, max }) => (
  <div style={{ position: "relative" }}>
    {Icon && <Icon size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: T.faint }} />}
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      style={{
        width: "100%", padding: Icon ? "11px 14px 11px 36px" : "11px 14px",
        border: `1.5px solid ${T.border}`, borderRadius: 12,
        fontSize: 13, color: T.ink, outline: "none",
        fontFamily: "inherit", boxSizing: "border-box",
        transition: "border-color 0.2s", background: "#fbfaff",
      }}
      onFocus={e => e.target.style.borderColor = T.brand}
      onBlur={e => e.target.style.borderColor = T.border}
    />
  </div>
);

const Card = ({ title, icon: Icon, children }) => (
  <div style={{
    background: "#fff", borderRadius: 18,
    boxShadow: T.cardShadow, border: `1px solid ${T.border}`,
    padding: 24, marginBottom: 16,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
      {Icon && <Icon size={13} color={T.brand} />}
      <h3 style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#5b21b6", margin: 0 }}>
        {title}
      </h3>
    </div>
    {children}
  </div>
);

// Small reusable on/off switch used for "Shop Open" and "Accepting Orders"
const Toggle = ({ checked, onChange, disabled }) => (
  <div
    role="switch"
    aria-checked={!!checked}
    tabIndex={0}
    onClick={disabled ? undefined : onChange}
    onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onChange(); } }}
    style={{
      width: 44, height: 24, borderRadius: 12,
      background: checked ? T.brand : "#e5e7eb",
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

// A single row inside the "Shop Status" card — icon, label + description, control
const StatusRow = ({ icon: Icon, label, desc, control, last }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 0",
    borderBottom: last ? "none" : `1px solid ${T.border}`,
  }}>
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: "#f3edfe",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
      }}>
        <Icon size={14} color={T.brand} />
      </div>
      <div>
        <div style={{ fontSize: 13, color: T.ink, fontWeight: 700 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: T.faint, marginTop: 2, maxWidth: 320, lineHeight: 1.5 }}>{desc}</div>}
      </div>
    </div>
    {control}
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
      const { data } = await api.put("/vendor/me", fd, { headers: { "Content-Type": "multipart/form-data" } });
      // BUG FIX: the backend can clamp/filter values (e.g. deliveryRadius
      // capped, invalid servicePincodes dropped) — without this, the form
      // kept showing whatever the vendor typed even though a different
      // value was actually persisted, until a full page reload.
      if (data?.vendor) setVendor({ ...data.vendor, servicePincodes: data.vendor.servicePincodes || [] });
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
      <div style={{ width: 36, height: 36, border: "3px solid #ece7fb", borderTopColor: T.brand, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!vendor) return (
    <div style={{ textAlign: "center", padding: 60, color: T.faint }}>Profile not found</div>
  );

  const initials = (vendor.ownerName || vendor.shopName || "V").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const ringColor = vendor.isOpen ? "#34d399" : "#6b7280";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", background: T.pageBg, paddingBottom: 32 }}>
      <style>{`
        .profile-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 16px; margin-bottom: 16px; align-items: start; }
        .address-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .stat-chip-row { display: flex; gap: 10px; flex-wrap: wrap; }
        @media (max-width: 768px) {
          .profile-grid { grid-template-columns: 1fr !important; }
          .address-grid { grid-template-columns: 1fr !important; }
          .info-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── HERO ─────────────────────────────────────── */}
      <div style={{
        position: "relative", borderRadius: 24, overflow: "hidden",
        background: "linear-gradient(155deg, #1c1730 0%, #2f1f52 55%, #4c2d8f 100%)",
        padding: "36px 28px 56px",
      }}>
        {/* dot-grid texture */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
          backgroundSize: "18px 18px", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.35), transparent 70%)", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", textAlign: "center" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              width: 108, height: 108, borderRadius: "50%",
              padding: 3, background: `conic-gradient(${ringColor}, ${ringColor})`,
              margin: "0 auto",
            }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%", padding: 3, background: "#1c1730",
              }}>
                <div style={{
                  width: "100%", height: "100%", borderRadius: "50%",
                  background: vendor.documents?.ownerPhoto
                    ? `url(${vendor.documents.ownerPhoto}) center/cover`
                    : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, fontWeight: 800, color: "#fff",
                }}>
                  {!vendor.documents?.ownerPhoto && initials}
                </div>
              </div>
            </div>
            <button onClick={() => fileRef.current?.click()} style={{
              position: "absolute", bottom: 2, right: 2,
              width: 30, height: 30, borderRadius: "50%",
              background: "#fff", border: "2px solid #1c1730",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              <FiCamera size={13} color="#374151" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
          </div>

          <h1 style={{ fontSize: 21, fontWeight: 800, color: "#fff", margin: "16px 0 2px", letterSpacing: "-0.01em" }}>
            {vendor.shopName || "Your Shop"}
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0 }}>{vendor.ownerName}</p>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.1)", color: "#fff",
              fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.14)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: vendor.isOpen ? "#34d399" : "#9ca3af" }} />
              {vendor.isOpen ? "Shop Open" : "Shop Closed"}
            </span>
            {vendor.status === "approved" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(52,211,153,0.16)", color: "#6ee7b7",
                fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 20,
                border: "1px solid rgba(52,211,153,0.25)",
              }}>
                <FiCheckCircle size={11} /> Verified Vendor
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── QUICK STATS — overlaps the hero, real data not decoration ── */}
      <div style={{
        position: "relative", margin: "-32px 16px 20px", zIndex: 2,
        background: "#fff", borderRadius: 18, boxShadow: "0 8px 24px rgba(28,17,52,0.14)",
        padding: "16px 20px", display: "flex", justifyContent: "space-around", gap: 8, flexWrap: "wrap",
      }}>
        <div style={{ textAlign: "center", padding: "0 8px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>{(vendor.servicePincodes || []).length}</div>
          <div style={{ fontSize: 10.5, color: T.faint, fontWeight: 600, marginTop: 2 }}>Pincodes Served</div>
        </div>
        <div style={{ width: 1, background: T.border }} />
        <div style={{ textAlign: "center", padding: "0 8px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>{vendor.deliveryRadius ?? 5} km</div>
          <div style={{ fontSize: 10.5, color: T.faint, fontWeight: 600, marginTop: 2 }}>Delivery Radius</div>
        </div>
        <div style={{ width: 1, background: T.border }} />
        <div style={{ textAlign: "center", padding: "0 8px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, textTransform: "capitalize" }}>{vendor.deliveryMode || "both"}</div>
          <div style={{ fontSize: 10.5, color: T.faint, fontWeight: 600, marginTop: 2 }}>Delivery Mode</div>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {msg.text && (
          <div style={{
            background: msg.type === "success" ? T.successBg : T.dangerBg,
            border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: msg.type === "success" ? "#065f46" : "#b91c1c",
            padding: "12px 16px", borderRadius: 12, marginBottom: 16,
            fontSize: 13, fontWeight: 600,
          }}>{msg.text}</div>
        )}

        {/* ── Shop Status ── */}
        <Card title="Shop Status" icon={FiCheckCircle}>
          <StatusRow
            icon={FiShoppingBag}
            label="Shop Open"
            desc="Customers can see & browse your shop"
            control={<Toggle checked={!!vendor.isOpen} onChange={toggleShopStatus} disabled={togglingStatus} />}
          />
          <StatusRow
            icon={FiPauseCircle}
            label="Accepting New Orders"
            desc="Turn off to pause new orders without closing your shop"
            control={<Toggle checked={!!vendor.acceptingOrders} onChange={toggleAcceptingOrders} disabled={togglingOrders} />}
          />
          <StatusRow
            icon={FiCheckCircle}
            label="Verification"
            last
            control={<StatusBadge status={vendor.status} />}
          />
        </Card>

        <div className="profile-grid">
          {/* Account Info */}
          <Card title="Account Info" icon={FiUser}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              <div style={{ fontSize: 11, color: T.faint, lineHeight: 1.5 }}>
                Contact support to update name, email, or phone
              </div>
            </div>
          </Card>

          {/* Shop Details */}
          <Card title="Shop Details" icon={FiShoppingBag}>
            <div style={{ marginBottom: 16 }}>
              <Field label="Shop Description">
                <textarea
                  value={vendor.shopDescription || ""}
                  onChange={e => set("shopDescription", e.target.value)}
                  placeholder="Tell customers about your shop..."
                  rows={3}
                  style={{
                    width: "100%", padding: "11px 14px",
                    border: `1.5px solid ${T.border}`, borderRadius: 12,
                    fontSize: 13, color: T.ink, outline: "none",
                    fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
                    background: "#fbfaff",
                  }}
                  onFocus={e => e.target.style.borderColor = T.brand}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </Field>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="WhatsApp Number">
                <Input
                  value={vendor.whatsapp || ""}
                  onChange={v => set("whatsapp", v)}
                  placeholder="10-digit WhatsApp number"
                  icon={FiMessageCircle}
                />
              </Field>
              <div className="info-grid">
                <Field label="Category">
                  <select
                    value={vendor.shopCategory || ""}
                    onChange={e => set("shopCategory", e.target.value)}
                    style={{
                      width: "100%", padding: "11px 14px",
                      border: `1.5px solid ${T.border}`, borderRadius: 12,
                      fontSize: 13, color: T.ink, outline: "none",
                      fontFamily: "inherit", background: "#fbfaff", cursor: "pointer",
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
            </div>
          </Card>
        </div>

        {/* Delivery Settings */}
        <Card title="Delivery Settings" icon={FiTruck}>
          <div className="info-grid">
            <Field label="Delivery Mode">
              <select
                value={vendor.deliveryMode || "both"}
                onChange={e => set("deliveryMode", e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px",
                  border: `1.5px solid ${T.border}`, borderRadius: 12,
                  fontSize: 13, color: T.ink, outline: "none",
                  fontFamily: "inherit", background: "#fbfaff", cursor: "pointer",
                }}
              >
                {DELIVERY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Delivery Radius (km)" hint="Urbexon Hour never delivers beyond 10km, regardless of this setting.">
              <Input
                type="number"
                min={1}
                max={10}
                value={vendor.deliveryRadius ?? 5}
                onChange={v => set("deliveryRadius", v)}
                placeholder="5"
                icon={FiNavigation}
              />
            </Field>
          </div>
        </Card>

        {/* Business Address */}
        <Card title="Business Address" icon={FiHome}>
          <div style={{ marginBottom: 16 }}>
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
        <Card title="Delivery Zone" icon={FiMapPin}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16, background: "#f8f6fe", padding: "10px 12px", borderRadius: 10 }}>
            <FiHash size={14} color={T.brand} style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
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

        {/* Save Button — sticky so it's always reachable on long forms */}
        <div style={{
          position: "sticky", bottom: 16, display: "flex", justifyContent: "flex-end",
          marginTop: 8,
        }}>
          <button onClick={save} disabled={saving} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "13px 26px",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            color: "#fff", border: "none", borderRadius: 14,
            fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1, transition: "all 0.2s",
            boxShadow: "0 8px 20px rgba(124,58,237,0.35)",
          }}>
            <FiSave size={15} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;