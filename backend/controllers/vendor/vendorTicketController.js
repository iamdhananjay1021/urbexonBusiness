/**
 * vendorTicketController.js — vendor-facing side of the support ticket
 * system (Vendor Support module, Phase 1).
 *
 * Same Ticket model/collection as customer support — requesterType:"vendor"
 * partitions the two, and customerId deliberately holds the vendor's linked
 * User id (req.user._id under protectVendor) because wsHub/notificationEngine
 * key on User ids, making it the direct notify key for admin→vendor pushes
 * (see the identity note in models/Ticket.js).
 *
 * Deferred to Phase 2+ (deliberately, not forgotten): AI categorization/
 * suggestions, knowledge base, departments/agents, merge/split tickets,
 * WhatsApp channel.
 */
import Ticket from "../../models/Ticket.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";
import { broadcastToAdmins } from "../../utils/wsHub.js";
import { sendNotification as sendToUser } from "../../utils/notificationQueue.js";
import { createNotification } from "../admin/notificationController.js";
import { SLA_CONFIG, computeSlaDates } from "../../config/slaConfig.js";

const CATEGORIES = ["order", "payment", "delivery", "product", "payout", "subscription", "account", "other"];
// "urgent" is reserved for SLA escalation — vendors can't self-select it.
const CREATABLE_PRIORITIES = ["low", "normal", "high"];

const uploadAttachments = async (files, folder) => {
    const attachments = [];
    for (const file of files || []) {
        const uploaded = await uploadToCloudinary(file.buffer, folder);
        attachments.push({ url: uploaded.secure_url, publicId: uploaded.public_id, name: file.originalname, type: file.mimetype });
    }
    return attachments;
};

const vendorActor = (req) => ({ actorId: req.user._id, actorName: req.vendor.shopName || "Vendor" });

// POST /api/vendor/tickets
export const createVendorTicket = async (req, res) => {
    try {
        const { subject, message, category, priority, orderId } = req.body;
        if (!subject?.trim()) return res.status(400).json({ success: false, message: "Subject is required" });
        if (!message?.trim()) return res.status(400).json({ success: false, message: "Message is required" });

        const attachments = await uploadAttachments(req.files, `tickets/pending/${req.user._id}`);
        const effectivePriority = CREATABLE_PRIORITIES.includes(priority) ? priority : "normal";

        const ticket = await Ticket.create({
            requesterType: "vendor",
            customerId: req.user._id, // = vendor.userId — the notify key
            customerName: req.vendor.ownerName || req.vendor.shopName,
            customerEmail: req.vendor.email,
            customerPhone: req.vendor.phone || "",
            vendorId: req.vendor._id,
            vendorShopName: req.vendor.shopName || "",
            vendorEmail: req.vendor.email || "",
            subject: subject.trim(),
            category: CATEGORIES.includes(category) ? category : "other",
            priority: effectivePriority,
            orderRef: orderId || null,
            messages: [{ sender: "vendor", senderId: req.user._id, senderName: req.vendor.shopName || "Vendor", message: message.trim(), attachments }],
            lastReplyAt: new Date(),
            lastReplyBy: "vendor",
            activityLog: [{ action: "created", ...vendorActor(req) }],
            ...computeSlaDates(effectivePriority),
        });

        createNotification({
            type: "system",
            title: "New Vendor Support Ticket",
            message: `${ticket.vendorShopName}: ${ticket.subject}`,
            link: "/admin/support",
            meta: { ticketId: String(ticket._id), requesterType: "vendor" },
        }).catch(() => { });
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "created", requesterType: "vendor", status: ticket.status });

        res.status(201).json({ success: true, ticket });
    } catch (err) {
        console.error("[createVendorTicket]", err);
        res.status(500).json({ success: false, message: "Failed to create ticket" });
    }
};

// GET /api/vendor/tickets?status=&category=&page=&limit=
export const getMyVendorTickets = async (req, res) => {
    try {
        const { status, category, page = 1, limit = 10 } = req.query;
        const base = { requesterType: "vendor", vendorId: req.vendor._id };
        const filter = { ...base };
        if (status) filter.status = status;
        if (category) filter.category = category;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, parseInt(limit) || 10);

        const [tickets, total, statusAgg] = await Promise.all([
            Ticket.find(filter)
                .select("-messages.attachments -messages.isInternalNote -activityLog")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Ticket.countDocuments(filter),
            Ticket.aggregate([
                { $match: { requesterType: "vendor", vendorId: req.vendor._id } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
        ]);

        const stats = { total: 0, open: 0, in_progress: 0, waiting_customer: 0, resolved: 0, closed: 0 };
        statusAgg.forEach((s) => { stats[s._id] = s.count; stats.total += s.count; });

        res.json({ success: true, tickets, total, page: pageNum, totalPages: Math.ceil(total / limitNum), stats });
    } catch (err) {
        console.error("[getMyVendorTickets]", err);
        res.status(500).json({ success: false, message: "Failed to fetch tickets" });
    }
};

// GET /api/vendor/tickets/:id — own ticket only
export const getMyVendorTicketDetail = async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ _id: req.params.id, requesterType: "vendor", vendorId: req.vendor._id })
            .select("-messages.isInternalNote")
            .lean();
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        // Internal admin notes must never reach the vendor even if the
        // projection above regresses — same double guard as the customer
        // detail endpoint (ticketController.js).
        ticket.messages = (ticket.messages || []).filter((m) => !m.isInternalNote);
        res.json({ success: true, ticket, reopenWindowDays: SLA_CONFIG.reopenWindowDays });
    } catch (err) {
        console.error("[getMyVendorTicketDetail]", err);
        res.status(500).json({ success: false, message: "Failed to fetch ticket" });
    }
};

// POST /api/vendor/tickets/:id/reply
export const replyToMyVendorTicket = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, message: "message is required" });

        const ticket = await Ticket.findOne({ _id: req.params.id, requesterType: "vendor", vendorId: req.vendor._id });
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        if (["resolved", "closed"].includes(ticket.status)) {
            return res.status(400).json({ success: false, message: "This ticket is resolved. Use Reopen if the issue persists." });
        }

        const attachments = await uploadAttachments(req.files, `tickets/${ticket._id}`);

        ticket.messages.push({ sender: "vendor", senderId: req.user._id, senderName: req.vendor.shopName || "Vendor", message: message.trim(), attachments });
        ticket.status = "open";
        ticket.lastReplyAt = new Date();
        ticket.lastReplyBy = "vendor";
        ticket.activityLog.push({ action: "vendor_replied", ...vendorActor(req) });
        await ticket.save();

        if (ticket.assignedAdmin) {
            sendToUser(String(ticket.assignedAdmin), "ticket:update", { ticketId: String(ticket._id), message: "Vendor replied to an assigned ticket" });
        }
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "vendor_replied", requesterType: "vendor", status: ticket.status });

        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[replyToMyVendorTicket]", err);
        res.status(500).json({ success: false, message: "Failed to reply" });
    }
};

// POST /api/vendor/tickets/:id/rate — CSAT after resolution
export const rateMyVendorTicket = async (req, res) => {
    try {
        const rating = Number(req.body.rating);
        const feedback = String(req.body.feedback || "").trim().slice(0, 1000);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "rating must be an integer 1–5" });
        }

        const ticket = await Ticket.findOne({ _id: req.params.id, requesterType: "vendor", vendorId: req.vendor._id });
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        if (!["resolved", "closed"].includes(ticket.status)) {
            return res.status(400).json({ success: false, message: "You can rate a ticket once it's resolved" });
        }
        if (ticket.csat?.rating) {
            return res.status(400).json({ success: false, message: "This ticket has already been rated" });
        }

        ticket.csat = { rating, feedback, ratedAt: new Date() };
        ticket.activityLog.push({ action: "csat_rated", ...vendorActor(req), meta: { rating } });
        await ticket.save();

        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "csat_rated", requesterType: "vendor", rating });
        res.json({ success: true, csat: ticket.csat });
    } catch (err) {
        console.error("[rateMyVendorTicket]", err);
        res.status(500).json({ success: false, message: "Failed to submit rating" });
    }
};

// POST /api/vendor/tickets/:id/reopen — within the reopen window only
export const reopenMyVendorTicket = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, message: "Please describe why you're reopening this ticket" });

        const ticket = await Ticket.findOne({ _id: req.params.id, requesterType: "vendor", vendorId: req.vendor._id });
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        if (!["resolved", "closed"].includes(ticket.status)) {
            return res.status(400).json({ success: false, message: "Only resolved or closed tickets can be reopened" });
        }

        const anchor = ticket.resolvedAt || ticket.closedAt;
        const windowMs = SLA_CONFIG.reopenWindowDays * 24 * 60 * 60 * 1000;
        if (anchor && Date.now() - new Date(anchor).getTime() > windowMs) {
            return res.status(400).json({ success: false, message: `Reopen window of ${SLA_CONFIG.reopenWindowDays} days has passed. Please create a new ticket.` });
        }

        ticket.status = "open";
        ticket.closedAt = null;
        ticket.reopenedCount += 1;
        // Restart the SLA clock — this is effectively a fresh case.
        Object.assign(ticket, computeSlaDates(ticket.priority));
        ticket.firstResponseAt = null;
        ticket.slaReminderSentAt = null;
        ticket.slaEscalated = false;
        ticket.escalatedAt = null;
        ticket.messages.push({ sender: "vendor", senderId: req.user._id, senderName: req.vendor.shopName || "Vendor", message: message.trim() });
        ticket.lastReplyAt = new Date();
        ticket.lastReplyBy = "vendor";
        ticket.activityLog.push({ action: "reopened_by_vendor", ...vendorActor(req), meta: { reopenedCount: ticket.reopenedCount } });
        await ticket.save();

        createNotification({
            type: "system",
            title: "Vendor Ticket Reopened",
            message: `${ticket.vendorShopName}: ${ticket.subject}`,
            link: "/admin/support",
            meta: { ticketId: String(ticket._id), requesterType: "vendor" },
        }).catch(() => { });
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "reopened", requesterType: "vendor", status: ticket.status });

        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[reopenMyVendorTicket]", err);
        res.status(500).json({ success: false, message: "Failed to reopen ticket" });
    }
};
