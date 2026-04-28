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
import logger from '../utils/logger.js';

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
                await Vendor.findByIdAndUpdate(sub.vendorId, {
                    'subscription.isActive': false,
                    'subscription.expiryDate': sub.expiryDate,
                });

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
