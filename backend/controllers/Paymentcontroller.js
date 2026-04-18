/**
 * PaymentController.js
 * ✅ Prices recalculated from DB — frontend orderData prices IGNORED
 * ✅ Signature verified before any DB write
 * ✅ WhatsApp completely removed
 */

import Razorpay from "razorpay";
import crypto from "crypto";
import Order, { generateInvoiceNumber } from "../models/Order.js";
import { sendEmail } from "../utils/emailService.js";
import { getOrderStatusEmailTemplate } from "../utils/orderStatusEmail.js";
import { adminOrderEmailHTML } from "../utils/adminOrderEmail.js";
import { calculateOrderPricing, deductStock, markCouponUsed } from "../services/pricing.js";
import { DELIVERY_CONFIG } from "../config/deliveryConfig.js";
import Pincode from "../models/vendorModels/Pincode.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
/* ════════════════════════════════════════
   1. CREATE RAZORPAY ORDER
   Frontend sends items → backend calculates amount
   ✅ Frontend amount completely IGNORED
════════════════════════════════════════ */
export const createRazorpayOrder = async (req, res) => {
    try {
        const { items, currency = "INR", deliveryType, distanceKm, pincode, couponId, couponCode } = req.body;

        if (!items?.length)
            return res.status(400).json({ success: false, message: "Cart is empty" });

        // ✅ Validate pincode for Urbexon Hour before creating payment order
        if (deliveryType === "URBEXON_HOUR" && pincode) {
            const pincodeDoc = await Pincode.findOne({ code: pincode.trim() }).lean();
            if (!pincodeDoc || pincodeDoc.status !== "active")
                return res.status(400).json({ success: false, message: "Urbexon Hour is not available in your area" });
        }

        // ✅ Calculate from DB — ignore frontend amount
        let pricing;
        try {
            pricing = await calculateOrderPricing(items, "RAZORPAY", { deliveryType, distanceKm, pincode, couponId, couponCode, userId: req.user?._id });
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const { finalTotal, itemsTotal, deliveryCharge, platformFee } = pricing;

        const rpOrder = await razorpay.orders.create({
            amount: Math.round(finalTotal * 100),    // ✅ Server calculated
            currency,
            receipt: `rcpt_${Date.now()}`,
        });

        // Return pricing details so frontend can display correctly
        res.json({
            id: rpOrder.id,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            // Pricing breakdown for UI display
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
   ✅ Signature verified FIRST
   ✅ Prices recalculated from DB
   ✅ Frontend orderData prices IGNORED
════════════════════════════════════════ */
export const verifyPaymentAndCreateOrder = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderData,
        } = req.body;

        // ✅ Step 1: Verify signature BEFORE any DB operations
        const expectedSig = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (!razorpay_signature || !crypto.timingSafeEqual(Buffer.from(expectedSig, "hex"), Buffer.from(razorpay_signature, "hex")))
            return res.status(400).json({ message: "Payment verification failed", success: false });

        // ✅ Step 2: Validate customer data
        const { items, customerName, phone, email, address, latitude, longitude, deliveryType, distanceKm, pincode, couponId, couponCode } = orderData;

        if (!items?.length || items.length > 20)
            return res.status(400).json({ message: "Invalid cart", success: false });
        if (!customerName?.trim() || !phone?.trim() || !address?.trim())
            return res.status(400).json({ message: "Customer details missing", success: false });
        if (!/^[6-9]\d{9}$/.test(phone?.trim()))
            return res.status(400).json({ message: "Invalid phone number", success: false });

        // ✅ Step 3: Recalculate pricing from DB (ignore frontend prices completely)
        let pricing;
        try {
            pricing = await calculateOrderPricing(items, "RAZORPAY", { deliveryType, distanceKm, pincode, couponId, couponCode, userId: req.user?._id });
        } catch (err) {
            return res.status(400).json({ message: err.message, success: false });
        }

        const { formattedItems, itemsTotal, deliveryCharge, platformFee, finalTotal, deliveryType: finalDeliveryType, deliveryProvider, deliveryETA, distanceKm: finalDistanceKm, coupon: appliedCoupon } = pricing;

        // ✅ Step 4: Verify Razorpay order amount matches our calculated amount
        // Fetch the Razorpay order to compare
        let rpOrder;
        try {
            rpOrder = await razorpay.orders.fetch(razorpay_order_id);
        } catch {
            // If fetch fails, proceed (Razorpay might have timing issues)
            console.warn("[Payment] Could not fetch Razorpay order for amount verification");
        }

        if (rpOrder) {
            const rpAmount = rpOrder.amount; // in paise
            const ourAmount = Math.round(finalTotal * 100);
            if (Math.abs(rpAmount - ourAmount) > 100) { // allow ₹1 tolerance
                console.error(`[Payment] Amount mismatch: Razorpay=${rpAmount}, Ours=${ourAmount}`);
                return res.status(400).json({
                    message: "Payment amount mismatch. Please contact support.",
                    success: false
                });
            }
        }

        // ✅ Idempotency: Check if order already created for this payment
        const existingOrder = await Order.findOne({ "payment.razorpayPaymentId": razorpay_payment_id }).lean();
        if (existingOrder) {
            return res.json({
                success: true,
                orderId: existingOrder._id,
                invoiceNumber: existingOrder.invoiceNumber,
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
            totalAmount: finalTotal,          // ✅ Server calculated
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
            coupon: appliedCoupon ? { code: appliedCoupon.couponCode, discount: appliedCoupon.discount || 0 } : undefined,
            orderMode: finalDeliveryType === "URBEXON_HOUR" ? "URBEXON_HOUR" : "ECOMMERCE",
            orderStatus: "PLACED",
            statusTimeline: { placedAt: new Date() },
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

        // ✅ Step 6: Deduct stock after order created
        await deductStock(formattedItems);
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

        // Emails async
        if (email && !email.includes("@placeholder.com")) {
            const mail = getOrderStatusEmailTemplate({ customerName, orderId: order._id, status: "PLACED" });
            sendEmail({ to: email, subject: mail.subject, html: mail.html, label: "User/NewOrder" });
        }

        sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `✅ Paid Order #${order._id.toString().slice(-6).toUpperCase()} — ₹${finalTotal}`,
            html: adminOrderEmailHTML({ order }),
            label: "Admin/NewOrder",
        });

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
            console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET not set — refusing to process");
            return res.status(500).json({ success: false, message: "Webhook not configured" });
        } else {
            const receivedSig = req.headers["x-razorpay-signature"];
            // req.body is a Buffer from express.raw()
            const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
            const expectedSig = crypto
                .createHmac("sha256", secret)
                .update(rawBody)
                .digest("hex");
            if (!receivedSig || !crypto.timingSafeEqual(Buffer.from(expectedSig, "hex"), Buffer.from(receivedSig, "hex")))
                return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }

        // Parse JSON from raw buffer
        const payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
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
                    { $set: { "refund.status": "PROCESSED", "refund.processedAt": new Date(), "refund.razorpayRefundId": refundEntity?.id } }
                );
                break;
            default:
                console.log("Unhandled webhook:", event);
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
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "Not authorized" });
        if (order.payment.method !== "RAZORPAY") return res.status(400).json({ success: false, message: "Refund only for online payment" });
        if (order.payment.status !== "PAID") return res.status(400).json({ success: false, message: "Payment not completed" });
        if (order.refund?.status && order.refund.status !== "NONE") return res.status(400).json({ message: `Refund already ${order.refund.status.toLowerCase()}` });

        order.refund = { status: "REQUESTED", amount: order.totalAmount, reason: (req.body.reason || "Customer request").trim().slice(0, 500), requested: true, requestedAt: new Date() };
        await order.save();

        res.json({ success: true, message: "Refund request submitted", refund: order.refund });
        const safeName = (order.customerName || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]);
        sendEmail({ to: process.env.ADMIN_EMAIL, subject: `💰 Refund Request #${order._id.toString().slice(-6).toUpperCase()} — ₹${order.totalAmount}`, html: `<p>Refund requested by <b>${safeName}</b>. Amount: ₹${order.totalAmount}</p>`, label: "Admin/RefundRequest" });
    } catch (err) {
        console.error("REQUEST REFUND:", err);
        res.status(500).json({ success: false, message: "Refund request failed" });
    }
};

/* ════════════════════════════════════════
   5. PROCESS REFUND (ADMIN)
════════════════════════════════════════ */
export const processRefund = async (req, res) => {
    try {
        const { action, rejectionReason = "" } = req.body;
        const act = action?.toLowerCase?.();
        if (!["approve", "reject"].includes(act)) return res.status(400).json({ success: false, message: "Invalid action" });

        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (!order.refund?.requested) return res.status(400).json({ success: false, message: "No refund request found" });
        if (order.refund.status !== "REQUESTED") return res.status(400).json({ success: false, message: `Refund already ${order.refund.status}` });

        if (act === "reject") {
            order.refund.status = "REJECTED";
            order.refund.adminNote = rejectionReason;
            order.refund.processedAt = new Date();
            order.refund.processedBy = req.user._id;
            await order.save();
            return res.json({ success: true, message: "Refund rejected" });
        }

        if (!order.payment.razorpayPaymentId) return res.status(400).json({ success: false, message: "No Razorpay payment ID on order" });

        const refundAmount = Math.round(Number(order.refund.amount || order.totalAmount) * 100);
        let rpRefund;
        try {
            rpRefund = await razorpay.payments.refund(order.payment.razorpayPaymentId, { amount: refundAmount, notes: { orderId: order._id.toString(), reason: order.refund.reason } });
        } catch (rpErr) {
            return res.status(502).json({ message: "Razorpay refund failed: " + (rpErr.error?.description || rpErr.message) });
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
        const order = await Order.findById(req.params.orderId).select("refund user payment orderStatus").lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "Not authorized" });
        res.json({ refund: order.refund || { status: "NONE" }, orderStatus: order.orderStatus, paymentStatus: order.payment?.status, paymentMethod: order.payment?.method });
    } catch (err) {
        console.error("GET REFUND STATUS:", err);
        res.status(500).json({ success: false, message: "Failed to fetch refund status" });
    }
};
