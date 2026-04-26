/**
 * vendorOrders.js — Production v2.1
 * Fixed: READY_FOR_PICKUP transition bug for URBEXON_HOUR orders
 * Fixed: getVendorTransitions now correctly allows PACKED → READY_FOR_PICKUP for all UH orders
 * Fixed: isLocalRiderDelivery check removed from READY_FOR_PICKUP gate (provider agnostic)
 */
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import { Settlement } from "../../models/vendorModels/Settlement.js";
import { restoreStock } from "../../services/pricing.js";
import { sendNotification as sendToUser } from "../../utils/notificationQueue.js";
import { publishToUser } from "../../utils/realtimeHub.js";
import { startAssignment, cancelAssignment } from "../../services/assignmentEngine.js";

const STATUS_GROUPS = {
    pending: ["PLACED", "CONFIRMED"],
    processing: ["PACKED", "READY_FOR_PICKUP"],
    shipped: ["SHIPPED", "OUT_FOR_DELIVERY"],
    delivered: ["DELIVERED"],
    cancelled: ["CANCELLED"],
};

const LOCAL_RIDER_PROVIDER = "LOCAL_RIDER";
const VENDOR_SELF_PROVIDER = "VENDOR_SELF";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildDateFilter = (days) => {
    const parsed = Number(days);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (parsed - 1));
    return { $gte: from };
};

const getStatusFilter = ({ status, statusGroup }) => {
    if (statusGroup && STATUS_GROUPS[statusGroup]) {
        return { $in: STATUS_GROUPS[statusGroup] };
    }
    if (status && status !== "all") {
        return status;
    }
    return null;
};

const isUrbexonHour = (order) => order?.orderMode === "URBEXON_HOUR";
const isLocalRiderDelivery = (order) => isUrbexonHour(order) && order?.delivery?.provider === LOCAL_RIDER_PROVIDER;
const isVendorSelfDelivery = (order) => isUrbexonHour(order) && order?.delivery?.provider === VENDOR_SELF_PROVIDER;

const getNormalizedDeliveryStatus = (order) => {
    if (order?.orderStatus === "DELIVERED") return "DELIVERED";
    if (order?.orderStatus === "CANCELLED") return "CANCELLED";

    if (isVendorSelfDelivery(order)) {
        if (order?.orderStatus === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
        return "PENDING";
    }

    return order?.delivery?.status || "PENDING";
};

const normalizeVendorFacingOrder = (order) => {
    const normalized = { ...order };
    const delivery = { ...(order?.delivery || {}) };
    delivery.status = getNormalizedDeliveryStatus(order);

    if (isVendorSelfDelivery(order)) {
        delivery.assignedTo = null;
        delivery.riderName = "";
        delivery.riderPhone = "";
        delivery.assignedAt = null;
        delivery.rejectedBy = [];
    }

    normalized.delivery = delivery;
    return normalized;
};

/**
 * ✅ FIXED: getVendorTransitions
 * - URBEXON_HOUR orders (any provider): PACKED → READY_FOR_PICKUP allowed
 * - VENDOR_SELF orders: can go OUT_FOR_DELIVERY → DELIVERED
 * - Standard ecommerce orders: no READY_FOR_PICKUP needed
 */
const getVendorTransitions = (order) => {
    // Base transitions for all order types
    const base = {
        PLACED: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["PACKED", "CANCELLED"],
        PACKED: ["CANCELLED"],
        READY_FOR_PICKUP: ["CANCELLED"],
        OUT_FOR_DELIVERY: [],
    };

    if (!isUrbexonHour(order)) {
        // Standard ecommerce — vendor just confirms and packs
        return base;
    }

    if (isVendorSelfDelivery(order)) {
        // Vendor delivers themselves
        return {
            ...base,
            PACKED: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "CANCELLED"],
            READY_FOR_PICKUP: ["OUT_FOR_DELIVERY", "CANCELLED"],
            OUT_FOR_DELIVERY: ["DELIVERED"],
        };
    }

    // ✅ FIXED: All URBEXON_HOUR orders (LOCAL_RIDER + any other provider)
    // PACKED → READY_FOR_PICKUP is allowed — triggers auto-assignment engine
    return {
        ...base,
        PACKED: ["READY_FOR_PICKUP", "CANCELLED"],
        READY_FOR_PICKUP: ["CANCELLED"],
    };
};

const ensureVendorSettlement = async ({ order, vendorId, vendorProductIds }) => {
    const exists = await Settlement.findOne({ orderId: order._id, vendorId }).lean();
    if (exists) return;

    const vendorProductIdSet = new Set(vendorProductIds.map(String));
    const vendorItems = (order.items || []).filter((item) => vendorProductIdSet.has(String(item.productId)));
    const orderAmount = vendorItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || item.quantity || 0)), 0);
    if (!orderAmount) return;

    const vendor = await Vendor.findById(vendorId).select("commissionRate").lean();
    const commissionRate = vendor?.commissionRate ?? 18;
    const commissionAmount = Math.round((orderAmount * commissionRate) / 100);
    const vendorEarning = Math.max(0, orderAmount - commissionAmount);

    await Settlement.create({
        vendorId,
        orderId: order._id,
        orderAmount,
        commissionRate,
        commissionAmount,
        deliveryCharge: 0,
        platformFee: 0,
        vendorEarning,
        status: "pending",
    });

    await Vendor.findByIdAndUpdate(vendorId, {
        $inc: {
            pendingSettlement: vendorEarning,
            totalRevenue: orderAmount,
            totalOrders: 1,
        },
    }).catch(() => { });
};

const buildVendorScopedOrder = (order, vendorProductIdSet) => {
    const normalizedOrder = normalizeVendorFacingOrder(order);
    const items = (normalizedOrder.items || []).filter((item) => vendorProductIdSet.has(String(item.productId)));
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || item.quantity || 0)), 0);
    const quantityTotal = items.reduce((sum, item) => sum + Number(item.qty || item.quantity || 0), 0);

    return {
        ...normalizedOrder,
        items,
        vendorSummary: {
            subtotal,
            quantityTotal,
            lineItems: items.length,
        },
    };
};

// GET /api/vendor/orders
export const getVendorOrders = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { status, statusGroup, page = 1, limit = 20, search, days } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const productIds = await Product.find({ vendorId }).distinct("_id");
        if (!productIds.length) {
            return res.json({
                success: true,
                orders: [],
                stats: { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, revenue: 0 },
                total: 0,
                page: Number(page),
                pages: 0,
            });
        }
        const vendorProductIdSet = new Set(productIds.map(String));

        const filter = { "items.productId": { $in: productIds } };
        const resolvedStatus = getStatusFilter({ status, statusGroup });
        if (resolvedStatus) filter.orderStatus = resolvedStatus;
        const createdAt = buildDateFilter(days);
        if (createdAt) filter.createdAt = createdAt;
        if (search) {
            const escaped = escapeRegex(search.trim());
            filter.$or = [
                { invoiceNumber: { $regex: escaped, $options: "i" } },
                { customerName: { $regex: escaped, $options: "i" } },
            ];
        }

        const statsMatch = { "items.productId": { $in: productIds } };
        if (createdAt) statsMatch.createdAt = createdAt;

        const [orders, total, stats, revenueAgg] = await Promise.all([
            Order.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Order.countDocuments(filter),
            Order.aggregate([
                { $match: statsMatch },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        pending: {
                            $sum: { $cond: [{ $in: ["$orderStatus", ["PLACED", "CONFIRMED"]] }, 1, 0] },
                        },
                        processing: {
                            $sum: { $cond: [{ $in: ["$orderStatus", ["PACKED", "READY_FOR_PICKUP"]] }, 1, 0] },
                        },
                        shipped: {
                            $sum: { $cond: [{ $in: ["$orderStatus", ["SHIPPED", "OUT_FOR_DELIVERY"]] }, 1, 0] },
                        },
                        delivered: {
                            $sum: { $cond: [{ $eq: ["$orderStatus", "DELIVERED"] }, 1, 0] },
                        },
                        cancelled: {
                            $sum: { $cond: [{ $eq: ["$orderStatus", "CANCELLED"] }, 1, 0] },
                        },
                    },
                },
            ]),
            Order.aggregate([
                { $match: { ...statsMatch, orderStatus: "DELIVERED" } },
                { $unwind: "$items" },
                { $match: { "items.productId": { $in: productIds } } },
                {
                    $group: {
                        _id: null,
                        revenue: {
                            $sum: {
                                $multiply: [
                                    { $ifNull: ["$items.price", 0] },
                                    { $ifNull: ["$items.qty", 0] },
                                ],
                            },
                        },
                    },
                },
            ]),
        ]);

        const s = stats[0] || { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
        const revenue = revenueAgg[0]?.revenue || 0;
        const scopedOrders = orders.map((order) => buildVendorScopedOrder(order, vendorProductIdSet));

        res.json({
            success: true,
            orders: scopedOrders,
            stats: {
                total: s.total,
                pending: s.pending,
                processing: s.processing,
                shipped: s.shipped,
                delivered: s.delivered,
                cancelled: s.cancelled,
                revenue,
            },
            total, page: Number(page), pages: Math.ceil(total / Number(limit)),
        });
    } catch (err) {
        console.error("[getVendorOrders]", err);
        res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
};

// GET /api/vendor/orders/:id
export const getVendorOrderById = async (req, res) => {
    try {
        const vendorProductIds = await Product.find({ vendorId: req.vendor._id }).distinct("_id");
        if (!vendorProductIds.length) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const order = await Order.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const vendorProductIdSet = new Set(vendorProductIds.map(String));
        const hasVendorItem = (order.items || []).some((item) => vendorProductIdSet.has(String(item.productId)));
        if (!hasVendorItem) {
            return res.status(403).json({ success: false, message: "Not authorized to view this order" });
        }

        res.json({
            success: true,
            order: buildVendorScopedOrder(order, vendorProductIdSet),
        });
    } catch (err) {
        console.error("[getVendorOrderById]", err);
        res.status(500).json({ success: false, message: "Failed to fetch order" });
    }
};

// PATCH /api/vendor/orders/:id/status
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const rawBody = req.body;
        const status = (rawBody.status || '').trim().toUpperCase();
        const otp = rawBody.otp;
        const ALLOWED_STATUS = ["CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

        console.log("[VendorOrderStatus] UPDATE:", { id, status, hasOtp: !!otp, vendorId: req.vendor._id, bodyKeys: Object.keys(rawBody) });

        if (!ALLOWED_STATUS.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${ALLOWED_STATUS.join(", ")}` });
        }

        const order = await Order.findById(id).select("+deliveryOtp.code");
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // Verify vendor owns at least one product in this order
        const vendorProductIds = await Product.find({ vendorId: req.vendor._id }).distinct("_id");
        const vendorProductIdStrs = vendorProductIds.map(String);
        const hasProduct = order.items.some((item) => vendorProductIdStrs.includes(String(item.productId)));
        if (!hasProduct) return res.status(403).json({ success: false, message: "Not authorized to update this order" });

        // ── Transition validation ──
        const allowed = getVendorTransitions(order)[order.orderStatus] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot transition from ${order.orderStatus} to ${status}. Allowed: ${allowed.join(", ") || "none"}`,
            });
        }

        // ✅ FIXED: READY_FOR_PICKUP gate — allow for ALL URBEXON_HOUR orders, no provider check
        if (status === "READY_FOR_PICKUP") {
            if (!isUrbexonHour(order)) {
                return res.status(400).json({
                    success: false,
                    message: "READY_FOR_PICKUP is only applicable to Urbexon Hour orders.",
                });
            }
            // URBEXON_HOUR — allowed regardless of delivery.provider
            console.log("[VendorOrderStatus] READY_FOR_PICKUP allowed for UH order:", order._id, "| provider:", order.delivery?.provider);
        }

        if (status === "OUT_FOR_DELIVERY" && !isVendorSelfDelivery(order)) {
            return res.status(400).json({
                success: false,
                message: "Only vendor self-delivery orders can be started by the vendor",
            });
        }

        if (status === "DELIVERED" && !isVendorSelfDelivery(order)) {
            return res.status(400).json({
                success: false,
                message: "Only vendor self-delivery orders can be completed by the vendor",
            });
        }

        if (status === "DELIVERED") {
            if (!String(otp || "").trim()) {
                return res.status(400).json({ success: false, message: "Delivery OTP is required to mark order delivered" });
            }
            if (!order.deliveryOtp?.code) {
                return res.status(400).json({ success: false, message: "No delivery OTP found for this order" });
            }
            if (order.deliveryOtp?.verified) {
                return res.status(400).json({ success: false, message: "Delivery OTP is already used" });
            }
            if (order.deliveryOtp?.expiresAt && new Date() > new Date(order.deliveryOtp.expiresAt)) {
                return res.status(400).json({ success: false, message: "Delivery OTP expired. Start delivery again to generate a fresh OTP." });
            }
            if (String(order.deliveryOtp.code) !== String(otp).trim()) {
                return res.status(400).json({ success: false, message: "Invalid delivery OTP" });
            }
        }

        const prevStatus = order.orderStatus;
        const legacyAssignedRiderId = isVendorSelfDelivery(order) ? order.delivery?.assignedTo : null;
        order.orderStatus = status;

        // Update statusTimeline
        const tMap = {
            CONFIRMED: "confirmedAt",
            PACKED: "packedAt",
            READY_FOR_PICKUP: "readyForPickupAt",
            OUT_FOR_DELIVERY: "outForDeliveryAt",
            DELIVERED: "deliveredAt",
            CANCELLED: "cancelledAt",
        };
        if (tMap[status]) {
            const existing = order.statusTimeline?.toObject ? order.statusTimeline.toObject() : { ...order.statusTimeline };
            order.statusTimeline = { ...existing, [tMap[status]]: new Date() };
            order.markModified("statusTimeline");
        }

        if (status === "CONFIRMED" || status === "PACKED") {
            order.delivery.status = "PENDING";
        }

        if (status === "READY_FOR_PICKUP") {
            // ✅ Mark delivery pending — assignment engine will pick it up
            order.delivery.status = "PENDING";
        }

        if (status === "OUT_FOR_DELIVERY") {
            const otpCode = String(Math.floor(1000 + Math.random() * 9000));
            order.deliveryOtp = order.deliveryOtp || {};
            order.delivery.status = "OUT_FOR_DELIVERY";
            order.delivery.assignedTo = null;
            order.delivery.riderName = "";
            order.delivery.riderPhone = "";
            order.delivery.assignedAt = null;
            order.deliveryOtp.code = otpCode;
            order.deliveryOtp.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            order.deliveryOtp.verified = false;
        }

        if (status === "DELIVERED") {
            order.deliveryOtp = order.deliveryOtp || {};
            order.delivery.status = "DELIVERED";
            order.delivery.assignedTo = null;
            order.delivery.riderName = "";
            order.delivery.riderPhone = "";
            order.delivery.assignedAt = null;
            order.deliveryOtp.verified = true;
            if (order.payment?.method === "COD") {
                order.payment.status = "PAID";
                order.payment.paidAt = new Date();
            }
        }

        if (status === "CANCELLED") {
            order.delivery.status = "CANCELLED";
        }

        await order.save();

        // Free rider slot if vendor-self was delivering
        if (legacyAssignedRiderId) {
            await DeliveryBoy.findByIdAndUpdate(legacyAssignedRiderId, { $inc: { activeOrders: -1 } }).catch(() => { });
            await DeliveryBoy.updateOne(
                { _id: legacyAssignedRiderId, activeOrders: { $lt: 0 } },
                { $set: { activeOrders: 0 } }
            ).catch(() => { });
        }

        // Restore stock + cancel assignment on cancel
        if (status === "CANCELLED") {
            await restoreStock(order.items);
            if (order.delivery?.assignedTo) {
                Order.updateOne({ _id: order._id }, { $set: { "delivery.status": "CANCELLED" } }).catch(() => { });
            }
            if (order.orderMode === "URBEXON_HOUR") {
                cancelAssignment(order._id);
            }
        }

        // ✅ Trigger assignment engine on READY_FOR_PICKUP for ALL URBEXON_HOUR orders
        // (regardless of whether provider is LOCAL_RIDER or not set yet)
        if (status === "READY_FOR_PICKUP" && isUrbexonHour(order) && !isVendorSelfDelivery(order) && !order.delivery?.assignedTo) {
            startAssignment(order._id).catch(err => {
                console.warn("[Assignment] Auto-start on vendor READY_FOR_PICKUP failed:", err.message);
            });
        }

        // Settlement on delivery
        if (status === "DELIVERED") {
            await ensureVendorSettlement({
                order,
                vendorId: req.vendor._id,
                vendorProductIds,
            }).catch((err) => {
                console.warn("[VendorSettlement] Failed to create settlement:", err.message);
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
                ...(status === "OUT_FOR_DELIVERY" ? { otp: order.deliveryOtp?.code } : {}),
            });
            publishToUser(userId, "order_status_updated", {
                orderId: order._id,
                status,
                at: new Date().toISOString(),
                ...(status === "OUT_FOR_DELIVERY" ? { otp: order.deliveryOtp?.code } : {}),
            });
        }

        res.json({ success: true, order: normalizeVendorFacingOrder(order.toObject()), message: "Order status updated" });
    } catch (err) {
        console.error("[updateOrderStatus]", err);
        res.status(500).json({ success: false, message: "Failed to update order status" });
    }
};