/**
 * deliveryTicketController.js — rider-facing side of the support ticket
 * system (mirror of controllers/vendor/vendorTicketController.js — same
 * Ticket model/collection, partitioned by requesterType:"delivery").
 *
 * Identity: delivery routes run under protect+deliveryOnly, so req.user is
 * the rider's USER document — req.user._id is already the WS/notification
 * key (DeliveryBoy.userId links to it, same pattern as Vendor.userId).
 * customerId holds that User id; deliveryBoyId holds the DeliveryBoy doc.
 */
import Ticket from "../../models/Ticket.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";
import { broadcastToAdmins } from "../../utils/wsHub.js";
import { sendNotification as sendToUser } from "../../utils/notificationQueue.js";
import { createNotification } from "../admin/notificationController.js";
import { SLA_CONFIG, computeSlaDates } from "../../config/slaConfig.js";

// Rider-relevant categories — all values already exist on Ticket.category's
// enum, nothing new needed.
const CATEGORIES = ["order", "delivery", "payout", "account", "other"];
const CREATABLE_PRIORITIES = ["low", "normal", "high"]; // urgent reserved for SLA escalation

const uploadAttachments = async (files, folder) => {
    const attachments = [];
    for (const file of files || []) {
        const uploaded = await uploadToCloudinary(file.buffer, folder);
        attachments.push({ url: uploaded.secure_url, publicId: uploaded.public_id, name: file.originalname, type: file.mimetype });
    }
    return attachments;
};

const getRider = (req) => DeliveryBoy.findOne({ userId: req.user._id });

// POST /api/delivery/tickets
export const createDeliveryTicket = async (req, res) => {
    try {
        const { subject, message, category, priority, orderId } = req.body;
        if (!subject?.trim()) return res.status(400).json({ success: false, message: "Subject is required" });
        if (!message?.trim()) return res.status(400).json({ success: false, message: "Message is required" });

        const rider = await getRider(req);
        if (!rider) return res.status(404).json({ success: false, message: "Delivery profile not found" });

        const attachments = await uploadAttachments(req.files, `tickets/pending/${req.user._id}`);
        const effectivePriority = CREATABLE_PRIORITIES.includes(priority) ? priority : "normal";

        const ticket = await Ticket.create({
            requesterType: "delivery",
            customerId: req.user._id, // = rider's User id — the notify key
            customerName: rider.name || req.user.name || "Delivery Partner",
            customerEmail: rider.email || req.user.email,
            customerPhone: rider.phone || "",
            deliveryBoyId: rider._id,
            subject: subject.trim(),
            category: CATEGORIES.includes(category) ? category : "other",
            priority: effectivePriority,
            orderRef: orderId || null,
            messages: [{ sender: "delivery", senderId: req.user._id, senderName: rider.name || "Delivery Partner", message: message.trim(), attachments }],
            lastReplyAt: new Date(),
            lastReplyBy: "delivery",
            activityLog: [{ action: "created", actorId: req.user._id, actorName: rider.name || "Delivery Partner" }],
            ...computeSlaDates(effectivePriority),
        });

        createNotification({
            type: "system",
            title: "New Delivery Partner Support Ticket",
            message: `${ticket.customerName}: ${ticket.subject}`,
            link: "/admin/support",
            meta: { ticketId: String(ticket._id), requesterType: "delivery" },
        }).catch(() => { });
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "created", requesterType: "delivery", status: ticket.status });

        res.status(201).json({ success: true, ticket });
    } catch (err) {
        console.error("[createDeliveryTicket]", err);
        res.status(500).json({ success: false, message: "Failed to create ticket" });
    }
};

// GET /api/delivery/tickets?status=&page=&limit=
export const getMyDeliveryTickets = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const filter = { requesterType: "delivery", customerId: req.user._id };
        if (status) filter.status = status;

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
                { $match: { requesterType: "delivery", customerId: req.user._id } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
        ]);

        const stats = { total: 0, open: 0, in_progress: 0, waiting_customer: 0, resolved: 0, closed: 0 };
        statusAgg.forEach((s) => { stats[s._id] = s.count; stats.total += s.count; });

        res.json({ success: true, tickets, total, page: pageNum, totalPages: Math.ceil(total / limitNum), stats });
    } catch (err) {
        console.error("[getMyDeliveryTickets]", err);
        res.status(500).json({ success: false, message: "Failed to fetch tickets" });
    }
};

// GET /api/delivery/tickets/:id — own ticket only
export const getMyDeliveryTicketDetail = async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ _id: req.params.id, requesterType: "delivery", customerId: req.user._id })
            .select("-messages.isInternalNote")
            .lean();
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        // Internal admin notes must never reach the rider — same double
        // guard as the customer/vendor detail endpoints.
        ticket.messages = (ticket.messages || []).filter((m) => !m.isInternalNote);
        res.json({ success: true, ticket, reopenWindowDays: SLA_CONFIG.reopenWindowDays });
    } catch (err) {
        console.error("[getMyDeliveryTicketDetail]", err);
        res.status(500).json({ success: false, message: "Failed to fetch ticket" });
    }
};

// POST /api/delivery/tickets/:id/reply
export const replyToMyDeliveryTicket = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, message: "message is required" });

        const ticket = await Ticket.findOne({ _id: req.params.id, requesterType: "delivery", customerId: req.user._id });
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        if (["resolved", "closed"].includes(ticket.status)) {
            return res.status(400).json({ success: false, message: "This ticket is resolved. Use Reopen if the issue persists." });
        }

        const attachments = await uploadAttachments(req.files, `tickets/${ticket._id}`);

        ticket.messages.push({ sender: "delivery", senderId: req.user._id, senderName: ticket.customerName, message: message.trim(), attachments });
        ticket.status = "open";
        ticket.lastReplyAt = new Date();
        ticket.lastReplyBy = "delivery";
        ticket.activityLog.push({ action: "delivery_replied", actorId: req.user._id, actorName: ticket.customerName });
        await ticket.save();

        if (ticket.assignedAdmin) {
            sendToUser(String(ticket.assignedAdmin), "ticket:update", { ticketId: String(ticket._id), message: "Delivery partner replied to an assigned ticket" });
        }
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "delivery_replied", requesterType: "delivery", status: ticket.status });

        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[replyToMyDeliveryTicket]", err);
        res.status(500).json({ success: false, message: "Failed to reply" });
    }
};

// POST /api/delivery/tickets/:id/rate — CSAT after resolution
export const rateMyDeliveryTicket = async (req, res) => {
    try {
        const rating = Number(req.body.rating);
        const feedback = String(req.body.feedback || "").trim().slice(0, 1000);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "rating must be an integer 1–5" });
        }

        const ticket = await Ticket.findOne({ _id: req.params.id, requesterType: "delivery", customerId: req.user._id });
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        if (!["resolved", "closed"].includes(ticket.status)) {
            return res.status(400).json({ success: false, message: "You can rate a ticket once it's resolved" });
        }
        if (ticket.csat?.rating) {
            return res.status(400).json({ success: false, message: "This ticket has already been rated" });
        }

        ticket.csat = { rating, feedback, ratedAt: new Date() };
        ticket.activityLog.push({ action: "csat_rated", actorId: req.user._id, actorName: ticket.customerName, meta: { rating } });
        await ticket.save();

        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "csat_rated", requesterType: "delivery", rating });
        res.json({ success: true, csat: ticket.csat });
    } catch (err) {
        console.error("[rateMyDeliveryTicket]", err);
        res.status(500).json({ success: false, message: "Failed to submit rating" });
    }
};

// POST /api/delivery/tickets/:id/reopen — within the reopen window only
export const reopenMyDeliveryTicket = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, message: "Please describe why you're reopening this ticket" });

        const ticket = await Ticket.findOne({ _id: req.params.id, requesterType: "delivery", customerId: req.user._id });
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
        Object.assign(ticket, computeSlaDates(ticket.priority));
        ticket.firstResponseAt = null;
        ticket.slaReminderSentAt = null;
        ticket.slaEscalated = false;
        ticket.escalatedAt = null;
        ticket.messages.push({ sender: "delivery", senderId: req.user._id, senderName: ticket.customerName, message: message.trim() });
        ticket.lastReplyAt = new Date();
        ticket.lastReplyBy = "delivery";
        ticket.activityLog.push({ action: "reopened_by_delivery", actorId: req.user._id, actorName: ticket.customerName, meta: { reopenedCount: ticket.reopenedCount } });
        await ticket.save();

        createNotification({
            type: "system",
            title: "Delivery Ticket Reopened",
            message: `${ticket.customerName}: ${ticket.subject}`,
            link: "/admin/support",
            meta: { ticketId: String(ticket._id), requesterType: "delivery" },
        }).catch(() => { });
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "reopened", requesterType: "delivery", status: ticket.status });

        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[reopenMyDeliveryTicket]", err);
        res.status(500).json({ success: false, message: "Failed to reopen ticket" });
    }
};
