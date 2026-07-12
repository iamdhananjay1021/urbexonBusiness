/**
 * whatsappService.js
 *
 * A pluggable service for sending WhatsApp messages.
 * This can be integrated with any provider like Twilio, Meta Cloud API, etc.
 *
 * For now, it logs to the console for development and testing purposes.
 */

const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'console'; // e.g., 'twilio', 'meta'

/**
 * True only when a real, officially-supported Business API provider is
 * configured via env. Callers use this to skip building/sending a message
 * entirely in 'console' mode rather than relying on sendWhatsAppMessage's
 * own no-op behavior — keeps call sites cheap when WhatsApp isn't set up.
 */
export const isWhatsAppConfigured = () => WHATSAPP_PROVIDER !== 'console';

/**
 * Sends a WhatsApp message.
 * @param {object} params - The message parameters.
 * @param {string} params.to - The recipient's phone number.
 * @param {string} params.message - The message content.
 */
export const sendWhatsAppMessage = async ({ to, message }) => {
    if (!isWhatsAppConfigured()) {
        console.log(`[WhatsAppService] No provider configured (WHATSAPP_PROVIDER=console) — skipping WhatsApp send to ${to}`);
        return;
    }
    console.log(`[WhatsAppService] Provider: ${WHATSAPP_PROVIDER}`);
    console.log(`[WhatsAppService] Sending to: ${to}`);
    console.log(`[WhatsAppService] Message: "${message}"`);
    // TODO: Implement actual provider logic (e.g., Twilio, Meta) based on WHATSAPP_PROVIDER.
    // Only official Business API integrations belong here — never
    // unofficial/browser-automation WhatsApp sending.
};