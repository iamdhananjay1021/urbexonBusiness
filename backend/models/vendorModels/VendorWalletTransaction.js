/**
 * VendorWalletTransaction.js — the Vendor Wallet Ledger.
 *
 * Immutable Ledger + Calculated Balance (approved design, Step 3). A
 * SEPARATE collection — never embedded on Vendor — deliberately avoiding
 * DeliveryWallet.js's embedded-array pattern (BSON-bloat risk, same class
 * of problem Coupon.usedBy's own doc-comment already reasoned about and
 * avoided elsewhere in this codebase). Mirrors CouponUsage.js's proven
 * separate-ledger-collection shape instead.
 *
 * Append-only: no controller anywhere issues an update or delete against
 * this collection. A wrong entry is corrected by writing a new, opposite
 * -direction entry that references it via `reversalOf` — never by
 * mutating or removing the original.
 *
 * Every field here is written ONLY from services/vendorWalletService.js —
 * that is the single place allowed to create a document in this
 * collection. No controller writes here directly (see that file's
 * doc-comment).
 */
import mongoose from "mongoose";

const vendorWalletTransactionSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },

        // Direction is carried entirely by `type` — amount is always
        // positive. Avoids the signed-amount sign-convention bug class.
        type: {
            type: String,
            enum: [
                "opening_balance",     // One-time backfill script only — pre-ledger historical balance
                "settlement_credit",   // Settlement → paid (settlementManager.js)
                "withdrawal_debit",    // Payout → completed (payoutController.js)
                "manual_credit",       // Approved ApprovalRequest(WALLET_ADJUSTMENT), direction:"credit"
                "manual_debit",        // Approved ApprovalRequest(WALLET_ADJUSTMENT), direction:"debit"
                "refund_adjustment",   // Reserved — trigger belongs to the Vendor Returns & Refund
                                       // Dashboard module (not wired here; see approved design Step 2)
                "chargeback",          // Reserved — no payment-gateway dispute webhook exists yet
            ],
            required: true,
            index: true,
        },

        amount: { type: Number, required: true, min: 0.01 },

        // Vendor.walletBalance snapshotted immediately AFTER this entry,
        // written in the same transaction — read-optimization so history
        // UI never has to re-sum anything to show a running balance.
        balanceAfter: { type: Number, required: true },

        // Polymorphic reference — same loosely-typed convention already
        // used by ApprovalRequest.targetId, not a new ref style.
        referenceType: { type: String, enum: ["Settlement", "Payout", "ApprovalRequest", null], default: null },
        referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },

        description: { type: String, trim: true, maxlength: 300, default: "" },

        // null for system-triggered entries (settlement_credit,
        // withdrawal_debit); set to the approving admin's User id for
        // manual_credit/manual_debit.
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

        // Self-reference — set on a reversal entry, pointing at the
        // original entry it corrects. Never set on the original itself.
        reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "VendorWalletTransaction", default: null },
    },
    { timestamps: true }
);

// History reads: vendor's transactions, most recent first — no in-memory sort.
vendorWalletTransactionSchema.index({ vendorId: 1, createdAt: -1 });
// Type-filtered analytics/history reads.
vendorWalletTransactionSchema.index({ vendorId: 1, type: 1 });
// IDEMPOTENCY GUARD — the actual mechanism preventing a duplicate credit/
// debit for the same source event. Partial (not plain unique) because
// MongoDB treats explicit nulls as a real value for uniqueness purposes;
// a future reference-less entry (if one is ever legitimately needed) must
// not collide with another reference-less entry.
vendorWalletTransactionSchema.index(
    { referenceType: 1, referenceId: 1, type: 1 },
    { unique: true, partialFilterExpression: { referenceType: { $type: "string" }, referenceId: { $type: "objectId" } } }
);

export default mongoose.model("VendorWalletTransaction", vendorWalletTransactionSchema);
