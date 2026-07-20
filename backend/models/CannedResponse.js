/**
 * CannedResponse.js — admin-authored reply templates for the support
 * ticket detail view ("insert into reply box", never auto-sent).
 *
 * A separate small model rather than an embedded array on some settings
 * document: canned responses need independent CRUD, per-item isActive
 * toggling, and category filtering — and no settings-singleton pattern
 * exists in this codebase to embed them into.
 */
import mongoose from "mongoose";

const cannedResponseSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 120 },
        body: { type: String, required: true, trim: true, maxlength: 5000 },
        // Same enum as Ticket.category so the picker can suggest templates
        // matching the open ticket's category first.
        category: {
            type: String,
            enum: ["order", "payment", "delivery", "product", "vendor", "account", "payout", "subscription", "other"],
            default: "other",
        },
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

cannedResponseSchema.index({ isActive: 1, category: 1 });

export default mongoose.models.CannedResponse || mongoose.model("CannedResponse", cannedResponseSchema);
