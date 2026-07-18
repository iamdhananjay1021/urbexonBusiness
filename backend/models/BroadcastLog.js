/**
 * BroadcastLog.js — audit trail for POST /admin/broadcast.
 *
 * Before this, a broadcast was a pure fire-and-forget WebSocket push with
 * no record anywhere: no history of what was sent, when, by whom, or
 * whether email/WhatsApp fan-out actually reached anyone. Admin had zero
 * way to check "did my last broadcast actually go out" beyond the instant
 * HTTP success response. This model is written synchronously when a
 * broadcast is sent (status "sending"), then patched with final channel
 * counts once the background email/WhatsApp fan-out (broadcastService.js)
 * finishes — WS delivery itself is instant so its count is known upfront.
 */
import mongoose from "mongoose";

const channelStatsSchema = new mongoose.Schema(
    {
        attempted: { type: Number, default: 0 },
        sent: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
    },
    { _id: false }
);

const broadcastLogSchema = new mongoose.Schema(
    {
        message: { type: String, required: true, trim: true },
        audience: { type: String, enum: ["all", "admins"], required: true },
        channels: {
            ws: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false },
        },
        status: { type: String, enum: ["sending", "completed"], default: "sending", index: true },
        wsConnections: { type: Number, default: 0 }, // sockets reached at send time
        emailStats: { type: channelStatsSchema, default: () => ({}) },
        whatsappStats: { type: channelStatsSchema, default: () => ({}) },
        sentBy: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            name: { type: String, default: "Admin" },
        },
    },
    { timestamps: true }
);

broadcastLogSchema.index({ createdAt: -1 });

export default mongoose.model("BroadcastLog", broadcastLogSchema);
