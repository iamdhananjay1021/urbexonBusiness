/**
 * Subscription.js
 * Monthly fee based model - no commission
 * Vendor pays flat monthly fee to list on Urbexon Hour
 *
 * States: inactive → pending → active → expired / cancelled
 * Activation ONLY via verified payment or admin manual override
 */
import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },

    plan: {
        type: String,
        enum: ["starter", "basic", "standard", "premium"],
        default: "basic",
    },

    // Plan details
    monthlyFee: { type: Number, required: true },
    maxProducts: { type: Number, default: 50 },

    status: {
        type: String,
        enum: ["inactive", "pending", "active", "expired", "cancelled", "pending_payment"],
        default: "inactive",
        index: true,
    },

    startDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null, index: true },
    lastPaymentDate: { type: Date, default: null },
    nextDueDate: { type: Date, default: null },

    // Payment history
    payments: [{
        amount: { type: Number },
        date: { type: Date, default: Date.now },
        method: { type: String, enum: ["razorpay", "manual", "free_trial"] },
        reference: { type: String },
        razorpayOrderId: { type: String, default: null },
        razorpayPaymentId: { type: String, default: null },
        months: { type: Number, default: 1 },
        status: { type: String, enum: ["success", "failed", "pending"], default: "pending" },
    }],

    // Pending Razorpay order (for in-progress payments)
    pendingPayment: {
        razorpayOrderId: { type: String, default: null },
        plan: { type: String, default: null },
        months: { type: Number, default: null },
        amount: { type: Number, default: null },
        createdAt: { type: Date, default: null },
        // Coupon Phase 1 — additive. couponId/couponCode/discountAmount are
        // only ever set when a vendor applied a coupon at checkout
        // (createSubscriptionOrder); amount above is already net of the
        // discount (see vendorSubscriptionPayment.js), these three fields
        // just carry the coupon reference through to the post-payment
        // markCouponUsage() call in verifySubscriptionPayment.
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
        couponCode: { type: String, default: null },
        discountAmount: { type: Number, default: 0 },
        discountType: { type: String, default: null },
    },

    // Plan change request (vendor self-service)
    requestedPlan: { type: String, enum: ["starter", "basic", "standard", "premium", null], default: null },
    planChangeRequestedAt: { type: Date, default: null },
    planChangeNote: { type: String, maxlength: 300, default: "" },

    // One-shot guard for the "expiring soon" reminder job — same pattern as
    // Ticket.slaReminderSentAt. Reset to null on every successful
    // activation/renewal (admin manual or self-serve Razorpay) so the next
    // expiry cycle can remind again.
    expiryReminderSentAt: { type: Date, default: null },

    // Trial
    isTrialActive: { type: Boolean, default: false },
    trialEndsAt: { type: Date, default: null },

}, { timestamps: true });

// Plan pricing config
subscriptionSchema.statics.PLANS = {
    starter: { monthlyFee: 0, maxProducts: 10, label: "Starter" },
    basic: { monthlyFee: 499, maxProducts: 30, label: "Basic" },
    standard: { monthlyFee: 999, maxProducts: 100, label: "Standard" },
    premium: { monthlyFee: 1999, maxProducts: 500, label: "Premium" },
};

subscriptionSchema.virtual("isActive").get(function () {
    return this.status === "active" && this.expiryDate > new Date();
});

subscriptionSchema.index({ vendorId: 1 });
subscriptionSchema.index({ status: 1, expiryDate: 1 });

export default mongoose.model("Subscription", subscriptionSchema);
