/**
 * vendorOrders.js — Production
 * Fixed: Proper order population, stats calculation, status updates
 */
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import { sendNotification as sendToUser } from "../../utils/notificationQueue.js";
import { publishToUser } from "../../utils/realtimeHub.js";
import { startAssignment } from "../../services/assignmentEngine.js";

// GET /api/vendor/orders
export const getVendorOrders = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { status, page = 1, limit = 20, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Build filter: orders that contain at least one product from this vendor
        const productIds = await Product.find({ vendorId }).distinct("_id");

        const filter = { "items.productId": { $in: productIds } };
        if (status) filter.orderStatus = status;
        if (search) {
            filter.$or = [
                { invoiceNumber: { $regex: search, $options: "i" } },
                { customerName: { $regex: search, $options: "i" } },
            ];
        }

        const [orders, total, stats] = await Promise.all([
            Order.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Order.countDocuments(filter),
            Order.aggregate([
                { $match: { "items.productId": { $in: productIds } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        pending: {
                            $sum: { $cond: [{ $in: ["$orderStatus", ["PLACED", "CONFIRMED"]] }, 1, 0] },
                        },
                        delivered: {
                            $sum: { $cond: [{ $eq: ["$orderStatus", "DELIVERED"] }, 1, 0] },
                        },
                        revenue: {
                            $sum: {
                                $cond: [{ $eq: ["$orderStatus", "DELIVERED"] }, { $ifNull: ["$totalAmount", 0] }, 0],
                            },
                        },
                    },
                },
            ]),
        ]);

        const s = stats[0] || { total: 0, pending: 0, delivered: 0, revenue: 0 };

        res.json({
            success: true, orders,
            stats: { total: s.total, pending: s.pending, delivered: s.delivered, revenue: s.revenue },
            total, page: Number(page), pages: Math.ceil(total / Number(limit)),
        });
    } catch (err) {
        console.error("[getVendorOrders]", err);
        res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
};

// PATCH /api/vendor/orders/:id/status
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const ALLOWED_STATUS = ["CONFIRMED", "PACKED", "READY_FOR_PICKUP", "CANCELLED"];

        if (!ALLOWED_STATUS.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${ALLOWED_STATUS.join(", ")}` });
        }

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // Verify vendor owns at least one product in this order
        const vendorProductIds = await Product.find({ vendorId: req.vendor._id }).distinct("_id");
        const vendorProductIdStrs = vendorProductIds.map(String);
        const hasProduct = order.items.some((item) => vendorProductIdStrs.includes(String(item.productId)));

        if (!hasProduct) return res.status(403).json({ success: false, message: "Not authorized to update this order" });

        const prevStatus = order.orderStatus;
        order.orderStatus = status;

        // Update statusTimeline properly
        const tMap = { CONFIRMED: "confirmedAt", PACKED: "packedAt", READY_FOR_PICKUP: "readyForPickupAt", CANCELLED: "cancelledAt" };
        if (tMap[status]) {
            const existing = order.statusTimeline?.toObject ? order.statusTimeline.toObject() : { ...order.statusTimeline };
            order.statusTimeline = { ...existing, [tMap[status]]: new Date() };
            order.markModified("statusTimeline");
        }

        await order.save();

        // Trigger assignment engine on READY_FOR_PICKUP for UH local delivery
        if (status === "READY_FOR_PICKUP" && order.delivery?.provider === "LOCAL_RIDER" && !order.delivery?.assignedTo) {
            startAssignment(order._id).catch(err => {
                console.warn("[Assignment] Auto-start on vendor READY_FOR_PICKUP failed:", err.message);
            });
        }

        // Notify customer via WebSocket + SSE
        if (order.user) {
            const userId = String(order.user);
            sendToUser(userId, "order_status_updated", {
                orderId: order._id,
                status,
                prevStatus,
                message: `Your order status updated to ${status}`,
            });
            publishToUser(userId, "order_status_updated", {
                orderId: order._id,
                status,
                at: new Date().toISOString(),
            });
        }

        res.json({ success: true, order, message: "Order status updated" });
    } catch (err) {
        console.error("[updateOrderStatus]", err);
        res.status(500).json({ success: false, message: "Failed to update order status" });
    }
};
