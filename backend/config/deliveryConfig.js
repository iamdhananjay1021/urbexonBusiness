/**
 * deliveryConfig.js — PRODUCTION
 * COD: Available PAN-INDIA (restriction removed)
 * Urbexon Hour: Local express delivery up to 15km
 * ✅ Loads from DB (DeliveryConfig model) with hardcoded fallbacks
 */

/* ── Hardcoded defaults (fallback if DB not loaded yet) ── */
const DEFAULTS = {
    FREE_DELIVERY_THRESHOLD: 499,
    ONLINE_DELIVERY_CHARGE: 40,
    COD_CHARGE: 70,
    PLATFORM_FEE: 11,

    URBEXON_HOUR: {
        ENABLED: true,
        MAX_RADIUS_KM: 15,
        VENDOR_SELF_RADIUS_KM: 2,
        BASE_CHARGE: 25,
        CHARGE_PER_KM: 8,
        MAX_CHARGE: 150,
        ETA: "45–120 mins",
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
};

// Mutable config — starts with defaults, updated from DB
export const DELIVERY_CONFIG = { ...DEFAULTS, URBEXON_HOUR: { ...DEFAULTS.URBEXON_HOUR }, DELIVERY_ETA: { ...DEFAULTS.DELIVERY_ETA } };

export const DELIVERY_TYPES = {
    ECOMMERCE_STANDARD: "ECOMMERCE_STANDARD",
    URBEXON_HOUR: "URBEXON_HOUR",
};

export const calcDeliveryCharge = (itemsTotal, paymentMethod, options = {}) => {
    const { deliveryType = DELIVERY_TYPES.ECOMMERCE_STANDARD, distanceKm = 0 } = options;

    if (deliveryType === DELIVERY_TYPES.URBEXON_HOUR) {
        if (!DELIVERY_CONFIG.URBEXON_HOUR.ENABLED) throw new Error("Urbexon Hour is currently unavailable");
        if (distanceKm > DELIVERY_CONFIG.URBEXON_HOUR.MAX_RADIUS_KM)
            throw new Error(`Urbexon Hour supports up to ${DELIVERY_CONFIG.URBEXON_HOUR.MAX_RADIUS_KM} km only`);
        const computed = DELIVERY_CONFIG.URBEXON_HOUR.BASE_CHARGE + (distanceKm * DELIVERY_CONFIG.URBEXON_HOUR.CHARGE_PER_KM);
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

export const getDeliveryETA = ({ deliveryType = DELIVERY_TYPES.ECOMMERCE_STANDARD } = {}) => {
    if (deliveryType === DELIVERY_TYPES.URBEXON_HOUR) return DELIVERY_CONFIG.DELIVERY_ETA.URBEXON_HOUR;
    return DELIVERY_CONFIG.DELIVERY_ETA.ECOMMERCE_STANDARD;
};

export const getDeliveryProvider = ({ deliveryType, distanceKm = 0 }) => {
    if (deliveryType !== DELIVERY_TYPES.URBEXON_HOUR) return "SHIPROCKET";
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

        DELIVERY_CONFIG.SHOP_LAT = doc.shopLat ?? DEFAULTS.SHOP_LAT;
        DELIVERY_CONFIG.SHOP_LNG = doc.shopLng ?? DEFAULTS.SHOP_LNG;
        DELIVERY_CONFIG.SHOP_PINCODE = doc.shopPincode ?? DEFAULTS.SHOP_PINCODE;

        DELIVERY_CONFIG.DELIVERY_ETA.ECOMMERCE_STANDARD = doc.etaEcommerceStandard ?? DEFAULTS.DELIVERY_ETA.ECOMMERCE_STANDARD;
        DELIVERY_CONFIG.DELIVERY_ETA.ONLINE_LOCAL = doc.etaOnlineLocal ?? DEFAULTS.DELIVERY_ETA.ONLINE_LOCAL;
        DELIVERY_CONFIG.DELIVERY_ETA.ONLINE_NATIONAL = doc.etaOnlineNational ?? DEFAULTS.DELIVERY_ETA.ONLINE_NATIONAL;
        DELIVERY_CONFIG.DELIVERY_ETA.URBEXON_HOUR = doc.etaUrbexonHour ?? DEFAULTS.DELIVERY_ETA.URBEXON_HOUR;

        DELIVERY_CONFIG.SHIPROCKET_PICKUP_LOCATION = doc.shiprocketPickupLocation ?? DEFAULTS.SHIPROCKET_PICKUP_LOCATION;

        console.log("✅ Delivery config loaded from DB");
    } catch (err) {
        console.warn("⚠️  Could not load delivery config from DB, using defaults:", err.message);
    }
};
