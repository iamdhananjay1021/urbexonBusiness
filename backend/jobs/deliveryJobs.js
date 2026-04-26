/**
 * 🚚 DELIVERY AUTOMATION JOBS
 * Fallback auto-assign, status updates, availability tracking
 * NOTE: Primary assignment is handled by assignmentEngine.js (real-time).
 *       These jobs are fallback/cleanup for stuck orders.
 */

import Order from '../models/Order.js';
import DeliveryBoy from '../models/deliveryModels/DeliveryBoy.js';
import logger from '../utils/logger.js';
import { startAssignment } from '../services/assignmentEngine.js';

// ══════════════════════════════════════════════════════
// 1️⃣ FALLBACK: RE-TRIGGER ASSIGNMENT FOR STUCK UH ORDERS
// ══════════════════════════════════════════════════════
export const autoAssignDeliveryBoys = async () => {
    try {
        // UH orders that are READY_FOR_PICKUP with no rider assigned and delivery FAILED/SEARCHING
        const stuckOrders = await Order.find({
            orderMode: 'URBEXON_HOUR',
            orderStatus: 'READY_FOR_PICKUP',
            'delivery.assignedTo': { $exists: false },
            'delivery.provider': 'LOCAL_RIDER',
            'delivery.status': { $in: ['FAILED', 'SEARCHING_RIDER'] },
            updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) }, // Stuck > 5 mins
        }).select('_id').lean();

        if (stuckOrders.length === 0) return { assignmentsRetried: 0 };

        let retried = 0;
        for (const order of stuckOrders) {
            try {
                await Order.findByIdAndUpdate(order._id, { 'delivery.status': 'PENDING' });
                startAssignment(order._id).catch(() => { });
                retried++;
                logger.info(`🔄 Re-triggered assignment for stuck UH order ${order._id}`);
            } catch (err) {
                logger.warn(`Failed to re-trigger assignment for order ${order._id}`);
            }
        }

        return { assignmentsRetried: retried };
    } catch (err) {
        logger.error('Auto-Assign Delivery Boys Error:', err);
        throw { message: err.message, critical: true };
    }
};

// ══════════════════════════════════════════════════════
// 2️⃣ CLEANUP: MARK STALE ASSIGNED ORDERS (DISABLED - TOO DANGEROUS)
// ══════════════════════════════════════════════════════
// ⚠️ DISABLED: This job was auto-unassigning riders without admin confirmation.
// This could silently corrupt order state (mark DELIVERED, lose tracking, etc).
//
// To safely handle stale assignments:
// 1. Admin can manually unassign via admin panel
// 2. Rider can manually cancel delivery
// 3. Automated reassignment is NOT safe without explicit admin review
//
// If you need to handle stale assignments, add proper alerting first.
export const updateDeliveryStatus = async () => {
    // NOOP: Disabled for safety
    return { statusUpdates: 0, disabled: true, reason: "Safety guard - manual admin review required" };
};

// ══════════════════════════════════════════════════════
// 3️⃣ AUTO-UPDATE DELIVERY BOY AVAILABILITY
// ══════════════════════════════════════════════════════
export const updateDeliveryBoyAvailability = async () => {
    try {
        // Check delivery boys inactive for > 30 mins
        const inactiveBoys = await DeliveryBoy.find({
            isOnline: true,
            lastActivityAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
        }).select('_id name');

        let updated = 0;

        for (const boy of inactiveBoys) {
            try {
                await DeliveryBoy.findByIdAndUpdate(boy._id, {
                    isOnline: false,
                    offlineReason: 'Auto-offline - no activity',
                    offlineAt: new Date(),
                });

                logger.info(`🔴 Delivery boy ${boy.name} marked offline (no activity)`);
                updated++;
            } catch (err) {
                logger.warn(`Failed to update delivery boy ${boy._id}`);
            }
        }

        if (updated > 0) {
            logger.info(`🔴 Marked ${updated} delivery boys as offline`);
        }

        return { boysMarkedOffline: updated };
    } catch (err) {
        logger.error('Update Delivery Boy Availability Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 4️⃣ SEND DELIVERY BOY PERFORMANCE REPORTS
// ══════════════════════════════════════════════════════
export const sendDeliveryBoyReports = async () => {
    try {
        const boys = await DeliveryBoy.find({
            status: 'approved',
        }).select('_id name email totalDeliveries rating');

        let sent = 0;

        for (const boy of boys) {
            try {
                // Calculate stats
                const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                const completedOrders = await Order.countDocuments({
                    'delivery.assignedTo': boy._id,
                    orderStatus: 'DELIVERED',
                    createdAt: { $gte: thisMonth },
                });

                const avgRating = boy.rating || 0;

                logger.info(
                    `📊 ${boy.name}: ${completedOrders} deliveries, ${avgRating.toFixed(1)}/5 rating this month`
                );
                sent++;
            } catch (err) {
                logger.warn(`Failed to report for delivery boy ${boy._id}`);
            }
        }

        return { reportsGenerated: sent };
    } catch (err) {
        logger.error('Send Delivery Boy Reports Error:', err);
        throw { message: err.message };
    }
};
