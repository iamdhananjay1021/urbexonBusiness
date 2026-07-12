/**
 * orderKickoff.js
 * Non-critical async side effects after an order is created:
 * - Notify vendor(s) (WebSocket + email)
 * - For Urbexon Hour: vendor notification only at creation time
 *   Rider assignment starts later once the order is READY_FOR_PICKUP
 *
 * This module must never throw to the request path.
 */

import Product from "../models/Product.js";
import Vendor from "../models/vendorModels/Vendor.js";
import { sendEmail } from "../utils/emailService.js";
import { vendorNewOrderEmail } from "../utils/emailTemplates.js";
import { broadcastToAdmins } from "../utils/wsHub.js";
// FIX (Customer→Vendor realtime bug): vendor "new_order" push was going
// through wsHub.broadcastToUsers() directly — a raw, one-shot WS send with
// no retry and no queue. If the vendor's socket was mid-reconnect at the
// exact moment of emit (tab backgrounded, wifi blip, heartbeat gap), the
// event was silently dropped forever — vendor only saw the order after a
// manual refresh. broadcastNotification() (notificationQueue.js) wraps the
// same sendToUser() but auto-queues on failed delivery, retries with
// backoff (2s/5s/15s), and auto-flushes the queue the moment the vendor's
// socket reconnects (flushQueueForUser is already called from wsHub.js's
// connection handler) — so the event now survives a flaky connection
// instead of vanishing.
import { broadcastNotification } from "../utils/notificationQueue.js";
import { sendWhatsAppMessage, isWhatsAppConfigured } from "./whatsappService.js";

const toEmailVendorItems = (items = []) =>
    items.map((i) => ({
        name: i.name,
        price: Number(i.price || 0),
        quantity: Number(i.qty || i.quantity || 0),
    }));

export const kickoffNewOrder = async ({ order, items = [] }) => {
    try {
        if (!order?._id) return;

        const orderId = order._id;
        const at = new Date().toISOString();

        // Admin needs live visibility from the moment an order is placed,
        // not just once it starts moving through assignment — this was the
        // one gap notifyOrderStakeholders' own admin broadcast couldn't
        // cover, since order creation never calls that helper.
        broadcastToAdmins("admin:order_event", {
            orderId,
            event: "order_created",
            status: order.orderStatus,
            orderMode: order.orderMode,
        });

        // 1) Notify vendor(s) whose products were ordered
        try {
            const productIds = items.map((i) => i.productId).filter(Boolean);
            if (productIds.length > 0) {
                const products = await Product.find({ _id: { $in: productIds } })
                    .select("vendorId")
                    .lean();
                const vendorIds = [...new Set(products.map((p) => p.vendorId?.toString()).filter(Boolean))];

                if (vendorIds.length > 0) {
                    const vendors = await Vendor.find({ _id: { $in: vendorIds } })
                        .select("userId email phone shopName ownerName")
                        .lean();

                    const vendorUserIds = vendors.map((v) => v.userId).filter(Boolean);
                    if (vendorUserIds.length > 0) {
                        // FIX: was broadcastToUsers(...) from wsHub.js (no
                        // retry/queue). Now goes through the reliable
                        // queue+retry wrapper — see import comment above.
                        broadcastNotification(vendorUserIds, "new_order", {
                            orderId,
                            totalAmount: order.totalAmount,
                            amount: order.totalAmount,
                            items: items.length,
                            customerName: order.customerName || "",
                            pincode: order.pincode || "",
                            type: order.delivery?.type || order.orderMode || "",
                            at,
                        });
                    }

                    // Send email to each vendor with their specific items
                    for (const vendor of vendors) {
                        if (!vendor?.email) continue;
                        const vendorProductIds = products
                            .filter((p) => p.vendorId?.toString() === vendor._id.toString())
                            .map((p) => p._id.toString());
                        const vendorItems = items.filter((i) => vendorProductIds.includes(i.productId?.toString()));
                        if (vendorItems.length === 0) continue;

                        const vendorName = vendor.shopName || vendor.ownerName || "Vendor";
                        const mailData = vendorNewOrderEmail(order, toEmailVendorItems(vendorItems), vendorName);
                        sendEmail({ to: vendor.email, subject: mailData.subject, html: mailData.html, label: "Vendor/NewOrder" });

                        // WhatsApp: New Order. Architecture-ready but a genuine
                        // no-op while WHATSAPP_PROVIDER=console (default) — see
                        // whatsappService.js. Never awaited, never allowed to
                        // affect order creation.
                        if (isWhatsAppConfigured() && vendor.phone) {
                            sendWhatsAppMessage({
                                to: vendor.phone,
                                message: `New order received! ${vendorItems.length} item(s), pay ${order.totalAmount ? `₹${order.totalAmount}` : ""}. Open your vendor app to accept.`,
                            }).catch((err) => console.warn("[OrderKickoff] WhatsApp (vendor) failed:", err.message));
                        }
                    }
                }
            }
        } catch (vendorErr) {
            console.warn("[OrderKickoff] Vendor notify failed:", vendorErr.message);
        }

        // BUG FIX: this used to also call startAssignment(orderId) here,
        // immediately at order creation — broadcasting the order to riders
        // before the vendor had even seen it, let alone accepted/packed it.
        // Rider assignment must only start once the order reaches
        // READY_FOR_PICKUP (see orderController.js / vendorOrders.js, which
        // already trigger it at exactly that transition), so this file only
        // handles vendor notification now. assignmentEngine.js's own
        // allowedStatuses guard also enforces this independently.
    } catch (err) {
        // This module is best-effort and must never break order creation.
        console.warn("[OrderKickoff] Unexpected error:", err.message);
    }
};