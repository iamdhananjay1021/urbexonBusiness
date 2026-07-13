/**
 * assignmentEngine.js — Zepto-style Smart Order Assignment v2.2
 * ✅ FIXED: Removed LOCAL_RIDER provider hard check — now works for ALL URBEXON_HOUR orders
 * ✅ FIXED (v2.2): _findNearestRiders scoring block now treats geoLocation's
 *    [0,0] schema-default sentinel as "no location known" — matching the
 *    same fix already applied in handleRiderAccept/adminForceAssign. A
 *    rider who never sent a real GPS fix was getting geoLocation's
 *    default [0,0] coordinate treated as real, producing a bogus
 *    "~9264km away" distance in the rider's order-request popup.
 *
 * Flow:
 *  1. Order READY_FOR_PICKUP → startAssignment()
 *  2. Find nearest available riders (2dsphere geo → haversine fallback)
 *  3. Sort by distance ASC, rating DESC, acceptance rate DESC
 *  4. Broadcast to top N riders simultaneously (Zepto-style)
 *  5. First rider to accept wins → atomic DB lock (findOneAndUpdate)
 *  6. Others get "order taken" notification
 *  7. No accepts in 30s → next batch of riders
 *  8. 3 full rounds → FAILED status + admin alert
 */

import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import Order from "../models/Order.js";
import { broadcastToAdmins } from "../utils/wsHub.js";
// FIX (Vendor→Delivery realtime bug): rider-facing WS events
// (rider:order_request, rider:order_taken, rider:offer_expired,
// rider:order_assigned) were going through wsHub.sendToUser() directly —
// raw, one-shot, no retry, no queue. Delivery riders are on mobile
// (background app kills, network switches between 4G/WiFi, screen-off
// battery throttling), so this silently dropped the order offer whenever
// the rider's socket was mid-reconnect at the exact moment of broadcast —
// no retry, no persistence. sendNotification (aliased here as sendToUser,
// from notificationQueue.js) wraps the same underlying wsHub call but
// auto-queues on failed delivery, retries with backoff (2s/5s/15s), and
// auto-flushes the queue the moment the rider's socket reconnects
// (flushQueueForUser, already wired into wsHub.js's connection handler).
// Aliased to `sendToUser` so every existing call site below needs zero
// changes.
import { sendNotification as sendToUser } from "../utils/notificationQueue.js";
import { sendNewOrderPush } from "./fcmService.js";
import { DELIVERY_CONFIG } from "../config/deliveryConfig.js";
import { getRedis, isRedisUp } from "../config/redis.js";
import { haversineKm as _haversineKm } from "./geoEngine.js";
import { notifyOrderStakeholders } from "./orderEngine.js";

/* ─── Constants ──────────────────────────────────── */
const ASSIGNMENT_TIMEOUT_MS = 30_000;
const RIDERS_PER_BATCH = 3;
const MAX_ROUNDS = 3;
const ROUND_DELAY_MS = 60_000;
export const MAX_ACTIVE_ORDERS = 1;
const REDIS_LOCK_TTL = 900;
const REDIS_PENDING_TTL = Math.ceil(ASSIGNMENT_TIMEOUT_MS / 1000) + 10;

/* ─── In-memory assignment state ─────────────────── */
const activeAssignments = new Map();

/* ═══════════════════════════════════════════════════
   PUBLIC: startAssignment
═══════════════════════════════════════════════════ */
export const startAssignment = async (orderId) => {
    const key = String(orderId);

    // 1. In-memory duplicate guard
    if (activeAssignments.has(key)) {
        console.log(`[Assignment] Already running for order ${key} — skipping`);
        return;
    }

    // 2. Redis distributed lock
    if (isRedisUp()) {
        try {
            const existing = await getRedis().get(`assignment:${key}:locked`);
            if (existing) {
                console.log(`[Assignment] Redis lock exists for order ${key} — skipping`);
                return;
            }
        } catch (err) {
            console.warn(`[Assignment] Redis lock check failed: ${err.message}`);
        }
    }

    // 3. Validate order
    let order;
    try {
        order = await Order.findById(orderId).lean();
    } catch (err) {
        console.error(`[Assignment] DB error fetching order ${key}: ${err.message}`);
        return;
    }

    if (!order) {
        console.warn(`[Assignment] Order ${key} not found`);
        return;
    }
    if (order.delivery?.assignedTo) {
        console.log(`[Assignment] Order ${key} already assigned — skipping`);
        return;
    }
    // BUG FIX: this used to also allow PLACED/CONFIRMED/PACKED, which let a
    // premature caller (orderKickoff.js, now removed) broadcast a brand new
    // order to riders before the vendor had even accepted or packed it —
    // exactly the "delivery panel gets notified with no vendor accept/pack"
    // symptom. Assignment must only ever start once the vendor has actually
    // marked the order ready — this is the single, defense-in-depth gate
    // regardless of which caller invokes startAssignment.
    const allowedStatuses = ["READY_FOR_PICKUP"];
    if (!allowedStatuses.includes(order.orderStatus)) {
        console.log(`[Assignment] Order ${key} status is ${order.orderStatus} — must be one of: ${allowedStatuses.join(", ")}`);
        return;
    }

    // ✅ FIXED: Check orderMode instead of delivery.provider
    // Only URBEXON_HOUR orders need auto-assignment
    if (order.orderMode !== "URBEXON_HOUR") {
        console.log(`[Assignment] Order ${key} is not URBEXON_HOUR (mode: ${order.orderMode}) — skipping`);
        return;
    }

    // ✅ FIXED: Skip vendor-self delivery orders
    if (order.delivery?.provider === "VENDOR_SELF") {
        console.log(`[Assignment] Order ${key} is VENDOR_SELF delivery — skipping auto-assignment`);
        return;
    }

    // 4. Set SEARCHING_RIDER status + Redis lock
    try {
        await Order.findByIdAndUpdate(orderId, {
            "delivery.status": "SEARCHING_RIDER",
            // ✅ Ensure provider is set to LOCAL_RIDER for tracking
            "delivery.provider": "LOCAL_RIDER",
        });
    } catch (err) {
        console.error(`[Assignment] Failed to update order ${key} to SEARCHING_RIDER: ${err.message}`);
        return;
    }

    await _setRedisLock(key);

    // BUG FIX: this used to be broadcastToUsers([], ...) — an empty
    // recipient array that silently notified nobody. Route through the
    // centralized engine so the customer AND vendor both see "Finding a
    // rider…" instantly instead of only finding out once one is assigned.
    notifyOrderStakeholders(order, "delivery_status_update", {
        status: order.orderStatus,
        deliveryStatus: "SEARCHING_RIDER",
    }).catch((err) => console.error(`[Assignment] notifyOrderStakeholders (SEARCHING_RIDER) failed: ${err.message}`));

    // 5. Build context + run
    const ctx = {
        orderId: key,
        round: 0,
        candidates: [],
        pendingRiders: new Set(),
        timer: null,
        cancelled: false,
    };
    activeAssignments.set(key, ctx);

    try {
        await _runRound(ctx);
    } catch (err) {
        console.error(`[Assignment] Unhandled error in round 1 for order ${key}: ${err.message}`);
        await _markFailed(key);
        await _cleanup(ctx);
    }
};

/* ═══════════════════════════════════════════════════
   PUBLIC: handleRiderAccept
═══════════════════════════════════════════════════ */
export const handleRiderAccept = async (orderId, riderId, riderUserId) => {
    const key = String(orderId);

    let rider;
    try {
        rider = await DeliveryBoy.findById(riderId);
    } catch (err) {
        return { success: false, message: "DB error fetching rider" };
    }
    if (!rider) return { success: false, message: "Rider not found" };

    // BUG FIX: manual accept (this function) never enforced the same
    // online/capacity/radius gates that the auto-assignment candidate query
    // (_findNearestRiders) already enforces — an offline rider, or one
    // already at MAX_ACTIVE_ORDERS, could still claim an order via the
    // "Available" list, and a rider hundreds of km away could accept an
    // order with no distance check at all (radius is otherwise only
    // enforced at checkout, never at delivery-claim time).
    if (!rider.isOnline) return { success: false, message: "Go online to accept orders" };
    if ((rider.activeOrders || 0) >= MAX_ACTIVE_ORDERS) {
        return { success: false, message: "Finish your current delivery before accepting another" };
    }

    // ✅ NEW: distanceKm calculate karo taaki OrderDetails.jsx me "Distance" dikhe
    //
    // BUG FIX: geoLocation.coordinates defaults to [0, 0] on the schema (a
    // rider who has never sent a real GPS fix still "has" this value) — the
    // `??` fallback here only skips null/undefined, so a rider with
    // location.lat === null fell through to geoLocation's [0,0] default and
    // that got treated as a REAL coordinate (Gulf of Guinea). Distance from
    // anywhere in India to (0,0) is ~9000+ km, which is exactly the bogus
    // "Order is 9264.6km away" rejection this was producing for any rider
    // who simply hadn't sent a location update yet. Explicitly treat the
    // [0,0] sentinel as "no location known", same as null/undefined.
    let distanceKm = null;
    try {
        const orderForDistance = await Order.findById(orderId).select("latitude longitude").lean();
        const orderLat = orderForDistance?.latitude || DELIVERY_CONFIG.SHOP_LAT;
        const orderLng = orderForDistance?.longitude || DELIVERY_CONFIG.SHOP_LNG;

        let riderLat = rider.location?.lat;
        let riderLng = rider.location?.lng;
        if (riderLat == null || riderLng == null) {
            const [geoLng, geoLat] = rider.geoLocation?.coordinates || [];
            if (geoLat != null && geoLng != null && !(geoLat === 0 && geoLng === 0)) {
                riderLat = geoLat;
                riderLng = geoLng;
            }
        }

        if (riderLat != null && riderLng != null && !(riderLat === 0 && riderLng === 0)) {
            distanceKm = Math.round(_haversineKm(orderLat, orderLng, riderLat, riderLng) * 10) / 10;
        }
    } catch (err) {
        console.warn(`[Assignment] Failed to compute distanceKm for order ${key}: ${err.message}`);
    }

    const maxKm = DELIVERY_CONFIG.URBEXON_HOUR?.MAX_RADIUS_KM || 10;
    if (distanceKm != null && distanceKm > maxKm) {
        return { success: false, message: `Order is ${distanceKm}km away — outside the ${maxKm}km delivery radius` };
    }

    // ✅ FIXED: Atomic claim — removed delivery.provider check so any UH order can be accepted
    let order;
    try {
        order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                "delivery.assignedTo": null,
                orderMode: "URBEXON_HOUR",
                orderStatus: { $in: ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP"] },
            },
            {
                $set: {
                    "delivery.assignedTo": rider._id,
                    "delivery.riderName": rider.name,
                    "delivery.riderPhone": rider.phone,
                    "delivery.assignedAt": new Date(),
                    "delivery.status": "ASSIGNED",   // ✅ FIXED: was "RIDER_ASSIGNED" — not in schema enum, broke frontend progress widget
                    "delivery.provider": "LOCAL_RIDER",
                    ...(distanceKm != null && { "delivery.distanceKm": distanceKm }), // ✅ NEW
                },
            },
            { new: true, runValidators: true }   // ✅ FIXED: runValidators added — catches future enum mismatches immediately instead of silently saving bad data
        );
    } catch (err) {
        console.error(`[Assignment] Order update failed: ${err.message}`);
        return { success: false, message: "DB error during assignment" };
    }

    if (!order) {
        sendToUser(String(riderUserId), "rider:order_taken", { orderId: key });
        return { success: false, message: "Order already taken by another rider" };
    }

    try {
        await DeliveryBoy.findByIdAndUpdate(riderId, { $inc: { activeOrders: 1 } });
    } catch (err) {
        console.warn(`[Assignment] Failed to increment activeOrders for rider ${riderId}: ${err.message}`);
    }

    const ctx = activeAssignments.get(key);
    if (ctx) {
        ctx.cancelled = true;
        clearTimeout(ctx.timer);
        for (const uid of ctx.pendingRiders) {
            if (String(uid) !== String(riderUserId)) {
                sendToUser(String(uid), "rider:order_taken", { orderId: key });
            }
        }
        await _cleanup(ctx);
    }

    await _clearRedisLock(key);

    // BUG FIX: this used to be a raw sendToUser() to the customer only
    // (no DB persistence, no vendor) PLUS a broadcastToUsers([], ...) that
    // notified nobody at all — the vendor never learned a rider had been
    // assigned. Route through the centralized engine so customer AND
    // vendor both get it, exactly once, with proper persistence.
    notifyOrderStakeholders(order, "rider_assigned", {
        status: order.orderStatus,
        deliveryStatus: "ASSIGNED",
        riderName: rider.name,
        riderId: String(rider._id),
        distanceKm,
        message: `${rider.name} has been assigned to pick up your order.`,
    }).catch((err) => console.error(`[Assignment] notifyOrderStakeholders (ASSIGNED) failed: ${err.message}`));

    console.log(`[Assignment] ✅ Order ${key} assigned to ${rider.name}`);
    return { success: true, order, rider };
};

/* ═══════════════════════════════════════════════════
   PUBLIC: handleRiderReject
═══════════════════════════════════════════════════ */
export const handleRiderReject = async (orderId, riderId) => {
    const key = String(orderId);

    try {
        await Order.findByIdAndUpdate(orderId, {
            $addToSet: { "delivery.rejectedBy": riderId },
        });
    } catch (err) {
        console.warn(`[Assignment] Failed to add ${riderId} to rejectedBy for order ${key}: ${err.message}`);
    }

    const ctx = activeAssignments.get(key);
    if (ctx) {
        ctx.pendingRiders.delete(String(riderId));
        if (ctx.pendingRiders.size === 0) {
            clearTimeout(ctx.timer);
            await _runRound(ctx).catch((err) => {
                console.error(`[Assignment] Error in round after rejection: ${err.message}`);
            });
        }
    }

    console.log(`[Assignment] Rider ${riderId} rejected order ${key}`);
};

/* ═══════════════════════════════════════════════════
   PUBLIC: releaseRiderSlot
   Atomically decrements a rider's activeOrders, floored at 0, in a single
   update — no separate floor-correction round trip, so there's no window
   for a concurrent decrement to push the counter negative before the floor
   correction lands. Used by every cancellation path that unassigns a rider
   (admin cancel, vendor cancel) so a stale/cancelled order can never leave
   a rider's slot permanently occupied.
═══════════════════════════════════════════════════ */
export const releaseRiderSlot = async (riderId) => {
    if (!riderId) return;
    try {
        await DeliveryBoy.updateOne(
            { _id: riderId },
            [{ $set: { activeOrders: { $max: [{ $subtract: ["$activeOrders", 1] }, 0] } } }]
        );
    } catch (err) {
        console.warn(`[Assignment] Failed to release rider slot for ${riderId}: ${err.message}`);
    }
};

/* ═══════════════════════════════════════════════════
   PUBLIC: handleRiderCancel (mid-delivery)
═══════════════════════════════════════════════════ */
export const handleRiderCancel = async (orderId, riderId, reason = "") => {
    const key = String(orderId);

    let order;
    try {
        order = await Order.findById(orderId);
    } catch (err) {
        console.error(`[Assignment] DB error fetching order ${key} for cancel: ${err.message}`);
        return;
    }
    if (!order) return;

    try {
        await Order.findByIdAndUpdate(orderId, {
            $set: {
                "delivery.assignedTo": null,
                "delivery.riderName": "",
                "delivery.riderPhone": "",
                "delivery.assignedAt": null,
                "delivery.status": "SEARCHING_RIDER",
            },
            $addToSet: { "delivery.rejectedBy": riderId },
        });
    } catch (err) {
        console.error(`[Assignment] Failed to unassign rider for order ${key}: ${err.message}`);
        return;
    }

    try {
        await DeliveryBoy.findByIdAndUpdate(riderId, {
            $inc: { activeOrders: -1 },
            $max: { activeOrders: 0 },
        });
    } catch (err) {
        console.warn(`[Assignment] Failed to decrement activeOrders for rider ${riderId}: ${err.message}`);
    }

    // BUG FIX: this used to notify only the customer via a raw sendToUser —
    // the vendor had no idea their assigned rider dropped the order and a
    // re-search had started. Route through the centralized engine instead.
    notifyOrderStakeholders(order, "delivery_status_update", {
        status: "READY_FOR_PICKUP",
        deliveryStatus: "SEARCHING_RIDER",
        message: "We're finding a new delivery partner for your order.",
    }).catch((err) => console.error(`[Assignment] notifyOrderStakeholders (rider cancel) failed: ${err.message}`));

    console.log(`[Assignment] Rider ${riderId} cancelled order ${key}. Reason: ${reason}. Reassigning...`);

    const oldCtx = activeAssignments.get(key);
    if (oldCtx) {
        oldCtx.cancelled = true;
        clearTimeout(oldCtx.timer);
        activeAssignments.delete(key);
    }
    await _clearRedisLock(key);

    setTimeout(() => {
        startAssignment(orderId).catch((err) => {
            console.error(`[Assignment] Reassignment failed for order ${key}: ${err.message}`);
        });
    }, 3000);
};

/* ═══════════════════════════════════════════════════
   PUBLIC: adminForceAssign
═══════════════════════════════════════════════════ */
export const adminForceAssign = async (orderId, riderId) => {
    const key = String(orderId);

    let rider;
    try {
        rider = await DeliveryBoy.findById(riderId);
    } catch (err) {
        return { success: false, message: "DB error fetching rider" };
    }
    if (!rider) return { success: false, message: "Rider not found" };
    if (rider.status !== "approved") return { success: false, message: "Rider not approved" };

    let currentOrder;
    try {
        currentOrder = await Order.findById(orderId).select("delivery orderStatus orderMode latitude longitude").lean();
    } catch (err) {
        return { success: false, message: "DB error fetching order" };
    }
    if (!currentOrder) return { success: false, message: "Order not found" };

    if (currentOrder.orderStatus !== "READY_FOR_PICKUP" && currentOrder.orderStatus !== "CONFIRMED") {
        return { success: false, message: "Order must be READY_FOR_PICKUP or CONFIRMED before assigning a rider" };
    }

    // BUG FIX: this used `??`, which only skips null/undefined — a rider
    // who never sent a real GPS fix still "has" geoLocation.coordinates
    // defaulting to [0,0] on the schema, so it got treated as a real
    // coordinate (same [0,0]-sentinel bug already fixed in
    // handleRiderAccept, but missed here since this is a separate
    // code path).
    let distanceKm = null;
    try {
        const orderLat = currentOrder.latitude || DELIVERY_CONFIG.SHOP_LAT;
        const orderLng = currentOrder.longitude || DELIVERY_CONFIG.SHOP_LNG;

        let riderLat = rider.location?.lat;
        let riderLng = rider.location?.lng;
        if (riderLat == null || riderLng == null) {
            const [geoLng, geoLat] = rider.geoLocation?.coordinates || [];
            if (geoLat != null && geoLng != null && !(geoLat === 0 && geoLng === 0)) {
                riderLat = geoLat;
                riderLng = geoLng;
            }
        }

        if (riderLat != null && riderLng != null && !(riderLat === 0 && riderLng === 0)) {
            distanceKm = Math.round(_haversineKm(orderLat, orderLng, riderLat, riderLng) * 10) / 10;
        }
    } catch (err) {
        console.warn(`[Assignment] Failed to compute distanceKm for force-assign ${key}: ${err.message}`);
    }

    let order;
    try {
        order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                "delivery.assignedTo": null,
                orderStatus: { $in: ["READY_FOR_PICKUP", "CONFIRMED"] },
            },
            {
                $set: {
                    "delivery.assignedTo": rider._id,
                    "delivery.riderName": rider.name,
                    "delivery.riderPhone": rider.phone,
                    "delivery.assignedAt": new Date(),
                    "delivery.status": "ASSIGNED",   // ✅ already correct here, kept as-is
                    "delivery.provider": "LOCAL_RIDER",
                    ...(distanceKm != null && { "delivery.distanceKm": distanceKm }), // ✅ NEW
                },
            },
            { new: true, runValidators: true }
        );
    } catch (err) {
        return { success: false, message: "DB error during force assign" };
    }

    if (!order) return { success: false, message: "Order already assigned or state changed" };

    try {
        await DeliveryBoy.findByIdAndUpdate(riderId, { $inc: { activeOrders: 1 } });
    } catch (err) {
        console.warn(`[Assignment] Failed to increment activeOrders for rider ${riderId}: ${err.message}`);
    }

    const ctx = activeAssignments.get(key);
    if (ctx) {
        ctx.cancelled = true;
        clearTimeout(ctx.timer);
        for (const uid of ctx.pendingRiders) {
            sendToUser(String(uid), "rider:order_taken", { orderId: key });
        }
        await _cleanup(ctx);
    }
    await _clearRedisLock(key);

    sendToUser(String(rider.userId), "rider:order_assigned", {
        orderId: key,
        message: "Admin assigned you a new order",
    });
    if (rider.fcmToken) {
        sendNewOrderPush(rider.fcmToken, {
            orderId: key,
            amount: order.totalAmount,
            items: order.items?.length || 0,
            address: order.address?.slice(0, 100) || "",
        }).catch(() => { });
    }

    // BUG FIX: was broadcastToUsers([], ...) — notified nobody. Customer
    // and vendor both need to see the admin-forced assignment instantly.
    notifyOrderStakeholders(order, "rider_assigned", {
        status: order.orderStatus,
        deliveryStatus: "ASSIGNED",
        riderName: rider.name,
        riderId: String(rider._id),
        distanceKm,
        forcedByAdmin: true,
        message: `${rider.name} has been assigned to pick up your order.`,
    }).catch((err) => console.error(`[Assignment] notifyOrderStakeholders (force-assign) failed: ${err.message}`));

    console.log(`[Assignment] Admin force-assigned order ${key} to ${rider.name}`);
    return { success: true, order, rider };
};

/* ═══════════════════════════════════════════════════
   PUBLIC: cancelAssignment
═══════════════════════════════════════════════════ */
export const cancelAssignment = async (orderId) => {
    const key = String(orderId);
    const ctx = activeAssignments.get(key);
    if (ctx) {
        ctx.cancelled = true;
        clearTimeout(ctx.timer);
        for (const uid of ctx.pendingRiders) {
            sendToUser(String(uid), "rider:offer_expired", { orderId: key });
        }
        await _cleanup(ctx);
    }
    await _clearRedisLock(key);
    console.log(`[Assignment] Cancelled assignment for order ${key}`);
};

/* ═══════════════════════════════════════════════════
   PUBLIC: status helpers
═══════════════════════════════════════════════════ */
export const getAssignmentStatus = (orderId) => {
    const ctx = activeAssignments.get(String(orderId));
    if (!ctx) return { active: false };
    return {
        active: true,
        round: ctx.round,
        pendingRiders: ctx.pendingRiders.size,
        totalCandidates: ctx.candidates.length,
    };
};

export const getActiveAssignments = () => {
    const result = [];
    for (const [orderId, ctx] of activeAssignments) {
        result.push({
            orderId,
            round: ctx.round,
            pendingRiders: ctx.pendingRiders.size,
            totalCandidates: ctx.candidates.length,
        });
    }
    return result;
};

/* ═══════════════════════════════════════════════════
   PRIVATE: _runRound
═══════════════════════════════════════════════════ */
const _runRound = async (ctx) => {
    if (ctx.cancelled) return _cleanup(ctx);

    ctx.round++;
    console.log(`[Assignment] Round ${ctx.round}/${MAX_ROUNDS} for order ${ctx.orderId}`);

    if (ctx.round > MAX_ROUNDS) {
        await _markFailed(ctx.orderId);
        await _cleanup(ctx);
        return;
    }

    let order;
    try {
        order = await Order.findById(ctx.orderId)
            .select("delivery orderStatus orderMode latitude longitude totalAmount items address customerName phone")
            .lean();
    } catch (err) {
        console.error(`[Assignment] DB error fetching order ${ctx.orderId} in round: ${err.message}`);
        await _cleanup(ctx);
        return;
    }

    if (!order) {
        console.warn(`[Assignment] Order ${ctx.orderId} not found in round ${ctx.round}`);
        await _cleanup(ctx);
        return;
    }
    if (order.delivery?.assignedTo) {
        console.log(`[Assignment] Order ${ctx.orderId} assigned externally — stopping`);
        await _cleanup(ctx);
        return;
    }
    if (order.orderStatus === "CANCELLED") {
        console.log(`[Assignment] Order ${ctx.orderId} cancelled — stopping`);
        await _cleanup(ctx);
        return;
    }

    let candidates;
    try {
        candidates = await _findNearestRiders(order);
    } catch (err) {
        console.error(`[Assignment] Error finding riders for order ${ctx.orderId}: ${err.message}`);
        candidates = [];
    }

    if (candidates.length === 0) {
        console.log(`[Assignment] No riders available — round ${ctx.round}, retrying in ${ROUND_DELAY_MS / 1000}s`);
        // BUG FIX: was broadcastToUsers([], ...) — notified nobody. This is
        // an ops-visibility signal (mid-retry, not yet a final failure) so
        // only admins need to see it — customer/vendor would just be noise
        // every retry round.
        broadcastToAdmins("assignment:no_riders", {
            orderId: ctx.orderId,
            round: ctx.round,
            maxRounds: MAX_ROUNDS,
        });

        if (ctx.round >= MAX_ROUNDS) {
            await _markFailed(ctx.orderId);
            await _cleanup(ctx);
            return;
        }

        ctx.timer = setTimeout(() => {
            _runRound(ctx).catch((err) => {
                console.error(`[Assignment] Error in scheduled round: ${err.message}`);
            });
        }, ROUND_DELAY_MS);
        return;
    }

    ctx.candidates = candidates;
    ctx.pendingRiders = new Set(candidates.map((r) => String(r.userId)));

    await _broadcastToRiders(ctx, order);
};

/* ═══════════════════════════════════════════════════
   PRIVATE: _broadcastToRiders
═══════════════════════════════════════════════════ */
const _broadcastToRiders = async (ctx, order) => {
    if (ctx.cancelled) return;

    const payload = {
        orderId: ctx.orderId,
        amount: order.totalAmount || 0,
        items: order.items?.length || 0,
        address: (order.address || "").slice(0, 100),
        customerName: order.customerName || "",
        timeout: ASSIGNMENT_TIMEOUT_MS / 1000,
    };

    try {
        await Order.findByIdAndUpdate(ctx.orderId, {
            $inc: { "delivery.assignmentAttempts": ctx.candidates.length },
        });
    } catch { /* non-fatal */ }

    const notifyPromises = ctx.candidates.map(async (rider) => {
        const riderPayload = { ...payload, distanceKm: rider.distance || 0 };
        sendToUser(String(rider.userId), "rider:order_request", riderPayload);
        if (rider.fcmToken) {
            sendNewOrderPush(rider.fcmToken, riderPayload).catch(() => { });
        }
        console.log(`[Assignment] Notified rider ${rider.name} (${rider.distance}km, ★${rider.rating || 5}) for order ${ctx.orderId}`);
    });

    await Promise.allSettled(notifyPromises);

    if (isRedisUp()) {
        try {
            await getRedis().setex(
                `assignment:${ctx.orderId}:pending`,
                REDIS_PENDING_TTL,
                JSON.stringify({
                    round: ctx.round,
                    riderIds: ctx.candidates.map((r) => String(r._id)),
                    offeredAt: Date.now(),
                })
            );
        } catch { /* non-fatal */ }
    }

    ctx.timer = setTimeout(async () => {
        if (ctx.cancelled) return;

        console.log(`[Assignment] Batch timed out for order ${ctx.orderId} (round ${ctx.round})`);

        for (const uid of ctx.pendingRiders) {
            sendToUser(uid, "rider:offer_expired", { orderId: ctx.orderId });
        }

        const nonRespondingIds = ctx.candidates
            .filter((r) => ctx.pendingRiders.has(String(r.userId)))
            .map((r) => r._id);

        if (nonRespondingIds.length > 0) {
            try {
                await Order.findByIdAndUpdate(ctx.orderId, {
                    $addToSet: { "delivery.rejectedBy": { $each: nonRespondingIds } },
                });
            } catch (err) {
                console.warn(`[Assignment] Failed to add timed-out riders to rejectedBy: ${err.message}`);
            }
        }

        ctx.pendingRiders.clear();

        _runRound(ctx).catch((err) => {
            console.error(`[Assignment] Error starting next round: ${err.message}`);
        });
    }, ASSIGNMENT_TIMEOUT_MS);
};

/* ═══════════════════════════════════════════════════
   PRIVATE: _findNearestRiders
═══════════════════════════════════════════════════ */
const _findNearestRiders = async (order) => {
    const orderLat = order.latitude || DELIVERY_CONFIG.SHOP_LAT;
    const orderLng = order.longitude || DELIVERY_CONFIG.SHOP_LNG;
    const maxKm = DELIVERY_CONFIG.URBEXON_HOUR?.MAX_RADIUS_KM || 15;
    const rejectedIds = order.delivery?.rejectedBy || [];

    const baseQuery = {
        status: "approved",
        isOnline: true,
        activeOrders: { $lt: MAX_ACTIVE_ORDERS },
        _id: { $nin: rejectedIds },
    };
    const selectFields = "userId name phone fcmToken location geoLocation rating activeOrders acceptanceRate";

    let riders = [];

    try {
        riders = await DeliveryBoy.find({
            ...baseQuery,
            geoLocation: {
                $nearSphere: {
                    $geometry: { type: "Point", coordinates: [orderLng, orderLat] },
                    $maxDistance: maxKm * 1000,
                },
            },
        })
            .select(selectFields)
            .limit(RIDERS_PER_BATCH * 3)
            .lean();
    } catch (geoErr) {
        console.warn(`[Assignment] 2dsphere query failed, falling back to haversine: ${geoErr.message}`);
    }

    if (riders.length === 0) {
        riders = await _haversineFallback(baseQuery, selectFields, orderLat, orderLng, maxKm);
    }

    if (riders.length === 0) return [];

    // FIX (distance-display bug): a rider who never sent a real GPS fix
    // still "has" geoLocation.coordinates defaulting to [0,0] on the
    // schema — the old `??` fallback only skips null/undefined, so that
    // [0,0] sentinel got treated as a REAL coordinate (a point off the
    // West African coast), producing a bogus "~9264km away" distance in
    // the rider's order-request popup. Mirrors the same [0,0]-sentinel
    // fix already applied in handleRiderAccept/adminForceAssign — a rider
    // with no known location gets distance:999 (same "unknown/far"
    // sentinel used elsewhere in this file) instead of a fabricated
    // real-looking number.
    const scored = riders.map((r) => {
        let rLat = r.location?.lat;
        let rLng = r.location?.lng;
        if (rLat == null || rLng == null) {
            const [geoLng, geoLat] = r.geoLocation?.coordinates || [];
            const hasValidGeo = geoLat != null && geoLng != null && !(geoLat === 0 && geoLng === 0);
            if (hasValidGeo) {
                rLat = geoLat;
                rLng = geoLng;
            } else {
                rLat = null;
                rLng = null;
            }
        }
        const dist = rLat != null && rLng != null ? _haversineKm(orderLat, orderLng, rLat, rLng) : 999;
        return { ...r, distance: Math.round(dist * 10) / 10 };
    });

    scored.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if ((b.rating || 5) !== (a.rating || 5)) return (b.rating || 5) - (a.rating || 5);
        return (b.acceptanceRate || 100) - (a.acceptanceRate || 100);
    });

    return scored.slice(0, RIDERS_PER_BATCH);
};

const _haversineFallback = async (baseQuery, selectFields, orderLat, orderLng, maxKm) => {
    try {
        const allOnline = await DeliveryBoy.find(baseQuery).select(selectFields).lean();
        return allOnline.filter((r) => {
            const rLat = r.location?.lat;
            const rLng = r.location?.lng;
            if (rLat == null || rLng == null) return false;
            return _haversineKm(orderLat, orderLng, rLat, rLng) <= maxKm;
        });
    } catch (err) {
        console.error(`[Assignment] Haversine fallback DB error: ${err.message}`);
        return [];
    }
};


/* ═══════════════════════════════════════════════════
   PRIVATE: helpers
═══════════════════════════════════════════════════ */
const _markFailed = async (orderId) => {
    console.log(`[Assignment] Max rounds reached for order ${orderId} — marking FAILED`);
    // BUG FIX: was broadcastToUsers([], ...) — notified nobody, despite the
    // message literally claiming "Admin notified." Fetch the full order so
    // both admin (ops intervention) and customer/vendor (their order is
    // genuinely stuck) can be told, exactly once each.
    let order = null;
    try {
        order = await Order.findByIdAndUpdate(orderId, { "delivery.status": "FAILED" }, { new: true });
    } catch (err) {
        console.error(`[Assignment] Failed to mark order ${orderId} as FAILED: ${err.message}`);
    }

    broadcastToAdmins("order:status:update", {
        orderId,
        deliveryStatus: "FAILED",
        message: "No delivery partner accepted this order after 3 rounds — manual assignment needed.",
    });

    if (order) {
        notifyOrderStakeholders(order, "delivery_status_update", {
            status: order.orderStatus,
            deliveryStatus: "FAILED",
            message: "We're having trouble finding a delivery partner. Our team has been notified.",
        }).catch((err) => console.error(`[Assignment] notifyOrderStakeholders (FAILED) failed: ${err.message}`));
    }
};

const _cleanup = async (ctx) => {
    if (!ctx) return;
    clearTimeout(ctx.timer);
    activeAssignments.delete(ctx.orderId);
    await _clearRedisLock(ctx.orderId);
};

const _setRedisLock = async (orderId) => {
    if (!isRedisUp()) return;
    try {
        await getRedis().setex(
            `assignment:${orderId}:locked`,
            REDIS_LOCK_TTL,
            JSON.stringify({ startedAt: Date.now() })
        );
    } catch (err) {
        console.warn(`[Assignment] Failed to set Redis lock for ${orderId}: ${err.message}`);
    }
};

const _clearRedisLock = async (orderId) => {
    if (!isRedisUp()) return;
    try {
        await getRedis().del(`assignment:${orderId}:locked`);
        await getRedis().del(`assignment:${orderId}:pending`);
    } catch (err) {
        console.warn(`[Assignment] Failed to clear Redis lock for ${orderId}: ${err.message}`);
    }
};