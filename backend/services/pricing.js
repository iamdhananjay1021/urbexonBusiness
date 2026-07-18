/**
 * pricing.js — Backend pricing utility v2.1
 * ✅ NEVER trusts frontend prices
 * ✅ Atomic stock deduction with findOneAndUpdate (race condition fix)
 * ✅ Coupon support wired in
 * ✅ Single function used by both COD + Online flows
 * ✅ [FIX-D1] distanceKm null-safe: distinguishes "unknown distance" (null)
 *    from "actual zero-distance" (0). Charge/provider calculations still
 *    get a safe numeric fallback (0) so pricing logic never breaks, but
 *    the returned `distanceKm` for storage/display stays `null` when the
 *    distance genuinely wasn't known — this is what fixes "Distance —"
 *    incorrectly showing for orders where distance actually WAS known
 *    downstream, and stops fake "0km" from masking real unknowns.
 */
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import Vendor from "../models/vendorModels/Vendor.js";
import {
    calcDeliveryCharge,
    calcFinalAmount,
    DELIVERY_CONFIG,
    DELIVERY_TYPES,
    getDeliveryETA,
    getDeliveryProvider,
} from "../config/deliveryConfig.js";

/** Validate and price cart items from DB */
export const validateAndPriceItems = async (frontendItems) => {
    if (!Array.isArray(frontendItems) || frontendItems.length === 0)
        throw new Error("Cart is empty");
    if (frontendItems.length > 20)
        throw new Error("Too many items in cart (max 20)");

    const formattedItems = [];
    let itemsTotal = 0;

    for (const item of frontendItems) {
        const productId = item.productId || item._id;
        if (!productId) throw new Error("Invalid product in cart");

        const product = await Product.findById(productId)
            .select("name price mrp inStock stock images productType vendorId isCancellable isReturnable isReplaceable returnWindow replacementWindow cancelWindow nonReturnableReason")
            .lean();

        if (!product) throw new Error(`Product not found: ${productId}`);

        const qty = Math.min(Math.max(1, Number(item.qty || item.quantity || 1)), 100);

        if (!product.inStock || product.stock < qty)
            throw new Error(`"${product.name}" is out of stock`);

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
            productType: product.productType,
            vendorId: product.vendorId || null,
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

    return { formattedItems, itemsTotal };
};

/**
 * Restore stock (on order cancel / payment failure)
 * Uses $inc for atomicity
 */
export const restoreStock = async (items) => {
    for (const item of items) {
        const qty = Number(item.qty || item.quantity || 0);
        if (!item.productId || !Number.isFinite(qty) || qty <= 0) continue;
        try {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: qty },
                $set: { inStock: true },
            });

            // Mirror the restore onto the exact variant / size entry that was
            // deducted, so per-variant availability stays truthful. Best-effort:
            // legacy orders without selectedColor/selectedSize just restore base.
            if (item.selectedColor) {
                await Product.updateOne(
                    { _id: item.productId, "colorVariants.name": item.selectedColor },
                    { $inc: { "colorVariants.$.stock": qty } }
                ).catch(() => { });
            }
            if (item.selectedSize) {
                await Product.updateOne(
                    { _id: item.productId, "sizes.size": item.selectedSize },
                    { $inc: { "sizes.$.stock": qty } }
                ).catch(() => { });
            }
        } catch (e) {
            console.warn("[StockRestore] Failed for", item.productId, e.message);
        }
    }
};

/**
 * Atomic stock deduction using findOneAndUpdate + $inc
 * Prevents overselling. Rolls back partial deductions on failure.
 */
export const deductStock = async (items) => {
    const deducted = [];
    try {
        for (const item of items) {
            const qty = Number(item.qty || item.quantity || 0);
            if (!item.productId || !Number.isFinite(qty) || qty <= 0) continue;

            // Base stock is the atomic oversell guard.
            const updated = await Product.findOneAndUpdate(
                { _id: item.productId, stock: { $gte: qty } },
                { $inc: { stock: -qty } },
                { new: true }
            );
            if (!updated) {
                throw new Error(`"${item.name}" went out of stock during checkout`);
            }

            // Track WITH the variant selection so a rollback/cancel restores
            // the same variant/size entry it came from.
            deducted.push({
                productId: item.productId, qty,
                selectedColor: item.selectedColor || "",
                selectedSize: item.selectedSize || "",
            });

            // ── Variant/size-level deduction ─────────────────────────────
            // BUG FIX: previously ONLY base stock was decremented. Variant and
            // size stocks never fell, so (a) checkout's per-variant stock
            // check kept passing forever → per-variant oversell, and (b) the
            // Product pre-save hook recalculates base stock from variant sums
            // on any .save(), silently UNDOING every base deduction.
            // Guarded $gte so a drifted/unmaintained entry never goes negative
            // (base guard above already blocked a true oversell).
            if (item.selectedColor) {
                await Product.updateOne(
                    { _id: item.productId, colorVariants: { $elemMatch: { name: item.selectedColor, stock: { $gte: qty } } } },
                    { $inc: { "colorVariants.$.stock": -qty } }
                ).catch(() => { });
            }
            if (item.selectedSize) {
                await Product.updateOne(
                    { _id: item.productId, sizes: { $elemMatch: { size: item.selectedSize, stock: { $gte: qty } } } },
                    { $inc: { "sizes.$.stock": -qty } }
                ).catch(() => { });
            }

            // Keep inStock flag in sync
            if (updated.stock === 0) {
                await Product.findByIdAndUpdate(item.productId, { inStock: false });
            }
        }
    } catch (err) {
        // Roll back any partial deductions to keep inventory consistent.
        await restoreStock(deducted);
        throw err;
    }
};

/**
 * Validate and apply coupon
 * Returns { discount, couponCode, couponId } or null
 */
export const applyCoupon = async ({ couponId, couponCode, userId, itemsTotal, orderType }) => {
    if (!couponId && !couponCode) return null;

    const query = couponId
        ? { _id: couponId, isActive: true }
        : { code: String(couponCode).toUpperCase(), isActive: true };

    const coupon = await Coupon.findOne(query).lean();
    if (!coupon) return null;

    // Expiry check
    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) return null;

    // Usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return null;

    // Per-user usage
    if (userId && coupon.usedBy?.some(u => String(u.userId) === String(userId))) return null;

    // Min order check
    if (itemsTotal < (coupon.minOrderValue || 0)) return null;

    // Applicable to check
    if (coupon.applicableTo !== "ALL") {
        const type = orderType === "urbexon_hour" ? "URBEXON_HOUR" : "ECOMMERCE";
        if (coupon.applicableTo !== type) return null;
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "PERCENT") {
        discount = Math.round((itemsTotal * coupon.discountValue) / 100);
        if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else {
        discount = Math.min(coupon.discountValue, itemsTotal);
    }

    return { discount, couponCode: coupon.code, couponId: coupon._id };
};

/**
 * Mark coupon as used by userId
 */
export const markCouponUsed = async (couponId, userId) => {
    if (!couponId || !userId) return;
    // Atomic: only increment if usage limit not yet reached AND user hasn't used it
    const result = await Coupon.findOneAndUpdate(
        {
            _id: couponId,
            $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
            "usedBy.userId": { $ne: userId },
        },
        {
            $inc: { usedCount: 1 },
            $push: { usedBy: { userId, at: new Date() } },
        },
        { new: true }
    );
    if (!result) console.warn(`[CouponUsed] Could not mark coupon ${couponId} as used for user ${userId}`);
};

/**
 * Rollback a coupon's usage on order cancellation. No counterpart to this
 * existed anywhere in the codebase before — a cancelled order permanently
 * burned the customer's one-time coupon use and the coupon's global
 * usedCount. Atomic and safe to call even if the coupon was never actually
 * marked used for this user (no-op in that case).
 */
export const unmarkCouponUsed = async ({ couponId, couponCode, userId }) => {
    if (!userId || (!couponId && !couponCode)) return;
    // Order.coupon only stores the code snapshot, not the coupon's _id, so
    // this accepts either — most callers (cancellation) only have the code.
    const filter = couponId
        ? { _id: couponId, "usedBy.userId": userId }
        : { code: String(couponCode).toUpperCase(), "usedBy.userId": userId };
    const result = await Coupon.findOneAndUpdate(
        filter,
        { $inc: { usedCount: -1 }, $pull: { usedBy: { userId } } }
    );
    if (!result) console.warn(`[CouponUsed] Could not unmark coupon ${couponId || couponCode} for user ${userId} (not found or already unmarked)`);
};

/**
 * [FIX-D1] Normalize an incoming distanceKm value.
 * Returns:
 *   - `known`: the real, storable distance value → Number or null (null = genuinely unknown)
 *   - `forCalc`: a safe Number ALWAYS usable for charge/provider math (defaults to 0
 *      when unknown, so downstream numeric logic never breaks or throws)
 */
const resolveDistanceKm = (rawDistanceKm) => {
    if (rawDistanceKm === null || rawDistanceKm === undefined || rawDistanceKm === "") {
        return { known: null, forCalc: 0 };
    }
    const n = Number(rawDistanceKm);
    if (!Number.isFinite(n)) {
        return { known: null, forCalc: 0 };
    }
    return { known: n, forCalc: n };
};

/**
 * Full pricing calculation with coupon support
 */
export const calculateOrderPricing = async (frontendItems, paymentMethod, options = {}) => {
    const { formattedItems, itemsTotal } = await validateAndPriceItems(frontendItems);
    const deliveryType = options.deliveryType || DELIVERY_TYPES.ECOMMERCE_STANDARD;

    // [FIX-D1] known = what we store/display (null when genuinely unknown)
    //          forCalc = safe number for charge/provider math
    const { known: distanceKm, forCalc: distanceKmForCalc } = resolveDistanceKm(options.distanceKm);

    // Fetch the vendor ONCE — reused for charge override, ETA (prep time +
    // delivery mode), and provider routing, instead of three separate
    // queries for the same document across this function. Fetched fresh
    // on every order (not cached) so a vendor flipping delivery-mode/prep
    // time/charge overrides takes effect immediately on their next order.
    let vendor = null;
    if (deliveryType === DELIVERY_TYPES.URBEXON_HOUR && options.vendorId) {
        vendor = await Vendor.findById(options.vendorId)
            .select("deliveryMode preparationTime deliveryChargePerKm freeDeliveryAbove")
            .lean();
    }
    const vendorDeliveryMode = vendor?.deliveryMode;

    const deliveryCharge = calcDeliveryCharge(itemsTotal, paymentMethod, { deliveryType, distanceKm: distanceKmForCalc, vendor });

    // Coupon
    const orderType = deliveryType === DELIVERY_TYPES.URBEXON_HOUR ? "urbexon_hour" : "ecommerce";
    const couponResult = await applyCoupon({
        couponId: options.couponId,
        couponCode: options.couponCode,
        userId: options.userId,
        itemsTotal,
        orderType,
    });

    const couponDiscount = couponResult?.discount || 0;
    const finalTotal = Math.max(0, calcFinalAmount(itemsTotal, deliveryCharge) - couponDiscount);

    return {
        formattedItems,
        itemsTotal,
        deliveryCharge,
        platformFee: DELIVERY_CONFIG.PLATFORM_FEE,
        couponDiscount,
        coupon: couponResult,
        finalTotal,
        deliveryType,
        // distanceKm: Number when actually known, null when genuinely unknown.
        // Callers (orderController.js → Order model → frontend) must treat
        // null distinctly from 0 for correct "—" vs "0.0 km" rendering.
        distanceKm,
        // distanceKm (the nullable "known" value, not distanceKmForCalc) so
        // an order with genuinely-unknown distance keeps the static ETA
        // text instead of computing an ETA against a fake 0km.
        deliveryETA: getDeliveryETA({
            deliveryType,
            distanceKm,
            preparationTimeMin: vendor?.preparationTime,
            vendorDeliveryMode,
        }),
        deliveryProvider: getDeliveryProvider({ deliveryType, distanceKm: distanceKmForCalc, vendorDeliveryMode }),
    };
};