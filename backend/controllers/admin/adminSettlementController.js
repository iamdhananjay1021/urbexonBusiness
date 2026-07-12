/**
 * adminSettlementController.js — Admin Settlement Management
 */

import DeliverySettlement from "../../models/deliveryModels/DeliverySettlement.js";
import { calculateSettlement, approveSettlement, initiatePayout, completePayout } from "../../services/deliverySettlementService.js";

export const listSettlements = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const query = {};
        if (status) query.status = status;

        const settlements = await DeliverySettlement.find(query)
            .populate("deliveryBoyId", "name phone email city")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 })
            .lean();

        const total = await DeliverySettlement.countDocuments(query);

        res.json({
            success: true,
            data: settlements,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error("[listSettlements]", err);
        res.status(500).json({ success: false, message: "Failed to fetch settlements" });
    }
};

export const getSettlementDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const settlement = await DeliverySettlement.findById(id).populate(
            "deliveryBoyId",
            "name phone email city"
        );

        if (!settlement) {
            return res.status(404).json({ success: false, message: "Settlement not found" });
        }

        res.json({ success: true, data: settlement });
    } catch (err) {
        console.error("[getSettlementDetails]", err);
        res.status(500).json({ success: false, message: "Failed to fetch settlement" });
    }
};

export const calculateSettlementCycle = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await calculateSettlement(id);
        res.json(result);
    } catch (err) {
        console.error("[calculateSettlementCycle]", err);
        res.status(500).json({ success: false, message: "Calculation failed" });
    }
};

export const approveSettlementCycle = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const result = await approveSettlement(id, req.user._id, notes || "");
        res.json(result);
    } catch (err) {
        console.error("[approveSettlementCycle]", err);
        res.status(500).json({ success: false, message: "Approval failed" });
    }
};

export const initiateSettlementPayout = async (req, res) => {
    try {
        const { id } = req.params;
        const { bankDetails } = req.body;

        const result = await initiatePayout(id, bankDetails || {});
        res.json(result);
    } catch (err) {
        console.error("[initiateSettlementPayout]", err);
        res.status(500).json({ success: false, message: "Payout initiation failed" });
    }
};

export const completeSettlementPayout = async (req, res) => {
    try {
        const { id } = req.params;
        const { transactionProof } = req.body;

        const result = await completePayout(id, transactionProof || "");
        res.json(result);
    } catch (err) {
        console.error("[completeSettlementPayout]", err);
        res.status(500).json({ success: false, message: "Payout completion failed" });
    }
};

export default {
    listSettlements,
    getSettlementDetails,
    calculateSettlementCycle,
    approveSettlementCycle,
    initiateSettlementPayout,
    completeSettlementPayout,
};
