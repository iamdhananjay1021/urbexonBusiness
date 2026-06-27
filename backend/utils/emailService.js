import { Resend } from "resend";
import nodemailer from "nodemailer";

const useResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
if (!useResend) {
    console.warn("⚠️ RESEND_API_KEY not set — SMTP fallback will be used if configured");
}

const resend = useResend ? new Resend(process.env.RESEND_API_KEY) : null;

// localhost  → onboarding@resend.dev  (no domain verification needed)
// production → your actual domain email from .env
const isDev = process.env.NODE_ENV !== "production";
const FROM_EMAIL = isDev ? "onboarding@resend.dev" : (process.env.FROM_EMAIL || process.env.SMTP_FROM || "no-reply@urbexon.in");
const FROM_NAME = process.env.FROM_NAME || "Urbexon Team";

// ══════════════════════════════════════════════
// CORE SEND — used internally, always returns
// ══════════════════════════════════════════════
export const sendEmail = async ({
    to,
    subject,
    html,
    fromName = FROM_NAME,
    label = "General",
}) => {
    if (!to || !to.includes("@")) {
        console.error(`❌ [${label}] Invalid email address: ${to}`);
        return { success: false, error: "Invalid email address" };
    }
    // First try Resend (if configured)
    if (useResend && resend) {
        try {
            const { data, error } = await resend.emails.send({
                from: `${fromName} <${FROM_EMAIL}>`,
                to,
                subject: subject.trim(),
                html,
            });

            if (error) {
                console.error(`❌ [${label}] Resend API error → ${to}:`, error.message);
                // fallthrough to SMTP fallback
            } else {
                console.log(`✅ [${label}] Email sent (Resend) → ${to} | ID: ${data.id}`);
                return { success: true, messageId: data.id };
            }
        } catch (err) {
            console.error(`❌ [${label}] Resend call failed → ${to}:`, err?.message || err);
            // fallthrough to SMTP fallback
        }
    }

    // Fallback: nodemailer SMTP (if configured)
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        const msg = "SMTP not configured; cannot send email via fallback";
        console.error(`❌ [${label}] ${msg}`);
        return { success: false, error: msg };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587", 10),
            secure: (process.env.SMTP_SECURE || "false") === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const info = await transporter.sendMail({
            from: `${fromName} <${FROM_EMAIL}>`,
            to,
            subject: subject.trim(),
            html,
        });

        console.log(`✅ [${label}] Email sent (SMTP) → ${to} | MessageId: ${info.messageId || info.response}`);
        return { success: true, messageId: info.messageId || info.response };
    } catch (err) {
        console.error(`❌ [${label}] SMTP send failed → ${to}:`, err?.message || err);
        return { success: false, error: err?.message || String(err) };
    }
};

// ══════════════════════════════════════════════
// FIRE-AND-FORGET — non-blocking wrapper
// Use this everywhere in controllers so the API
// responds instantly without waiting for email.
// ══════════════════════════════════════════════
export const sendEmailBackground = (options) => {
    // Intentionally NOT awaited — runs in background
    sendEmail(options).then((result) => {
        if (!result.success) {
            // Safe to log here; this runs after response is already sent
            console.error(`🔁 [Background] Email failed for ${options.to}:`, result.error);
            // Optional: push to a retry queue here if needed later
        }
    });
    // Returns immediately — does not block caller
};

export function getEmailStatus() {
    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    return {
        provider: useResend ? "resend" : (smtpConfigured ? "smtp" : "none"),
        useResend,
        resendApiKeyPresent: useResend,
        smtpConfigured,
        fromEmail: FROM_EMAIL,
    };
}