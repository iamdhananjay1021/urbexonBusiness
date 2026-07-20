/**
 * Ticket.js — customer support ticketing.
 *
 * Why a new model instead of reusing what already exists:
 * - `Contact.js` (backend/models/Contact.js) is a bare contact-form lead
 *   store — name/email/phone/subject/message/isRead only. No status
 *   workflow, no assignment, no threading, no references to Order/Product/
 *   Vendor/DeliveryBoy. Extending it to carry a full ticket lifecycle would
 *   break its existing (working, public, unauthenticated) contact-form
 *   contract. Left untouched; Contact = anonymous pre-sales inquiry,
 *   Ticket = authenticated post-purchase support case.
 * - `Notification`/`PlatformNotification` are alert feeds, not case-
 *   management records — no conversation thread, no status/priority.
 * Same reasoning discipline PlatformNotification.js's own header comment
 * used to justify itself over Notification/UserNotification.
 */
import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
    {
        url: { type: String, required: true },
        publicId: { type: String },
        name: { type: String },
        type: { type: String }, // mime type
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        sender: { type: String, enum: ["customer", "admin", "vendor", "delivery"], required: true },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        senderName: { type: String, default: "" },
        message: { type: String, required: true, trim: true, maxlength: 5000 },
        attachments: { type: [attachmentSchema], default: [] },
        // Internal notes are admin-only case notes — never shown to the
        // customer, never trigger a customer-facing WS/notification event.
        isInternalNote: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const activitySchema = new mongoose.Schema(
    {
        action: { type: String, required: true }, // e.g. "status_changed", "assigned", "priority_changed", "created"
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        actorName: { type: String, default: "" },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
    {
        // Who raised the ticket. Legacy documents (pre-vendor-support) have
        // NO requesterType field at all — schema defaults are not
        // retroactive — so every customer-side filter must use
        // { $nin: ["vendor", "delivery"] }, never { $eq: "customer" }.
        requesterType: {
            type: String,
            enum: ["customer", "vendor", "delivery"],
            default: "customer",
            index: true,
        },

        // Denormalized customer contact fields — kept even if the User
        // document is later deleted/anonymized, same rationale Order.js
        // uses for customerName/phone.
        // For requesterType:"vendor" tickets, customerId holds the vendor's
        // linked User id (vendor.userId) — deliberately, because wsHub and
        // notificationEngine key on User ids (see orderEngine.js's
        // vendor-notify pattern), making this field the direct notify key
        // for BOTH requester types with zero extra lookups.
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        customerName: { type: String, required: true, trim: true },
        customerEmail: { type: String, required: true, trim: true, lowercase: true },
        customerPhone: { type: String, default: "" },

        // The requesting vendor (requesterType:"vendor" only) — distinct
        // from vendorRef below, which means "ticket is ABOUT this vendor".
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null, index: true },
        vendorShopName: { type: String, default: "" },
        vendorEmail: { type: String, default: "", trim: true, lowercase: true },

        // The requesting rider (requesterType:"delivery" only) — distinct
        // from deliveryRef below ("ticket is ABOUT this rider"). Rider
        // name/email/phone live in the denormalized customer* fields above;
        // no extra denormalized copies needed (unlike vendor, where
        // shopName ≠ ownerName forced separate fields).
        deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", default: null, index: true },

        subject: { type: String, required: true, trim: true, maxlength: 200 },
        category: {
            type: String,
            // payout/subscription added for vendor-raised tickets; harmless
            // (never shown) in the customer create form's category list.
            enum: ["order", "payment", "delivery", "product", "vendor", "account", "payout", "subscription", "other"],
            default: "other",
            index: true,
        },
        priority: {
            type: String,
            enum: ["low", "normal", "high", "urgent"],
            default: "normal",
            index: true,
        },
        status: {
            type: String,
            enum: ["open", "in_progress", "waiting_customer", "resolved", "closed"],
            default: "open",
            index: true,
        },

        // Optional cross-references — the "Order Reference / Product
        // Reference / Vendor Reference / Delivery Reference" the ticket
        // detail view needs.
        orderRef: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
        productRef: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
        vendorRef: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
        deliveryRef: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", default: null },

        assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

        messages: { type: [messageSchema], default: [] },
        activityLog: { type: [activitySchema], default: [] },

        lastReplyAt: { type: Date, default: null },
        lastReplyBy: { type: String, enum: ["customer", "admin", "vendor", "delivery", null], default: null },

        // ── SLA (vendor/delivery tickets only — null on customer/legacy
        //    docs, which makes the SLA sweep job skip them naturally) ──
        firstResponseAt: { type: Date, default: null },       // first non-internal admin reply
        slaFirstResponseDueAt: { type: Date, default: null },
        slaResolutionDueAt: { type: Date, default: null },
        slaReminderSentAt: { type: Date, default: null },     // one-shot reminder guard
        slaEscalated: { type: Boolean, default: false },      // one-shot escalation guard
        escalatedAt: { type: Date, default: null },

        // ── CSAT (vendor rates after resolved/closed) ──
        csat: {
            rating: { type: Number, min: 1, max: 5, default: null },
            feedback: { type: String, default: "", maxlength: 1000 },
            ratedAt: { type: Date, default: null },
        },

        // Reopen = status back to "open" + activityLog entry — deliberately
        // NOT a new status enum value (keeps every existing status filter
        // working unchanged).
        reopenedCount: { type: Number, default: 0 },
        // Needed for the reopen window — a ticket can sit in "resolved"
        // without ever reaching "closed", so closedAt alone can't anchor it.
        resolvedAt: { type: Date, default: null },

        closedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });
ticketSchema.index({ requesterType: 1, vendorId: 1, createdAt: -1 });
// SLA sweep query shape: { status ∈ open/in_progress, slaFirstResponseDueAt < now }
ticketSchema.index({ status: 1, slaFirstResponseDueAt: 1 });
ticketSchema.index({ subject: "text", customerName: "text", customerEmail: "text" });

export default mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);
