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
// 2️⃣ CLEANUP: MARK STALE ASSIGNED ORDERS
// ══════════════════════════════════════════════════════
export const updateDeliveryStatus = async () => {
    try {
        // UH orders assigned to a rider but stuck at READY_FOR_PICKUP for > 45 mins
        const staleAssigned = await Order.find({
            orderMode: 'URBEXON_HOUR',
            orderStatus: 'READY_FOR_PICKUP',
            'delivery.assignedTo': { $exists: true },
            'delivery.assignedAt': { $lt: new Date(Date.now() - 45 * 60 * 1000) },
        }).select('_id delivery').lean();

        let updated = 0;
        for (const order of staleAssigned) {
            try {
                // Unassign rider, decrement their active orders, re-trigger
                await Order.findByIdAndUpdate(order._id, {
                    $set: { 'delivery.status': 'PENDING' },
                    $unset: { 'delivery.assignedTo': '', 'delivery.assignedAt': '' },
                });
                if (order.delivery?.assignedTo) {
                    await DeliveryBoy.findByIdAndUpdate(order.delivery.assignedTo, {
                        $inc: { activeOrders: -1 },
                    }).catch(() => { });
                }
                startAssignment(order._id).catch(() => { });
                logger.info(`🔄 Unassigned stale rider from UH order ${order._id}, re-triggering`);
                updated++;
            } catch (err) {
                logger.warn(`Failed to update stale order ${order._id}`);
            }
        }

        if (updated > 0) logger.info(`🚚 Cleaned up ${updated} stale UH delivery assignments`);
        return { statusUpdates: updated };
    } catch (err) {
        logger.error('Update Delivery Status Error:', err);
        throw { message: err.message };
    }
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
