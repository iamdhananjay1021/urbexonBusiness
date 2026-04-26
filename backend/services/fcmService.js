/**
 * fcmService.js — Firebase Cloud Messaging push notifications
 * Sends push notifications to delivery riders and customers
 * Gracefully no-ops if Firebase is not configured
 */
import { getFirebaseAdmin, isFcmAvailable } from "../config/firebase.js";

/**
 * Send push notification to a single FCM token
 * @param {string} fcmToken - The device FCM token
 * @param {object} notification - { title, body }
 * @param {object} data - Custom data payload (all values must be strings)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendPush = async (fcmToken, notification, data = {}) => {
    if (!isFcmAvailable() || !fcmToken) {
        return { success: false, error: "FCM not available or no token" };
    }

    try {
        const admin = getFirebaseAdmin();

        // ✅ Safety check: ensure messaging is available
        if (!admin.messaging || typeof admin.messaging() !== 'object') {
            console.warn("[FCM] admin.messaging() not available");
            return { success: false, error: "FCM not available" };
        }

        // Ensure all data values are strings (FCM requirement)
        const stringifiedData = {};
        for (const [key, value] of Object.entries(data)) {
            stringifiedData[key] = String(value);
        }

        const message = {
            token: fcmToken,
            notification: {
                title: notification.title,
                body: notification.body,
            },
            data: stringifiedData,
            android: {
                priority: "high",
                notification: {
                    channelId: "delivery_orders",
                    sound: "default",
                    clickAction: "OPEN_ORDER",
                },
            },
            webpush: {
                headers: { Urgency: "high" },
                notification: {
                    icon: "/icon-192.png",
                    badge: "/badge-72.png",
                    requireInteraction: true,
                    actions: [
                        { action: "accept", title: "✅ Accept" },
                        { action: "reject", title: "❌ Reject" },
                    ],
                },
            },
        };

        const messageId = await admin.messaging().send(message);
        console.log(`[FCM] Push sent → token:${fcmToken.slice(-8)} | msgId:${messageId}`);
        return { success: true, messageId };
    } catch (err) {
        const errorCode = err.code || err.errorInfo?.code;
        // Handle invalid/expired tokens
        if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
        ) {
            console.warn(`[FCM] Invalid token (will be cleaned): ${fcmToken.slice(-8)}`);
            return { success: false, error: "invalid_token", shouldRemove: true };
        }
        console.error(`[FCM] Send failed:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Send push notification to multiple FCM tokens
 * @param {string[]} tokens - Array of FCM tokens
 * @param {object} notification - { title, body }
 * @param {object} data - Custom data payload
 * @returns {Promise<{successCount: number, failureCount: number, invalidTokens: string[]}>}
 */
export const sendPushMultiple = async (tokens, notification, data = {}) => {
    if (!isFcmAvailable() || !tokens?.length) {
        return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const admin = getFirebaseAdmin();

    // ✅ Safety check: ensure messaging is available
    if (!admin.messaging || typeof admin.messaging() !== 'object') {
        console.warn("[FCM] admin.messaging() not available");
        return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }

    const stringifiedData = {};
    for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = String(value);
    }

    try {
        const message = {
            notification: {
                title: notification.title,
                body: notification.body,
            },
            data: stringifiedData,
            android: {
                priority: "high",
                notification: {
                    channelId: "delivery_orders",
                    sound: "default",
                },
            },
            webpush: {
                headers: { Urgency: "high" },
                notification: {
                    icon: "/icon-192.png",
                    requireInteraction: true,
                },
            },
        };

        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            ...message,
        });

        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const code = resp.error?.code;
                if (
                    code === "messaging/invalid-registration-token" ||
                    code === "messaging/registration-token-not-registered"
                ) {
                    invalidTokens.push(tokens[idx]);
                }
            }
        });

        console.log(`[FCM] Multicast: ${response.successCount} sent, ${response.failureCount} failed, ${invalidTokens.length} invalid`);
        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
            invalidTokens,
        };
    } catch (err) {
        console.error("[FCM] Multicast failed:", err.message);
        return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }
};

/**
 * Send a new delivery request notification to a rider
 */
export const sendNewOrderPush = async (fcmToken, orderData) => {
    return sendPush(
        fcmToken,
        {
            title: "🛵 New Delivery Request!",
            body: `₹${orderData.amount || 0} • ${orderData.items || 0} items • ${orderData.distanceKm ? orderData.distanceKm + " km" : "Nearby"}`,
        },
        {
            type: "NEW_ORDER",
            orderId: orderData.orderId || "",
            amount: String(orderData.amount || 0),
            items: String(orderData.items || 0),
            distanceKm: String(orderData.distanceKm || 0),
            address: orderData.address || "",
        }
    );
};

/**
 * Send order status update push to customer
 */
export const sendOrderStatusPush = async (fcmToken, { orderId, status, riderName, message }) => {
    const titles = {
        ASSIGNED: "🛵 Rider Assigned!",
        ARRIVING_VENDOR: "🏪 Rider heading to store",
        PICKED_UP: "📦 Order Picked Up!",
        OUT_FOR_DELIVERY: "🚀 Out for Delivery!",
        DELIVERED: "✅ Order Delivered!",
    };

    return sendPush(
        fcmToken,
        {
            title: titles[status] || "📦 Order Update",
            body: message || `Your order is now ${status}${riderName ? ` — Rider: ${riderName}` : ""}`,
        },
        {
            type: "ORDER_STATUS",
            orderId: String(orderId),
            status,
        }
    );
};
