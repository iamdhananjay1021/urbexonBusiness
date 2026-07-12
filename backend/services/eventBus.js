/**
 * eventBus.js — centralized event bus for the platform.
 *
 * Node's built-in EventEmitter, wrapped so every important action has a
 * named, constant event instead of controllers calling notification/
 * settlement/etc. functions directly with ad-hoc string literals. New
 * platform work (notificationEngine.js) subscribes here instead of being
 * called inline from every controller — "Controller → Event → Engine →
 * Recipients" instead of "Controller → Engine" directly.
 *
 * Deliberately additive: existing direct calls (applyOrderTransition,
 * notifyOrderStakeholders, settleAllVendorsForOrder, etc.) are NOT removed
 * or rerouted through this bus — emitting alongside them is a strictly
 * additive observability/extension point, so nothing that already works
 * can break if a listener throws (all listener errors are caught here).
 */
import { EventEmitter } from "events";

export const PLATFORM_EVENTS = {
    ORDER_CREATED: "ORDER_CREATED",
    ORDER_CONFIRMED: "ORDER_CONFIRMED",
    ORDER_CANCELLED: "ORDER_CANCELLED",
    PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
    PAYMENT_FAILED: "PAYMENT_FAILED",
    VENDOR_ACCEPTED: "VENDOR_ACCEPTED",
    ORDER_PREPARING: "ORDER_PREPARING",
    READY_FOR_PICKUP: "READY_FOR_PICKUP",
    RIDER_ASSIGNED: "RIDER_ASSIGNED",
    RIDER_ACCEPTED: "RIDER_ACCEPTED",
    PICKED_UP: "PICKED_UP",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
    REFUND_CREATED: "REFUND_CREATED",
    SETTLEMENT_CREATED: "SETTLEMENT_CREATED",
    NOTIFICATION_SENT: "NOTIFICATION_SENT",
};

class PlatformEventBus extends EventEmitter { }

// A raised listener limit — this bus is meant to have many independent
// subscribers (notification engine, future analytics, audit log) without
// Node's default-10 MaxListenersExceededWarning noise.
export const eventBus = new PlatformEventBus();
eventBus.setMaxListeners(50);

/** Emit a platform event. Never throws — a bad payload here must never take down the caller's request. */
export const emitEvent = (eventName, payload = {}) => {
    try {
        eventBus.emit(eventName, { ...payload, emittedAt: new Date() });
    } catch (err) {
        console.error(`[eventBus] emit failed for ${eventName}:`, err.message);
    }
};

/** Subscribe to a platform event. Listener errors are caught so one bad handler can't break others. */
export const onEvent = (eventName, handler) => {
    eventBus.on(eventName, (payload) => {
        Promise.resolve()
            .then(() => handler(payload))
            .catch((err) => console.error(`[eventBus] listener for ${eventName} failed:`, err.message));
    });
};
