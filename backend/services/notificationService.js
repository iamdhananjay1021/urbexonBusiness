/**
 * notificationService.js
 *
 * A modular, provider-agnostic service for sending notifications (Email, WhatsApp, etc.).
 * This centralizes notification logic, making it easy to swap providers or add new channels.
 */

import { sendEmail } from '../utils/emailService.js'; // Your existing email provider (e.g., Resend)
import { sendWhatsAppMessage } from './whatsappService.js'; // New WhatsApp service

// --- Email Templates (could be moved to a separate file) ---

const buildWelcomeEmail = (user) => ({
    to: user.email,
    subject: `Welcome to Urbexon, ${user.name}!`,
    html: `<h1>Hi ${user.name},</h1><p>Welcome to Urbexon! Your account has been created successfully. You can now proceed with your vendor application.</p>`,
    label: 'User/Welcome'
});

const buildApplicationReceivedEmail = (vendor) => ({
    to: vendor.email,
    subject: `We've Received Your Urbexon Vendor Application!`,
    html: `<h1>Hi ${vendor.ownerName},</h1><p>Thank you for applying to be a vendor on Urbexon. Your application for "${vendor.shopName}" is now under review. We'll notify you of the status soon.</p>`,
    label: 'Vendor/AppReceived'
});

const buildApplicationApprovedEmail = (vendor) => ({
    to: vendor.email,
    subject: `Congratulations! Your Urbexon Vendor Application is Approved`,
    html: `<h1>Hi ${vendor.ownerName},</h1><p>Great news! Your application for "${vendor.shopName}" has been approved. You can now log in to your vendor dashboard and start selling.</p>`,
    label: 'Vendor/AppApproved'
});

const buildApplicationRejectedEmail = (vendor) => ({
    to: vendor.email,
    subject: `Update on Your Urbexon Vendor Application`,
    html: `<h1>Hi ${vendor.ownerName},</h1><p>Thank you for your interest. After reviewing your application for "${vendor.shopName}", we are unable to approve it at this time.</p><p><b>Reason:</b> ${vendor.rejectionReason}</p><p>You can log in to edit and resubmit your application.</p>`,
    label: 'Vendor/AppRejected'
});

// --- WhatsApp Templates ---

const buildWelcomeWhatsApp = (user) => ({
    to: user.phone, // Assuming user.phone is WhatsApp enabled
    message: `Hi ${user.name}, welcome to Urbexon! Your account is ready. You can now complete your vendor application here: [link-to-application]`
});

const buildApplicationReceivedWhatsApp = (vendor) => ({
    to: vendor.whatsapp || vendor.phone,
    message: `Hi ${vendor.ownerName}, we've received your application for *${vendor.shopName}* and it's now under review. We'll keep you updated!`
});

// --- Service Functions ---

export const notifyUserWelcome = async (user) => {
    // Fire-and-forget notifications
    sendEmail(buildWelcomeEmail(user)).catch(console.error);
    if (user.phone) {
        sendWhatsAppMessage(buildWelcomeWhatsApp(user)).catch(console.error);
    }
};

export const notifyVendorApplicationReceived = async (vendor) => {
    sendEmail(buildApplicationReceivedEmail(vendor)).catch(console.error);
    if (vendor.whatsapp || vendor.phone) {
        sendWhatsAppMessage(buildApplicationReceivedWhatsApp(vendor)).catch(console.error);
    }
};

export const notifyVendorApplicationApproved = async (vendor) => {
    sendEmail(buildApplicationApprovedEmail(vendor)).catch(console.error);
    // Add WhatsApp notification if needed
};

export const notifyVendorApplicationRejected = async (vendor) => {
    sendEmail(buildApplicationRejectedEmail(vendor)).catch(console.error);
    // Add WhatsApp notification if needed
};