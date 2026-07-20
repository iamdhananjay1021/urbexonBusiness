/**
 * payoutController.js — Unified payout management
 * Handles: vendor payouts, delivery payouts, admin payout management
 */
import mongoose from "mongoose";
import Payout from "../../models/Payout.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import { notify } from "../../services/notificationEngine.js";
import * as walletService from "../../services/vendorWalletService.js";
import { maskBankDetails } from "../../utils/maskBankDetails.js";

/**
 * NOTIFICATION GAP FIX: payout.recipientId is the Vendor/DeliveryBoy
 * document _id (see recipientModel), not the linked User id that
 * notificationEngine.notify() needs as recipientId — resolve it once here.
 * Role-generic on purpose, exactly like notify() itself, so this single
 * helper serves both recipientType values without forking logic.
 */
const notifyPayoutRecipient = async (payout, { title, message, meta = {} }) => {
    try {
        const Model = payout.recipientType === "delivery" ? DeliveryBoy : Vendor;
        const doc = await Model.findById(payout.recipientId).select("userId").lean();
        if (!doc?.userId) return;
        await notify({
            recipientId: doc.userId,
            role: payout.recipientType,
            type: "payout_update",
            title,
            message,
            priority: "high",
            meta: { payoutId: String(payout._id), ...meta },
        });
    } catch (err) {
        console.error("[notifyPayoutRecipient] Failed:", err.message);
    }
};

const MIN_PAYOUT_VENDOR = 500;
const MIN_PAYOUT_DELIVERY = 200;

// ══════════════════════════════════════════════════════════════
// VENDOR — Request Payout
// POST /api/vendor/payouts/request
// ══════════════════════════════════════════════════════════════
export const vendorRequestPayout = async (req, res) => {
    try {
        const vendor = req.vendor;
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const { amount } = req.body;
        const requestedAmount = Number(amount);
        if (!requestedAmount || requestedAmount < MIN_PAYOUT_VENDOR) {
            return res.status(400).json({ success: false, message: `Minimum payout is ₹${MIN_PAYOUT_VENDOR}` });
        }

        // Check bank details early (before expensive aggregations)
        const bd = vendor.bankDetails || {};
        if (!bd.accountNumber && !bd.upiId) {
            return res.status(400).json({ success: false, message: "Please add bank details or UPI ID first" });
        }
        // Only validate IFSC format if account number is provided AND IFSC is provided
        if (bd.accountNumber && bd.ifsc) {
            const ifscCode = bd.ifsc?.trim()?.toUpperCase();

            // Check if user used letter O instead of zero
            if (ifscCode.includes("O") && ifscCode.length === 11) {
                const corrected = ifscCode.replace(/O/g, "0");
                if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(corrected)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid IFSC: contains letter "O" instead of digit "0". Did you mean: ${corrected}?`
                    });
                }
            }

            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid IFSC format. Must be: 4 letters + 0 (zero) + 6 characters. Example: SBIN0001234"
                });
            }
        }
        // If account number is provided but IFSC is missing, warn (but don't block)
        if (bd.accountNumber && !bd.ifsc) {
            console.warn(`[vendorRequestPayout] Vendor ${vendor._id} has account number but no IFSC code`);
        }

        // Fast, friendly pre-check — the REAL, race-proof guard is the
        // unique partial index on Payout{recipientId, recipientType,
        // blocksNewPayout:true} (see models/Payout.js); this just avoids a
        // wasted balance calculation and gives a clean message in the
        // common (non-racing) case.
        const alreadyPending = await Payout.findOne({
            recipientId: vendor._id,
            recipientType: "vendor",
            status: { $in: ["requested", "approved", "processing"] },
        }).lean();
        if (alreadyPending) {
            return res.status(409).json({ success: false, message: "You already have a pending payout request. Wait for it to be processed or cancel it." });
        }

        // [FIX] "Available" was previously re-derived from Settlement.paid
        // minus completed Payouts — a parallel calculation that completely
        // ignored admin manual wallet adjustments (walletAdjustmentController.js
        // credits/debits the ledger directly, with no corresponding
        // Settlement/Payout record). A vendor manually credited as
        // compensation could never withdraw it; conversely a manual debit
        // (correction/penalty) wasn't reflected either, risking an
        // overpayment beyond their real balance. Vendor.walletBalance
        // (via getBalance — a direct field read, never an aggregation) is
        // the single source of truth for spendable balance; it already
        // nets out settlement credits, completed-payout debits, AND manual
        // adjustments atomically. Only the still-pending-payout amount
        // needs subtracting on top of it.
        const [walletBalance, pendingPayouts] = await Promise.all([
            walletService.getBalance(vendor._id),
            Payout.aggregate([
                { $match: { recipientId: vendor._id, recipientType: "vendor", status: { $in: ["requested", "approved", "processing"] } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
        ]);

        const totalPending = pendingPayouts[0]?.total || 0;
        const available = walletBalance - totalPending;

        if (requestedAmount > available) {
            return res.status(400).json({ success: false, message: `Insufficient balance. Available: ₹${available}` });
        }

        // [FIX] The previous "atomic recheck" (a plain findOneAndUpdate
        // read with upsert:false right before .create()) still had a
        // TOCTOU race — two near-simultaneous requests could both observe
        // "no pending payout" and both insert. The unique partial index on
        // Payout (recipientId, recipientType, blocksNewPayout:true) is the
        // actual DB-level guard now; a genuine race surfaces as E11000
        // here, caught below.
        let newPayout;
        try {
            newPayout = await Payout.create({
                recipientType: "vendor",
                recipientId: vendor._id,
                recipientModel: "Vendor",
                recipientName: vendor.shopName || vendor.ownerName,
                amount: requestedAmount,
                bankDetails: {
                    accountHolder: bd.accountHolder || "",
                    accountNumber: bd.accountNumber || "",
                    ifsc: bd.ifsc || "",
                    bankName: bd.bankName || "",
                    upiId: bd.upiId || "",
                },
            });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({ success: false, message: "You already have a pending payout request. Wait for it to be processed or cancel it." });
            }
            throw err;
        }

        res.json({ success: true, message: "Payout requested", payout: { ...newPayout.toObject(), bankDetails: maskBankDetails(newPayout.bankDetails) } });
    } catch (err) {
        console.error("[vendorRequestPayout]", err);
        res.status(500).json({ success: false, message: "Failed to request payout" });
    }
};

// ══════════════════════════════════════════════════════════════
// VENDOR — Cancel own payout (only if still "requested")
// PATCH /api/vendor/payouts/:id/cancel
// ══════════════════════════════════════════════════════════════
export const vendorCancelPayout = async (req, res) => {
    try {
        const vendor = req.vendor;
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });

        // Only the owner can cancel their own payout
        if (payout.recipientId.toString() !== vendor._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        if (payout.status !== "requested") {
            return res.status(400).json({ success: false, message: `Cannot cancel — payout is already ${payout.status}` });
        }

        await Payout.findByIdAndUpdate(payout._id, {
            $set: { status: "rejected", rejectedAt: new Date(), rejectionReason: "Cancelled by vendor", blocksNewPayout: false },
        });

        res.json({ success: true, message: "Payout cancelled" });
    } catch (err) {
        console.error("[vendorCancelPayout]", err);
        res.status(500).json({ success: false, message: "Failed to cancel payout" });
    }
};

// ══════════════════════════════════════════════════════════════
// VENDOR — Get my payouts + balance
// GET /api/vendor/payouts
// ══════════════════════════════════════════════════════════════
export const vendorGetPayouts = async (req, res) => {
    try {
        const vendor = req.vendor;

        // [FIX] See the matching note in vendorRequestPayout — "available"
        // must come from the real wallet balance (settlement credits +
        // completed-payout debits + manual adjustments, all netted
        // atomically), not a parallel Settlement/Payout re-aggregation that
        // silently ignores manual wallet adjustments. totalWithdrawn is
        // still shown from completed Payouts (that's a legitimate "total
        // paid out so far" figure, distinct from the balance itself).
        const [walletBalance, completedPayouts, pendingPayouts, payouts] = await Promise.all([
            walletService.getBalance(vendor._id),
            Payout.aggregate([
                { $match: { recipientId: vendor._id, recipientType: "vendor", status: "completed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Payout.aggregate([
                { $match: { recipientId: vendor._id, recipientType: "vendor", status: { $in: ["requested", "approved", "processing"] } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Payout.find({ recipientId: vendor._id, recipientType: "vendor" })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
        ]);

        const totalWithdrawn = completedPayouts[0]?.total || 0;
        const totalPending = pendingPayouts[0]?.total || 0;

        res.json({
            success: true,
            balance: {
                totalWithdrawn,
                pendingPayout: totalPending,
                available: walletBalance - totalPending,
            },
            payouts: payouts.map(p => ({ ...p, bankDetails: maskBankDetails(p.bankDetails) })),
            minPayout: MIN_PAYOUT_VENDOR,
        });
    } catch (err) {
        console.error("[vendorGetPayouts]", err);
        res.status(500).json({ success: false, message: "Failed to fetch payouts" });
    }
};

// ══════════════════════════════════════════════════════════════
// DELIVERY — Update bank details
// PATCH /api/delivery/bank-details
// ══════════════════════════════════════════════════════════════
export const deliveryUpdateBankDetails = async (req, res) => {
    try {
        const { accountHolder, accountNumber, ifsc, bankName, branch, upiId } = req.body;

        if (!accountNumber && !upiId) {
            return res.status(400).json({ success: false, message: "Provide bank account or UPI ID" });
        }

        const update = {};
        if (accountHolder !== undefined) update["bankDetails.accountHolder"] = String(accountHolder).trim().slice(0, 100);
        if (accountNumber !== undefined) update["bankDetails.accountNumber"] = String(accountNumber).trim().slice(0, 20);
        if (ifsc !== undefined) update["bankDetails.ifsc"] = String(ifsc).trim().toUpperCase().slice(0, 11);
        if (bankName !== undefined) update["bankDetails.bankName"] = String(bankName).trim().slice(0, 100);
        if (branch !== undefined) update["bankDetails.branch"] = String(branch).trim().slice(0, 100);
        if (upiId !== undefined) update["bankDetails.upiId"] = String(upiId).trim().slice(0, 80);

        const rider = await DeliveryBoy.findOneAndUpdate(
            { userId: req.user._id },
            { $set: update },
            { new: true, runValidators: false }
        );
        if (!rider) return res.status(404).json({ success: false, message: "Not found" });

        res.json({ success: true, message: "Bank details updated", bankDetails: rider.bankDetails });
    } catch (err) {
        console.error("[deliveryUpdateBankDetails]", err);
        res.status(500).json({ success: false, message: "Failed to update bank details" });
    }
};

// ══════════════════════════════════════════════════════════════
// DELIVERY — Request Payout
// POST /api/delivery/payouts/request
// ══════════════════════════════════════════════════════════════
export const deliveryRequestPayout = async (req, res) => {
    try {
        const rider = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!rider) return res.status(404).json({ success: false, message: "Not found" });

        const { amount } = req.body;
        const requestedAmount = Number(amount);
        if (!requestedAmount || requestedAmount < MIN_PAYOUT_DELIVERY) {
            return res.status(400).json({ success: false, message: `Minimum payout is ₹${MIN_PAYOUT_DELIVERY}` });
        }

        // Check bank details early
        const bd = rider.bankDetails || {};
        if (!bd.accountNumber && !bd.upiId) {
            return res.status(400).json({ success: false, message: "Please add bank details or UPI ID first" });
        }
        if (bd.accountNumber && bd.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bd.ifsc)) {
            return res.status(400).json({ success: false, message: "Invalid IFSC code format" });
        }

        // FIX 1 (delivery): Same atomic double-request guard as vendor
        const alreadyPending = await Payout.findOne({
            recipientId: rider._id,
            recipientType: "delivery",
            status: { $in: ["requested", "approved", "processing"] },
        }).lean();
        if (alreadyPending) {
            return res.status(409).json({ success: false, message: "You already have a pending payout request. Wait for it to be processed." });
        }

        // Calculate available
        const [completedPayouts, pendingPayouts] = await Promise.all([
            Payout.aggregate([
                { $match: { recipientId: rider._id, recipientType: "delivery", status: "completed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Payout.aggregate([
                { $match: { recipientId: rider._id, recipientType: "delivery", status: { $in: ["requested", "approved", "processing"] } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
        ]);

        const totalWithdrawn = completedPayouts[0]?.total || 0;
        const totalPending = pendingPayouts[0]?.total || 0;
        const available = (rider.totalEarnings || 0) - totalWithdrawn - totalPending;

        if (requestedAmount > available) {
            return res.status(400).json({ success: false, message: `Insufficient balance. Available: ₹${available}` });
        }

        // [FIX] Same TOCTOU race as vendorRequestPayout had — the previous
        // "recheck" was a plain read, not a real guard. The unique partial
        // index on Payout (recipientId, recipientType, blocksNewPayout:true)
        // is the actual DB-level guard now; catch its E11000 below.
        let payout;
        try {
            payout = await Payout.create({
                recipientType: "delivery",
                recipientId: rider._id,
                recipientModel: "DeliveryBoy",
                recipientName: rider.name,
                amount: requestedAmount,
                bankDetails: {
                    accountHolder: bd.accountHolder || "",
                    accountNumber: bd.accountNumber || "",
                    ifsc: bd.ifsc || "",
                    bankName: bd.bankName || "",
                    upiId: bd.upiId || "",
                },
            });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({ success: false, message: "You already have a pending payout request. Wait for it to be processed." });
            }
            throw err;
        }

        res.json({ success: true, message: "Payout requested", payout: { ...payout.toObject(), bankDetails: maskBankDetails(payout.bankDetails) } });
    } catch (err) {
        console.error("[deliveryRequestPayout]", err);
        res.status(500).json({ success: false, message: "Failed to request payout" });
    }
};

// ══════════════════════════════════════════════════════════════
// DELIVERY — Get my payouts + balance
// GET /api/delivery/payouts
// ══════════════════════════════════════════════════════════════
export const deliveryGetPayouts = async (req, res) => {
    try {
        const rider = await DeliveryBoy.findOne({ userId: req.user._id }).lean();
        if (!rider) return res.status(404).json({ success: false, message: "Not found" });

        const [completedPayouts, pendingPayouts, payouts] = await Promise.all([
            Payout.aggregate([
                { $match: { recipientId: rider._id, recipientType: "delivery", status: "completed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Payout.aggregate([
                { $match: { recipientId: rider._id, recipientType: "delivery", status: { $in: ["requested", "approved", "processing"] } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Payout.find({ recipientId: rider._id, recipientType: "delivery" })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
        ]);

        const totalWithdrawn = completedPayouts[0]?.total || 0;
        const totalPending = pendingPayouts[0]?.total || 0;

        res.json({
            success: true,
            balance: {
                totalEarned: rider.totalEarnings || 0,
                totalWithdrawn,
                pendingPayout: totalPending,
                available: (rider.totalEarnings || 0) - totalWithdrawn - totalPending,
            },
            bankDetails: maskBankDetails(rider.bankDetails || {}),
            payouts: payouts.map(p => ({ ...p, bankDetails: maskBankDetails(p.bankDetails) })),
            minPayout: MIN_PAYOUT_DELIVERY,
        });
    } catch (err) {
        console.error("[deliveryGetPayouts]", err);
        res.status(500).json({ success: false, message: "Failed to fetch payouts" });
    }
};

// ══════════════════════════════════════════════════════════════
// ADMIN — Get all payouts
// GET /api/admin/payouts?type=vendor&status=requested&page=1
// ══════════════════════════════════════════════════════════════
export const adminGetAllPayouts = async (req, res) => {
    try {
        const { type, status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (type) filter.recipientType = type;
        if (status) filter.status = status;

        const [total, payouts, stats] = await Promise.all([
            Payout.countDocuments(filter),
            Payout.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .lean(),
            Payout.aggregate([
                { $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } },
            ]),
        ]);

        const summary = {};
        stats.forEach(s => { summary[s._id] = { total: s.total, count: s.count }; });

        res.json({
            success: true,
            payouts,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            summary,
        });
    } catch (err) {
        console.error("[adminGetAllPayouts]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ══════════════════════════════════════════════════════════════
// ADMIN — Approve payout
// PATCH /api/admin/payouts/:id/approve
// ══════════════════════════════════════════════════════════════
export const adminApprovePayout = async (req, res) => {
    try {
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });
        if (payout.status !== "requested") {
            return res.status(400).json({ success: false, message: `Cannot approve — status is ${payout.status}` });
        }

        await Payout.findByIdAndUpdate(payout._id, {
            $set: { status: "approved", approvedAt: new Date(), processedBy: req.user._id },
        });

        notifyPayoutRecipient(payout, {
            title: "Payout Approved",
            message: `Your withdrawal request of ₹${payout.amount.toLocaleString("en-IN")} has been approved and is being processed.`,
        });

        res.json({ success: true, message: "Payout approved" });
    } catch (err) {
        console.error("[adminApprovePayout]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ══════════════════════════════════════════════════════════════
// ADMIN — Reject payout
// PATCH /api/admin/payouts/:id/reject
// ══════════════════════════════════════════════════════════════
export const adminRejectPayout = async (req, res) => {
    try {
        const { reason } = req.body;
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });
        if (payout.status === "completed") {
            return res.status(400).json({ success: false, message: "Cannot reject completed payout" });
        }

        await Payout.findByIdAndUpdate(payout._id, {
            $set: {
                status: "rejected",
                rejectedAt: new Date(),
                rejectionReason: (reason || "").trim().slice(0, 500),
                processedBy: req.user._id,
                blocksNewPayout: false,
            },
        });

        notifyPayoutRecipient(payout, {
            title: "Payout Rejected",
            message: `Your withdrawal request of ₹${payout.amount.toLocaleString("en-IN")} was rejected.${reason ? ` Reason: ${reason}` : ""}`,
            meta: { reason: reason || "" },
        });

        res.json({ success: true, message: "Payout rejected" });
    } catch (err) {
        console.error("[adminRejectPayout]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ══════════════════════════════════════════════════════════════
// ADMIN — Complete payout (mark as paid)
// PATCH /api/admin/payouts/:id/complete
// ══════════════════════════════════════════════════════════════
export const adminCompletePayout = async (req, res) => {
    // WALLET LEDGER: this handler previously did a single atomic
    // findOneAndUpdate with no session — extended into a real transaction
    // now, exactly matching markSettlementPaid's shape, so the payout
    // status flip and the wallet debit commit or abort together. Never a
    // second transaction boundary elsewhere for this.
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { paymentRef, paymentMethod, note } = req.body;

        // FIX 3: Atomic completion guard — use findOneAndUpdate with status condition
        // so two simultaneous admin clicks cannot both complete the same payout.
        // If payout is already "completed" or in a non-completable state,
        // the condition won't match and updated will be null → return 400.
        const updated = await Payout.findOneAndUpdate(
            {
                _id: req.params.id,
                // FIX 3: Only match if NOT already completed — prevents duplicate completion
                status: { $in: ["requested", "approved", "processing"] },
            },
            {
                $set: {
                    status: "completed",
                    completedAt: new Date(),
                    paymentRef: (paymentRef || "").trim(),
                    paymentMethod: paymentMethod || "bank_transfer",
                    adminNote: (note || "").trim().slice(0, 500),
                    processedBy: req.user._id,
                    blocksNewPayout: false,
                },
            },
            { new: true, session }
        );

        if (!updated) {
            // Either payout not found, or already completed/rejected
            await session.abortTransaction().catch(() => { });
            session.endSession();
            const existing = await Payout.findById(req.params.id).select("status").lean();
            if (!existing) return res.status(404).json({ success: false, message: "Payout not found" });
            return res.status(400).json({ success: false, message: `Cannot complete — status is ${existing.status}` });
        }

        // WALLET LEDGER — vendor payouts only. Delivery-partner payouts
        // (recipientType:"delivery") keep using their own separate,
        // pre-existing DeliveryWallet — out of scope for the Vendor Wallet
        // Ledger and deliberately untouched here.
        let walletBalance;
        if (updated.recipientType === "vendor") {
            ({ walletBalance } = await walletService.debit(session, {
                vendorId: updated.recipientId,
                amount: updated.amount,
                type: "withdrawal_debit",
                referenceType: "Payout",
                referenceId: updated._id,
                description: `Withdrawal completed — ${updated.paymentMethod || "bank_transfer"}`,
            }));
        }

        await session.commitTransaction();
        session.endSession();

        notifyPayoutRecipient(updated, {
            title: "Payout Completed",
            message: `₹${updated.amount.toLocaleString("en-IN")} has been transferred to your account.`,
        });

        res.json({ success: true, message: "Payout completed", walletBalance });
    } catch (err) {
        await session.abortTransaction().catch(() => { });
        session.endSession();
        console.error("[adminCompletePayout]", err);
        res.status(500).json({ success: false, message: err.code === "INSUFFICIENT_BALANCE" ? "Wallet balance is insufficient for this payout — investigate before retrying" : "Server error" });
    }
};