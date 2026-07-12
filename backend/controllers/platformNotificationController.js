/**
 * platformNotificationController.js — recipient-scoped notification REST API
 * for vendor and delivery roles, backed by PlatformNotification.
 *
 * BUG FIX: vendors and delivery riders had ZERO way to fetch their own
 * notification history or unread count — notificationEngine.js has been
 * persisting to PlatformNotification for these two roles for a while now,
 * but nothing ever read it back. Their frontend unread badges
 * (vendor-panel's NotificationContext, and delivery-panel's equivalent)
 * lived only in in-memory React state populated by live WS messages —
 * refreshing the page silently reset the badge to 0 even though the
 * notifications themselves were safely persisted server-side the whole
 * time. These handlers are role-parameterized (not vendor/delivery-
 * specific duplicates) since the query shape is identical for both —
 * only the `role` filter and the route's auth middleware differ.
 */
import PlatformNotification from "../models/PlatformNotification.js";

const scopedQuery = (req, role) => ({ recipient: req.user._id, role });

export const getMyNotifications = (role) => async (req, res) => {
    try {
        let { page = 1, limit = 20 } = req.query;
        page = Math.max(1, Number(page) || 1);
        limit = Math.min(50, Math.max(1, Number(limit) || 20));
        const skip = (page - 1) * limit;

        const filter = scopedQuery(req, role);
        const [notifications, total, unreadCount] = await Promise.all([
            PlatformNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            PlatformNotification.countDocuments(filter),
            PlatformNotification.countDocuments({ ...filter, read: false }),
        ]);

        res.json({ success: true, notifications, total, unreadCount, page, totalPages: Math.ceil(total / limit) || 1 });
    } catch (err) {
        console.error("[getMyNotifications]", err);
        res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }
};

export const getMyUnreadCount = (role) => async (req, res) => {
    try {
        const unreadCount = await PlatformNotification.countDocuments({ ...scopedQuery(req, role), read: false });
        res.json({ success: true, unreadCount });
    } catch (err) {
        console.error("[getMyUnreadCount]", err);
        res.status(500).json({ success: false, message: "Failed to fetch unread count" });
    }
};

export const markMyNotificationRead = (role) => async (req, res) => {
    try {
        const updated = await PlatformNotification.findOneAndUpdate(
            { _id: req.params.id, ...scopedQuery(req, role) },
            { $set: { read: true } },
            { new: true }
        );
        if (!updated) return res.status(404).json({ success: false, message: "Notification not found" });
        res.json({ success: true, notification: updated });
    } catch (err) {
        console.error("[markMyNotificationRead]", err);
        res.status(500).json({ success: false, message: "Failed to update notification" });
    }
};

export const markAllMyNotificationsRead = (role) => async (req, res) => {
    try {
        const result = await PlatformNotification.updateMany(
            { ...scopedQuery(req, role), read: false },
            { $set: { read: true } }
        );
        res.json({ success: true, updatedCount: result.modifiedCount });
    } catch (err) {
        console.error("[markAllMyNotificationsRead]", err);
        res.status(500).json({ success: false, message: "Failed to update notifications" });
    }
};
