/**
 * PaymentController.js — Production v5.1
 * ✅ FIX: createRazorpayOrder — customerName/phone/address NOT required here
 *         create-order only needs items + pincode to calculate amount
 *         Full customer validation happens at /verify step
 * ✅ Prices recalculated from DB — frontend orderData prices IGNORED
 * ✅ Signature verified before any DB write (timingSafeEqual + length guard)
 * ✅ Razorpay minimum amount enforced (₹1 = 100 paise)
 * ✅ Pincode format validation added
 * ✅ orderData null guard added
 */

import Razorpay from "razorpay";
import crypto from "crypto";
import logger from "../utils/logger.js";
import Order, { generateInvoiceNumber } from "../models/Order.js";
import { sendEmail } from "../utils/emailService.js";
import { getOrderStatusEmailTemplate } from "../utils/orderStatusEmail.js";
import { adminOrderEmailHTML } from "../utils/adminOrderEmail.js";
import { calculateOrderPricing, deductStock } from "../services/pricing.js";
import { markCouponUsage } from "../services/couponEngine.js";
import { adminDecideRefund } from "../services/refundEngine.js";
import { kickoffNewOrder } from "../services/orderKickoff.js";
import { DELIVERY_CONFIG } from "../config/deliveryConfig.js";
import { createShiprocketOrder } from "../utils/Shiprocketservice.js";
import { validateOrderParams } from "../validations/orderValidations.js";
import { getCache, setCache } from "../utils/Cache.js";
import { notifyOrderStakeholders } from "../services/orderEngine.js";
import { createNotification } from "./admin/notificationController.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getClientIp = (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress || "";

/* ════════════════════════════════════════
   1. CREATE RAZORPAY ORDER
   ✅ FIX: Only validates items + pincode for amount calculation
   ✅ customerName/phone/address NOT needed here — only at /verify
   Frontend sends items → backend calculates amount
════════════════════════════════════════ */
export const createRazorpayOrder = async (req, res) => {
    try {
        const {
            items,
            currency = "INR",
            deliveryType,
            pincode,
            state,
            couponId,
            couponCode,
            latitude,
            longitude,
        } = req.body;

        if (!items?.length)
            return res.status(400).json({ success: false, message: "Cart is empty" });
        if (items.length > 20)
            return res.status(400).json({ success: false, message: "Cart cannot exceed 20 items" });

        if (pincode && !/^\d{6}$/.test(String(pincode).trim()))
            return res.status(400).json({ success: false, message: "Invalid pincode — must be 6 digits" });

        // ✅ FIX: Use calculateOrderPricing directly — skip validateOrderParams
        // validateOrderParams requires customerName/phone/address which we don't have yet
        // Those are validated at /verify step when the actual order is created
        // Here we only need: item prices + delivery charge + platform fee = total amount for Razorpay
        let pricing;
        try {
            pricing = await calculateOrderPricing(items, "RAZORPAY", {
                deliveryType: deliveryType || "ECOMMERCE_STANDARD",
                distanceKm: 0,
                pincode,
                state,
                couponId,
                couponCode,
                userId: req.user?._id,
            });
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const { finalTotal, itemsTotal, deliveryCharge, platformFee } = pricing;

        const amountPaise = Math.round(finalTotal * 100);
        if (amountPaise < 100) {
            return res.status(400).json({
                success: false,
                message: "Order total must be at least ₹1 to proceed with online payment.",
            });
        }

        const rpOrder = await razorpay.orders.create({
            amount: amountPaise,
            currency,
            receipt: `rcpt_${Date.now()}`,
        });

        res.json({
            id: rpOrder.id,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            pricing: {
                itemsTotal,
                deliveryCharge,
                platformFee,
                finalTotal,
                freeDeliveryThreshold: DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD,
            },
        });
    } catch (err) {
        logger.error("RAZORPAY CREATE ORDER", { message: err.message, stack: err.stack });
        res.status(500).json({ success: false, message: "Failed to create payment order" });
    }
};

/* ════════════════════════════════════════
   2. VERIFY PAYMENT + CREATE ORDER
   ✅ Full validation here — customerName, phone, address all required
   ✅ Prices recalculated from DB
   ✅ Signature verified FIRST
════════════════════════════════════════ */
export const verifyPaymentAndCreateOrder = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderData,
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
            return res.status(400).json({ success: false, message: "Missing payment credentials" });

        // ✅ Step 1: Verify signature BEFORE any DB operations
        const expectedSig = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const expectedBuf = Buffer.from(expectedSig, "hex");
        const receivedBuf = Buffer.from(razorpay_signature, "hex");

        if (
            expectedBuf.length !== receivedBuf.length ||
            !crypto.timingSafeEqual(expectedBuf, receivedBuf)
        ) {
            return res.status(400).json({ message: "Payment verification failed", success: false });
        }

        if (!orderData || typeof orderData !== "object")
            return res.status(400).json({ success: false, message: "Order data missing or invalid" });

        const {
            items,
            customerName,
            phone,
            email,
            address,
            latitude,
            longitude,
            deliveryType,
            pincode,
            city,
            state,
            couponId,
            couponCode,
        } = orderData;

        if (!items?.length || items.length > 20)
            return res.status(400).json({ message: "Invalid cart", success: false });
        if (!customerName?.trim() || !phone?.trim() || !address?.trim())
            return res.status(400).json({ message: "Customer details missing", success: false });
        if (!/^[6-9]\d{9}$/.test(phone?.trim()))
            return res.status(400).json({ message: "Invalid phone number", success: false });
        if (pincode && !/^\d{6}$/.test(String(pincode).trim()))
            return res.status(400).json({ success: false, message: "Invalid pincode — must be 6 digits" });

        // ✅ Full validation at verify step
        let validation;
        try {
            validation = await validateOrderParams({
                items,
                customerName,
                phone,
                address,
                email,
                pincode,
                paymentMethod: "RAZORPAY",
                deliveryType,
                latitude,
                longitude,
                couponId,
                couponCode,
                userId: req.user?._id,
            });
        } catch (valErr) {
            return res.status(400).json({ success: false, message: valErr.message });
        }

        const { realDistanceKm: validatedDistanceKm } = validation;

        // ✅ Step 3: Recalculate pricing from DB
        let pricing;
        try {
            pricing = await calculateOrderPricing(items, "RAZORPAY", {
                deliveryType,
                distanceKm: validatedDistanceKm,
                pincode,
                state,
                couponId,
                couponCode,
                // BUG FIX: userId was never passed here, so the per-user
                // usage-limit check (and any state/userId-scoped targeting)
                // was silently skipped for every Razorpay verify — a user
                // could reuse a single-use coupon indefinitely through this
                // path even though the COD path (orderController.js) always
                // passed it correctly.
                userId: req.user?._id,
            });
        } catch (err) {
            return res.status(400).json({ message: err.message, success: false });
        }

        const {
            formattedItems,
            itemsTotal,
            deliveryCharge,
            platformFee,
            finalTotal,
            deliveryType: finalDeliveryType,
            deliveryProvider,
            deliveryETA,
            distanceKm: finalDistanceKm,
            coupon: appliedCoupon,
        } = pricing;

        // ✅ Step 4: Verify amount matches (₹1 = 100 paise tolerance)
        let rpOrder;
        try {
            rpOrder = await razorpay.orders.fetch(razorpay_order_id);
        } catch {
            console.warn("[Payment] Could not fetch Razorpay order for amount verification");
        }

        if (rpOrder) {
            const rpAmount = rpOrder.amount;
            const ourAmount = Math.round(finalTotal * 100);
            if (Math.abs(rpAmount - ourAmount) > 100) {
                logger.error("[Payment] Amount mismatch", { razorpayAmount: rpAmount, ourAmount });
                return res.status(400).json({
                    message: "Payment amount mismatch. Please contact support.",
                    success: false,
                });
            }
        }

        // ✅ Idempotency check
        const existingOrder = await Order.findOne({
            "payment.razorpayPaymentId": razorpay_payment_id,
        }).lean();
        if (existingOrder) {
            return res.json({
                success: true,
                orderId: existingOrder._id,
                invoiceNumber: existingOrder.invoiceNumber,
                orderStatus: existingOrder.orderStatus,
                refund: existingOrder.refund || null,
                message: "Order already created for this payment",
                duplicate: true,
            });
        }

        const invoiceNumber = await generateInvoiceNumber();

        // ✅ Step 5: Create order with server-calculated prices
        let order;
        try {
            order = await Order.create({
            user: req.user._id,
            invoiceNumber,
            items: formattedItems,
            customerName: customerName.trim().slice(0, 100),
            phone: phone.trim(),
            email: email?.trim().toLowerCase() || "",
            address: address.trim().slice(0, 500),
            city: city?.trim().slice(0, 100) || "",
            state: state?.trim().slice(0, 100) || "",
            pincode: pincode?.trim() || "",
            totalAmount: finalTotal,
            platformFee,
            deliveryCharge,
            delivery: {
                type: finalDeliveryType,
                distanceKm: finalDistanceKm,
                provider: deliveryProvider,
                eta: deliveryETA,
            },
            latitude,
            longitude,
            coupon: appliedCoupon
                ? { code: appliedCoupon.couponCode, discount: appliedCoupon.discount || 0, couponId: appliedCoupon.couponId }
                : undefined,
            orderMode: finalDeliveryType === "URBEXON_HOUR" ? "URBEXON_HOUR" : "ECOMMERCE",
            vendorId: formattedItems[0]?.vendorId || null,
            orderStatus: "CONFIRMED",
            statusTimeline: { placedAt: new Date(), confirmedAt: new Date() },
            payment: {
                method: "RAZORPAY",
                status: "PAID",
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                paidAt: new Date(),
            },
            paymentLogs: [{
                event: "PAYMENT_VERIFIED",
                amount: finalTotal,
                method: "RAZORPAY",
                paymentId: razorpay_payment_id,
                meta: { itemsTotal, deliveryCharge },
                at: new Date(),
            }],
            });
        } catch (createErr) {
            // RACE FIX: the idempotency check above (Order.findOne by
            // razorpayPaymentId) is read-then-write — two near-simultaneous
            // verify calls for the same payment could both pass that check
            // before either Order.create() commits. The unique index on
            // payment.razorpayPaymentId then makes the SECOND create()
            // throw E11000 — previously uncaught, falling into the generic
            // 500 handler and telling the second caller "order creation
            // failed" even though payment was already captured and an
            // order DOES exist. Detect the duplicate-key case specifically
            // and return the order that actually won the race instead.
            if (createErr?.code === 11000) {
                const winner = await Order.findOne({ "payment.razorpayPaymentId": razorpay_payment_id }).lean();
                if (winner) {
                    return res.json({
                        success: true,
                        orderId: winner._id,
                        invoiceNumber: winner.invoiceNumber,
                        orderStatus: winner.orderStatus,
                        refund: winner.refund || null,
                        message: "Order already created for this payment",
                        duplicate: true,
                    });
                }
            }
            throw createErr;
        }

        // ✅ Step 6: Deduct stock
        try {
            await deductStock(formattedItems);
        } catch (stockErr) {
            const now = new Date();
            const cancelReason = stockErr.message || "Out of stock during checkout";

            try {
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            orderStatus: "CANCELLED",
                            cancellationReason: cancelReason,
                            "statusTimeline.cancelledAt": now,
                            refund: {
                                requested: true,
                                requestedAt: now,
                                reason: cancelReason,
                                status: "PROCESSING",
                                amount: finalTotal,
                            },
                        },
                        $push: {
                            paymentLogs: {
                                event: "INVENTORY_FAILED",
                                amount: finalTotal,
                                method: "RAZORPAY",
                                paymentId: razorpay_payment_id,
                                meta: { error: cancelReason },
                                at: now,
                            },
                        },
                    }
                );
            } catch { }

            try {
                const rpRefund = await razorpay.payments.refund(razorpay_payment_id, {
                    amount: Math.round(finalTotal * 100),
                    notes: { orderId: order._id.toString(), reason: "Out of stock" },
                });
                await Order.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            "refund.status": "PROCESSED",
                            "refund.processedAt": new Date(),
                            "refund.razorpayRefundId": rpRefund.id,
                            "payment.status": "REFUNDED",
                        },
                    }
                );
                return res.status(409).json({
                    success: false,
                    message: cancelReason,
                    orderId: order._id,
                    refundStatus: "PROCESSED",
                });
            } catch (refundErr) {
                await Order.updateOne(
                    { _id: order._id },
                    { $set: { "refund.status": "REQUESTED" } }
                ).catch(() => { });
                return res.status(409).json({
                    success: false,
                    message: cancelReason,
                    orderId: order._id,
                    refundStatus: "REQUESTED",
                });
            }
        }

        if (pricing?.coupon?.couponId) {
            await markCouponUsage({
                couponId: pricing.coupon.couponId,
                userId: req.user?._id,
                orderId: order._id,
                module: "ORDER",
                discountAmount: pricing.coupon.discount || 0,
                discountType: pricing.coupon.discountType,
                orderTotal: itemsTotal,
                ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.connection?.remoteAddress || "",
                userAgent: req.headers["user-agent"]?.slice(0, 300) || "",
            }).catch(() => { });
        }

        // ✅ Respond immediately
        res.json({
            success: true,
            orderId: order._id,
            invoiceNumber,
            paymentId: razorpay_payment_id,
            finalTotal,
            deliveryType: finalDeliveryType,
            deliveryETA,
            deliveryProvider,
        });

        // Async tasks after response
        kickoffNewOrder({ order, items: formattedItems }).catch(() => { });

        if (email && !email.includes("@placeholder.com")) {
            const mail = getOrderStatusEmailTemplate({
                customerName,
                orderId: order._id,
                status: "CONFIRMED",
            });
            sendEmail({ to: email, subject: mail.subject, html: mail.html, label: "User/NewOrder" });
        }

        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `✅ Paid Order #${order._id.toString().slice(-6).toUpperCase()} — ₹${finalTotal}`,
            html: adminOrderEmailHTML({ order }),
            label: "Admin/NewOrder",
        });

        // Auto-create Shiprocket shipment for ecommerce orders
        if (finalDeliveryType !== "URBEXON_HOUR") {
            (async () => {
                try {
                    const totalWeight = formattedItems.reduce(
                        (sum, i) => sum + (i.qty || 1) * 250, 0
                    );
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
                    }
                } catch (err) {
                    console.warn("[Shiprocket] Auto-create error:", err.message);
                }
            })();
        }
    } catch (err) {
        logger.error("VERIFY PAYMENT", { message: err.message, stack: err.stack });
        res.status(500).json({ message: "Order creation failed after payment", success: false });
    }
};

/* ════════════════════════════════════════
   3. RAZORPAY WEBHOOK
════════════════════════════════════════ */
export const razorpayWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
            logger.error("[Webhook] RAZORPAY_WEBHOOK_SECRET not set", {});
            return res.status(500).json({ success: false, message: "Webhook not configured" });
        }

        const receivedSig = req.headers["x-razorpay-signature"];
        const rawBody = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(JSON.stringify(req.body));

        const expectedSig = crypto
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex");

        const expectedBuf = Buffer.from(expectedSig, "hex");
        const receivedBuf = Buffer.from(receivedSig || "", "hex");

        if (
            !receivedSig ||
            expectedBuf.length !== receivedBuf.length ||
            !crypto.timingSafeEqual(expectedBuf, receivedBuf)
        ) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }

        const payload = Buffer.isBuffer(req.body)
            ? JSON.parse(req.body.toString())
            : req.body;

        const event = payload.event;
        const paymentEntity = payload.payload?.payment?.entity;
        const refundEntity = payload.payload?.refund?.entity;

        // SECURITY/IDEMPOTENCY: Razorpay redelivers webhook events (documented
        // behavior) and this handler had no dedup — a redelivered event was
        // "idempotent by accident" only because $set writes are harmless to
        // repeat. Guard explicitly by event+entity so a future case that
        // ISN'T naturally idempotent (e.g. appending to a log array) can't
        // silently double-apply.
        const entityId = paymentEntity?.id || refundEntity?.id;
        if (entityId) {
            const dedupKey = `webhook:razorpay:${event}:${entityId}`;
            try {
                const alreadyProcessed = await getCache(dedupKey);
                if (alreadyProcessed) {
                    return res.json({ received: true, duplicate: true });
                }
                await setCache(dedupKey, true, 86400); // 24h — well beyond any realistic redelivery window
            } catch { /* cache unavailable — fall through and process as before (non-fatal) */ }
        }

        switch (event) {
            case "payment.failed":
                await Order.findOneAndUpdate(
                    { "payment.razorpayOrderId": paymentEntity?.order_id },
                    { $set: { "payment.status": "FAILED" } }
                );
                break;
            case "refund.processed":
                await Order.findOneAndUpdate(
                    { "payment.razorpayPaymentId": refundEntity?.payment_id },
                    {
                        $set: {
                            "refund.status": "PROCESSED",
                            "refund.processedAt": new Date(),
                            "refund.razorpayRefundId": refundEntity?.id,
                        },
                    }
                );
                break;
            // RECONCILIATION GAP FIX: Razorpay's refund.create response can
            // return "processing" and settle asynchronously — a refund this
            // system already recorded as PROCESSED (based on the synchronous
            // API response) can still fail later at the bank/network. Without
            // this, that later failure was silently dropped — payment.status
            // stayed "REFUNDED" forever with no signal for anyone to retry or
            // manually settle with the customer. Matched by razorpayRefundId
            // (set at creation time, unique to this exact refund attempt) so
            // an unrelated/older refund on the same order is never clobbered.
            case "refund.failed":
                await Order.findOneAndUpdate(
                    { "refund.razorpayRefundId": refundEntity?.id },
                    {
                        $set: { "refund.status": "FAILED" },
                        $push: {
                            paymentLogs: {
                                event: "REFUND_FAILED",
                                paymentId: refundEntity?.payment_id,
                                meta: { via: "WEBHOOK_ASYNC", refundId: refundEntity?.id },
                                at: new Date(),
                            },
                        },
                    }
                );
                break;
            default:
                console.log("[Webhook] Unhandled event:", event);
        }

        res.json({ received: true });
    } catch (err) {
        logger.error("WEBHOOK", { message: err.message, stack: err.stack });
        res.status(500).json({ success: false, message: "Webhook failed" });
    }
};

/* ════════════════════════════════════════
   4. REQUEST REFUND (USER)
════════════════════════════════════════ */
export const requestRefund = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order)
            return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.payment.method !== "RAZORPAY")
            return res.status(400).json({ success: false, message: "Refund only for online payment" });
        if (order.payment.status !== "PAID")
            return res.status(400).json({ success: false, message: "Payment not completed" });
        if (order.refund?.status && order.refund.status !== "NONE")
            return res.status(400).json({
                message: `Refund already ${order.refund.status.toLowerCase()}`,
            });

        order.refund = {
            status: "REQUESTED",
            amount: order.totalAmount,
            reason: (req.body.reason || "Customer request").trim().slice(0, 500),
            requested: true,
            requestedAt: new Date(),
        };
        await order.save();

        res.json({ success: true, message: "Refund request submitted", refund: order.refund });

        const safeName = (order.customerName || "").replace(
            /[<>&"']/g,
            (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]
        );

        // BUG FIX: this used to ONLY send an email — unlike requestReturn/
        // requestReplacement, it never even persisted an admin notification
        // (no createNotification call at all), let alone a live push. Admin
        // had zero in-app visibility into refund requests until now.
        notifyOrderStakeholders(order, "refund_requested", {
            status: order.orderStatus,
            message: `${safeName} requested a refund of ₹${order.totalAmount}.`,
        }).catch((err) => console.warn("[requestRefund] stakeholder notify failed:", err.message));

        createNotification({
            type: "order",
            title: `Refund Requested #${order._id.toString().slice(-6).toUpperCase()}`,
            message: `${safeName} requested a refund of ₹${order.totalAmount}`,
            icon: "alert",
            link: "/admin/refund-return",
            meta: { orderId: order._id },
        });

        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `💰 Refund Request #${order._id.toString().slice(-6).toUpperCase()} — ₹${order.totalAmount}`,
            html: `<p>Refund requested by <b>${safeName}</b>. Amount: ₹${order.totalAmount}</p>`,
            label: "Admin/RefundRequest",
        });
    } catch (err) {
        logger.error("REQUEST REFUND", { message: err.message, stack: err.stack });
        res.status(500).json({ success: false, message: "Refund request failed" });
    }
};

/* ════════════════════════════════════════
   5. PROCESS REFUND (ADMIN)
   Thin HTTP wrapper — kept for API-contract stability even though
   AdminOrders.jsx/AdminRefundReturn.jsx call the orderController.js
   twin of this route instead. Both used to independently read the order,
   check refund.status in JS, then call Razorpay — two live, drifted
   implementations of the same money-moving operation, the exact "3-way
   drift" bug class this codebase's coupon engine was rebuilt to avoid
   (see couponEngine.js). Now both delegate to refundEngine.js's atomic
   claim-then-call, so they can never diverge or double-refund again.
════════════════════════════════════════ */
export const processRefund = async (req, res) => {
    try {
        const { action, rejectionReason = "" } = req.body;
        const act = action?.toLowerCase?.();
        if (!["approve", "reject"].includes(act))
            return res.status(400).json({ success: false, message: "Invalid action" });

        const result = await adminDecideRefund({
            orderId: req.params.orderId,
            action: act,
            adminId: req.user._id,
            ip: getClientIp(req),
            adminNote: rejectionReason,
        });

        if (!result.success) return res.status(result.status || 400).json({ success: false, message: result.message });
        if (act === "reject") return res.json({ success: true, message: "Refund rejected" });
        return res.json({ success: true, message: "Refund processed", refundId: result.refundId });
    } catch (err) {
        logger.error("PROCESS REFUND", { message: err.message, stack: err.stack });
        res.status(500).json({ success: false, message: "Failed to process refund" });
    }
};

/* ════════════════════════════════════════
   6. GET REFUND STATUS
════════════════════════════════════════ */
export const getRefundStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .select("refund user payment orderStatus")
            .lean();
        if (!order)
            return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        res.json({
            refund: order.refund || { status: "NONE" },
            orderStatus: order.orderStatus,
            paymentStatus: order.payment?.status,
            paymentMethod: order.payment?.method,
        });
    } catch (err) {
        logger.error("GET REFUND STATUS", { message: err.message, stack: err.stack });
        res.status(500).json({ success: false, message: "Failed to fetch refund status" });
    }
};