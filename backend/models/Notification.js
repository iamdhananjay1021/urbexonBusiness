/**
 * Notification.js — Admin Notification Model
 * Types: order, vendor, product, user, system
 */
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["order", "vendor", "product", "user", "system", "plan_change"],
        required: true,
        index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 500 },
    icon: { type: String, default: "info" }, // order, vendor, product, user, alert, info
    link: { type: String, default: "" },      // admin route to navigate to
    isRead: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // extra data (orderId, vendorId, etc.)
}, { timestamps: true });

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
