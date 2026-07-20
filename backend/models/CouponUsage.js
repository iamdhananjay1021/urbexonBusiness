/**
 * CouponUsage.js — durable, queryable coupon redemption ledger.
 *
 * Before this, coupon usage was tracked only two ways, both partial:
 * Coupon.usedBy[{userId,at}] (no order linkage, no discount amount, no
 * IP/device) and Order.coupon:{code,discount} (a snapshot only, no
 * couponId ref, no timestamp beyond the order's own createdAt). Neither
 * answers "who used coupon X, when, on which order, for how much" as a
 * query. This collection is that answer — one document per redemption,
 * written in the same atomic call as Coupon.usedBy (see
 * couponEngine.js::markCouponUsage) so the two can never silently diverge.
 * Coupon.usedBy stays as the fast atomic per-user-cap gate; this is the
 * durable audit/analytics record.
 */
import mongoose from "mongoose";

const couponUsageSchema = new mongoose.Schema(
    {
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
        code: { type: String, required: true, uppercase: true, trim: true }, // snapshot — survives coupon rename/deletion
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        // Populated only for module === "VENDOR_SUBSCRIPTION".
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
        // Nullable — subscription redemptions have no order. Sparse so the
        // index only covers documents that actually have one.
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
        subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", default: null },
        module: { type: String, enum: ["ORDER", "VENDOR_SUBSCRIPTION"], required: true },
        discountType: { type: String, enum: ["PERCENT", "FLAT", "FREE_SHIPPING"] }, // snapshot — coupon config can change after use
        discountAmount: { type: Number, required: true, min: 0 },
        orderTotal: { type: Number, required: true, min: 0 }, // pre-discount total, for Phase 2 revenue-impact analytics
        status: { type: String, enum: ["APPLIED", "REVERSED"], default: "APPLIED", index: true },
        reversedAt: { type: Date, default: null },
        ip: { type: String, default: "" },
        userAgent: { type: String, default: "" },
    },
    { timestamps: true }
);

couponUsageSchema.index({ orderId: 1 }, { sparse: true });
couponUsageSchema.index({ subscriptionId: 1 }, { sparse: true });
couponUsageSchema.index({ couponId: 1, createdAt: -1 });   // per-coupon history + admin list-view aggregate
couponUsageSchema.index({ couponId: 1, userId: 1 });        // per-user-per-coupon cross-check
couponUsageSchema.index({ userId: 1, createdAt: -1 });      // future "my coupon usage" customer feature
couponUsageSchema.index({ module: 1, createdAt: -1 });      // Phase 2 analytics segmentation

export default mongoose.model("CouponUsage", couponUsageSchema);
