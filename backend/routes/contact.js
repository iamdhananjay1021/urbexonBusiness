import express from "express";
import Contact from "../models/Contact.js";
import Newsletter from "../models/Newsletter.js";
import Ticket from "../models/Ticket.js";
import { protect, adminOnly, optionalAuth } from "../middlewares/authMiddleware.js";
import { sendEmail } from "../utils/emailService.js"; // ✅ Nodemailer service
import { broadcastToAdmins } from "../utils/wsHub.js";
import { createNotification } from "../controllers/admin/notificationController.js";

const router = express.Router();

/* ==============================================
   POST /api/contact
   User se contact form submit

   BUG FIX: this route never checked whether the requester was logged in
   (no auth middleware at all, req.user always ignored) and only ever
   wrote to the Contact model — which has NO admin-facing UI anywhere in
   admin/src (its GET/PATCH routes below were fully working but never
   called by any page). Meanwhile the admin's actual working "Customer
   Support" screen (AdminCustomerSupport.jsx) only ever reads from the
   separate Ticket model. Net effect: a logged-in customer's message was
   saved successfully but was invisible to admin in the only screen they
   check. Now: a logged-in submitter's message becomes a real Ticket (so
   it shows up where admin already looks, with the existing WS broadcast +
   admin notification the ticket system already provides); an anonymous
   guest's message still falls back to the Contact record + email exactly
   as before (now surfaced too — see AdminCustomerSupport.jsx's Guest
   Messages panel).
============================================== */
router.post("/", optionalAuth, async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        if (req.user) {
            const ticket = await Ticket.create({
                customerId: req.user._id,
                customerName: name || req.user.name || "Customer",
                customerEmail: email || req.user.email,
                customerPhone: phone || req.user.phone || "",
                subject: subject?.trim() || "Contact form submission",
                category: "other",
                messages: [{ sender: "customer", senderId: req.user._id, senderName: name || req.user.name || "Customer", message }],
                lastReplyAt: new Date(),
                lastReplyBy: "customer",
                activityLog: [{ action: "created", actorId: req.user._id, actorName: name || req.user.name || "Customer" }],
            });
            createNotification({
                type: "system",
                title: "New Support Ticket",
                message: `${ticket.customerName}: ${ticket.subject}`,
                link: `/admin/support/${ticket._id}`,
                meta: { ticketId: String(ticket._id) },
            }).catch(() => {});
            broadcastToAdmins("admin:ticket_event", { ticketId: String(ticket._id), event: "created", status: ticket.status });
            return res.status(200).json({ success: true });
        }

        // Anonymous/guest submission — unchanged Contact-record path.
        await Contact.create({ name, email, phone, subject, message });

        const emailResult = await sendEmail({
            to: "dhananjay072007@gmail.com",
            subject: `📩 New Contact: ${subject || "No Subject"} — ${name}`,
            html: `
                <div style="font-family:sans-serif; max-width:500px; margin:auto; border:1px solid #22c55e; border-radius:10px; overflow:hidden;">
                    <div style="background:#22c55e; padding:16px 24px;">
                        <h2 style="color:white; margin:0;">New Contact Form Submission</h2>
                    </div>
                    <div style="padding:24px; background:#fff;">
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
                        <p><strong>Subject:</strong> ${subject || "Not provided"}</p>
                        <hr style="border:none; border-top:1px solid #eee; margin:16px 0;" />
                        <p><strong>Message:</strong></p>
                        <p style="background:#f0fdf4; padding:12px; border-radius:8px;">
                            ${message}
                        </p>
                    </div>
                    <div style="background:#f0fdf4; padding:12px 24px; text-align:center;">
                        <small style="color:#6b7280;">UrbeXon — Contact System</small>
                    </div>
                </div>
            `
        });
        // BUG FIX: the email result was previously never checked — a total
        // send failure (bad API key, rate limit, etc.) was completely
        // invisible. The customer still gets "message sent" (the DB write,
        // which is the actual source of truth, already succeeded), but
        // this is no longer silent server-side.
        if (!emailResult.success) {
            console.error("❌ Contact notification email failed:", emailResult.error);
        }

        res.status(200).json({ success: true });

    } catch (err) {
        console.error("❌ Contact route error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

/* ==============================================
   GET /api/contact
   Admin — sab queries fetch
============================================== */
router.get("/", protect, adminOnly, async (req, res) => {
    try {
        const queries = await Contact.find()
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(queries);

    } catch (err) {
        console.error("❌ GET CONTACTS ERROR:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

/* ==============================================
   PATCH /api/contact/:id/read
   Admin — mark as read
============================================== */
router.patch("/:id/read", protect, adminOnly, async (req, res) => {
    try {
        await Contact.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true });

    } catch (err) {
        console.error("❌ MARK READ ERROR:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

/* ==============================================
   POST /api/contact/newsletter
   Subscribe to newsletter
============================================== */
router.post("/newsletter", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: "Valid email required" });
        }
        await Newsletter.findOneAndUpdate(
            { email: email.toLowerCase().trim() },
            { email: email.toLowerCase().trim() },
            { upsert: true }
        );
        res.json({ success: true, message: "Subscribed successfully!" });
    } catch (err) {
        console.error("[newsletter]", err.message);
        res.status(500).json({ success: false, message: "Failed to subscribe" });
    }
});

export default router;