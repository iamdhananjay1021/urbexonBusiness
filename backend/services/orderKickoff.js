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
import { broadcastToUsers } from "../utils/wsHub.js";

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
                        .select("userId email shopName ownerName")
                        .lean();

                    const vendorUserIds = vendors.map((v) => v.userId).filter(Boolean);
                    if (vendorUserIds.length > 0) {
                        broadcastToUsers(vendorUserIds, "new_order", {
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
                    }
                }
            }
        } catch (vendorErr) {
            console.warn("[OrderKickoff] Vendor notify failed:", vendorErr.message);
        }

        // Rider assignment intentionally does not start at order creation.
        // It is triggered when the vendor marks the order READY_FOR_PICKUP.
    } catch (err) {
        // This module is best-effort and must never break order creation.
        console.warn("[OrderKickoff] Unexpected error:", err.message);
    }
};
