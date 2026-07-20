/**
 * adminWalletController.js — Admin Wallet Management
 */

import DeliveryWallet from "../../models/deliveryModels/DeliveryWallet.js";
import DeliveryWalletTransaction from "../../models/deliveryModels/DeliveryWalletTransaction.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import { creditEarnings, applyPenalty, addBonus, writeLedgerEntry } from "../../services/deliveryWalletService.js";
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
            await writeLedgerEntry({
                deliveryBoyId: wallet.deliveryBoyId, type: "debit", amount,
                balanceAfter: wallet.balance, description: reason,
            });
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

// [FIX] Previously loaded the entire embedded wallet.transactions array
// into memory just to sort+slice it in JS on every request — unbounded
// for a high-volume rider. Now a real indexed, paginated query against the
// DeliveryWalletTransaction ledger (see that model's header comment).
// Response shape is unchanged so no frontend caller needs to change.
export const getWalletTransactions = async (req, res) => {
    try {
        const { id } = req.params;
        const limit = Math.min(200, Number(req.query.limit) || 50);
        const offset = Number(req.query.offset) || 0;

        const wallet = await DeliveryWallet.findById(id).select("deliveryBoyId").lean();
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        const [transactions, total] = await Promise.all([
            DeliveryWalletTransaction.find({ deliveryBoyId: wallet.deliveryBoyId })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean(),
            DeliveryWalletTransaction.countDocuments({ deliveryBoyId: wallet.deliveryBoyId }),
        ]);

        res.json({ success: true, data: transactions, total, limit, offset });
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
