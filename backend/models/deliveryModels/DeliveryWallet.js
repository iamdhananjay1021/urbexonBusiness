/**
 * DeliveryWallet.js — Wallet & Earnings Management
 * Tracks wallet balance, transactions, and settlement history
 */

import mongoose from "mongoose";

const deliveryWalletSchema = new mongoose.Schema(
    {
        deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", required: true, unique: true, index: true },

        // ── Balance ──
        balance: { type: Number, default: 0 }, // Current available balance
        totalEarned: { type: Number, default: 0 }, // Lifetime earnings
        totalWithdrawn: { type: Number, default: 0 }, // Total amount withdrawn

        // ── Current Period Totals ──
        today: { amount: { type: Number, default: 0 }, deliveries: { type: Number, default: 0 } },
        thisWeek: { amount: { type: Number, default: 0 }, deliveries: { type: Number, default: 0 } },
        thisMonth: { amount: { type: Number, default: 0 }, deliveries: { type: Number, default: 0 } },

        // ── Pending Amounts ──
        pendingSettlement: { type: Number, default: 0 }, // Amount awaiting settlement
        pendingSettlementDate: Date, // When settlement is expected

        // ── Holds & Blocks ──
        holds: [
            {
                amount: Number,
                reason: String, // "penalty", "dispute", "refund", etc.
                createdAt: { type: Date, default: Date.now },
                releaseDate: Date,
                status: { type: String, enum: ["active", "released"], default: "active" },
            },
        ],

        // ── Transaction History ──
        transactions: [
            {
                type: String, // "delivery_earning", "bonus", "refund", "withdrawal", "penalty", "adjustment"
                amount: Number,
                description: String,
                orderId: mongoose.Schema.Types.ObjectId,
                settlementId: mongoose.Schema.Types.ObjectId,
                transactionId: String, // Unique transaction ID
                status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
                createdAt: { type: Date, default: Date.now },
                completedAt: Date,
                remarks: String,
            },
        ],

        // ── Earning Rules ──
        earningRules: {
            baseAmount: { type: Number, default: 25 }, // Base earning per delivery
            perKmRate: { type: Number, default: 5 }, // Extra per km
            maxPerDelivery: { type: Number, default: 120 }, // Max earning per delivery
            rushHourMultiplier: { type: Number, default: 1.5 }, // Multiplier during peak hours
            weekendBonus: { type: Number, default: 0 }, // Extra % on weekends
        },

        // ── Performance-based Incentives ──
        incentives: [
            {
                name: String, // "5-star-bonus", "on-time-delivery", etc.
                type: String, // "bonus", "multiplier"
                value: Number,
                condition: String,
                active: { type: Boolean, default: true },
                startDate: Date,
                endDate: Date,
                earned: { type: Number, default: 0 },
            },
        ],

        // ── Penalties & Deductions ──
        penalties: [
            {
                type: String, // "cancellation", "late_delivery", "customer_complaint", "rating_drop"
                amount: Number,
                reason: String,
                orderId: mongoose.Schema.Types.ObjectId,
                createdAt: { type: Date, default: Date.now },
                status: { type: String, enum: ["active", "waived", "disputed"], default: "active" },
                disputedAt: Date,
                wavedBy: mongoose.Schema.Types.ObjectId,
            },
        ],

        // ── Withdrawal History ──
        withdrawals: [
            {
                amount: Number,
                method: { type: String, enum: ["bank_transfer", "upi", "wallet"], default: "bank_transfer" },
                bankAccountId: String,
                transactionId: String,
                status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
                requestedAt: { type: Date, default: Date.now },
                processedAt: Date,
                failureReason: String,
                taxDeducted: { type: Number, default: 0 },
            },
        ],

        // ── Settlement Cycles ──
        settlements: [
            {
                settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliverySettlement" },
                period: String, // "2024-01" (YYYY-MM)
                totalDeliveries: Number,
                totalEarned: Number,
                totalDeductions: Number,
                netAmount: Number,
                status: { type: String, enum: ["pending", "processing", "completed"], default: "pending" },
                processedAt: Date,
            },
        ],

        // ── Tax & Compliance ──
        taxInfo: {
            panNumber: String,
            gstRegistered: { type: Boolean, default: false },
            gstNumber: String,
            taxPercentage: { type: Number, default: 0 },
            totalTaxDeducted: { type: Number, default: 0 },
        },

        // ── Metadata ──
        lastEarningAt: Date,
        lastWithdrawalAt: Date,
        lastSettlementAt: Date,
        minWithdrawalAmount: { type: Number, default: 100 },
        maxWithdrawalPerDay: { type: Number, default: 10000 },
    },
    { timestamps: true }
);

// Indexes
deliveryWalletSchema.index({ deliveryBoyId: 1 });
deliveryWalletSchema.index({ "transactions.createdAt": -1 });
deliveryWalletSchema.index({ "withdrawals.status": 1 });
deliveryWalletSchema.index({ lastEarningAt: -1 });

export default mongoose.model("DeliveryWallet", deliveryWalletSchema);
