/**
 * 💼 SELLER COMMISSION & PAYOUT AUTOMATION JOBS
 * Calculate commissions, generate payouts, update ratings
 */

import Vendor from '../models/vendorModels/Vendor.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Subscription from '../models/vendorModels/Subscription.js';
import { Settlement } from '../models/vendorModels/Settlement.js';
import logger from '../utils/logger.js';

// COMMISSION CONFIG
const COMMISSION_RATES = {
    standard: 0.10, // 10%
    premium: 0.05,  // 5%
    elite: 0.02,    // 2%
};

// ══════════════════════════════════════════════════════
// 1️⃣ CALCULATE SELLER COMMISSIONS
// ══════════════════════════════════════════════════════
export const calculateSellerCommissions = async () => {
    try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        // Get all completed orders this month
        const orders = await Order.find({
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            status: 'DELIVERED',
            paymentStatus: 'COMPLETED',
            'settlement.calculated': { $ne: true },
        }).select('vendorId total items');

        if (orders.length === 0) {
            return { commissionsCalculated: 0 };
        }

        // Group by vendor
        const vendorSales = {};
        for (const order of orders) {
            if (!vendorSales[order.vendorId]) {
                vendorSales[order.vendorId] = { amount: 0, orders: 0 };
            }
            vendorSales[order.vendorId].amount += order.total;
            vendorSales[order.vendorId].orders += 1;
        }

        let calculated = 0;

        // Calculate commission per vendor
        for (const [vendorId, sales] of Object.entries(vendorSales)) {
            try {
                const vendor = await Vendor.findById(vendorId).select('subscriptionTier');
                const tier = vendor?.subscriptionTier || 'standard';
                const rate = COMMISSION_RATES[tier] || COMMISSION_RATES.standard;
                const commission = sales.amount * rate;

                await Settlement.create({
                    vendorId,
                    month: startOfMonth,
                    totalSales: sales.amount,
                    orders: sales.orders,
                    commissionRate: rate * 100,
                    commission,
                    payout: sales.amount - commission,
                    status: 'PENDING',
                });

                // Mark orders as calculated
                await Order.updateMany(
                    { vendorId, createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
                    { $set: { 'settlement.calculated': true } }
                );

                logger.info(
                    `💼 Calculated commission for ${vendorId}: ₹${commission.toFixed(2)} on ₹${sales.amount}`
                );
                calculated++;
            } catch (err) {
                logger.warn(`Failed to calculate commission for vendor ${vendorId}`);
            }
        }

        return { commissionsCalculated: calculated, totalSettlements: Object.keys(vendorSales).length };
    } catch (err) {
        logger.error('Calculate Commissions Error:', err);
        throw { message: err.message, critical: true };
    }
};

// ══════════════════════════════════════════════════════
// 2️⃣ AUTO-GENERATE PAYOUTS
// ══════════════════════════════════════════════════════
export const autoGeneratePayouts = async () => {
    try {
        // Get all pending settlements (ready to payout)
        const settlements = await Settlement.find({
            status: 'PENDING',
            payout: { $gt: 0 },
        }).select('vendorId payout');

        if (settlements.length === 0) {
            return { payoutsGenerated: 0 };
        }

        let generated = 0;

        for (const settlement of settlements) {
            try {
                // Create payout record
                await Settlement.findByIdAndUpdate(settlement._id, {
                    status: 'APPROVED',
                    approvedAt: new Date(),
                });

                // Future: Integrate with payment gateway (Razorpay account transfer)
                logger.info(`💰 Payout approved for ${settlement.vendorId}: ₹${settlement.payout}`);
                generated++;
            } catch (err) {
                logger.warn(`Failed to generate payout for settlement ${settlement._id}`);
            }
        }

        logger.info(`✅ Generated ${generated}/${settlements.length} payouts`);
        return { payoutsGenerated: generated };
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
        const vendors = await Vendor.find({ isDeleted: { $ne: true } }).select('_id');

        if (vendors.length === 0) {
            return { ratingsUpdated: 0 };
        }

        let updated = 0;

        for (const vendor of vendors) {
            try {
                // Calculate average rating from reviews
                const reviews = await Review.aggregate([
                    { $match: { vendorId: vendor._id } },
                    {
                        $group: {
                            _id: null,
                            avgRating: { $avg: '$rating' },
                            count: { $sum: 1 },
                        },
                    },
                ]);

                if (reviews.length > 0) {
                    const { avgRating, count } = reviews[0];

                    await Vendor.findByIdAndUpdate(vendor._id, {
                        rating: parseFloat(avgRating.toFixed(1)),
                        ratingCount: count,
                    });

                    logger.info(`⭐ Updated ${vendor._id} rating: ${avgRating.toFixed(1)}/5 (${count} reviews)`);
                    updated++;
                }
            } catch (err) {
                logger.warn(`Failed to update rating for vendor ${vendor._id}`);
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
// ══════════════════════════════════════════════════════
export const autoExpireSubscriptions = async () => {
    try {
        const now = new Date();

        // Find active subscriptions that have expired
        const expired = await Subscription.find({
            status: "active",
            expiryDate: { $lte: now },
        });

        if (expired.length === 0) {
            return { expiredCount: 0 };
        }

        let count = 0;
        for (const sub of expired) {
            try {
                sub.status = "expired";
                await sub.save();

                // Sync vendor embedded subscription
                await Vendor.findByIdAndUpdate(sub.vendorId, {
                    "subscription.isActive": false,
                });

                logger.info(`⏰ Subscription expired for vendor ${sub.vendorId} (plan: ${sub.plan})`);
                count++;
            } catch (err) {
                logger.warn(`Failed to expire subscription for vendor ${sub.vendorId}: ${err.message}`);
            }
        }

        // Also expire trials
        const expiredTrials = await Subscription.find({
            isTrialActive: true,
            trialEndsAt: { $lte: now },
        });

        for (const sub of expiredTrials) {
            try {
                sub.isTrialActive = false;
                if (sub.status === "active" && sub.expiryDate <= now) {
                    sub.status = "expired";
                    await Vendor.findByIdAndUpdate(sub.vendorId, {
                        "subscription.isActive": false,
                    });
                }
                await sub.save();
                logger.info(`⏰ Trial expired for vendor ${sub.vendorId}`);
            } catch (err) {
                logger.warn(`Failed to expire trial for vendor ${sub.vendorId}`);
            }
        }

        logger.info(`⏰ Auto-expired ${count} subscriptions, ${expiredTrials.length} trials`);
        return { expiredCount: count, trialsExpired: expiredTrials.length };
    } catch (err) {
        logger.error('Auto-Expire Subscriptions Error:', err);
        throw { message: err.message };
    }
};
