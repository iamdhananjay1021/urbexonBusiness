/**
 * assignmentEngine.js — Smart Zomato-style order assignment
 *
 * Flow:
 *  1. Order placed → status SEARCHING_RIDER
 *  2. Find nearest available riders (geospatial / haversine)
 *  3. Sort by distance ASC, rating DESC
 *  4. Send request to top rider (Socket + FCM push)
 *  5. 30s timer — if no accept → try next rider
 *  6. If all reject/timeout → retry after 60s delay
 *  7. First accept wins (atomic DB lock)
 *
 * Fail-safes:
 *  - Rider cancels mid-delivery → reassign
 *  - Multiple accept → first-write-wins via findOneAndUpdate
 *  - Max 3 full rounds of assignment attempts
 *  - Graceful degradation if FCM unavailable (WebSocket-only)
 */
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import Order from "../models/Order.js";
import { sendToUser, broadcastToUsers } from "../utils/wsHub.js";
import { sendNewOrderPush } from "./fcmService.js";
import { DELIVERY_CONFIG } from "../config/deliveryConfig.js";
import { getRedis, isRedisUp } from "../config/redis.js";

const ASSIGNMENT_TIMEOUT_MS = 30_000;   // 30 sec per rider
const MAX_RIDERS_PER_ROUND = 3;         // top 3 nearest
const MAX_ROUNDS = 3;                   // retry up to 3 full rounds
const ROUND_DELAY_MS = 60_000;          // 60s between rounds
const MAX_ACTIVE_ORDERS = 1;            // rider can handle 1 order at a time

// ── In-memory assignment state (orderId → assignment context) ──
const activeAssignments = new Map();

/**
 * Start the assignment process for an order
 * Called when order status is READY_FOR_PICKUP and delivery.provider is LOCAL_RIDER
 */
export const startAssignment = async (orderId) => {
    // Prevent duplicate assignment processes
    if (activeAssignments.has(String(orderId))) {
        console.log(`[Assignment] Already running for order ${orderId}`);
        return;
    }

    const order = await Order.findById(orderId);
    if (!order) return;
    if (order.delivery?.assignedTo) {
        console.log(`[Assignment] Order ${orderId} already assigned`);
        return;
    }

    // Update delivery status to SEARCHING_RIDER
    await Order.findByIdAndUpdate(orderId, {
        "delivery.status": "SEARCHING_RIDER",
    });

    // Broadcast to admin that we're searching
    broadcastToUsers([], "order:status:update", {
        orderId, deliveryStatus: "SEARCHING_RIDER",
    });

    const ctx = {
        orderId: String(orderId),
        round: 0,
        currentRiderIdx: 0,
        candidates: [],
        timer: null,
        cancelled: false,
    };
    activeAssignments.set(ctx.orderId, ctx);

    await runAssignmentRound(ctx);
};

/**
 * Run one round of assignment (find riders, offer sequentially)
 */
const runAssignmentRound = async (ctx) => {
    if (ctx.cancelled) return cleanup(ctx);
    ctx.round++;

    if (ctx.round > MAX_ROUNDS) {
        console.log(`[Assignment] Max rounds reached for order ${ctx.orderId} — marking FAILED`);
        await Order.findByIdAndUpdate(ctx.orderId, {
            "delivery.status": "FAILED",
        });
        broadcastToUsers([], "order:status:update", {
            orderId: ctx.orderId, deliveryStatus: "FAILED",
        });
        cleanup(ctx);
        return;
    }

    console.log(`[Assignment] Round ${ctx.round} for order ${ctx.orderId}`);

    const order = await Order.findById(ctx.orderId).lean();
    if (!order || order.delivery?.assignedTo || order.orderStatus === "CANCELLED") {
        cleanup(ctx);
        return;
    }

    // Find nearest available riders
    const candidates = await findNearestRiders(order);
    if (candidates.length === 0) {
        console.log(`[Assignment] No riders available for order ${ctx.orderId}, retrying in ${ROUND_DELAY_MS / 1000}s`);

        // Notify admin: no riders
        broadcastToUsers([], "assignment:no_riders", {
            orderId: ctx.orderId,
            round: ctx.round,
        });

        // Schedule next round
        ctx.timer = setTimeout(() => runAssignmentRound(ctx), ROUND_DELAY_MS);
        return;
    }

    ctx.candidates = candidates;
    ctx.currentRiderIdx = 0;
    await offerToNextRider(ctx);
};

/**
 * Find nearest available riders using geospatial query or haversine fallback
 */
const findNearestRiders = async (order) => {
    const orderLat = order.latitude || DELIVERY_CONFIG.SHOP_LAT;
    const orderLng = order.longitude || DELIVERY_CONFIG.SHOP_LNG;
    const maxKm = DELIVERY_CONFIG.URBEXON_HOUR?.MAX_RADIUS_KM || 15;

    // Get already-rejected riders for this order
    const rejectedIds = order.delivery?.rejectedBy || [];

    // Try 2dsphere geo query first
    let riders;
    try {
        riders = await DeliveryBoy.find({
            status: "approved",
            isOnline: true,
            activeOrders: { $lt: MAX_ACTIVE_ORDERS },
            _id: { $nin: rejectedIds },
            geoLocation: {
                $nearSphere: {
                    $geometry: { type: "Point", coordinates: [orderLng, orderLat] },
                    $maxDistance: maxKm * 1000, // meters
                },
            },
        })
            .select("userId name phone fcmToken location geoLocation rating activeOrders")
            .limit(MAX_RIDERS_PER_ROUND * 2) // fetch extras in case some are already busy
            .lean();
    } catch {
        // Fallback to haversine if geo index fails or no geo data
        riders = await findRidersHaversine(orderLat, orderLng, maxKm, rejectedIds);
    }

    // If geo query returned 0 results, try haversine fallback
    if (!riders || riders.length === 0) {
        riders = await findRidersHaversine(orderLat, orderLng, maxKm, rejectedIds);
    }

    // Sort by distance ASC, then rating DESC
    const toRad = d => (d * Math.PI) / 180;
    const hvKm = (lat1, lng1, lat2, lng2) => {
        const R = 6371, dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const scored = riders.map(r => {
        const rLat = r.location?.lat || r.geoLocation?.coordinates?.[1];
        const rLng = r.location?.lng || r.geoLocation?.coordinates?.[0];
        const dist = (rLat && rLng) ? hvKm(orderLat, orderLng, rLat, rLng) : 999;
        return { ...r, distance: Math.round(dist * 10) / 10 };
    });

    scored.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return (b.rating || 5) - (a.rating || 5);
    });

    return scored.slice(0, MAX_RIDERS_PER_ROUND);
};

/**
 * Haversine fallback when 2dsphere index isn't available
 */
const findRidersHaversine = async (orderLat, orderLng, maxKm, rejectedIds) => {
    const allOnline = await DeliveryBoy.find({
        status: "approved",
        isOnline: true,
        activeOrders: { $lt: MAX_ACTIVE_ORDERS },
        _id: { $nin: rejectedIds },
    })
        .select("userId name phone fcmToken location geoLocation rating activeOrders")
        .lean();

    const toRad = d => (d * Math.PI) / 180;
    const hvKm = (lat1, lng1, lat2, lng2) => {
        const R = 6371, dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return allOnline.filter(r => {
        const rLat = r.location?.lat;
        const rLng = r.location?.lng;
        if (!rLat || !rLng) return true; // include riders without GPS
        return hvKm(orderLat, orderLng, rLat, rLng) <= maxKm;
    });
};

/**
 * Offer order to the next rider in the candidates list
 */
const offerToNextRider = async (ctx) => {
    if (ctx.cancelled) return cleanup(ctx);

    // Check if order is already assigned (race condition guard)
    const order = await Order.findById(ctx.orderId).select("delivery").lean();
    if (!order || order.delivery?.assignedTo) {
        cleanup(ctx);
        return;
    }

    if (ctx.currentRiderIdx >= ctx.candidates.length) {
        // All candidates exhausted — next round
        console.log(`[Assignment] All ${ctx.candidates.length} riders exhausted for order ${ctx.orderId}`);
        ctx.timer = setTimeout(() => runAssignmentRound(ctx), ROUND_DELAY_MS);
        return;
    }

    const rider = ctx.candidates[ctx.currentRiderIdx];
    console.log(`[Assignment] Offering order ${ctx.orderId} to rider ${rider.name} (${rider.distance}km, ★${rider.rating})`);

    // Update assignment attempts
    await Order.findByIdAndUpdate(ctx.orderId, {
        $inc: { "delivery.assignmentAttempts": 1 },
    });

    // Get full order data for notification
    const fullOrder = await Order.findById(ctx.orderId)
        .select("totalAmount items address latitude longitude delivery customerName phone")
        .lean();

    const payload = {
        orderId: ctx.orderId,
        amount: fullOrder?.totalAmount || 0,
        items: fullOrder?.items?.length || 0,
        address: fullOrder?.address?.slice(0, 100) || "",
        distanceKm: rider.distance || 0,
        customerName: fullOrder?.customerName || "",
        timeout: ASSIGNMENT_TIMEOUT_MS / 1000,
    };

    // 1. Send WebSocket event
    sendToUser(String(rider.userId), "rider:order_request", payload);

    // 2. Send FCM push notification (wake-up signal)
    if (rider.fcmToken) {
        sendNewOrderPush(rider.fcmToken, payload).catch(() => { });
    }

    // Cache which rider we're waiting on (for Redis-backed distributed setup)
    if (isRedisUp()) {
        const redis = getRedis();
        try {
            await redis.setex(
                `assignment:${ctx.orderId}:pending`,
                ASSIGNMENT_TIMEOUT_MS / 1000 + 5,
                JSON.stringify({ riderId: rider._id, userId: rider.userId, offeredAt: Date.now() })
            );
        } catch { /* non-fatal */ }
    }

    // 3. Start timeout timer
    ctx.timer = setTimeout(async () => {
        console.log(`[Assignment] Rider ${rider.name} timed out for order ${ctx.orderId}`);

        // Notify rider that their offer expired
        sendToUser(String(rider.userId), "rider:offer_expired", { orderId: ctx.orderId });

        // Add to rejectedBy to avoid re-offering
        await Order.findByIdAndUpdate(ctx.orderId, {
            $addToSet: { "delivery.rejectedBy": rider._id },
        });

        // Move to next rider
        ctx.currentRiderIdx++;
        await offerToNextRider(ctx);
    }, ASSIGNMENT_TIMEOUT_MS);
};

/**
 * Handle rider accepting an order — called from delivery controller
 * Returns: { success: boolean, order?: Object }
 */
export const handleRiderAccept = async (orderId, riderId, riderUserId) => {
    const ctx = activeAssignments.get(String(orderId));

    // Atomic claim — first-write-wins (prevents race conditions)
    const rider = await DeliveryBoy.findById(riderId);
    if (!rider) return { success: false, message: "Rider not found" };

    const order = await Order.findOneAndUpdate(
        {
            _id: orderId,
            "delivery.assignedTo": null,
            orderStatus: { $in: ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP"] },
        },
        {
            $set: {
                orderStatus: "OUT_FOR_DELIVERY",
                "delivery.assignedTo": rider._id,
                "delivery.riderName": rider.name,
                "delivery.riderPhone": rider.phone,
                "delivery.assignedAt": new Date(),
                "delivery.status": "ASSIGNED",
            },
        },
        { new: true }
    );

    if (!order) return { success: false, message: "Order is not available for pickup" };

    // Increment rider's active orders
    await DeliveryBoy.findByIdAndUpdate(riderId, { $inc: { activeOrders: 1 } });

    // Stop the assignment engine for this order
    if (ctx) {
        ctx.cancelled = true;
        clearTimeout(ctx.timer);
        cleanup(ctx);
    }

    // Notify other candidates that order was taken
    if (ctx?.candidates) {
        for (const c of ctx.candidates) {
            if (String(c._id) !== String(riderId)) {
                sendToUser(String(c.userId), "rider:order_taken", { orderId: String(orderId) });
            }
        }
    }

    // Clean up Redis
    if (isRedisUp()) {
        const redis = getRedis();
        try { await redis.del(`assignment:${orderId}:pending`); } catch { }
    }

    console.log(`[Assignment] Order ${orderId} assigned to ${rider.name}`);
    return { success: true, order, rider };
};

/**
 * Handle rider rejecting an order
 */
export const handleRiderReject = async (orderId, riderId) => {
    const ctx = activeAssignments.get(String(orderId));

    // Add to rejectedBy
    await Order.findByIdAndUpdate(orderId, {
        $addToSet: { "delivery.rejectedBy": riderId },
    });

    if (ctx) {
        clearTimeout(ctx.timer);
        // Move to next rider immediately
        ctx.currentRiderIdx++;
        await offerToNextRider(ctx);
    }

    console.log(`[Assignment] Rider ${riderId} rejected order ${orderId}`);
};

/**
 * Handle rider cancelling a delivery mid-way → reassign
 */
export const handleRiderCancel = async (orderId, riderId, reason = "") => {
    const order = await Order.findById(orderId);
    if (!order) return;

    // Unassign rider
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

    // Decrement rider's active orders  
    await DeliveryBoy.findByIdAndUpdate(riderId, {
        $inc: { activeOrders: -1 },
        $max: { activeOrders: 0 }, // don't go below 0
    });

    // Notify customer about reassignment
    if (order.user) {
        sendToUser(String(order.user), "order_status", {
            orderId, status: "SEARCHING_RIDER",
            message: "We're finding a new delivery partner for your order.",
        });
    }

    console.log(`[Assignment] Rider ${riderId} cancelled order ${orderId}. Reason: ${reason}. Re-assigning...`);

    // Restart assignment
    cleanup(activeAssignments.get(String(orderId)));
    activeAssignments.delete(String(orderId));
    await startAssignment(orderId);
};

/**
 * Admin force-assign a rider to an order
 */
export const adminForceAssign = async (orderId, riderId) => {
    const rider = await DeliveryBoy.findById(riderId);
    if (!rider) return { success: false, message: "Rider not found" };
    if (rider.status !== "approved") return { success: false, message: "Rider not approved" };

    const order = await Order.findOneAndUpdate(
        { _id: orderId, "delivery.assignedTo": null },
        {
            $set: {
                orderStatus: "OUT_FOR_DELIVERY",
                "delivery.assignedTo": rider._id,
                "delivery.riderName": rider.name,
                "delivery.riderPhone": rider.phone,
                "delivery.assignedAt": new Date(),
                "delivery.status": "ASSIGNED",
            },
        },
        { new: true }
    );

    if (!order) return { success: false, message: "Order already assigned or not found" };

    await DeliveryBoy.findByIdAndUpdate(riderId, { $inc: { activeOrders: 1 } });

    // Stop any running assignment engine
    const ctx = activeAssignments.get(String(orderId));
    if (ctx) {
        ctx.cancelled = true;
        clearTimeout(ctx.timer);
        cleanup(ctx);
    }

    // Notify rider via Socket + FCM
    sendToUser(String(rider.userId), "rider:order_assigned", {
        orderId: String(orderId),
        message: "Admin assigned you a new order",
    });
    if (rider.fcmToken) {
        sendNewOrderPush(rider.fcmToken, {
            orderId: String(orderId),
            amount: order.totalAmount,
            items: order.items?.length || 0,
            address: order.address?.slice(0, 100) || "",
        }).catch(() => { });
    }

    console.log(`[Assignment] Admin force-assigned order ${orderId} to ${rider.name}`);
    return { success: true, order, rider };
};

/**
 * Get assignment status for an order
 */
export const getAssignmentStatus = (orderId) => {
    const ctx = activeAssignments.get(String(orderId));
    if (!ctx) return { active: false };
    return {
        active: true,
        round: ctx.round,
        currentRiderIdx: ctx.currentRiderIdx,
        totalCandidates: ctx.candidates.length,
        currentRider: ctx.candidates[ctx.currentRiderIdx]?.name || null,
    };
};

/**
 * Get all active assignments (admin monitoring)
 */
export const getActiveAssignments = () => {
    const result = [];
    for (const [orderId, ctx] of activeAssignments) {
        result.push({
            orderId,
            round: ctx.round,
            currentRiderIdx: ctx.currentRiderIdx,
            totalCandidates: ctx.candidates.length,
        });
    }
    return result;
};

function cleanup(ctx) {
    if (!ctx) return;
    clearTimeout(ctx.timer);
    activeAssignments.delete(ctx.orderId);
}

/**
 * Cancel an active assignment process (e.g., when order is cancelled)
 */
export const cancelAssignment = (orderId) => {
    const ctx = activeAssignments.get(String(orderId));
    if (ctx) {
        ctx.cancelled = true;
        cleanup(ctx);
        console.log(`[Assignment] Cancelled assignment for order ${orderId}`);
    }
};
