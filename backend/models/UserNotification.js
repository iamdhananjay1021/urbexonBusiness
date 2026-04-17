/**
 * UserNotification.js — Customer-facing notifications
 * Types: price_drop, back_in_stock, deal_alert, order_update, wishlist_reminder
 */
import mongoose from "mongoose";

const userNotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ["price_drop", "back_in_stock", "deal_alert", "wishlist_reminder", "cart_reminder", "general"],
        required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 500 },
    image: { type: String, default: "" },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null,
    },
    link: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
    isSeen: { type: Boolean, default: false },
}, { timestamps: true });

// Compound index for efficient queries
userNotificationSchema.index({ userId: 1, createdAt: -1 });
userNotificationSchema.index({ userId: 1, isRead: 1 });
// Prevent duplicate notifications for same product+type within short window
userNotificationSchema.index({ userId: 1, productId: 1, type: 1, createdAt: -1 });
// Auto-delete old notifications after 60 days
userNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

export default mongoose.model("UserNotification", userNotificationSchema);
