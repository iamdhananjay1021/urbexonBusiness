/**
 * orderValidations.js — Production v5.0 FINAL
 *
 * ════════════════════════════════════════════════════════════════════
 * ARCHITECTURE: TWO COMPLETELY SEPARATE ORDER CHANNELS
 * ════════════════════════════════════════════════════════════════════
 *
 *  CHANNEL A — ECOMMERCE (productType: "ecommerce", vendorId: null)
 *  ─────────────────────────────────────────────────────────────────
 *  • Admin-managed products only
 *  • vendorId is NULL — this is CORRECT & EXPECTED
 *  • Delivery: Shiprocket (courier)
 *  • deliveryType must be "ECOMMERCE_STANDARD"
 *  • NO vendor check, NO distance check, NO pincode UH check
 *  • COD: pincode existence check only (not UH serviceability)
 *
 *  CHANNEL B — URBEXON HOUR (productType: "urbexon_hour", vendorId: required)
 *  ────────────────────────────────────────────────────────────────────────────
 *  • Vendor-managed products only
 *  • vendorId is REQUIRED and all items must be from ONE vendor
 *  • Delivery: Local rider / vendor self
 *  • deliveryType must be "URBEXON_HOUR"
 *  • Requires location (lat/lng) for distance check
 *
 * ════════════════════════════════════════════════════════════════════
 * FIXES IN THIS VERSION:
 * [FIX-1] validateOrderItems — NO longer throws "Unable to determine vendor"
 *         for ecommerce products (vendorId: null is valid for ecommerce)
 * [FIX-2] validateOrderRequest — accepts BOTH delivery types correctly
 * [FIX-3] validateOrderParams — detects channel from items, runs
 *         channel-specific validation pipeline
 * [FIX-4] Cross-channel guard — UH products in ecommerce checkout blocked
 * [FIX-5] Mixed cart guard — ecommerce + UH items together blocked
 * [FIX-6] COD validation for ecommerce — only checks pincode exists (active/coming_soon)
 *         not UH delivery radius
 * [FIX-7] All original validations preserved — nothing removed
 * ════════════════════════════════════════════════════════════════════
 */

import Product from "../models/Product.js";
import Pincode from "../models/vendorModels/Pincode.js";
import Coupon from "../models/Coupon.js";
import Vendor from "../models/vendorModels/Vendor.js";
import { DELIVERY_CONFIG, DELIVERY_TYPES } from "../config/deliveryConfig.js";

/* ─────────────────────────────────────────────────────────────
   HELPER: Detect order channel from items (DB lookup)
   Returns: "ecommerce" | "urbexon_hour"
   Throws: if mixed cart detected
───────────────────────────────────────────────────────────── */
const detectOrderChannel = async (items) => {
    if (!items?.length) throw new Error("Cart is empty");

    const productIds = items.map(i => i.productId || i._id).filter(Boolean);
    if (productIds.length === 0) throw new Error("Invalid cart — missing product IDs");

    // Fetch only productType to detect channel (lightweight query)
    const products = await Product.find({ _id: { $in: productIds }, isActive: true })
        .select("_id name productType vendorId")
        .lean();

    if (products.length !== productIds.length) {
        const found = new Set(products.map(p => p._id.toString()));
        const missing = productIds.filter(id => !found.has(id.toString()));
        throw new Error(`Some products are unavailable or not found: ${missing.join(", ")}`);
    }

    // Robust detection: prefer explicit vendorId (vendor-managed products)
    // Some product records may have incorrect `productType` due to manual edits.
    // Treat any product with a non-null vendorId as an Urbexon Hour item.
    const ecomItems = products.filter(p => !p.vendorId && p.productType === "ecommerce");
    const uhItems = products.filter(p => p.vendorId || p.productType === "urbexon_hour");

    // [FIX-5] Block mixed cart
    if (ecomItems.length > 0 && uhItems.length > 0) {
        throw new Error(
            `Cannot mix Ecommerce and Urbexon Hour items in one order. ` +
            `Ecommerce items: ${ecomItems.map(p => p.name).join(", ")}. ` +
            `Urbexon Hour items: ${uhItems.map(p => p.name).join(", ")}. ` +
            `Please place separate orders.`
        );
    }

    if (uhItems.length > 0) return "urbexon_hour";
    return "ecommerce";
};

/* ─────────────────────────────────────────────────────────────
   VALIDATION 1: Basic request parameters
   (Preserved from original + delivery type fix)
───────────────────────────────────────────────────────────── */
export const validateOrderRequest = (body) => {
    const { items, customerName, phone, address, paymentMethod, deliveryType } = body;

    if (!items?.length) throw new Error("Cart is empty");
    if (items.length > 20) throw new Error("Too many items (max 20)");
    if (!customerName?.trim()) throw new Error("Customer name required");

    // Phone: Indian mobile numbers starting 6-9
    if (!phone?.trim() || !/^[6-9]\d{9}$/.test(phone.trim()))
        throw new Error("Valid 10-digit Indian phone number required");

    if (!address?.trim()) throw new Error("Delivery address required");

    if (!paymentMethod || !["COD", "RAZORPAY"].includes(paymentMethod))
        throw new Error("Invalid payment method. Use COD or RAZORPAY");

    // [FIX-2] Accept BOTH delivery types
    if (!deliveryType || !["ECOMMERCE_STANDARD", "URBEXON_HOUR"].includes(deliveryType))
        throw new Error("Invalid delivery type. Use ECOMMERCE_STANDARD or URBEXON_HOUR");

    return true;
};

/* ─────────────────────────────────────────────────────────────
   VALIDATION 2A: Ecommerce item validation
   • productType must be "ecommerce"
   • vendorId: null is CORRECT — admin products have no vendor
   • [FIX-1] No "Unable to determine vendor" error for ecommerce
───────────────────────────────────────────────────────────── */
export const validateEcommerceItems = async (frontendItems) => {
    return validateAndFormatItems(frontendItems, "ecommerce");
};

/* ─────────────────────────────────────────────────────────────
   VALIDATION 2B: Urbexon Hour item validation
   • productType must be "urbexon_hour"
   • vendorId is REQUIRED
   • All items must be from ONE vendor
   (Original logic preserved from v1)
───────────────────────────────────────────────────────────── */
export const validateUrbexonHourItems = async (frontendItems) => {
    return validateAndFormatItems(frontendItems, "urbexon_hour");
};

/**
 * REFACTORED: Unified item validation logic
 */
const validateAndFormatItems = async (frontendItems, channel) => {
    if (!Array.isArray(frontendItems) || frontendItems.length === 0)
        throw new Error("Cart is empty");

    const formattedItems = [];
    let itemsTotal = 0;
    const vendorIds = new Set();

    const productIds = frontendItems.map(item => item.productId || item._id).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds }, isActive: true })
        .select(
            "name price mrp inStock stock images productType vendorId " +
            "isCancellable isReturnable isReplaceable returnWindow replacementWindow " +
            "cancelWindow nonReturnableReason prepTimeMinutes colorVariants"
        )
        .lean();

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    for (const item of frontendItems) {
        const productId = item.productId || item._id;
        if (!productId) throw new Error("Invalid product ID in cart");

        const product = productMap.get(productId.toString());
        if (!product) throw new Error(`Product not found: ${productId}`);

        // Channel validation
        if (channel === "ecommerce" && product.productType === "urbexon_hour") {
            throw new Error(`"${product.name}" is an Urbexon Hour item and cannot be ordered via Ecommerce checkout.`);
        }
        if (channel === "urbexon_hour" && product.productType === "ecommerce") {
            throw new Error(`"${product.name}" is an Ecommerce item and cannot be ordered via Urbexon Hour.`);
        }
        if (channel === "urbexon_hour" && !product.vendorId) {
            throw new Error(`"${product.name}" has no vendor assigned for Urbexon Hour.`);
        }

        if (product.vendorId) vendorIds.add(String(product.vendorId));

        const qty = Math.min(Math.max(1, Number(item.qty || item.quantity || 1)), 100);

        if (!product.inStock || product.stock < qty) {
            throw new Error(`"${product.name}" is out of stock or has insufficient quantity.`);
        }

        let dbPrice = Number(product.price);
        let dbMrp = product.mrp ? Number(product.mrp) : null;
        let finalImage = product.images?.[0]?.url || "";

        if (item.selectedColor && product.colorVariants?.length) {
            const variant = product.colorVariants.find(v => (v.name || v.color) === item.selectedColor);
            if (variant) {
                if (variant.price != null && variant.price > 0) dbPrice = Number(variant.price);
                if (variant.mrp != null && variant.mrp > 0) dbMrp = Number(variant.mrp);
                if (variant.images?.length) finalImage = variant.images[0].url;
            }
        }

        itemsTotal += dbPrice * qty;

        const policy = (channel === "ecommerce")
            ? {
                isCancellable: product.isCancellable !== false,
                isReturnable: product.isReturnable !== false,
                isReplaceable: product.isReplaceable === true,
                returnWindow: product.returnWindow ?? 7,
                replacementWindow: product.replacementWindow ?? 7,
                cancelWindow: product.cancelWindow ?? 0,
                nonReturnableReason: product.nonReturnableReason || "",
            }
            : { // Urbexon Hour policies
                isCancellable: product.isCancellable !== false,
                isReturnable: false,
                isReplaceable: false,
                returnWindow: 0,
                replacementWindow: 0,
                cancelWindow: product.cancelWindow ?? 0,
                nonReturnableReason: "Urbexon Hour orders are non-returnable",
            };

        formattedItems.push({
            productId: product._id,
            name: String(product.name).slice(0, 200),
            price: dbPrice,
            mrp: dbMrp,
            qty,
            image: (typeof item.image === "string" && item.image.startsWith("http")) ? item.image : finalImage,
            customization: {
                text: String(item.customization?.text || "").trim().slice(0, 500),
                imageUrl: String(item.customization?.imageUrl || "").trim().slice(0, 1000),
                note: String(item.customization?.note || "").trim().slice(0, 1000),
            },
            selectedSize: String(item.selectedSize || "").trim().slice(0, 50),
            selectedColor: String(item.selectedColor || "").trim().slice(0, 50),
            productType: channel,
            vendorId: product.vendorId || null,
            ...(channel === "urbexon_hour" && { prepTimeMinutes: product.prepTimeMinutes || 10 }),
            policy,
        });
    }

    if (channel === "ecommerce") {
        return {
            formattedItems,
            itemsTotal,
            vendorId: null,
            orderMode: "ECOMMERCE",
        };
    }

    // Urbexon Hour specific checks
    if (vendorIds.size > 1)
        throw new Error("Your cart contains items from multiple vendors. Urbexon Hour orders must be from a single vendor.");
    if (vendorIds.size === 0)
        throw new Error("Unable to determine vendor for Urbexon Hour items.");

    return {
        formattedItems,
        itemsTotal,
        vendorId: Array.from(vendorIds)[0],
        orderMode: "URBEXON_HOUR",
    };
}

/* ─────────────────────────────────────────────────────────────
   VALIDATION 3: Payment method eligibility
   [FIX-6] Ecommerce COD: only checks pincode exists (not UH radius)
           UH COD: checks UH serviceability
───────────────────────────────────────────────────────────── */
export const validatePaymentMethod = async (method, pincode, orderChannel = "ecommerce") => {
    if (method === "COD") {
        if (!pincode || !/^\d{6}$/.test(String(pincode).trim()))
            throw new Error("Valid 6-digit pincode required for COD");

        const pincodeDoc = await Pincode.findOne({ code: String(pincode).trim() }).lean();

        if (orderChannel === "ecommerce") {
            // [FIX-6] Ecommerce COD: Shiprocket covers all India
            // Only block explicitly blocked pincodes — COD available everywhere else
            if (pincodeDoc?.status === "blocked") {
                throw new Error("COD not available for this pincode. Please use online payment.");
            }
            // coming_soon and not_found pincodes → allow COD for ecommerce (Shiprocket handles it)
        } else {
            // UH COD: requires active pincode (local delivery only)
            if (!pincodeDoc || pincodeDoc.status !== "active") {
                throw new Error(
                    pincodeDoc?.status === "coming_soon"
                        ? "COD is coming soon to your area. Use online payment for now."
                        : "COD not available for this pincode. Use online payment."
                );
            }
        }
    }

    return true;
};

/* ─────────────────────────────────────────────────────────────
   VALIDATION 4: Delivery serviceability
   • Ecommerce: no distance check (Shiprocket = pan-India)
   • UH: STRICT distance check from specific vendor location
───────────────────────────────────────────────────────────── */
export const validateDeliveryServiceability = async (
    deliveryType, latitude, longitude, vendorId, pincode
) => {
    if (deliveryType !== "URBEXON_HOUR") return { realDistanceKm: 0 };

    if (!DELIVERY_CONFIG.URBEXON_HOUR?.ENABLED)
        throw new Error("Urbexon Hour delivery is currently unavailable");

    const vendor = await Vendor.findById(vendorId)
        .select("location deliveryRadius servicePincodes")
        .lean();
    if (!vendor) throw new Error("Vendor not found.");

    const hasValidCoords =
        vendor.location?.coordinates?.length === 2 &&
        !(vendor.location.coordinates[0] === 0 &&
            vendor.location.coordinates[1] === 0);

    const hasServicePincodes =
        Array.isArray(vendor.servicePincodes) &&
        vendor.servicePincodes.length > 0;

    // Vendor ne kuch configure nahi kiya → allow by default
    if (!hasValidCoords && !hasServicePincodes) {
        return { realDistanceKm: 0 };
    }

    // Customer ne GPS nahi diya
    if (!latitude || !longitude) {
        if (!pincode) throw new Error("Pincode required for express delivery.");
        if (hasServicePincodes &&
            !vendor.servicePincodes.includes(String(pincode))) {
            throw new Error(
                "Your pincode is outside the delivery zone for this vendor."
            );
        }
        return { realDistanceKm: 0 };
    }

    // GPS hai but vendor coordinates nahi → allow
    if (!hasValidCoords) {
        return { realDistanceKm: 0 };
    }

    // Dono hain → distance check karo
    const orderLat = Number(latitude);
    const orderLng = Number(longitude);
    const shopLng = vendor.location.coordinates[0];
    const shopLat = vendor.location.coordinates[1];
    const maxRadius =
        vendor.deliveryRadius ||
        DELIVERY_CONFIG.URBEXON_HOUR.MAX_RADIUS_KM;

    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(orderLat - shopLat);
    const dLon = toRad(orderLng - shopLng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(shopLat)) *
        Math.cos(toRad(orderLat)) *
        Math.sin(dLon / 2) ** 2;
    const realDistanceKm =
        Math.round(
            R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10
        ) / 10;

    if (realDistanceKm > maxRadius) {
        throw new Error(
            `Your location is outside the vendor's delivery radius. ` +
            `Maximum: ${maxRadius}km, Your distance: ${realDistanceKm}km`
        );
    }

    return { realDistanceKm };
};

/* ─────────────────────────────────────────────────────────────
   VALIDATION 5: Coupon validation
   (Preserved from original — unchanged)
───────────────────────────────────────────────────────────── */
export const validateCoupon = async (couponId, couponCode, userId, orderTotal) => {
    if (!couponId && !couponCode) return null;

    const coupon = couponId
        ? await Coupon.findById(couponId).lean()
        : await Coupon.findOne({ couponCode }).lean();

    if (!coupon || !coupon.isActive)
        throw new Error("Coupon not found or inactive");

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate))
        throw new Error("Coupon has expired");

    if (coupon.minOrderValue && orderTotal < coupon.minOrderValue)
        throw new Error(`Order total must be at least ₹${coupon.minOrderValue} to use this coupon.`);

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit)
        throw new Error("Coupon usage limit reached");

    if (coupon.userUsageLimit) {
        const userUsage = await Coupon.countDocuments({
            _id: coupon._id,
            "usedBy.userId": userId,
        });
        if (userUsage >= coupon.userUsageLimit)
            throw new Error("You have already used this coupon the maximum number of times");
    }

    return coupon;
};

/* ─────────────────────────────────────────────────────────────
   VALIDATION 6: Single vendor enforcement (for UH)
   (Preserved from original — only runs for UH orders)
───────────────────────────────────────────────────────────── */
export const validateSingleVendor = (items) => {
    if (!items?.length) throw new Error("No items provided");

    const vendorIds = new Set();
    for (const item of items) {
        if (item.vendorId) vendorIds.add(String(item.vendorId));
    }

    if (vendorIds.size > 1) {
        throw new Error(
            "Your cart contains items from multiple vendors. " +
            "Please keep items from one vendor per order."
        );
    }

    return vendorIds.size === 1 ? Array.from(vendorIds)[0] : null;
};

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT: validateOrderParams
   ─────────────────────────────────────────────────────────────
   PIPELINE:
   1. Detect channel (ecommerce vs urbexon_hour) from DB
   2. Basic request validation
   3. Channel-specific item validation
   4. Payment + COD validation (channel-aware)
   5. Delivery serviceability (UH only)
   6. Coupon validation

   Returns: { formattedItems, itemsTotal, vendorId, realDistanceKm,
              coupon, paymentMethod, deliveryType, orderMode, orderChannel }
═══════════════════════════════════════════════════════════════ */
export const validateOrderParams = async ({
    items,
    customerName,
    phone,
    address,
    email,
    pincode,
    paymentMethod,
    deliveryType,
    latitude,
    longitude,
    couponId,
    couponCode,
    userId,
    // skipVendorCheck is NO LONGER NEEDED — channel auto-detected from DB
    // kept for backward compat but ignored
    skipVendorCheck,
}) => {
    try {
        // ── Step 0: Detect channel from DB ────────────────────────────────
        // This is the single source of truth — we don't trust frontend deliveryType
        // to determine channel. We look at actual product types in the DB.
        const orderChannel = await detectOrderChannel(items);

        // ── Step 1: Basic request validation ─────────────────────────────
        // For ecommerce, deliveryType should be ECOMMERCE_STANDARD
        // For UH, deliveryType should be URBEXON_HOUR
        // We auto-correct deliveryType based on channel if frontend sends wrong value
        const effectiveDeliveryType =
            orderChannel === "ecommerce" ? "ECOMMERCE_STANDARD" : "URBEXON_HOUR";

        validateOrderRequest({
            items,
            customerName,
            phone,
            address,
            email,
            pincode,
            paymentMethod,
            // Use effective delivery type (auto-corrected)
            deliveryType: effectiveDeliveryType,
        });

        // ── Step 2: Channel-specific item validation ──────────────────────
        let itemValidation;
        if (orderChannel === "ecommerce") {
            // [FIX-1] Ecommerce: vendorId=null is correct. No vendor check.
            itemValidation = await validateEcommerceItems(items);
        } else {
            // UH: vendorId required, single vendor enforced
            itemValidation = await validateUrbexonHourItems(items);
        }

        const { formattedItems, itemsTotal, vendorId, orderMode } = itemValidation;

        // ── Step 3: Payment method validation (channel-aware) ─────────────
        // [FIX-6] Ecommerce COD = pan-India (Shiprocket), only blocked pincodes rejected
        //         UH COD = requires active local pincode
        await validatePaymentMethod(paymentMethod, pincode, orderChannel);

        // ── Step 4: Delivery serviceability ──────────────────────────────
        // Ecommerce: no distance check (Shiprocket = pan-India)
        // UH: server-side distance check
        const { realDistanceKm } = await validateDeliveryServiceability(
            effectiveDeliveryType,
            latitude,
            longitude,
            vendorId,
            pincode
        );

        // ── Step 5: Coupon validation ─────────────────────────────────────
        let couponDoc = null;
        if (couponId || couponCode) {
            couponDoc = await validateCoupon(couponId, couponCode, userId, itemsTotal);
        }

        // ── Return complete validated data ────────────────────────────────
        return {
            isValid: true,
            formattedItems,
            itemsTotal,
            // vendorId: null for ecommerce (admin products), ObjectId for UH (vendor products)
            vendorId,
            realDistanceKm,
            coupon: couponDoc,
            paymentMethod,
            // Always use effective delivery type (auto-corrected from channel)
            deliveryType: effectiveDeliveryType,
            orderMode,    // "ECOMMERCE" | "URBEXON_HOUR"
            orderChannel, // "ecommerce" | "urbexon_hour"
        };
    } catch (err) {
        throw new Error(err.message || "Order validation failed");
    }
};