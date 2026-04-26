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
import Order, { generateInvoiceNumber } from "../models/Order.js";
import { sendEmail } from "../utils/emailService.js";
import { getOrderStatusEmailTemplate } from "../utils/orderStatusEmail.js";
import { adminOrderEmailHTML } from "../utils/adminOrderEmail.js";
import { calculateOrderPricing, deductStock, markCouponUsed } from "../services/pricing.js";
import { kickoffNewOrder } from "../services/orderKickoff.js";
import { DELIVERY_CONFIG } from "../config/deliveryConfig.js";
import { createShiprocketOrder } from "../utils/Shiprocketservice.js";
import { validateOrderParams } from "../validations/orderValidations.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
        console.error("RAZORPAY CREATE ORDER:", err);
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
                couponId,
                couponCode,
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
                console.error(`[Payment] Amount mismatch: Razorpay=${rpAmount}, Ours=${ourAmount}`);
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
        const order = await Order.create({
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
                ? { code: appliedCoupon.couponCode, discount: appliedCoupon.discount || 0 }
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
            await markCouponUsed(pricing.coupon.couponId, req.user?._id).catch(() => { });
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
        console.error("VERIFY PAYMENT:", err);
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
            console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET not set");
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
            default:
                console.log("[Webhook] Unhandled event:", event);
        }

        res.json({ received: true });
    } catch (err) {
        console.error("WEBHOOK:", err);
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
        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `💰 Refund Request #${order._id.toString().slice(-6).toUpperCase()} — ₹${order.totalAmount}`,
            html: `<p>Refund requested by <b>${safeName}</b>. Amount: ₹${order.totalAmount}</p>`,
            label: "Admin/RefundRequest",
        });
    } catch (err) {
        console.error("REQUEST REFUND:", err);
        res.status(500).json({ success: false, message: "Refund request failed" });
    }
};

/* ════════════════════════════════════════
   5. PROCESS REFUND (ADMIN)
   ✅ Double-refund guard
════════════════════════════════════════ */
export const processRefund = async (req, res) => {
    try {
        const { action, rejectionReason = "" } = req.body;
        const act = action?.toLowerCase?.();
        if (!["approve", "reject"].includes(act))
            return res.status(400).json({ success: false, message: "Invalid action" });

        const order = await Order.findById(req.params.orderId);

        if (!order)
            return res.status(404).json({ success: false, message: "Order not found" });
        if (!order.refund?.requested)
            return res.status(400).json({ success: false, message: "No refund request found" });
        if (order.refund.status !== "REQUESTED")
            return res.status(400).json({
                success: false,
                message: `Refund already ${order.refund.status}`,
            });
        if (order.payment.status === "REFUNDED" || order.refund.status === "PROCESSED")
            return res.status(400).json({ success: false, message: "Refund already processed" });

        if (act === "reject") {
            order.refund.status = "REJECTED";
            order.refund.adminNote = rejectionReason;
            order.refund.processedAt = new Date();
            order.refund.processedBy = req.user._id;
            await order.save();
            return res.json({ success: true, message: "Refund rejected" });
        }

        const refundAmount = Math.round(
            Number(order.refund.amount || order.totalAmount) * 100
        );
        let rpRefund;
        try {
            rpRefund = await razorpay.payments.refund(order.payment.razorpayPaymentId, {
                amount: refundAmount,
                notes: { orderId: order._id.toString(), reason: order.refund.reason },
            });
        } catch (rpErr) {
            return res.status(502).json({
                message: "Razorpay refund failed: " + (rpErr.error?.description || rpErr.message),
            });
        }

        order.refund.status = "PROCESSED";
        order.refund.razorpayRefundId = rpRefund.id;
        order.refund.processedAt = new Date();
        order.refund.processedBy = req.user._id;
        order.payment.status = "REFUNDED";
        await order.save();

        res.json({ success: true, message: "Refund processed", refundId: rpRefund.id });
    } catch (err) {
        console.error("PROCESS REFUND:", err);
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
        console.error("GET REFUND STATUS:", err);
        res.status(500).json({ success: false, message: "Failed to fetch refund status" });
    }
};