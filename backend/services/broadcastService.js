/**
 * broadcastService.js — email/WhatsApp fan-out for POST /admin/broadcast.
 *
 * The WS side of a broadcast (wsHub.broadcastAll/broadcastToAdmins) is
 * instant and needs no help. Email/WhatsApp are a different shape of
 * problem: the recipient list can be thousands of rows, each send is a
 * network call to an external provider (Resend/SMTP, Meta Cloud API), and
 * running that inside the request/response cycle would either time out
 * the HTTP request or (if fired with zero throttling, one Promise per
 * recipient) burst past provider rate limits. So this always runs
 * detached from the request — the controller calls `fanoutBroadcast`
 * without awaiting it — and caps how many sends are in flight at once.
 */
import User from "../models/User.js";
import Vendor from "../models/vendorModels/Vendor.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import BroadcastLog from "../models/BroadcastLog.js";
import { sendEmail } from "../utils/emailService.js";
import { sendWhatsAppMessage, isWhatsAppConfigured } from "./whatsappService.js";

const CONCURRENCY = 5;

/** Runs `worker` over `items` with at most `limit` in flight at once. */
const runWithConcurrency = async (items, limit, worker) => {
    let cursor = 0;
    const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
        while (cursor < items.length) {
            const i = cursor++;
            await worker(items[i], i);
        }
    });
    await Promise.all(runners);
};

/**
 * Resolves the broadcast audience into concrete recipients with an email
 * and/or phone. "admins" mirrors the WS room of the same name (admin/owner
 * roles, stored on User). "all" is every customer, approved vendor, and
 * approved delivery partner — deliberately excludes pending/rejected
 * applicants, who aren't real platform users yet.
 */
const getRecipients = async (audience) => {
    if (audience === "admins") {
        const admins = await User.find({ role: { $in: ["admin", "owner"] } })
            .select("name email phone")
            .lean();
        return admins.map((u) => ({ name: u.name, email: u.email, phone: u.phone }));
    }

    const [customers, vendors, riders] = await Promise.all([
        User.find({ role: "user" }).select("name email phone").lean(),
        Vendor.find({ status: "approved" }).select("ownerName email phone").lean(),
        DeliveryBoy.find({ status: "approved" }).select("name email phone").lean(),
    ]);

    return [
        ...customers.map((u) => ({ name: u.name, email: u.email, phone: u.phone })),
        ...vendors.map((v) => ({ name: v.ownerName, email: v.email, phone: v.phone })),
        ...riders.map((r) => ({ name: r.name, email: r.email, phone: r.phone })),
    ];
};

const broadcastEmailHtml = (message, fromName) => `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
        <h2 style="margin:0 0 4px;color:#0f0d2e;">📢 Announcement</h2>
        <p style="color:#64748b;font-size:12px;margin:0 0 20px;">From ${fromName} — Urbexon</p>
        <p style="font-size:15px;line-height:1.6;color:#1e293b;white-space:pre-wrap;">${message}</p>
    </div>
`;

/**
 * Fire-and-forget entry point — the controller calls this WITHOUT await.
 * Never throws: every failure is caught, counted, and written to the log
 * instead of propagating (this runs long after the HTTP response is sent,
 * there's nothing left to catch it).
 */
export const fanoutBroadcast = async ({ logId, message, audience, channels, fromName }) => {
    try {
        const recipients = await getRecipients(audience);
        const emailStats = { attempted: 0, sent: 0, failed: 0 };
        const whatsappStats = { attempted: 0, sent: 0, failed: 0 };

        if (channels.email) {
            const withEmail = recipients.filter((r) => r.email && r.email.includes("@"));
            emailStats.attempted = withEmail.length;
            await runWithConcurrency(withEmail, CONCURRENCY, async (r) => {
                const result = await sendEmail({
                    to: r.email,
                    subject: "📢 Announcement from Urbexon",
                    html: broadcastEmailHtml(message, fromName),
                    label: "AdminBroadcast",
                }).catch((err) => ({ success: false, error: err?.message }));
                if (result.success) emailStats.sent++; else emailStats.failed++;
            });
        }

        if (channels.whatsapp && isWhatsAppConfigured()) {
            const withPhone = recipients.filter((r) => r.phone);
            whatsappStats.attempted = withPhone.length;
            await runWithConcurrency(withPhone, CONCURRENCY, async (r) => {
                const result = await sendWhatsAppMessage({
                    to: r.phone,
                    message: `📢 *Announcement from Urbexon*\n\n${message}`,
                }).catch((err) => ({ success: false, error: err?.message }));
                if (result?.success) whatsappStats.sent++; else whatsappStats.failed++;
            });
        }

        await BroadcastLog.findByIdAndUpdate(logId, {
            status: "completed",
            emailStats,
            whatsappStats,
        }).catch(() => { });
    } catch (err) {
        console.error("[fanoutBroadcast] failed:", err.message);
        await BroadcastLog.findByIdAndUpdate(logId, { status: "completed" }).catch(() => { });
    }
};
