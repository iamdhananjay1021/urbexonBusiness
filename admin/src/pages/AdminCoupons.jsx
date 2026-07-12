/**
 * AdminCoupons.jsx — Full Coupon Management
 * ✅ Create / Edit / Delete / Toggle coupons
 * ✅ PERCENT aur FLAT dono types
 * ✅ Usage tracking
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/adminApi";
import { FiTag, FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiSave } from "react-icons/fi";
import useDebounce from "../hooks/useDebounce";
import { Button, Badge, Table, SearchBar, ErrorState, Modal, FormField, Input, Select } from "../components/ui";

const EMPTY = { code: "", description: "", discountType: "PERCENT", discountValue: "", maxDiscount: "", minOrderValue: "", usageLimit: "", applicableTo: "ALL", expiresAt: "", isActive: true };

const todayStr = () => new Date().toISOString().slice(0, 10);

/* Convert form strings to the right types before hitting the API —
   previously every field (including numbers) was sent as a raw string,
   and blank optional fields were sent as "" instead of being omitted. */
const buildPayload = (form) => {
  const payload = {
    code: form.code.trim().toUpperCase(),
    description: form.description?.trim() || "",
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    applicableTo: form.applicableTo,
    isActive: !!form.isActive,
  };
  if (form.maxDiscount !== "" && form.maxDiscount != null) payload.maxDiscount = Number(form.maxDiscount);
  if (form.minOrderValue !== "" && form.minOrderValue != null) payload.minOrderValue = Number(form.minOrderValue);
  if (form.usageLimit !== "" && form.usageLimit != null) payload.usageLimit = Number(form.usageLimit);
  if (form.expiresAt) payload.expiresAt = form.expiresAt;
  if (form._id) payload._id = form._id;
  return payload;
};

/* ═══════════════════════════════════════════════════
   🐛 FIX: this used to be declared *inside* AdminCoupons,
   reading `form`/`set`/`saving` from closure. Every state
   update (i.e. every keystroke) re-created the Field function
   from scratch, which made React treat it as a brand-new
   component type and unmount+remount the real <input> DOM
   node underneath — killing focus after a single character.
   Moved to module scope with explicit value/onChange props so
   its identity stays stable across renders (input keeps focus).
═══════════════════════════════════════════════════ */
const Field = ({ label, value, onChange, type = "text", placeholder = "", min, max, disabled }) => (
  <FormField label={label}>
    <Input
      type={type}
      min={min ?? (type === "number" ? "0" : undefined)}
      max={max}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
    />
  </FormField>
);

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null=closed
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null); // id currently being toggled/deleted
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/coupons/admin?search=${encodeURIComponent(debouncedSearch)}&limit=50`);
      setCoupons(data.coupons || []);
    } catch (err) { console.error("Coupons load failed:", err); }
    finally { setLoading(false); }
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => { setError(""); setForm({ ...EMPTY }); };
  const openEdit = (c) => {
    setError("");
    const { _id, code, description, discountType, discountValue, maxDiscount, minOrderValue, usageLimit, applicableTo, expiresAt, isActive } = c;
    setForm({ ...EMPTY, _id, code, description, discountType, discountValue, maxDiscount, minOrderValue, usageLimit, applicableTo, expiresAt: expiresAt ? expiresAt.slice(0, 10) : "", isActive });
  };

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const validate = () => {
    if (!form.code.trim()) return "Coupon code is required";
    if (!form.discountValue || Number(form.discountValue) <= 0) return "Enter a discount value greater than 0";
    if (form.discountType === "PERCENT" && Number(form.discountValue) > 100) return "Percentage discount can't exceed 100%";
    if (form.maxDiscount && Number(form.maxDiscount) <= 0) return "Max discount must be greater than 0";
    if (form.minOrderValue && Number(form.minOrderValue) < 0) return "Min order value can't be negative";
    if (form.usageLimit && Number(form.usageLimit) <= 0) return "Usage limit must be greater than 0";
    if (form.expiresAt && form.expiresAt < todayStr()) return "Expiry date can't be in the past";
    return "";
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) return setError(validationError);
    setSaving(true); setError("");
    try {
      const payload = buildPayload(form);
      if (form._id) await api.put(`/coupons/admin/${form._id}`, payload);
      else await api.post("/coupons/admin", payload);
      setForm(null); load();
    } catch (err) { setError(err.response?.data?.message || "Failed to save coupon"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this coupon? This can't be undone.")) return;
    setActionId(id);
    try { await api.delete(`/coupons/admin/${id}`); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to delete coupon"); }
    finally { setActionId(null); }
  };

  const toggle = async (id) => {
    setActionId(id);
    try { await api.patch(`/coupons/admin/${id}/toggle`); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to toggle coupon"); }
    finally { setActionId(null); }
  };

  return (
    <div style={{ fontFamily: "var(--adm-font-sans)", background: "var(--adm-bg)", minHeight: "100vh", padding: 24, boxSizing: "border-box" }}>

      {/* Create / Edit modal */}
      <Modal
        open={!!form}
        onClose={() => !saving && setForm(null)}
        title={form?._id ? "Edit Coupon" : "Create New Coupon"}
        width={580}
        footer={form && (
          <>
            <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" icon={FiSave} loading={saving} onClick={save}>Save Coupon</Button>
          </>
        )}
      >
        {form && (
          <>
            {error && <div style={{ marginBottom: 16 }}><ErrorState message={error} /></div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <Field label="Coupon Code *" value={form.code} onChange={set("code")} placeholder="e.g. SAVE20" disabled={saving} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <Field label="Description" value={form.description} onChange={set("description")} placeholder="Optional description" disabled={saving} />
              </div>
              <FormField label="Discount Type *">
                <Select value={form.discountType} onChange={set("discountType")} disabled={saving}>
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FLAT">Flat Amount (₹)</option>
                </Select>
              </FormField>
              <Field
                label={`Discount Value * (${form.discountType === "PERCENT" ? "%" : "₹"})`}
                value={form.discountValue} onChange={set("discountValue")} type="number"
                placeholder={form.discountType === "PERCENT" ? "20" : "100"}
                max={form.discountType === "PERCENT" ? 100 : undefined}
                disabled={saving}
              />
              {form.discountType === "PERCENT" && (
                <Field label="Max Discount (₹)" value={form.maxDiscount} onChange={set("maxDiscount")} type="number" placeholder="500" disabled={saving} />
              )}
              <Field label="Min Order Value (₹)" value={form.minOrderValue} onChange={set("minOrderValue")} type="number" placeholder="0" disabled={saving} />
              <Field label="Usage Limit" value={form.usageLimit} onChange={set("usageLimit")} type="number" placeholder="Unlimited" disabled={saving} />
              <FormField label="Applicable To">
                <Select value={form.applicableTo} onChange={set("applicableTo")} disabled={saving}>
                  <option value="ALL">All Orders</option>
                  <option value="ECOMMERCE">Main Store Only</option>
                  <option value="URBEXON_HOUR">Urbexon Hour Only</option>
                </Select>
              </FormField>
              <Field label="Expiry Date" value={form.expiresAt} onChange={set("expiresAt")} type="date" min={todayStr()} disabled={saving} />

              {/* Active toggle — previously there was no way to set a coupon's
                  active state at create/edit time; you could only flip it
                  afterwards from the table's toggle button. */}
              <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--adm-bg)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: "10px 14px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)" }}>Active</div>
                  <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>Inactive coupons can't be applied at checkout</div>
                </div>
                <button type="button" disabled={saving} onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                  style={{ background: "none", border: "none", cursor: saving ? "not-allowed" : "pointer", color: form.isActive ? "var(--adm-success)" : "var(--adm-muted)", opacity: saving ? 0.6 : 1, display: "flex" }}>
                  {form.isActive ? <FiToggleRight size={26} /> : <FiToggleLeft size={26} />}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg, var(--adm-primary), #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-text-on-accent)", boxShadow: "0 4px 12px rgba(37,99,235,0.22)", flexShrink: 0 }}>
            <FiTag size={17} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", margin: "0 0 4px" }}>Coupons</h1>
            <p style={{ fontSize: 13, color: "var(--adm-muted)", margin: 0 }}>Manage promo codes and discounts</p>
          </div>
        </div>
        <Button variant="primary" icon={FiPlus} onClick={openNew}>New Coupon</Button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, maxWidth: 400 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by coupon code…" />
      </div>

      {error && !form && <div style={{ marginBottom: 16 }}><ErrorState message={error} onRetry={load} /></div>}

      {/* Table */}
      <Table
        columns={[
          { key: "code", label: "Code" },
          { key: "discount", label: "Discount" },
          { key: "minOrder", label: "Min Order" },
          { key: "usage", label: "Usage" },
          { key: "applicable", label: "Applicable" },
          { key: "expiry", label: "Expiry" },
          { key: "status", label: "Status" },
          { key: "actions", label: "Actions" },
        ]}
        rows={coupons}
        loading={loading}
        empty={{
          icon: FiTag,
          title: debouncedSearch ? `No coupons match "${debouncedSearch}"` : "No coupons yet",
          description: debouncedSearch ? "Try a different search term." : "Create your first coupon to get started.",
        }}
        renderRow={(c) => {
          const isActing = actionId === c._id;
          const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
          return (
            <tr key={c._id}>
              <td>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--adm-text-primary)", letterSpacing: 1 }}>{c.code}</div>
                {c.description && <div style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 2 }}>{c.description}</div>}
              </td>
              <td style={{ fontWeight: 700 }}>
                <span style={{ color: "var(--adm-success)", fontSize: 15 }}>
                  {c.discountType === "PERCENT" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                </span>
                {c.maxDiscount && <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>Max ₹{c.maxDiscount}</div>}
              </td>
              <td style={{ fontSize: 13 }}>₹{c.minOrderValue || 0}</td>
              <td style={{ fontSize: 13 }}>{c.usedCount} {c.usageLimit ? `/ ${c.usageLimit}` : "/ ∞"}</td>
              <td>
                <Badge tone={c.applicableTo === "ALL" ? "primary" : c.applicableTo === "URBEXON_HOUR" ? "warning" : "success"}>
                  {c.applicableTo === "ALL" ? "All" : c.applicableTo === "URBEXON_HOUR" ? "UH Only" : "Main Only"}
                </Badge>
              </td>
              <td style={{ fontSize: 12, color: isExpired ? "var(--adm-danger)" : "var(--adm-text-secondary)", fontWeight: isExpired ? 700 : 400 }}>
                {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "Never"}
                {isExpired && <div style={{ fontSize: 10 }}>Expired</div>}
              </td>
              <td>
                <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</Badge>
              </td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button variant="secondary" size="sm" icon={FiEdit2} disabled={isActing} onClick={() => openEdit(c)} title="Edit coupon">Edit</Button>
                  <Button variant="secondary" size="sm" icon={c.isActive ? FiToggleRight : FiToggleLeft} loading={isActing} disabled={isActing} onClick={() => toggle(c._id)} title={c.isActive ? "Deactivate" : "Activate"} />
                  <Button variant="danger" size="sm" icon={FiTrash2} loading={isActing} disabled={isActing} onClick={() => del(c._id)} title="Delete coupon" />
                </div>
              </td>
            </tr>
          );
        }}
      />
    </div>
  );
};

export default AdminCoupons;