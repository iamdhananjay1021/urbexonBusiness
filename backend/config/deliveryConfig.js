/**
 * deliveryConfig.js — PRODUCTION
 * COD: Available PAN-INDIA (restriction removed)
 * Urbexon Hour: Local express delivery up to 10km (hard business rule —
 *   see HARD_MAX_RADIUS_KM in validations/orderValidations.js)
 * ✅ Loads from DB (DeliveryConfig model) with hardcoded fallbacks
 */
import { calculateETA, formatEtaText } from "../services/geoEngine.js";

/* ── Hardcoded defaults (fallback if DB not loaded yet) ── */
const DEFAULTS = {
    FREE_DELIVERY_THRESHOLD: 499,
    ONLINE_DELIVERY_CHARGE: 40,
    COD_CHARGE: 70,
    PLATFORM_FEE: 11,

    URBEXON_HOUR: {
        ENABLED: true,
        MAX_RADIUS_KM: 10,
        VENDOR_SELF_RADIUS_KM: 2,
        BASE_CHARGE: 25,
        CHARGE_PER_KM: 8,
        MAX_CHARGE: 150,
        ETA: "45–120 mins",
        AVG_RIDER_SPEED_KMPH: 20,
        DEFAULT_PREP_TIME_MIN: 15,
        MIN_VENDOR_RADIUS_KM: 1,
        MAX_VENDOR_RADIUS_KM: 10,
        DEFAULT_VENDOR_RADIUS_KM: 5,
    },

    SHOP_LAT: 26.41922,
    SHOP_LNG: 82.53598,
    SHOP_PINCODE: process.env.SHOP_PINCODE || "224122",

    COD_MANAGED_BY_PINCODE: true,

    DELIVERY_ETA: {
        ECOMMERCE_STANDARD: "3–5 Business Days",
        ONLINE_LOCAL: "2–3 Business Days",
        ONLINE_NATIONAL: "4–7 Business Days",
        URBEXON_HOUR: "45–120 mins",
    },

    SHIPROCKET_PICKUP_LOCATION: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",

    // ── Product Return Policy Limits (marketplace-wide guardrails) ──
    PRODUCT_POLICY: {
        MIN_RETURN_WINDOW_DAYS: 0,
        MAX_RETURN_WINDOW_DAYS: 30,
        MIN_REPLACEMENT_WINDOW_DAYS: 0,
        MAX_REPLACEMENT_WINDOW_DAYS: 30,
        MIN_CANCEL_WINDOW_HOURS: 0,
        MAX_CANCEL_WINDOW_HOURS: 72,
        ALLOWED_RETURN_CONDITIONS: ["damaged", "wrong_product", "defective", "missing_items", "other"],
    },
};

// Mutable config — starts with defaults, updated from DB
export const DELIVERY_CONFIG = { ...DEFAULTS, URBEXON_HOUR: { ...DEFAULTS.URBEXON_HOUR }, DELIVERY_ETA: { ...DEFAULTS.DELIVERY_ETA }, PRODUCT_POLICY: { ...DEFAULTS.PRODUCT_POLICY } };

export const DELIVERY_TYPES = {
    ECOMMERCE_STANDARD: "ECOMMERCE_STANDARD",
    URBEXON_HOUR: "URBEXON_HOUR",
};

export const calcDeliveryCharge = (itemsTotal, paymentMethod, options = {}) => {
    const { deliveryType = DELIVERY_TYPES.ECOMMERCE_STANDARD, distanceKm = 0, vendor = null } = options;

    if (deliveryType === DELIVERY_TYPES.URBEXON_HOUR) {
        if (!DELIVERY_CONFIG.URBEXON_HOUR.ENABLED) throw new Error("Urbexon Hour is currently unavailable");
        if (distanceKm > DELIVERY_CONFIG.URBEXON_HOUR.MAX_RADIUS_KM)
            throw new Error(`Urbexon Hour supports up to ${DELIVERY_CONFIG.URBEXON_HOUR.MAX_RADIUS_KM} km only`);

        // Vendor-level override wins over the platform default ONLY when the
        // vendor has actually configured one (>0) — vendors who haven't
        // touched these fields get the exact platform-wide formula unchanged.
        const chargePerKm = vendor?.deliveryChargePerKm > 0 ? vendor.deliveryChargePerKm : DELIVERY_CONFIG.URBEXON_HOUR.CHARGE_PER_KM;
        if (vendor?.freeDeliveryAbove > 0 && itemsTotal >= vendor.freeDeliveryAbove) return 0;

        const computed = DELIVERY_CONFIG.URBEXON_HOUR.BASE_CHARGE + (distanceKm * chargePerKm);
        return Math.min(Math.round(computed), DELIVERY_CONFIG.URBEXON_HOUR.MAX_CHARGE);
    }

    // COD available everywhere
    if (paymentMethod === "COD") return DELIVERY_CONFIG.COD_CHARGE;
    if (itemsTotal >= DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD) return 0;
    return DELIVERY_CONFIG.ONLINE_DELIVERY_CHARGE;
};

export const calcItemsTotal = (items) =>
    items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);

export const calcFinalAmount = (itemsTotal, deliveryCharge) =>
    itemsTotal + deliveryCharge + DELIVERY_CONFIG.PLATFORM_FEE;

// @deprecated — COD eligibility now managed by Pincode DB model (see addressController)
export const isCODServiceable = (_pincode) => true;

// Dynamic ETA — prep time + distance/speed via the shared Geo Engine.
// Only kicks in when distanceKm is genuinely known (a real Number, not
// null/undefined); ecommerce and "distance unknown" UH orders keep
// returning the exact static text they always did — zero regression for
// every existing caller that doesn't pass the new optional params.
export const getDeliveryETA = ({
    deliveryType = DELIVERY_TYPES.ECOMMERCE_STANDARD,
    distanceKm,
    preparationTimeMin,
    vendorDeliveryMode,
} = {}) => {
    if (deliveryType === DELIVERY_TYPES.URBEXON_HOUR) {
        const eta = calculateETA({
            distanceKm,
            preparationTimeMin: preparationTimeMin ?? DELIVERY_CONFIG.URBEXON_HOUR.DEFAULT_PREP_TIME_MIN,
            avgSpeedKmph: DELIVERY_CONFIG.URBEXON_HOUR.AVG_RIDER_SPEED_KMPH,
            deliveryMode: vendorDeliveryMode === "self" ? "self" : "platform",
        });
        return formatEtaText(eta) || DELIVERY_CONFIG.DELIVERY_ETA.URBEXON_HOUR;
    }
    return DELIVERY_CONFIG.DELIVERY_ETA.ECOMMERCE_STANDARD;
};

// BUG FIX: `Vendor.deliveryMode` ("self" | "platform" | "both") has existed
// on the model and been vendor-editable via the vendor panel for a while,
// but nothing here ever consulted it — the provider was always decided
// purely by distance, so a vendor's own delivery-mode choice had zero
// actual effect on their orders. Now: an explicit "self" or "platform"
// choice always wins over the distance heuristic; "both" (the schema
// default, and what any order without a resolvable vendor also falls back
// to) keeps the original distance-based behavior unchanged. This is
// re-evaluated fresh on every order, so a vendor switching modes takes
// effect immediately on their very next order — nothing to cache/invalidate.
export const getDeliveryProvider = ({ deliveryType, distanceKm = 0, vendorDeliveryMode }) => {
    if (deliveryType !== DELIVERY_TYPES.URBEXON_HOUR) return "SHIPROCKET";
    if (vendorDeliveryMode === "self") return "VENDOR_SELF";
    if (vendorDeliveryMode === "platform") return "LOCAL_RIDER";
    return distanceKm <= DELIVERY_CONFIG.URBEXON_HOUR.VENDOR_SELF_RADIUS_KM ? "VENDOR_SELF" : "LOCAL_RIDER";
};

/* ── Load config from DB → update in-memory DELIVERY_CONFIG ── */
export const refreshDeliveryConfig = async () => {
    try {
        const { default: DeliveryConfigModel } = await import("../models/DeliveryConfig.js");
        const doc = await DeliveryConfigModel.findById("delivery_config").lean();
        if (!doc) return;

        DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD = doc.freeDeliveryThreshold ?? DEFAULTS.FREE_DELIVERY_THRESHOLD;
        DELIVERY_CONFIG.ONLINE_DELIVERY_CHARGE = doc.onlineDeliveryCharge ?? DEFAULTS.ONLINE_DELIVERY_CHARGE;
        DELIVERY_CONFIG.COD_CHARGE = doc.codCharge ?? DEFAULTS.COD_CHARGE;
        DELIVERY_CONFIG.PLATFORM_FEE = doc.platformFee ?? DEFAULTS.PLATFORM_FEE;

        DELIVERY_CONFIG.URBEXON_HOUR.ENABLED = doc.uhEnabled ?? DEFAULTS.URBEXON_HOUR.ENABLED;
        DELIVERY_CONFIG.URBEXON_HOUR.MAX_RADIUS_KM = doc.uhMaxRadiusKm ?? DEFAULTS.URBEXON_HOUR.MAX_RADIUS_KM;
        DELIVERY_CONFIG.URBEXON_HOUR.VENDOR_SELF_RADIUS_KM = doc.uhVendorSelfRadiusKm ?? DEFAULTS.URBEXON_HOUR.VENDOR_SELF_RADIUS_KM;
        DELIVERY_CONFIG.URBEXON_HOUR.BASE_CHARGE = doc.uhBaseCharge ?? DEFAULTS.URBEXON_HOUR.BASE_CHARGE;
        DELIVERY_CONFIG.URBEXON_HOUR.CHARGE_PER_KM = doc.uhChargePerKm ?? DEFAULTS.URBEXON_HOUR.CHARGE_PER_KM;
        DELIVERY_CONFIG.URBEXON_HOUR.MAX_CHARGE = doc.uhMaxCharge ?? DEFAULTS.URBEXON_HOUR.MAX_CHARGE;
        DELIVERY_CONFIG.URBEXON_HOUR.ETA = doc.uhEtaText ?? DEFAULTS.URBEXON_HOUR.ETA;
        DELIVERY_CONFIG.URBEXON_HOUR.AVG_RIDER_SPEED_KMPH = doc.avgRiderSpeedKmph ?? DEFAULTS.URBEXON_HOUR.AVG_RIDER_SPEED_KMPH;
        DELIVERY_CONFIG.URBEXON_HOUR.DEFAULT_PREP_TIME_MIN = doc.defaultPrepTimeMin ?? DEFAULTS.URBEXON_HOUR.DEFAULT_PREP_TIME_MIN;
        DELIVERY_CONFIG.URBEXON_HOUR.MIN_VENDOR_RADIUS_KM = doc.minVendorRadiusKm ?? DEFAULTS.URBEXON_HOUR.MIN_VENDOR_RADIUS_KM;
        DELIVERY_CONFIG.URBEXON_HOUR.MAX_VENDOR_RADIUS_KM = doc.maxVendorRadiusKm ?? DEFAULTS.URBEXON_HOUR.MAX_VENDOR_RADIUS_KM;
        DELIVERY_CONFIG.URBEXON_HOUR.DEFAULT_VENDOR_RADIUS_KM = doc.defaultVendorRadiusKm ?? DEFAULTS.URBEXON_HOUR.DEFAULT_VENDOR_RADIUS_KM;

        DELIVERY_CONFIG.SHOP_LAT = doc.shopLat ?? DEFAULTS.SHOP_LAT;
        DELIVERY_CONFIG.SHOP_LNG = doc.shopLng ?? DEFAULTS.SHOP_LNG;
        DELIVERY_CONFIG.SHOP_PINCODE = doc.shopPincode ?? DEFAULTS.SHOP_PINCODE;

        DELIVERY_CONFIG.DELIVERY_ETA.ECOMMERCE_STANDARD = doc.etaEcommerceStandard ?? DEFAULTS.DELIVERY_ETA.ECOMMERCE_STANDARD;
        DELIVERY_CONFIG.DELIVERY_ETA.ONLINE_LOCAL = doc.etaOnlineLocal ?? DEFAULTS.DELIVERY_ETA.ONLINE_LOCAL;
        DELIVERY_CONFIG.DELIVERY_ETA.ONLINE_NATIONAL = doc.etaOnlineNational ?? DEFAULTS.DELIVERY_ETA.ONLINE_NATIONAL;
        DELIVERY_CONFIG.DELIVERY_ETA.URBEXON_HOUR = doc.etaUrbexonHour ?? DEFAULTS.DELIVERY_ETA.URBEXON_HOUR;

        DELIVERY_CONFIG.SHIPROCKET_PICKUP_LOCATION = doc.shiprocketPickupLocation ?? DEFAULTS.SHIPROCKET_PICKUP_LOCATION;

        const ppl = doc.productPolicyLimits || {};
        DELIVERY_CONFIG.PRODUCT_POLICY.MIN_RETURN_WINDOW_DAYS = ppl.minReturnWindowDays ?? DEFAULTS.PRODUCT_POLICY.MIN_RETURN_WINDOW_DAYS;
        DELIVERY_CONFIG.PRODUCT_POLICY.MAX_RETURN_WINDOW_DAYS = ppl.maxReturnWindowDays ?? DEFAULTS.PRODUCT_POLICY.MAX_RETURN_WINDOW_DAYS;
        DELIVERY_CONFIG.PRODUCT_POLICY.MIN_REPLACEMENT_WINDOW_DAYS = ppl.minReplacementWindowDays ?? DEFAULTS.PRODUCT_POLICY.MIN_REPLACEMENT_WINDOW_DAYS;
        DELIVERY_CONFIG.PRODUCT_POLICY.MAX_REPLACEMENT_WINDOW_DAYS = ppl.maxReplacementWindowDays ?? DEFAULTS.PRODUCT_POLICY.MAX_REPLACEMENT_WINDOW_DAYS;
        DELIVERY_CONFIG.PRODUCT_POLICY.MIN_CANCEL_WINDOW_HOURS = ppl.minCancelWindowHours ?? DEFAULTS.PRODUCT_POLICY.MIN_CANCEL_WINDOW_HOURS;
        DELIVERY_CONFIG.PRODUCT_POLICY.MAX_CANCEL_WINDOW_HOURS = ppl.maxCancelWindowHours ?? DEFAULTS.PRODUCT_POLICY.MAX_CANCEL_WINDOW_HOURS;
        DELIVERY_CONFIG.PRODUCT_POLICY.ALLOWED_RETURN_CONDITIONS = ppl.allowedReturnConditions?.length ? ppl.allowedReturnConditions : DEFAULTS.PRODUCT_POLICY.ALLOWED_RETURN_CONDITIONS;

        console.log("✅ Delivery config loaded from DB");
    } catch (err) {
        console.warn("⚠️  Could not load delivery config from DB, using defaults:", err.message);
    }
};

/**
 * clampProductPolicy(input) — the one place that enforces admin-configured
 * return/replacement/cancel-window bounds and the return-conditions master
 * list against a product create/update payload. Reused by every write site
 * in productController.js (admin ecommerce create/update, vendor
 * urbexon_hour create/update) instead of each one hand-rolling its own
 * Math.min/Math.max — mirrors venderProfile.js's existing vendor-radius
 * clamp (`Math.min(Math.max(num, adminMin), adminMax)`) applied to product
 * policy fields instead. Only returns keys present on `input`, so callers
 * can merge the result without clobbering untouched fields.
 */
export const clampProductPolicy = (input = {}) => {
    const p = DELIVERY_CONFIG.PRODUCT_POLICY;
    const out = {};

    if (input.returnWindow !== undefined) {
        out.returnWindow = Math.min(p.MAX_RETURN_WINDOW_DAYS, Math.max(p.MIN_RETURN_WINDOW_DAYS, Number(input.returnWindow) || 0));
    }
    if (input.replacementWindow !== undefined) {
        out.replacementWindow = Math.min(p.MAX_REPLACEMENT_WINDOW_DAYS, Math.max(p.MIN_REPLACEMENT_WINDOW_DAYS, Number(input.replacementWindow) || 0));
    }
    if (input.cancelWindow !== undefined) {
        out.cancelWindow = Math.min(p.MAX_CANCEL_WINDOW_HOURS, Math.max(p.MIN_CANCEL_WINDOW_HOURS, Number(input.cancelWindow) || 0));
    }
    if (input.returnConditions !== undefined) {
        let arr = input.returnConditions;
        if (typeof arr === "string") {
            try { arr = JSON.parse(arr); } catch { arr = arr.split(","); }
        }
        out.returnConditions = (Array.isArray(arr) ? arr : [])
            .map((c) => String(c).trim())
            .filter((c) => p.ALLOWED_RETURN_CONDITIONS.includes(c));
    }
    return out;
};
