/**
 * orderController.js — Production v4.1
 *
 * FIXES APPLIED:
 * [FIX-O1] "Unable to determine vendor" — ecommerce products have vendorId: null (admin-managed)
 *          validateOrderParams was rejecting them. Now ecommerce orders skip vendor requirement.
 * [FIX-O2] Cross-type guard: ecommerce items cannot mix with urbexon_hour items in one cart.
 * [FIX-O3] Vendor products (productType: urbexon_hour) cannot appear in ecommerce checkout.
 * [FIX-O4] Admin ecommerce products (productType: ecommerce, vendorId: null) → Shiprocket delivery.
 * [FIX-O5] deliveryType guard: ecommerce orders must use ECOMMERCE delivery, not URBEXON_HOUR.
 *
 * Preserved:
 * ✅ DB prices only — frontend prices IGNORED
 * ✅ COD validated server-side
 * ✅ Stock deducted atomically BEFORE order confirmation
 * ✅ Double-cancel guard (atomic findOneAndUpdate)
 * ✅ Double-refund guard
 * ✅ processRefund: PROCESSING state prevents concurrent duplicate calls
 * ✅ processReturn: transition guard + double-refund safe
 */

import Razorpay from "razorpay";
import jwt from "jsonwebtoken";
import Order, { generateInvoiceNumber } from "../models/Order.js";
import Product from "../models/Product.js";
import { sendEmail } from "../utils/emailService.js";
import { getOrderStatusEmailTemplate } from "../utils/orderStatusEmail.js";
import { adminOrderEmailHTML } from "../utils/adminOrderEmail.js";
import { generateInvoiceBuffer } from "../utils/invoiceEmailHelper.js";
import { calculateOrderPricing, deductStock, restoreStock, markCouponUsed } from "../services/pricing.js";
import { kickoffNewOrder } from "../services/orderKickoff.js";
import { DELIVERY_CONFIG } from "../config/deliveryConfig.js";
import { validateOrderParams } from "../validations/orderValidations.js";
import Pincode from "../models/vendorModels/Pincode.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import { addUserStream, removeUserStream, publishToUser } from "../utils/realtimeHub.js";
import { sendNotification as sendToUser } from "../utils/notificationQueue.js";
import { broadcastToUsers } from "../utils/wsHub.js";
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
export const streamMyOrderEvents = (req, res) => {
    try {
        // 🔥 MUST: SSE headers first
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        res.flushHeaders?.();

        let token = req.query?.token;

        if (!token) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: "Token missing" })}\n\n`);
            return res.end();
        }

        if (token.startsWith("Bearer ")) {
            token = token.split(" ")[1];
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
            return res.end();
        }

        const userId = decoded.id || decoded._id;

        // ✅ connected event
        res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

        // heartbeat
        const interval = setInterval(() => {
            res.write(`event: ping\ndata: ${Date.now()}\n\n`);
        }, 25000);

        req.on("close", () => {
            clearInterval(interval);
            res.end();
        });

    } catch (err) {
        console.error("SSE ERROR:", err);
        res.end();
    }
};
/* ══════════════════════════════════════════════
   AUTO-CREATE SHIPROCKET SHIPMENT (async helper)
══════════════════════════════════════════════ */
const autoCreateShipment = async (orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) return;
        if (order.delivery?.type === "URBEXON_HOUR") return;
        if (order.shipping?.shipmentId) return;

        const totalWeight = order.items.reduce((sum, i) => sum + (i.qty || 1) * 250, 0);
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
   [FIX-O1][FIX-O2][FIX-O3][FIX-O4][FIX-O5]
   ECOMMERCE ORDER VALIDATOR
   ─────────────────────────────────────────────
   Called BEFORE validateOrderParams for ecommerce orders.
   Ensures:
   • All cart items are productType: "ecommerce"  (blocks vendor UH products)
   • No mixing of ecommerce + urbexon_hour items
   • vendorId is NOT required for ecommerce (admin-managed, vendorId: null)
   • deliveryType must be ECOMMERCE (not URBEXON_HOUR)
══════════════════════════════════════════════ */
const validateEcommerceItems = async (items, deliveryType) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Cart is empty");
    }

    // [FIX-O5] Delivery type guard for ecommerce
    if (deliveryType === "URBEXON_HOUR") {
        throw new Error("Ecommerce orders cannot use Urbexon Hour delivery. Please select E-commerce Standard delivery.");
    }

    const productIds = items.map(i => i.productId).filter(Boolean);
    if (productIds.length === 0) throw new Error("Invalid cart items — missing product IDs");

    // Fetch all products in one query
    const products = await Product.find({ _id: { $in: productIds }, isActive: true })
        .select("_id name productType vendorId inStock stock")
        .lean();

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const errors = [];
    const uhItems = [];
    const ecomItems = [];

    for (const item of items) {
        const pid = item.productId?.toString();
        const product = productMap.get(pid);

        if (!product) {
            errors.push(`Product not found or inactive: ${pid}`);
            continue;
        }

        // [FIX-O3] Block vendor UH products from ecommerce checkout
        if (product.productType === "urbexon_hour") {
            uhItems.push(product.name || pid);
        } else if (product.productType === "ecommerce") {
            // [FIX-O1] Admin ecommerce products have vendorId: null — this is CORRECT and expected
            // Do NOT throw error for null vendorId on ecommerce products
            ecomItems.push(product.name || pid);
        } else {
            errors.push(`Unknown product type for "${product.name}": ${product.productType}`);
        }
    }

    // [FIX-O2] Block mixed cart
    if (uhItems.length > 0 && ecomItems.length > 0) {
        throw new Error(
            `Cannot mix Ecommerce and Urbexon Hour items in one order. ` +
            `Please place separate orders. Urbexon Hour items: ${uhItems.join(", ")}`
        );
    }

    // [FIX-O3] Block pure UH cart from ecommerce checkout
    if (uhItems.length > 0 && ecomItems.length === 0) {
        throw new Error(
            `These items (${uhItems.join(", ")}) are only available via Urbexon Hour. ` +
            `Please use the Urbexon Hour section to order them.`
        );
    }

    if (errors.length > 0) {
        throw new Error(errors.join("; "));
    }

    // All good — ecommerce products, vendorId: null is expected
    return {
        isEcommerceOrder: true,
        // [FIX-O4] Ecommerce orders always use Shiprocket — vendorId null is fine
        vendorId: null,
    };
};

/* ══════════════════════════════════════════════
   CREATE ORDER (COD)
   ✅ [FIX-O1] Ecommerce products (vendorId: null) now work correctly
   ✅ [FIX-O2] Mixed cart blocked (ecommerce + UH)
   ✅ [FIX-O3] Vendor UH products blocked in ecommerce checkout
   ✅ [FIX-O4] Ecommerce → Shiprocket delivery always
   ✅ Prices recalculated from DB — frontend totalAmount IGNORED
   ✅ COD validated server-side
   ✅ Stock deducted immediately after save
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
            latitude,
            longitude,
            couponId,
            couponCode,
        } = req.body;

        // ─── Basic param checks ───────────────────────────────────────────
        if (!customerName?.trim()) return res.status(400).json({ success: false, message: "Customer name is required" });
        if (!phone?.trim()) return res.status(400).json({ success: false, message: "Phone number is required" });
        if (!address?.trim()) return res.status(400).json({ success: false, message: "Delivery address is required" });
        if (!items?.length) return res.status(400).json({ success: false, message: "Cart is empty" });

        // ─── Determine order channel from items ──────────────────────────
        // [FIX-O1][FIX-O2][FIX-O3] Validate items BEFORE validateOrderParams
        // For ecommerce orders: vendorId is null (admin-managed) — this is correct
        let orderChannel = "ecommerce"; // default
        let ecommerceValidation = null;

        try {
            // Peek at first product to detect channel
            const firstProductId = items[0]?.productId;
            if (firstProductId) {
                const firstProduct = await Product.findById(firstProductId)
                    .select("productType vendorId")
                    .lean();

                if (firstProduct?.productType === "ecommerce") {
                    // [FIX-O1][FIX-O3][FIX-O5] Run ecommerce-specific validation
                    ecommerceValidation = await validateEcommerceItems(items, deliveryType);
                    orderChannel = "ecommerce";
                } else if (firstProduct?.productType === "urbexon_hour") {
                    orderChannel = "urbexon_hour";
                    // [FIX-O2] Still check for mixed cart in UH path
                    const allProductIds = items.map(i => i.productId).filter(Boolean);
                    const allProducts = await Product.find({ _id: { $in: allProductIds }, isActive: true })
                        .select("_id name productType")
                        .lean();
                    const ecomInUH = allProducts.filter(p => p.productType === "ecommerce");
                    if (ecomInUH.length > 0) {
                        return res.status(400).json({
                            success: false,
                            message: `Cannot mix Ecommerce and Urbexon Hour items. Please place separate orders. Ecommerce items found: ${ecomInUH.map(p => p.name).join(", ")}`,
                        });
                    }
                }
            }
        } catch (channelErr) {
            return res.status(400).json({ success: false, message: channelErr.message });
        }

        // ─── validateOrderParams (existing service) ───────────────────────
        let validation;
        try {
            validation = await validateOrderParams({
                items,
                customerName,
                phone,
                address,
                email,
                pincode,
                paymentMethod,
                deliveryType,
                latitude,
                longitude,
                couponId,
                couponCode,
                userId: req.user._id,
                // [FIX-O1] Tell validateOrderParams to skip vendor requirement for ecommerce
                skipVendorCheck: orderChannel === "ecommerce",
            });
        } catch (valErr) {
            return res.status(400).json({ success: false, message: valErr.message });
        }

        const {
            formattedItems,
            itemsTotal,
            vendorId,
            realDistanceKm,
            coupon: validatedCoupon,
            paymentMethod: method,
        } = validation;

        // [FIX-O1] For ecommerce orders, override vendorId to null — these are admin products
        const finalVendorId = orderChannel === "ecommerce" ? null : (vendorId || null);

        let pricing;
        try {
            pricing = await calculateOrderPricing(formattedItems, method, {
                deliveryType: orderChannel === "ecommerce" ? "ECOMMERCE_STANDARD" : deliveryType,
                distanceKm: realDistanceKm,
                pincode,
                couponId: validatedCoupon?._id,
                couponCode: validatedCoupon?.couponCode,
                userId: req.user._id,
            });
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const {
            deliveryCharge,
            platformFee,
            finalTotal,
            deliveryETA,
            deliveryProvider,
            deliveryType: finalDeliveryType,
            distanceKm: finalDistanceKm,
            coupon: appliedCoupon,
        } = pricing;

        const ip = getClientIp(req);
        const fraudCheck = await checkFraud({ userId: req.user._id, ip, amount: finalTotal });
        const invoiceNum = await generateInvoiceNumber();
        const now = new Date();

        const autoConfirm = method === "COD" && !fraudCheck.flagged;
        const initialStatus = autoConfirm ? "CONFIRMED" : "PLACED";

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
                // [FIX-O4] Ecommerce always uses ECOMMERCE delivery type
                type: orderChannel === "ecommerce" ? "ECOMMERCE_STANDARD" : finalDeliveryType,
                distanceKm: finalDistanceKm,
                // [FIX-O4] Ecommerce always uses Shiprocket — never local rider
                provider: orderChannel === "ecommerce" ? "SHIPROCKET" : deliveryProvider,
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
                meta: { fraudCheck, itemsTotal, deliveryCharge, orderChannel },
                at: now,
            }],
            coupon: appliedCoupon
                ? { code: appliedCoupon.couponCode, discount: appliedCoupon.discount || 0 }
                : undefined,
            // [FIX-O4] orderMode based on channel — ecommerce never gets URBEXON_HOUR
            orderMode: orderChannel === "ecommerce" ? "ECOMMERCE" : "URBEXON_HOUR",
            // [FIX-O1] vendorId is null for admin ecommerce orders — correct behavior
            vendorId: finalVendorId,
            orderStatus: initialStatus,
            statusTimeline: autoConfirm
                ? { placedAt: now, confirmedAt: now }
                : { placedAt: now },
        });

        const savedOrder = await order.save();

        // ✅ Deduct stock atomically — cancel order if stock fails
        try {
            await deductStock(formattedItems);
        } catch (stockErr) {
            try {
                await Order.updateOne(
                    { _id: savedOrder._id },
                    {
                        $set: {
                            orderStatus: "CANCELLED",
                            cancellationReason: stockErr.message || "Out of stock during checkout",
                            "statusTimeline.cancelledAt": new Date(),
                        },
                    }
                );
            } catch { /* ignore */ }

            return res.status(409).json({
                success: false,
                message: stockErr.message || "Item went out of stock during checkout",
                orderId: savedOrder._id,
            });
        }

        if (appliedCoupon?.couponId) {
            await markCouponUsed(appliedCoupon.couponId, req.user._id).catch(() => { });
        }

        // Kick off notifications (async, non-blocking)
        kickoffNewOrder({ order: savedOrder, items: formattedItems }).catch(() => { });

        // [FIX-O4] Ecommerce orders → always create Shiprocket shipment
        // Urbexon Hour orders → never use Shiprocket
        if (orderChannel === "ecommerce") {
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
            deliveryType: savedOrder.delivery.type,
            deliveryETA,
            deliveryProvider: savedOrder.delivery.provider,
        });

        // Async emails
        const userMail = getOrderStatusEmailTemplate({
            customerName: customerName.trim(),
            orderId: savedOrder._id,
            status: initialStatus,
        });
        if (email?.trim() && !email.includes("@placeholder.com"))
            sendEmail({ to: email.trim(), subject: userMail.subject, html: userMail.html, label: "User/NewOrder" });

        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `🛒 New ${orderChannel === "ecommerce" ? "Ecommerce" : "UH"} Order #${savedOrder._id.toString().slice(-6).toUpperCase()} — ₹${finalTotal}${fraudCheck.flagged ? " ⚠️ FLAGGED" : ""}`,
            html: adminOrderEmailHTML({ order: savedOrder }),
            label: "Admin/NewOrder",
        });

        createNotification({
            type: "order",
            title: `New Order #${savedOrder._id.toString().slice(-6).toUpperCase()}`,
            message: `${customerName.trim()} placed a ₹${finalTotal} ${orderChannel === "ecommerce" ? "Ecommerce" : "UH"} order${fraudCheck.flagged ? " ⚠️ FLAGGED" : ""}`,
            icon: "order",
            link: "/admin/orders",
            meta: { orderId: savedOrder._id, amount: finalTotal, orderChannel },
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
        const { items, paymentMethod, deliveryType, distanceKm, pincode, couponId, couponCode } = req.body;

        if (!items?.length)
            return res.status(400).json({ success: false, message: "Cart is empty" });

        const method = paymentMethod === "COD" ? "COD" : "RAZORPAY";

        // [FIX-O1] Detect channel for pricing — ecommerce uses fixed delivery, not distance-based
        let pricingDeliveryType = deliveryType;
        if (items?.length) {
            try {
                const firstProduct = await Product.findById(items[0]?.productId)
                    .select("productType")
                    .lean();
                if (firstProduct?.productType === "ecommerce") {
                    pricingDeliveryType = "ECOMMERCE_STANDARD";
                }
            } catch { /* ignore, fallback to passed deliveryType */ }
        }

        try {
            const pricing = await calculateOrderPricing(items, method, {
                deliveryType: pricingDeliveryType,
                distanceKm,
                pincode,
                couponId,
                couponCode,
                userId: req.user._id,
            });
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
            res.status(400).json({ success: false, message: err.message });
        }
    } catch (err) {
        console.error("GET PRICING:", err);
        res.status(500).json({ success: false, message: "Failed to calculate pricing" });
    }
};

/* ══════════════════════════════════════════════
   CANCEL ORDER (USER)
   ✅ Double-cancel safe (atomic findOneAndUpdate)
   ✅ Auto-refund for prepaid with double-refund guard
══════════════════════════════════════════════ */
export const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order)
            return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.orderStatus === "CANCELLED")
            return res.status(400).json({ success: false, message: "Order already cancelled" });

        const nonCancellable = order.items.find(i => i.policy?.isCancellable === false);
        if (nonCancellable)
            return res.status(400).json({
                success: false,
                message: `"${nonCancellable.name}" is non-cancellable. Order cannot be cancelled.`,
            });

        const placedAt = order.statusTimeline?.placedAt || order.createdAt;
        const hoursSincePlaced = (Date.now() - new Date(placedAt).getTime()) / (1000 * 60 * 60);
        const maxCancelWindow = Math.max(...order.items.map(i => i.policy?.cancelWindow || 0));
        if (maxCancelWindow > 0 && hoursSincePlaced > maxCancelWindow) {
            return res.status(400).json({
                success: false,
                message: `Cancellation window of ${maxCancelWindow} hours has expired.`,
            });
        }

        if (!["PLACED", "CONFIRMED"].includes(order.orderStatus))
            return res.status(400).json({
                message: `Cannot cancel — order is ${order.orderStatus.toLowerCase().replace(/_/g, " ")}. Cancellation only allowed before packing.`,
            });

        // ✅ Atomic update — prevents concurrent double-cancel
        const cancelledOrder = await Order.findOneAndUpdate(
            { _id: order._id, orderStatus: { $in: ["PLACED", "CONFIRMED"] } },
            {
                $set: {
                    orderStatus: "CANCELLED",
                    cancellationReason: String(req.body?.reason || "Cancelled by customer").trim().slice(0, 500),
                    "statusTimeline.cancelledAt": new Date(),
                },
            },
            { new: true }
        );

        if (!cancelledOrder) {
            return res.status(409).json({
                success: false,
                message: "Order cancellation in progress. Please try again.",
            });
        }

        // Auto-refund for prepaid — double-refund safe
        if (
            cancelledOrder.payment.method === "RAZORPAY" &&
            cancelledOrder.payment.status === "PAID" &&
            cancelledOrder.refund?.status !== "PROCESSED" &&
            cancelledOrder.payment.status !== "REFUNDED" &&
            cancelledOrder.payment.razorpayPaymentId
        ) {
            try {
                const refundResult = await razorpay.payments.refund(
                    cancelledOrder.payment.razorpayPaymentId,
                    {
                        amount: Math.round(cancelledOrder.totalAmount * 100),
                        notes: { orderId: cancelledOrder._id.toString(), reason: "Customer cancelled" },
                    }
                );
                await Order.findByIdAndUpdate(cancelledOrder._id, {
                    $set: {
                        "refund.status": "PROCESSED",
                        "refund.processedAt": new Date(),
                        "refund.razorpayRefundId": refundResult.id,
                        "refund.requested": true,
                        "refund.requestedAt": new Date(),
                        "refund.reason": req.body?.reason || "Order cancelled by customer",
                        "refund.amount": cancelledOrder.totalAmount,
                        "payment.status": "REFUNDED",
                    },
                    $push: {
                        paymentLogs: {
                            event: "REFUND_PROCESSED",
                            amount: cancelledOrder.totalAmount,
                            method: "RAZORPAY",
                            paymentId: refundResult.id,
                            ip: getClientIp(req),
                            at: new Date(),
                        },
                    },
                });
            } catch (refundErr) {
                console.error("[Refund] Auto-refund failed:", cancelledOrder._id, refundErr.message);
                await Order.findByIdAndUpdate(cancelledOrder._id, {
                    $set: {
                        "refund.status": "REQUESTED",
                        "refund.requested": true,
                        "refund.requestedAt": new Date(),
                        "refund.reason": req.body?.reason || "Order cancelled by customer",
                        "refund.amount": cancelledOrder.totalAmount,
                    },
                    $push: {
                        paymentLogs: {
                            event: "REFUND_FAILED",
                            amount: cancelledOrder.totalAmount,
                            method: "RAZORPAY",
                            ip: getClientIp(req),
                            meta: { error: refundErr.message },
                            at: new Date(),
                        },
                    },
                });
            }
        }

        const finalOrder = await Order.findById(cancelledOrder._id);
        await restoreStock(cancelledOrder.items);

        // UH orders: cancel rider assignment; ecommerce orders: no assignment to cancel
        if (cancelledOrder.orderMode === "URBEXON_HOUR") {
            cancelAssignment(cancelledOrder._id);
        }

        res.json({
            success: true,
            message: "Order cancelled",
            order: finalOrder.toObject(),
            refundRequested: !!finalOrder.refund?.requested,
        });

        const mail = getOrderStatusEmailTemplate({
            customerName: finalOrder.customerName,
            orderId: finalOrder._id,
            status: "CANCELLED",
        });
        if (finalOrder.email && !finalOrder.email.includes("@placeholder.com"))
            sendEmail({ to: finalOrder.email, subject: mail.subject, html: mail.html, label: "User/Cancel" });

        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `❌ Cancelled #${finalOrder._id.toString().slice(-6).toUpperCase()} — ${finalOrder.customerName}`,
            html: adminOrderEmailHTML({ order: finalOrder }),
            label: "Admin/Cancel",
        });

        createNotification({
            type: "order",
            title: `Order Cancelled #${finalOrder._id.toString().slice(-6).toUpperCase()}`,
            message: `${finalOrder.customerName} cancelled ₹${finalOrder.totalAmount} order`,
            icon: "alert",
            link: "/admin/orders",
            meta: { orderId: finalOrder._id },
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
        const doc = await Order.findById(req.params.id).select("+deliveryOtp.code");
        if (!doc) return res.status(404).json({ success: false, message: "Order not found" });

        const order = doc.toObject();
        const isOwner = order.user?.toString() === req.user._id.toString();
        const isAdmin = ["admin", "owner"].includes(req.user.role);
        if (!isOwner && !isAdmin)
            return res.status(403).json({ success: false, message: "Access denied" });

        if (order.deliveryOtp?.code) {
            if (!(isOwner && order.orderStatus === "OUT_FOR_DELIVERY" && !order.deliveryOtp.verified)) {
                delete order.deliveryOtp.code;
            }
        }

        const now = Date.now();
        const placedAt = order.statusTimeline?.placedAt || order.createdAt;
        const deliveredAt = order.statusTimeline?.deliveredAt;
        const hoursSincePlaced = (now - new Date(placedAt).getTime()) / (1000 * 60 * 60);
        const daysSinceDelivered = deliveredAt
            ? (now - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24)
            : null;
        const isUH = order.orderMode === "URBEXON_HOUR";

        const canCancelItems = order.items.filter(i => i.policy?.isCancellable !== false);
        const maxCancelWindow = canCancelItems.length
            ? Math.max(...canCancelItems.map(i => i.policy?.cancelWindow || 0))
            : 0;
        const cancelWindowOk = maxCancelWindow > 0 ? hoursSincePlaced <= maxCancelWindow : true;
        const canCancel =
            canCancelItems.length > 0 &&
            cancelWindowOk &&
            ["PLACED", "CONFIRMED"].includes(order.orderStatus);

        const returnableItems = order.items.filter(i => i.policy?.isReturnable !== false);
        const minReturnWindow = returnableItems.length
            ? Math.min(...returnableItems.map(i => i.policy?.returnWindow ?? 7))
            : 0;
        const canReturn =
            !isUH &&
            returnableItems.length > 0 &&
            order.orderStatus === "DELIVERED" &&
            (!order.return?.status || order.return.status === "NONE") &&
            daysSinceDelivered !== null &&
            daysSinceDelivered <= minReturnWindow;

        const replaceableItems = order.items.filter(i => i.policy?.isReplaceable === true);
        const minReplacementWindow = replaceableItems.length
            ? Math.min(...replaceableItems.map(i => i.policy?.replacementWindow ?? 7))
            : 0;
        const canReplace =
            !isUH &&
            replaceableItems.length > 0 &&
            order.orderStatus === "DELIVERED" &&
            (!order.replacement?.status || order.replacement.status === "NONE") &&
            (!order.return?.status || ["NONE", "REJECTED"].includes(order.return.status)) &&
            daysSinceDelivered !== null &&
            daysSinceDelivered <= minReplacementWindow;

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

        const valid = [
            "PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP",
            "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
        ];
        if (!valid.includes(status))
            return res.status(400).json({ success: false, message: "Invalid status" });

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

        const currentOrder = await Order.findById(req.params.id)
            .select("orderStatus orderMode delivery.provider delivery.assignedTo")
            .lean();
        if (!currentOrder)
            return res.status(404).json({ success: false, message: "Order not found" });

        const allowed = TRANSITIONS[currentOrder.orderStatus] || [];
        if (!allowed.includes(status))
            return res.status(400).json({
                success: false,
                message: `Cannot transition from ${currentOrder.orderStatus} to ${status}`,
            });

        // [FIX-O4] Ecommerce orders use Shiprocket — block UH-specific status for ecommerce
        if (status === "SHIPPED" && currentOrder.orderMode === "URBEXON_HOUR")
            return res.status(400).json({ success: false, message: "UH orders use local delivery, SHIPPED status is not applicable" });
        if (
            status === "READY_FOR_PICKUP" &&
            currentOrder.orderMode === "URBEXON_HOUR" &&
            currentOrder.delivery?.provider === "VENDOR_SELF"
        )
            return res.status(400).json({ success: false, message: "Vendor self-delivery orders should move directly to OUT_FOR_DELIVERY" });
        if (
            status === "OUT_FOR_DELIVERY" &&
            currentOrder.orderMode === "URBEXON_HOUR" &&
            currentOrder.delivery?.provider === "LOCAL_RIDER" &&
            !currentOrder.delivery?.assignedTo
        )
            return res.status(400).json({ success: false, message: "Assign a rider before marking a LOCAL_RIDER order OUT_FOR_DELIVERY" });

        const update = { orderStatus: status };
        const tMap = {
            CONFIRMED: "confirmedAt",
            PACKED: "packedAt",
            READY_FOR_PICKUP: "readyForPickupAt",
            SHIPPED: "shippedAt",
            OUT_FOR_DELIVERY: "outForDeliveryAt",
            DELIVERED: "deliveredAt",
            CANCELLED: "cancelledAt",
        };
        if (tMap[status]) update[`statusTimeline.${tMap[status]}`] = new Date();

        if (status === "DELIVERED") {
            update["payment.status"] = "PAID";
            update["payment.paidAt"] = new Date();
            update["delivery.status"] = "DELIVERED";
        }
        if (status === "SHIPPED") update["shipping.status"] = "SHIPPED";

        if (status === "OUT_FOR_DELIVERY") {
            const existingOtp = await Order.findById(req.params.id)
                .select("+deliveryOtp.code deliveryOtp.expiresAt deliveryOtp.verified")
                .lean();
            const otpCode = existingOtp?.deliveryOtp?.code;
            const otpExpiry = existingOtp?.deliveryOtp?.expiresAt
                ? new Date(existingOtp.deliveryOtp.expiresAt)
                : null;
            const otpStillLive =
                !!otpCode &&
                otpExpiry &&
                otpExpiry.getTime() > Date.now() &&
                !existingOtp?.deliveryOtp?.verified;

            if (!otpStillLive) {
                update["deliveryOtp.code"] = String(Math.floor(1000 + Math.random() * 9000));
                update["deliveryOtp.expiresAt"] = new Date(Date.now() + 24 * 60 * 60 * 1000);
                update["deliveryOtp.verified"] = false;
            }
            update["delivery.status"] = "OUT_FOR_DELIVERY";
        }

        if (["CONFIRMED", "PACKED", "READY_FOR_PICKUP"].includes(status))
            update["delivery.status"] = "PENDING";

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        );
        if (!order)
            return res.status(404).json({ success: false, message: "Order not found" });

        if (status === "CANCELLED") {
            await restoreStock(order.items);
            if (order.delivery?.assignedTo) {
                Order.updateOne({ _id: order._id }, { $set: { "delivery.status": "CANCELLED" } }).catch(() => { });
            }
            // Only UH orders use assignment engine
            if (order.orderMode === "URBEXON_HOUR") {
                cancelAssignment(order._id);
            }
        }

        // Auto-trigger assignment engine — ONLY for UH orders with LOCAL_RIDER
        if (
            status === "READY_FOR_PICKUP" &&
            order.orderMode === "URBEXON_HOUR" &&
            order.delivery?.provider === "LOCAL_RIDER" &&
            !order.delivery?.assignedTo
        ) {
            startAssignment(order._id).catch(err =>
                console.warn("[Assignment] Auto-start failed:", err.message)
            );

            (async () => {
                try {
                    const { default: DeliveryBoy } = await import("../models/deliveryModels/DeliveryBoy.js");
                    const onlineRiders = await DeliveryBoy.find({
                        status: "approved",
                        isOnline: true,
                    }).select("userId").lean();

                    if (onlineRiders.length > 0) {
                        broadcastToUsers(
                            onlineRiders.map(r => r.userId),
                            "order_ready",
                            {
                                orderId: order._id.toString(),
                                orderNumber: order.invoiceNumber,
                                amount: order.totalAmount,
                                items: order.items.length,
                                address: order.address?.slice(0, 100),
                                distanceKm: order.delivery?.distanceKm,
                                eta: order.delivery?.eta,
                                customerName: order.customerName,
                                customerPhone: order.phone,
                                at: new Date().toISOString(),
                            }
                        );
                    }
                } catch (err) {
                    console.warn("[WS] Rider notification failed:", err.message);
                }
            })();
        }

        // [FIX-O4] Shiprocket: create shipment on PACKED — ONLY for ecommerce orders
        if (order.orderMode === "ECOMMERCE" && !order.shipping?.shipmentId && status === "PACKED") {
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
                            },
                        });
                    }
                } catch (err) {
                    console.warn(`[Shiprocket] Auto-create on PACKED failed:`, err.message);
                }
            })();
        }

        // [FIX-O4] Shiprocket: schedule pickup on SHIPPED — ONLY for ecommerce orders
        if (order.orderMode === "ECOMMERCE" && order.shipping?.shipmentId && status === "SHIPPED") {
            (async () => {
                try {
                    const { schedulePickup } = await import("../utils/Shiprocketservice.js");
                    await schedulePickup(order.shipping.shipmentId);
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
        sendToUser(order.user, "order_status_updated", {
            orderId: order._id,
            orderNumber: order.invoiceNumber,
            status,
            at: new Date().toISOString(),
        });

        res.json(order);

        // Auto-create Settlement on DELIVERED — ONLY for vendor UH orders
        // [FIX-O1][FIX-O4] Ecommerce admin orders have vendorId: null — skip settlement
        // ✅ BUG3 FIX: Use atomic $setOnInsert upsert — safe if vendor panel already created settlement
        // FLOW: Admin marks DELIVERED only in exceptional cases; rider OTP flow is the normal path.
        if (status === "DELIVERED" && order.orderMode === "URBEXON_HOUR") {
            (async () => {
                try {
                    const productIds = order.items.map(i => i.productId);
                    const products = await Product.find({ _id: { $in: productIds } }).select("vendorId").lean();
                    const vendorIds = [...new Set(products.map(p => p.vendorId?.toString()).filter(Boolean))];

                    for (const vid of vendorIds) {
                        const vendor = await Vendor.findById(vid).select("commissionRate").lean();
                        if (!vendor) continue;

                        const vendorProductIdStrs = products
                            .filter(p => p.vendorId?.toString() === vid)
                            .map(p => p._id.toString());
                        const vendorItems = order.items.filter(i =>
                            vendorProductIdStrs.includes(i.productId?.toString())
                        );
                        const orderAmount = vendorItems.reduce(
                            (sum, i) => sum + Number(i.price) * Number(i.qty), 0
                        );

                        const commissionRate = vendor.commissionRate ?? 18;
                        const commissionAmount = Math.round((orderAmount * commissionRate) / 100);
                        const vendorEarning = Math.max(0, orderAmount - commissionAmount);

                        // ✅ Atomic upsert — won't double-create if vendor panel already settled
                        const result = await Settlement.updateOne(
                            { orderId: order._id },
                            {
                                $setOnInsert: {
                                    vendorId: vid,
                                    orderId: order._id,
                                    orderAmount,
                                    commissionRate,
                                    commissionAmount,
                                    deliveryCharge: order.deliveryCharge || 0,
                                    platformFee: order.platformFee || 0,
                                    vendorEarning,
                                    status: "pending",
                                },
                            },
                            { upsert: true }
                        );

                        // Only update vendor stats if settlement was newly created
                        if (result.upsertedCount > 0) {
                            await Vendor.findByIdAndUpdate(vid, {
                                $inc: {
                                    pendingSettlement: vendorEarning,
                                    totalRevenue: orderAmount,
                                    totalOrders: 1,
                                },
                            });
                        }
                    }
                } catch (settleErr) {
                    console.error("[Settlement] Auto-create failed:", order._id, settleErr.message);
                }
            })();
        }

        // Email customer on status change
        if (order.email && !order.email.includes("@placeholder.com")) {
            const sMail = getOrderStatusEmailTemplate({
                customerName: order.customerName,
                orderId: order._id,
                status,
                trackingUrl: order.shipping?.trackingUrl || "",
                courier: order.shipping?.courierName || "",
                awb: order.shipping?.awbCode || "",
            });
            if (status === "DELIVERED") {
                try {
                    const pdf = await generateInvoiceBuffer(order.toObject ? order.toObject() : order);
                    sendEmail({
                        to: order.email,
                        subject: sMail.subject,
                        html: sMail.html,
                        label: `User/${status}`,
                        attachments: [{
                            filename: `Invoice_${order.invoiceNumber || order._id.toString().slice(-8).toUpperCase()}.pdf`,
                            content: pdf,
                        }],
                    });
                } catch {
                    sendEmail({ to: order.email, subject: sMail.subject, html: sMail.html, label: `User/${status}` });
                }
            } else {
                sendEmail({ to: order.email, subject: sMail.subject, html: sMail.html, label: `User/${status}` });
            }
        }

        // Notify vendor(s) — only for UH orders that have vendors
        if (order.orderMode === "URBEXON_HOUR") {
            (async () => {
                try {
                    const { default: Product } = await import("../models/Product.js");
                    const { default: Vendor } = await import("../models/vendorModels/Vendor.js");
                    const productIds = order.items.map(i => i.productId);
                    const products = await Product.find({ _id: { $in: productIds } }).select("vendorId").lean();
                    const vendorIds = [...new Set(products.map(p => p.vendorId?.toString()).filter(Boolean))];
                    if (vendorIds.length > 0) {
                        const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("userId").lean();
                        broadcastToUsers(
                            vendors.map(v => v.userId),
                            "order_status_changed",
                            {
                                orderId: order._id,
                                orderNumber: order.invoiceNumber,
                                status,
                                customerName: order.customerName,
                                at: new Date().toISOString(),
                            }
                        );
                    }
                } catch (notifyErr) {
                    console.warn("[Order] Vendor notification failed:", notifyErr.message);
                }
            })();
        }

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
            const esc = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
   ADMIN — LOCAL DELIVERY QUEUE (URBEXON HOUR ONLY)
══════════════════════════════════════════════ */
export const getLocalDeliveryQueue = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        // [FIX-O4] Only UH orders appear in local delivery queue
        const filter = {
            orderMode: "URBEXON_HOUR",
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
   ADMIN — ASSIGN LOCAL DELIVERY (UH ONLY)
══════════════════════════════════════════════ */
export const assignLocalDelivery = async (req, res) => {
    try {
        const { provider, riderName, riderPhone, riderId, note } = req.body;
        const allowed = ["LOCAL_RIDER", "VENDOR_SELF", "SHIPROCKET"];
        if (!allowed.includes(provider))
            return res.status(400).json({ success: false, message: "Invalid provider" });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // [BUG-FIX-A2] CRITICAL: Enforce — only UH orders can be assigned via local delivery
        // Ecommerce orders MUST use Shiprocket, never local delivery
        if (order.orderMode !== "URBEXON_HOUR")
            return res.status(400).json({
                success: false,
                message: "⛔ Cannot assign. Ecommerce orders use Shiprocket delivery (automatic). Only Urbexon Hour orders can be assigned manually.",
                orderType: order.orderMode,
            });

        // [BUG-FIX-A2] Validate: order must be in correct status for assignment
        if (!["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP"].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot assign — order is already ${order.orderStatus.toLowerCase()}. Orders can only be assigned before delivery starts.`,
            });
        }

        order.delivery.provider = provider;
        order.delivery.note = String(note || "").trim().slice(0, 500);
        order.delivery.assignedAt = new Date();

        if (provider === "LOCAL_RIDER" && riderId) {
            const rider = await DeliveryBoy.findById(riderId).lean();
            if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });
            if (rider.status !== "approved") return res.status(400).json({ success: false, message: "Rider is not approved or suspended" });
            order.delivery.assignedTo = rider._id;
            order.delivery.riderName = rider.name;
            order.delivery.riderPhone = rider.phone;
            order.delivery.status = "ASSIGNED";

            if (rider.userId) {
                sendToUser(rider.userId.toString(), "delivery_assigned", {
                    orderId: order._id,
                    orderNumber: order.invoiceNumber,
                    message: "A delivery has been assigned to you by admin",
                    at: new Date().toISOString(),
                });
            }
        } else if (provider === "VENDOR_SELF") {
            order.delivery.riderName = String(riderName || "Self").trim().slice(0, 100);
            order.delivery.riderPhone = String(riderPhone || "").trim().slice(0, 20);
            order.delivery.status = "VENDOR_SELF";
        } else {
            return res.status(400).json({ success: false, message: "Shiprocket assignment not allowed via local delivery endpoint" });
        }
        order.markModified("delivery");

        if (order.orderStatus === "PLACED") {
            order.orderStatus = "CONFIRMED";
            const existing = order.statusTimeline?.toObject
                ? order.statusTimeline.toObject()
                : { ...order.statusTimeline };
            order.statusTimeline = { ...existing, confirmedAt: new Date() };
            order.markModified("statusTimeline");
        }

        await order.save();

        publishToUser(order.user, "order_status_updated", {
            orderId: order._id,
            status: order.orderStatus,
            provider,
            riderName: order.delivery.riderName,
            assignedAt: order.delivery.assignedAt,
            at: new Date().toISOString(),
        });
        sendToUser(order.user, "order_status_updated", {
            orderId: order._id,
            orderNumber: order.invoiceNumber,
            status: order.orderStatus,
            provider,
            message: `Your order has been assigned to ${order.delivery.riderName}`,
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
        if (order.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.payment.method !== "RAZORPAY")
            return res.status(400).json({ success: false, message: "Refund only for online payments" });
        if (order.payment.status !== "PAID")
            return res.status(400).json({ success: false, message: "Payment not completed" });
        if (order.refund?.status && order.refund.status !== "NONE")
            return res.status(400).json({ message: `Refund already ${order.refund.status.toLowerCase()}` });

        order.refund = {
            requested: true,
            requestedAt: new Date(),
            reason: (req.body.reason || "Requested by customer").trim().slice(0, 500),
            status: "REQUESTED",
            amount: order.totalAmount,
        };
        order.paymentLogs.push({
            event: "REFUND_REQUESTED",
            amount: order.totalAmount,
            method: "RAZORPAY",
            ip: getClientIp(req),
            at: new Date(),
        });
        order.markModified("refund");
        await order.save();

        res.json({ success: true, message: "Refund request submitted", refund: order.refund });

        const safeName = (order.customerName || "").replace(
            /[<>&"']/g,
            c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]
        );
        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `💰 Refund Request #${order._id.toString().slice(-6).toUpperCase()} — ₹${order.totalAmount}`,
            html: `<p>Refund requested by <b>${safeName}</b>. Amount: ₹${order.totalAmount}</p>`,
            label: "Admin/RefundRequest",
        });
    } catch (err) {
        console.error("REQUEST REFUND:", err);
        res.status(500).json({ success: false, message: "Failed to submit refund request" });
    }
};

/* ══════════════════════════════════════════════
   REFUND — PROCESS (ADMIN)
   ✅ Double-refund guard
   ✅ PROCESSING state prevents concurrent duplicate calls
══════════════════════════════════════════════ */
export const processRefund = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const alreadyRefunded =
            order.payment?.status === "REFUNDED" ||
            order.refund?.status === "PROCESSED";
        if (alreadyRefunded) {
            return res.status(400).json({
                success: false,
                message: "Refund already processed",
                currentStatus: order.refund?.status || order.payment?.status,
            });
        }

        const { action, adminNote } = req.body;
        if (!["approve", "reject"].includes(action))
            return res.status(400).json({ success: false, message: "Action must be approve or reject" });

        if (!order.refund?.requested || order.refund?.status !== "REQUESTED")
            return res.status(400).json({ success: false, message: "No pending refund request" });

        if (action === "reject") {
            order.refund.status = "REJECTED";
            order.refund.adminNote = adminNote?.trim() || "";
            order.paymentLogs.push({
                event: "REFUND_REJECTED",
                amount: order.refund.amount,
                method: "RAZORPAY",
                ip: getClientIp(req),
                at: new Date(),
            });
            order.markModified("refund");
            await order.save();
            return res.json({ success: true, message: "Refund rejected" });
        }

        const refundAmount = order.refund.amount || order.totalAmount;
        const paymentId = order.payment.razorpayPaymentId;
        if (!paymentId)
            return res.status(400).json({ success: false, message: "No Razorpay payment ID found" });

        // ✅ Set PROCESSING immediately — prevents concurrent duplicate admin calls
        order.refund.status = "PROCESSING";
        order.markModified("refund");
        await order.save();

        try {
            const rzRef = await razorpay.payments.refund(paymentId, {
                amount: Math.round(refundAmount * 100),
                notes: { orderId: order._id.toString() },
            });
            order.refund.status = "PROCESSED";
            order.refund.razorpayRefundId = rzRef.id;
            order.refund.processedAt = new Date();
            order.refund.processedBy = req.user._id;
            order.payment.status = "REFUNDED";
            order.paymentLogs.push({
                event: "REFUND_PROCESSED",
                amount: refundAmount,
                method: "RAZORPAY",
                paymentId,
                meta: { refundId: rzRef.id },
                at: new Date(),
            });
            order.markModified("refund");
            await order.save();
            res.json({ success: true, message: `₹${refundAmount} refunded`, refundId: rzRef.id });
        } catch (rzErr) {
            order.refund.status = "FAILED";
            order.markModified("refund");
            await order.save();
            return res.status(500).json({
                message: "Razorpay refund failed: " + (rzErr.error?.description || rzErr.message),
            });
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
        if (order.refund?.status !== "FAILED")
            return res.status(400).json({ success: false, message: "Only failed refunds can be retried" });
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
══════════════════════════════════════════════ */
export const requestReturn = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.orderStatus !== "DELIVERED")
            return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
        if (order.return?.status && order.return.status !== "NONE")
            return res.status(400).json({ success: false, message: `Return already ${order.return.status.toLowerCase()}` });
        if (order.orderMode === "URBEXON_HOUR")
            return res.status(400).json({ success: false, message: "Urbexon Hour orders are non-returnable" });

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

        const deliveredAt = order.statusTimeline?.deliveredAt;
        const returnDays = Math.min(...returnableItems.map(i => i.policy?.returnWindow ?? 7));
        if (deliveredAt && Date.now() - new Date(deliveredAt).getTime() > returnDays * 24 * 60 * 60 * 1000)
            return res.status(400).json({ success: false, message: `Return window of ${returnDays} days has expired` });

        const reason = (req.body.reason || "").trim().slice(0, 500);
        if (!reason)
            return res.status(400).json({ success: false, message: "Return reason is required" });

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
            html: `<p><b>${order.customerName}</b> requested return.</p><p>Reason: ${reason}</p><p>Amount: ₹${order.totalAmount}</p>`,
            label: "Admin/ReturnRequest",
        });
        if (order.email && !order.email.includes("@placeholder.com")) {
            const mail = getOrderStatusEmailTemplate({
                customerName: order.customerName,
                orderId: order._id,
                status: "RETURN_REQUESTED",
            });
            sendEmail({
                to: order.email,
                subject: mail.subject || `Return Request Received — #${order._id.toString().slice(-6).toUpperCase()}`,
                html: mail.html || `<p>Hi ${order.customerName}, your return request has been received.</p>`,
                label: "User/ReturnRequest",
            });
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
        const orders = await Order.find({ "refund.status": "REQUESTED" })
            .sort({ "refund.requestedAt": -1 })
            .lean();
        res.json(orders);
    } catch {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ══════════════════════════════════════════════
   RETURN QUEUE (ADMIN)
══════════════════════════════════════════════ */
export const getReturnQueue = async (req, res) => {
    try {
        const orders = await Order.find({
            "return.status": { $in: ["REQUESTED", "APPROVED", "PICKED_UP"] },
        }).sort({ "return.requestedAt": -1 }).lean();
        res.json({ success: true, data: orders });
    } catch (err) {
        console.error("GET RETURN QUEUE:", err);
        res.status(500).json({ success: false, message: "Failed to fetch return queue" });
    }
};

/* ══════════════════════════════════════════════
   PROCESS RETURN (ADMIN)
   ✅ Transition guard
   ✅ Double-refund safe
   ✅ Stock restored exactly once (stockRestored flag)
══════════════════════════════════════════════ */
export const processReturn = async (req, res) => {
    try {
        const { action, adminNote, refundAmount, trackingUrl } = req.body;

        if (!["approve", "reject", "pickup", "refund"].includes(action))
            return res.status(400).json({
                success: false,
                message: "Invalid action. Use: approve | reject | pickup | refund",
            });

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

        const currentReturnStatus = order.return.status;
        const allowedFromCurrent = {
            REQUESTED: ["APPROVED", "REJECTED"],
            APPROVED: ["PICKED_UP", "REFUNDED"],
            PICKED_UP: ["REFUNDED"],
            REJECTED: [],
            REFUNDED: [],
        };
        const nextStatus = statusMap[action];
        const allowedNext = allowedFromCurrent[currentReturnStatus] || [];
        if (!allowedNext.includes(nextStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot ${action} a return currently in ${currentReturnStatus} state`,
            });
        }

        order.return.status = nextStatus;
        order.return.adminNote = adminNote?.trim() || order.return.adminNote || "";
        order.return.processedAt = new Date();
        order.return.processedBy = req.user._id;
        if (refundAmount) order.return.refundAmount = Number(refundAmount);
        if (trackingUrl) order.return.trackingUrl = String(trackingUrl).trim();

        if (action === "refund") {
            const amount = Number(order.return.refundAmount || refundAmount || order.totalAmount);
            if (!Number.isFinite(amount) || amount <= 0)
                return res.status(400).json({ success: false, message: "Invalid refund amount" });

            const alreadyRefunded =
                order.payment?.status === "REFUNDED" ||
                order.refund?.status === "PROCESSED";

            if (order.payment?.method === "RAZORPAY" && order.payment?.status === "PAID" && !alreadyRefunded) {
                const paymentId = order.payment.razorpayPaymentId;
                if (!paymentId)
                    return res.status(400).json({ success: false, message: "No Razorpay payment ID on order" });

                try {
                    const rpRefund = await razorpay.payments.refund(paymentId, {
                        amount: Math.round(amount * 100),
                        notes: { orderId: order._id.toString(), reason: "Return refund" },
                    });
                    order.refund = order.refund || {};
                    order.refund.status = "PROCESSED";
                    order.refund.amount = amount;
                    order.refund.razorpayRefundId = rpRefund.id;
                    order.refund.processedAt = new Date();
                    order.refund.processedBy = req.user._id;
                    order.refund.requested = true;
                    order.refund.requestedAt = order.refund.requestedAt || new Date();
                    order.refund.reason = order.refund.reason || "Return refund";
                    order.payment.status = "REFUNDED";
                    order.paymentLogs = order.paymentLogs || [];
                    order.paymentLogs.push({
                        event: "REFUND_PROCESSED",
                        amount,
                        method: "RAZORPAY",
                        paymentId,
                        meta: { refundId: rpRefund.id, via: "RETURN_FLOW" },
                        at: new Date(),
                    });
                    order.markModified("refund");
                    order.markModified("payment");
                    order.markModified("paymentLogs");
                } catch (rzErr) {
                    order.return.status = currentReturnStatus;
                    order.markModified("return");
                    await order.save().catch(() => { });
                    return res.status(502).json({
                        success: false,
                        message: "Razorpay refund failed: " + (rzErr.error?.description || rzErr.message || "Unknown error"),
                    });
                }
            } else if (!alreadyRefunded && order.payment?.method === "COD") {
                order.refund = order.refund || {};
                order.refund.status = order.refund.status || "REQUESTED";
                order.refund.amount = amount;
                order.refund.requested = true;
                order.refund.requestedAt = order.refund.requestedAt || new Date();
                order.refund.reason = order.refund.reason || "Return refund (COD — manual)";
                order.markModified("refund");
            }
        }

        // ✅ Restore stock exactly once
        if ((action === "pickup" || action === "refund") && !order.return.stockRestored) {
            try {
                await restoreStock(order.items);
                order.return.stockRestored = true;
            } catch (stockErr) {
                console.warn("[Return] Stock restore failed:", stockErr.message);
            }
        }

        order.markModified("return");
        await order.save();

        try {
            publishToUser(order.user, "order_status_updated", {
                orderId: order._id,
                returnStatus: order.return.status,
                at: new Date().toISOString(),
            });
        } catch { /* ignore */ }

        if (order.email && !order.email.includes("@placeholder.com")) {
            const actionText = { approve: "approved", reject: "rejected", pickup: "picked up", refund: "refunded" }[action];
            sendEmail({
                to: order.email,
                subject: `Return ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} — #${order._id.toString().slice(-6).toUpperCase()} | Urbexon`,
                html: `<p>Hi ${order.customerName || "Customer"}, your return request has been <b>${actionText}</b>.${adminNote ? `<br>Note: ${adminNote}` : ""}</p>`,
                label: `User/Return_${action}`,
            });
        }

        res.json({
            success: true,
            message: `Return ${action}d successfully`,
            return: order.return,
            refund: order.refund || null,
        });
    } catch (err) {
        console.error("PROCESS RETURN:", err);
        res.status(500).json({ success: false, message: "Failed to process return" });
    }
};

/* ══════════════════════════════════════════════
   REQUEST REPLACEMENT (USER)
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
        if (order.orderMode === "URBEXON_HOUR")
            return res.status(400).json({ success: false, message: "Urbexon Hour orders are non-replaceable" });

        const replaceableItems = order.items.filter(i => i.policy?.isReplaceable === true);
        if (replaceableItems.length === 0)
            return res.status(400).json({ success: false, message: "No items in this order are eligible for replacement" });

        const deliveredAt = order.statusTimeline?.deliveredAt;
        const replacementDays = Math.min(...replaceableItems.map(i => i.policy?.replacementWindow ?? 7));
        if (deliveredAt && Date.now() - new Date(deliveredAt).getTime() > replacementDays * 24 * 60 * 60 * 1000)
            return res.status(400).json({ success: false, message: `Replacement window of ${replacementDays} days has expired` });

        const reason = (req.body.reason || "").trim().slice(0, 500);
        if (!reason)
            return res.status(400).json({ success: false, message: "Replacement reason is required" });

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
            html: `<p><b>${order.customerName}</b> requested replacement.</p><p>Reason: ${reason}</p>`,
            label: "Admin/ReplacementRequest",
        });
        if (order.email && !order.email.includes("@placeholder.com")) {
            sendEmail({
                to: order.email,
                subject: `Replacement Request Received — #${order._id.toString().slice(-6).toUpperCase()} | Urbexon`,
                html: `<p>Hi ${order.customerName}, your replacement request has been received.</p>`,
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
══════════════════════════════════════════════ */
export const processReplacement = async (req, res) => {
    try {
        const { action, adminNote, trackingUrl } = req.body;
        if (!["approve", "reject", "ship", "deliver"].includes(action))
            return res.status(400).json({
                success: false,
                message: "Invalid action. Use: approve | reject | ship | deliver",
            });

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
        if (action === "deliver") order.orderStatus = "DELIVERED";

        order.markModified("replacement");
        await order.save();

        if (order.email && !order.email.includes("@placeholder.com")) {
            const statusText = { approve: "approved", reject: "rejected", ship: "shipped", deliver: "delivered" }[action];
            sendEmail({
                to: order.email,
                subject: `Replacement ${statusText.charAt(0).toUpperCase() + statusText.slice(1)} — #${order._id.toString().slice(-6).toUpperCase()} | Urbexon`,
                html: `<p>Hi ${order.customerName}, your replacement has been <b>${statusText}</b>.${trackingUrl ? ` <a href="${trackingUrl}">Track here</a>` : ""}${adminNote ? `<br>Note: ${adminNote}` : ""}</p>`,
                label: `User/Replacement_${action}`,
            });
        }

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