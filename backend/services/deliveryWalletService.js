/**
 * deliveryWalletService.js — Wallet and Earnings Management
 */

import DeliveryWallet from "../models/deliveryModels/DeliveryWallet.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import Order from "../models/Order.js";

const DELIVERY_EARNING_BASE = 25;
const DELIVERY_EARNING_PER_KM = 5;
const DELIVERY_EARNING_MIN = 25;
const DELIVERY_EARNING_MAX = 120;

const calculateDeliveryEarning = (distanceKm = 0, isExpress = false) => {
    let earning = DELIVERY_EARNING_BASE + (distanceKm * DELIVERY_EARNING_PER_KM);
    if (isExpress) earning *= 1.5;
    return Math.min(Math.max(Math.round(earning), DELIVERY_EARNING_MIN), DELIVERY_EARNING_MAX);
};

export const creditEarnings = async (deliveryBoyId, orderId, amount, description = "") => {
    try {
        const wallet = await DeliveryWallet.findOne({ deliveryBoyId });
        if (!wallet) {
            throw new Error("Wallet not found");
        }

        wallet.balance += amount;
        wallet.totalEarned += amount;
        wallet.transactions.push({
            type: "credit",
            amount,
            description: description || `Order delivery: ${orderId}`,
            orderId,
            timestamp: new Date(),
            balance: wallet.balance,
        });

        await wallet.save();

        // Update DeliveryBoy stats
        await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
            $inc: {
                "wallet.balance": amount,
                "wallet.totalEarned": amount,
                "performance.todayEarnings": amount,
                "performance.weekEarnings": amount,
                "performance.monthEarnings": amount,
                "performance.totalEarnings": amount,
            },
            "wallet.lastEarningAt": new Date(),
        });

        return { success: true, message: "Earnings credited", data: wallet };
    } catch (err) {
        throw new Error(`[WalletService] creditEarnings failed: ${err.message}`);
    }
};

export const debitForRefund = async (deliveryBoyId, amount, orderId, reason) => {
    try {
        const wallet = await DeliveryWallet.findOne({ deliveryBoyId });
        if (!wallet) throw new Error("Wallet not found");

        if (wallet.balance < amount) {
            return { success: false, message: "Insufficient balance" };
        }

        wallet.balance -= amount;
        wallet.transactions.push({
            type: "debit",
            amount,
            description: reason || `Refund for order: ${orderId}`,
            orderId,
            timestamp: new Date(),
            balance: wallet.balance,
        });

        await wallet.save();

        await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
            $inc: { "wallet.balance": -amount },
        });

        return { success: true, message: "Amount deducted", data: wallet };
    } catch (err) {
        throw new Error(`[WalletService] debitForRefund failed: ${err.message}`);
    }
};

export const addBonus = async (deliveryBoyId, amount, description) => {
    try {
        const wallet = await DeliveryWallet.findOne({ deliveryBoyId });
        if (!wallet) throw new Error("Wallet not found");

        wallet.balance += amount;
        wallet.totalEarned += amount;
        wallet.transactions.push({
            type: "bonus",
            amount,
            description: description || "Performance bonus",
            timestamp: new Date(),
            balance: wallet.balance,
        });

        await wallet.save();

        await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
            $inc: { "wallet.balance": amount, "wallet.totalEarned": amount },
        });

        return { success: true, message: "Bonus added", data: wallet };
    } catch (err) {
        throw new Error(`[WalletService] addBonus failed: ${err.message}`);
    }
};

export const applyPenalty = async (deliveryBoyId, amount, reason) => {
    try {
        const wallet = await DeliveryWallet.findOne({ deliveryBoyId });
        if (!wallet) throw new Error("Wallet not found");

        wallet.balance = Math.max(0, wallet.balance - amount);
        wallet.transactions.push({
            type: "penalty",
            amount,
            description: reason || "Penalty applied",
            timestamp: new Date(),
            balance: wallet.balance,
        });

        await wallet.save();

        await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
            $inc: { "wallet.balance": -amount },
            $push: {
                penalties: {
                    type: "monetary",
                    reason,
                    amount,
                    createdAt: new Date(),
                    status: "active",
                },
            },
        });

        return { success: true, message: "Penalty applied", data: wallet };
    } catch (err) {
        throw new Error(`[WalletService] applyPenalty failed: ${err.message}`);
    }
};

export const holdAmount = async (deliveryBoyId, amount, orderId, holdReason) => {
    try {
        const wallet = await DeliveryWallet.findOne({ deliveryBoyId });
        if (!wallet) throw new Error("Wallet not found");

        if (wallet.balance < amount) {
            return { success: false, message: "Insufficient balance" };
        }

        wallet.holds.push({
            amount,
            orderId,
            reason: holdReason,
            createdAt: new Date(),
            status: "active",
        });

        await wallet.save();

        return { success: true, message: "Amount held", data: wallet };
    } catch (err) {
        throw new Error(`[WalletService] holdAmount failed: ${err.message}`);
    }
};

export const releaseHold = async (deliveryBoyId, holdId) => {
    try {
        const wallet = await DeliveryWallet.findOne({ deliveryBoyId });
        if (!wallet) throw new Error("Wallet not found");

        const hold = wallet.holds.id(holdId);
        if (!hold) {
            return { success: false, message: "Hold not found" };
        }

        hold.status = "released";
        hold.releasedAt = new Date();

        await wallet.save();

        return { success: true, message: "Hold released", data: wallet };
    } catch (err) {
        throw new Error(`[WalletService] releaseHold failed: ${err.message}`);
    }
};

export const getWalletStatus = async (deliveryBoyId) => {
    try {
        const wallet = await DeliveryWallet.findOne({ deliveryBoyId });
        if (!wallet) {
            return { success: false, message: "Wallet not found" };
        }

        const activeHolds = wallet.holds.filter((h) => h.status === "active");
        const totalHeld = activeHolds.reduce((sum, h) => sum + h.amount, 0);
        const availableBalance = Math.max(0, wallet.balance - totalHeld);

        return {
            success: true,
            data: {
                ...wallet.toObject(),
                totalHeld,
                availableBalance,
            },
        };
    } catch (err) {
        throw new Error(`[WalletService] getWalletStatus failed: ${err.message}`);
    }
};

export const getTransactionHistory = async (deliveryBoyId, limit = 50, offset = 0) => {
    try {
        const wallet = await DeliveryWallet.findOne({ deliveryBoyId });
        if (!wallet) {
            return { success: false, message: "Wallet not found" };
        }

        const transactions = wallet.transactions.sort((a, b) => b.timestamp - a.timestamp).slice(offset, offset + limit);

        return {
            success: true,
            data: transactions,
            total: wallet.transactions.length,
            limit,
            offset,
        };
    } catch (err) {
        throw new Error(`[WalletService] getTransactionHistory failed: ${err.message}`);
    }
};

export const calculateDailyEarnings = async (deliveryBoyId) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const orders = await Order.find({
            "delivery.assignedTo": deliveryBoyId,
            orderStatus: "DELIVERED",
            "delivery.deliveredAt": { $gte: startOfDay },
        }).lean();

        const earnings = orders.reduce((sum, order) => {
            return sum + calculateDeliveryEarning(order.delivery?.distanceKm || 0);
        }, 0);

        return { success: true, data: { dailyEarnings: earnings, orderCount: orders.length } };
    } catch (err) {
        throw new Error(`[WalletService] calculateDailyEarnings failed: ${err.message}`);
    }
};

export default {
    creditEarnings,
    debitForRefund,
    addBonus,
    applyPenalty,
    holdAmount,
    releaseHold,
    getWalletStatus,
    getTransactionHistory,
    calculateDailyEarnings,
};
