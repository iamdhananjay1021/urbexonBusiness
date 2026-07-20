/**
 * DeliveryWalletTransaction.js — append-only ledger for delivery-rider
 * wallet transactions, mirroring vendorModels/VendorWalletTransaction.js's
 * shape (see that file's header comment for why: an unbounded embedded
 * array on one document per rider is the exact anti-pattern this was
 * designed to avoid).
 *
 * DeliveryWallet.transactions[] (the embedded array) is still written to
 * in parallel for backward compatibility with anything reading it
 * directly — this collection is the new source of truth for
 * deliveryWalletService.getTransactionHistory() going forward. A later,
 * deliberately-run backfill can migrate historical embedded entries here
 * and drop the embedded array once every reader is confirmed migrated.
 */
import mongoose from "mongoose";

const deliveryWalletTransactionSchema = new mongoose.Schema(
    {
        deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", required: true, index: true },
        type: {
            type: String,
            enum: ["credit", "debit", "bonus", "penalty"],
            required: true,
            index: true,
        },
        amount: { type: Number, required: true, min: 0.01 },
        balanceAfter: { type: Number, required: true },
        description: { type: String, default: "" },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
        referenceType: { type: String, enum: ["Order", "Settlement", null], default: null },
        referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    { timestamps: true }
);

deliveryWalletTransactionSchema.index({ deliveryBoyId: 1, createdAt: -1 });
deliveryWalletTransactionSchema.index({ deliveryBoyId: 1, type: 1 });
// Idempotency guard — same shape as VendorWalletTransaction's, so a given
// order can never be credited/debited to a rider's wallet twice.
deliveryWalletTransactionSchema.index(
    { referenceType: 1, referenceId: 1, type: 1 },
    { unique: true, partialFilterExpression: { referenceType: { $type: "string" }, referenceId: { $type: "objectId" } } }
);

export default mongoose.model("DeliveryWalletTransaction", deliveryWalletTransactionSchema);
