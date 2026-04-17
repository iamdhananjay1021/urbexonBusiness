/**
 * payoutController.js — Unified payout management
 * Handles: vendor payouts, delivery payouts, admin payout management
 */
import Payout from "../../models/Payout.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import { Settlement } from "../../models/vendorModels/Settlement.js";

const MIN_PAYOUT_VENDOR = 500;
const MIN_PAYOUT_DELIVERY = 200;

// Mask bank account number — show only last 4 digits
const maskAccountNumber = (num) => {
    if (!num || num.length <= 4) return num || "";
    return "X".repeat(num.length - 4) + num.slice(-4);
};

const maskBankDetails = (bd) => {
    if (!bd) return {};
    return {
        ...bd,
        accountNumber: maskAccountNumber(bd.accountNumber),
    };
};

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

        // Calculate available balance
        const [paidSettlements, completedPayouts, pendingPayouts] = await Promise.all([
            Settlement.aggregate([
                { $match: { vendorId: vendor._id, status: "paid" } },
                { $group: { _id: null, total: { $sum: "$vendorEarning" } } },
            ]),
            Payout.aggregate([
                { $match: { recipientId: vendor._id, recipientType: "vendor", status: "completed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Payout.aggregate([
                { $match: { recipientId: vendor._id, recipientType: "vendor", status: { $in: ["requested", "approved", "processing"] } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
        ]);

        const totalEarned = paidSettlements[0]?.total || 0;
        const totalWithdrawn = completedPayouts[0]?.total || 0;
        const totalPending = pendingPayouts[0]?.total || 0;
        const available = totalEarned - totalWithdrawn - totalPending;

        if (requestedAmount > available) {
            return res.status(400).json({ success: false, message: `Insufficient balance. Available: ₹${available}` });
        }

        // Idempotency: prevent duplicate pending payouts
        const existingPayout = await Payout.findOne({
            recipientId: vendor._id,
            recipientType: "vendor",
            status: { $in: ["requested", "approved", "processing"] },
        });
        if (existingPayout) {
            return res.status(409).json({ success: false, message: "You already have a pending payout request. Wait for it to be processed or cancel it." });
        }

        // Check bank details
        const bd = vendor.bankDetails || {};
        if (!bd.accountNumber && !bd.upiId) {
            return res.status(400).json({ success: false, message: "Please add bank details or UPI ID first" });
        }

        // Validate IFSC if bank account provided
        if (bd.accountNumber && bd.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bd.ifsc)) {
            return res.status(400).json({ success: false, message: "Invalid IFSC code format" });
        }

        const payout = await Payout.create({
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

        res.json({ success: true, message: "Payout requested", payout: { ...payout.toObject(), bankDetails: maskBankDetails(payout.bankDetails) } });
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
            $set: { status: "rejected", rejectedAt: new Date(), rejectionReason: "Cancelled by vendor" },
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

        const [paidSettlements, completedPayouts, pendingPayouts, payouts] = await Promise.all([
            Settlement.aggregate([
                { $match: { vendorId: vendor._id, status: "paid" } },
                { $group: { _id: null, total: { $sum: "$vendorEarning" } } },
            ]),
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

        const totalEarned = paidSettlements[0]?.total || 0;
        const totalWithdrawn = completedPayouts[0]?.total || 0;
        const totalPending = pendingPayouts[0]?.total || 0;

        res.json({
            success: true,
            balance: {
                totalEarned,
                totalWithdrawn,
                pendingPayout: totalPending,
                available: totalEarned - totalWithdrawn - totalPending,
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

        // Idempotency: prevent duplicate pending payouts
        const existingPayout = await Payout.findOne({
            recipientId: rider._id,
            recipientType: "delivery",
            status: { $in: ["requested", "approved", "processing"] },
        });
        if (existingPayout) {
            return res.status(409).json({ success: false, message: "You already have a pending payout request. Wait for it to be processed." });
        }

        const bd = rider.bankDetails || {};
        if (!bd.accountNumber && !bd.upiId) {
            return res.status(400).json({ success: false, message: "Please add bank details or UPI ID first" });
        }

        // Validate IFSC if bank account provided
        if (bd.accountNumber && bd.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bd.ifsc)) {
            return res.status(400).json({ success: false, message: "Invalid IFSC code format" });
        }

        const payout = await Payout.create({
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
            },
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
    try {
        const { paymentRef, paymentMethod, note } = req.body;
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });
        if (!["requested", "approved", "processing"].includes(payout.status)) {
            return res.status(400).json({ success: false, message: `Cannot complete — status is ${payout.status}` });
        }

        await Payout.findByIdAndUpdate(payout._id, {
            $set: {
                status: "completed",
                completedAt: new Date(),
                paymentRef: (paymentRef || "").trim(),
                paymentMethod: paymentMethod || "bank_transfer",
                adminNote: (note || "").trim().slice(0, 500),
                processedBy: req.user._id,
            },
        });

        res.json({ success: true, message: "Payout completed" });
    } catch (err) {
        console.error("[adminCompletePayout]", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
