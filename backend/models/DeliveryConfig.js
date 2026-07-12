/**
 * DeliveryConfig.js — MongoDB model for admin-manageable delivery settings
 * Singleton pattern: only one document exists (upsert on save)
 */
import mongoose from "mongoose";

const deliveryConfigSchema = new mongoose.Schema(
    {
        _id: { type: String, default: "delivery_config" },

        // ── Ecommerce Delivery ──
        freeDeliveryThreshold: { type: Number, default: 499 },
        onlineDeliveryCharge: { type: Number, default: 40 },
        codCharge: { type: Number, default: 70 },
        platformFee: { type: Number, default: 11 },

        // ── Urbexon Hour ──
        uhEnabled: { type: Boolean, default: true },
        uhMaxRadiusKm: { type: Number, default: 15 },
        uhVendorSelfRadiusKm: { type: Number, default: 2 },
        uhBaseCharge: { type: Number, default: 25 },
        uhChargePerKm: { type: Number, default: 8 },
        uhMaxCharge: { type: Number, default: 150 },
        uhEtaText: { type: String, default: "45–120 mins" },

        // ── Geo Engine: ETA + vendor radius bounds (admin-tunable) ──
        // avgRiderSpeedKmph feeds the dynamic ETA formula (prep time +
        // distance/speed) — a realistic average moped speed in dense
        // urban quick-commerce delivery, not highway speed.
        avgRiderSpeedKmph: { type: Number, default: 20, min: 5, max: 60 },
        // Fallback prep time when a vendor hasn't set their own preparationTime.
        defaultPrepTimeMin: { type: Number, default: 15, min: 0, max: 120 },
        // Vendor-facing radius bounds. These can only ever be a TIGHTER
        // window than the absolute hard safety ceiling (HARD_MAX_RADIUS_KM
        // in orderValidations.js) — admin can shrink the platform-wide
        // vendor radius range, never raise it past that hard limit.
        minVendorRadiusKm: { type: Number, default: 1, min: 1, max: 10 },
        maxVendorRadiusKm: { type: Number, default: 10, min: 1, max: 10 },
        defaultVendorRadiusKm: { type: Number, default: 5, min: 1, max: 10 },

        // ── ETA Text ──
        etaEcommerceStandard: { type: String, default: "3–5 Business Days" },
        etaOnlineLocal: { type: String, default: "2–3 Business Days" },
        etaOnlineNational: { type: String, default: "4–7 Business Days" },
        etaUrbexonHour: { type: String, default: "45–120 mins" },

        // ── Shop Location ──
        shopLat: { type: Number, default: 26.41922 },
        shopLng: { type: Number, default: 82.53598 },
        shopPincode: { type: String, default: "224122" },

        // ── Policies ──
        codAvailablePanIndia: { type: Boolean, default: true },
        codEnabledGlobally: { type: Boolean, default: true },
        returnDays: { type: Number, default: 7 },

        // ── Shiprocket ──
        shiprocketPickupLocation: { type: String, default: "Primary" },
    },
    { timestamps: true }
);

const DeliveryConfigModel = mongoose.model("DeliveryConfig", deliveryConfigSchema);

export default DeliveryConfigModel;
