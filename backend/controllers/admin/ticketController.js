/**
 * ticketController.js — admin side of the support ticket system.
 * Realtime via the existing wsHub (broadcastToAdmins / sendToUser through
 * notificationQueue) — no new WebSocket transport. Admin alerts reuse the
 * existing Notification model/createNotification helper.
 */
import Ticket from "../../models/Ticket.js";
import UserNotification from "../../models/UserNotification.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";
import { broadcastToAdmins } from "../../utils/wsHub.js";
import { sendNotification as sendToUser } from "../../utils/notificationQueue.js";

const PRIORITIES = ["low", "normal", "high", "urgent"];
const STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
const CATEGORIES = ["order", "payment", "delivery", "product", "vendor", "account", "other"];

// GET /api/admin/tickets — list + filters
export const listTickets = async (req, res) => {
    try {
        const { status, category, priority, customer, orderId, dateFrom, dateTo, search, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status && STATUSES.includes(status)) filter.status = status;
        if (category && CATEGORIES.includes(category)) filter.category = category;
        if (priority && PRIORITIES.includes(priority)) filter.priority = priority;
        if (orderId) filter.orderRef = orderId;
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
            if (dateTo) filter.createdAt.$lte = new Date(dateTo);
        }
        if (customer) {
            const esc = customer.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { customerName: { $regex: esc, $options: "i" } },
                { customerEmail: { $regex: esc, $options: "i" } },
                { customerPhone: { $regex: esc, $options: "i" } },
            ];
        }
        if (search?.trim()) {
            filter.$text = { $search: search.trim() };
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, parseInt(limit) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [tickets, total] = await Promise.all([
            Ticket.find(filter)
                .select("-messages.attachments -activityLog") // list view doesn't need thread bodies
                .populate("assignedAdmin", "name email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Ticket.countDocuments(filter),
        ]);

        res.json({ success: true, tickets, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error("[listTickets]", err);
        res.status(500).json({ success: false, message: "Failed to fetch tickets" });
    }
};

// GET /api/admin/tickets/stats — dashboard counts
export const getTicketStats = async (req, res) => {
    try {
        const facets = await Ticket.aggregate([
            {
                $facet: {
                    byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                    highPriority: [{ $match: { priority: { $in: ["high", "urgent"] }, status: { $nin: ["resolved", "closed"] } } }, { $count: "n" }],
                    total: [{ $count: "n" }],
                },
            },
        ]);
        const f = facets[0] || {};
        const byStatus = {};
        (f.byStatus || []).forEach((s) => { byStatus[s._id] = s.count; });

        res.json({
            success: true,
            data: {
                total: f.total?.[0]?.n || 0,
                open: byStatus.open || 0,
                inProgress: byStatus.in_progress || 0,
                waitingCustomer: byStatus.waiting_customer || 0,
                resolved: byStatus.resolved || 0,
                closed: byStatus.closed || 0,
                highPriority: f.highPriority?.[0]?.n || 0,
            },
        });
    } catch (err) {
        console.error("[getTicketStats]", err);
        res.status(500).json({ success: false, message: "Failed to fetch ticket stats" });
    }
};

// GET /api/admin/tickets/:id
export const getTicketDetail = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id)
            .populate("assignedAdmin", "name email")
            .populate("orderRef", "invoiceNumber orderStatus totalAmount")
            .populate("productRef", "name slug")
            .populate("vendorRef", "shopName")
            .populate("deliveryRef", "name phone")
            .lean();
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[getTicketDetail]", err);
        res.status(500).json({ success: false, message: "Failed to fetch ticket" });
    }
};

const logActivity = (ticket, action, req, meta = {}) => {
    ticket.activityLog.push({ action, actorId: req.user._id, actorName: req.user.name || "Admin", meta });
};

// BUG FIX: this used to only ever send a "ticket:update" WS push — that
// only reaches a customer whose app happens to be open and listening at
// that exact moment (client:ws_message), and produces zero visible trace
// otherwise (no bell badge, no notification-list entry, nothing on next
// login). The customer had no way to discover an admin had replied.
// Persisting a real UserNotification (same two-step pattern already used
// by services/productReminders.js: create the row, then push a
// type:"notification" WS message so GlobalWebSocket.jsx's existing
// ux-notification branch fires) makes it show up in the customer's
// existing notification bell — durable, not just a live-tab refresh.
const notifyCustomer = async (ticket, message) => {
    if (!ticket.customerId) return;
    sendToUser(String(ticket.customerId), "ticket:update", { ticketId: String(ticket._id), subject: ticket.subject, message });
    try {
        await UserNotification.create({
            userId: ticket.customerId,
            type: "support_ticket",
            title: "Support ticket update",
            message,
            link: "/contact",
            meta: { ticketId: String(ticket._id) },
        });
        sendToUser(String(ticket.customerId), "notification", { type: "support_ticket", title: "Support ticket update", message });
    } catch (err) {
        console.warn("[notifyCustomer] Failed to persist notification:", err.message);
    }
};

// POST /api/admin/tickets/:id/reply
export const replyToTicket = async (req, res) => {
    try {
        const { message, isInternalNote } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, message: "message is required" });

        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

        const attachments = [];
        if (req.files?.length) {
            for (const file of req.files) {
                const uploaded = await uploadToCloudinary(file.buffer, `tickets/${ticket._id}`);
                attachments.push({ url: uploaded.secure_url, publicId: uploaded.public_id, name: file.originalname, type: file.mimetype });
            }
        }

        const internal = isInternalNote === true || isInternalNote === "true";
        ticket.messages.push({
            sender: "admin", senderId: req.user._id, senderName: req.user.name || "Admin",
            message: message.trim(), attachments, isInternalNote: internal,
        });

        if (!internal) {
            ticket.lastReplyAt = new Date();
            ticket.lastReplyBy = "admin";
            if (ticket.status === "open") ticket.status = "in_progress";
        }
        logActivity(ticket, internal ? "internal_note_added" : "replied", req);
        await ticket.save();

        if (!internal) await notifyCustomer(ticket, `Support replied to your ticket "${ticket.subject}"`);
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "replied", status: ticket.status });

        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[replyToTicket]", err);
        res.status(500).json({ success: false, message: "Failed to reply" });
    }
};

// POST /api/admin/tickets/:id/notes — internal-only note, no customer reply
export const addInternalNote = async (req, res) => {
    req.body.isInternalNote = true;
    return replyToTicket(req, res);
};

const simpleUpdate = (field, allowed, activityAction) => async (req, res) => {
    try {
        const value = req.body[field];
        if (!allowed.includes(value)) {
            return res.status(400).json({ success: false, message: `Invalid ${field}. Allowed: ${allowed.join(", ")}` });
        }
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

        const previous = ticket[field];
        ticket[field] = value;
        if (field === "status" && value === "closed") ticket.closedAt = new Date();
        if (field === "status" && previous === "closed" && value !== "closed") ticket.closedAt = null;
        logActivity(ticket, activityAction, req, { from: previous, to: value });
        await ticket.save();

        if (field === "status") await notifyCustomer(ticket, `Your ticket "${ticket.subject}" status changed to ${value.replace(/_/g, " ")}`);
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: activityAction, [field]: value });

        res.json({ success: true, ticket });
    } catch (err) {
        console.error(`[${activityAction}]`, err);
        res.status(500).json({ success: false, message: "Update failed" });
    }
};

// PATCH /api/admin/tickets/:id/status
export const changeStatus = simpleUpdate("status", STATUSES, "status_changed");
// PATCH /api/admin/tickets/:id/priority
export const changePriority = simpleUpdate("priority", PRIORITIES, "priority_changed");

// PATCH /api/admin/tickets/:id/assign
export const assignAdmin = async (req, res) => {
    try {
        const { adminId, adminName } = req.body;
        if (!adminId) return res.status(400).json({ success: false, message: "adminId required" });

        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

        ticket.assignedAdmin = adminId;
        logActivity(ticket, "assigned", req, { adminId, adminName });
        await ticket.save();

        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "assigned", assignedAdmin: adminId });
        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[assignAdmin]", err);
        res.status(500).json({ success: false, message: "Assignment failed" });
    }
};

// PATCH /api/admin/tickets/:id/close
export const closeTicket = (req, res) => { req.body.status = "closed"; return changeStatus(req, res); };
// PATCH /api/admin/tickets/:id/reopen
export const reopenTicket = (req, res) => { req.body.status = "open"; return changeStatus(req, res); };

export default {
    listTickets, getTicketStats, getTicketDetail, replyToTicket, addInternalNote,
    changeStatus, changePriority, assignAdmin, closeTicket, reopenTicket,
};
