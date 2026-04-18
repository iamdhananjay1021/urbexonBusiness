/**
 * deliveryConfigController.js — Admin CRUD for delivery settings
 * GET  /api/admin/delivery-config  → read config
 * PUT  /api/admin/delivery-config  → update config
 * GET  /api/delivery-config/public → public-facing config (subset)
 */
import DeliveryConfigModel from "../../models/DeliveryConfig.js";
import { refreshDeliveryConfig } from "../../config/deliveryConfig.js";

const CONFIG_ID = "delivery_config";

/* ── Seed default config if missing ── */
const ensureConfig = async () => {
    let doc = await DeliveryConfigModel.findById(CONFIG_ID).lean();
    if (!doc) {
        doc = await DeliveryConfigModel.create({ _id: CONFIG_ID });
    }
    return doc;
};

/* ── GET /api/admin/delivery-config ── */
export const getDeliveryConfig = async (_req, res) => {
    try {
        const config = await ensureConfig();
        res.json({ success: true, config });
    } catch (err) {
        console.error("[DeliveryConfig] GET error:", err.message);
        res.status(500).json({ success: false, message: "Failed to load delivery config" });
    }
};

/* ── PUT /api/admin/delivery-config ── */
export const updateDeliveryConfig = async (req, res) => {
    try {
        const allowedFields = [
            "freeDeliveryThreshold", "onlineDeliveryCharge", "codCharge", "platformFee",
            "uhEnabled", "uhMaxRadiusKm", "uhVendorSelfRadiusKm", "uhBaseCharge",
            "uhChargePerKm", "uhMaxCharge", "uhEtaText",
            "etaEcommerceStandard", "etaOnlineLocal", "etaOnlineNational", "etaUrbexonHour",
            "shopLat", "shopLng", "shopPincode",
            "codAvailablePanIndia", "returnDays",
            "shiprocketPickupLocation",
        ];

        const updates = {};
        for (const key of allowedFields) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields to update" });
        }

        const config = await DeliveryConfigModel.findByIdAndUpdate(
            CONFIG_ID,
            { $set: updates },
            { new: true, upsert: true, runValidators: true }
        ).lean();

        // Refresh in-memory config
        await refreshDeliveryConfig();

        res.json({ success: true, message: "Delivery config updated", config });
    } catch (err) {
        console.error("[DeliveryConfig] PUT error:", err.message);
        res.status(500).json({ success: false, message: "Failed to update delivery config" });
    }
};

/* ── GET /api/delivery-config/public — no auth needed ── */
export const getPublicDeliveryConfig = async (_req, res) => {
    try {
        const config = await ensureConfig();
        res.json({
            success: true,
            freeDeliveryThreshold: config.freeDeliveryThreshold,
            onlineDeliveryCharge: config.onlineDeliveryCharge,
            codCharge: config.codCharge,
            platformFee: config.platformFee,
            uhEnabled: config.uhEnabled,
            uhEtaText: config.uhEtaText,
            etaEcommerceStandard: config.etaEcommerceStandard,
            etaOnlineLocal: config.etaOnlineLocal,
            etaOnlineNational: config.etaOnlineNational,
            etaUrbexonHour: config.etaUrbexonHour,
            codAvailablePanIndia: config.codAvailablePanIndia,
            returnDays: config.returnDays,
        });
    } catch (err) {
        console.error("[DeliveryConfig] Public GET error:", err.message);
        res.status(500).json({ success: false, message: "Failed to load delivery info" });
    }
};
