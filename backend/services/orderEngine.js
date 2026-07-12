/**
 * orderEngine.js — centralized Order Engine primitives.
 *
 * Does NOT replace the business logic already living in orderController.js,
 * vendorOrders.js, shiprocketController.js, deliveryController.js — each
 * keeps its own side effects (OTP issuance, auto-assignment triggers,
 * Shiprocket-specific field mapping, email/SMS, etc.). This module
 * centralizes the THREE things that were duplicated/inconsistent across
 * five independent mutation sites:
 *
 *   1. ORDER_TRANSITIONS — one canonical adjacency map (sourced from the
 *      existing admin TRANSITIONS map, the most permissive/authoritative
 *      actor) instead of three separately-hand-written, disagreeing maps
 *      (admin's TRANSITIONS, vendor's getVendorTransitions, Shiprocket's
 *      rank table).
 *   2. applyOrderTransition — one atomic, race-safe "commit this status
 *      change" primitive instead of four separate find→check-in-JS→save()
 *      race windows (only deliveryController.markDelivered had this right
 *      before now).
 *   3. buildTimelineEntry / notifyOrderStakeholders — one standardized
 *      timeline-entry shape (status/actor/role/source/reason/location) and
 *      one recipient-resolution+notify call, instead of an
 *      inconsistently-populated timeline array and two independently
 *      re-implemented notification blocks per call site.
 */
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Vendor from "../models/vendorModels/Vendor.js";
import { notify, notifyMany } from "./notificationEngine.js";
import { emitEvent, PLATFORM_EVENTS } from "./eventBus.js";
import { broadcastToAdmins } from "../utils/wsHub.js";

/* ═══════════════════════════════════════════════════════════════════════
   1. CANONICAL TRANSITION MAP
   ═══════════════════════════════════════════════════════════════════════ */
export const ORDER_TRANSITIONS = {
    PLACED: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PACKED", "CANCELLED"],
    PACKED: ["READY_FOR_PICKUP", "SHIPPED", "CANCELLED"],
    READY_FOR_PICKUP: ["SHIPPED", "OUT_FOR_DELIVERY", "CANCELLED"],
    SHIPPED: ["OUT_FOR_DELIVERY", "CANCELLED"],
    OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
    DELIVERED: ["RETURN_REQUESTED"],
    CANCELLED: [],
    RETURN_REQUESTED: ["RETURN_APPROVED"],
    RETURN_APPROVED: [],
    REPLACEMENT_REQUESTED: ["REPLACEMENT_APPROVED"],
    REPLACEMENT_APPROVED: [],
};

export const canTransition = (fromStatus, toStatus) =>
    (ORDER_TRANSITIONS[fromStatus] || []).includes(toStatus);

/* ═══════════════════════════════════════════════════════════════════════
   2. ATOMIC TRANSITION PRIMITIVE
   ═══════════════════════════════════════════════════════════════════════ */
/**
 * Atomically commit a status transition. Conditions the write on the order
 * STILL being in one of `fromStatuses` at write time — not just at the
 * moment it was read — so two concurrent requests (admin double-click,
 * webhook redelivery, vendor + admin racing) can never both succeed. The
 * loser gets `null` back and should respond 409, never silently overwrite.
 *
 * `setFields` — any additional $set fields for this transition (payment
 * status, statusTimeline.xAt, delivery.status, OTP fields, etc.) — the
 * caller still owns ALL of that business logic; this only makes the
 * eventual write atomic and appends one standardized timeline entry.
 */
export const applyOrderTransition = async ({
    orderId,
    fromStatuses,
    toStatus,
    setFields = {},
    timelineEntry = null,
}) => {
    const update = { $set: { orderStatus: toStatus, ...setFields } };
    if (timelineEntry) update.$push = { timeline: timelineEntry };

    return Order.findOneAndUpdate(
        { _id: orderId, orderStatus: { $in: fromStatuses } },
        update,
        { new: true, runValidators: true }
    );
};

/* ═══════════════════════════════════════════════════════════════════════
   3a. STANDARDIZED TIMELINE ENTRY
   ═══════════════════════════════════════════════════════════════════════ */
export const buildTimelineEntry = ({
    status,
    actorId = null,
    role = "system",
    source = "api",
    reason = "",
    location = null,
    note = "",
}) => ({
    status,
    timestamp: new Date(),
    note,
    actor: actorId || null,
    role,
    source,
    reason,
    location: location ? { lat: location.lat ?? null, lng: location.lng ?? null } : { lat: null, lng: null },
});

/* ═══════════════════════════════════════════════════════════════════════
   3b. NOTIFICATION FAN-OUT (one call site, dedup guard)
   ═══════════════════════════════════════════════════════════════════════ */
// Short-lived guard against firing the literal same event twice for the
// same order (e.g. a caller accidentally invoking this helper twice for
// one transition) — NOT a general notification-history store.
const recentlyNotified = new Map(); // key -> expiresAtMs
const DEDUP_WINDOW_MS = 5000;
const wasRecentlySent = (key) => {
    const exp = recentlyNotified.get(key);
    if (exp && exp > Date.now()) return true;
    recentlyNotified.set(key, Date.now() + DEDUP_WINDOW_MS);
    // Opportunistic cleanup so this map never grows unbounded.
    if (recentlyNotified.size > 5000) {
        const now = Date.now();
        for (const [k, v] of recentlyNotified) if (v <= now) recentlyNotified.delete(k);
    }
    return false;
};

/**
 * Resolve every stakeholder for an order — customer, and (for Urbexon Hour
 * orders) every vendor represented in its items, plus the assigned rider —
 * then notify ALL of them through the one Notification Engine (WS + SSE +
 * push + DB persistence for vendor/rider), instead of the customer/vendor
 * notification blocks being independently re-implemented (each with its
 * own vendor-lookup query and its own direct WS call) at every call site.
 * Also emits a PLATFORM_EVENTS.NOTIFICATION_SENT-adjacent order event so
 * any future listener (analytics, audit log) can subscribe without this
 * function needing to know about it.
 */
export const notifyOrderStakeholders = async (order, event, payload = {}, options = {}) => {
    const dedupKey = `${order._id}:${event}:${payload.status || ""}`;
    if (wasRecentlySent(dedupKey)) return;

    const title = "Order update";
    const message = payload.status ? `Order status: ${payload.status}` : "Your order was updated";
    const meta = { orderId: order._id, orderNumber: order.invoiceNumber, ...payload };

    // skipCustomer: caller already sent the customer a direct, richer
    // message (e.g. one carrying a delivery OTP that must never reach
    // vendor/admin/rider) and only needs this call to reach the OTHER
    // stakeholders — sending a second, redundant customer push for the
    // same event would violate the "no duplicate notifications" rule.
    if (!options.skipCustomer) {
        // Customer — WS + SSE (order-tracking stream) + push, one call.
        notify({
            recipientId: order.user,
            role: "customer",
            title,
            message,
            type: event,
            orderId: order._id,
            meta,
        }).catch((err) => console.warn("[notifyOrderStakeholders] customer notify failed:", order._id, err.message));
    }

    // Vendor(s) — Urbexon Hour orders only. Persisted (PlatformNotification)
    // for the first time — vendors previously had zero notification history.
    if (order.orderMode === "URBEXON_HOUR") {
        try {
            const productIds = (order.items || []).map((i) => i.productId).filter(Boolean);
            if (productIds.length) {
                const products = await Product.find({ _id: { $in: productIds } }).select("vendorId").lean();
                const vendorIds = [...new Set(products.map((p) => p.vendorId?.toString()).filter(Boolean))];
                if (vendorIds.length) {
                    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("userId").lean();
                    await notifyMany(vendors.map((v) => v.userId), {
                        role: "vendor",
                        title,
                        message,
                        type: event,
                        orderId: order._id,
                        meta,
                    });
                }
            }
        } catch (err) {
            console.warn("[notifyOrderStakeholders] vendor resolution failed:", order._id, err.message);
        }
    }

    // Assigned rider, if any — also now persisted for the first time.
    if (order.delivery?.assignedTo) {
        try {
            const { default: DeliveryBoy } = await import("../models/deliveryModels/DeliveryBoy.js");
            const rider = await DeliveryBoy.findById(order.delivery.assignedTo).select("userId").lean();
            if (rider?.userId) {
                await notify({
                    recipientId: rider.userId,
                    role: "delivery",
                    title,
                    message,
                    type: event,
                    orderId: order._id,
                    meta,
                });
            }
        } catch (err) {
            console.warn("[notifyOrderStakeholders] rider resolution failed:", order._id, err.message);
        }
    }

    // Admin sees every order event live too — single choke point so every
    // caller of notifyOrderStakeholders automatically satisfies "Admin must
    // see live active orders / realtime status" without each call site
    // needing its own admin broadcast.
    broadcastToAdmins("admin:order_event", {
        orderId: order._id,
        event,
        status: payload.status,
        deliveryStatus: payload.deliveryStatus,
        orderMode: order.orderMode,
    });

    emitEvent(PLATFORM_EVENTS[payload.status] || event, { orderId: order._id, status: payload.status, orderMode: order.orderMode });
};
