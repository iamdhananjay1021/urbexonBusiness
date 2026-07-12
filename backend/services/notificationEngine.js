/**
 * notificationEngine.js — the single Notification Engine entry point.
 *
 * "Controller → Event → Notification Engine → Recipients → WebSocket →
 * Database → Push → Email" — one function (`notify`) fans out to every
 * channel instead of each call site remembering to call WS, SSE, and a
 * DB write independently (which is exactly how the platform ended up with
 * vendors/riders getting zero persisted notification history, and orders
 * firing WS+SSE from two separate, uncoordinated call sites).
 *
 * Does NOT replace the existing admin `Notification` model or customer
 * `UserNotification` model — both already have working REST APIs and UI.
 * For `role: "vendor"` / `"delivery"` (which had NO persisted store at
 * all before this), this engine persists to the new PlatformNotification
 * model. For customer/admin, persistence is left to their existing,
 * already-working flows; this engine still handles WS/SSE/push for them.
 */
import PlatformNotification from "../models/PlatformNotification.js";
import User from "../models/User.js";
import Vendor from "../models/vendorModels/Vendor.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import { sendNotification } from "../utils/notificationQueue.js";
import { publishToUser } from "../utils/realtimeHub.js";
import { sendPush } from "./fcmService.js";
import { emitEvent, onEvent, PLATFORM_EVENTS } from "./eventBus.js";

const ROLE_MODEL = { vendor: Vendor, delivery: DeliveryBoy, customer: User, admin: User };

const getRecipientPrefs = async (recipientId, role) => {
    const Model = ROLE_MODEL[role];
    if (!Model || !recipientId) return { prefs: null, fcmToken: null };
    try {
        const doc = await Model.findById(recipientId).select("notificationPreferences fcmToken").lean();
        return { prefs: doc?.notificationPreferences || null, fcmToken: doc?.fcmToken || null };
    } catch {
        return { prefs: null, fcmToken: null };
    }
};

const clearInvalidFcmToken = async (recipientId, role) => {
    const Model = ROLE_MODEL[role];
    if (!Model) return;
    await Model.findByIdAndUpdate(recipientId, { $set: { fcmToken: null } }).catch(() => { });
};

/**
 * Dispatch one notification to one recipient across every applicable
 * channel. Never throws — a channel failure never blocks the others or
 * the caller's request.
 */
export const notify = async ({
    recipientId,
    role, // customer | vendor | delivery | admin | system
    title,
    message,
    type = "general",
    priority = "normal",
    meta = {},
    orderId = null,
    channels = ["ws", "sse", "push"],
}) => {
    if (!recipientId || !role || !title || !message) return;

    const { prefs, fcmToken } = await getRecipientPrefs(recipientId, role);
    if (prefs?.muted) return; // fully muted — skip every channel, including persistence

    const isTransactional = priority === "high" || priority === "urgent" || !!orderId;
    if (!isTransactional && prefs?.marketing === false) return;
    if (isTransactional && prefs?.transactional === false) return;

    const basePayload = { title, message, type, priority, orderId, at: new Date().toISOString(), ...meta };

    // Persistence — the new, previously-nonexistent history for vendor/delivery.
    if (role === "vendor" || role === "delivery") {
        PlatformNotification.create({ recipient: recipientId, role, title, message, type, priority, orderId, meta })
            .catch((err) => console.warn("[notificationEngine] persist failed:", err.message));
    }

    // WebSocket
    if (channels.includes("ws") && (prefs?.push !== false)) {
        try { sendNotification(recipientId, type, basePayload); } catch { /* non-fatal */ }
    }

    // SSE — order-tracking stream, customer-facing only (matches existing realtimeHub usage)
    if (channels.includes("sse") && orderId && role === "customer") {
        try { publishToUser(recipientId, type, basePayload); } catch { /* non-fatal */ }
    }

    // Push (FCM)
    if (channels.includes("push") && fcmToken && prefs?.push !== false) {
        sendPush(fcmToken, { title, body: message }, { orderId: orderId ? String(orderId) : "", type })
            .then((res) => { if (res?.shouldRemove) clearInvalidFcmToken(recipientId, role); })
            .catch(() => { });
    }

    emitEvent(PLATFORM_EVENTS.NOTIFICATION_SENT, { recipientId, role, type, orderId, priority });
};

/** Notify the same event to several recipients — each gets their own preference/token lookup. */
export const notifyMany = (recipientIds = [], params = {}) =>
    Promise.all(recipientIds.map((recipientId) => notify({ ...params, recipientId })));

export { PLATFORM_EVENTS, emitEvent, onEvent };
