/**
 * userNotificationController.js — Customer notification center
 * Handles: get notifications, mark read, unread count, clear
 */
import UserNotification from "../models/UserNotification.js";

/**
 * GET /api/user-notifications
 * Get paginated notifications for logged-in user
 */
export const getNotifications = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await Promise.all([
            UserNotification.find({ userId: req.user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            UserNotification.countDocuments({ userId: req.user._id }),
            UserNotification.countDocuments({ userId: req.user._id, isRead: false }),
        ]);

        // Mark fetched as seen (but not read — read = user clicked)
        const unseenIds = notifications.filter(n => !n.isSeen).map(n => n._id);
        if (unseenIds.length > 0) {
            UserNotification.updateMany(
                { _id: { $in: unseenIds } },
                { $set: { isSeen: true } }
            ).exec(); // fire-and-forget
        }

        res.json({
            success: true,
            notifications,
            total,
            unreadCount,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error("[getNotifications]", err);
        res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }
};

/**
 * GET /api/user-notifications/unread-count
 * Quick unread badge count
 */
export const getUnreadCount = async (req, res) => {
    try {
        const count = await UserNotification.countDocuments({
            userId: req.user._id,
            isRead: false,
        });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/**
 * PUT /api/user-notifications/:id/read
 * Mark single notification as read
 */
export const markAsRead = async (req, res) => {
    try {
        await UserNotification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $set: { isRead: true, isSeen: true } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/**
 * PUT /api/user-notifications/read-all
 * Mark all notifications as read
 */
export const markAllAsRead = async (req, res) => {
    try {
        await UserNotification.updateMany(
            { userId: req.user._id, isRead: false },
            { $set: { isRead: true, isSeen: true } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/**
 * DELETE /api/user-notifications/:id
 * Delete single notification
 */
export const deleteNotification = async (req, res) => {
    try {
        await UserNotification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/**
 * DELETE /api/user-notifications/clear-all
 * Clear all notifications for user
 */
export const clearAll = async (req, res) => {
    try {
        await UserNotification.deleteMany({ userId: req.user._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};
