/**
 * orderController.js
 * ✅ Uses pricing.js service — DB prices only, frontend prices IGNORED
 * ✅ COD validated server-side
 * ✅ WhatsApp completely removed
 * ✅ Clean architecture
 * ✅ Returns queue and processReturn added
 */

import Razorpay from "razorpay";
import jwt from "jsonwebtoken";
import Order, { generateInvoiceNumber } from "../models/Order.js";
import Product from "../models/Product.js";
import { sendEmail } from "../utils/emailService.js";
import { getOrderStatusEmailTemplate } from "../utils/orderStatusEmail.js";
import { adminOrderEmailHTML } from "../utils/adminOrderEmail.js";
import { generateInvoiceBuffer } from "../utils/invoiceEmailHelper.js";
import { vendorNewOrderEmail, deliveryAssignedEmail, adminNewOrderAlertEmail } from "../utils/emailTemplates.js";
import { checkCODEligibility } from "./addressController.js";
import { calculateOrderPricing, deductStock, restoreStock, markCouponUsed } from "../services/pricing.js";
import { DELIVERY_CONFIG } from "../config/deliveryConfig.js";
import Pincode from "../models/vendorModels/Pincode.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import { addUserStream, removeUserStream, publishToUser } from "../utils/realtimeHub.js";
import { sendNotification as sendToUser } from "../utils/notificationQueue.js";
import { broadcastToUsers, broadcastAll } from "../utils/wsHub.js";
import { startAssignment, cancelAssignment } from "../services/assignmentEngine.js";
import { createNotification } from "./admin/notificationController.js";
import { Settlement } from "../models/vendorModels/Settlement.js";
import Vendor from "../models/vendorModels/Vendor.js";
import { createShiprocketOrder } from "../utils/Shiprocketservice.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getClientIp = (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress || "";

/* ──────────────────────────────────────────────
   FRAUD CHECKER
────────────────────────────────────────────── */
const checkFraud = async ({ userId, ip, amount, paymentId }) => {
    const reasons = [];
    const oneHour = new Date(Date.now() - 60 * 60 * 1000);

    if (paymentId) {
        const dup = await Order.findOne({ "payment.razorpayPaymentId": paymentId }).lean();
        if (dup) reasons.push("DUPLICATE_PAYMENT_ID");
    }

    const recentOrders = await Order.countDocuments({ user: userId, createdAt: { $gte: oneHour } });
    if (recentOrders >= 5) reasons.push("HIGH_ORDER_FREQUENCY");

    if (ip) {
        const ipOrders = await Order.countDocuments({ "payment.ip": ip, createdAt: { $gte: oneHour } });
        if (ipOrders >= 8) reasons.push("HIGH_IP_FREQUENCY");
    }

    const totalUserOrders = await Order.countDocuments({ user: userId });
    if (totalUserOrders >= 5) {
        const refundedCount = await Order.countDocuments({
            user: userId,
            "refund.status": { $in: ["APPROVED", "PROCESSED"] },
        });
        if (refundedCount / totalUserOrders > 0.3) reasons.push("HIGH_REFUND_RATE");
    }

    if (amount > 50000) reasons.push("HIGH_VALUE_ORDER");

    return { flagged: reasons.length > 0, reasons };
};



/* ══════════════════════════════════════════════
   REALTIME ORDER STREAM (SSE)
   GET /api/orders/stream?token=JWT
══════════════════════════════════════════════ */
export const streamMyOrderEvents = async (req, res) => {
    try {
        const token = req.query?.token;
        if (!token) return res.status(401).json({ success: false, message: "Token required" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded._id;
        if (!userId) return res.status(401).json({ success: false, message: "Invalid token" });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        addUserStream(userId, res);
        res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, userId })}\n\n`);

        const heartbeat = setInterval(() => {
            res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
        }, 25000);

        req.on("close", () => {
            clearInterval(heartbeat);
            removeUserStream(userId, res);
            res.end();
        });
    } catch {
        res.status(401).json({ success: false, message: "Unauthorized stream access" });
    }
};

/* ══════════════════════════════════════════════
   AUTO-CREATE SHIPROCKET SHIPMENT (async, non-blocking)
   Called after order creation for ECOMMERCE orders
══════════════════════════════════════════════ */
const autoCreateShipment = async (orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) return;
        if (order.delivery?.type === "URBEXON_HOUR") return; // UH uses local riders
        if (order.shipping?.shipmentId) return; // already created

        const totalWeight = order.items.reduce((sum, i) => sum + (i.qty || 1) * 250, 0); // ~250g per item estimate
        const result = await createShiprocketOrder({ order, totalWeight });

        if (result.success) {
            order.shipping = {
                shipmentId: String(result.shipment_id),
                awbCode: result.awb_code,
                courierName: result.courier_name,
                trackingUrl: result.tracking_url,
                labelUrl: result.label_url || "",
                status: "CREATED",
                mock: result.mock || false,
                autoCreated: true,
                createdAt: new Date(),
            };
            await order.save();
            console.log(`[Shiprocket] Auto-created shipment for order ${orderId} — AWB: ${result.awb_code}`);
        } else {
            console.warn(`[Shiprocket] Auto-create failed for order ${orderId}:`, result.error);
        }
    } catch (err) {
        console.warn(`[Shiprocket] Auto-create error for order ${orderId}:`, err.message);
    }
};

/* ══════════════════════════════════════════════
   CREATE ORDER (COD)
   ✅ Prices recalculated from DB — frontend totalAmount IGNORED
   ✅ COD validated server-side
   ✅ No WhatsApp
══════════════════════════════════════════════ */
export const createOrder = async (req, res) => {
    try {
        const {
            items,
            customerName,
            phone,
            address,
            email,
            pincode,
            city,
            state,
            paymentMethod,
            deliveryType,
            distanceKm,
            latitude,
            longitude,
            couponId,
            couponCode,
        } = req.body;

        if (!items?.length)
            return res.status(400).json({ success: false, message: "Cart is empty" });
        if (!customerName?.trim() || !phone?.trim() || !address?.trim())
            return res.status(400).json({ success: false, message: "Customer details missing" });
        if (!/^[6-9]\d{9}$/.test(phone.trim()))
            return res.status(400).json({ success: false, message: "Invalid phone number" });

        // ✅ COD validated against Pincode DB (Flipkart-style)
        if (paymentMethod === "COD") {
            if (!pincode || !/^\d{6}$/.test(pincode.trim()))
                return res.status(400).json({ success: false, message: "Valid 6-digit pincode required for COD orders" });

            const pincodeDoc = await Pincode.findOne({ code: pincode.trim() }).lean();
            if (!pincodeDoc || pincodeDoc.status !== "active")
                return res.status(400).json({
                    success: false,
                    message: pincodeDoc?.status === "coming_soon"
                        ? "COD is coming soon to your area. Please use online payment for now."
                        : "COD is not available for this pincode. Please use online payment."
                });
        }

        const method = paymentMethod === "COD" ? "COD" : "RAZORPAY";

        // ── UH: Server-side distance calculation (don't trust client distanceKm) ──
        let realDistanceKm = Number(distanceKm || 0);
        if (deliveryType === "URBEXON_HOUR" && latitude && longitude) {
            const shopLat = DELIVERY_CONFIG.SHOP_LAT;
            const shopLng = DELIVERY_CONFIG.SHOP_LNG;
            const toRad = (d) => (d * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(latitude - shopLat);
            const dLon = toRad(longitude - shopLng);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(shopLat)) * Math.cos(toRad(latitude)) * Math.sin(dLon / 2) ** 2;
            realDistanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
        }

        let pricing;
        try {
            pricing = await calculateOrderPricing(items, method, { deliveryType, distanceKm: realDistanceKm, pincode, couponId, couponCode, userId: req.user._id });
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const { formattedItems, itemsTotal, deliveryCharge, platformFee, finalTotal, deliveryETA, deliveryProvider, deliveryType: finalDeliveryType, distanceKm: finalDistanceKm, coupon: appliedCoupon, couponDiscount } = pricing;

        const ip = getClientIp(req);
        const fraudCheck = await checkFraud({ userId: req.user._id, ip, amount: finalTotal });
        const invoiceNum = await generateInvoiceNumber();

        const order = new Order({
            user: req.user._id,
            invoiceNumber: invoiceNum,
            items: formattedItems,
            customerName: customerName.trim().slice(0, 100),
            phone: phone.trim(),
            address: address.trim().slice(0, 500),
            email: email?.trim().toLowerCase().slice(0, 200) || "",
            city: city?.trim().slice(0, 100) || "",
            state: state?.trim().slice(0, 100) || "",
            pincode: pincode?.trim() || "",
            latitude: latitude ? Number(latitude) : undefined,
            longitude: longitude ? Number(longitude) : undefined,
            totalAmount: finalTotal,
            platformFee,
            deliveryCharge,
            delivery: {
                type: finalDeliveryType,
                distanceKm: finalDistanceKm,
                provider: deliveryProvider,
                eta: deliveryETA,
            },
            payment: {
                method,
                status: "PENDING",
                ip,
                userAgent: req.headers["user-agent"]?.slice(0, 300) || "",
                flagged: fraudCheck.flagged,
                flagReasons: fraudCheck.reasons,
            },
            paymentLogs: [{
                event: "ORDER_PLACED",
                amount: finalTotal,
                method,
                ip,
                meta: { fraudCheck, itemsTotal, deliveryCharge },
                at: new Date(),
            }],
            coupon: appliedCoupon ? {
                code: appliedCoupon.couponCode,
                discount: appliedCoupon.discount || 0,
            } : undefined,
            orderMode: finalDeliveryType === "URBEXON_HOUR" ? "URBEXON_HOUR" : "ECOMMERCE",
            vendorId: formattedItems[0]?.vendorId || null,
            orderStatus: "PLACED",
            statusTimeline: { placedAt: new Date() },
        });

        const savedOrder = await order.save();
        await deductStock(formattedItems);
        if (appliedCoupon?.couponId) {
            await markCouponUsed(appliedCoupon.couponId, req.user._id).catch(() => { });
        }

        // ── Notify vendor + all online delivery boys (async, non-blocking) ──
        (async () => {
            try {
                const isUrbexonHour = finalDeliveryType === "URBEXON_HOUR";

                // 1. Notify vendor(s) whose products were ordered
                const Product = (await import("../models/Product.js")).default;
                const Vendor = (await import("../models/vendorModels/Vendor.js")).default;
                const productIds = formattedItems.map(i => i.productId);
                const products = await Product.find({ _id: { $in: productIds } }).select("vendorId").lean();
                const vendorIds = [...new Set(products.map(p => p.vendorId?.toString()).filter(Boolean))];

                if (vendorIds.length > 0) {
                    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("userId email businessName").lean();
                    const vendorUserIds = vendors.map(v => v.userId);
                    broadcastToUsers(vendorUserIds, "new_order", {
                        orderId: savedOrder._id,
                        totalAmount: finalTotal,
                        amount: finalTotal,
                        items: formattedItems.length,
                        customerName: customerName.trim(),
                        pincode: pincode || "",
                        type: finalDeliveryType,
                        at: new Date().toISOString(),
                    });

                    // Send email to each vendor with their specific items
                    for (const vendor of vendors) {
                        if (!vendor.email) continue;
                        const vendorProductIds = products.filter(p => p.vendorId?.toString() === vendor._id.toString()).map(p => p._id.toString());
                        const vendorItems = formattedItems.filter(i => vendorProductIds.includes(i.productId?.toString()));
                        if (vendorItems.length === 0) continue;
                        const mailData = vendorNewOrderEmail(savedOrder, vendorItems, vendor.businessName || "Vendor");
                        sendEmail({ to: vendor.email, subject: mailData.subject, html: mailData.html, label: "Vendor/NewOrder" });
                    }
                }

                // 2. If Urbexon Hour order → notify NEARBY online delivery boys
                if (isUrbexonHour) {
                    const DeliveryBoy = (await import("../models/deliveryModels/DeliveryBoy.js")).default;
                    const { DELIVERY_CONFIG: DC } = await import("../config/deliveryConfig.js");
                    // Get all approved + online delivery boys
                    const onlineRiders = await DeliveryBoy.find({
                        status: "approved",
                        isOnline: true,
                    }).select("userId location").lean();

                    // Filter riders within MAX_RADIUS_KM of the shop/order
                    const orderLat = savedOrder.latitude || DC.SHOP_LAT;
                    const orderLng = savedOrder.longitude || DC.SHOP_LNG;
                    const MAX_KM = DC.URBEXON_HOUR.MAX_RADIUS_KM || 15;
                    const toRad = d => (d * Math.PI) / 180;
                    const hvKm = (lat1, lng1, lat2, lng2) => {
                        const R = 6371, dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
                        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
                        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    };
                    const nearbyRiders = onlineRiders.filter(r => {
                        if (!r.location?.lat || !r.location?.lng) return true; // Include riders without GPS (they may be nearby but haven't shared location)
                        return hvKm(orderLat, orderLng, r.location.lat, r.location.lng) <= MAX_KM;
                    });

                    if (nearbyRiders.length > 0) {
                        const riderUserIds = nearbyRiders.map(r => r.userId);
                        broadcastToUsers(riderUserIds, "new_delivery_request", {
                            orderId: savedOrder._id,
                            amount: finalTotal,
                            items: formattedItems.length,
                            address: address?.slice(0, 100),
                            distanceKm: finalDistanceKm,
                            eta: deliveryETA,
                            at: new Date().toISOString(),
                        });
                        console.log(`[WS] Delivery request sent to ${riderUserIds.length} nearby riders (of ${onlineRiders.length} online)`);
                    } else {
                        console.log("[WS] No nearby delivery boys available for Urbexon Hour order");
                    }

                    // 3. Notify admin panel about new UH order
                    broadcastAll("new_order", {
                        orderId: savedOrder._id,
                        amount: finalTotal,
                        items: formattedItems.length,
                        type: "URBEXON_HOUR",
                        at: new Date().toISOString(),
                    });

                    // 4. Start smart assignment engine (cascade with timeouts)
                    startAssignment(savedOrder._id).catch(err => {
                        console.warn("[Assignment] Auto-start failed:", err.message);
                    });
                }
            } catch (notifyErr) {
                console.warn("[Order] Notification failed (non-critical):", notifyErr.message);
            }
        })();

        // ── Auto-create Shiprocket shipment for prepaid ecommerce orders (async) ──
        // COD orders will get shipment auto-created when admin marks PACKED/SHIPPED
        if (finalDeliveryType !== "URBEXON_HOUR" && savedOrder.payment?.method === "RAZORPAY") {
            autoCreateShipment(savedOrder._id).catch(() => { });
        }

        res.status(201).json({
            success: true,
            orderId: savedOrder._id,
            invoiceNumber: savedOrder.invoiceNumber,
            orderStatus: savedOrder.orderStatus,
            itemsTotal,
            deliveryCharge,
            finalTotal,
            deliveryType: finalDeliveryType,
            deliveryETA,
            deliveryProvider,
        });

        const userMail = getOrderStatusEmailTemplate({
            customerName: customerName.trim(),
            orderId: savedOrder._id,
            status: "PLACED",
        });
        if (email?.trim() && !email.includes("@placeholder.com"))
            sendEmail({ to: email.trim(), subject: userMail.subject, html: userMail.html, label: "User/NewOrder" });

        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `🛒 New COD Order #${savedOrder._id.toString().slice(-6).toUpperCase()} — ₹${finalTotal}${fraudCheck.flagged ? " ⚠️ FLAGGED" : ""}`,
            html: adminOrderEmailHTML({ order: savedOrder }),
            label: "Admin/NewOrder",
        });

        // Admin notification
        createNotification({
            type: "order",
            title: `New Order #${savedOrder._id.toString().slice(-6).toUpperCase()}`,
            message: `${customerName.trim()} placed a ₹${finalTotal} order${fraudCheck.flagged ? " ⚠️ FLAGGED" : ""}`,
            icon: "order",
            link: "/admin/orders",
            meta: { orderId: savedOrder._id, amount: finalTotal },
        });

        if (fraudCheck.flagged)
            console.warn(`[FRAUD] Order ${savedOrder._id} flagged:`, fraudCheck.reasons);

    } catch (err) {
        console.error("CREATE ORDER:", err);
        res.status(500).json({ success: false, message: "Order placement failed. Please try again." });
    }
};

/* ══════════════════════════════════════════════
   GET CHECKOUT PRICING
══════════════════════════════════════════════ */
export const getCheckoutPricing = async (req, res) => {
    try {
        console.log("PRICING BODY:", JSON.stringify(req.body));
        const { items, paymentMethod, deliveryType, distanceKm, pincode, couponId, couponCode } = req.body;

        if (!items?.length)
            return res.status(400).json({ success: false, message: "Cart is empty" });

        const method = paymentMethod === "COD" ? "COD" : "RAZORPAY";

        try {
            const pricing = await calculateOrderPricing(items, method, { deliveryType, distanceKm, pincode, couponId, couponCode, userId: req.user._id });
            res.json({
                itemsTotal: pricing.itemsTotal,
                deliveryCharge: pricing.deliveryCharge,
                platformFee: pricing.platformFee,
                couponDiscount: pricing.couponDiscount || 0,
                coupon: pricing.coupon || null,
                finalTotal: pricing.finalTotal,
                deliveryType: pricing.deliveryType,
                distanceKm: pricing.distanceKm,
                deliveryETA: pricing.deliveryETA,
                deliveryProvider: pricing.deliveryProvider,
                freeDeliveryThreshold: DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD,
                amountForFreeDelivery: Math.max(0, DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD - pricing.itemsTotal),
            });
        } catch (err) {
            console.error("PRICING INNER ERROR:", err.message, err.stack);
            res.status(400).json({ success: false, message: err.message });
        }
    } catch (err) {
        console.error("GET PRICING:", err);
        res.status(500).json({ success: false, message: "Failed to calculate pricing" });
    }
};

/* ══════════════════════════════════════════════
   CANCEL ORDER (USER)
══════════════════════════════════════════════ */
export const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order)
            return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.orderStatus === "CANCELLED")
            return res.status(400).json({ success: false, message: "Already cancelled" });

        // Check if any item is non-cancellable
        const nonCancellable = order.items.find(i => i.policy?.isCancellable === false);
        if (nonCancellable)
            return res.status(400).json({
                success: false,
                message: `"${nonCancellable.name}" is non-cancellable. Order cannot be cancelled.`,
            });

        // Check cancel window per item (hours after placement)
        const placedAt = order.statusTimeline?.placedAt || order.createdAt;
        const hoursSincePlaced = (Date.now() - new Date(placedAt).getTime()) / (1000 * 60 * 60);
        const maxCancelWindow = Math.max(...order.items.map(i => i.policy?.cancelWindow || 0));

        if (maxCancelWindow > 0 && hoursSincePlaced > maxCancelWindow) {
            return res.status(400).json({
                success: false,
                message: `Cancellation window of ${maxCancelWindow} hours has expired.`,
            });
        }

        // Standard status check — cannot cancel after PACKED
        if (!["PLACED", "CONFIRMED"].includes(order.orderStatus))
            return res.status(400).json({
                message: `Cannot cancel — order is ${order.orderStatus.toLowerCase().replace(/_/g, " ")}. Cancellation only allowed before packing.`,
            });

        order.orderStatus = "CANCELLED";
        order.cancellationReason = String(req.body?.reason || "Cancelled by customer").trim().slice(0, 500);
        const existing = order.statusTimeline?.toObject ? order.statusTimeline.toObject() : { ...order.statusTimeline };
        order.statusTimeline = { ...existing, cancelledAt: new Date() };
        order.markModified("statusTimeline");

        if (order.payment.method === "RAZORPAY" && order.payment.status === "PAID") {
            order.refund = {
                requested: true,
                requestedAt: new Date(),
                reason: req.body?.reason || "Order cancelled by customer",
                status: "PROCESSING",
                amount: order.totalAmount,
            };
            order.paymentLogs.push({
                event: "REFUND_REQUESTED", amount: order.totalAmount,
                method: "RAZORPAY", ip: getClientIp(req), at: new Date(),
            });

            // Auto-initiate Razorpay refund for user-cancelled prepaid orders
            if (order.payment.razorpayPaymentId) {
                try {
                    const refundResult = await razorpay.payments.refund(order.payment.razorpayPaymentId, {
                        amount: Math.round(order.totalAmount * 100), // paise
                        notes: { orderId: order._id.toString(), reason: "Customer cancelled" },
                    });
                    order.refund.status = "PROCESSED";
                    order.refund.processedAt = new Date();
                    order.refund.razorpayRefundId = refundResult.id;
                    order.payment.status = "REFUNDED";
                    order.paymentLogs.push({
                        event: "REFUND_PROCESSED", amount: order.totalAmount,
                        method: "RAZORPAY", paymentId: refundResult.id, at: new Date(),
                    });
                } catch (refundErr) {
                    console.error("[Refund] Auto-refund failed for order", order._id, refundErr.message);
                    order.refund.status = "REQUESTED"; // fallback to manual admin approval
                    order.paymentLogs.push({
                        event: "REFUND_FAILED", amount: order.totalAmount,
                        method: "RAZORPAY", meta: { error: refundErr.message }, at: new Date(),
                    });
                }
            }
        }

        await order.save();
        await restoreStock(order.items);

        // Stop assignment engine if UH order is being searched for riders
        if (order.orderMode === "URBEXON_HOUR") {
            cancelAssignment(order._id);
        }

        res.json({
            success: true,
            message: "Order cancelled",
            order: order.toObject(),
            refundRequested: !!order.refund?.requested,
        });

        const mail = getOrderStatusEmailTemplate({ customerName: order.customerName, orderId: order._id, status: "CANCELLED" });
        if (order.email && !order.email.includes("@placeholder.com"))
            sendEmail({ to: order.email, subject: mail.subject, html: mail.html, label: "User/Cancel" });
        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `❌ Cancelled #${order._id.toString().slice(-6).toUpperCase()} — ${order.customerName}`,
            html: adminOrderEmailHTML({ order }),
            label: "Admin/Cancel",
        });

        createNotification({
            type: "order",
            title: `Order Cancelled #${order._id.toString().slice(-6).toUpperCase()}`,
            message: `${order.customerName} cancelled ₹${order.totalAmount} order`,
            icon: "alert",
            link: "/admin/orders",
            meta: { orderId: order._id },
        });

    } catch (err) {
        console.error("CANCEL ORDER:", err);
        res.status(500).json({ success: false, message: "Failed to cancel order" });
    }
};

/* ══════════════════════════════════════════════
   GET MY ORDERS
══════════════════════════════════════════════ */
export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
        res.json(orders);
    } catch {
        res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
};

/* ══════════════════════════════════════════════
   GET ORDER BY ID
══════════════════════════════════════════════ */
export const getOrderById = async (req, res) => {
    try {
        const doc = await Order.findById(req.params.id)
            .select("+deliveryOtp.code");
        if (!doc) return res.status(404).json({ success: false, message: "Order not found" });

        const order = doc.toObject();
        const isOwner = order.user?.toString() === req.user._id.toString();
        const isAdmin = ["admin", "owner"].includes(req.user.role);
        if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: "Access denied" });

        // Only expose OTP code to the order owner when OUT_FOR_DELIVERY
        if (order.deliveryOtp?.code) {
            if (isOwner && order.orderStatus === "OUT_FOR_DELIVERY" && !order.deliveryOtp.verified) {
                // keep it
            } else {
                delete order.deliveryOtp.code;
            }
        }

        /* ── Compute policy eligibility for the client ── */
        const now = Date.now();
        const placedAt = order.statusTimeline?.placedAt || order.createdAt;
        const deliveredAt = order.statusTimeline?.deliveredAt;
        const hoursSincePlaced = (now - new Date(placedAt).getTime()) / (1000 * 60 * 60);
        const daysSinceDelivered = deliveredAt ? (now - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24) : null;
        const isUH = order.orderMode === "URBEXON_HOUR";

        const canCancelItems = order.items.filter(i => i.policy?.isCancellable !== false);
        const maxCancelWindow = canCancelItems.length ? Math.max(...canCancelItems.map(i => i.policy?.cancelWindow || 0)) : 0;
        const cancelWindowOk = maxCancelWindow > 0 ? hoursSincePlaced <= maxCancelWindow : true;
        const canCancel = canCancelItems.length > 0
            && cancelWindowOk
            && ["PLACED", "CONFIRMED"].includes(order.orderStatus);

        const returnableItems = order.items.filter(i => i.policy?.isReturnable !== false);
        const minReturnWindow = returnableItems.length ? Math.min(...returnableItems.map(i => i.policy?.returnWindow ?? 7)) : 0;
        const canReturn = !isUH
            && returnableItems.length > 0
            && order.orderStatus === "DELIVERED"
            && (!order.return?.status || order.return.status === "NONE")
            && daysSinceDelivered !== null && daysSinceDelivered <= minReturnWindow;

        const replaceableItems = order.items.filter(i => i.policy?.isReplaceable === true);
        const minReplacementWindow = replaceableItems.length ? Math.min(...replaceableItems.map(i => i.policy?.replacementWindow ?? 7)) : 0;
        const canReplace = !isUH
            && replaceableItems.length > 0
            && order.orderStatus === "DELIVERED"
            && (!order.replacement?.status || order.replacement.status === "NONE")
            && (!order.return?.status || ["NONE", "REJECTED"].includes(order.return.status))
            && daysSinceDelivered !== null && daysSinceDelivered <= minReplacementWindow;

        order.policyInfo = {
            canCancel,
            canReturn,
            canReplace,
            cancelWindowHours: maxCancelWindow,
            cancelHoursRemaining: maxCancelWindow > 0 ? Math.max(0, maxCancelWindow - hoursSincePlaced) : null,
            returnWindowDays: minReturnWindow,
            returnDaysRemaining: daysSinceDelivered !== null ? Math.max(0, minReturnWindow - daysSinceDelivered) : null,
            replacementWindowDays: minReplacementWindow,
            replacementDaysRemaining: daysSinceDelivered !== null ? Math.max(0, minReplacementWindow - daysSinceDelivered) : null,
        };

        res.json(order);
    } catch {
        res.status(500).json({ success: false, message: "Error fetching order" });
    }
};

/* ══════════════════════════════════════════════
   UPDATE ORDER STATUS (ADMIN)
══════════════════════════════════════════════ */
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderStatus: status } = req.body;

        const valid = ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
        if (!valid.includes(status))
            return res.status(400).json({ success: false, message: "Invalid status" });

        // Status transition validation
        const TRANSITIONS = {
            PLACED: ["CONFIRMED", "CANCELLED"],
            CONFIRMED: ["PACKED", "CANCELLED"],
            PACKED: ["READY_FOR_PICKUP", "SHIPPED", "CANCELLED"],
            READY_FOR_PICKUP: ["SHIPPED", "OUT_FOR_DELIVERY", "CANCELLED"],
            SHIPPED: ["OUT_FOR_DELIVERY", "CANCELLED"],
            OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
            DELIVERED: ["RETURN_REQUESTED"],
            CANCELLED: [],
        };
        const currentOrder = await Order.findById(req.params.id).select("orderStatus orderMode").lean();
        if (!currentOrder) return res.status(404).json({ success: false, message: "Order not found" });
        const allowed = TRANSITIONS[currentOrder.orderStatus] || [];
        if (!allowed.includes(status))
            return res.status(400).json({ success: false, message: `Cannot transition from ${currentOrder.orderStatus} to ${status}` });

        // Block SHIPPED for UH (local delivery) orders
        if (status === "SHIPPED" && currentOrder.orderMode === "URBEXON_HOUR")
            return res.status(400).json({ success: false, message: "UH orders use local delivery, SHIPPED status is not applicable" });

        const update = { orderStatus: status };
        const tMap = { CONFIRMED: "confirmedAt", PACKED: "packedAt", READY_FOR_PICKUP: "readyForPickupAt", SHIPPED: "shippedAt", OUT_FOR_DELIVERY: "outForDeliveryAt", DELIVERED: "deliveredAt", CANCELLED: "cancelledAt" };
        if (tMap[status]) update[`statusTimeline.${tMap[status]}`] = new Date();

        if (status === "DELIVERED") {
            update["payment.status"] = "PAID";
            update["payment.paidAt"] = new Date();
            update["delivery.status"] = "DELIVERED";
        }
        if (status === "SHIPPED") update["shipping.status"] = "SHIPPED";

        // Generate delivery OTP when marking OUT_FOR_DELIVERY
        if (status === "OUT_FOR_DELIVERY") {
            const otpCode = String(Math.floor(1000 + Math.random() * 9000));
            update["deliveryOtp.code"] = otpCode;
            update["deliveryOtp.expiresAt"] = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
            update["deliveryOtp.verified"] = false;
            update["delivery.status"] = "OUT_FOR_DELIVERY";
        }
        if (status === "CONFIRMED") update["delivery.status"] = "PENDING";
        if (status === "PACKED") update["delivery.status"] = "PENDING";
        if (status === "READY_FOR_PICKUP") update["delivery.status"] = "PENDING";

        const order = await Order.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        if (status === "CANCELLED") {
            await restoreStock(order.items);
            // Cancel delivery assignment if any
            if (order.delivery?.assignedTo) {
                Order.updateOne({ _id: order._id }, { $set: { "delivery.status": "CANCELLED" } }).catch(() => { });
            }
        }

        // Auto-trigger assignment engine when order is READY_FOR_PICKUP with LOCAL_RIDER delivery
        if (status === "READY_FOR_PICKUP" && order.delivery?.provider === "LOCAL_RIDER" && !order.delivery?.assignedTo) {
            startAssignment(order._id).catch(err => {
                console.warn("[Assignment] Auto-start on READY_FOR_PICKUP failed:", err.message);
            });
        }

        // ── Auto Shiprocket: Create shipment on PACKED, schedule pickup on SHIPPED ──
        if (order.orderMode !== "URBEXON_HOUR" && !order.shipping?.shipmentId && status === "PACKED") {
            (async () => {
                try {
                    const { createShiprocketOrder } = await import("../utils/Shiprocketservice.js");
                    const totalWeight = order.items.reduce((sum, i) => sum + (i.qty || 1) * 250, 0);
                    const result = await createShiprocketOrder({ order, totalWeight });
                    if (result.success) {
                        await Order.updateOne({ _id: order._id }, {
                            $set: {
                                "shipping.shipmentId": String(result.shipment_id),
                                "shipping.awbCode": result.awb_code,
                                "shipping.courierName": result.courier_name,
                                "shipping.trackingUrl": result.tracking_url,
                                "shipping.labelUrl": result.label_url || "",
                                "shipping.status": "CREATED",
                                "shipping.mock": result.mock || false,
                                "shipping.autoCreated": true,
                                "shipping.createdAt": new Date(),
                            }
                        });
                        console.log(`[Shiprocket] Auto-created on PACKED for order ${order._id} — AWB: ${result.awb_code}`);
                    }
                } catch (err) {
                    console.warn(`[Shiprocket] Auto-create on PACKED failed:`, err.message);
                }
            })();
        }

        if (order.orderMode !== "URBEXON_HOUR" && order.shipping?.shipmentId && status === "SHIPPED") {
            (async () => {
                try {
                    const { schedulePickup } = await import("../utils/Shiprocketservice.js");
                    await schedulePickup(order.shipping.shipmentId);
                    console.log(`[Shiprocket] Auto-pickup scheduled on SHIPPED for order ${order._id}`);
                } catch (err) {
                    console.warn(`[Shiprocket] Auto-pickup on SHIPPED failed:`, err.message);
                }
            })();
        }

        publishToUser(order.user, "order_status_updated", {
            orderId: order._id,
            status,
            at: new Date().toISOString(),
        });
        // ✅ Also notify via WebSocket
        sendToUser(order.user, "order_status_updated", {
            orderId: order._id,
            orderNumber: order.invoiceNumber,
            status,
            at: new Date().toISOString(),
        });

        res.json(order);

        // ── Auto-create Settlement on DELIVERED ──
        if (status === "DELIVERED") {
            (async () => {
                try {
                    // Find vendor(s) for this order's products
                    const productIds = order.items.map(i => i.productId);
                    const products = await Product.find({ _id: { $in: productIds } }).select("vendorId").lean();
                    const vendorIds = [...new Set(products.map(p => p.vendorId?.toString()).filter(Boolean))];

                    for (const vid of vendorIds) {
                        // Skip if settlement already exists for this order+vendor
                        const exists = await Settlement.findOne({ orderId: order._id, vendorId: vid });
                        if (exists) continue;

                        const vendor = await Vendor.findById(vid).select("commissionRate pendingSettlement").lean();
                        if (!vendor) continue;

                        // Calculate this vendor's portion of the order (not full totalAmount)
                        const vendorProductIdStrs = products.filter(p => p.vendorId?.toString() === vid).map(p => p._id.toString());
                        const vendorItems = order.items.filter(i => vendorProductIdStrs.includes(i.productId?.toString()));
                        const orderAmount = vendorItems.reduce((sum, i) => sum + (Number(i.price) * Number(i.qty)), 0);

                        const commissionRate = vendor.commissionRate ?? 18;
                        const commissionAmount = Math.round((orderAmount * commissionRate) / 100);
                        const platformFee = order.platformFee || 0;
                        const deliveryCharge = order.deliveryCharge || 0;
                        const vendorEarning = Math.max(0, orderAmount - commissionAmount);

                        await Settlement.create({
                            vendorId: vid,
                            orderId: order._id,
                            orderAmount,
                            commissionRate,
                            commissionAmount,
                            deliveryCharge,
                            platformFee,
                            vendorEarning,
                            status: "pending",
                        });

                        // Increment vendor's pendingSettlement counter
                        await Vendor.findByIdAndUpdate(vid, { $inc: { pendingSettlement: vendorEarning, totalRevenue: orderAmount, totalOrders: 1 } });
                    }
                } catch (settleErr) {
                    console.error("[Settlement] Auto-create failed for order", order._id, settleErr.message);
                }
            })();
        }

        if (order.email && !order.email.includes("@placeholder.com")) {
            const sMail = getOrderStatusEmailTemplate({
                customerName: order.customerName, orderId: order._id, status,
                trackingUrl: order.shipping?.trackingUrl || "",
                courier: order.shipping?.courierName || "",
                awb: order.shipping?.awbCode || "",
            });
            if (status === "DELIVERED") {
                try {
                    const pdf = await generateInvoiceBuffer(order.toObject ? order.toObject() : order);
                    sendEmail({ to: order.email, subject: sMail.subject, html: sMail.html, label: `User/${status}`, attachments: [{ filename: `Invoice_${order.invoiceNumber || order._id.toString().slice(-8).toUpperCase()}.pdf`, content: pdf }] });
                } catch {
                    sendEmail({ to: order.email, subject: sMail.subject, html: sMail.html, label: `User/${status}` });
                }
            } else {
                sendEmail({ to: order.email, subject: sMail.subject, html: sMail.html, label: `User/${status}` });
            }
        }

        // ── Notify vendor(s) on every status change ──
        (async () => {
            try {
                const Product = (await import("../models/Product.js")).default;
                const Vendor = (await import("../models/vendorModels/Vendor.js")).default;
                const productIds = order.items.map(i => i.productId);
                const products = await Product.find({ _id: { $in: productIds } }).select("vendorId").lean();
                const vendorIds = [...new Set(products.map(p => p.vendorId?.toString()).filter(Boolean))];
                if (vendorIds.length > 0) {
                    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("userId").lean();
                    const vendorUserIds = vendors.map(v => v.userId);
                    broadcastToUsers(vendorUserIds, "order_status_changed", {
                        orderId: order._id,
                        orderNumber: order.invoiceNumber,
                        status,
                        customerName: order.customerName,
                        at: new Date().toISOString(),
                    });
                }
            } catch (notifyErr) {
                console.warn("[Order] Vendor notification failed:", notifyErr.message);
            }
        })();
    } catch (err) {
        console.error("UPDATE STATUS:", err);
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
};

/* ══════════════════════════════════════════════
   GET ALL ORDERS (ADMIN) — Paginated
══════════════════════════════════════════════ */
export const getAllOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status && req.query.status !== "ALL") filter.orderStatus = req.query.status;
        if (req.query.orderMode && req.query.orderMode !== "ALL") filter.orderMode = req.query.orderMode;
        if (req.query.search?.trim()) {
            const esc = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { customerName: { $regex: esc, $options: "i" } },
                { phone: { $regex: esc, $options: "i" } },
            ];
        }

        const [orders, total] = await Promise.all([
            Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(filter),
        ]);

        res.json({ orders, total, page, totalPages: Math.ceil(total / limit), limit });
    } catch {
        res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
};



/* ══════════════════════════════════════════════
   ADMIN — LOCAL DELIVERY QUEUE (URBEXON HOUR)
══════════════════════════════════════════════ */
export const getLocalDeliveryQueue = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        const filter = {
            "delivery.type": "URBEXON_HOUR",
            orderStatus: { $nin: ["DELIVERED", "CANCELLED"] },
        };

        const [orders, total] = await Promise.all([
            Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(filter),
        ]);

        res.json({ orders, total, page, totalPages: Math.ceil(total / limit), limit });
    } catch (err) {
        console.error("LOCAL DELIVERY QUEUE:", err);
        res.status(500).json({ success: false, message: "Failed to fetch local delivery queue" });
    }
};

/* ══════════════════════════════════════════════
   ADMIN — ASSIGN LOCAL DELIVERY
══════════════════════════════════════════════ */
export const assignLocalDelivery = async (req, res) => {
    try {
        const { provider, riderName, riderPhone, riderId, note } = req.body;
        const allowed = ["LOCAL_RIDER", "VENDOR_SELF", "SHIPROCKET"];
        if (!allowed.includes(provider)) {
            return res.status(400).json({ success: false, message: "Invalid provider" });
        }

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.delivery?.type !== "URBEXON_HOUR") {
            return res.status(400).json({ success: false, message: "Only Urbexon Hour orders can be assigned here" });
        }

        order.delivery.provider = provider;
        order.delivery.note = String(note || "").trim().slice(0, 500);
        order.delivery.assignedAt = new Date();

        // If riderId provided, fetch rider details from DeliveryBoy model
        if (provider === "LOCAL_RIDER" && riderId) {
            const rider = await DeliveryBoy.findById(riderId).lean();
            if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });
            order.delivery.assignedTo = rider._id;
            order.delivery.riderName = rider.name;
            order.delivery.riderPhone = rider.phone;

            // Notify rider via WebSocket
            if (rider.userId) {
                sendToUser(rider.userId.toString(), "delivery_assigned", {
                    orderId: order._id,
                    orderNumber: order.invoiceNumber,
                    message: "A delivery has been assigned to you by admin",
                    at: new Date().toISOString(),
                });
            }
        } else {
            order.delivery.riderName = String(riderName || "").trim().slice(0, 100);
            order.delivery.riderPhone = String(riderPhone || "").trim().slice(0, 20);
        }
        order.markModified("delivery");

        if (order.orderStatus === "PLACED") {
            order.orderStatus = "CONFIRMED";
            const existing = order.statusTimeline?.toObject ? order.statusTimeline.toObject() : { ...order.statusTimeline };
            order.statusTimeline = { ...existing, confirmedAt: new Date() };
            order.markModified("statusTimeline");
        }

        await order.save();

        publishToUser(order.user, "order_status_updated", {
            orderId: order._id,
            status: order.orderStatus,
            provider,
            assignedAt: order.delivery.assignedAt,
            at: new Date().toISOString(),
        });
        // ✅ WebSocket notification
        sendToUser(order.user, "order_status_updated", {
            orderId: order._id,
            orderNumber: order.invoiceNumber,
            status: order.orderStatus,
            provider,
            message: `Your order is now ${order.orderStatus.toLowerCase()}`,
            at: new Date().toISOString(),
        });

        res.json({ success: true, order });
    } catch (err) {
        console.error("ASSIGN LOCAL DELIVERY:", err);
        res.status(500).json({ success: false, message: "Failed to assign local delivery" });
    }
};

/* ══════════════════════════════════════════════
   REFUND — REQUEST (USER)
══════════════════════════════════════════════ */
export const requestRefund = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.payment.method !== "RAZORPAY") return res.status(400).json({ success: false, message: "Refund only for online payments" });
        if (order.payment.status !== "PAID") return res.status(400).json({ success: false, message: "Payment not completed" });
        if (order.refund?.status && order.refund.status !== "NONE") return res.status(400).json({ message: `Refund already ${order.refund.status.toLowerCase()}` });

        order.refund = { requested: true, requestedAt: new Date(), reason: (req.body.reason || "Requested by customer").trim().slice(0, 500), status: "REQUESTED", amount: order.totalAmount };
        order.paymentLogs.push({ event: "REFUND_REQUESTED", amount: order.totalAmount, method: "RAZORPAY", ip: getClientIp(req), at: new Date() });
        order.markModified("refund");
        await order.save();

        res.json({ success: true, message: "Refund request submitted", refund: order.refund });
        sendEmail({ to: process.env.ADMIN_EMAIL, subject: `💰 Refund Request #${order._id.toString().slice(-6).toUpperCase()} — ₹${order.totalAmount}`, html: `<p>Refund requested by ${(order.customerName || "").replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))}. Amount: ₹${order.totalAmount}</p>`, label: "Admin/RefundRequest" });
    } catch (err) {
        console.error("REQUEST REFUND:", err);
        res.status(500).json({ success: false, message: "Failed to submit refund request" });
    }
};

/* ══════════════════════════════════════════════
   REFUND — PROCESS (ADMIN)
══════════════════════════════════════════════ */
export const processRefund = async (req, res) => {
    try {
        const { action, adminNote } = req.body;
        if (!["approve", "reject"].includes(action)) return res.status(400).json({ success: false, message: "Action must be approve or reject" });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (!order.refund?.requested || order.refund?.status !== "REQUESTED") return res.status(400).json({ success: false, message: "No pending refund request" });

        if (action === "reject") {
            order.refund.status = "REJECTED";
            order.refund.adminNote = adminNote?.trim() || "";
            order.paymentLogs.push({ event: "REFUND_REJECTED", amount: order.refund.amount, method: "RAZORPAY", ip: getClientIp(req), at: new Date() });
            order.markModified("refund");
            await order.save();
            return res.json({ success: true, message: "Refund rejected" });
        }

        const refundAmount = order.refund.amount || order.totalAmount;
        const paymentId = order.payment.razorpayPaymentId;
        if (!paymentId) return res.status(400).json({ success: false, message: "No Razorpay payment ID found" });

        order.refund.status = "PROCESSING";
        order.markModified("refund");
        await order.save();

        try {
            const rzRef = await razorpay.payments.refund(paymentId, { amount: refundAmount * 100, notes: { orderId: order._id.toString() } });
            order.refund.status = "PROCESSED";
            order.refund.razorpayRefundId = rzRef.id;
            order.refund.processedAt = new Date();
            order.refund.processedBy = req.user._id;
            order.payment.status = "REFUNDED";
            order.paymentLogs.push({ event: "REFUND_PROCESSED", amount: refundAmount, method: "RAZORPAY", paymentId, meta: { refundId: rzRef.id }, at: new Date() });
            order.markModified("refund");
            await order.save();
            res.json({ success: true, message: `₹${refundAmount} refunded`, refundId: rzRef.id });
        } catch (rzErr) {
            order.refund.status = "FAILED";
            order.markModified("refund");
            await order.save();
            return res.status(500).json({ message: "Razorpay refund failed: " + (rzErr.error?.description || rzErr.message) });
        }
    } catch (err) {
        console.error("PROCESS REFUND:", err);
        res.status(500).json({ success: false, message: "Refund processing failed" });
    }
};

/* ══════════════════════════════════════════════
   REFUND — RETRY (ADMIN)
══════════════════════════════════════════════ */
export const retryRefund = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.refund?.status !== "FAILED") return res.status(400).json({ success: false, message: "Only failed refunds can be retried" });
        order.refund.status = "REQUESTED";
        order.markModified("refund");
        await order.save();
        req.body.action = "approve";
        return processRefund(req, res);
    } catch {
        res.status(500).json({ success: false, message: "Retry failed" });
    }
};

/* ══════════════════════════════════════════════
   FLAGGED ORDERS QUEUE (ADMIN)
══════════════════════════════════════════════ */
export const getFlaggedOrders = async (req, res) => {
    try {
        const orders = await Order.find({ "payment.flagged": true }).sort({ createdAt: -1 }).lean();
        res.json(orders);
    } catch {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ══════════════════════════════════════════════
   RETURN — REQUEST (USER)
   PUT /api/orders/:id/return/request
   body: { reason, images? }
══════════════════════════════════════════════ */
export const requestReturn = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.orderStatus !== "DELIVERED") return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
        if (order.return?.status && order.return.status !== "NONE") return res.status(400).json({ success: false, message: `Return already ${order.return.status.toLowerCase()}` });

        // Urbexon Hour orders (food/perishable) cannot be returned
        if (order.orderMode === "URBEXON_HOUR")
            return res.status(400).json({ success: false, message: "Urbexon Hour orders are non-returnable" });

        // Check if ALL items are non-returnable
        const returnableItems = order.items.filter(i => i.policy?.isReturnable !== false);
        if (returnableItems.length === 0) {
            const reasons = [...new Set(order.items.map(i => i.policy?.nonReturnableReason).filter(Boolean))];
            return res.status(400).json({
                success: false,
                message: reasons.length
                    ? `This order is non-returnable: ${reasons.join(", ")}`
                    : "All items in this order are non-returnable",
            });
        }

        // Check return window — use the minimum return window among returnable items
        const deliveredAt = order.statusTimeline?.deliveredAt;
        const returnDays = Math.min(...returnableItems.map(i => i.policy?.returnWindow ?? 7));
        if (deliveredAt && Date.now() - new Date(deliveredAt).getTime() > returnDays * 24 * 60 * 60 * 1000) {
            return res.status(400).json({ success: false, message: `Return window of ${returnDays} days has expired` });
        }

        const reason = (req.body.reason || "").trim().slice(0, 500);
        if (!reason) return res.status(400).json({ success: false, message: "Return reason is required" });

        order.return = {
            status: "REQUESTED",
            requested: true,
            reason,
            images: Array.isArray(req.body.images) ? req.body.images.slice(0, 5) : [],
            requestedAt: new Date(),
            deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
        order.orderStatus = "RETURN_REQUESTED";
        order.statusTimeline = { ...order.statusTimeline, returnRequestedAt: new Date() };
        order.markModified("return");
        order.markModified("statusTimeline");
        await order.save();

        res.json({ success: true, message: "Return request submitted", return: order.return });

        // Notifications
        createNotification({
            type: "order",
            title: `Return Requested #${order._id.toString().slice(-6).toUpperCase()}`,
            message: `${order.customerName} requested return — "${reason.slice(0, 80)}"`,
            icon: "alert",
            link: "/admin/refund-return",
            meta: { orderId: order._id },
        });
        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `🔄 Return Requested #${order._id.toString().slice(-6).toUpperCase()} — ${order.customerName}`,
            html: `<p><b>${order.customerName}</b> requested return for order <b>#${order._id.toString().slice(-6).toUpperCase()}</b>.</p><p>Reason: ${reason}</p><p>Amount: ₹${order.totalAmount}</p>`,
            label: "Admin/ReturnRequest",
        });
        if (order.email && !order.email.includes("@placeholder.com")) {
            const mail = getOrderStatusEmailTemplate({ customerName: order.customerName, orderId: order._id, status: "RETURN_REQUESTED" });
            sendEmail({ to: order.email, subject: mail.subject || `Return Request Received — #${order._id.toString().slice(-6).toUpperCase()}`, html: mail.html || `<p>Hi ${order.customerName}, your return request has been received. We'll review it within 1-2 business days.</p>`, label: "User/ReturnRequest" });
        }
    } catch (err) {
        console.error("REQUEST RETURN:", err);
        res.status(500).json({ success: false, message: "Failed to submit return request" });
    }
};

/* ══════════════════════════════════════════════
   REFUND QUEUE (ADMIN)
══════════════════════════════════════════════ */
export const getRefundQueue = async (req, res) => {
    try {
        const orders = await Order.find({ "refund.status": "REQUESTED" }).sort({ "refund.requestedAt": -1 }).lean();
        res.json(orders);
    } catch {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ══════════════════════════════════════════════
   RETURN QUEUE (ADMIN)
   GET /api/orders/admin/returns
══════════════════════════════════════════════ */
export const getReturnQueue = async (req, res) => {
    try {
        const orders = await Order.find({
            "return.status": { $in: ["REQUESTED", "APPROVED", "PICKED_UP"] },
        }).sort({ "return.requestedAt": -1 }).lean();
        res.json(orders);
    } catch (err) {
        console.error("GET RETURN QUEUE:", err);
        res.status(500).json({ success: false, message: "Failed to fetch return queue" });
    }
};

/* ══════════════════════════════════════════════
   PROCESS RETURN (ADMIN)
   PUT /api/orders/:id/return/process
   body: { action: "approve"|"reject"|"pickup"|"refund", adminNote, refundAmount }
══════════════════════════════════════════════ */
export const processReturn = async (req, res) => {
    try {
        const { action, adminNote, refundAmount } = req.body;

        if (!["approve", "reject", "pickup", "refund"].includes(action))
            return res.status(400).json({ success: false, message: "Invalid action. Use: approve | reject | pickup | refund" });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (!order.return?.status || order.return.status === "NONE")
            return res.status(400).json({ success: false, message: "No return request found on this order" });

        const statusMap = {
            approve: "APPROVED",
            reject: "REJECTED",
            pickup: "PICKED_UP",
            refund: "REFUNDED",
        };

        order.return.status = statusMap[action];
        order.return.adminNote = adminNote?.trim() || "";
        order.return.processedAt = new Date();
        order.return.processedBy = req.user._id;

        // If refunding after return pickup — try Razorpay first, fallback for COD
        if (action === "refund") {
            const amount = refundAmount ? Number(refundAmount) : order.totalAmount;
            const paymentId = order.payment?.razorpayPaymentId;

            if (paymentId) {
                try {
                    const rzRef = await razorpay.payments.refund(paymentId, {
                        amount: amount * 100,
                        notes: { orderId: order._id.toString(), type: "RETURN_REFUND" },
                    });
                    order.refund = {
                        requested: true,
                        requestedAt: new Date(),
                        reason: "Return refund",
                        status: "PROCESSED",
                        amount,
                        razorpayRefundId: rzRef.id,
                        processedAt: new Date(),
                        processedBy: req.user._id,
                    };
                    order.payment.status = "REFUNDED";
                    order.paymentLogs.push({
                        event: "RETURN_REFUND_PROCESSED",
                        amount,
                        method: "RAZORPAY",
                        meta: { refundId: rzRef.id },
                        at: new Date(),
                    });
                    order.markModified("refund");
                } catch (rzErr) {
                    return res.status(500).json({
                        message: "Razorpay refund failed: " + (rzErr.error?.description || rzErr.message),
                    });
                }
            }
            // COD orders — manual cash refund, just mark as refunded

            // ✅ Restore stock for returned items
            try {
                await restoreStock(order.items);
            } catch (stockErr) {
                console.warn("STOCK RESTORE on return refund failed:", stockErr.message);
            }
        }

        order.markModified("return");
        await order.save();

        res.json({
            success: true,
            message: `Return ${action}d successfully`,
            return: order.return,
        });

    } catch (err) {
        console.error("PROCESS RETURN:", err);
        res.status(500).json({ success: false, message: "Failed to process return" });
    }
};

/* ══════════════════════════════════════════════
   REQUEST REPLACEMENT (USER)
   PUT /api/orders/:id/replacement/request
   body: { reason, images? }
══════════════════════════════════════════════ */
export const requestReplacement = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.orderStatus !== "DELIVERED")
            return res.status(400).json({ success: false, message: "Only delivered orders can be replaced" });
        if (order.replacement?.status && order.replacement.status !== "NONE")
            return res.status(400).json({ success: false, message: `Replacement already ${order.replacement.status.toLowerCase()}` });
        if (order.return?.status && !["NONE", "REJECTED"].includes(order.return.status))
            return res.status(400).json({ success: false, message: "Cannot request replacement — return is already in progress" });

        // Urbexon Hour orders cannot be replaced
        if (order.orderMode === "URBEXON_HOUR")
            return res.status(400).json({ success: false, message: "Urbexon Hour orders are non-replaceable" });

        // Check if ANY item is replaceable
        const replaceableItems = order.items.filter(i => i.policy?.isReplaceable === true);
        if (replaceableItems.length === 0)
            return res.status(400).json({ success: false, message: "No items in this order are eligible for replacement" });

        // Check replacement window
        const deliveredAt = order.statusTimeline?.deliveredAt;
        const replacementDays = Math.min(...replaceableItems.map(i => i.policy?.replacementWindow ?? 7));
        if (deliveredAt && Date.now() - new Date(deliveredAt).getTime() > replacementDays * 24 * 60 * 60 * 1000)
            return res.status(400).json({ success: false, message: `Replacement window of ${replacementDays} days has expired` });

        const reason = (req.body.reason || "").trim().slice(0, 500);
        if (!reason) return res.status(400).json({ success: false, message: "Replacement reason is required" });

        order.replacement = {
            status: "REQUESTED",
            reason,
            images: Array.isArray(req.body.images) ? req.body.images.slice(0, 5) : [],
            requestedAt: new Date(),
        };
        order.orderStatus = "REPLACEMENT_REQUESTED";
        order.statusTimeline = { ...order.statusTimeline, replacementRequestedAt: new Date() };
        order.markModified("replacement");
        order.markModified("statusTimeline");
        await order.save();

        res.json({ success: true, message: "Replacement request submitted", replacement: order.replacement });

        // Notifications
        createNotification({
            type: "order",
            title: `Replacement Requested #${order._id.toString().slice(-6).toUpperCase()}`,
            message: `${order.customerName} requested replacement — "${reason.slice(0, 80)}"`,
            icon: "alert",
            link: "/admin/refund-return",
            meta: { orderId: order._id },
        });
        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `🔄 Replacement Requested #${order._id.toString().slice(-6).toUpperCase()} — ${order.customerName}`,
            html: `<p><b>${order.customerName}</b> requested replacement for order <b>#${order._id.toString().slice(-6).toUpperCase()}</b>.</p><p>Reason: ${reason}</p>`,
            label: "Admin/ReplacementRequest",
        });
        if (order.email && !order.email.includes("@placeholder.com")) {
            sendEmail({
                to: order.email,
                subject: `Replacement Request Received — #${order._id.toString().slice(-6).toUpperCase()} | Urbexon`,
                html: `<p>Hi ${order.customerName}, your replacement request has been received. We'll review it within 1-2 business days.</p>`,
                label: "User/ReplacementRequest",
            });
        }
    } catch (err) {
        console.error("REQUEST REPLACEMENT:", err);
        res.status(500).json({ success: false, message: "Failed to submit replacement request" });
    }
};

/* ══════════════════════════════════════════════
   PROCESS REPLACEMENT (ADMIN)
   PUT /api/orders/:id/replacement/process
   body: { action: "approve"|"reject"|"ship"|"deliver", adminNote, trackingUrl }
══════════════════════════════════════════════ */
export const processReplacement = async (req, res) => {
    try {
        const { action, adminNote, trackingUrl } = req.body;
        if (!["approve", "reject", "ship", "deliver"].includes(action))
            return res.status(400).json({ success: false, message: "Invalid action. Use: approve | reject | ship | deliver" });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (!order.replacement?.status || order.replacement.status === "NONE")
            return res.status(400).json({ success: false, message: "No replacement request found on this order" });

        const statusMap = { approve: "APPROVED", reject: "REJECTED", ship: "SHIPPED", deliver: "DELIVERED" };
        order.replacement.status = statusMap[action];
        order.replacement.adminNote = adminNote?.trim() || "";
        order.replacement.processedAt = new Date();
        order.replacement.processedBy = req.user._id;
        if (trackingUrl) order.replacement.trackingUrl = trackingUrl.trim();

        if (action === "approve") order.orderStatus = "REPLACEMENT_APPROVED";
        if (action === "deliver") order.orderStatus = "DELIVERED"; // replacement delivered = order complete

        order.markModified("replacement");
        await order.save();

        // Notify customer
        if (order.email && !order.email.includes("@placeholder.com")) {
            const statusText = { approve: "approved", reject: "rejected", ship: "shipped", deliver: "delivered" }[action];
            sendEmail({
                to: order.email,
                subject: `Replacement ${statusText.charAt(0).toUpperCase() + statusText.slice(1)} — #${order._id.toString().slice(-6).toUpperCase()} | Urbexon`,
                html: `<p>Hi ${order.customerName}, your replacement has been <b>${statusText}</b>.${trackingUrl ? ` <a href="${trackingUrl}">Track here</a>` : ""}${adminNote ? `<br>Note: ${adminNote}` : ""}</p>`,
                label: `User/Replacement_${action}`,
            });
        }

        // WebSocket notify
        publishToUser(order.user, "order_status_updated", {
            orderId: order._id,
            status: order.orderStatus,
            replacementStatus: statusMap[action],
            at: new Date().toISOString(),
        });

        res.json({ success: true, message: `Replacement ${action}d successfully`, replacement: order.replacement });
    } catch (err) {
        console.error("PROCESS REPLACEMENT:", err);
        res.status(500).json({ success: false, message: "Failed to process replacement" });
    }
};

/* ══════════════════════════════════════════════
   GET REPLACEMENT QUEUE (ADMIN)
   GET /api/orders/admin/replacements
══════════════════════════════════════════════ */
export const getReplacementQueue = async (req, res) => {
    try {
        const orders = await Order.find({
            "replacement.status": { $in: ["REQUESTED", "APPROVED", "SHIPPED"] },
        })
            .sort({ "replacement.requestedAt": -1 })
            .select("orderId customerName phone totalAmount items replacement orderStatus createdAt")
            .lean();
        res.json({ success: true, data: orders });
    } catch (err) {
        console.error("GET REPLACEMENT QUEUE:", err);
        res.status(500).json({ success: false, message: "Failed to fetch replacement queue" });
    }
};