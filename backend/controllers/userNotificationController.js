/**
 * userNotificationController.js — customer notification center
 * Handles pagination, unread counts, bulk updates, delete, and clear-all flows.
 */
import mongoose from "mongoose";
import UserNotification from "../models/UserNotification.js";
import logger from "../utils/logger.js";

const normalizeObjectId = (value) => {
    if (!value) return null;
    try {
        return new mongoose.Types.ObjectId(value);
    } catch {
        return null;
    }
};

export const getNotifications = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const [notifications, total, unreadCount] = await Promise.all([
            UserNotification.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            UserNotification.countDocuments({ userId }),
            UserNotification.countDocuments({ userId, isRead: false }),
        ]);

        const unseenIds = notifications.filter((notification) => !notification.isSeen).map((notification) => notification._id);
        if (unseenIds.length > 0) {
            void UserNotification.updateMany(
                { _id: { $in: unseenIds } },
                { $set: { isSeen: true } }
            ).exec();
        }

        return res.json({
            success: true,
            notifications,
            total,
            unreadCount,
            page,
            totalPages: Math.ceil(total / limit),
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        logger.error("failed to fetch user notifications", { error: error.message, userId: req.user?._id });
        return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }
};

export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const count = await UserNotification.countDocuments({ userId, isRead: false });
        return res.json({ success: true, count });
    } catch (error) {
        logger.error("failed to fetch unread notification count", { error: error.message, userId: req.user?._id });
        return res.status(500).json({ success: false, message: "Failed to fetch unread count" });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const userId = req.user?._id;
        const notificationId = normalizeObjectId(req.params.id);
        if (!userId || !notificationId) {
            return res.status(400).json({ success: false, message: "Invalid notification id" });
        }

        await UserNotification.findOneAndUpdate(
            { _id: notificationId, userId },
            { $set: { isRead: true, isSeen: true } },
            { new: true }
        );
        return res.json({ success: true });
    } catch (error) {
        logger.error("failed to mark notification as read", { error: error.message, userId: req.user?._id, notificationId: req.params.id });
        return res.status(500).json({ success: false, message: "Failed to mark notification as read" });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        await UserNotification.updateMany(
            { userId, isRead: false },
            { $set: { isRead: true, isSeen: true } }
        );
        return res.json({ success: true });
    } catch (error) {
        logger.error("failed to mark all notifications as read", { error: error.message, userId: req.user?._id });
        return res.status(500).json({ success: false, message: "Failed to mark notifications as read" });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const userId = req.user?._id;
        const notificationId = normalizeObjectId(req.params.id);
        if (!userId || !notificationId) {
            return res.status(400).json({ success: false, message: "Invalid notification id" });
        }

        await UserNotification.findOneAndDelete({ _id: notificationId, userId });
        return res.json({ success: true });
    } catch (error) {
        logger.error("failed to delete notification", { error: error.message, userId: req.user?._id, notificationId: req.params.id });
        return res.status(500).json({ success: false, message: "Failed to delete notification" });
    }
};

export const clearAll = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        await UserNotification.deleteMany({ userId });
        return res.json({ success: true });
    } catch (error) {
        logger.error("failed to clear notifications", { error: error.message, userId: req.user?._id });
        return res.status(500).json({ success: false, message: "Failed to clear notifications" });
    }
};
