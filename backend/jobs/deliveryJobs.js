/**
 * 🚚 DELIVERY AUTOMATION JOBS
 * Fallback auto-assign, status updates, availability tracking
 * NOTE: Primary assignment is handled by assignmentEngine.js (real-time).
 *       These jobs are fallback/cleanup for stuck orders.
 */

import Order from '../models/Order.js';
import DeliveryBoy from '../models/deliveryModels/DeliveryBoy.js';
import ActiveOrdersReconciliationLog from '../models/ActiveOrdersReconciliationLog.js';
import logger from '../utils/logger.js';
import { startAssignment } from '../services/assignmentEngine.js';
import { broadcastToAdmins } from '../utils/wsHub.js';

// ══════════════════════════════════════════════════════
// 1️⃣ FALLBACK: RE-TRIGGER ASSIGNMENT FOR STUCK UH ORDERS
// ══════════════════════════════════════════════════════
export const autoAssignDeliveryBoys = async () => {
    try {
        // UH orders that are READY_FOR_PICKUP with no rider assigned and delivery FAILED/SEARCHING
        // BUG FIX: was 'delivery.assignedTo': { $exists: false } — the Order
        // schema defaults delivery.assignedTo to null, so Mongoose persists
        // that field on every insert and it always "exists" (with value
        // null). $exists:false can therefore never match a real document,
        // meaning this entire recovery sweep silently found zero orders,
        // forever — any order stuck in SEARCHING_RIDER/FAILED after a
        // backend crash/deploy (which wipes assignmentEngine's in-memory
        // activeAssignments Map) had NO working recovery path.
        const stuckOrders = await Order.find({
            orderMode: 'URBEXON_HOUR',
            orderStatus: 'READY_FOR_PICKUP',
            'delivery.assignedTo': null,
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
// 2️⃣b SAFE REPLACEMENT: ALERT ADMIN ON STALE ASSIGNMENTS
// ══════════════════════════════════════════════════════
// Read-only counterpart to the disabled job above — a rider who force-quit
// or lost connectivity mid-delivery previously left an order stuck ASSIGNED
// forever with nobody informed (confirmed: no other sweep detects this;
// the only path to reassignment is the rider's own explicit cancel action).
// This job NEVER mutates order/rider state — it only tells admin an order
// needs manual attention, which is exactly what the disabled job's own
// comment recommended ("add proper alerting first").
const STALE_ASSIGNED_MS = 25 * 60 * 1000; // no pickup within 25 min of assignment
export const alertStaleAssignedOrders = async () => {
    try {
        const staleOrders = await Order.find({
            orderMode: 'URBEXON_HOUR',
            orderStatus: 'READY_FOR_PICKUP',
            'delivery.status': 'ASSIGNED',
            'delivery.assignedTo': { $ne: null },
            'delivery.assignedAt': { $lt: new Date(Date.now() - STALE_ASSIGNED_MS) },
        }).select('_id delivery.riderName delivery.assignedAt').lean();

        if (staleOrders.length === 0) return { staleOrdersFound: 0 };

        for (const order of staleOrders) {
            broadcastToAdmins('admin:stale_assignment', {
                orderId: order._id,
                riderName: order.delivery?.riderName || '',
                assignedAt: order.delivery?.assignedAt,
                message: `Order assigned to ${order.delivery?.riderName || 'a rider'} but not picked up after 25+ minutes — may need manual reassignment.`,
            });
        }

        logger.warn(`🚨 ${staleOrders.length} order(s) stuck ASSIGNED past ${STALE_ASSIGNED_MS / 60000}min — admin alerted`);
        return { staleOrdersFound: staleOrders.length };
    } catch (err) {
        logger.error('Alert Stale Assigned Orders Error:', err);
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

// ══════════════════════════════════════════════════════
// 5️⃣ RECONCILE activeOrders COUNTER DRIFT
// ══════════════════════════════════════════════════════
// DeliveryBoy.activeOrders is maintained by separate, non-transactional
// $inc/$set writes scattered across assignmentEngine.js/deliveryController.js/
// vendorOrders.js (one write to the Order, a separate write to the
// DeliveryBoy, each independently caught/logged) — it is never computed
// from the actual Order collection on read. That makes it structurally
// able to drift from the real count on a process crash or interrupted
// deploy between the two paired writes, a replica-set rollover that
// commits one write but not the other, or a direct manual DB edit.
// backend/fixRiderCounter.js — a leftover one-off manual-fix script for a
// specific rider — is standing evidence this has already happened once in
// production. This job does NOT run per-assignment and does not touch the
// assignment engine or any order/business logic — it only re-derives the
// counter from ground truth on a schedule and repairs drift if found.
const RECONCILIATION_ALERT_THRESHOLD = 0; // any mismatch is notified — MAX_ACTIVE_ORDERS is 1, so even a single stuck rider is a full outage for that rider
export const reconcileActiveOrders = async () => {
    const startedAt = Date.now();
    try {
        const [realCounts, ridersWithCounter] = await Promise.all([
            // Ground truth: real count of orders each rider is genuinely
            // still actively assigned to (mirrors the "not yet terminal"
            // definition already used by alertStaleAssignedOrders/
            // autoAssignDeliveryBoys above — DELIVERED/FAILED/CANCELLED are
            // terminal on both orderStatus and delivery.status).
            Order.aggregate([
                {
                    $match: {
                        orderMode: 'URBEXON_HOUR',
                        'delivery.assignedTo': { $ne: null },
                        orderStatus: { $nin: ['DELIVERED', 'CANCELLED'] },
                        'delivery.status': { $nin: ['DELIVERED', 'FAILED', 'CANCELLED'] },
                    },
                },
                { $group: { _id: '$delivery.assignedTo', count: { $sum: 1 } } },
            ]),
            // Riders whose stored counter is non-zero — any rider NOT in
            // this set has a stored value of 0 already (the field defaults
            // to 0 and every decrement site floors at 0), so it doesn't
            // need a separate fetch to know its "before" value.
            DeliveryBoy.find({ activeOrders: { $gt: 0 } }).select('_id name activeOrders').lean(),
        ]);

        const realMap = new Map(realCounts.map((r) => [String(r._id), r.count]));
        const storedMap = new Map(ridersWithCounter.map((d) => [String(d._id), d]));
        const allRiderIds = new Set([...realMap.keys(), ...storedMap.keys()]);

        const mismatches = [];
        for (const riderId of allRiderIds) {
            const real = realMap.get(riderId) || 0;
            const stored = storedMap.get(riderId);
            const before = stored?.activeOrders ?? 0;
            if (before === real) continue;

            await DeliveryBoy.updateOne({ _id: riderId }, { $set: { activeOrders: real } });
            mismatches.push({ riderId, riderName: stored?.name || '', before, after: real });
            logger.warn(`[Reconcile] activeOrders drift for rider ${riderId} (${stored?.name || 'unknown'}): stored=${before}, real=${real} — corrected.`);
        }

        const adminsNotified = mismatches.length > RECONCILIATION_ALERT_THRESHOLD;
        if (adminsNotified) {
            broadcastToAdmins('admin:active_orders_drift', {
                mismatchCount: mismatches.length,
                threshold: RECONCILIATION_ALERT_THRESHOLD,
                mismatches,
                message: `${mismatches.length} rider(s) had activeOrders drift corrected — see reconciliation log.`,
            });
        }

        await ActiveOrdersReconciliationLog.create({
            runAt: new Date(),
            ridersChecked: allRiderIds.size,
            mismatchCount: mismatches.length,
            mismatches,
            adminsNotified,
            durationMs: Date.now() - startedAt,
        });

        if (mismatches.length > 0) {
            logger.warn(`[Reconcile] activeOrders: ${mismatches.length}/${allRiderIds.size} rider(s) corrected.`);
        }

        return { ridersChecked: allRiderIds.size, mismatchesFound: mismatches.length, mismatchesRepaired: mismatches.length };
    } catch (err) {
        logger.error('Reconcile Active Orders Error:', err);
        throw { message: err.message };
    }
};
