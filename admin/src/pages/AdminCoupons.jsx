/**
 * AdminCoupons.jsx — Full Coupon Management (Phase 1 engine rebuild)
 * ✅ Create / Edit / Delete / Toggle coupons
 * ✅ PERCENT / FLAT / Free Shipping
 * ✅ Priority + stacking + auto-apply resolution
 * ✅ Category/brand/product/vendor/collection targeting + exclusions
 * ✅ State/pincode restriction, per-user + daily + global usage limits
 * ✅ Vendor subscription coupon scope
 * ✅ Real usage/redemption stats (backed by the CouponUsage ledger)
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/adminApi";
import { FiTag, FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiSave, FiBarChart2, FiSend, FiCopy } from "react-icons/fi";
import useDebounce from "../hooks/useDebounce";
import { fetchAllCategories } from "../api/categoryApi";
import { Button, Badge, Table, SearchBar, ErrorState, Modal, FormField, Input, Select, MultiSelectSearch } from "../components/ui";

const SUBSCRIPTION_PLANS = ["starter", "basic", "standard", "premium"];

const EMPTY = {
  code: "", description: "", discountType: "PERCENT", discountValue: "", maxDiscount: "", minOrderValue: "",
  usageLimit: "", userUsageLimit: "1", dailyRedemptionLimit: "", firstOrderOnly: false,
  activeHoursStart: "", activeHoursEnd: "", minItemQuantity: "", categoryMinSpend: "",
  minCustomerOrders: "", minCustomerSpend: "",
  applicableTo: "ALL", couponModule: "ORDER", applicableSubscriptionPlans: [],
  priority: "0", isStackable: false, isExclusive: false, autoApply: false,
  applicableCategories: [], applicableBrands: "", applicableProducts: [], applicableVendors: [], applicableCollections: [],
  excludedProducts: [], excludedCategories: "", excludedVendors: [], excludedUsers: "", excludedBrands: "",
  applicableStates: "", applicablePincodes: "",
  expiresAt: "", isActive: true,
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const csvToArr = (s) => String(s || "").split(",").map((t) => t.trim()).filter(Boolean);
const idsCsvToArr = (s) => csvToArr(s);

/* Convert form strings to the right types before hitting the API. */
const buildPayload = (form) => {
  const payload = {
    code: form.code.trim().toUpperCase(),
    description: form.description?.trim() || "",
    discountType: form.discountType,
    discountValue: form.discountType === "FREE_SHIPPING" ? 0 : Number(form.discountValue),
    applicableTo: form.applicableTo,
    couponModule: form.couponModule,
    applicableSubscriptionPlans: form.applicableSubscriptionPlans,
    priority: Number(form.priority) || 0,
    isStackable: !!form.isStackable,
    isExclusive: !!form.isExclusive,
    autoApply: !!form.autoApply,
    isActive: !!form.isActive,
    firstOrderOnly: !!form.firstOrderOnly,
    minItemQuantity: Number(form.minItemQuantity) || 0,
    categoryMinSpend: Number(form.categoryMinSpend) || 0,
    minCustomerOrders: Number(form.minCustomerOrders) || 0,
    minCustomerSpend: Number(form.minCustomerSpend) || 0,
    activeHours: { start: form.activeHoursStart || null, end: form.activeHoursEnd || null },
    applicableCategories: form.applicableCategories,
    applicableBrands: csvToArr(form.applicableBrands),
    applicableProducts: form.applicableProducts,
    applicableVendors: form.applicableVendors,
    applicableCollections: form.applicableCollections,
    excludedProducts: form.excludedProducts,
    excludedCategories: csvToArr(form.excludedCategories),
    excludedVendors: form.excludedVendors,
    excludedUsers: idsCsvToArr(form.excludedUsers),
    excludedBrands: csvToArr(form.excludedBrands),
    applicableStates: csvToArr(form.applicableStates),
    applicablePincodes: csvToArr(form.applicablePincodes),
  };
  if (form.maxDiscount !== "" && form.maxDiscount != null) payload.maxDiscount = Number(form.maxDiscount);
  if (form.minOrderValue !== "" && form.minOrderValue != null) payload.minOrderValue = Number(form.minOrderValue);
  if (form.usageLimit !== "" && form.usageLimit != null) payload.usageLimit = Number(form.usageLimit);
  payload.userUsageLimit = form.userUsageLimit === "" ? null : Number(form.userUsageLimit);
  if (form.dailyRedemptionLimit !== "" && form.dailyRedemptionLimit != null) payload.dailyRedemptionLimit = Number(form.dailyRedemptionLimit);
  if (form.expiresAt) payload.expiresAt = form.expiresAt;
  if (form._id) payload._id = form._id;
  return payload;
};

const toForm = (c) => ({
  ...EMPTY,
  _id: c._id,
  code: c.code, description: c.description || "",
  discountType: c.discountType, discountValue: c.discountValue,
  maxDiscount: c.maxDiscount ?? "", minOrderValue: c.minOrderValue ?? "",
  usageLimit: c.usageLimit ?? "", userUsageLimit: c.userUsageLimit === null || c.userUsageLimit === undefined ? "" : c.userUsageLimit,
  dailyRedemptionLimit: c.dailyRedemptionLimit ?? "", firstOrderOnly: !!c.firstOrderOnly,
  activeHoursStart: c.activeHours?.start || "", activeHoursEnd: c.activeHours?.end || "",
  minItemQuantity: c.minItemQuantity || "", categoryMinSpend: c.categoryMinSpend || "",
  minCustomerOrders: c.minCustomerOrders || "", minCustomerSpend: c.minCustomerSpend || "",
  applicableTo: c.applicableTo || "ALL", couponModule: c.couponModule || "ORDER",
  applicableSubscriptionPlans: c.applicableSubscriptionPlans || [],
  priority: c.priority ?? 0, isStackable: !!c.isStackable, isExclusive: !!c.isExclusive, autoApply: !!c.autoApply,
  applicableCategories: (c.applicableCategories || []).map(String),
  applicableBrands: (c.applicableBrands || []).join(", "),
  applicableProducts: (c.applicableProducts || []).map(String),
  applicableVendors: (c.applicableVendors || []).map(String),
  applicableCollections: (c.applicableCollections || []).map(String),
  excludedProducts: (c.excludedProducts || []).map(String),
  excludedCategories: (c.excludedCategories || []).join(", "),
  excludedVendors: (c.excludedVendors || []).map(String),
  excludedUsers: (c.excludedUsers || []).join(", "),
  excludedBrands: (c.excludedBrands || []).join(", "),
  applicableStates: (c.applicableStates || []).join(", "),
  applicablePincodes: (c.applicablePincodes || []).join(", "),
  expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
  isActive: c.isActive !== false,
  redemptions: c.redemptions || 0,
  totalDiscountGiven: c.totalDiscountGiven || 0,
});

/* Stable module-scope identity — see the historical bug-fix note this
   codebase already carries elsewhere: an inline component defined inside
   the parent gets recreated (and its DOM remounted) on every keystroke. */
const Field = ({ label, value, onChange, type = "text", placeholder = "", min, max, disabled, hint }) => (
  <FormField label={hint ? <>{label} <span style={{ fontWeight: 500, color: "var(--adm-muted)" }}>{hint}</span></> : label}>
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

const TABS = ["Basics", "Usage Limits", "Targeting", "Priority & Behavior", "Usage"];

const AdminCoupons = () => {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null=closed
  const [tab, setTab] = useState("Basics");
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [categories, setCategories] = useState([]); // full list, fetched once — small/admin-curated, so a picker beats free-text typing

  useEffect(() => {
    fetchAllCategories()
      .then((r) => setCategories(r.data?.categories || r.data || []))
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/coupons/admin?search=${encodeURIComponent(debouncedSearch)}&limit=50`);
      setCoupons(data.coupons || []);
    } catch (err) { console.error("Coupons load failed:", err); }
    finally { setLoading(false); }
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setError(""); setTab("Basics"); setForm({ ...EMPTY }); };
  const openEdit = (c) => { setError(""); setTab("Basics"); setForm(toForm(c)); };
  // Everything except _id and code carries over — code must stay globally
  // unique so it can't just be copied verbatim; "-COPY" is a starting
  // suggestion, not a final value, admin is expected to rename it.
  const duplicate = (c) => {
    setError(""); setTab("Basics");
    const copy = toForm(c);
    delete copy._id;
    copy.code = `${c.code}-COPY`;
    setForm(copy);
  };

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setBool = (k) => () => setForm((p) => ({ ...p, [k]: !p[k] }));
  const setArr = (k) => (ids) => setForm((p) => ({ ...p, [k]: ids }));

  const togglePlan = (plan) => setForm((p) => ({
    ...p,
    applicableSubscriptionPlans: p.applicableSubscriptionPlans.includes(plan)
      ? p.applicableSubscriptionPlans.filter((x) => x !== plan)
      : [...p.applicableSubscriptionPlans, plan],
  }));

  const validate = () => {
    if (!form.code.trim()) return "Coupon code is required";
    if (form.discountType !== "FREE_SHIPPING") {
      if (!form.discountValue || Number(form.discountValue) <= 0) return "Enter a discount value greater than 0";
      if (form.discountType === "PERCENT" && Number(form.discountValue) > 100) return "Percentage discount can't exceed 100%";
    }
    if (form.maxDiscount && Number(form.maxDiscount) <= 0) return "Max discount must be greater than 0";
    if (form.minOrderValue && Number(form.minOrderValue) < 0) return "Min order value can't be negative";
    if (form.usageLimit && Number(form.usageLimit) <= 0) return "Usage limit must be greater than 0";
    if (form.userUsageLimit !== "" && Number(form.userUsageLimit) <= 0) return "Per-user limit must be greater than 0 (or blank for unlimited)";
    if (form.dailyRedemptionLimit && Number(form.dailyRedemptionLimit) <= 0) return "Daily limit must be greater than 0";
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

  // Reuses the already-built Admin Broadcast (email/WhatsApp fan-out) —
  // hands off a ready-made announcement message via router state instead
  // of duplicating any send logic here.
  const announce = (c) => {
    const value = c.discountType === "PERCENT" ? `${c.discountValue}% off`
      : c.discountType === "FREE_SHIPPING" ? "Free shipping"
        : `₹${c.discountValue} off`;
    navigate("/admin/broadcast", { state: { prefillMessage: `🎉 Use code ${c.code} for ${value}${c.description ? ` — ${c.description}` : ""}!` } });
  };

  return (
    <div style={{ fontFamily: "var(--adm-font-sans)", background: "var(--adm-bg)", minHeight: "100vh", padding: 24, boxSizing: "border-box" }}>

      {/* Create / Edit modal */}
      <Modal
        open={!!form}
        onClose={() => !saving && setForm(null)}
        title={form?._id ? "Edit Coupon" : "Create New Coupon"}
        width={720}
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

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--adm-border)", overflowX: "auto" }}>
              {TABS.filter((t) => t !== "Usage" || form._id).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  style={{ padding: "8px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "var(--adm-primary)" : "transparent"}`, color: tab === t ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontWeight: tab === t ? 700 : 500, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                  {t}
                </button>
              ))}
            </div>

            {tab === "Basics" && (
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
                    <option value="FREE_SHIPPING">Free Shipping</option>
                  </Select>
                </FormField>
                {form.discountType !== "FREE_SHIPPING" && (
                  <Field
                    label={`Discount Value * (${form.discountType === "PERCENT" ? "%" : "₹"})`}
                    value={form.discountValue} onChange={set("discountValue")} type="number"
                    placeholder={form.discountType === "PERCENT" ? "20" : "100"}
                    max={form.discountType === "PERCENT" ? 100 : undefined}
                    disabled={saving}
                  />
                )}
                {form.discountType === "PERCENT" && (
                  <Field label="Max Discount (₹)" value={form.maxDiscount} onChange={set("maxDiscount")} type="number" placeholder="500" disabled={saving} />
                )}
                <Field label="Min Order Value (₹)" value={form.minOrderValue} onChange={set("minOrderValue")} type="number" placeholder="0" disabled={saving} />
                <Field label="Expiry Date" value={form.expiresAt} onChange={set("expiresAt")} type="date" min={todayStr()} disabled={saving} />

                <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--adm-bg)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: "10px 14px" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)" }}>Active</div>
                    <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>Inactive coupons can't be applied at checkout</div>
                  </div>
                  <button type="button" disabled={saving} onClick={setBool("isActive")}
                    style={{ background: "none", border: "none", cursor: saving ? "not-allowed" : "pointer", color: form.isActive ? "var(--adm-success)" : "var(--adm-muted)", opacity: saving ? 0.6 : 1, display: "flex" }}>
                    {form.isActive ? <FiToggleRight size={26} /> : <FiToggleLeft size={26} />}
                  </button>
                </div>
              </div>
            )}

            {tab === "Usage Limits" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Global Usage Limit" value={form.usageLimit} onChange={set("usageLimit")} type="number" placeholder="Unlimited" disabled={saving} hint="(total redemptions across all users)" />
                <Field label="Per-User Limit" value={form.userUsageLimit} onChange={set("userUsageLimit")} type="number" placeholder="Blank = unlimited" disabled={saving} hint="(default 1 = once per customer)" />
                <Field label="Daily Redemption Limit" value={form.dailyRedemptionLimit} onChange={set("dailyRedemptionLimit")} type="number" placeholder="Unlimited" disabled={saving} hint="(resets every day, IST)" />
                <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--adm-bg)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: "10px 14px" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-primary)" }}>First order only</div>
                    <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>Only valid for a customer who has never placed an order before</div>
                  </div>
                  <button type="button" disabled={saving} onClick={setBool("firstOrderOnly")}
                    style={{ background: "none", border: "none", cursor: saving ? "not-allowed" : "pointer", color: form.firstOrderOnly ? "var(--adm-success)" : "var(--adm-muted)", opacity: saving ? 0.6 : 1, display: "flex" }}>
                    {form.firstOrderOnly ? <FiToggleRight size={26} /> : <FiToggleLeft size={26} />}
                  </button>
                </div>
                <div style={{ gridColumn: "1/-1", fontSize: 11.5, color: "var(--adm-muted)", background: "var(--adm-bg)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: "10px 14px", lineHeight: 1.6 }}>
                  Leaving Per-User Limit blank means unlimited uses per customer — for high-volume coupons, this also skips per-user tracking on the coupon record to avoid unbounded growth. Redemption history is always fully recorded regardless.
                </div>

                <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--adm-border)", marginTop: 4, paddingTop: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-text-secondary)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Happy Hour (optional)</p>
                </div>
                <Field label="Active From" value={form.activeHoursStart} onChange={set("activeHoursStart")} type="time" disabled={saving} hint="(IST, blank = all day)" />
                <Field label="Active Until" value={form.activeHoursEnd} onChange={set("activeHoursEnd")} type="time" disabled={saving} hint="(daily recurring)" />

                <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--adm-border)", marginTop: 4, paddingTop: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--adm-text-secondary)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Quantity & Customer (optional)</p>
                </div>
                <Field label="Min Item Quantity" value={form.minItemQuantity} onChange={set("minItemQuantity")} type="number" placeholder="0" disabled={saving} hint="(total qty, e.g. 'buy 3+')" />
                <div />
                <Field label="Min Past Orders" value={form.minCustomerOrders} onChange={set("minCustomerOrders")} type="number" placeholder="0" disabled={saving} hint="(VIP/loyal customers only)" />
                <Field label="Min Lifetime Spend (₹)" value={form.minCustomerSpend} onChange={set("minCustomerSpend")} type="number" placeholder="0" disabled={saving} />
              </div>
            )}

            {tab === "Targeting" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <FormField label="Applies To">
                  <div style={{ display: "flex", gap: 10 }}>
                    {[["ORDER", "🛒 Orders"], ["VENDOR_SUBSCRIPTION", "🏪 Vendor Subscriptions"]].map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setForm((p) => ({ ...p, couponModule: val }))}
                        style={{ flex: 1, padding: "10px 14px", border: `2px solid ${form.couponModule === val ? "var(--adm-primary)" : "var(--adm-border)"}`, borderRadius: "var(--adm-radius-md)", background: form.couponModule === val ? "var(--adm-primary-tint)" : "var(--adm-surface)", cursor: "pointer", fontSize: 12.5, fontWeight: form.couponModule === val ? 700 : 500, color: form.couponModule === val ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontFamily: "inherit" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </FormField>

                {form.couponModule === "ORDER" ? (
                  <>
                    <FormField label="Order Channel">
                      <Select value={form.applicableTo} onChange={set("applicableTo")} disabled={saving}>
                        <option value="ALL">All Orders</option>
                        <option value="ECOMMERCE">Main Store Only</option>
                        <option value="URBEXON_HOUR">Urbexon Hour Only</option>
                      </Select>
                    </FormField>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <FormField label="Categories (blank = all)">
                        <MultiSelectSearch
                          value={form.applicableCategories} onChange={setArr("applicableCategories")}
                          staticItems={categories}
                          getId={(c) => c.slug || c.name} getLabel={(c) => c.name}
                          placeholder="Search or browse categories…"
                        />
                      </FormField>
                      <Field label="Brands" value={form.applicableBrands} onChange={set("applicableBrands")} placeholder="Comma-separated, blank = all" disabled={saving} />
                    </div>
                    {form.applicableCategories.length > 0 && (
                      <Field label="Min Spend Within These Categories (₹)" value={form.categoryMinSpend} onChange={set("categoryMinSpend")} type="number" placeholder="0" disabled={saving} hint="(refines Min Order Value — only counts the targeted categories' items, not the whole cart)" />
                    )}

                    <FormField label="Products (blank = all)">
                      <MultiSelectSearch
                        value={form.applicableProducts} onChange={setArr("applicableProducts")}
                        searchUrl="/products/admin/all" resultsKey="products"
                        getLabel={(p) => p.name} placeholder="Search products to target…"
                      />
                    </FormField>
                    <FormField label="Vendors (blank = all)">
                      <MultiSelectSearch
                        value={form.applicableVendors} onChange={setArr("applicableVendors")}
                        searchUrl="/admin/vendors" resultsKey="vendors"
                        getLabel={(v) => v.shopName} placeholder="Search vendors to target…"
                      />
                    </FormField>
                    <FormField label="Collections (blank = all)">
                      <MultiSelectSearch
                        value={form.applicableCollections} onChange={setArr("applicableCollections")}
                        searchUrl="/collections/admin/all" resultsKey="collections"
                        getLabel={(c) => c.name} placeholder="Search collections to target…"
                      />
                    </FormField>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="States" value={form.applicableStates} onChange={set("applicableStates")} placeholder="Comma-separated, blank = all" disabled={saving} />
                      <Field label="Pincodes" value={form.applicablePincodes} onChange={set("applicablePincodes")} placeholder="Comma-separated, blank = all" disabled={saving} />
                    </div>

                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--adm-text-secondary)", marginBottom: 10 }}>Exclusions (optional)</summary>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                          <Field label="Excluded Categories" value={form.excludedCategories} onChange={set("excludedCategories")} disabled={saving} />
                          <Field label="Excluded Brands" value={form.excludedBrands} onChange={set("excludedBrands")} disabled={saving} />
                        </div>
                        <FormField label="Excluded Products">
                          <MultiSelectSearch value={form.excludedProducts} onChange={setArr("excludedProducts")} searchUrl="/products/admin/all" resultsKey="products" getLabel={(p) => p.name} placeholder="Search products to exclude…" />
                        </FormField>
                        <FormField label="Excluded Vendors">
                          <MultiSelectSearch value={form.excludedVendors} onChange={setArr("excludedVendors")} searchUrl="/admin/vendors" resultsKey="vendors" getLabel={(v) => v.shopName} placeholder="Search vendors to exclude…" />
                        </FormField>
                        <Field label="Excluded User IDs" value={form.excludedUsers} onChange={set("excludedUsers")} placeholder="Comma-separated user IDs" disabled={saving} />
                      </div>
                    </details>
                  </>
                ) : (
                  <FormField label="Applicable Plans (blank = all plans)">
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {SUBSCRIPTION_PLANS.map((plan) => (
                        <label key={plan} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--adm-text-secondary)", cursor: "pointer", textTransform: "capitalize" }}>
                          <input type="checkbox" checked={form.applicableSubscriptionPlans.includes(plan)} onChange={() => togglePlan(plan)} /> {plan}
                        </label>
                      ))}
                    </div>
                  </FormField>
                )}
              </div>
            )}

            {tab === "Priority & Behavior" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Priority" value={form.priority} onChange={set("priority")} type="number" placeholder="0" disabled={saving} hint="(higher wins when multiple coupons are eligible)" />
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  {[["isStackable", "Stackable"], ["isExclusive", "Exclusive"], ["autoApply", "Auto-apply"]].map(([k, label]) => (
                    <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--adm-text-secondary)", cursor: "pointer" }}>
                      <input type="checkbox" checked={form[k]} onChange={setBool(k)} /> {label}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--adm-muted)", background: "var(--adm-bg)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: "10px 14px", lineHeight: 1.7 }}>
                  <strong>Exclusive</strong> coupons always win over non-exclusive ones regardless of priority. Among ties, higher <strong>Priority</strong> wins. <strong>Auto-apply</strong> means this coupon is silently applied at checkout if it's the best eligible one and the customer hasn't typed a code themselves — a manually-entered code always overrides auto-apply.<br /><br />
                  Phase 1 note: only <strong>one coupon applies per order</strong> even if multiple are marked Stackable — Stackable/Exclusive currently control which single coupon wins when several are eligible, not simultaneous multi-coupon discounts.
                </div>
              </div>
            )}

            {tab === "Usage" && form._id && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "var(--adm-bg)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--adm-text-primary)" }}>{form.redemptions}</div>
                  <div style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 4 }}>Redemptions</div>
                </div>
                <div style={{ background: "var(--adm-bg)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--adm-success)" }}>₹{form.totalDiscountGiven.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 4 }}>Total Discount Given</div>
                </div>
              </div>
            )}
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
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" icon={FiBarChart2} onClick={() => navigate("/admin/coupon-analytics")}>Analytics</Button>
          <Button variant="primary" icon={FiPlus} onClick={openNew}>New Coupon</Button>
        </div>
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
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {c.autoApply && <Badge tone="info">Auto</Badge>}
                  {c.isExclusive && <Badge tone="warning">Exclusive</Badge>}
                  {!!c.priority && <Badge tone="neutral">P{c.priority}</Badge>}
                </div>
              </td>
              <td style={{ fontWeight: 700 }}>
                <span style={{ color: "var(--adm-success)", fontSize: 15 }}>
                  {c.discountType === "PERCENT" ? `${c.discountValue}%` : c.discountType === "FREE_SHIPPING" ? "Free Ship" : `₹${c.discountValue}`}
                </span>
                {c.maxDiscount && <div style={{ fontSize: 11, color: "var(--adm-muted)" }}>Max ₹{c.maxDiscount}</div>}
              </td>
              <td style={{ fontSize: 13 }}>₹{c.minOrderValue || 0}</td>
              <td style={{ fontSize: 13 }}>
                {c.usedCount} {c.usageLimit ? `/ ${c.usageLimit}` : "/ ∞"}
                <div style={{ fontSize: 10.5, color: "var(--adm-muted)", marginTop: 2 }}>
                  {c.redemptions || 0} redemptions · ₹{(c.totalDiscountGiven || 0).toLocaleString("en-IN")} given
                </div>
              </td>
              <td>
                <Badge tone={c.couponModule === "VENDOR_SUBSCRIPTION" ? "warning" : c.applicableTo === "ALL" ? "primary" : c.applicableTo === "URBEXON_HOUR" ? "warning" : "success"}>
                  {c.couponModule === "VENDOR_SUBSCRIPTION" ? "Vendor Sub" : c.applicableTo === "ALL" ? "All" : c.applicableTo === "URBEXON_HOUR" ? "UH Only" : "Main Only"}
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
                  <Button variant="secondary" size="sm" icon={FiCopy} disabled={isActing} onClick={() => duplicate(c)} title="Duplicate coupon" />
                  <Button variant="secondary" size="sm" icon={FiSend} disabled={isActing} onClick={() => announce(c)} title="Announce via Broadcast" />
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
