/**
 * deliverySettlementService.js — Settlement and Payout Management
 */

import DeliverySettlement from "../models/deliveryModels/DeliverySettlement.js";
import DeliveryWallet from "../models/deliveryModels/DeliveryWallet.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import Order from "../models/Order.js";

export const createMonthlySettlementCycle = async (deliveryBoyId, month, year) => {
    try {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        const deliveries = await Order.find({
            "delivery.assignedTo": deliveryBoyId,
            orderStatus: "DELIVERED",
            "delivery.deliveredAt": { $gte: startDate, $lte: endDate },
        }).lean();

        const baseEarnings = deliveries.reduce((sum, order) => {
            return sum + (order.delivery?.earnings || 0);
        }, 0);

        const settlement = new DeliverySettlement({
            deliveryBoyId,
            month,
            year,
            period: { startDate, endDate },
            deliveryCount: deliveries.length,
            earnings: { base: baseEarnings },
            status: "pending",
        });

        settlement.timeline.push({
            event: "settlement_created",
            timestamp: new Date(),
            note: `Settlement cycle for ${month}/${year} created`,
        });

        await settlement.save();

        return { success: true, message: "Settlement cycle created", data: settlement };
    } catch (err) {
        throw new Error(`[SettlementService] createMonthlySettlementCycle failed: ${err.message}`);
    }
};

export const calculateSettlement = async (settlementId) => {
    try {
        const settlement = await DeliverySettlement.findById(settlementId);
        if (!settlement) throw new Error("Settlement not found");

        const wallet = await DeliveryWallet.findOne({ deliveryBoyId: settlement.deliveryBoyId });

        let totalDeductions = 0;
        if (settlement.deductions) {
            Object.values(settlement.deductions).forEach((val) => {
                if (typeof val === "number") totalDeductions += val;
            });
        }

        let totalIncentives = 0;
        if (settlement.incentives) {
            Object.values(settlement.incentives).forEach((val) => {
                if (typeof val === "number") totalIncentives += val;
            });
        }

        const netAmount =
            settlement.earnings.base +
            totalIncentives -
            totalDeductions -
            (settlement.taxes?.taxAmount || 0);

        settlement.earnings.net = Math.max(0, netAmount);
        settlement.status = "calculated";

        settlement.timeline.push({
            event: "settlement_calculated",
            timestamp: new Date(),
            note: `Net amount: ₹${settlement.earnings.net}`,
        });

        await settlement.save();

        return { success: true, message: "Settlement calculated", data: settlement };
    } catch (err) {
        throw new Error(`[SettlementService] calculateSettlement failed: ${err.message}`);
    }
};

export const approveSettlement = async (settlementId, adminId, notes = "") => {
    try {
        const settlement = await DeliverySettlement.findById(settlementId);
        if (!settlement) throw new Error("Settlement not found");

        settlement.status = "approved";
        settlement.approvedBy = adminId;
        settlement.approvedAt = new Date();
        settlement.adminNotes = notes;

        settlement.timeline.push({
            event: "settlement_approved",
            timestamp: new Date(),
            approvedBy: adminId,
            note: notes,
        });

        await settlement.save();

        return { success: true, message: "Settlement approved", data: settlement };
    } catch (err) {
        throw new Error(`[SettlementService] approveSettlement failed: ${err.message}`);
    }
};

export const initiatePayout = async (settlementId, bankDetails = {}) => {
    try {
        const settlement = await DeliverySettlement.findById(settlementId);
        if (!settlement) throw new Error("Settlement not found");

        settlement.status = "payout_initiated";
        settlement.payout = {
            amount: settlement.earnings.net,
            method: "bank_transfer",
            initiatedAt: new Date(),
            transactionId: `TXN_${Date.now()}`,
            status: "pending",
            bankDetails,
        };

        settlement.timeline.push({
            event: "payout_initiated",
            timestamp: new Date(),
            note: `Payout of ₹${settlement.earnings.net} initiated`,
        });

        await settlement.save();

        return { success: true, message: "Payout initiated", data: settlement };
    } catch (err) {
        throw new Error(`[SettlementService] initiatePayout failed: ${err.message}`);
    }
};

export const completePayout = async (settlementId, transactionProof) => {
    try {
        const settlement = await DeliverySettlement.findById(settlementId);
        if (!settlement) throw new Error("Settlement not found");

        settlement.status = "completed";
        settlement.payout.status = "completed";
        settlement.payout.completedAt = new Date();
        settlement.payout.transactionProof = transactionProof;

        settlement.timeline.push({
            event: "payout_completed",
            timestamp: new Date(),
            note: `Payout of ₹${settlement.earnings.net} completed`,
        });

        await settlement.save();

        return { success: true, message: "Payout completed", data: settlement };
    } catch (err) {
        throw new Error(`[SettlementService] completePayout failed: ${err.message}`);
    }
};

export const getSettlementHistory = async (deliveryBoyId, limit = 12) => {
    try {
        const settlements = await DeliverySettlement.find({ deliveryBoyId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return { success: true, data: settlements };
    } catch (err) {
        throw new Error(`[SettlementService] getSettlementHistory failed: ${err.message}`);
    }
};

export const getSettlementDetails = async (settlementId) => {
    try {
        const settlement = await DeliverySettlement.findById(settlementId);
        if (!settlement) {
            return { success: false, message: "Settlement not found" };
        }

        return { success: true, data: settlement };
    } catch (err) {
        throw new Error(`[SettlementService] getSettlementDetails failed: ${err.message}`);
    }
};

export default {
    createMonthlySettlementCycle,
    calculateSettlement,
    approveSettlement,
    initiatePayout,
    completePayout,
    getSettlementHistory,
    getSettlementDetails,
};
