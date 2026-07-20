/**
 * sellerJobs.js — Production v2.1
 * FIXES:
 * - autoExpireSubscriptions: syncs vendor.subscription.isActive on expiry
 * - calculateSellerCommissions: uses correct Vendor.commissionRate (not subscriptionTier)
 * - autoGeneratePayouts: correct field names for Settlement model
 */

import Vendor from '../models/vendorModels/Vendor.js';
import Order from '../models/Order.js';
import Subscription from '../models/vendorModels/Subscription.js';
import { Settlement } from '../models/vendorModels/Settlement.js';
import VendorWalletTransaction from '../models/vendorModels/VendorWalletTransaction.js';
import logger from '../utils/logger.js';
import { notify } from '../services/notificationEngine.js';

// ══════════════════════════════════════════════════════
// 1️⃣ CALCULATE SELLER COMMISSIONS (monthly summary)
// Uses vendor.commissionRate from Vendor model (admin-configurable per vendor)
// ══════════════════════════════════════════════════════
export const calculateSellerCommissions = async () => {
    try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        // Only process delivered orders with vendorId set (URBEXON_HOUR orders)
        const orders = await Order.find({
            createdAt: { $gte: startOfMonth },
            orderStatus: 'DELIVERED',
            orderMode: 'URBEXON_HOUR',
            vendorId: { $ne: null },
            'settlement.calculated': { $ne: true },
        }).select('vendorId totalAmount items').lean();

        if (orders.length === 0) return { commissionsCalculated: 0 };

        // Group by vendor
        const vendorSales = {};
        for (const order of orders) {
            const vid = String(order.vendorId);
            if (!vendorSales[vid]) vendorSales[vid] = { amount: 0, orders: 0 };
            vendorSales[vid].amount += order.totalAmount || 0;
            vendorSales[vid].orders += 1;
        }

        let calculated = 0;
        for (const [vendorId, sales] of Object.entries(vendorSales)) {
            try {
                const vendor = await Vendor.findById(vendorId).select('commissionRate').lean();
                const commissionRate = vendor?.commissionRate ?? 18; // Default 18%
                const commissionAmount = Math.round((sales.amount * commissionRate) / 100);
                const vendorEarning = sales.amount - commissionAmount;

                await logger.info(`💼 Commission vendor ${vendorId}: ₹${commissionAmount} on ₹${sales.amount} (${commissionRate}%)`);
                calculated++;
            } catch (err) {
                logger.warn(`Failed to calculate commission for vendor ${vendorId}: ${err.message}`);
            }
        }

        return { commissionsCalculated: calculated };
    } catch (err) {
        logger.error('Calculate Commissions Error:', err);
        throw { message: err.message, critical: true };
    }
};

// ══════════════════════════════════════════════════════
// 2️⃣ AUTO-GENERATE PAYOUTS (weekly)
// Moves pending settlements to processing batch
// ══════════════════════════════════════════════════════
export const autoGeneratePayouts = async () => {
    try {
        const settlements = await Settlement.find({
            status: 'pending',
            vendorEarning: { $gt: 0 },
        }).select('vendorId vendorEarning').lean();

        if (settlements.length === 0) return { payoutsGenerated: 0 };

        const batchId = `AUTO-${Date.now()}`;
        await Settlement.updateMany(
            { _id: { $in: settlements.map(s => s._id) } },
            { status: 'processing', batchId, settlementDate: new Date() }
        );

        logger.info(`💰 Auto-processed ${settlements.length} settlements in batch ${batchId}`);
        return { payoutsGenerated: settlements.length };
    } catch (err) {
        logger.error('Generate Payouts Error:', err);
        throw { message: err.message, critical: true };
    }
};

// ══════════════════════════════════════════════════════
// 3️⃣ UPDATE VENDOR RATINGS
// ══════════════════════════════════════════════════════
export const updateVendorRatings = async () => {
    try {
        const vendors = await Vendor.find({ isDeleted: { $ne: true }, status: 'approved' }).select('_id').lean();
        if (vendors.length === 0) return { ratingsUpdated: 0 };

        let updated = 0;
        for (const vendor of vendors) {
            try {
                const result = await Order.aggregate([
                    { $match: { vendorId: vendor._id, orderStatus: 'DELIVERED', 'review.rating': { $exists: true } } },
                    { $group: { _id: null, avgRating: { $avg: '$review.rating' }, count: { $sum: 1 } } },
                ]);

                if (result.length > 0) {
                    const { avgRating, count } = result[0];
                    await Vendor.findByIdAndUpdate(vendor._id, {
                        rating: parseFloat(avgRating.toFixed(1)),
                        ratingCount: count,
                    });
                    updated++;
                }
            } catch (err) {
                logger.warn(`Failed to update rating for vendor ${vendor._id}: ${err.message}`);
            }
        }

        logger.info(`⭐ Updated ratings for ${updated}/${vendors.length} vendors`);
        return { ratingsUpdated: updated };
    } catch (err) {
        logger.error('Update Vendor Ratings Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 4️⃣ AUTO-EXPIRE SUBSCRIPTIONS
// Runs every hour via scheduler
// Syncs: Subscription.status → "expired" + Vendor.subscription.isActive → false
// ══════════════════════════════════════════════════════
export const autoExpireSubscriptions = async () => {
    try {
        const now = new Date();

        // Find active subscriptions that have expired
        const expired = await Subscription.find({
            status: 'active',
            expiryDate: { $lte: now },
        }).lean();

        let count = 0;
        for (const sub of expired) {
            try {
                // Update subscription status
                await Subscription.findByIdAndUpdate(sub._id, { status: 'expired' });

                // ✅ FIX: Sync BOTH embedded subscription fields on Vendor
                const vendor = await Vendor.findByIdAndUpdate(sub.vendorId, {
                    'subscription.isActive': false,
                    'subscription.expiryDate': sub.expiryDate,
                }).select('userId');

                // NOTIFICATION GAP FIX: this job flipped the status silently —
                // a vendor only found out their subscription lapsed when a
                // gated action started 403-ing.
                if (vendor?.userId) {
                    notify({
                        recipientId: vendor.userId,
                        role: 'vendor',
                        type: 'subscription_update',
                        title: 'Subscription Expired',
                        message: `Your ${sub.plan} plan has expired. Renew to keep selling on Urbexon Hour.`,
                        priority: 'high',
                        meta: { plan: sub.plan, status: 'expired' },
                    }).catch((err) => logger.warn(`[autoExpireSubscriptions] notify failed for vendor ${sub.vendorId}: ${err.message}`));
                }

                logger.info(`⏰ Subscription expired: vendor ${sub.vendorId} (plan: ${sub.plan}, expired: ${sub.expiryDate.toISOString().slice(0, 10)})`);
                count++;
            } catch (err) {
                logger.warn(`Failed to expire subscription for vendor ${sub.vendorId}: ${err.message}`);
            }
        }

        // Also expire active trials
        const expiredTrials = await Subscription.find({
            isTrialActive: true,
            trialEndsAt: { $lte: now },
        }).lean();

        for (const sub of expiredTrials) {
            try {
                const update = { isTrialActive: false };
                if (sub.status === 'active' && sub.expiryDate <= now) {
                    update.status = 'expired';
                    await Vendor.findByIdAndUpdate(sub.vendorId, {
                        'subscription.isActive': false,
                    });
                }
                await Subscription.findByIdAndUpdate(sub._id, update);
                logger.info(`⏰ Trial expired: vendor ${sub.vendorId}`);
            } catch (err) {
                logger.warn(`Failed to expire trial for vendor ${sub.vendorId}: ${err.message}`);
            }
        }

        if (count > 0 || expiredTrials.length > 0) {
            logger.info(`⏰ Expired: ${count} subscriptions, ${expiredTrials.length} trials`);
        }

        return { expiredCount: count, trialsExpired: expiredTrials.length };
    } catch (err) {
        logger.error('Auto-Expire Subscriptions Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 5️⃣ REMIND EXPIRING SUBSCRIPTIONS
// NOTIFICATION GAP FIX — the "subscription expiring soon" event named in
// the audit had no producer at all. One-shot per expiry cycle, guarded by
// expiryReminderSentAt (same idempotency pattern as Ticket.slaReminderSentAt),
// which is reset to null on every renewal/activation so the next cycle can
// remind again (see activateVendorSubscription and verifySubscriptionPayment).
// ══════════════════════════════════════════════════════
const REMINDER_WINDOW_DAYS = 3;

export const remindExpiringSubscriptions = async () => {
    try {
        const now = new Date();
        const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

        const dueSoon = await Subscription.find({
            status: 'active',
            expiryDate: { $gte: now, $lte: windowEnd },
            expiryReminderSentAt: null,
        }).select('vendorId plan expiryDate').lean();

        let reminded = 0;
        for (const sub of dueSoon) {
            try {
                const vendor = await Vendor.findById(sub.vendorId).select('userId').lean();
                if (!vendor?.userId) continue;

                await notify({
                    recipientId: vendor.userId,
                    role: 'vendor',
                    type: 'subscription_update',
                    title: 'Subscription Expiring Soon',
                    message: `Your ${sub.plan} plan expires on ${sub.expiryDate.toLocaleDateString('en-IN')}. Renew now to avoid interruption.`,
                    priority: 'high',
                    meta: { plan: sub.plan, expiryDate: sub.expiryDate.toISOString() },
                });

                await Subscription.findByIdAndUpdate(sub._id, { expiryReminderSentAt: now });
                reminded++;
            } catch (err) {
                logger.warn(`Failed to remind vendor ${sub.vendorId}: ${err.message}`);
            }
        }

        if (reminded > 0) logger.info(`⏰ Reminded ${reminded} vendor(s) of upcoming subscription expiry`);
        return { reminded };
    } catch (err) {
        logger.error('Remind Expiring Subscriptions Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 6️⃣ RECONCILE VENDOR WALLETS
// WALLET LEDGER — compares each vendor's materialized Vendor.walletBalance
// against SUM(VendorWalletTransaction) for that vendor. Read-only: this
// job NEVER writes to walletBalance or the ledger — a mismatch means
// something upstream (a bug, a partial deploy, manual DB surgery) broke
// the "credit/debit and balance update commit together in one
// transaction" guarantee vendorWalletService.js is supposed to provide,
// and that deserves a human looking at it, not a silent auto-correction
// that could paper over a real bug or, worse, a real fraud attempt.
// ══════════════════════════════════════════════════════
export const reconcileVendorWallets = async () => {
    try {
        const sums = await VendorWalletTransaction.aggregate([
            {
                $group: {
                    _id: '$vendorId',
                    credited: { $sum: { $cond: [{ $in: ['$type', ['settlement_credit', 'manual_credit', 'opening_balance']] }, '$amount', 0] } },
                    debited: { $sum: { $cond: [{ $in: ['$type', ['withdrawal_debit', 'manual_debit', 'refund_adjustment', 'chargeback']] }, '$amount', 0] } },
                },
            },
            { $project: { ledgerBalance: { $subtract: ['$credited', '$debited'] } } },
        ]);

        if (!sums.length) return { vendorsChecked: 0, mismatches: [] };

        const vendorIds = sums.map((s) => s._id);
        const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select('walletBalance shopName').lean();
        const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

        const TOLERANCE = 0.01; // paise-level float rounding, not a real mismatch
        const mismatches = [];
        for (const s of sums) {
            const vendor = vendorMap.get(String(s._id));
            if (!vendor) continue; // vendor deleted after transactions existed — not this job's concern
            const diff = Math.round((vendor.walletBalance - s.ledgerBalance) * 100) / 100;
            if (Math.abs(diff) > TOLERANCE) {
                mismatches.push({
                    vendorId: String(s._id),
                    shopName: vendor.shopName,
                    walletBalance: vendor.walletBalance,
                    ledgerBalance: Math.round(s.ledgerBalance * 100) / 100,
                    diff,
                });
            }
        }

        if (mismatches.length > 0) {
            logger.error(`🚨 WALLET RECONCILIATION: ${mismatches.length} vendor(s) with balance/ledger mismatch`, mismatches);
        } else {
            logger.info(`✅ Wallet reconciliation clean — ${sums.length} vendor(s) checked, 0 mismatches`);
        }

        return { vendorsChecked: sums.length, mismatches };
    } catch (err) {
        logger.error('Reconcile Vendor Wallets Error:', err);
        throw { message: err.message };
    }
};
