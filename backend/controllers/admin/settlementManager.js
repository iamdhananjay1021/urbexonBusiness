import { Settlement } from "../../models/vendorModels/Settlement.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import mongoose from "mongoose";

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
        const pending = await Settlement.find({ status: "pending" });

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

        await session.commitTransaction();
        session.endSession();

        res.json({ success: true, message: "Settlement marked as paid", settlement });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("[markSettlementPaid]", err);
        res.status(500).json({ success: false, message: "Server error" });
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

        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: `Batch ${batchId} marked as paid`,
            totalSettlements: settlements.length,
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("[markBatchPaid]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};