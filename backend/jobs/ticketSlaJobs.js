/**
 * ticketSlaJobs.js — SLA enforcement sweep for VENDOR and DELIVERY
 * support tickets.
 *
 * Scoped to requesterType vendor/delivery only — customer/legacy tickets
 * have null SLA fields (no due dates were ever computed for them), so they
 * can never match the due-date queries below even without the explicit
 * scope.
 *
 * Two passes, each one-shot per ticket by construction:
 *  1. Reminder  — first response overdue, no reminder sent yet
 *                 (slaReminderSentAt null = the guard).
 *  2. Escalation — reminder grace exhausted OR resolution overdue;
 *                 slaEscalated flag = the guard. Bumps priority one step
 *                 and raises an urgent admin alert.
 */
import Ticket from "../models/Ticket.js";
import { SLA_CONFIG } from "../config/slaConfig.js";
import { createNotification } from "../controllers/admin/notificationController.js";
import { broadcastToAdmins } from "../utils/wsHub.js";
import { sendNotification as sendToUser } from "../utils/notificationQueue.js";

const HOUR_MS = 60 * 60 * 1000;
const PRIORITY_BUMP = { low: "normal", normal: "high", high: "urgent", urgent: "urgent" };

const OPEN_STATUSES = ["open", "in_progress"];

export const sweepTicketSla = async () => {
    const now = new Date();
    let reminders = 0;
    let escalations = 0;

    // ── Pass 1: first-response reminders ──────────────────────────────
    const reminderDue = await Ticket.find({
        requesterType: { $in: ["vendor", "delivery"] },
        status: { $in: OPEN_STATUSES },
        firstResponseAt: null,
        slaFirstResponseDueAt: { $ne: null, $lt: now },
        slaReminderSentAt: null,
    }).limit(100);

    for (const ticket of reminderDue) {
        ticket.slaReminderSentAt = now;
        ticket.activityLog.push({ action: "sla_reminder_sent", actorName: "System" });
        await ticket.save();

        createNotification({
            type: "system",
            title: `SLA Reminder — ${ticket.requesterType === "delivery" ? "Delivery" : "Vendor"} Ticket Awaiting First Response`,
            message: `${ticket.vendorShopName || ticket.customerName}: "${ticket.subject}" (${ticket.priority}) has no reply past its SLA`,
            link: "/admin/support",
            meta: { ticketId: String(ticket._id), sla: "first_response_reminder" },
        }).catch(() => { });
        if (ticket.assignedAdmin) {
            sendToUser(String(ticket.assignedAdmin), "ticket:update", {
                ticketId: String(ticket._id),
                message: `SLA reminder: "${ticket.subject}" needs a first response`,
            });
        }
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "sla_reminder", requesterType: ticket.requesterType });
        reminders++;
    }

    // ── Pass 2: escalation (one-shot via slaEscalated) ─────────────────
    const candidates = await Ticket.find({
        requesterType: { $in: ["vendor", "delivery"] },
        status: { $in: OPEN_STATUSES },
        slaEscalated: false,
        $or: [
            { firstResponseAt: null, slaFirstResponseDueAt: { $ne: null, $lt: now } },
            { slaResolutionDueAt: { $ne: null, $lt: now } },
        ],
    }).limit(100);

    for (const ticket of candidates) {
        // First-response breaches get the configured grace period after the
        // due date before escalating (the reminder pass already fired inside
        // that window); resolution breaches escalate immediately.
        const graceMs = (SLA_CONFIG.escalationGraceHours[ticket.priority] ?? 6) * HOUR_MS;
        const firstResponseBreached =
            !ticket.firstResponseAt &&
            ticket.slaFirstResponseDueAt &&
            now.getTime() - new Date(ticket.slaFirstResponseDueAt).getTime() > graceMs;
        const resolutionBreached =
            ticket.slaResolutionDueAt && new Date(ticket.slaResolutionDueAt) < now;

        if (!firstResponseBreached && !resolutionBreached) continue;

        const previousPriority = ticket.priority;
        ticket.priority = PRIORITY_BUMP[ticket.priority] || "urgent";
        ticket.slaEscalated = true;
        ticket.escalatedAt = now;
        ticket.activityLog.push({
            action: "sla_escalated",
            actorName: "System",
            meta: {
                reason: firstResponseBreached ? "first_response_breach" : "resolution_breach",
                priorityFrom: previousPriority,
                priorityTo: ticket.priority,
            },
        });
        await ticket.save();

        createNotification({
            type: "system",
            title: `🚨 SLA BREACH — ${ticket.requesterType === "delivery" ? "Delivery" : "Vendor"} Ticket Escalated`,
            message: `${ticket.vendorShopName || ticket.customerName}: "${ticket.subject}" escalated to ${ticket.priority} (${firstResponseBreached ? "no first response" : "resolution overdue"})`,
            link: "/admin/support",
            meta: { ticketId: String(ticket._id), sla: "escalated" },
        }).catch(() => { });
        broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "sla_escalated", requesterType: ticket.requesterType, priority: ticket.priority });
        escalations++;
    }

    return { reminders, escalations };
};
