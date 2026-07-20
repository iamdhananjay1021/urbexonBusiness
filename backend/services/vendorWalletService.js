/**
 * vendorWalletService.js — the ONLY place allowed to write to
 * VendorWalletTransaction or mutate Vendor.walletBalance.
 *
 * Mirrors this codebase's one proven pattern for "single owning engine
 * for a money-moving concern" (refundEngine.js is the same idea for
 * Razorpay refunds) — every caller (settlementManager.js,
 * payoutController.js, walletAdjustmentController.js) goes through this
 * file, never touches the ledger collection or the balance field itself.
 *
 * credit()/debit() are SESSION-BOUND PRIMITIVES — they take an
 * already-open mongoose session from the caller and participate in it;
 * they never start their own. This is deliberate: markSettlementPaid/
 * markBatchPaid/adminCompletePayout already own a transaction boundary
 * for their own status-transition writes, and the instruction is
 * explicit — "Never create another transaction boundary." credit()/
 * debit() extend the caller's existing session instead of opening a
 * second one.
 *
 * manualAdjustment() is the one exception — it IS an entry point (called
 * fresh from an admin HTTP request, not nested inside another
 * transaction), so it owns and manages its own session internally,
 * exactly like markSettlementPaid does today.
 */
import mongoose from "mongoose";
import Vendor from "../models/vendorModels/Vendor.js";
import VendorWalletTransaction from "../models/vendorModels/VendorWalletTransaction.js";
import ApprovalRequest from "../models/ApprovalRequest.js";

/**
 * Insert one ledger row + atomically $inc Vendor.walletBalance, both
 * inside the caller's session. Shared by credit()/debit() — direction is
 * the only difference (positive vs. negative $inc), everything else
 * (idempotency, balanceAfter snapshot, atomicity) is identical.
 */
const writeLedgerEntry = async ({ vendorId, type, amount, direction, referenceType, referenceId, description, createdBy, session, reversalOf = null }) => {
    const delta = direction === "debit" ? -Math.abs(amount) : Math.abs(amount);

    // For a debit, the balance floor must be enforced atomically in the
    // SAME operation as the deduction — checking first and writing second
    // would leave a race window between the two. $expr lets the filter
    // reference the document's own current field value.
    const updateFilter = { _id: vendorId };
    if (direction === "debit") {
        updateFilter.$expr = { $gte: [{ $add: ["$walletBalance", delta] }, 0] };
    }

    const updatedVendor = await Vendor.findOneAndUpdate(
        updateFilter,
        { $inc: { walletBalance: delta } },
        { new: true, session }
    );

    if (!updatedVendor) {
        // Debit path: the vendor exists but the $expr balance-floor guard
        // failed to match — insufficient balance. Credit path: the
        // vendorId itself doesn't resolve to a real Vendor document —
        // distinct failure, distinct code, so callers don't misreport a
        // missing vendor as an insufficient-balance error.
        if (direction === "debit") {
            const err = new Error("Insufficient wallet balance for this debit");
            err.code = "INSUFFICIENT_BALANCE";
            throw err;
        }
        const err = new Error("Vendor not found");
        err.code = "VENDOR_NOT_FOUND";
        throw err;
    }

    // Idempotency: the unique {referenceType, referenceId, type} partial
    // index is the actual guard — a duplicate insert throws E11000, which
    // is allowed to propagate and abort the whole transaction (session
    // writes error out together; a duplicate-credit attempt reaching this
    // point at all means something upstream is already inconsistent and
    // deserves a loud failure, not a silent swallow).
    const [entry] = await VendorWalletTransaction.create(
        [{
            vendorId,
            type,
            amount: Math.abs(amount),
            balanceAfter: updatedVendor.walletBalance,
            referenceType: referenceType || null,
            referenceId: referenceId || null,
            description: description || "",
            createdBy: createdBy || null,
            reversalOf,
        }],
        { session }
    );

    return { entry, walletBalance: updatedVendor.walletBalance };
};

/**
 * credit(session, params) — Settlement-paid / manual-credit path.
 * params: { vendorId, amount, type ("settlement_credit"|"manual_credit"|"opening_balance"),
 *           referenceType, referenceId, description, createdBy }
 */
export const credit = (session, { vendorId, amount, type = "manual_credit", referenceType, referenceId, description, createdBy }) =>
    writeLedgerEntry({ vendorId, type, amount, direction: "credit", referenceType, referenceId, description, createdBy, session });

/**
 * debit(session, params) — Payout-completed / manual-debit path.
 * Same shape as credit(), direction inverted, balance floor enforced.
 */
export const debit = (session, { vendorId, amount, type = "manual_debit", referenceType, referenceId, description, createdBy }) =>
    writeLedgerEntry({ vendorId, type, amount, direction: "debit", referenceType, referenceId, description, createdBy, session });

/**
 * manualAdjustment({ approvalRequestId, approvedBy }) — the ONLY path
 * that turns an approved WALLET_ADJUSTMENT ApprovalRequest into an actual
 * ledger entry. Owns its own session (this is an entry point, not a
 * nested call). Enforces maker-checker (approver != requester) and the
 * PENDING→APPROVED atomic claim before ever touching money.
 */
export const manualAdjustment = async ({ approvalRequestId, approvedBy }) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const pending = await ApprovalRequest.findOne({ _id: approvalRequestId }).session(session);
        if (!pending) throw Object.assign(new Error("Adjustment request not found"), { code: "NOT_FOUND" });
        if (pending.type !== "WALLET_ADJUSTMENT") throw Object.assign(new Error("Not a wallet adjustment request"), { code: "WRONG_TYPE" });
        if (pending.status !== "PENDING") throw Object.assign(new Error(`Request already ${pending.status.toLowerCase()}`), { code: "ALREADY_DECIDED" });

        // MAKER-CHECKER: requester cannot approve their own adjustment.
        if (String(pending.requestedBy) === String(approvedBy)) {
            throw Object.assign(new Error("The admin who requested this adjustment cannot approve it"), { code: "SELF_APPROVAL_BLOCKED" });
        }

        const direction = pending.payload?.direction === "debit" ? "debit" : "credit";
        const vendorId = pending.targetId;

        // Atomic claim — PENDING→APPROVED — prevents two concurrent
        // approve clicks from both writing a ledger entry for the same request.
        const claimed = await ApprovalRequest.findOneAndUpdate(
            { _id: approvalRequestId, status: "PENDING" },
            { $set: { status: "APPROVED", reviewedBy: approvedBy, reviewedAt: new Date() } },
            { new: true, session }
        );
        if (!claimed) throw Object.assign(new Error("Request was already decided by another admin"), { code: "ALREADY_DECIDED" });

        const { entry, walletBalance } = await writeLedgerEntry({
            vendorId,
            type: direction === "debit" ? "manual_debit" : "manual_credit",
            amount: pending.amount,
            direction,
            referenceType: "ApprovalRequest",
            referenceId: claimed._id,
            description: pending.reason,
            createdBy: approvedBy,
            session,
        });

        await session.commitTransaction();
        session.endSession();
        return { entry, walletBalance, approvalRequest: claimed };
    } catch (err) {
        await session.abortTransaction().catch(() => { });
        session.endSession();
        throw err;
    }
};

/** getBalance(vendorId) — direct field read, NEVER an aggregation. */
export const getBalance = async (vendorId) => {
    const vendor = await Vendor.findById(vendorId).select("walletBalance").lean();
    return vendor?.walletBalance ?? 0;
};

/**
 * getHistory(vendorId, filters) — paginated, filterable ledger read.
 * filters: { type, dateFrom, dateTo, page, limit }
 */
export const getHistory = async (vendorId, { type, dateFrom, dateTo, page = 1, limit = 20 } = {}) => {
    const filter = { vendorId };
    if (type) filter.type = type;
    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);

    const [transactions, total] = await Promise.all([
        VendorWalletTransaction.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        VendorWalletTransaction.countDocuments(filter),
    ]);

    return { transactions, total, page: pageNum, totalPages: Math.ceil(total / limitNum) };
};

/** getSummary(vendorId) — informational lifetime totals, NOT the balance itself (that's getBalance). */
export const getSummary = async (vendorId) => {
    const [agg] = await VendorWalletTransaction.aggregate([
        { $match: { vendorId: new mongoose.Types.ObjectId(String(vendorId)) } },
        {
            $group: {
                _id: null,
                totalCredited: { $sum: { $cond: [{ $in: ["$type", ["settlement_credit", "manual_credit", "opening_balance"]] }, "$amount", 0] } },
                totalDebited: { $sum: { $cond: [{ $in: ["$type", ["withdrawal_debit", "manual_debit", "refund_adjustment", "chargeback"]] }, "$amount", 0] } },
                count: { $sum: 1 },
            },
        },
    ]);
    return {
        totalCredited: agg?.totalCredited || 0,
        totalDebited: agg?.totalDebited || 0,
        transactionCount: agg?.count || 0,
    };
};
