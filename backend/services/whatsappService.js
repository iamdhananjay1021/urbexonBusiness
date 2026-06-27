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
 * Sends a WhatsApp message.
 * @param {object} params - The message parameters.
 * @param {string} params.to - The recipient's phone number.
 * @param {string} params.message - The message content.
 */
export const sendWhatsAppMessage = async ({ to, message }) => {
    console.log(`[WhatsAppService] Provider: ${WHATSAPP_PROVIDER}`);
    console.log(`[WhatsAppService] Sending to: ${to}`);
    console.log(`[WhatsAppService] Message: "${message}"`);
    // TODO: Implement actual provider logic (e.g., Twilio, Meta) based on WHATSAPP_PROVIDER
};