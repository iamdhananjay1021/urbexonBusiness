/**
 * whatsappService.js
 *
 * A pluggable service for sending WhatsApp messages. Every call site in
 * this codebase (orderKickoff.js, deliveryController.js, vendorOrders.js,
 * notificationService.js, broadcastService.js) uses the same
 * `{ to, message }` free-text shape, so that's the contract this keeps —
 * provider-specific mapping happens inside sendWhatsAppMessage.
 *
 * BUG FIX: this used to be a pure stub — it console.logged and returned
 * undefined even when WHATSAPP_PROVIDER=meta was set, so every WhatsApp
 * send anywhere in the app (order confirmations, delivery updates,
 * broadcasts) silently did nothing while looking fully wired up. Now
 * actually calls the Meta Cloud API when configured.
 *
 * IMPORTANT — Meta/WhatsApp Business API constraint: free-text
 * "business-initiated" messages only deliver if the recipient messaged
 * your business number within the last 24h (the "customer service
 * window"). Outside that window, Meta rejects free text and requires a
 * pre-approved message *template*. For proactive sends (order
 * confirmations, admin broadcasts) that window usually isn't open, so in
 * practice this needs an approved template swapped in via
 * WHATSAPP_TEMPLATE_NAME once one exists in Meta Business Manager — until
 * then, expect delivery to fail outside the 24h window with a clear
 * error surfaced in the result rather than a silent console-log no-op.
 */
const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'console'; // 'console' | 'meta'
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || null;

/**
 * True only when a real, officially-supported Business API provider is
 * configured via env. Callers use this to skip building/sending a message
 * entirely in 'console' mode rather than relying on sendWhatsAppMessage's
 * own no-op behavior — keeps call sites cheap when WhatsApp isn't set up.
 */
export const isWhatsAppConfigured = () =>
    WHATSAPP_PROVIDER === 'meta' && Boolean(WHATSAPP_PHONE_ID && WHATSAPP_TOKEN);

const normalizeIndianNumber = (raw) => {
    const digits = String(raw).replace(/\D/g, "");
    return digits.startsWith("91") ? digits : `91${digits}`;
};

/**
 * Sends a WhatsApp message.
 * @param {object} params - The message parameters.
 * @param {string} params.to - The recipient's phone number.
 * @param {string} params.message - The message content.
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendWhatsAppMessage = async ({ to, message }) => {
    if (!isWhatsAppConfigured()) {
        console.log(`[WhatsAppService] No provider configured (need WHATSAPP_PROVIDER=meta + WHATSAPP_PHONE_ID + WHATSAPP_TOKEN) — skipping send to ${to}`);
        return { success: false, error: "not_configured" };
    }

    const number = normalizeIndianNumber(to);
    const body = WHATSAPP_TEMPLATE_NAME
        ? {
            messaging_product: "whatsapp",
            to: number,
            type: "template",
            template: {
                name: WHATSAPP_TEMPLATE_NAME,
                language: { code: "en" },
                components: [{ type: "body", parameters: [{ type: "text", text: message }] }],
            },
        }
        : {
            messaging_product: "whatsapp",
            to: number,
            type: "text",
            text: { body: message, preview_url: false },
        };

    try {
        const res = await fetch(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(8_000),
        });

        const data = await res.json();
        if (data.error) {
            console.error(`[WhatsAppService] API error → ${number}:`, data.error.message || data.error);
            return { success: false, error: data.error.message || "meta_api_error" };
        }

        console.log(`[WhatsAppService] Sent → ${number} | ID: ${data.messages?.[0]?.id}`);
        return { success: true, messageId: data.messages?.[0]?.id };
    } catch (err) {
        console.error(`[WhatsAppService] Send failed → ${number}:`, err?.message || err);
        return { success: false, error: err?.message || String(err) };
    }
};