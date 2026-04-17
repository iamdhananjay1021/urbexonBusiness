/**
 * Coupon.js — Coupon / Promo code model
 */
import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, "Code is required"],
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: 30,
        index: true,
    },
    description: { type: String, trim: true, default: "" },
    discountType: {
        type: String,
        enum: ["PERCENT", "FLAT"],
        default: "PERCENT",
    },
    discountValue: { type: Number, required: true, min: 0, max: [100000, "Discount value too high"] },
    maxDiscount: { type: Number, default: null },     // cap for PERCENT type
    minOrderValue: { type: Number, default: 0 },
    usageLimit: { type: Number, default: null },     // null = unlimited
    usedCount: { type: Number, default: 0 },
    usedBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
    }],
    applicableTo: {
        type: String,
        enum: ["ALL", "ECOMMERCE", "URBEXON_HOUR"],
        default: "ALL",
    },
    isActive: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

couponSchema.index({ code: 1, isActive: 1 });

export default mongoose.model("Coupon", couponSchema);
