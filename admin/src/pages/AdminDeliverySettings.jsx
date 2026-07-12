/**
 * AdminDeliverySettings.jsx — Admin panel page for delivery configuration
 * Manages: charges, thresholds, ETA text, UH settings, COD, return policy
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/adminApi";
import {
    FaTruck, FaSave, FaUndo, FaMapMarkerAlt,
    FaRupeeSign, FaBolt, FaClock, FaShieldAlt, FaToggleOn, FaToggleOff, FaTachometerAlt,
} from "react-icons/fa";
import { Button, Card, ErrorState, Skeleton, FormField, Input } from "../components/ui";

const GRID = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 };

const Field = ({ label, value, onChange, type = "text", suffix, disabled }) => (
    <FormField label={label}>
        <div style={{ position: "relative" }}>
            <Input
                type={type}
                value={value}
                onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
                disabled={disabled}
                style={{ opacity: disabled ? 0.5 : 1, paddingRight: suffix ? 36 : undefined, width: "100%", boxSizing: "border-box" }}
            />
            {suffix && (
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--adm-muted)" }}>
                    {suffix}
                </span>
            )}
        </div>
    </FormField>
);

const SectionCard = ({ icon: Icon, iconColor, title, subtitle, action, children }) => (
    <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={14} color={iconColor} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>{title}</h2>
            </div>
            {action}
        </div>
        {subtitle && <p style={{ fontSize: 12, color: "var(--adm-text-secondary)", marginBottom: 14, marginTop: -10 }}>{subtitle}</p>}
        {children}
    </Card>
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
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <Skeleton height={32} width={220} style={{ marginBottom: 20 }} />
            {[1, 2, 3].map(i => (
                <Card key={i} style={{ marginBottom: 20 }}>
                    <Skeleton height={18} width={200} style={{ marginBottom: 18 }} />
                    <div style={GRID}>
                        {[1, 2, 3, 4].map(j => <Skeleton key={j} height={40} />)}
                    </div>
                </Card>
            ))}
        </div>
    );

    if (!config) return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
            <ErrorState message="Failed to load delivery settings" onRetry={fetchConfig} />
        </div>
    );

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 9999,
                    padding: "12px 20px", borderRadius: "var(--adm-radius-md)", fontSize: 14, fontWeight: 600,
                    color: "var(--adm-text-on-accent)", boxShadow: "var(--adm-shadow-md)",
                    background: toast.type === "success" ? "var(--adm-success)" : "var(--adm-danger)",
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "var(--adm-radius-md)", background: "linear-gradient(135deg, var(--adm-primary), var(--adm-primary-hover))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FaTruck size={18} color="var(--adm-text-on-accent)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0 }}>Delivery Settings</h1>
                        <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", margin: 0 }}>Manage delivery charges, ETAs, and policies</p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <Button variant="secondary" icon={FaUndo} disabled={!hasChanges} onClick={handleReset}>Reset</Button>
                    <Button variant="primary" icon={FaSave} loading={saving} disabled={!hasChanges} onClick={handleSave}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            {/* ── Section: Ecommerce Charges ── */}
            <SectionCard icon={FaRupeeSign} iconColor="var(--adm-primary)" title="Ecommerce Delivery Charges">
                <div style={GRID}>
                    <Field label="Free Delivery Threshold" type="number" value={config.freeDeliveryThreshold} onChange={v => set("freeDeliveryThreshold", v)} suffix="₹" />
                    <Field label="Online Delivery Charge" type="number" value={config.onlineDeliveryCharge} onChange={v => set("onlineDeliveryCharge", v)} suffix="₹" />
                    <Field label="COD Charge" type="number" value={config.codCharge} onChange={v => set("codCharge", v)} suffix="₹" />
                    <Field label="Platform Fee" type="number" value={config.platformFee} onChange={v => set("platformFee", v)} suffix="₹" />
                </div>
            </SectionCard>

            {/* ── Section: Urbexon Hour ── */}
            <SectionCard
                icon={FaBolt} iconColor="var(--adm-info)" title="Urbexon Hour (Express)"
                action={(
                    <Button
                        variant="ghost" size="sm" icon={config.uhEnabled ? FaToggleOn : FaToggleOff}
                        onClick={() => set("uhEnabled", !config.uhEnabled)}
                        style={{ color: config.uhEnabled ? "var(--adm-success)" : "var(--adm-danger)" }}
                    >
                        {config.uhEnabled ? "Enabled" : "Disabled"}
                    </Button>
                )}
            >
                <div style={GRID}>
                    <Field label="Max Radius" type="number" value={config.uhMaxRadiusKm} onChange={v => set("uhMaxRadiusKm", v)} suffix="km" disabled={!config.uhEnabled} />
                    <Field label="Vendor Self-Delivery Radius" type="number" value={config.uhVendorSelfRadiusKm} onChange={v => set("uhVendorSelfRadiusKm", v)} suffix="km" disabled={!config.uhEnabled} />
                    <Field label="Base Charge" type="number" value={config.uhBaseCharge} onChange={v => set("uhBaseCharge", v)} suffix="₹" disabled={!config.uhEnabled} />
                    <Field label="Charge Per KM" type="number" value={config.uhChargePerKm} onChange={v => set("uhChargePerKm", v)} suffix="₹/km" disabled={!config.uhEnabled} />
                    <Field label="Max Charge Cap" type="number" value={config.uhMaxCharge} onChange={v => set("uhMaxCharge", v)} suffix="₹" disabled={!config.uhEnabled} />
                    <Field label="UH ETA Display Text" value={config.uhEtaText} onChange={v => set("uhEtaText", v)} disabled={!config.uhEnabled} />
                </div>
            </SectionCard>

            {/* ── Section: Geo Engine (dynamic ETA + vendor radius bounds) ── */}
            <SectionCard
                icon={FaTachometerAlt} iconColor="var(--adm-info)" title="Geo Engine — ETA & Vendor Radius"
                subtitle="Drives the dynamic ETA shown at checkout (prep time + distance ÷ rider speed) and the min/max radius a vendor is allowed to set for themselves. Vendor radius bounds can never exceed the platform's absolute 10km safety ceiling, no matter what is entered here."
            >
                <div style={GRID}>
                    <Field label="Avg Rider Speed" type="number" value={config.avgRiderSpeedKmph ?? 20} onChange={v => set("avgRiderSpeedKmph", v)} suffix="km/h" />
                    <Field label="Default Prep Time" type="number" value={config.defaultPrepTimeMin ?? 15} onChange={v => set("defaultPrepTimeMin", v)} suffix="min" />
                    <Field label="Min Vendor Radius" type="number" value={config.minVendorRadiusKm ?? 1} onChange={v => set("minVendorRadiusKm", v)} suffix="km" />
                    <Field label="Max Vendor Radius" type="number" value={config.maxVendorRadiusKm ?? 10} onChange={v => set("maxVendorRadiusKm", v)} suffix="km" />
                    <Field label="Default Vendor Radius" type="number" value={config.defaultVendorRadiusKm ?? 5} onChange={v => set("defaultVendorRadiusKm", v)} suffix="km" />
                </div>
            </SectionCard>

            {/* ── Section: ETA Text ── */}
            <SectionCard
                icon={FaClock} iconColor="var(--adm-warning)" title="Delivery ETA Display"
                subtitle="These are displayed on product pages and order confirmations"
            >
                <div style={GRID}>
                    <Field label="Ecommerce Standard" value={config.etaEcommerceStandard} onChange={v => set("etaEcommerceStandard", v)} />
                    <Field label="Online Local" value={config.etaOnlineLocal} onChange={v => set("etaOnlineLocal", v)} />
                    <Field label="Online National" value={config.etaOnlineNational} onChange={v => set("etaOnlineNational", v)} />
                    <Field label="Urbexon Hour" value={config.etaUrbexonHour} onChange={v => set("etaUrbexonHour", v)} />
                </div>
            </SectionCard>

            {/* ── Section: Shop Location ── */}
            <SectionCard icon={FaMapMarkerAlt} iconColor="var(--adm-danger)" title="Shop / Pickup Location">
                <div style={GRID}>
                    <Field label="Latitude" type="number" value={config.shopLat} onChange={v => set("shopLat", v)} />
                    <Field label="Longitude" type="number" value={config.shopLng} onChange={v => set("shopLng", v)} />
                    <Field label="Shop Pincode" value={config.shopPincode} onChange={v => set("shopPincode", v)} />
                    <Field label="Shiprocket Pickup Location" value={config.shiprocketPickupLocation} onChange={v => set("shiprocketPickupLocation", v)} />
                </div>
            </SectionCard>

            {/* ── Section: Policies ── */}
            <SectionCard icon={FaShieldAlt} iconColor="var(--adm-success)" title="Policies">
                <div style={GRID}>
                    <FormField label="COD Available PAN India">
                        <Button
                            variant="secondary" icon={config.codAvailablePanIndia ? FaToggleOn : FaToggleOff}
                            onClick={() => set("codAvailablePanIndia", !config.codAvailablePanIndia)}
                            style={{ width: "100%", color: config.codAvailablePanIndia ? "var(--adm-success)" : "var(--adm-danger)" }}
                        >
                            {config.codAvailablePanIndia ? "Yes" : "No"}
                        </Button>
                    </FormField>
                    <Field label="Return Policy Days" type="number" value={config.returnDays} onChange={v => set("returnDays", v)} suffix="days" />
                </div>
            </SectionCard>

            {/* Sticky save bar on mobile */}
            {hasChanges && (
                <div style={{
                    position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px",
                    background: "var(--adm-surface)", borderTop: "1px solid var(--adm-border)", display: "flex",
                    justifyContent: "flex-end", gap: 10, zIndex: 100,
                }}>
                    <Button variant="secondary" onClick={handleReset}>Reset</Button>
                    <Button variant="primary" loading={saving} onClick={handleSave}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            )}
        </div>
    );
}
