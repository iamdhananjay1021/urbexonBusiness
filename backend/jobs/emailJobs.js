/**
 * 📧 EMAIL AUTOMATION JOBS
 * Send order confirmations, delivery updates, abandoned cart reminders
 */

import Order from '../models/Order.js';
import User from '../models/User.js';
import Vendor from '../models/vendorModels/Vendor.js';
import DeliveryBoy from '../models/deliveryModels/DeliveryBoy.js';
import logger from '../utils/logger.js';
import { sendEmail } from '../utils/emailService.js';
import { adminDailySummaryEmail } from '../utils/emailTemplates.js';

// ══════════════════════════════════════════════════════
// 1️⃣ SEND PENDING ORDER EMAILS
// ══════════════════════════════════════════════════════
export const sendPendingOrderEmails = async () => {
    try {
        // Orders confirmed but no email sent
        const orders = await Order.find({
            status: 'CONFIRMED',
            emailSent: { $ne: true },
            createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) }, // Last 1 hour
        }).populate('userId', 'email name');

        if (orders.length === 0) {
            return { emailsSent: 0 };
        }

        let sent = 0;
        for (const order of orders) {
            if (!order.userId?.email) continue;
            try {
                await sendEmail({
                    to: order.userId.email,
                    subject: `✅ Order Confirmed - ${order.orderId}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                            <h2>Order Confirmed!</h2>
                            <p>Hi ${order.userId.name},</p>
                            <p>Your order <strong>${order.orderId}</strong> has been confirmed.</p>
                            <ul>
                                <li>Total Amount: ₹${order.total}</li>
                                <li>Items: ${order.items.length}</li>
                            </ul>
                            <p><a href="https://urbexon.in/orders/${order._id}">View Order Details</a></p>
                            <p>Expected Delivery: ${order.delivery?.expectedDate || 'N/A'}</p>
                        </div>
                    `,
                });

                await Order.findByIdAndUpdate(order._id, { emailSent: true });
                sent++;
            } catch (err) {
                logger.warn(`Failed to send email for order ${order._id}`);
            }
        }

        logger.info(`📧 Sent ${sent}/${orders.length} order confirmation emails`);
        return { emailsSent: sent };
    } catch (err) {
        logger.error('Send Order Emails Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 2️⃣ SEND DELIVERY UPDATES
// ══════════════════════════════════════════════════════
export const sendDeliveryUpdates = async () => {
    try {
        // Orders with status changes - out for delivery
        const orders = await Order.find({
            status: 'OUT_FOR_DELIVERY',
            'delivery.lastEmailNotification': {
                $lt: new Date(Date.now() - 60 * 60 * 1000), // Last notified > 1 hour ago
            },
        }).populate('userId', 'email name phone');

        if (orders.length === 0) {
            return { updatesSent: 0 };
        }

        let sent = 0;
        for (const order of orders) {
            if (!order.userId?.email) continue;
            try {
                const message = `Hi ${order.userId.name}, your order ${order.orderId} is out for delivery. Delivery boy will reach you soon. Track your order: https://urbexon.in/track/${order._id}`;

                // SMS (can be added later via Twilio/free SMS service)
                // WhatsApp (can be added via WhatsApp Business API)

                await sendEmail({
                    to: order.userId.email,
                    subject: `📍 Your Order is Out for Delivery - ${order.orderId}`,
                    html: `<p>${message}</p>`,
                });

                await Order.findByIdAndUpdate(order._id, {
                    'delivery.lastEmailNotification': new Date(),
                });
                sent++;
            } catch (err) {
                logger.warn(`Failed to send delivery update for order ${order._id}`);
            }
        }

        logger.info(`📍 Sent ${sent}/${orders.length} delivery update emails`);
        return { updatesSent: sent };
    } catch (err) {
        logger.error('Send Delivery Updates Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 3️⃣ SEND ABANDONED CART REMINDERS (DISABLED - NO CART MODEL)
// ══════════════════════════════════════════════════════
export const sendAbandonedCartReminders = async () => {
    try {
        // Cart model not available in current schema
        // This feature can be implemented when cart collection is added
        logger.warn('⏭️  Abandoned cart reminders skipped - Cart model not available');
        return { remindersSent: 0 };
    } catch (err) {
        logger.error('Send Abandoned Cart Reminders Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 4️⃣ SEND ADMIN DAILY SUMMARY
// ══════════════════════════════════════════════════════
export const sendAdminDailySummary = async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        logger.warn('⏭️  Admin daily summary skipped — ADMIN_EMAIL not set');
        return { sent: false };
    }

    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [orders, newUsers, vendors, riders] = await Promise.all([
            Order.find({ createdAt: { $gte: todayStart } }).lean(),
            User.countDocuments({ createdAt: { $gte: todayStart } }),
            Vendor.countDocuments({ isApproved: true }),
            DeliveryBoy.countDocuments({ isApproved: true }),
        ]);

        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const cancelled = orders.filter(o => o.orderStatus === 'CANCELLED').length;
        const pending = orders.filter(o => ['PLACED', 'CONFIRMED'].includes(o.orderStatus)).length;

        const stats = {
            totalOrders: orders.length,
            totalRevenue,
            newUsers,
            cancelledOrders: cancelled,
            activeVendors: vendors,
            activeRiders: riders,
            pendingOrders: pending,
        };

        const html = adminDailySummaryEmail(stats);
        await sendEmail({
            to: adminEmail,
            subject: `📊 Urbexon Daily Summary — ${todayStart.toLocaleDateString('en-IN')}`,
            html,
        });

        logger.info('📊 Admin daily summary email sent');
        return { sent: true, stats };
    } catch (err) {
        logger.error('Admin Daily Summary Error:', err);
        throw { message: err.message };
    }
};
