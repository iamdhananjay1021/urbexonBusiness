/**
 * AdminDeliverySettings.jsx — Admin panel page for delivery configuration
 * Manages: charges, thresholds, ETA text, UH settings, COD, return policy
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/adminApi";
import {
    FaTruck, FaSave, FaUndo, FaCog, FaMapMarkerAlt,
    FaRupeeSign, FaBolt, FaClock, FaShieldAlt, FaToggleOn, FaToggleOff,
} from "react-icons/fa";

const SECTION_STYLE = {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: "24px",
    marginBottom: 20,
};

const LABEL_STYLE = {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    display: "block",
};

const INPUT_STYLE = {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    color: "#1f2937",
    transition: "border-color .15s",
    outline: "none",
};

const GRID = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 };

const Field = ({ label, value, onChange, type = "text", suffix, disabled }) => (
    <div>
        <label style={LABEL_STYLE}>{label}</label>
        <div style={{ position: "relative" }}>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
                style={{ ...INPUT_STYLE, opacity: disabled ? 0.5 : 1 }}
                disabled={disabled}
            />
            {suffix && (
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>
                    {suffix}
                </span>
            )}
        </div>
    </div>
);

export default function AdminDeliverySettings() {
    const [config, setConfig] = useState(null);
    const [original, setOriginal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get("/admin/delivery-config");
            if (data.success) {
                setConfig(data.config);
                setOriginal(data.config);
            }
        } catch (err) {
            setToast({ type: "error", msg: err?.response?.data?.message || "Failed to load config" });
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        try {
            setSaving(true);
            const { data } = await api.put("/admin/delivery-config", config);
            if (data.success) {
                setOriginal(data.config);
                setConfig(data.config);
                setToast({ type: "success", msg: "Delivery settings saved!" });
            }
        } catch (err) {
            setToast({ type: "error", msg: err?.response?.data?.message || "Failed to save" });
        } finally { setSaving(false); }
    };

    const handleReset = () => { setConfig({ ...original }); };
    const set = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    const hasChanges = JSON.stringify(config) !== JSON.stringify(original);

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
        </div>
    );

    if (!config) return (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
            Failed to load delivery settings
        </div>
    );

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 9999,
                    padding: "12px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                    color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    background: toast.type === "success" ? "#10b981" : "#ef4444",
                    animation: "adm-fadeIn .2s",
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FaTruck size={18} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Delivery Settings</h1>
                        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Manage delivery charges, ETAs, and policies</p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={handleReset} disabled={!hasChanges}
                        style={{ padding: "10px 18px", border: "1.5px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: hasChanges ? "pointer" : "default", opacity: hasChanges ? 1 : 0.4, display: "flex", alignItems: "center", gap: 6 }}>
                        <FaUndo size={12} /> Reset
                    </button>
                    <button onClick={handleSave} disabled={saving || !hasChanges}
                        style={{ padding: "10px 22px", border: "none", borderRadius: 8, background: hasChanges ? "#6366f1" : "#d1d5db", fontSize: 13, fontWeight: 700, color: "#fff", cursor: hasChanges ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6 }}>
                        <FaSave size={12} /> {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>

            {/* ── Section: Ecommerce Charges ── */}
            <div style={SECTION_STYLE}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                    <FaRupeeSign size={14} color="#6366f1" />
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Ecommerce Delivery Charges</h2>
                </div>
                <div style={GRID}>
                    <Field label="Free Delivery Threshold" type="number" value={config.freeDeliveryThreshold} onChange={v => set("freeDeliveryThreshold", v)} suffix="₹" />
                    <Field label="Online Delivery Charge" type="number" value={config.onlineDeliveryCharge} onChange={v => set("onlineDeliveryCharge", v)} suffix="₹" />
                    <Field label="COD Charge" type="number" value={config.codCharge} onChange={v => set("codCharge", v)} suffix="₹" />
                    <Field label="Platform Fee" type="number" value={config.platformFee} onChange={v => set("platformFee", v)} suffix="₹" />
                </div>
            </div>

            {/* ── Section: Urbexon Hour ── */}
            <div style={SECTION_STYLE}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FaBolt size={14} color="#7c3aed" />
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Urbexon Hour (Express)</h2>
                    </div>
                    <button onClick={() => set("uhEnabled", !config.uhEnabled)}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: config.uhEnabled ? "#10b981" : "#ef4444" }}>
                        {config.uhEnabled ? <FaToggleOn size={22} /> : <FaToggleOff size={22} />}
                        {config.uhEnabled ? "Enabled" : "Disabled"}
                    </button>
                </div>
                <div style={GRID}>
                    <Field label="Max Radius" type="number" value={config.uhMaxRadiusKm} onChange={v => set("uhMaxRadiusKm", v)} suffix="km" disabled={!config.uhEnabled} />
                    <Field label="Vendor Self-Delivery Radius" type="number" value={config.uhVendorSelfRadiusKm} onChange={v => set("uhVendorSelfRadiusKm", v)} suffix="km" disabled={!config.uhEnabled} />
                    <Field label="Base Charge" type="number" value={config.uhBaseCharge} onChange={v => set("uhBaseCharge", v)} suffix="₹" disabled={!config.uhEnabled} />
                    <Field label="Charge Per KM" type="number" value={config.uhChargePerKm} onChange={v => set("uhChargePerKm", v)} suffix="₹/km" disabled={!config.uhEnabled} />
                    <Field label="Max Charge Cap" type="number" value={config.uhMaxCharge} onChange={v => set("uhMaxCharge", v)} suffix="₹" disabled={!config.uhEnabled} />
                    <Field label="UH ETA Display Text" value={config.uhEtaText} onChange={v => set("uhEtaText", v)} disabled={!config.uhEnabled} />
                </div>
            </div>

            {/* ── Section: ETA Text ── */}
            <div style={SECTION_STYLE}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                    <FaClock size={14} color="#f59e0b" />
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Delivery ETA Display</h2>
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
                    These are displayed on product pages and order confirmations
                </p>
                <div style={GRID}>
                    <Field label="Ecommerce Standard" value={config.etaEcommerceStandard} onChange={v => set("etaEcommerceStandard", v)} />
                    <Field label="Online Local" value={config.etaOnlineLocal} onChange={v => set("etaOnlineLocal", v)} />
                    <Field label="Online National" value={config.etaOnlineNational} onChange={v => set("etaOnlineNational", v)} />
                    <Field label="Urbexon Hour" value={config.etaUrbexonHour} onChange={v => set("etaUrbexonHour", v)} />
                </div>
            </div>

            {/* ── Section: Shop Location ── */}
            <div style={SECTION_STYLE}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                    <FaMapMarkerAlt size={14} color="#ef4444" />
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Shop / Pickup Location</h2>
                </div>
                <div style={GRID}>
                    <Field label="Latitude" type="number" value={config.shopLat} onChange={v => set("shopLat", v)} />
                    <Field label="Longitude" type="number" value={config.shopLng} onChange={v => set("shopLng", v)} />
                    <Field label="Shop Pincode" value={config.shopPincode} onChange={v => set("shopPincode", v)} />
                    <Field label="Shiprocket Pickup Location" value={config.shiprocketPickupLocation} onChange={v => set("shiprocketPickupLocation", v)} />
                </div>
            </div>

            {/* ── Section: Policies ── */}
            <div style={SECTION_STYLE}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                    <FaShieldAlt size={14} color="#10b981" />
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Policies</h2>
                </div>
                <div style={GRID}>
                    <div>
                        <label style={LABEL_STYLE}>COD Available PAN India</label>
                        <button onClick={() => set("codAvailablePanIndia", !config.codAvailablePanIndia)}
                            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: config.codAvailablePanIndia ? "#10b981" : "#ef4444", width: "100%" }}>
                            {config.codAvailablePanIndia ? <FaToggleOn size={20} /> : <FaToggleOff size={20} />}
                            {config.codAvailablePanIndia ? "Yes" : "No"}
                        </button>
                    </div>
                    <Field label="Return Policy Days" type="number" value={config.returnDays} onChange={v => set("returnDays", v)} suffix="days" />
                </div>
            </div>

            {/* Sticky save bar on mobile */}
            {hasChanges && (
                <div style={{
                    position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px",
                    background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex",
                    justifyContent: "flex-end", gap: 10, zIndex: 100,
                }}>
                    <button onClick={handleReset}
                        style={{ padding: "10px 18px", border: "1.5px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
                        Reset
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        style={{ padding: "10px 22px", border: "none", borderRadius: 8, background: "#6366f1", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            )}
        </div>
    );
}
