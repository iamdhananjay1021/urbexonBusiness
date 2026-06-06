import mongoose from "mongoose";

/**
 * Enterprise Maker-Checker Approval Request Schema
 * Enforces dual-control over sensitive financial operations.
 */
const approvalRequestSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["REFUND", "VENDOR_PAYOUT", "WALLET_ADJUSTMENT", "MANUAL_BALANCE_CORRECTION", "HIGH_VALUE_CANCELLATION"],
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
        default: "PENDING",
        index: true
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: mongoose.Schema.Types.Mixed, required: true }, // OrderId, SettlementId, etc.
    amount: { type: Number },
    reason: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed }, // JSON payload required to execute the action upon approval

    // Reviewer Information
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNotes: { type: String },
    reviewedAt: { type: Date },
}, { timestamps: true });

approvalRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("ApprovalRequest", approvalRequestSchema);