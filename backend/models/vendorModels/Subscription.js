/**
 * Subscription.js
 * Monthly fee based model - no commission
 * Vendor pays flat monthly fee to list on Urbexon Hour
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
    monthlyFee: { type: Number, required: true },  // ₹ per month
    maxProducts: { type: Number, default: 50 },     // product listing limit

    status: {
        type: String,
        enum: ["active", "expired", "cancelled", "pending_payment"],
        default: "pending_payment",
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
        months: { type: Number, default: 1 },
    }],

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
