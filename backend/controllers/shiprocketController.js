/**
 * shiprocketController.js
 * ─────────────────────────────────────────────────────────
 * All Shiprocket operations — rate check, create, track, label, manifest, pickup
 * Admin routes are protected with adminOnly middleware
 */

import Order from "../models/Order.js";
import {
    calculateShippingRate,
    createShiprocketOrder,
    trackShipment,
    generateLabel,
    generateManifest,
    schedulePickup,
    cancelShiprocketOrder,
    isMockMode,
} from "../utils/Shiprocketservice.js";
import { publishToUser } from "../utils/realtimeHub.js";

/* ══════════════════════════════════════════════════════
   GET SHIPPING RATE
   POST /api/shiprocket/rate
   Body: { pincode, weight?, paymentMethod }
   Public — used in checkout before order is placed
══════════════════════════════════════════════════════ */
export const getShippingRate = async (req, res) => {
    try {
        const { pincode, weight = 500, paymentMethod } = req.body;

        if (!pincode || !/^\d{6}$/.test(pincode))
            return res.status(400).json({ success: false, message: "Valid 6-digit pincode required" });

        const result = await calculateShippingRate({
            deliveryPincode: pincode,
            weight,
            cod: paymentMethod === "COD",
        });

        res.json(result);
    } catch (err) {
        console.error("[SR] getShippingRate:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch shipping rate" });
    }
};

/* ══════════════════════════════════════════════════════
   CREATE SHIPMENT FOR AN ORDER (ADMIN)
   POST /api/shiprocket/create/:orderId
   Admin manually triggers — or called automatically from orderController
══════════════════════════════════════════════════════ */
export const createShipment = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        if (order.shipping?.shipmentId && !isMockMode())
            return res.status(400).json({ success: false, message: "Shipment already created for this order" });

        const totalWeight = req.body.weight || 500; // grams

        const result = await createShiprocketOrder({ order, totalWeight });

        if (!result.success)
            return res.status(502).json({ success: false, message: "Shiprocket error: " + result.error });

        // Save shipping info to order
        order.shipping = {
            shipmentId: String(result.shipment_id),
            awbCode: result.awb_code,
            courierName: result.courier_name,
            trackingUrl: result.tracking_url,
            labelUrl: result.label_url || "",
            status: "CREATED",
            mock: result.mock || false,
            autoCreated: false,
            createdAt: new Date(),
        };

        if (order.orderStatus === "CONFIRMED" || order.orderStatus === "PACKED")
            order.orderStatus = "SHIPPED";

        order.statusTimeline = {
            ...(order.statusTimeline?.toObject?.() || order.statusTimeline || {}),
            shippedAt: new Date(),
        };
        order.markModified("statusTimeline");
        await order.save();

        res.json({
            success: true,
            mock: result.mock,
            awb_code: result.awb_code,
            shipment_id: result.shipment_id,
            courier_name: result.courier_name,
            tracking_url: result.tracking_url,
            label_url: result.label_url,
        });
    } catch (err) {
        console.error("[SR] createShipment:", err.message);
        res.status(500).json({ success: false, message: "Failed to create shipment" });
    }
};

/* ══════════════════════════════════════════════════════
   TRACK ORDER (USER + ADMIN)
   GET /api/shiprocket/track/:orderId
══════════════════════════════════════════════════════ */
export const trackOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // Only owner or admin
        const isOwner = order.user?.toString() === req.user._id.toString();
        const isAdmin = ["admin", "owner"].includes(req.user.role);
        if (!isOwner && !isAdmin)
            return res.status(403).json({ success: false, message: "Access denied" });

        const awb = order.shipping?.awbCode;
        if (!awb)
            return res.status(400).json({
                success: false,
                message: "Shipment not yet created for this order",
                orderStatus: order.orderStatus,
            });

        const result = await trackShipment({ awbCode: awb });
        res.json({ ...result, orderStatus: order.orderStatus });
    } catch (err) {
        console.error("[SR] trackOrder:", err.message);
        res.status(500).json({ success: false, message: "Failed to track shipment" });
    }
};

/* ══════════════════════════════════════════════════════
   GET SHIPPING LABEL (ADMIN)
   GET /api/shiprocket/label/:orderId
══════════════════════════════════════════════════════ */
export const getShippingLabel = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const shipmentId = order.shipping?.shipmentId;
        if (!shipmentId)
            return res.status(400).json({ success: false, message: "No shipment found for this order" });

        // Return cached label URL if available
        if (order.shipping?.labelUrl && !isMockMode())
            return res.json({ success: true, label_url: order.shipping.labelUrl });

        const result = await generateLabel({ shipmentId });
        if (!result.success)
            return res.status(502).json({ success: false, message: "Failed to generate label: " + result.error });

        // Cache label URL
        await Order.findByIdAndUpdate(req.params.orderId, {
            "shipping.labelUrl": result.label_url,
        });

        res.json({ success: true, mock: result.mock, label_url: result.label_url });
    } catch (err) {
        console.error("[SR] getShippingLabel:", err.message);
        res.status(500).json({ success: false, message: "Failed to get shipping label" });
    }
};

/* ══════════════════════════════════════════════════════
   GET MANIFEST (ADMIN)
   GET /api/shiprocket/manifest/:orderId
══════════════════════════════════════════════════════ */
export const getManifest = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const shipmentId = order.shipping?.shipmentId;
        if (!shipmentId)
            return res.status(400).json({ success: false, message: "No shipment for this order" });

        const result = await generateManifest({ shipmentId });
        if (!result.success)
            return res.status(502).json({ success: false, message: "Manifest error: " + result.error });

        res.json({ success: true, mock: result.mock, manifest_url: result.manifest_url });
    } catch (err) {
        console.error("[SR] getManifest:", err.message);
        res.status(500).json({ success: false, message: "Failed to generate manifest" });
    }
};

/* ══════════════════════════════════════════════════════
   SCHEDULE PICKUP (ADMIN)
   POST /api/shiprocket/pickup/:orderId
══════════════════════════════════════════════════════ */
export const requestPickup = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const shipmentId = order.shipping?.shipmentId;
        if (!shipmentId)
            return res.status(400).json({ success: false, message: "Create shipment first before scheduling pickup" });

        const result = await schedulePickup({ shipmentId });
        if (!result.success)
            return res.status(502).json({ success: false, message: "Pickup error: " + result.error });

        res.json({ success: true, mock: result.mock, pickup_token: result.pickup_token });
    } catch (err) {
        console.error("[SR] requestPickup:", err.message);
        res.status(500).json({ success: false, message: "Failed to schedule pickup" });
    }
};

/* ══════════════════════════════════════════════════════
   CANCEL SHIPMENT (ADMIN)
   POST /api/shiprocket/cancel/:orderId
══════════════════════════════════════════════════════ */
export const cancelShipment = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const shipmentId = order.shipping?.shipmentId;
        if (!shipmentId)
            return res.status(400).json({ success: false, message: "No shipment found for this order" });

        const result = await cancelShiprocketOrder({ orderId: shipmentId });
        if (!result.success)
            return res.status(502).json({ success: false, message: "Cancel error: " + result.error });

        order.shipping.status = "CANCELLED";
        await order.save();

        res.json({ success: true, mock: result.mock, message: "Shipment cancelled" });
    } catch (err) {
        console.error("[SR] cancelShipment:", err.message);
        res.status(500).json({ success: false, message: "Failed to cancel shipment" });
    }
};

/* ══════════════════════════════════════════════════════
   WEBHOOK — Shiprocket status updates
   POST /api/shiprocket/webhook
   Public but verified by secret header
══════════════════════════════════════════════════════ */
export const shiprocketWebhook = async (req, res) => {
    try {
        // Optional: verify Shiprocket webhook secret
        const secret = req.headers["x-shiprocket-secret"];
        if (process.env.SHIPROCKET_WEBHOOK_SECRET && secret !== process.env.SHIPROCKET_WEBHOOK_SECRET) {
            return res.status(401).json({ success: false, message: "Invalid webhook secret" });
        }

        const { awb, current_status, order_id } = req.body;
        if (!awb) return res.status(400).json({ success: false, message: "AWB missing in webhook" });

        // Map Shiprocket status to our status
        const statusMap = {
            "PICKUP SCHEDULED": "CONFIRMED",
            "PICKED UP": "SHIPPED",
            "IN TRANSIT": "SHIPPED",
            "OUT FOR DELIVERY": "OUT_FOR_DELIVERY",
            "DELIVERED": "DELIVERED",
            "CANCELLED": "CANCELLED",
            "RTO INITIATED": "CANCELLED",
            "RTO DELIVERED": "CANCELLED",
        };

        const upperStatus = (current_status || "").toUpperCase();
        const mappedStatus = statusMap[upperStatus];

        if (mappedStatus) {
            const order = await Order.findOne({ "shipping.awbCode": awb });
            if (order) {
                order.orderStatus = mappedStatus;
                order.shipping.status = current_status;

                // Update status timeline
                const tMap = { CONFIRMED: "confirmedAt", SHIPPED: "shippedAt", OUT_FOR_DELIVERY: "outForDeliveryAt", DELIVERED: "deliveredAt", CANCELLED: "cancelledAt" };
                if (tMap[mappedStatus]) {
                    if (!order.statusTimeline) order.statusTimeline = {};
                    order.statusTimeline[tMap[mappedStatus]] = new Date();
                    order.markModified("statusTimeline");
                }

                if (mappedStatus === "DELIVERED") {
                    order.payment.status = "PAID";
                    order.payment.paidAt = new Date();
                    order.delivery.status = "DELIVERED";
                }

                if (mappedStatus === "OUT_FOR_DELIVERY") {
                    order.delivery.status = "OUT_FOR_DELIVERY";
                }

                if (mappedStatus === "SHIPPED") {
                    order.shipping.status = "SHIPPED";
                }

                await order.save();

                publishToUser(order.user, "order_status_updated", {
                    orderId: order._id,
                    status: mappedStatus,
                    shippingStatus: current_status,
                    at: new Date().toISOString(),
                });

                // Send email notification for webhook status updates
                if (order.email && !order.email.includes("@placeholder.com")) {
                    const { getOrderStatusEmailTemplate } = await import("../utils/orderStatusEmail.js");
                    const mail = getOrderStatusEmailTemplate({
                        customerName: order.customerName,
                        orderId: order._id,
                        status: mappedStatus,
                        trackingUrl: order.shipping?.trackingUrl || "",
                        courier: order.shipping?.courierName || "",
                        awb: order.shipping?.awbCode || "",
                    });
                    const { sendEmail } = await import("../utils/emailService.js");
                    sendEmail({ to: order.email, subject: mail.subject, html: mail.html, label: `Webhook/${mappedStatus}` });
                }

                console.log(`[Webhook] Order ${order._id} → ${mappedStatus} (AWB: ${awb})`);
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error("[SR] Webhook error:", err.message);
        res.status(500).json({ success: false, message: "Webhook processing failed" });
    }
};