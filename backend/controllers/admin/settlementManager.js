import { Settlement } from "../../models/vendorModels/Settlement.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import mongoose from "mongoose";
import * as walletService from "../../services/vendorWalletService.js";

// ══════════════════════════════════════════════════════════════
// ADMIN — Get all settlements
// GET /api/admin/settlements?status=pending&vendorId=xxx&page=1
// ══════════════════════════════════════════════════════════════
export const getAllSettlements = async (req, res) => {
    try {
        const { status, vendorId, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (vendorId) filter.vendorId = vendorId;

        const total = await Settlement.countDocuments(filter);
        const settlements = await Settlement.find(filter)
            .populate("vendorId", "shopName ownerName bankDetails")
            .populate("orderId", "orderStatus totalAmount")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ success: true, settlements, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[getAllSettlements]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ══════════════════════════════════════════════════════════════
// ADMIN — Process weekly settlements (create batch)
// POST /api/admin/settlements/process
// ══════════════════════════════════════════════════════════════
export const processWeeklySettlements = async (req, res) => {
    try {
        const batchId = `BATCH-${Date.now()}`;
        // [FIX] Was a full, unbounded Settlement.find() with no projection
        // — at scale (10k+ vendors) this loads every pending settlement's
        // entire document into memory just to read 3 fields. .lean() +
        // .select() cuts the memory footprint substantially without
        // changing the batch-processing behavior itself.
        const pending = await Settlement.find({ status: "pending" }).select("vendorId vendorEarning").lean();

        if (!pending.length) {
            return res.json({ success: true, message: "No pending settlements to process", count: 0 });
        }

        const vendorMap = {};
        pending.forEach((s) => {
            const vid = s.vendorId.toString();
            if (!vendorMap[vid]) vendorMap[vid] = { total: 0, count: 0 };
            vendorMap[vid].total += s.vendorEarning;
            vendorMap[vid].count += 1;
        });

        await Settlement.updateMany(
            { _id: { $in: pending.map((s) => s._id) } },
            { status: "processing", batchId, settlementDate: new Date() }
        );

        res.json({
            success: true,
            message: "Settlement batch created",
            batchId,
            totalVendors: Object.keys(vendorMap).length,
            totalSettlements: pending.length,
            vendorSummary: Object.entries(vendorMap).map(([vendorId, data]) => ({
                vendorId,
                amount: data.total,
                count: data.count,
            })),
        });
    } catch (err) {
        console.error("[processWeeklySettlements]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ══════════════════════════════════════════════════════════════
// ADMIN — Mark single settlement as paid
// PATCH /api/admin/settlements/:id/paid
// FIX #1 + #3: MongoDB transaction + idempotency guard
// ══════════════════════════════════════════════════════════════
export const markSettlementPaid = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { paymentRef, paymentMethod } = req.body;

        // FIX #3 — Idempotency: fetch inside session with status condition
        // Using findOneAndUpdate with status filter is atomic — prevents race
        const settlement = await Settlement.findOneAndUpdate(
            { _id: req.params.id, status: { $ne: "paid" } }, // FIX #2 — anti-race condition
            {
                status: "paid",
                paymentRef,
                paymentMethod,
                settlementDate: new Date(),
            },
            { new: true, session }
        );

        // FIX #3 — If null, either not found or already paid
        if (!settlement) {
            await session.abortTransaction();
            session.endSession();
            const existing = await Settlement.findById(req.params.id).lean();
            if (!existing) return res.status(404).json({ success: false, message: "Settlement not found" });
            return res.status(400).json({ success: false, message: "Settlement already paid" });
        }

        // FIX #1 — Vendor balance update inside same transaction (atomic)
        await Vendor.findByIdAndUpdate(
            settlement.vendorId,
            { $inc: { pendingSettlement: -settlement.vendorEarning, totalEarnings: settlement.vendorEarning } },
            { session }
        );

        // WALLET LEDGER — one credit, exactly once, inside the SAME
        // session/transaction as the status flip above. Never a second
        // transaction boundary. The unique {referenceType, referenceId,
        // type} index on VendorWalletTransaction guarantees this Settlement
        // can never be credited twice even if this handler is somehow
        // re-entered — the anti-race findOneAndUpdate above already
        // prevents that in practice, this is defense-in-depth.
        const { walletBalance } = await walletService.credit(session, {
            vendorId: settlement.vendorId,
            amount: settlement.vendorEarning,
            type: "settlement_credit",
            referenceType: "Settlement",
            referenceId: settlement._id,
            description: `Settlement paid — order ${settlement.orderId}`,
        });

        await session.commitTransaction();
        session.endSession();

        res.json({ success: true, message: "Settlement marked as paid", settlement, walletBalance });
    } catch (err) {
        await session.abortTransaction().catch(() => { });
        session.endSession();
        console.error("[markSettlementPaid]", err);
        res.status(500).json({ success: false, message: err.code === "VENDOR_NOT_FOUND" ? "Vendor not found" : "Server error" });
    }
};

// ══════════════════════════════════════════════════════════════
// ADMIN — Mark entire batch as paid
// PATCH /api/admin/settlements/batch/:batchId/paid
// FIX #1: MongoDB transaction for batch + vendor balance atomicity
// ══════════════════════════════════════════════════════════════
export const markBatchPaid = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { batchId } = req.params;
        const { paymentRef, paymentMethod } = req.body;

        const settlements = await Settlement.find(
            { batchId, status: "processing" },
            null,
            { session }
        );

        if (!settlements.length) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "No processing settlements found for this batch" });
        }

        // FIX #1 — All updates inside same transaction
        await Settlement.updateMany(
            { batchId, status: "processing" },
            { status: "paid", paymentRef, paymentMethod, settlementDate: new Date() },
            { session }
        );

        const vendorMap = {};
        settlements.forEach((s) => {
            const vid = s.vendorId.toString();
            if (!vendorMap[vid]) vendorMap[vid] = 0;
            vendorMap[vid] += s.vendorEarning;
        });

        // FIX #1 — All vendor balance updates in same transaction
        await Promise.all(
            Object.entries(vendorMap).map(([vendorId, amount]) =>
                Vendor.findByIdAndUpdate(
                    vendorId,
                    { $inc: { pendingSettlement: -amount, totalEarnings: amount } },
                    { session }
                )
            )
        );

        // WALLET LEDGER — one credit per Settlement (not one per vendor
        // per batch) so "Settlement Paid → One Ledger Credit → Exactly
        // once" holds true whether a settlement is paid individually or
        // as part of a batch. Sequential, not Promise.all — a single
        // mongoose ClientSession must not run concurrent operations.
        for (const s of settlements) {
            await walletService.credit(session, {
                vendorId: s.vendorId,
                amount: s.vendorEarning,
                type: "settlement_credit",
                referenceType: "Settlement",
                referenceId: s._id,
                description: `Settlement paid — batch ${batchId}`,
            });
        }

        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: `Batch ${batchId} marked as paid`,
            totalSettlements: settlements.length,
        });
    } catch (err) {
        await session.abortTransaction().catch(() => { });
        session.endSession();
        console.error("[markBatchPaid]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};