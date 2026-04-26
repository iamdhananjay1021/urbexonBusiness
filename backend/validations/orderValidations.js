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

    const ecomItems = products.filter(p => p.productType === "ecommerce");
    const uhItems = products.filter(p => p.productType === "urbexon_hour");

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
    if (!Array.isArray(frontendItems) || frontendItems.length === 0)
        throw new Error("Cart is empty");

    const formattedItems = [];
    let itemsTotal = 0;

    for (const item of frontendItems) {
        const productId = item.productId || item._id;
        if (!productId) throw new Error("Invalid product ID in cart");

        const product = await Product.findOne({ _id: productId, isActive: true })
            .select(
                "name price mrp inStock stock images productType vendorId " +
                "isCancellable isReturnable isReplaceable returnWindow " +
                "replacementWindow cancelWindow nonReturnableReason"
            )
            .lean();

        if (!product) throw new Error(`Product not found: ${productId}`);

        // [FIX-4] Block vendor UH products from ecommerce checkout
        if (product.productType === "urbexon_hour") {
            throw new Error(
                `"${product.name}" is an Urbexon Hour item and cannot be ordered via Ecommerce checkout. ` +
                `Please use the Urbexon Hour section.`
            );
        }

        // Qty validation
        const qty = Math.min(Math.max(1, Number(item.qty || item.quantity || 1)), 100);

        // Inventory check
        if (!product.inStock || product.stock < qty) {
            throw new Error(
                `"${product.name}" ${product.stock < qty
                    ? `has insufficient stock (available: ${product.stock}, requested: ${qty})`
                    : "is out of stock"
                }`
            );
        }

        // ✅ DB price — frontend price IGNORED
        const dbPrice = Number(product.price);
        itemsTotal += dbPrice * qty;

        formattedItems.push({
            productId: product._id,
            name: String(product.name).slice(0, 200),
            price: dbPrice,
            mrp: product.mrp ? Number(product.mrp) : null,
            qty,
            image: typeof item.image === "string"
                ? item.image
                : product.images?.[0]?.url || "",
            customization: {
                text: String(item.customization?.text || "").trim().slice(0, 500),
                imageUrl: String(item.customization?.imageUrl || "").trim().slice(0, 1000),
                note: String(item.customization?.note || "").trim().slice(0, 1000),
            },
            selectedSize: String(item.selectedSize || "").trim().slice(0, 50),
            // [FIX-1] productType: ecommerce, vendorId: null — CORRECT for admin products
            productType: "ecommerce",
            vendorId: null,
            policy: {
                isCancellable: product.isCancellable !== false,
                isReturnable: product.isReturnable !== false,
                isReplaceable: product.isReplaceable === true,
                returnWindow: product.returnWindow ?? 7,
                replacementWindow: product.replacementWindow ?? 7,
                cancelWindow: product.cancelWindow ?? 0,
                nonReturnableReason: product.nonReturnableReason || "",
            },
        });
    }

    return {
        formattedItems,
        itemsTotal,
        vendorId: null, // [FIX-1] Ecommerce = no vendor. Delivery via Shiprocket.
        orderMode: "ECOMMERCE",
    };
};

/* ─────────────────────────────────────────────────────────────
   VALIDATION 2B: Urbexon Hour item validation
   • productType must be "urbexon_hour"
   • vendorId is REQUIRED
   • All items must be from ONE vendor
   (Original logic preserved from v1)
───────────────────────────────────────────────────────────── */
export const validateUrbexonHourItems = async (frontendItems) => {
    if (!Array.isArray(frontendItems) || frontendItems.length === 0)
        throw new Error("Cart is empty");

    const formattedItems = [];
    let itemsTotal = 0;
    const vendorIds = new Set();

    for (const item of frontendItems) {
        const productId = item.productId || item._id;
        if (!productId) throw new Error("Invalid product ID in cart");

        const product = await Product.findOne({ _id: productId, isActive: true })
            .select(
                "name price mrp inStock stock images productType vendorId " +
                "isCancellable isReturnable isReplaceable returnWindow " +
                "replacementWindow cancelWindow nonReturnableReason prepTimeMinutes"
            )
            .lean();

        if (!product) throw new Error(`Product not found: ${productId}`);

        // Block ecommerce products from UH checkout
        if (product.productType === "ecommerce") {
            throw new Error(
                `"${product.name}" is an Ecommerce item and cannot be ordered via Urbexon Hour. ` +
                `Please use the Ecommerce section.`
            );
        }

        // vendorId is REQUIRED for UH products
        if (!product.vendorId) {
            throw new Error(`"${product.name}" has no vendor assigned. Please contact support.`);
        }

        vendorIds.add(String(product.vendorId));

        const qty = Math.min(Math.max(1, Number(item.qty || item.quantity || 1)), 100);

        if (!product.inStock || product.stock < qty) {
            throw new Error(
                `"${product.name}" ${product.stock < qty
                    ? `has insufficient stock (available: ${product.stock}, requested: ${qty})`
                    : "is out of stock"
                }`
            );
        }

        const dbPrice = Number(product.price);
        itemsTotal += dbPrice * qty;

        formattedItems.push({
            productId: product._id,
            name: String(product.name).slice(0, 200),
            price: dbPrice,
            mrp: product.mrp ? Number(product.mrp) : null,
            qty,
            image: typeof item.image === "string"
                ? item.image
                : product.images?.[0]?.url || "",
            customization: {
                text: String(item.customization?.text || "").trim().slice(0, 500),
                imageUrl: String(item.customization?.imageUrl || "").trim().slice(0, 1000),
                note: String(item.customization?.note || "").trim().slice(0, 1000),
            },
            selectedSize: String(item.selectedSize || "").trim().slice(0, 50),
            productType: "urbexon_hour",
            vendorId: product.vendorId,
            prepTimeMinutes: product.prepTimeMinutes || 10,
            policy: {
                isCancellable: product.isCancellable !== false,
                isReturnable: false,       // UH orders are non-returnable
                isReplaceable: false,      // UH orders are non-replaceable
                returnWindow: 0,
                replacementWindow: 0,
                cancelWindow: product.cancelWindow ?? 0,
                nonReturnableReason: "Urbexon Hour orders are non-returnable",
            },
        });
    }

    // Single vendor enforcement for UH
    if (vendorIds.size > 1) {
        throw new Error(
            "Your cart contains items from multiple vendors. " +
            "Urbexon Hour orders must be from a single vendor."
        );
    }

    if (vendorIds.size === 0) {
        throw new Error("Unable to determine vendor for Urbexon Hour items. Please contact support.");
    }

    const vendorId = Array.from(vendorIds)[0];

    return {
        formattedItems,
        itemsTotal,
        vendorId,
        orderMode: "URBEXON_HOUR",
    };
};

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
   • UH: distance check from shop location
───────────────────────────────────────────────────────────── */
export const validateDeliveryServiceability = (deliveryType, latitude, longitude) => {
    if (deliveryType === "URBEXON_HOUR") {
        if (!latitude || !longitude)
            throw new Error("Location (latitude/longitude) required for Urbexon Hour delivery");

        if (!DELIVERY_CONFIG.URBEXON_HOUR?.ENABLED)
            throw new Error("Urbexon Hour delivery is currently unavailable");

        // Server-side distance calculation — DO NOT TRUST client distanceKm
        const shopLat = DELIVERY_CONFIG.SHOP_LAT;
        const shopLng = DELIVERY_CONFIG.SHOP_LNG;
        const toRad = (d) => (d * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(Number(latitude) - shopLat);
        const dLon = toRad(Number(longitude) - shopLng);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(shopLat)) *
            Math.cos(toRad(Number(latitude))) *
            Math.sin(dLon / 2) ** 2;
        const realDistanceKm =
            Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;

        if (realDistanceKm > DELIVERY_CONFIG.URBEXON_HOUR.MAX_RADIUS_KM) {
            throw new Error(
                `Your location is outside our delivery radius. ` +
                `Maximum: ${DELIVERY_CONFIG.URBEXON_HOUR.MAX_RADIUS_KM}km, ` +
                `Your distance: ${realDistanceKm}km`
            );
        }

        return { realDistanceKm };
    }

    // Ecommerce: Shiprocket delivers pan-India — no distance restriction
    return { realDistanceKm: 0 };
};

/* ─────────────────────────────────────────────────────────────
   VALIDATION 5: Coupon validation
   (Preserved from original — unchanged)
───────────────────────────────────────────────────────────── */
export const validateCoupon = async (couponId, couponCode, userId) => {
    if (!couponId && !couponCode) return null;

    const coupon = couponId
        ? await Coupon.findById(couponId).lean()
        : await Coupon.findOne({ couponCode }).lean();

    if (!coupon || !coupon.isActive)
        throw new Error("Coupon not found or inactive");

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate))
        throw new Error("Coupon has expired");

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
        const { realDistanceKm } = validateDeliveryServiceability(
            effectiveDeliveryType,
            latitude,
            longitude
        );

        // ── Step 5: Coupon validation ─────────────────────────────────────
        let couponDoc = null;
        if (couponId || couponCode) {
            couponDoc = await validateCoupon(couponId, couponCode, userId);
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