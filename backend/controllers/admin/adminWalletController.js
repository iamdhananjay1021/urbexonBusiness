/**
 * adminWalletController.js — Admin Wallet Management
 */

import DeliveryWallet from "../../models/deliveryModels/DeliveryWallet.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import { creditEarnings, applyPenalty, addBonus } from "../../services/deliveryWalletService.js";
import { sendNotification } from "../../utils/notificationQueue.js";

export const listWallets = async (req, res) => {
    try {
        const { page = 1, limit = 20, sortBy = "balance" } = req.query;
        const skip = (page - 1) * limit;

        const wallets = await DeliveryWallet.find()
            .populate("deliveryBoyId", "name phone email city status")
            .skip(skip)
            .limit(Number(limit))
            .sort({ [sortBy]: -1 })
            .lean();

        const total = await DeliveryWallet.countDocuments();

        res.json({
            success: true,
            data: wallets,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error("[listWallets]", err);
        res.status(500).json({ success: false, message: "Failed to fetch wallets" });
    }
};

export const getWalletDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const wallet = await DeliveryWallet.findById(id).populate(
            "deliveryBoyId",
            "name phone email city status"
        );

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        res.json({ success: true, data: wallet });
    } catch (err) {
        console.error("[getWalletDetails]", err);
        res.status(500).json({ success: false, message: "Failed to fetch wallet" });
    }
};

export const adjustWalletBalance = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, type, reason } = req.body;

        if (!amount || !type || !reason) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const wallet = await DeliveryWallet.findById(id);
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        let result;
        if (type === "credit") {
            result = await creditEarnings(wallet.deliveryBoyId, null, amount, reason);
        } else if (type === "debit") {
            const newBalance = wallet.balance - amount;
            if (newBalance < 0) {
                return res.status(400).json({ success: false, message: "Insufficient balance" });
            }
            wallet.balance = newBalance;
            wallet.transactions.push({
                type: "debit",
                amount,
                description: reason,
                timestamp: new Date(),
                balance: wallet.balance,
            });
            await wallet.save();
            result = { success: true, data: wallet };
        } else if (type === "bonus") {
            result = await addBonus(wallet.deliveryBoyId, amount, reason);
        } else if (type === "penalty") {
            result = await applyPenalty(wallet.deliveryBoyId, amount, reason);
        }

        if (result.success) {
            const rider = await DeliveryBoy.findById(wallet.deliveryBoyId);
            if (rider) {
                sendNotification(String(rider.userId), "delivery:wallet_update", {
                    message: `Wallet ${type}: ${reason}`,
                    amount,
                }).catch(() => {});
            }
        }

        res.json(result);
    } catch (err) {
        console.error("[adjustWalletBalance]", err);
        res.status(500).json({ success: false, message: "Failed to adjust balance" });
    }
};

export const getWalletTransactions = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const wallet = await DeliveryWallet.findById(id);
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        const transactions = wallet.transactions
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(offset, Number(offset) + Number(limit));

        res.json({
            success: true,
            data: transactions,
            total: wallet.transactions.length,
            limit,
            offset,
        });
    } catch (err) {
        console.error("[getWalletTransactions]", err);
        res.status(500).json({ success: false, message: "Failed to fetch transactions" });
    }
};

export default {
    listWallets,
    getWalletDetails,
    adjustWalletBalance,
    getWalletTransactions,
};
