/**
 * settlementEngine.js — single source of truth for vendor settlement
 * creation on a DELIVERED Urbexon Hour order.
 *
 * Previously this exact calculation (commission % → commissionAmount →
 * vendorEarning, atomic $setOnInsert upsert keyed on the unique
 * Settlement.orderId index) was hand-duplicated in TWO places —
 * orderController.js's admin updateOrderStatus (looped over every vendor
 * found in the order) and vendorOrders.js's ensureVendorSettlement (scoped
 * to the one vendor marking their own order DELIVERED) — and was MISSING
 * entirely from deliveryController.js's markDelivered, meaning a
 * LOCAL_RIDER-delivered UH order never created a settlement at all, so
 * that vendor was never paid for it. Both existing call sites now call
 * into this module; markDelivered gets it for the first time.
 */
import Vendor from "../models/vendorModels/Vendor.js";
import Product from "../models/Product.js";
import { Settlement } from "../models/vendorModels/Settlement.js";

/**
 * Atomically create (at most once, per the unique orderId index) a
 * Settlement row for ONE vendor's share of an order, then credit the
 * vendor's running totals — but only on the insert that actually created
 * it, never on a duplicate call.
 */
export const settleVendorForOrder = async ({ order, vendorId, vendorProductIds }) => {
    const vendorProductIdSet = new Set((vendorProductIds || []).map(String));
    const vendorItems = (order.items || []).filter((item) => vendorProductIdSet.has(String(item.productId)));
    const orderAmount = vendorItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || item.quantity || 0)), 0);
    if (!orderAmount) return null;

    const vendor = await Vendor.findById(vendorId).select("commissionRate").lean();
    if (!vendor) return null;
    const commissionRate = vendor.commissionRate ?? 18;
    const commissionAmount = Math.round((orderAmount * commissionRate) / 100);
    const vendorEarning = Math.max(0, orderAmount - commissionAmount);

    const result = await Settlement.updateOne(
        { orderId: order._id }, // unique index on orderId — guarantees exactly one settlement per order
        {
            $setOnInsert: {
                vendorId,
                orderId: order._id,
                orderAmount,
                commissionRate,
                commissionAmount,
                deliveryCharge: order.deliveryCharge || 0,
                platformFee: order.platformFee || 0,
                vendorEarning,
                status: "pending",
            },
        },
        { upsert: true }
    );

    if (result.upsertedCount > 0) {
        await Vendor.findByIdAndUpdate(vendorId, {
            $inc: { pendingSettlement: vendorEarning, totalRevenue: orderAmount, totalOrders: 1 },
        }).catch(() => { });
        return { vendorId, orderAmount, commissionAmount, vendorEarning, created: true };
    }
    return { vendorId, created: false };
};

/**
 * Settle every vendor represented in a DELIVERED Urbexon Hour order's
 * items — safe to call from ANY delivery-completion path (admin
 * force-update, vendor self-delivery, or a rider's markDelivered) since
 * the underlying upsert is idempotent per vendor+order. Non-fatal: a
 * failure here should never block the delivery confirmation itself.
 */
export const settleAllVendorsForOrder = async (order) => {
    if (order.orderMode !== "URBEXON_HOUR") return [];
    try {
        const productIds = (order.items || []).map((i) => i.productId).filter(Boolean);
        if (!productIds.length) return [];
        const products = await Product.find({ _id: { $in: productIds } }).select("vendorId").lean();
        const vendorIds = [...new Set(products.map((p) => p.vendorId?.toString()).filter(Boolean))];

        const results = [];
        for (const vid of vendorIds) {
            const vendorProductIds = products.filter((p) => p.vendorId?.toString() === vid).map((p) => p._id);
            results.push(await settleVendorForOrder({ order, vendorId: vid, vendorProductIds }));
        }
        return results;
    } catch (err) {
        console.error("[settleAllVendorsForOrder] failed for order", order._id, err.message);
        return [];
    }
};
