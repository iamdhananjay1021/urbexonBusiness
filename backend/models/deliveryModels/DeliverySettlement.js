/**
 * DeliverySettlement.js — Settlement & Payout Management
 * Manages settlement cycles, payouts, and financial reconciliation
 */

import mongoose from "mongoose";

const deliverySettlementSchema = new mongoose.Schema(
    {
        deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", required: true, index: true },
        walletId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryWallet", default: null },

        // ── Settlement Period ──
        settlementPeriod: {
            month: { type: Number, required: true }, // 1-12
            year: { type: Number, required: true }, // 2024
            startDate: { type: Date, required: true },
            endDate: { type: Date, required: true },
            cycleNumber: Number, // For tracking which settlement cycle this is
        },

        // ── Settlement Status ──
        status: {
            type: String,
            enum: [
                "pending",          // Awaiting processing
                "processing",       // Currently being processed
                "reviewed",         // Admin reviewed
                "approved",         // Approved for payout
                "initiated",        // Payout initiated
                "completed",        // Successfully paid
                "failed",           // Payment failed
                "disputed",         // Under dispute
                "reversed",         // Settlement reversed
            ],
            default: "pending",
            index: true,
        },

        // ── Earnings Breakdown ──
        earnings: {
            totalDeliveries: { type: Number, default: 0 },
            baseEarnings: { type: Number, default: 0 }, // Base amount from deliveries
            bonusEarnings: { type: Number, default: 0 }, // Performance bonuses
            incentiveEarnings: { type: Number, default: 0 }, // Program incentives
            rushHourEarnings: { type: Number, default: 0 }, // Peak hour bonuses
            grossEarnings: { type: Number, default: 0 }, // Total before deductions
        },

        // ── Deductions ──
        deductions: {
            penalties: { type: Number, default: 0 }, // Cancellation, late delivery, etc.
            refunds: { type: Number, default: 0 }, // Refunded to customers
            holds: { type: Number, default: 0 }, // Under dispute or hold
            tax: { type: Number, default: 0 }, // Tax deducted
            platformFee: { type: Number, default: 0 }, // If applicable
            other: { type: Number, default: 0 },
            totalDeductions: { type: Number, default: 0 },
        },

        // ── Final Amount ──
        netAmount: { type: Number, default: 0 }, // Gross - Deductions
        payableAmount: { type: Number, default: 0 }, // Amount actually paid out

        // ── Bank Transfer Details ──
        bankTransfer: {
            status: { type: String, enum: ["pending", "initiated", "completed", "failed", "reversed"], default: "pending" },
            bankName: String,
            accountNumber: { type: String, default: null }, // Masked
            ifsc: String,
            upiId: String,
            transactionId: String, // From bank
            referenceNumber: String,
            initiatedAt: Date,
            completedAt: Date,
            failureReason: String,
        },

        // ── Delivery Details ──
        deliveryDetails: [
            {
                orderId: mongoose.Schema.Types.ObjectId,
                deliveryDate: Date,
                baseFare: Number,
                distanceKm: Number,
                distanceFare: Number,
                rushHourMultiplier: Number,
                totalEarned: Number,
                status: String,
            },
        ],

        // ── Deduction Details ──
        deductionDetails: [
            {
                type: String, // "penalty", "refund", "hold", "tax"
                amount: Number,
                reason: String,
                orderId: mongoose.Schema.Types.ObjectId,
                createdAt: Date,
            },
        ],

        // ── Tax Information ──
        taxDetails: {
            taxableAmount: Number,
            taxRate: { type: Number, default: 0 }, // Percentage
            taxAmount: Number,
            panNumber: String,
            gstNumber: String,
            invoiceNumber: String,
        },

        // ── Admin Review ──
        adminReview: {
            reviewedAt: Date,
            reviewedBy: mongoose.Schema.Types.ObjectId,
            status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
            notes: String,
            adjustments: [
                {
                    type: String, // "bonus_added", "penalty_waived", "manual_adjustment"
                    amount: Number,
                    reason: String,
                    approvedBy: mongoose.Schema.Types.ObjectId,
                    approvedAt: Date,
                },
            ],
        },

        // ── Dispute Handling ──
        dispute: {
            status: { type: String, enum: ["none", "raised", "investigating", "resolved"], default: "none" },
            raisedAt: Date,
            raisedBy: mongoose.Schema.Types.ObjectId, // Delivery boy who raised it
            reason: String,
            evidence: [String], // Document URLs
            resolution: String,
            resolvedAt: Date,
            resolvedBy: mongoose.Schema.Types.ObjectId,
        },

        // ── Timeline ──
        timeline: [
            {
                event: String, // "created", "reviewed", "approved", "initiated", "completed", etc.
                timestamp: { type: Date, default: Date.now },
                status: String,
                actor: mongoose.Schema.Types.ObjectId, // Who performed the action
                notes: String,
            },
        ],

        // ── Compliance & Audit ──
        complianceInfo: {
            auditedAt: Date,
            auditedBy: mongoose.Schema.Types.ObjectId,
            auditNotes: String,
            complianceStatus: { type: String, enum: ["compliant", "non_compliant", "pending"], default: "pending" },
        },

        // ── Metadata ──
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        processedAt: Date,
        cancelledAt: Date,
        cancelledReason: String,
    },
    { timestamps: true }
);

// Indexes
deliverySettlementSchema.index({ deliveryBoyId: 1, "settlementPeriod.month": 1, "settlementPeriod.year": 1 });
deliverySettlementSchema.index({ status: 1, createdAt: -1 });
deliverySettlementSchema.index({ "bankTransfer.status": 1 });
deliverySettlementSchema.index({ "dispute.status": 1 });

export default mongoose.model("DeliverySettlement", deliverySettlementSchema);
