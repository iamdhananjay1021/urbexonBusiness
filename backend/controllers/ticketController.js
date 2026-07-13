/**
 * ticketController.js — customer-facing side of the support ticket system.
 * Creation + own-ticket reply only; admin case-management lives in
 * controllers/admin/ticketController.js.
 */
import Ticket from "../models/Ticket.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { broadcastToAdmins } from "../utils/wsHub.js";
import { sendNotification as sendToUser } from "../utils/notificationQueue.js";
import { createNotification } from "./admin/notificationController.js";

const CATEGORIES = ["order", "payment", "delivery", "product", "vendor", "account", "other"];

// POST /api/tickets — create a new ticket
export const createTicket = async (req, res) => {
    try {
        const { subject, message, category, orderId, productId, vendorId } = req.body;
        if (!subject?.trim()) return res.status(400).json({ success: false, message: "Subject is required" });
        if (!message?.trim()) return res.status(400).json({ success: false, message: "Message is required" });

        const attachments = [];
        if (req.files?.length) {
            for (const file of req.files) {
                const uploaded = await uploadToCloudinary(file.buffer, `tickets/pending/${req.user._id}`);
                attachments.push({ url: uploaded.secure_url, publicId: uploaded.public_id, name: file.originalname, type: file.mimetype });
            }
        }

        const ticket = await Ticket.create({
            customerId: req.user._id,
            customerName: req.user.name || "Customer",
            customerEmail: req.user.email,
            customerPhone: req.user.phone || "",
            subject: subject.trim(),
            category: CATEGORIES.includes(category) ? category : "other",
            orderRef: orderId || null,
            productRef: productId || null,
            vendorRef: vendorId || null,
            messages: [{ sender: "customer", senderId: req.user._id, senderName: req.user.name || "Customer", message: message.trim(), attachments }],
            lastReplyAt: new Date(),
            lastReplyBy: "customer",
            activityLog: [{ action: "created", actorId: req.user._id, actorName: req.user.name || "Customer" }],
        });

        createNotification({
            type: "system",
            title: "New Support Ticket",
            message: `${ticket.customerName}: ${ticket.subject}`,
            link: `/admin/support/${ticket._id}`,
            meta: { ticketId: String(ticket._id) },
        }).catch(() => {});
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "created", status: ticket.status });

        res.status(201).json({ success: true, ticket });
    } catch (err) {
        console.error("[createTicket]", err);
        res.status(500).json({ success: false, message: "Failed to create ticket" });
    }
};

// GET /api/tickets/my
export const getMyTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ customerId: req.user._id })
            .select("-messages.attachments -activityLog")
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, tickets });
    } catch (err) {
        console.error("[getMyTickets]", err);
        res.status(500).json({ success: false, message: "Failed to fetch tickets" });
    }
};

// GET /api/tickets/:id — own ticket only
export const getMyTicketDetail = async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ _id: req.params.id, customerId: req.user._id })
            .select("-messages.isInternalNote") // belt-and-braces; customer query below also filters these out
            .lean();
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        // Internal notes must never reach the customer even if a future
        // change to the .select() projection above regresses.
        ticket.messages = (ticket.messages || []).filter((m) => !m.isInternalNote);
        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[getMyTicketDetail]", err);
        res.status(500).json({ success: false, message: "Failed to fetch ticket" });
    }
};

// POST /api/tickets/:id/reply — own ticket only
export const replyToMyTicket = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, message: "message is required" });

        const ticket = await Ticket.findOne({ _id: req.params.id, customerId: req.user._id });
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        if (["resolved", "closed"].includes(ticket.status)) {
            return res.status(400).json({ success: false, message: "This ticket is closed. Please open a new one." });
        }

        const attachments = [];
        if (req.files?.length) {
            for (const file of req.files) {
                const uploaded = await uploadToCloudinary(file.buffer, `tickets/${ticket._id}`);
                attachments.push({ url: uploaded.secure_url, publicId: uploaded.public_id, name: file.originalname, type: file.mimetype });
            }
        }

        ticket.messages.push({ sender: "customer", senderId: req.user._id, senderName: req.user.name || "Customer", message: message.trim(), attachments });
        ticket.status = "open";
        ticket.lastReplyAt = new Date();
        ticket.lastReplyBy = "customer";
        ticket.activityLog.push({ action: "customer_replied", actorId: req.user._id, actorName: req.user.name || "Customer" });
        await ticket.save();

        if (ticket.assignedAdmin) {
            sendToUser(String(ticket.assignedAdmin), "ticket:update", { ticketId: String(ticket._id), message: "Customer replied to an assigned ticket" });
        }
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "customer_replied", status: ticket.status });

        res.json({ success: true, ticket });
    } catch (err) {
        console.error("[replyToMyTicket]", err);
        res.status(500).json({ success: false, message: "Failed to reply" });
    }
};
