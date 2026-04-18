/**
 * pricing.js — Backend pricing utility v2.0
 * ✅ NEVER trusts frontend prices
 * ✅ Atomic stock deduction with findOneAndUpdate (race condition fix)
 * ✅ Coupon support wired in
 * ✅ Single function used by both COD + Online flows
 */
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
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
 * Atomic stock deduction using findOneAndUpdate + $inc
 * ✅ Prevents race condition / overselling
 */
export const deductStock = async (items) => {
    for (const item of items) {
        const updated = await Product.findOneAndUpdate(
            { _id: item.productId, stock: { $gte: item.qty } },
            { $inc: { stock: -item.qty } },
            { new: true }
        );
        if (!updated) {
            throw new Error(`"${item.name}" went out of stock during checkout`);
        }
        // Keep inStock flag in sync
        if (updated.stock === 0) {
            await Product.findByIdAndUpdate(item.productId, { inStock: false });
        }
    }
};

/**
 * Restore stock (on order cancel / payment failure)
 * Uses $inc for atomicity
 */
export const restoreStock = async (items) => {
    for (const item of items) {
        try {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: item.qty },
                inStock: true,
            });
        } catch (e) {
            console.warn("[StockRestore] Failed for", item.productId, e.message);
        }
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
 * Full pricing calculation with coupon support
 */
export const calculateOrderPricing = async (frontendItems, paymentMethod, options = {}) => {
    const { formattedItems, itemsTotal } = await validateAndPriceItems(frontendItems);
    const deliveryType = options.deliveryType || DELIVERY_TYPES.ECOMMERCE_STANDARD;
    const distanceKm = Number(options.distanceKm || 0);

    const deliveryCharge = calcDeliveryCharge(itemsTotal, paymentMethod, { deliveryType, distanceKm });

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
        distanceKm,
        deliveryETA: getDeliveryETA({ pincode: options.pincode, paymentMethod, deliveryType }),
        deliveryProvider: getDeliveryProvider({ deliveryType, distanceKm }),
    };
};
