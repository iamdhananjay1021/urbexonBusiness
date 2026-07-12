/**
 * PlatformNotification.js — unified, searchable notification store.
 *
 * Deliberately a NEW, additional model — NOT a replacement for the
 * existing `Notification` (admin-only, no recipient targeting) or
 * `UserNotification` (customer marketing/reminder feed) models, which
 * already have working REST APIs and UI bound to their exact shapes.
 * Vendors and delivery riders had ZERO persisted notification history
 * before this — every push they got was a live WebSocket message with
 * nothing to show if they weren't online at the time. This model is
 * where notificationEngine.js persists for those (and any future)
 * recipients, without touching the two pre-existing stores.
 */
import mongoose from "mongoose";

const platformNotificationSchema = new mongoose.Schema(
    {
        recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        role: {
            type: String,
            enum: ["customer", "vendor", "delivery", "admin", "system"],
            required: true,
            index: true,
        },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        type: { type: String, default: "general", index: true }, // e.g. order_status, settlement, refund
        priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
        status: { type: String, enum: ["pending", "sent", "failed"], default: "sent" },
        read: { type: Boolean, default: false, index: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
        expiresAt: { type: Date, default: null },
    },
    { timestamps: true }
);

platformNotificationSchema.index({ recipient: 1, createdAt: -1 });
platformNotificationSchema.index({ recipient: 1, read: 1 });
// TTL — only applies to documents that actually have expiresAt set;
// notifications without one are kept indefinitely (searchable history).
platformNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PlatformNotification", platformNotificationSchema);
