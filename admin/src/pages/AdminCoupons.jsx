/**
 * AdminCoupons.jsx — Full Coupon Management
 * ✅ Create / Edit / Delete / Toggle coupons
 * ✅ PERCENT aur FLAT dono types
 * ✅ Usage tracking
 */
import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/adminApi";
import { FiTag, FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiX, FiSave } from "react-icons/fi";

const T = { blue: "#2563eb", bg: "#f8fafc", white: "#fff", border: "#e2e8f0", text: "#1e293b", muted: "#475569", hint: "#94a3b8", green: "#10b981", red: "#ef4444", amber: "#f59e0b" };

const EMPTY = { code: "", description: "", discountType: "PERCENT", discountValue: "", maxDiscount: "", minOrderValue: "", usageLimit: "", applicableTo: "ALL", expiresAt: "" };

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null=closed
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const searchTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/coupons/admin?search=${encodeURIComponent(search)}&limit=50`);
      setCoupons(data.coupons || []);
    } catch (err) { console.error("Coupons load failed:", err); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [load]);

  const openNew = () => { setError(""); setForm({ ...EMPTY }); };
  const openEdit = (c) => {
    setError("");
    const { _id, code, description, discountType, discountValue, maxDiscount, minOrderValue, usageLimit, applicableTo, expiresAt, isActive } = c;
    setForm({ ...EMPTY, _id, code, description, discountType, discountValue, maxDiscount, minOrderValue, usageLimit, applicableTo, expiresAt: expiresAt ? expiresAt.slice(0, 10) : "", isActive });
  };

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.code || !form.discountValue) return setError("Code and discount value are required");
    setSaving(true); setError("");
    try {
      if (form._id) await api.put(`/coupons/admin/${form._id}`, form);
      else await api.post("/coupons/admin", form);
      setForm(null); load();
    } catch (err) { setError(err.response?.data?.message || "Failed"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("Delete this coupon?")) return;
    try { await api.delete(`/coupons/admin/${id}`); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to delete coupon"); }
  };

  const toggle = async (id) => {
    try { await api.patch(`/coupons/admin/${id}/toggle`); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to toggle coupon"); }
  };

  const Inp = ({ label, k, type = "text", placeholder = "" }) => (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: .8, textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
      <input type={type} min={type === "number" ? "0" : undefined} value={form[k] || ""} onChange={set(k)} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: T.bg, minHeight: "100vh", padding: 24 }}>

      {/* Modal */}
      {form && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setForm(null)}>
          <div style={{ background: T.white, borderRadius: 16, padding: 28, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: 0 }}>{form._id ? "Edit Coupon" : "Create New Coupon"}</h3>
              <button onClick={() => setForm(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.hint }}><FiX size={20} /></button>
            </div>
            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: T.red, padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 16 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1/-1" }}><Inp label="Coupon Code *" k="code" placeholder="e.g. SAVE20" /></div>
              <div style={{ gridColumn: "1/-1" }}><Inp label="Description" k="description" placeholder="Optional description" /></div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: .8, textTransform: "uppercase", marginBottom: 5 }}>Discount Type *</label>
                <select value={form.discountType} onChange={set("discountType")} style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none" }}>
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FLAT">Flat Amount (₹)</option>
                </select>
              </div>
              <Inp label={`Discount Value * (${form.discountType === "PERCENT" ? "%" : "₹"})`} k="discountValue" type="number" placeholder={form.discountType === "PERCENT" ? "20" : "100"} />
              {form.discountType === "PERCENT" && <Inp label="Max Discount (₹)" k="maxDiscount" type="number" placeholder="500" />}
              <Inp label="Min Order Value (₹)" k="minOrderValue" type="number" placeholder="0" />
              <Inp label="Usage Limit" k="usageLimit" type="number" placeholder="Unlimited" />
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: .8, textTransform: "uppercase", marginBottom: 5 }}>Applicable To</label>
                <select value={form.applicableTo} onChange={set("applicableTo")} style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none" }}>
                  <option value="ALL">All Orders</option>
                  <option value="ECOMMERCE">Main Store Only</option>
                  <option value="URBEXON_HOUR">Urbexon Hour Only</option>
                </select>
              </div>
              <Inp label="Expiry Date" k="expiresAt" type="date" />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: 11, background: T.blue, border: "none", color: "#fff", borderRadius: 8, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <FiSave size={14} />{saving ? "Saving…" : "Save Coupon"}
              </button>
              <button onClick={() => setForm(null)} style={{ padding: "11px 20px", border: `1.5px solid ${T.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, color: T.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: "0 0 4px" }}>Coupons</h1>
          <p style={{ fontSize: 13, color: T.hint, margin: 0 }}>Manage promo codes and discounts</p>
        </div>
        <button onClick={openNew} style={{ padding: "10px 20px", background: T.blue, border: "none", color: "#fff", borderRadius: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <FiPlus size={15} />New Coupon
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by coupon code…"
          style={{ padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, outline: "none", width: "100%", maxWidth: 400, background: T.white }} />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: T.hint }}>Loading…</div>
      ) : coupons.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, color: T.hint }}>
          <FiTag size={32} style={{ marginBottom: 12, opacity: .3 }} /><br />No coupons yet. Create your first coupon!
        </div>
      ) : (
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Code", "Discount", "Min Order", "Usage", "Applicable", "Expiry", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.hint, letterSpacing: .8, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c._id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: T.text, letterSpacing: 1 }}>{c.code}</div>
                      {c.description && <div style={{ fontSize: 11, color: T.hint, marginTop: 2 }}>{c.description}</div>}
                    </td>
                    <td style={{ padding: "13px 16px", fontWeight: 700 }}>
                      <span style={{ color: T.green, fontSize: 15 }}>
                        {c.discountType === "PERCENT" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                      </span>
                      {c.maxDiscount && <div style={{ fontSize: 11, color: T.hint }}>Max ₹{c.maxDiscount}</div>}
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13 }}>₹{c.minOrderValue || 0}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13 }}>
                      {c.usedCount} {c.usageLimit ? `/ ${c.usageLimit}` : "/ ∞"}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: c.applicableTo === "ALL" ? "#dbeafe" : c.applicableTo === "URBEXON_HOUR" ? "#fef3c7" : "#f0fdf4", color: c.applicableTo === "ALL" ? "#1d4ed8" : c.applicableTo === "URBEXON_HOUR" ? "#92400e" : "#15803d" }}>
                        {c.applicableTo === "ALL" ? "All" : c.applicableTo === "URBEXON_HOUR" ? "UH Only" : "Main Only"}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: T.muted }}>
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "Never"}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: c.isActive ? "#d1fae5" : "#fee2e2", color: c.isActive ? "#065f46" : "#b91c1c" }}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(c)} style={{ padding: "6px 10px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", cursor: "pointer", color: T.muted, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                          <FiEdit2 size={12} />Edit
                        </button>
                        <button onClick={() => toggle(c._id)} style={{ padding: "6px 10px", border: "none", borderRadius: 7, background: c.isActive ? "#fef3c7" : "#f0fdf4", cursor: "pointer", color: c.isActive ? "#92400e" : "#065f46", display: "flex", alignItems: "center" }}>
                          {c.isActive ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                        </button>
                        <button onClick={() => del(c._id)} style={{ padding: "6px 10px", border: "none", borderRadius: 7, background: "#fef2f2", cursor: "pointer", color: T.red, display: "flex", alignItems: "center" }}>
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCoupons;
