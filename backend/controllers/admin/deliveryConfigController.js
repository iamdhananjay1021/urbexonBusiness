/**
 * deliveryConfigController.js — Production Hardened v2.0
 *
 * FIXES APPLIED:
 * [FIX-D1] getDeliveryConfig → caching added (300s TTL)
 * [FIX-D2] getPublicDeliveryConfig → caching added (300s TTL)
 * [FIX-D3] updateDeliveryConfig → cache invalidated on update
 * [FIX-D4] All cache calls wrapped in try/catch (safe helpers)
 * [FIX-D5] Validation helper already present — kept and referenced
 */
import DeliveryConfigModel from "../../models/DeliveryConfig.js";
import { refreshDeliveryConfig } from "../../config/deliveryConfig.js";
import { getCache, setCache, delCacheByPrefix } from "../../utils/Cache.js";

const CONFIG_ID = "delivery_config";
const ADMIN_CACHE_KEY = "delivery:config:admin";
const PUBLIC_CACHE_KEY = "delivery:config:public";
const CONFIG_TTL = 300; // 5 minutes

// [FIX-D4] Safe cache helpers
const safeGetCache = async (key) => {
    try { return await getCache(key); } catch (_) { return null; }
};
const safeSetCache = async (key, val, ttl) => {
    try { await setCache(key, val, ttl); } catch (_) { }
};
const safeDelPrefix = async (prefix) => {
    try { await delCacheByPrefix(prefix); } catch (_) { }
};

/* ── Seed default config if missing ── */
const ensureConfig = async () => {
    let doc = await DeliveryConfigModel.findById(CONFIG_ID).lean();
    if (!doc) {
        doc = await DeliveryConfigModel.create({ _id: CONFIG_ID });
    }
    return doc;
};

// Validates numeric fields before DB write
const validateDeliveryConfig = (body) => {
    const errors = [];

    const nonNegativeFields = [
        "freeDeliveryThreshold", "onlineDeliveryCharge", "codCharge",
        "platformFee", "uhBaseCharge", "uhChargePerKm", "uhMaxCharge",
    ];
    for (const f of nonNegativeFields) {
        if (body[f] !== undefined) {
            const v = Number(body[f]);
            if (isNaN(v) || v < 0) errors.push(`${f} must be >= 0`);
        }
    }

    const positiveFields = [
        "uhMaxRadiusKm", "uhVendorSelfRadiusKm",
        "avgRiderSpeedKmph", "minVendorRadiusKm", "maxVendorRadiusKm", "defaultVendorRadiusKm",
    ];
    for (const f of positiveFields) {
        if (body[f] !== undefined) {
            const v = Number(body[f]);
            if (isNaN(v) || v <= 0) errors.push(`${f} must be > 0`);
        }
    }

    if (body.defaultPrepTimeMin !== undefined) {
        const v = Number(body.defaultPrepTimeMin);
        if (isNaN(v) || v < 0) errors.push("defaultPrepTimeMin must be >= 0");
    }

    // Vendor radius bounds must stay internally consistent AND never exceed
    // the platform's absolute hard safety ceiling (10km) — admin can only
    // ever tighten this window, never widen it past that hard limit.
    const HARD_MAX_RADIUS_KM = 10;
    const minR = body.minVendorRadiusKm !== undefined ? Number(body.minVendorRadiusKm) : undefined;
    const maxR = body.maxVendorRadiusKm !== undefined ? Number(body.maxVendorRadiusKm) : undefined;
    const defR = body.defaultVendorRadiusKm !== undefined ? Number(body.defaultVendorRadiusKm) : undefined;
    if (maxR !== undefined && maxR > HARD_MAX_RADIUS_KM) errors.push(`maxVendorRadiusKm cannot exceed the platform hard limit of ${HARD_MAX_RADIUS_KM}km`);
    if (minR !== undefined && maxR !== undefined && minR > maxR) errors.push("minVendorRadiusKm cannot exceed maxVendorRadiusKm");
    if (defR !== undefined) {
        if (minR !== undefined && defR < minR) errors.push("defaultVendorRadiusKm cannot be below minVendorRadiusKm");
        if (maxR !== undefined && defR > maxR) errors.push("defaultVendorRadiusKm cannot exceed maxVendorRadiusKm");
    }

    if (body.shopLat !== undefined) {
        const v = Number(body.shopLat);
        if (isNaN(v) || v < -90 || v > 90) errors.push("shopLat must be a valid latitude (-90 to 90)");
    }
    if (body.shopLng !== undefined) {
        const v = Number(body.shopLng);
        if (isNaN(v) || v < -180 || v > 180) errors.push("shopLng must be a valid longitude (-180 to 180)");
    }

    if (body.returnDays !== undefined) {
        const v = Number(body.returnDays);
        if (isNaN(v) || v < 0 || v > 365) errors.push("returnDays must be 0–365");
    }

    // Product Return Policy Limits — same internal-consistency + hard-ceiling
    // pattern as the vendor radius bounds above (min <= max, never past the
    // absolute ceiling already enforced at the schema level: 0-30 days for
    // return/replacement windows, 0-72 hours for cancel window, matching
    // Product.js's own field-level bounds).
    if (body.productPolicyLimits !== undefined) {
        const ppl = body.productPolicyLimits || {};
        const HARD_MAX_DAYS = 30;
        const HARD_MAX_HOURS = 72;
        const pairs = [
            ["minReturnWindowDays", "maxReturnWindowDays", HARD_MAX_DAYS],
            ["minReplacementWindowDays", "maxReplacementWindowDays", HARD_MAX_DAYS],
            ["minCancelWindowHours", "maxCancelWindowHours", HARD_MAX_HOURS],
        ];
        for (const [minKey, maxKey, hardMax] of pairs) {
            const minV = ppl[minKey] !== undefined ? Number(ppl[minKey]) : undefined;
            const maxV = ppl[maxKey] !== undefined ? Number(ppl[maxKey]) : undefined;
            if (minV !== undefined && (isNaN(minV) || minV < 0)) errors.push(`${minKey} must be >= 0`);
            if (maxV !== undefined && (isNaN(maxV) || maxV > hardMax)) errors.push(`${maxKey} cannot exceed the platform hard limit of ${hardMax}`);
            if (minV !== undefined && maxV !== undefined && minV > maxV) errors.push(`${minKey} cannot exceed ${maxKey}`);
        }
        if (ppl.allowedReturnConditions !== undefined && !Array.isArray(ppl.allowedReturnConditions)) {
            errors.push("allowedReturnConditions must be an array");
        }
    }

    return errors;
};

/* ── GET /api/admin/delivery-config ── */
export const getDeliveryConfig = async (_req, res) => {
    try {
        // [FIX-D1] Cache admin config (300s)
        const cached = await safeGetCache(ADMIN_CACHE_KEY);
        if (cached) return res.json({ success: true, config: cached });

        const config = await ensureConfig();
        await safeSetCache(ADMIN_CACHE_KEY, config, CONFIG_TTL);
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
            "avgRiderSpeedKmph", "defaultPrepTimeMin",
            "minVendorRadiusKm", "maxVendorRadiusKm", "defaultVendorRadiusKm",
            "productPolicyLimits",
        ];

        const updates = {};
        for (const key of allowedFields) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields to update" });
        }

        const validationErrors = validateDeliveryConfig(updates);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: "Validation failed", errors: validationErrors });
        }

        const config = await DeliveryConfigModel.findByIdAndUpdate(
            CONFIG_ID,
            { $set: updates },
            { new: true, upsert: true, runValidators: true }
        ).lean();

        // [FIX-D3] Invalidate both admin and public config cache
        await Promise.all([
            safeDelPrefix("delivery:config:"),
        ]);

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
        // [FIX-D2] Cache public config (300s)
        const cached = await safeGetCache(PUBLIC_CACHE_KEY);
        if (cached) return res.json({ success: true, ...cached });

        const config = await ensureConfig();

        const publicData = {
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
            avgRiderSpeedKmph: config.avgRiderSpeedKmph,
            defaultPrepTimeMin: config.defaultPrepTimeMin,
            minVendorRadiusKm: config.minVendorRadiusKm,
            maxVendorRadiusKm: config.maxVendorRadiusKm,
            defaultVendorRadiusKm: config.defaultVendorRadiusKm,
            // Vendor product forms read these bounds from this existing
            // public endpoint rather than a new route.
            productPolicyLimits: config.productPolicyLimits,
        };

        await safeSetCache(PUBLIC_CACHE_KEY, publicData, CONFIG_TTL);
        res.json({ success: true, ...publicData });
    } catch (err) {
        console.error("[DeliveryConfig] Public GET error:", err.message);
        res.status(500).json({ success: false, message: "Failed to load delivery info" });
    }
};