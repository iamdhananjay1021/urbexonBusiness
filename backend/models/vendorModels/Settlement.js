import mongoose from "mongoose";

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTION PLAN MODEL
// ══════════════════════════════════════════════════════════════
const subscriptionPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            enum: ["starter", "basic", "standard", "premium"],
            unique: true,
            required: true,
        },
        displayName: { type: String, required: true },
        price: { type: Number, required: true },          // monthly ₹
        annualPrice: { type: Number, default: 0 },        // annual ₹
        commissionRate: { type: Number, required: true }, // % per order
        maxProducts: { type: Number, default: 50 },       // -1 = unlimited
        features: [{ type: String }],
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTION TRANSACTION MODEL
// ══════════════════════════════════════════════════════════════
const subscriptionTxSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true,
            index: true,
        },
        plan: {
            type: String,
            enum: ["starter", "basic", "standard", "premium"],
            required: true,
        },
        amount: { type: Number, required: true },
        billingCycle: {
            type: String,
            enum: ["monthly", "annual"],
            default: "monthly",
        },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        paymentMethod: { type: String, default: null },
        transactionId: { type: String, default: null },
        razorpayOrderId: { type: String, default: null },
        razorpayPaymentId: { type: String, default: null },
        status: {
            type: String,
            enum: ["pending", "paid", "failed", "refunded"],
            default: "pending",
            index: true,
        },
    },
    { timestamps: true }
);

// ══════════════════════════════════════════════════════════════
// SETTLEMENT (COMMISSION) MODEL
// ══════════════════════════════════════════════════════════════
const settlementSchema = new mongoose.Schema(
    {
        // ── References ────────────────────────────────────────
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true,
            index: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            unique: true, // one settlement per order
        },

        // ── Amounts ──────────────────────────────────────────
        orderAmount: { type: Number, required: true, min: 0 },
        commissionRate: { type: Number, required: true, min: 0, max: 100 },
        commissionAmount: { type: Number, required: true, min: 0 },
        deliveryCharge: { type: Number, default: 0 },
        platformFee: { type: Number, default: 0 },
        vendorEarning: { type: Number, required: true, min: 0 },

        // ── Status ───────────────────────────────────────────
        status: {
            type: String,
            enum: ["pending", "processing", "paid", "on_hold", "cancelled"],
            default: "pending",
            index: true,
        },

        // ── Payment Info ─────────────────────────────────────
        settlementDate: { type: Date, default: null },
        paymentRef: { type: String, default: null },
        paymentMethod: {
            type: String,
            enum: ["bank_transfer", "upi", "cheque", null],
            default: null,
        },
        batchId: { type: String, default: null, index: true },
        note: { type: String, default: null },
    },
    { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────
settlementSchema.index({ vendorId: 1, status: 1 });
settlementSchema.index({ batchId: 1, status: 1 });
settlementSchema.index({ createdAt: -1 });

// ── Virtual: net amount after all deductions ─────────────────
settlementSchema.virtual("netAmount").get(function () {
    return this.vendorEarning - (this.platformFee || 0);
});

export const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
export const SubscriptionTx = mongoose.model("SubscriptionTx", subscriptionTxSchema);
export const Settlement = mongoose.model("Settlement", settlementSchema);
