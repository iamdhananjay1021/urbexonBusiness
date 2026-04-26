/**
 * notificationController.js — Production Ready
 */

import Notification from "../../models/Notification.js";

/* ── GET notifications (paginated) ── */
export const getNotifications = async (req, res) => {
    try {
        let { page = 1, limit = 20, unreadOnly } = req.query;

        page = Math.max(1, Number(page));
        limit = Math.min(50, Math.max(1, Number(limit)));

        const filter = {};
        if (unreadOnly === "true") filter.isRead = false;

        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter),
            Notification.countDocuments({ isRead: false }),
        ]);

        res.json({
            success: true,
            notifications,
            total,
            unreadCount,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error("[getNotifications]", err);
        res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }
};

/* ── GET unread count ── */
export const getUnreadCount = async (_req, res) => {
    try {
        const count = await Notification.countDocuments({ isRead: false });
        res.json({ success: true, unreadCount: count });
    } catch (err) {
        console.error("[getUnreadCount]", err);
        res.status(500).json({ success: false, message: "Failed to fetch unread count" });
    }
};

/* ── MARK single as read ── */
export const markAsRead = async (req, res) => {
    try {
        const updated = await Notification.findOneAndUpdate(
            { _id: req.params.id, isRead: false },
            { $set: { isRead: true } },
            { new: true }
        );

        if (!updated) {
            const existing = await Notification.findById(req.params.id).lean();
            if (!existing) {
                return res.status(404).json({ success: false, message: "Notification not found" });
            }
            return res.json({
                success: true,
                message: "Already marked as read",
                notification: existing,
            });
        }

        res.json({ success: true, notification: updated });
    } catch (err) {
        console.error("[markAsRead]", err);
        res.status(500).json({ success: false, message: "Failed to update notification" });
    }
};

/* ── MARK ALL as read ── */
export const markAllAsRead = async (_req, res) => {
    try {
        const result = await Notification.updateMany(
            { isRead: false },
            { $set: { isRead: true } }
        );

        res.json({
            success: true,
            message: "All marked as read",
            updatedCount: result.modifiedCount,
        });
    } catch (err) {
        console.error("[markAllAsRead]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── DELETE old notifications ── */
export const cleanOldNotifications = async (_req, res) => {
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const result = await Notification.deleteMany({
            createdAt: { $lt: cutoff },
            isRead: true,
        });

        res.json({
            success: true,
            deleted: result.deletedCount,
        });
    } catch (err) {
        console.error("[cleanOldNotifications]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── CREATE notification (helper) ── */
export const createNotification = async ({ type, title, message, icon, link, meta }) => {
    try {
        if (!title || !message) return null;

        return await Notification.create({
            type: type || "info",
            title: String(title).slice(0, 200),
            message: String(message).slice(0, 1000),
            icon: icon || null,
            link: link || null,
            meta: meta || {},
        });
    } catch (err) {
        console.error("[createNotification]", err);
        return null;
    }
};