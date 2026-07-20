/**
 * 📦 ORDER & INVENTORY AUTOMATION JOBS
 * Auto-complete orders, refunds, invoices, stock tracking
 */

import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Vendor from '../models/vendorModels/Vendor.js';
import logger from '../utils/logger.js';
import { sendEmail } from '../utils/emailService.js';
import { getOrderStatusEmailTemplate } from '../utils/orderStatusEmail.js';
import { notify } from '../services/notificationEngine.js';

// ══════════════════════════════════════════════════════
// 0️⃣ AUTO-CANCEL STALE COD ORDERS
// ══════════════════════════════════════════════════════
export const autoCancelStaleCODOrders = async () => {
    try {
        const COD_CANCEL_HOURS = Number(process.env.COD_CANCEL_HOURS) || 48;
        const UH_COD_CANCEL_HOURS = 2; // UH orders should not sit in PLACED for long
        const cutoff = new Date(Date.now() - COD_CANCEL_HOURS * 60 * 60 * 1000);
        const uhCutoff = new Date(Date.now() - UH_COD_CANCEL_HOURS * 60 * 60 * 1000);

        // Find stale COD orders still in PLACED (not confirmed)
        // UH orders use shorter window (2h), ecommerce uses 48h
        const staleOrders = await Order.find({
            orderStatus: 'PLACED',
            'payment.method': 'COD',
            $or: [
                { orderMode: 'URBEXON_HOUR', 'statusTimeline.placedAt': { $lt: uhCutoff } },
                { orderMode: { $ne: 'URBEXON_HOUR' }, 'statusTimeline.placedAt': { $lt: cutoff } },
            ],
        }).select('_id user items email customerName invoiceNumber orderMode').lean();

        if (staleOrders.length === 0) return { cancelledOrders: 0 };

        const orderIds = staleOrders.map(o => o._id);

        await Order.updateMany(
            { _id: { $in: orderIds } },
            {
                $set: {
                    orderStatus: 'CANCELLED',
                    'statusTimeline.cancelledAt': new Date(),
                    cancelReason: `Auto-cancelled: COD order not confirmed within ${COD_CANCEL_HOURS}h`,
                },
            }
        );

        // Restore stock for each cancelled order
        for (const order of staleOrders) {
            if (order.items?.length) {
                for (const item of order.items) {
                    await Product.findByIdAndUpdate(item.productId, {
                        $inc: { stock: item.qty || 1 },
                    }).catch(() => { });
                }
            }

            // Notify customer
            if (order.email && !order.email.includes('@placeholder.com')) {
                const mail = getOrderStatusEmailTemplate({
                    customerName: order.customerName,
                    orderId: order._id,
                    status: 'CANCELLED',
                });
                sendEmail({ to: order.email, subject: mail.subject, html: mail.html, label: 'Auto/CODCancel' });
            }
        }

        logger.info(`🚫 Auto-cancelled ${staleOrders.length} stale COD orders (>${COD_CANCEL_HOURS}h)`);
        return { cancelledOrders: staleOrders.length };
    } catch (err) {
        logger.error('Auto-Cancel COD Orders Error:', err);
        throw { message: err.message, critical: false };
    }
};

// ══════════════════════════════════════════════════════
// 1️⃣ AUTO-COMPLETE DELIVERED ORDERS
// ══════════════════════════════════════════════════════
export const autoCompleteDeliveredOrders = async () => {
    try {
        // UH orders: auto-complete after 4 hours (generous buffer for 45-120 min delivery)
        const uhCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const uhUpdated = await Order.updateMany(
            {
                orderStatus: 'OUT_FOR_DELIVERY',
                orderMode: 'URBEXON_HOUR',
                updatedAt: { $lt: uhCutoff },
                isAutoCompleted: { $ne: true },
            },
            {
                $set: {
                    orderStatus: 'DELIVERED',
                    isAutoCompleted: true,
                    'statusTimeline.deliveredAt': new Date(),
                    'payment.status': 'PAID',
                    'delivery.status': 'DELIVERED',
                },
            }
        );
        if (uhUpdated.modifiedCount > 0) {
            logger.info(`✅ Auto-Completed ${uhUpdated.modifiedCount} UH orders (OUT_FOR_DELIVERY > 4hrs)`);
        }

        // Ecommerce orders: auto-complete after 24 hours
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const updated = await Order.updateMany(
            {
                orderStatus: 'OUT_FOR_DELIVERY',
                orderMode: { $ne: 'URBEXON_HOUR' },
                updatedAt: { $lt: cutoffTime },
                isAutoCompleted: { $ne: true },
            },
            {
                $set: {
                    orderStatus: 'DELIVERED',
                    isAutoCompleted: true,
                    'statusTimeline.deliveredAt': new Date(),
                    'payment.status': 'PAID',
                    'delivery.status': 'DELIVERED',
                },
            }
        );

        if (updated.modifiedCount > 0) {
            logger.info(
                `✅ Auto-Completed ${updated.modifiedCount} ecommerce orders (OUT_FOR_DELIVERY > 24hrs)`
            );
        }

        return { ordersCompleted: updated.modifiedCount };
    } catch (err) {
        logger.error('Auto-Complete Orders Error:', err);
        throw { message: err.message, critical: true };
    }
};

// ══════════════════════════════════════════════════════
// 2️⃣ AUTO-REFUND EXPIRED PAYMENTS
// ══════════════════════════════════════════════════════
export const autoRefundExpiredPayments = async () => {
    try {
        const holdExpiry = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes

        const refunded = await Order.updateMany(
            {
                'payment.status': 'PENDING',
                orderStatus: 'PLACED',
                'payment.method': 'RAZORPAY',
                createdAt: { $lt: holdExpiry },
                isAutoRefunded: { $ne: true },
            },
            {
                $set: {
                    'payment.status': 'FAILED',
                    orderStatus: 'CANCELLED',
                    isAutoRefunded: true,
                    'statusTimeline.cancelledAt': new Date(),
                    cancellationReason: 'Auto-cancelled: payment not completed within 30 minutes',
                },
            }
        );

        if (refunded.modifiedCount > 0) {
            logger.info(`💰 Auto-Refunded ${refunded.modifiedCount} expired payment holds`);
        }

        return { paymentsRefunded: refunded.modifiedCount };
    } catch (err) {
        logger.error('Auto-Refund Payments Error:', err);
        throw { message: err.message, critical: true };
    }
};

// ══════════════════════════════════════════════════════
// 3️⃣ AUTO-GENERATE INVOICES
// ══════════════════════════════════════════════════════
export const autoGenerateInvoices = async () => {
    try {
        const orders = await Order.find({
            orderStatus: { $in: ['DELIVERED'] },
            invoiceGenerated: { $ne: true },
        }).select('_id invoiceNumber items totalAmount').lean();

        if (orders.length === 0) {
            return { invoicesGenerated: 0 };
        }

        const generated = await Order.updateMany(
            { _id: { $in: orders.map(o => o._id) } },
            { $set: { invoiceGenerated: true, invoiceGeneratedAt: new Date() } }
        );

        logger.info(`📄 Auto-Generated ${generated.modifiedCount} invoices`);

        return { invoicesGenerated: generated.modifiedCount };
    } catch (err) {
        logger.error('Auto-Generate Invoices Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 4️⃣ CHECK LOW STOCK ITEMS
// ══════════════════════════════════════════════════════
export const checkLowStockItems = async () => {
    try {
        // BUG FIX: this previously compared stock against `minimumStock`, a
        // field that has never existed on Product.js — the query's $expr
        // always evaluated false (missing field ≈ null, which never
        // satisfies $lt against a real stock number), so this job found
        // zero low-stock items even before being disabled. The real,
        // already-fully-wired-in-the-UI reorder threshold field is
        // Product.lowStockThreshold (ProductForm.jsx's "Low Stock Alert
        // Below" input, validated by product.schema.js, default 5).
        // Scoped to vendorId != null — admin/ecommerce products (vendorId
        // null) have no vendor to notify; that's a separate, non-vendor
        // concern this job doesn't cover.
        const lowStockProducts = await Product.find({
            isActive: true,
            vendorId: { $ne: null },
            $expr: { $lt: ['$stock', '$lowStockThreshold'] },
        }).select('name sku stock lowStockThreshold vendorId');

        if (lowStockProducts.length === 0) {
            return { lowStockItemsFound: 0, vendorsNotified: 0 };
        }

        // Group by vendor — one summary notification per vendor, not one
        // per product, so a vendor whose whole catalog dips at once isn't
        // spammed with N separate alerts.
        const vendorAlerts = {};
        for (const product of lowStockProducts) {
            const vid = String(product.vendorId);
            if (!vendorAlerts[vid]) vendorAlerts[vid] = [];
            vendorAlerts[vid].push(product);
        }

        let vendorsNotified = 0;
        for (const [vendorId, products] of Object.entries(vendorAlerts)) {
            try {
                const vendor = await Vendor.findById(vendorId).select('userId').lean();
                if (!vendor?.userId) continue;

                const names = products.slice(0, 3).map((p) => p.name).join(', ');
                const extra = products.length > 3 ? ` and ${products.length - 3} more` : '';

                await notify({
                    recipientId: vendor.userId,
                    role: 'vendor',
                    type: 'inventory_low',
                    title: 'Low Stock Alert',
                    message: `${products.length} product${products.length > 1 ? 's are' : ' is'} running low on stock: ${names}${extra}.`,
                    priority: 'normal',
                    meta: { count: products.length, productIds: products.map((p) => String(p._id)) },
                });
                vendorsNotified++;
            } catch (err) {
                logger.warn(`Failed to notify vendor ${vendorId} of low stock: ${err.message}`);
            }
        }

        logger.info(`⚠️  Low stock: ${lowStockProducts.length} product(s) across ${vendorsNotified} vendor(s) notified`);
        return { lowStockItemsFound: lowStockProducts.length, vendorsNotified };
    } catch (err) {
        logger.error('Check Low Stock Error:', err);
        throw { message: err.message };
    }
};
